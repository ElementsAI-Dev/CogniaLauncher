//! Smart asset picker for GitHub releases
//!
//! This module provides intelligent asset matching based on platform, architecture,
//! and libc type. It uses regex patterns with word boundaries to avoid false matches.

use crate::platform::env::{Architecture, Platform};

/// Libc type for Linux systems (re-exported from platform::env when available)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LibcType {
    Glibc,
    Musl,
    Unknown,
}
use once_cell::sync::Lazy;
use regex::Regex;

/// Pre-compiled regex patterns for OS detection
static OS_LINUX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\b|[_-])(linux)(?:\b|[_-]|32|64)").unwrap());
static OS_MACOS: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\b|[_-])(darwin|macos|osx|apple)(?:\b|[_-])").unwrap());
static OS_WINDOWS: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\b|[_-])(windows|win)(?:\b|[_-]|32|64)").unwrap());

/// Pre-compiled regex patterns for architecture detection
static ARCH_X64: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\b|[_-])(x86[_-]?64|x64|amd64)(?:\b|[_-])").unwrap());
static ARCH_ARM64: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\b|[_-])(aarch64|arm64)(?:\b|[_-])").unwrap());
static ARCH_X86: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\b|[_-])(i[3-6]86|x86[_-]?32|386)(?:\b|[_-])").unwrap());

/// Pre-compiled regex patterns for libc detection
static LIBC_MUSL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\b|[_-])(musl)(?:\b|[_-])").unwrap());
static LIBC_GNU: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\b|[_-])(gnu|glibc)(?:\b|[_-])").unwrap());

/// Pattern to exclude checksum and signature files
static EXCLUDE_PATTERN: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\.(sha256|sha512|sha1|md5|sig|asc|gpg|minisig|sbom)$").unwrap());

/// Trait for asset-like types
pub trait AssetLike {
    fn name(&self) -> &str;
}

/// Smart asset picker that selects the best matching asset
#[derive(Debug, Clone)]
pub struct AssetPicker {
    platform: Platform,
    arch: Architecture,
    libc: Option<LibcType>,
}

/// Result of asset matching with score and metadata
#[derive(Debug, Clone)]
pub struct AssetMatch<'a, T> {
    pub asset: &'a T,
    pub score: i32,
    pub detected_platform: Option<Platform>,
    pub detected_arch: Option<Architecture>,
    pub is_fallback: bool,
}

impl AssetPicker {
    /// Create a new AssetPicker for the given platform and architecture
    pub fn new(platform: Platform, arch: Architecture) -> Self {
        Self {
            platform,
            arch,
            libc: None,
        }
    }

    /// Set the libc type for Linux asset matching
    pub fn with_libc(mut self, libc: LibcType) -> Self {
        self.libc = Some(libc);
        self
    }

