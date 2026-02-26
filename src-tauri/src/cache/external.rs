//! External package manager cache management
//!
//! This module provides cross-platform discovery and cleanup of external
//! package manager caches (npm, pip, pnpm, yarn, cargo, uv, etc.)

use crate::error::{CogniaError, CogniaResult};
use crate::platform::{disk::format_size, fs, process};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Supported external cache providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExternalCacheProvider {
    Npm,
    Pnpm,
    Yarn,
    Pip,
    Uv,
    Cargo,
    Bundler,
    Go,
    #[cfg(not(windows))]
    Brew,
    Dotnet,
    // New providers
    Composer,
    Poetry,
    Conda,
    Deno,
    Bun,
    Gradle,
    // Extended providers
    Maven,
    Gem,
    Rustup,
    #[cfg(windows)]
    Scoop,
    #[cfg(windows)]
    Chocolatey,
    // System caches
    #[cfg(windows)]
    WindowsTemp,
    #[cfg(windows)]
    WindowsThumbnail,
    #[cfg(target_os = "macos")]
    MacOsCache,
    #[cfg(target_os = "macos")]
    MacOsLogs,
    #[cfg(target_os = "linux")]
    LinuxCache,
    // Developer tool caches
    Docker,
    Podman,
    Flutter,
    #[cfg(target_os = "macos")]
    CocoaPods,
    Cypress,
    Electron,
    Vcpkg,
    Sbt,
}

impl ExternalCacheProvider {
    /// Get all providers for the current platform
    pub fn all() -> Vec<Self> {
        vec![
            Self::Npm,
            Self::Pnpm,
            Self::Yarn,
            Self::Pip,
            Self::Uv,
            Self::Cargo,
            Self::Bundler,
            Self::Go,
            #[cfg(not(windows))]
            Self::Brew,
            Self::Dotnet,
            // New providers
            Self::Composer,
            Self::Poetry,
            Self::Conda,
            Self::Deno,
            Self::Bun,
            Self::Gradle,
            Self::Maven,
            Self::Gem,
            Self::Rustup,
            #[cfg(windows)]
            Self::Scoop,
            #[cfg(windows)]
            Self::Chocolatey,
            // System caches
            #[cfg(windows)]
            Self::WindowsTemp,
            #[cfg(windows)]
            Self::WindowsThumbnail,
            #[cfg(target_os = "macos")]
            Self::MacOsCache,
            #[cfg(target_os = "macos")]
            Self::MacOsLogs,
            #[cfg(target_os = "linux")]
            Self::LinuxCache,
            // Developer tool caches
            Self::Docker,
            Self::Podman,
            Self::Flutter,
            #[cfg(target_os = "macos")]
            Self::CocoaPods,
            Self::Cypress,
            Self::Electron,
            Self::Vcpkg,
            Self::Sbt,
        ]
    }