    /// Pick the best matching asset from a list
    pub fn pick_best<'a, T: AssetLike>(&self, assets: &'a [T]) -> Option<&'a T> {
        self.pick_best_with_score(assets).map(|m| m.asset)
    }

    /// Pick the best matching asset with full match information
    pub fn pick_best_with_score<'a, T: AssetLike>(
        &self,
        assets: &'a [T],
    ) -> Option<AssetMatch<'a, T>> {
        let mut matches: Vec<AssetMatch<'a, T>> = assets
            .iter()
            .filter(|a| !self.is_excluded(a.name()))
            .filter_map(|a| self.score_asset(a))
            .collect();

        matches.sort_by_key(|m| -m.score);
        matches.into_iter().next()
    }

    /// Get all matching assets sorted by score
    pub fn get_all_matches<'a, T: AssetLike>(&self, assets: &'a [T]) -> Vec<AssetMatch<'a, T>> {
        let mut matches: Vec<AssetMatch<'a, T>> = assets
            .iter()
            .filter(|a| !self.is_excluded(a.name()))
            .filter_map(|a| self.score_asset(a))
            .collect();

        matches.sort_by_key(|m| -m.score);
        matches
    }

    /// Check if an asset should be excluded (checksums, signatures, etc.)
    fn is_excluded(&self, name: &str) -> bool {
        EXCLUDE_PATTERN.is_match(name)
    }

    /// Score an asset based on platform, arch, and libc match
    fn score_asset<'a, T: AssetLike>(&self, asset: &'a T) -> Option<AssetMatch<'a, T>> {
        let name = asset.name();
        let mut score = 0;
        let mut is_fallback = false;

        let detected_platform = self.detect_platform(name);
        let detected_arch = self.detect_arch(name);

        // Platform matching (required)
        if let Some(plat) = detected_platform {
            if plat == self.platform {
                score += 100;
            } else {
                // No match - but check for macOS ARM fallback
                return self.try_macos_arm_fallback(asset, detected_platform, detected_arch);
            }
        } else {
            // No platform detected - might be a universal binary or poorly named
            // Give it a low score but don't exclude
            score += 10;
        }

        // Architecture matching
        if let Some(arch) = detected_arch {
            if arch == self.arch {
                score += 50;
            } else if self.platform == Platform::MacOS
                && self.arch == Architecture::Aarch64
                && arch == Architecture::X86_64
            {
                // macOS ARM can run x64 via Rosetta 2
                score += 30;
                is_fallback = true;
            } else {
                // Architecture mismatch - not compatible
                return None;
            }
        } else {
            // No architecture detected - might be universal
            score += 5;
        }

        // Libc matching (Linux only)
        if self.platform == Platform::Linux {
            score += self.score_libc(name);
        }

        // Format preference bonus
        score += self.format_score(name);

        Some(AssetMatch {
            asset,
            score,
            detected_platform,
            detected_arch,
            is_fallback,
        })
    }

    /// Try macOS ARM to x64 fallback
    fn try_macos_arm_fallback<'a, T: AssetLike>(
        &self,
        asset: &'a T,
        detected_platform: Option<Platform>,
        detected_arch: Option<Architecture>,
    ) -> Option<AssetMatch<'a, T>> {
        // Only applies to macOS ARM users
        if self.platform != Platform::MacOS || self.arch != Architecture::Aarch64 {
            return None;
        }

        // Check if asset is macOS x64
        if detected_platform == Some(Platform::MacOS) && detected_arch == Some(Architecture::X86_64)
        {
            Some(AssetMatch {
                asset,
                score: 50, // Lower score than native ARM64
                detected_platform,
                detected_arch,
                is_fallback: true,
            })
        } else {
            None
        }
    }

    /// Detect platform from asset name
    fn detect_platform(&self, name: &str) -> Option<Platform> {
        if OS_LINUX.is_match(name) {
            Some(Platform::Linux)
        } else if OS_MACOS.is_match(name) {
            Some(Platform::MacOS)
        } else if OS_WINDOWS.is_match(name) {
            Some(Platform::Windows)
        } else {
            None
        }
    }

    /// Detect architecture from asset name
    fn detect_arch(&self, name: &str) -> Option<Architecture> {
        if ARCH_ARM64.is_match(name) {
            Some(Architecture::Aarch64)
        } else if ARCH_X64.is_match(name) {
            Some(Architecture::X86_64)
        } else if ARCH_X86.is_match(name) {
            Some(Architecture::X86)
        } else {
            None
        }
    }

    /// Score libc compatibility for Linux assets
    fn score_libc(&self, name: &str) -> i32 {
        let has_musl = LIBC_MUSL.is_match(name);
        let has_gnu = LIBC_GNU.is_match(name);

        match &self.libc {
            Some(LibcType::Musl) => {
                if has_musl {
                    30 // Exact match
                } else if has_gnu {
                    -100 // Incompatible, exclude by negative score
                } else {
                    0 // Unknown, might work
                }
            }
            Some(LibcType::Glibc) => {
                if has_gnu {
                    30 // Exact match
                } else if has_musl {
                    10 // musl binaries usually work on glibc systems (static linking)
                } else {
                    15 // Unknown, probably glibc
                }
            }
            Some(LibcType::Unknown) | None => 0,
        }
    }

    /// Score based on archive format preference
    fn format_score(&self, name: &str) -> i32 {
        let lower = name.to_lowercase();
        if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
            10
        } else if lower.ends_with(".tar.xz") || lower.ends_with(".txz") {
            9
        } else if lower.ends_with(".zip") {
            8
        } else if lower.ends_with(".tar.bz2") || lower.ends_with(".tbz2") {
            7
        } else if lower.ends_with(".tar.zst") {
            6
        } else if lower.ends_with(".exe")
            || lower.ends_with(".msi")
            || lower.ends_with(".dmg")
            || lower.ends_with(".pkg")
        {
            5
        } else if lower.ends_with(".deb")
            || lower.ends_with(".rpm")
            || lower.ends_with(".appimage")
        {
            4
        } else {
            3
        }
    }
}