    /// Get the provider ID
    pub fn id(&self) -> &'static str {
        match self {
            Self::Npm => "npm",
            Self::Pnpm => "pnpm",
            Self::Yarn => "yarn",
            Self::Pip => "pip",
            Self::Uv => "uv",
            Self::Cargo => "cargo",
            Self::Bundler => "bundler",
            Self::Go => "go",
            #[cfg(not(windows))]
            Self::Brew => "brew",
            Self::Dotnet => "dotnet",
            Self::Composer => "composer",
            Self::Poetry => "poetry",
            Self::Conda => "conda",
            Self::Deno => "deno",
            Self::Bun => "bun",
            Self::Gradle => "gradle",
            Self::Maven => "maven",
            Self::Gem => "gem",
            Self::Rustup => "rustup",
            #[cfg(windows)]
            Self::Scoop => "scoop",
            #[cfg(windows)]
            Self::Chocolatey => "chocolatey",
            // System caches
            #[cfg(windows)]
            Self::WindowsTemp => "windows_temp",
            #[cfg(windows)]
            Self::WindowsThumbnail => "windows_thumbnail",
            #[cfg(target_os = "macos")]
            Self::MacOsCache => "macos_cache",
            #[cfg(target_os = "macos")]
            Self::MacOsLogs => "macos_logs",
            #[cfg(target_os = "linux")]
            Self::LinuxCache => "linux_cache",
            // Developer tool caches
            Self::Docker => "docker",
            Self::Podman => "podman",
            Self::Flutter => "flutter",
            #[cfg(target_os = "macos")]
            Self::CocoaPods => "cocoapods",
            Self::Cypress => "cypress",
            Self::Electron => "electron",
            Self::Vcpkg => "vcpkg",
            Self::Sbt => "sbt",
        }
    }

    /// Get the display name
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Npm => "npm (Node.js)",
            Self::Pnpm => "pnpm",
            Self::Yarn => "Yarn",
            Self::Pip => "pip (Python)",
            Self::Uv => "uv (Python)",
            Self::Cargo => "Cargo (Rust)",
            Self::Bundler => "Bundler (Ruby)",
            Self::Go => "Go Modules",
            #[cfg(not(windows))]
            Self::Brew => "Homebrew",
            Self::Dotnet => "NuGet (.NET)",
            Self::Composer => "Composer (PHP)",
            Self::Poetry => "Poetry (Python)",
            Self::Conda => "Conda (Python)",
            Self::Deno => "Deno",
            Self::Bun => "Bun",
            Self::Gradle => "Gradle (Java)",
            Self::Maven => "Maven (Java)",
            Self::Gem => "RubyGems",
            Self::Rustup => "Rustup (Rust)",
            #[cfg(windows)]
            Self::Scoop => "Scoop (Windows)",
            #[cfg(windows)]
            Self::Chocolatey => "Chocolatey (Windows)",
            // System caches
            #[cfg(windows)]
            Self::WindowsTemp => "Windows Temp Files",
            #[cfg(windows)]
            Self::WindowsThumbnail => "Windows Thumbnails",
            #[cfg(target_os = "macos")]
            Self::MacOsCache => "macOS User Cache",
            #[cfg(target_os = "macos")]
            Self::MacOsLogs => "macOS User Logs",
            #[cfg(target_os = "linux")]
            Self::LinuxCache => "Linux User Cache",
            // Developer tool caches
            Self::Docker => "Docker Build Cache",
            Self::Podman => "Podman Build Cache",
            Self::Flutter => "Flutter/Dart Pub",
            #[cfg(target_os = "macos")]
            Self::CocoaPods => "CocoaPods",
            Self::Cypress => "Cypress",
            Self::Electron => "Electron",
            Self::Vcpkg => "vcpkg (C++)",
            Self::Sbt => "sbt/Ivy (Scala)",
        }
    }

    /// Get the command to check if the tool is available
    pub fn command(&self) -> &'static str {
        match self {
            Self::Npm => "npm",
            Self::Pnpm => "pnpm",
            Self::Yarn => "yarn",
            Self::Pip => "pip",
            Self::Uv => "uv",
            Self::Cargo => "cargo",
            Self::Bundler => "bundle",
            Self::Go => "go",
            #[cfg(not(windows))]
            Self::Brew => "brew",
            Self::Dotnet => "dotnet",
            Self::Composer => "composer",
            Self::Poetry => "poetry",
            Self::Conda => "conda",
            Self::Deno => "deno",
            Self::Bun => "bun",
            Self::Gradle => "gradle",
            Self::Maven => "mvn",
            Self::Gem => "gem",
            Self::Rustup => "rustup",
            #[cfg(windows)]
            Self::Scoop => "scoop",
            #[cfg(windows)]
            Self::Chocolatey => "choco",
            // System caches - use always-available OS commands
            #[cfg(windows)]
            Self::WindowsTemp => "cmd",
            #[cfg(windows)]
            Self::WindowsThumbnail => "cmd",
            #[cfg(target_os = "macos")]
            Self::MacOsCache => "sw_vers",
            #[cfg(target_os = "macos")]
            Self::MacOsLogs => "sw_vers",
            #[cfg(target_os = "linux")]
            Self::LinuxCache => "uname",
            // Developer tool caches
            Self::Docker => "docker",
            Self::Podman => "podman",
            Self::Flutter => "flutter",
            #[cfg(target_os = "macos")]
            Self::CocoaPods => "pod",
            Self::Cypress => "cypress",
            Self::Electron => "electron",
            Self::Vcpkg => "vcpkg",
            Self::Sbt => "sbt",
        }
    }

    /// Get the cache directory path for this provider (cross-platform)
    pub fn cache_path(&self) -> Option<PathBuf> {
        match self {
            Self::Npm => get_npm_cache_path(),
            Self::Pnpm => get_pnpm_cache_path(),
            Self::Yarn => get_yarn_cache_path(),
            Self::Pip => get_pip_cache_path(),
            Self::Uv => get_uv_cache_path(),
            Self::Cargo => get_cargo_cache_path(),
            Self::Bundler => get_bundler_cache_path(),
            Self::Go => get_go_cache_path(),
            #[cfg(not(windows))]
            Self::Brew => get_brew_cache_path(),
            Self::Dotnet => get_dotnet_cache_path(),
            Self::Composer => get_composer_cache_path(),
            Self::Poetry => get_poetry_cache_path(),
            Self::Conda => get_conda_cache_path(),
            Self::Deno => get_deno_cache_path(),
            Self::Bun => get_bun_cache_path(),
            Self::Gradle => get_gradle_cache_path(),
            Self::Maven => get_maven_cache_path(),
            Self::Gem => get_gem_cache_path(),
            Self::Rustup => get_rustup_cache_path(),
            #[cfg(windows)]
            Self::Scoop => get_scoop_cache_path(),
            #[cfg(windows)]
            Self::Chocolatey => get_chocolatey_cache_path(),
            // System caches
            #[cfg(windows)]
            Self::WindowsTemp => get_windows_temp_path(),
            #[cfg(windows)]
            Self::WindowsThumbnail => get_windows_thumbnail_path(),
            #[cfg(target_os = "macos")]
            Self::MacOsCache => get_macos_cache_path(),
            #[cfg(target_os = "macos")]
            Self::MacOsLogs => get_macos_logs_path(),
            #[cfg(target_os = "linux")]
            Self::LinuxCache => get_linux_cache_path(),
            // Developer tool caches
            Self::Docker => get_docker_cache_path(),
            Self::Podman => get_podman_cache_path(),
            Self::Flutter => get_flutter_cache_path(),
            #[cfg(target_os = "macos")]
            Self::CocoaPods => get_cocoapods_cache_path(),
            Self::Cypress => get_cypress_cache_path(),
            Self::Electron => get_electron_cache_path(),
            Self::Vcpkg => get_vcpkg_cache_path(),
            Self::Sbt => get_sbt_cache_path(),
        }
    }

    /// Get the clean command for this provider (None means direct delete)
    pub fn clean_command(&self) -> Option<(&'static str, &'static [&'static str])> {
        match self {
            Self::Npm => Some(("npm", &["cache", "clean", "--force"])),
            Self::Pnpm => Some(("pnpm", &["store", "prune"])),
            Self::Yarn => Some(("yarn", &["cache", "clean"])),
            Self::Pip => Some(("pip", &["cache", "purge"])),
            Self::Uv => Some(("uv", &["cache", "clean"])),
            Self::Cargo => None, // Direct delete
            Self::Bundler => Some(("bundle", &["clean", "--force"])),
            Self::Go => Some(("go", &["clean", "-modcache"])),
            #[cfg(not(windows))]
            Self::Brew => Some(("brew", &["cleanup", "--prune=all"])),
            Self::Dotnet => Some(("dotnet", &["nuget", "locals", "all", "--clear"])),
            Self::Composer => Some(("composer", &["clear-cache"])),
            Self::Poetry => None, // Direct delete; poetry cache clear requires specifying cache names
            Self::Conda => Some(("conda", &["clean", "--all", "-y"])),
            Self::Deno => Some(("deno", &["clean"])),
            Self::Bun => None,    // Direct delete
            Self::Gradle => None, // Direct delete (daemon should be stopped first)
            Self::Maven => None,  // Direct delete of .m2/repository
            Self::Gem => None,    // Direct delete of gem cache dir
            Self::Rustup => None, // Direct delete of downloads dir
            #[cfg(windows)]
            Self::Scoop => Some(("scoop", &["cache", "rm", "*"])),
            #[cfg(windows)]
            Self::Chocolatey => None, // Direct delete; choco cache command unavailable in many versions
            // System caches - all use direct content cleaning
            #[cfg(windows)]
            Self::WindowsTemp => None,
            #[cfg(windows)]
            Self::WindowsThumbnail => None,
            #[cfg(target_os = "macos")]
            Self::MacOsCache => None,
            #[cfg(target_os = "macos")]
            Self::MacOsLogs => None,
            #[cfg(target_os = "linux")]
            Self::LinuxCache => None,
            // Developer tool caches
            Self::Docker => Some(("docker", &["builder", "prune", "-f"])),
            Self::Podman => Some(("podman", &["system", "prune", "-f"])),
            Self::Flutter => None, // Direct delete of pub-cache
            #[cfg(target_os = "macos")]
            Self::CocoaPods => Some(("pod", &["cache", "clean", "--all"])),
            Self::Cypress => None,  // Direct delete
            Self::Electron => None, // Direct delete
            Self::Vcpkg => None,    // Direct delete of binary cache
            Self::Sbt => None,      // Direct delete of ivy cache
        }
    }

    /// Parse provider from string
    pub fn parse_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "npm" => Some(Self::Npm),
            "pnpm" => Some(Self::Pnpm),
            "yarn" => Some(Self::Yarn),
            "pip" => Some(Self::Pip),
            "uv" => Some(Self::Uv),
            "cargo" => Some(Self::Cargo),
            "bundler" | "bundle" => Some(Self::Bundler),
            "go" | "golang" => Some(Self::Go),
            #[cfg(not(windows))]
            "brew" | "homebrew" => Some(Self::Brew),
            "dotnet" | "nuget" => Some(Self::Dotnet),
            "composer" => Some(Self::Composer),
            "poetry" => Some(Self::Poetry),
            "conda" | "miniconda" | "anaconda" => Some(Self::Conda),
            "deno" => Some(Self::Deno),
            "bun" => Some(Self::Bun),
            "gradle" => Some(Self::Gradle),
            "maven" | "mvn" => Some(Self::Maven),
            "gem" | "rubygems" => Some(Self::Gem),
            "rustup" => Some(Self::Rustup),
            #[cfg(windows)]
            "scoop" => Some(Self::Scoop),
            #[cfg(windows)]
            "chocolatey" | "choco" => Some(Self::Chocolatey),
            // System caches
            #[cfg(windows)]
            "windows_temp" | "temp" => Some(Self::WindowsTemp),
            #[cfg(windows)]
            "windows_thumbnail" | "thumbnail" | "thumbcache" => Some(Self::WindowsThumbnail),
            #[cfg(target_os = "macos")]
            "macos_cache" | "macos_user_cache" => Some(Self::MacOsCache),
            #[cfg(target_os = "macos")]
            "macos_logs" | "macos_user_logs" => Some(Self::MacOsLogs),
            #[cfg(target_os = "linux")]
            "linux_cache" | "linux_user_cache" => Some(Self::LinuxCache),
            // Developer tool caches
            "docker" => Some(Self::Docker),
            "podman" => Some(Self::Podman),
            "flutter" | "dart" | "pub" => Some(Self::Flutter),
            #[cfg(target_os = "macos")]
            "cocoapods" | "pod" | "pods" => Some(Self::CocoaPods),
            "cypress" => Some(Self::Cypress),
            "electron" => Some(Self::Electron),
            "vcpkg" => Some(Self::Vcpkg),
            "sbt" | "ivy" | "ivy2" => Some(Self::Sbt),
            _ => None,
        }
    }

    /// Get the provider category for UI grouping
    pub fn category(&self) -> &'static str {
        match self {
            // System caches
            #[cfg(windows)]
            Self::WindowsTemp | Self::WindowsThumbnail => "system",
            #[cfg(target_os = "macos")]
            Self::MacOsCache | Self::MacOsLogs => "system",
            #[cfg(target_os = "linux")]
            Self::LinuxCache => "system",
            // Developer tool caches
            Self::Docker
            | Self::Podman
            | Self::Flutter
            | Self::Cypress
            | Self::Electron
            | Self::Vcpkg
            | Self::Sbt => "devtools",
            #[cfg(target_os = "macos")]
            Self::CocoaPods => "devtools",
            // Package managers
            _ => "package_manager",
        }
    }

    /// Whether the cache directory should be preserved (only clean contents, not delete the dir)
    pub fn should_preserve_dir(&self) -> bool {
        match self {
            #[cfg(windows)]
            Self::WindowsTemp | Self::WindowsThumbnail => true,
            #[cfg(target_os = "macos")]
            Self::MacOsCache | Self::MacOsLogs => true,
            #[cfg(target_os = "linux")]
            Self::LinuxCache => true,
            _ => false,
        }
    }
}

/// External cache information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalCacheInfo {
    pub provider: String,
    pub display_name: String,
    pub cache_path: String,
    pub size: u64,
    pub size_human: String,
    pub is_available: bool,
    pub can_clean: bool,
    pub category: String,
}

/// Result of cleaning external cache
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalCacheCleanResult {
    pub provider: String,
    pub display_name: String,
    pub freed_bytes: u64,
    pub freed_human: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Combined cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CombinedCacheStats {
    pub internal_size: u64,
    pub internal_size_human: String,
    pub external_size: u64,
    pub external_size_human: String,
    pub total_size: u64,
    pub total_size_human: String,
    pub external_caches: Vec<ExternalCacheInfo>,
}

// ============================================================================
// Cross-platform cache path functions
// ============================================================================

fn get_npm_cache_path() -> Option<PathBuf> {
    // Check npm_config_cache first (npm uses lowercase env var convention)
    if let Ok(cache_dir) = std::env::var("npm_config_cache") {
        return Some(PathBuf::from(cache_dir));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("npm-cache"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".npm"))
    }
}

fn get_pnpm_cache_path() -> Option<PathBuf> {
    // Check PNPM_STORE_DIR first (official env var for store location)
    if let Ok(store_dir) = std::env::var("PNPM_STORE_DIR") {
        return Some(PathBuf::from(store_dir));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("pnpm").join("store"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("pnpm").join("store"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_DATA_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
            .map(|p| p.join("pnpm").join("store"))
    }
}

fn get_yarn_cache_path() -> Option<PathBuf> {
    // Check YARN_CACHE_FOLDER first (official env var)
    if let Ok(cache_dir) = std::env::var("YARN_CACHE_FOLDER") {
        return Some(PathBuf::from(cache_dir));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("Yarn").join("Cache"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("Caches").join("Yarn"))
    }
    #[cfg(target_os = "linux")]
    {
        dirs::home_dir().map(|h| h.join(".cache").join("yarn"))
    }
}

fn get_pip_cache_path() -> Option<PathBuf> {
    // Check PIP_CACHE_DIR first (official env var, pip >= 22.3)
    if let Ok(cache_dir) = std::env::var("PIP_CACHE_DIR") {
        return Some(PathBuf::from(cache_dir));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("pip").join("Cache"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("Caches").join("pip"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|h| h.join(".cache")))
            .map(|p| p.join("pip"))
    }
}

fn get_uv_cache_path() -> Option<PathBuf> {
    // Check UV_CACHE_DIR first
    if let Ok(cache_dir) = std::env::var("UV_CACHE_DIR") {
        return Some(PathBuf::from(cache_dir));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("uv").join("cache"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".cache").join("uv"))
    }
}

fn get_cargo_cache_path() -> Option<PathBuf> {
    // Check CARGO_HOME first
    if let Ok(cargo_home) = std::env::var("CARGO_HOME") {
        return Some(PathBuf::from(cargo_home).join("registry").join("cache"));
    }

    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").ok().map(|p| {
            PathBuf::from(p)
                .join(".cargo")
                .join("registry")
                .join("cache")
        })
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".cargo").join("registry").join("cache"))
    }
}