/// Detect platform from asset name (standalone function)
pub fn detect_platform(name: &str) -> Option<Platform> {
    if OS_LINUX.is_match(name) {
        Some(Platform::Linux)
    } else if OS_MACOS.is_match(name) {
        Some(Platform::MacOS)
    } else if OS_WINDOWS.is_match(name) {
        Some(Platform::Windows)
    } else {
        None
    }
}

/// Detect architecture from asset name (standalone function)
pub fn detect_arch(name: &str) -> Option<Architecture> {
    if ARCH_ARM64.is_match(name) {
        Some(Architecture::Aarch64)
    } else if ARCH_X64.is_match(name) {
        Some(Architecture::X86_64)
    } else if ARCH_X86.is_match(name) {
        Some(Architecture::X86)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestAsset {
        name: String,
    }

    impl AssetLike for TestAsset {
        fn name(&self) -> &str {
            &self.name
        }
    }

    fn make_assets(names: &[&str]) -> Vec<TestAsset> {
        names
            .iter()
            .map(|n| TestAsset {
                name: n.to_string(),
            })
            .collect()
    }

    #[test]
    fn test_ripgrep_linux_x64() {
        let assets = make_assets(&[
            "ripgrep-14.1.0-x86_64-unknown-linux-musl.tar.gz",
            "ripgrep-14.1.0-x86_64-pc-windows-msvc.zip",
            "ripgrep-14.1.0-aarch64-apple-darwin.tar.gz",
            "ripgrep-14.1.0-x86_64-apple-darwin.tar.gz",
            "ripgrep-14.1.0.sha256",
        ]);

        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        let best = picker.pick_best(&assets).unwrap();
        assert!(best.name().contains("linux"));
        assert!(best.name().contains("x86_64"));
    }

    #[test]
    fn test_macos_arm64_native() {
        let assets = make_assets(&[
            "app-linux-x64.tar.gz",
            "app-darwin-arm64.tar.gz",
            "app-darwin-x64.tar.gz",
            "app-windows-x64.zip",
        ]);

        let picker = AssetPicker::new(Platform::MacOS, Architecture::Aarch64);
        let best = picker.pick_best(&assets).unwrap();
        assert!(best.name().contains("darwin"));
        assert!(best.name().contains("arm64"));
    }

    #[test]
    fn test_macos_arm64_fallback_to_x64() {
        let assets = make_assets(&[
            "app-linux-x64.tar.gz",
            "app-darwin-x64.tar.gz",
            "app-windows-x64.zip",
        ]);

        let picker = AssetPicker::new(Platform::MacOS, Architecture::Aarch64);
        let result = picker.pick_best_with_score(&assets).unwrap();
        assert!(result.asset.name().contains("darwin"));
        assert!(result.asset.name().contains("x64"));
        assert!(result.is_fallback);
    }

    #[test]
    fn test_linux_musl_preference() {
        let assets = make_assets(&["app-linux-x64-gnu.tar.gz", "app-linux-x64-musl.tar.gz"]);

        let picker =
            AssetPicker::new(Platform::Linux, Architecture::X86_64).with_libc(LibcType::Musl);
        let best = picker.pick_best(&assets).unwrap();
        assert!(best.name().contains("musl"));
    }

    #[test]
    fn test_linux_glibc_avoids_musl() {
        let assets = make_assets(&["app-linux-x64-gnu.tar.gz", "app-linux-x64-musl.tar.gz"]);

        let picker =
            AssetPicker::new(Platform::Linux, Architecture::X86_64).with_libc(LibcType::Glibc);
        let best = picker.pick_best(&assets).unwrap();
        assert!(best.name().contains("gnu"));
    }

    #[test]
    fn test_excludes_checksums() {
        let assets = make_assets(&[
            "app-linux-x64.tar.gz",
            "app-linux-x64.tar.gz.sha256",
            "app-linux-x64.tar.gz.sig",
        ]);

        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        let matches = picker.get_all_matches(&assets);
        assert_eq!(matches.len(), 1);
        assert!(!matches[0].asset.name().contains(".sha256"));
    }

    #[test]
    fn test_windows_matching() {
        let assets = make_assets(&[
            "app-win-x64.zip",
            "app-linux-x64.tar.gz",
            "app-darwin-x64.tar.gz",
        ]);

        let picker = AssetPicker::new(Platform::Windows, Architecture::X86_64);
        let best = picker.pick_best(&assets).unwrap();
        assert!(best.name().contains("win"));
    }

    #[test]
    fn test_detect_platform_standalone() {
        assert_eq!(
            detect_platform("app-linux-x64.tar.gz"),
            Some(Platform::Linux)
        );
        assert_eq!(
            detect_platform("app-darwin-arm64.tar.gz"),
            Some(Platform::MacOS)
        );
        assert_eq!(
            detect_platform("app-windows-x64.zip"),
            Some(Platform::Windows)
        );
        assert_eq!(detect_platform("app.tar.gz"), None);
    }

    #[test]
    fn test_format_score_tar_gz() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert_eq!(picker.format_score("app-linux-x64.tar.gz"), 10);
        assert_eq!(picker.format_score("app-linux-x64.tgz"), 10);
    }

    #[test]
    fn test_format_score_tar_xz() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert_eq!(picker.format_score("app-linux-x64.tar.xz"), 9);
        assert_eq!(picker.format_score("app-linux-x64.txz"), 9);
    }

    #[test]
    fn test_format_score_zip() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert_eq!(picker.format_score("app-linux-x64.zip"), 8);
    }

    #[test]
    fn test_format_score_tar_bz2() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert_eq!(picker.format_score("app-linux-x64.tar.bz2"), 7);
        assert_eq!(picker.format_score("app-linux-x64.tbz2"), 7);
    }

    #[test]
    fn test_format_score_tar_zst() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert_eq!(picker.format_score("app-linux-x64.tar.zst"), 6);
    }

    #[test]
    fn test_format_score_installers() {
        let picker = AssetPicker::new(Platform::Windows, Architecture::X86_64);
        assert_eq!(picker.format_score("app-win-x64.exe"), 5);
        assert_eq!(picker.format_score("app-win-x64.msi"), 5);
        assert_eq!(picker.format_score("app-darwin-arm64.dmg"), 5);
        assert_eq!(picker.format_score("app-darwin-arm64.pkg"), 5);
    }

    #[test]
    fn test_format_score_packages() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert_eq!(picker.format_score("app-linux-x64.deb"), 4);
        assert_eq!(picker.format_score("app-linux-x64.rpm"), 4);
        assert_eq!(picker.format_score("app-linux-x64.AppImage"), 4);
    }

    #[test]
    fn test_format_score_unknown() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert_eq!(picker.format_score("app-linux-x64"), 3);
        assert_eq!(picker.format_score("app-linux-x64.bin"), 3);
    }

    #[test]
    fn test_libc_scoring_musl_system() {
        let picker =
            AssetPicker::new(Platform::Linux, Architecture::X86_64).with_libc(LibcType::Musl);
        assert_eq!(picker.score_libc("app-linux-x64-musl.tar.gz"), 30);
        assert_eq!(picker.score_libc("app-linux-x64-gnu.tar.gz"), -100);
        assert_eq!(picker.score_libc("app-linux-x64.tar.gz"), 0);
    }

    #[test]
    fn test_libc_scoring_glibc_system() {
        let picker =
            AssetPicker::new(Platform::Linux, Architecture::X86_64).with_libc(LibcType::Glibc);
        assert_eq!(picker.score_libc("app-linux-x64-gnu.tar.gz"), 30);
        assert_eq!(picker.score_libc("app-linux-x64-musl.tar.gz"), 10);
        assert_eq!(picker.score_libc("app-linux-x64.tar.gz"), 15);
    }

    #[test]
    fn test_libc_scoring_unknown() {
        let picker =
            AssetPicker::new(Platform::Linux, Architecture::X86_64).with_libc(LibcType::Unknown);
        assert_eq!(picker.score_libc("app-linux-x64-musl.tar.gz"), 0);
        assert_eq!(picker.score_libc("app-linux-x64-gnu.tar.gz"), 0);
    }

    #[test]
    fn test_libc_scoring_none() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert_eq!(picker.score_libc("app-linux-x64-musl.tar.gz"), 0);
    }

    #[test]
    fn test_is_excluded_all_patterns() {
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert!(picker.is_excluded("file.sha256"));
        assert!(picker.is_excluded("file.sha512"));
        assert!(picker.is_excluded("file.sha1"));
        assert!(picker.is_excluded("file.md5"));
        assert!(picker.is_excluded("file.sig"));
        assert!(picker.is_excluded("file.asc"));
        assert!(picker.is_excluded("file.gpg"));
        assert!(picker.is_excluded("file.minisig"));
        assert!(picker.is_excluded("file.sbom"));
        // Non-excluded
        assert!(!picker.is_excluded("file.tar.gz"));
        assert!(!picker.is_excluded("file.zip"));
    }

    #[test]
    fn test_pick_best_empty_assets() {
        let assets: Vec<TestAsset> = vec![];
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        assert!(picker.pick_best(&assets).is_none());
    }

    #[test]
    fn test_pick_best_no_matching_platform() {
        let assets = make_assets(&[
            "app-windows-x64.zip",
            "app-darwin-arm64.tar.gz",
        ]);
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        // No Linux asset → should still return something (platform-less scores)
        // or None if all are mismatched
        let result = picker.pick_best(&assets);
        // Windows and macOS won't match Linux, so None
        assert!(result.is_none());
    }

    #[test]
    fn test_get_all_matches_sorted_by_score() {
        let assets = make_assets(&[
            "app-linux-x64.tar.gz",
            "app-linux-x64.zip",
            "app-linux-x64.tar.xz",
        ]);
        let picker = AssetPicker::new(Platform::Linux, Architecture::X86_64);
        let matches = picker.get_all_matches(&assets);
        assert_eq!(matches.len(), 3);
        // Should be sorted by descending score
        assert!(matches[0].score >= matches[1].score);
        assert!(matches[1].score >= matches[2].score);
        // tar.gz (10) > tar.xz (9) > zip (8)
        assert!(matches[0].asset.name().contains(".tar.gz"));
    }

    #[test]
    fn test_detect_platform_osx_variant() {
        assert_eq!(detect_platform("app-osx-x64.tar.gz"), Some(Platform::MacOS));
        assert_eq!(
            detect_platform("app-apple-arm64.tar.gz"),
            Some(Platform::MacOS)
        );
        assert_eq!(
            detect_platform("app-macos-arm64.tar.gz"),
            Some(Platform::MacOS)
        );
    }

    #[test]
    fn test_detect_arch_386() {
        assert_eq!(detect_arch("app-linux-386.tar.gz"), Some(Architecture::X86));
        assert_eq!(
            detect_arch("app-linux-i386.tar.gz"),
            Some(Architecture::X86)
        );
        assert_eq!(
            detect_arch("app-linux-i686.tar.gz"),
            Some(Architecture::X86)
        );
    }

    #[test]
    fn test_macos_arm_no_fallback_for_linux_user() {
        let assets = make_assets(&[
            "app-darwin-arm64.tar.gz",
            "app-darwin-x64.tar.gz",
        ]);
        // Linux ARM64 user should NOT get macOS fallback
        let picker = AssetPicker::new(Platform::Linux, Architecture::Aarch64);
        let result = picker.pick_best(&assets);
        assert!(result.is_none());
    }

    #[test]
    fn test_windows_x86_arch_mismatch() {
        let assets = make_assets(&["app-windows-x64.zip"]);
        // Windows x86 user should NOT get x64 asset (no Rosetta-like fallback on Windows)
        let picker = AssetPicker::new(Platform::Windows, Architecture::X86);
        let result = picker.pick_best(&assets);
        assert!(result.is_none());
    }

    #[test]
    fn test_detect_arch_standalone() {
        assert_eq!(
            detect_arch("app-linux-x86_64.tar.gz"),
            Some(Architecture::X86_64)
        );
        assert_eq!(
            detect_arch("app-linux-amd64.tar.gz"),
            Some(Architecture::X86_64)
        );
        assert_eq!(
            detect_arch("app-darwin-arm64.tar.gz"),
            Some(Architecture::Aarch64)
        );
        assert_eq!(
            detect_arch("app-darwin-aarch64.tar.gz"),
            Some(Architecture::Aarch64)
        );
        assert_eq!(
            detect_arch("app-linux-i686.tar.gz"),
            Some(Architecture::X86)
        );
        assert_eq!(detect_arch("app.tar.gz"), None);
    }
}