fn get_bundler_cache_path() -> Option<PathBuf> {
    // Check BUNDLE_PATH first (official env var for bundle install location)
    if let Ok(bundle_path) = std::env::var("BUNDLE_PATH") {
        return Some(PathBuf::from(bundle_path).join("cache"));
    }

    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join(".bundle").join("cache"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".bundle").join("cache"))
    }
}

fn get_go_cache_path() -> Option<PathBuf> {
    // Check GOMODCACHE first
    if let Ok(gomodcache) = std::env::var("GOMODCACHE") {
        return Some(PathBuf::from(gomodcache));
    }

    // Check GOPATH
    if let Ok(gopath) = std::env::var("GOPATH") {
        return Some(PathBuf::from(gopath).join("pkg").join("mod").join("cache"));
    }

    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").ok().map(|p| {
            PathBuf::from(p)
                .join("go")
                .join("pkg")
                .join("mod")
                .join("cache")
        })
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join("go").join("pkg").join("mod").join("cache"))
    }
}

#[cfg(not(windows))]
fn get_brew_cache_path() -> Option<PathBuf> {
    // Check HOMEBREW_CACHE first
    if let Ok(cache) = std::env::var("HOMEBREW_CACHE") {
        return Some(PathBuf::from(cache));
    }

    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("Caches").join("Homebrew"))
    }
    #[cfg(target_os = "linux")]
    {
        dirs::home_dir().map(|h| h.join(".cache").join("Homebrew"))
    }
}

fn get_dotnet_cache_path() -> Option<PathBuf> {
    // Check NUGET_PACKAGES first (official env var for global packages folder)
    if let Ok(nuget_packages) = std::env::var("NUGET_PACKAGES") {
        return Some(PathBuf::from(nuget_packages));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("NuGet").join("v3-cache"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".nuget").join("packages"))
    }
}

// ============================================================================
// New provider cache path functions
// ============================================================================

fn get_composer_cache_path() -> Option<PathBuf> {
    // Check COMPOSER_CACHE_DIR first
    if let Ok(cache_dir) = std::env::var("COMPOSER_CACHE_DIR") {
        return Some(PathBuf::from(cache_dir));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("Composer"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("Caches").join("composer"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|h| h.join(".cache")))
            .map(|p| p.join("composer"))
    }
}

fn get_poetry_cache_path() -> Option<PathBuf> {
    // Check POETRY_CACHE_DIR first
    if let Ok(cache_dir) = std::env::var("POETRY_CACHE_DIR") {
        return Some(PathBuf::from(cache_dir));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("pypoetry"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("Caches").join("pypoetry"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|h| h.join(".cache")))
            .map(|p| p.join("pypoetry"))
    }
}

fn get_conda_cache_path() -> Option<PathBuf> {
    // Check CONDA_PKGS_DIRS first
    if let Ok(pkgs_dirs) = std::env::var("CONDA_PKGS_DIRS") {
        // Take the first directory if multiple are specified
        // Conda uses ';' as separator on Windows, ':' on Unix
        #[cfg(windows)]
        let sep = ';';
        #[cfg(not(windows))]
        let sep = ':';
        if let Some(first) = pkgs_dirs.split(sep).next() {
            if !first.is_empty() {
                return Some(PathBuf::from(first));
            }
        }
    }

    // Check common installation locations
    let candidates: Vec<Option<PathBuf>> = vec![
        dirs::home_dir().map(|h| h.join(".conda").join("pkgs")),
        dirs::home_dir().map(|h| h.join("miniconda3").join("pkgs")),
        dirs::home_dir().map(|h| h.join("anaconda3").join("pkgs")),
        #[cfg(windows)]
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join("miniconda3").join("pkgs")),
        #[cfg(windows)]
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join("anaconda3").join("pkgs")),
    ];

    candidates
        .into_iter()
        .flatten()
        .find(|p| p.exists())
        .or_else(|| dirs::home_dir().map(|h| h.join(".conda").join("pkgs")))
}

fn get_deno_cache_path() -> Option<PathBuf> {
    // Check DENO_DIR first
    if let Ok(deno_dir) = std::env::var("DENO_DIR") {
        return Some(PathBuf::from(deno_dir));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("deno"))
    }
    #[cfg(not(windows))]
    {
        std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|h| h.join(".cache")))
            .map(|p| p.join("deno"))
    }
}

fn get_bun_cache_path() -> Option<PathBuf> {
    // Check BUN_INSTALL_CACHE_DIR first
    if let Ok(cache_dir) = std::env::var("BUN_INSTALL_CACHE_DIR") {
        return Some(PathBuf::from(cache_dir));
    }

    // Check BUN_INSTALL for custom install location
    if let Ok(bun_install) = std::env::var("BUN_INSTALL") {
        return Some(PathBuf::from(bun_install).join("install").join("cache"));
    }

    dirs::home_dir().map(|h| h.join(".bun").join("install").join("cache"))
}

fn get_gradle_cache_path() -> Option<PathBuf> {
    // Check GRADLE_USER_HOME first
    if let Ok(gradle_home) = std::env::var("GRADLE_USER_HOME") {
        return Some(PathBuf::from(gradle_home).join("caches"));
    }

    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join(".gradle").join("caches"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".gradle").join("caches"))
    }
}

#[cfg(windows)]
fn get_scoop_cache_path() -> Option<PathBuf> {
    // Check SCOOP environment variable first
    if let Ok(scoop_dir) = std::env::var("SCOOP") {
        return Some(PathBuf::from(scoop_dir).join("cache"));
    }

    std::env::var("USERPROFILE")
        .ok()
        .map(|p| PathBuf::from(p).join("scoop").join("cache"))
}

#[cfg(windows)]
fn get_chocolatey_cache_path() -> Option<PathBuf> {
    // Check ChocolateyInstall env var first (set by Chocolatey installer)
    // Chocolatey uses TEMP by default, or cacheLocation config key
    // The install dir itself contains lib/ with cached .nupkg files
    if let Ok(choco_install) = std::env::var("ChocolateyInstall") {
        let lib_cache = PathBuf::from(&choco_install).join("lib");
        if lib_cache.exists() {
            return Some(lib_cache);
        }
    }

    // User-level cache (non-elevated)
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let user_cache = PathBuf::from(&profile)
            .join(".chocolatey")
            .join("http-cache");
        if user_cache.exists() {
            return Some(user_cache);
        }
    }

    // System-level cache (elevated, requires admin)
    let system_cache = PathBuf::from("C:\\ProgramData\\ChocolateyHttpCache");
    if system_cache.exists() {
        return Some(system_cache);
    }

    // Fallback: default Chocolatey lib dir
    Some(PathBuf::from("C:\\ProgramData\\chocolatey\\lib"))
}

// ============================================================================
// Extended provider cache path functions
// ============================================================================

fn get_maven_cache_path() -> Option<PathBuf> {
    // Check MAVEN_REPO_LOCAL first (custom local repo)
    if let Ok(repo) = std::env::var("MAVEN_REPO_LOCAL") {
        return Some(PathBuf::from(repo));
    }

    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join(".m2").join("repository"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".m2").join("repository"))
    }
}

fn get_gem_cache_path() -> Option<PathBuf> {
    // Check GEM_HOME first
    if let Ok(gem_home) = std::env::var("GEM_HOME") {
        return Some(PathBuf::from(gem_home).join("cache"));
    }

    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join(".gem").join("cache"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".gem").join("cache"))
    }
}

fn get_rustup_cache_path() -> Option<PathBuf> {
    // Check RUSTUP_HOME first
    if let Ok(rustup_home) = std::env::var("RUSTUP_HOME") {
        return Some(PathBuf::from(rustup_home).join("downloads"));
    }

    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join(".rustup").join("downloads"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".rustup").join("downloads"))
    }
}

// ============================================================================
// System cache path functions
// ============================================================================

#[cfg(windows)]
fn get_windows_temp_path() -> Option<PathBuf> {
    std::env::var("TEMP")
        .ok()
        .or_else(|| std::env::var("TMP").ok())
        .map(PathBuf::from)
}

#[cfg(windows)]
fn get_windows_thumbnail_path() -> Option<PathBuf> {
    std::env::var("LOCALAPPDATA").ok().map(|p| {
        PathBuf::from(p)
            .join("Microsoft")
            .join("Windows")
            .join("Explorer")
    })
}

#[cfg(target_os = "macos")]
fn get_macos_cache_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join("Library").join("Caches"))
}

#[cfg(target_os = "macos")]
fn get_macos_logs_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join("Library").join("Logs"))
}

#[cfg(target_os = "linux")]
fn get_linux_cache_path() -> Option<PathBuf> {
    std::env::var("XDG_CACHE_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|h| h.join(".cache")))
}

// ============================================================================
// Developer tool cache path functions
// ============================================================================

fn get_docker_cache_path() -> Option<PathBuf> {
    // Docker manages its own storage via the daemon; no single user-accessible cache directory.
    // The clean_command (docker builder prune) handles cleanup.
    // Return None so discovery relies on is_available instead of has_cache_dir.
    None
}

fn get_podman_cache_path() -> Option<PathBuf> {
    // Podman is daemonless; storage is managed per-user.
    // The clean_command (podman system prune) handles cleanup.
    // Return None so discovery relies on is_available instead of has_cache_dir.
    None
}

fn get_flutter_cache_path() -> Option<PathBuf> {
    // Check PUB_CACHE first
    if let Ok(pub_cache) = std::env::var("PUB_CACHE") {
        return Some(PathBuf::from(pub_cache));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("Pub").join("Cache"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".pub-cache"))
    }
}

#[cfg(target_os = "macos")]
fn get_cocoapods_cache_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join("Library").join("Caches").join("CocoaPods"))
}

fn get_cypress_cache_path() -> Option<PathBuf> {
    // Check CYPRESS_CACHE_FOLDER first
    if let Ok(cache) = std::env::var("CYPRESS_CACHE_FOLDER") {
        return Some(PathBuf::from(cache));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("Cypress").join("Cache"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("Caches").join("Cypress"))
    }
    #[cfg(target_os = "linux")]
    {
        dirs::home_dir().map(|h| h.join(".cache").join("Cypress"))
    }
}

fn get_electron_cache_path() -> Option<PathBuf> {
    // Check ELECTRON_CACHE first
    if let Ok(cache) = std::env::var("ELECTRON_CACHE") {
        return Some(PathBuf::from(cache));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("electron").join("Cache"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("Caches").join("electron"))
    }
    #[cfg(target_os = "linux")]
    {
        dirs::home_dir().map(|h| h.join(".cache").join("electron"))
    }
}

fn get_vcpkg_cache_path() -> Option<PathBuf> {
    // Check VCPKG_DEFAULT_BINARY_CACHE first
    if let Ok(cache) = std::env::var("VCPKG_DEFAULT_BINARY_CACHE") {
        return Some(PathBuf::from(cache));
    }

    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("vcpkg").join("archives"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".cache").join("vcpkg").join("archives"))
    }
}

fn get_sbt_cache_path() -> Option<PathBuf> {
    // Check SBT_IVY_HOME first (official system property, also works as env var)
    if let Ok(ivy_home) = std::env::var("SBT_IVY_HOME") {
        return Some(PathBuf::from(ivy_home).join("cache"));
    }

    // sbt uses ivy2 for dependency cache
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join(".ivy2").join("cache"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".ivy2").join("cache"))
    }
}

// ============================================================================
// Core functions
// ============================================================================

/// Check if a provider's command is available
pub async fn is_provider_available(provider: ExternalCacheProvider) -> bool {
    process::which(provider.command()).await.is_some()
}

/// Calculate directory size recursively
pub async fn calculate_dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }

    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || calculate_dir_size_sync(&path))
        .await
        .unwrap_or(0)
}

fn calculate_dir_size_sync(path: &Path) -> u64 {
    let mut total_size = 0u64;

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(metadata) = std::fs::metadata(&path) {
                    total_size += metadata.len();
                }
            } else if path.is_dir() {
                total_size += calculate_dir_size_sync(&path);
            }
        }
    }

    total_size
}

/// Direct delete a cache directory (with optional move-to-trash support)
async fn direct_delete_cache(path: &Path, use_trash: bool) -> Result<(), CogniaError> {
    if !path.exists() {
        return Ok(());
    }
    if use_trash {
        fs::remove_dir_with_option(path, true)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))
    } else {
        fs::remove_dir_all(path)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))
    }
}

/// Clean the contents of a cache directory without deleting the directory itself.
/// Used for system caches (e.g. %TEMP%, ~/Library/Caches, ~/.cache) where the
/// parent directory must continue to exist.
/// Silently skips entries that are locked or in-use.
async fn clean_cache_contents(path: &Path, use_trash: bool) -> Result<(), CogniaError> {
    if !path.exists() {
        return Ok(());
    }

    let path = path.to_path_buf();
    let entries: Vec<PathBuf> = tokio::task::spawn_blocking(move || {
        let mut items = Vec::new();
        if let Ok(read_dir) = std::fs::read_dir(&path) {
            for entry in read_dir.flatten() {
                items.push(entry.path());
            }
        }
        items
    })
    .await
    .unwrap_or_default();

    for entry_path in entries {
        let is_dir = entry_path.is_dir();
        let result = if is_dir {
            if use_trash {
                fs::remove_dir_with_option(&entry_path, true).await
            } else {
                fs::remove_dir_all(&entry_path).await
            }
        } else if use_trash {
            fs::remove_file_with_option(&entry_path, true).await
        } else {
            fs::remove_file(&entry_path).await
        };
        // Silently skip entries that fail (e.g. locked files)
        if let Err(_e) = result {
            // In-use or permission error - skip
        }
    }

    Ok(())
}

/// Public wrapper for clean_cache_contents, used by force-clean commands
pub async fn clean_cache_contents_public(path: &Path, use_trash: bool) -> CogniaResult<()> {
    clean_cache_contents(path, use_trash).await
}

/// Discover all external caches on the system
pub async fn discover_all_caches() -> CogniaResult<Vec<ExternalCacheInfo>> {
    let mut caches = Vec::new();

    for provider in ExternalCacheProvider::all() {
        let is_available = is_provider_available(provider).await;
        let cache_path = provider.cache_path();

        let (path_str, size) = if let Some(ref path) = cache_path {
            let size = if path.exists() {
                calculate_dir_size(path).await
            } else {
                0
            };
            (path.display().to_string(), size)
        } else {
            (String::new(), 0)
        };

        // Include if the tool is available or the cache directory exists on disk
        let has_cache_dir = cache_path.as_ref().map(|p| p.exists()).unwrap_or(false);
        if is_available || has_cache_dir {
            // Can clean if there's data to delete OR if the tool has a clean command
            // (e.g. Docker where we can't measure size but can still clean)
            let has_clean_command = is_available && provider.clean_command().is_some();
            caches.push(ExternalCacheInfo {
                provider: provider.id().to_string(),
                display_name: provider.display_name().to_string(),
                cache_path: path_str,
                size,
                size_human: format_size(size),
                is_available,
                can_clean: size > 0 || has_clean_command,
                category: provider.category().to_string(),
            });
        }
    }

    // Sort by size descending
    caches.sort_by(|a, b| b.size.cmp(&a.size));

    Ok(caches)
}

/// Clean cache for a specific provider
pub async fn clean_cache(
    provider_id: &str,
    use_trash: bool,
) -> CogniaResult<ExternalCacheCleanResult> {
    let provider = ExternalCacheProvider::parse_str(provider_id)
        .ok_or_else(|| CogniaError::Provider(format!("Unknown cache provider: {}", provider_id)))?;

    let cache_path = provider.cache_path();
    let preserve_dir = provider.should_preserve_dir();
    let size_before = if let Some(ref path) = cache_path {
        calculate_dir_size(path).await
    } else {
        0
    };

    // Try to clean using the provider's command first, fall back to direct delete
    let result: Result<(), CogniaError> = if let Some((cmd, args)) = provider.clean_command() {
        match process::execute(cmd, args, None).await {
            Ok(output) if output.success => Ok(()),
            // Command failed or not found → fall back to directory clean
            _ => {
                if let Some(ref path) = cache_path {
                    if preserve_dir {
                        clean_cache_contents(path, use_trash).await
                    } else {
                        direct_delete_cache(path, use_trash).await
                    }
                } else {
                    Ok(())
                }
            }
        }
    } else {
        // No clean command available - use direct delete or content cleaning
        if let Some(ref path) = cache_path {
            if preserve_dir {
                clean_cache_contents(path, use_trash).await
            } else {
                direct_delete_cache(path, use_trash).await
            }
        } else {
            Ok(())
        }
    };

    let size_after = if let Some(ref path) = cache_path {
        calculate_dir_size(path).await
    } else {
        0
    };

    let freed = size_before.saturating_sub(size_after);

    match result {
        Ok(()) => Ok(ExternalCacheCleanResult {
            provider: provider.id().to_string(),
            display_name: provider.display_name().to_string(),
            freed_bytes: freed,
            freed_human: format_size(freed),
            success: true,
            error: None,
        }),
        Err(e) => Ok(ExternalCacheCleanResult {
            provider: provider.id().to_string(),
            display_name: provider.display_name().to_string(),
            freed_bytes: freed,
            freed_human: format_size(freed),
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

/// Clean all external caches
pub async fn clean_all_caches(use_trash: bool) -> CogniaResult<Vec<ExternalCacheCleanResult>> {
    let caches = discover_all_caches().await?;
    let mut results = Vec::new();

    for cache in caches {
        if cache.can_clean {
            let result = clean_cache(&cache.provider, use_trash).await?;
            results.push(result);
        }
    }

    Ok(results)
}

/// Get combined cache statistics (internal + external)
pub async fn get_combined_stats(internal_size: u64) -> CogniaResult<CombinedCacheStats> {
    let external_caches = discover_all_caches().await?;
    let external_size: u64 = external_caches.iter().map(|c| c.size).sum();
    let total_size = internal_size + external_size;

    Ok(CombinedCacheStats {
        internal_size,
        internal_size_human: format_size(internal_size),
        external_size,
        external_size_human: format_size(external_size),
        total_size,
        total_size_human: format_size(total_size),
        external_caches,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_id() {
        assert_eq!(ExternalCacheProvider::Npm.id(), "npm");
        assert_eq!(ExternalCacheProvider::Pip.id(), "pip");
        assert_eq!(ExternalCacheProvider::Cargo.id(), "cargo");
    }

    #[test]
    fn test_new_provider_ids() {
        assert_eq!(ExternalCacheProvider::Composer.id(), "composer");
        assert_eq!(ExternalCacheProvider::Poetry.id(), "poetry");
        assert_eq!(ExternalCacheProvider::Conda.id(), "conda");
        assert_eq!(ExternalCacheProvider::Deno.id(), "deno");
        assert_eq!(ExternalCacheProvider::Bun.id(), "bun");
        assert_eq!(ExternalCacheProvider::Gradle.id(), "gradle");
        assert_eq!(ExternalCacheProvider::Maven.id(), "maven");
        assert_eq!(ExternalCacheProvider::Gem.id(), "gem");
        assert_eq!(ExternalCacheProvider::Rustup.id(), "rustup");
    }

    #[cfg(windows)]
    #[test]
    fn test_windows_provider_ids() {
        assert_eq!(ExternalCacheProvider::Scoop.id(), "scoop");
        assert_eq!(ExternalCacheProvider::Chocolatey.id(), "chocolatey");
        assert_eq!(ExternalCacheProvider::WindowsTemp.id(), "windows_temp");
        assert_eq!(
            ExternalCacheProvider::WindowsThumbnail.id(),
            "windows_thumbnail"
        );
    }

    #[test]
    fn test_devtools_provider_ids() {
        assert_eq!(ExternalCacheProvider::Docker.id(), "docker");
        assert_eq!(ExternalCacheProvider::Flutter.id(), "flutter");
        assert_eq!(ExternalCacheProvider::Cypress.id(), "cypress");
        assert_eq!(ExternalCacheProvider::Electron.id(), "electron");
        assert_eq!(ExternalCacheProvider::Vcpkg.id(), "vcpkg");
        assert_eq!(ExternalCacheProvider::Sbt.id(), "sbt");
    }

    #[test]
    fn test_devtools_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::parse_str("docker"),
            Some(ExternalCacheProvider::Docker)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("flutter"),
            Some(ExternalCacheProvider::Flutter)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("dart"),
            Some(ExternalCacheProvider::Flutter)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("cypress"),
            Some(ExternalCacheProvider::Cypress)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("electron"),
            Some(ExternalCacheProvider::Electron)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("vcpkg"),
            Some(ExternalCacheProvider::Vcpkg)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("sbt"),
            Some(ExternalCacheProvider::Sbt)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("ivy"),
            Some(ExternalCacheProvider::Sbt)
        );
    }

    #[test]
    fn test_provider_categories() {
        assert_eq!(ExternalCacheProvider::Npm.category(), "package_manager");
        assert_eq!(ExternalCacheProvider::Docker.category(), "devtools");
        assert_eq!(ExternalCacheProvider::Flutter.category(), "devtools");
        assert_eq!(ExternalCacheProvider::Cypress.category(), "devtools");
    }

    #[cfg(windows)]
    #[test]
    fn test_system_cache_categories() {
        assert_eq!(ExternalCacheProvider::WindowsTemp.category(), "system");
        assert_eq!(ExternalCacheProvider::WindowsThumbnail.category(), "system");
    }

    #[test]
    fn test_should_preserve_dir() {
        // Package managers and devtools should NOT preserve dir
        assert!(!ExternalCacheProvider::Npm.should_preserve_dir());
        assert!(!ExternalCacheProvider::Docker.should_preserve_dir());
    }

    #[cfg(windows)]
    #[test]
    fn test_system_cache_preserve_dir() {
        assert!(ExternalCacheProvider::WindowsTemp.should_preserve_dir());
        assert!(ExternalCacheProvider::WindowsThumbnail.should_preserve_dir());
    }

    #[test]
    fn test_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::parse_str("npm"),
            Some(ExternalCacheProvider::Npm)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("NPM"),
            Some(ExternalCacheProvider::Npm)
        );
        assert_eq!(ExternalCacheProvider::parse_str("unknown"), None);
    }

    #[test]
    fn test_extended_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::parse_str("maven"),
            Some(ExternalCacheProvider::Maven)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("mvn"),
            Some(ExternalCacheProvider::Maven)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("gem"),
            Some(ExternalCacheProvider::Gem)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("rubygems"),
            Some(ExternalCacheProvider::Gem)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("rustup"),
            Some(ExternalCacheProvider::Rustup)
        );
    }

    #[test]
    fn test_new_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::parse_str("composer"),
            Some(ExternalCacheProvider::Composer)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("poetry"),
            Some(ExternalCacheProvider::Poetry)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("conda"),
            Some(ExternalCacheProvider::Conda)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("miniconda"),
            Some(ExternalCacheProvider::Conda)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("anaconda"),
            Some(ExternalCacheProvider::Conda)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("deno"),
            Some(ExternalCacheProvider::Deno)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("bun"),
            Some(ExternalCacheProvider::Bun)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("gradle"),
            Some(ExternalCacheProvider::Gradle)
        );
    }

    #[cfg(windows)]
    #[test]
    fn test_windows_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::parse_str("scoop"),
            Some(ExternalCacheProvider::Scoop)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("chocolatey"),
            Some(ExternalCacheProvider::Chocolatey)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("choco"),
            Some(ExternalCacheProvider::Chocolatey)
        );
    }

    #[test]
    fn test_cache_path_not_none() {
        // At least npm should have a cache path on all platforms
        assert!(ExternalCacheProvider::Npm.cache_path().is_some());
        assert!(ExternalCacheProvider::Pip.cache_path().is_some());
        assert!(ExternalCacheProvider::Cargo.cache_path().is_some());
    }

    #[test]
    fn test_new_cache_paths_not_panic() {
        // These should not panic, even if they return None
        let _ = get_composer_cache_path();
        let _ = get_poetry_cache_path();
        let _ = get_conda_cache_path();
        let _ = get_deno_cache_path();
        let _ = get_bun_cache_path();
        let _ = get_gradle_cache_path();
        let _ = get_maven_cache_path();
        let _ = get_gem_cache_path();
        let _ = get_rustup_cache_path();
    }

    #[cfg(windows)]
    #[test]
    fn test_windows_cache_paths_not_panic() {
        let _ = get_scoop_cache_path();
        let _ = get_chocolatey_cache_path();
        let _ = get_windows_temp_path();
        let _ = get_windows_thumbnail_path();
    }

    #[test]
    fn test_devtools_cache_paths_not_panic() {
        let _ = get_docker_cache_path();
        let _ = get_flutter_cache_path();
        let _ = get_cypress_cache_path();
        let _ = get_electron_cache_path();
        let _ = get_vcpkg_cache_path();
        let _ = get_sbt_cache_path();
    }

    #[test]
    fn test_docker_cache_path_is_none() {
        // Docker manages its own storage, no filesystem path
        assert!(get_docker_cache_path().is_none());
    }

    #[tokio::test]
    async fn test_discover_caches() {
        let caches = discover_all_caches().await;
        assert!(caches.is_ok());
        // Should return an empty or non-empty list without error
    }
}
