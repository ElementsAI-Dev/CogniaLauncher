//! External package manager cache management
//!
//! This module provides cross-platform discovery and cleanup of external
//! package manager caches (npm, pip, pnpm, yarn, cargo, uv, etc.)

use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::ProcessOptions;
use crate::platform::{disk::format_size, fs, process};
use futures::future::{BoxFuture, FutureExt, Shared};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};

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
    // Terminal framework caches
    OhMyPosh,
    Starship,
    OhMyZsh,
    Zinit,
    Powerlevel10k,
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
            // Terminal framework caches
            Self::OhMyPosh,
            Self::Starship,
            Self::OhMyZsh,
            Self::Zinit,
            Self::Powerlevel10k,
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
            // Terminal framework caches
            Self::OhMyPosh => "oh_my_posh",
            Self::Starship => "starship",
            Self::OhMyZsh => "oh_my_zsh",
            Self::Zinit => "zinit",
            Self::Powerlevel10k => "powerlevel10k",
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
            // Terminal framework caches
            Self::OhMyPosh => "Oh My Posh",
            Self::Starship => "Starship",
            Self::OhMyZsh => "Oh My Zsh",
            Self::Zinit => "Zinit",
            Self::Powerlevel10k => "Powerlevel10k",
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
            // Terminal framework caches
            Self::OhMyPosh => "oh-my-posh",
            Self::Starship => "starship",
            Self::OhMyZsh => "zsh",
            Self::Zinit => "zsh",
            Self::Powerlevel10k => "zsh",
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
            // Terminal framework caches
            Self::OhMyPosh => get_oh_my_posh_ext_cache_path(),
            Self::Starship => get_starship_ext_cache_path(),
            Self::OhMyZsh => get_oh_my_zsh_ext_cache_path(),
            Self::Zinit => get_zinit_ext_cache_path(),
            Self::Powerlevel10k => get_powerlevel10k_ext_cache_path(),
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
            // Terminal framework caches - all direct delete (clean contents)
            Self::OhMyPosh => None,
            Self::Starship => None,
            Self::OhMyZsh => None,
            Self::Zinit => None,
            Self::Powerlevel10k => None,
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
            // Terminal framework caches
            "oh_my_posh" | "oh-my-posh" | "ohmyposh" => Some(Self::OhMyPosh),
            "starship" => Some(Self::Starship),
            "oh_my_zsh" | "oh-my-zsh" | "ohmyzsh" => Some(Self::OhMyZsh),
            "zinit" => Some(Self::Zinit),
            "powerlevel10k" | "p10k" => Some(Self::Powerlevel10k),
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
            // Terminal framework caches
            Self::OhMyPosh | Self::Starship | Self::OhMyZsh | Self::Zinit | Self::Powerlevel10k => {
                "terminal"
            }
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
            // Terminal framework caches - preserve the cache dir
            Self::OhMyPosh | Self::Starship | Self::OhMyZsh | Self::Zinit | Self::Powerlevel10k => {
                true
            }
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
    /// When true, the size field is 0 and a separate size calculation is pending.
    #[serde(default)]
    pub size_pending: bool,
    /// When true, provider path probing is still in progress for this row.
    #[serde(default)]
    pub probe_pending: bool,
    pub detection_state: ExternalCacheDetectionState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detection_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detection_error: Option<String>,
}

/// Normalized external cache detection state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExternalCacheDetectionState {
    Found,
    Unavailable,
    Skipped,
    Error,
}

#[derive(Debug, Clone)]
struct DiscoveryCacheEntry {
    timestamp: Instant,
    caches: Vec<ExternalCacheInfo>,
}

/// In-memory cache for fast discovery results with TTL.
static DISCOVERY_CACHE: Lazy<RwLock<HashMap<String, DiscoveryCacheEntry>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

const DISCOVERY_CACHE_TTL_SECS: u64 = 60;
const FAST_DISCOVERY_PROBE_TIMEOUT_MS: u64 = 450;
const FAST_DISCOVERY_PROBE_CONCURRENCY: usize = 6;

/// A shared in-flight future for provider size calculations.
type SharedSizeFuture = Shared<BoxFuture<'static, u64>>;

#[derive(Debug, Clone)]
struct ProviderSizeCacheEntry {
    timestamp: Instant,
    size: u64,
}

/// In-memory cache for provider size results (keyed by provider + resolved path).
static PROVIDER_SIZE_CACHE: Lazy<RwLock<HashMap<String, ProviderSizeCacheEntry>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// In-flight provider size calculations used to deduplicate concurrent scans.
static PROVIDER_SIZE_INFLIGHT: Lazy<Mutex<HashMap<String, SharedSizeFuture>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Epoch token to prevent stale in-flight results from being written after invalidation.
static PROVIDER_SIZE_CACHE_EPOCH: Lazy<AtomicU64> = Lazy::new(|| AtomicU64::new(0));

const PROVIDER_SIZE_CACHE_TTL_SECS: u64 = 45;

#[cfg(test)]
static PROVIDER_SIZE_SCAN_COUNT_BY_KEY: Lazy<Mutex<HashMap<String, u64>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[cfg(test)]
static PROVIDER_SIZE_TEST_MUTEX: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

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
// Terminal framework cache path functions
// ============================================================================

fn get_oh_my_posh_ext_cache_path() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("oh-my-posh"))
    }
    #[cfg(not(windows))]
    {
        std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|h| h.join(".cache")))
            .map(|p| p.join("oh-my-posh"))
    }
}

fn get_starship_ext_cache_path() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("starship"))
    }
    #[cfg(not(windows))]
    {
        std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|h| h.join(".cache")))
            .map(|p| p.join("starship"))
    }
}

fn get_oh_my_zsh_ext_cache_path() -> Option<PathBuf> {
    if let Ok(cache_dir) = std::env::var("ZSH_CACHE_DIR") {
        return Some(PathBuf::from(cache_dir));
    }
    dirs::home_dir().map(|h| h.join(".oh-my-zsh").join("cache"))
}

fn get_zinit_ext_cache_path() -> Option<PathBuf> {
    if let Ok(zinit_home) = std::env::var("ZINIT_HOME") {
        return Some(PathBuf::from(zinit_home));
    }
    std::env::var("XDG_DATA_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
        .map(|p| p.join("zinit"))
}

fn get_powerlevel10k_ext_cache_path() -> Option<PathBuf> {
    // Powerlevel10k stores cache in XDG_CACHE_HOME as p10k-* files
    // We return the p10k subdirectory if it exists, or the parent cache dir
    let xdg_cache = std::env::var("XDG_CACHE_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|h| h.join(".cache")));

    if let Some(ref base) = xdg_cache {
        let p10k_dir = base.join("p10k");
        if p10k_dir.exists() {
            return Some(p10k_dir);
        }
    }

    // Fall back to gitstatus cache dir (used by p10k)
    xdg_cache.map(|p| p.join("gitstatus"))
}

// ============================================================================
// Core functions
// ============================================================================

/// Check if a provider's command is available.
/// Uses pure-Rust PATH lookup via the `which` crate (~1ms) instead of spawning
/// a subprocess (`where.exe`/`which`) per provider (~200ms each).
/// System cache providers (WindowsTemp, LinuxCache, etc.) always return true
/// because they don't depend on any external tool.
pub fn is_provider_available_sync(provider: ExternalCacheProvider) -> bool {
    match provider {
        #[cfg(windows)]
        ExternalCacheProvider::WindowsTemp | ExternalCacheProvider::WindowsThumbnail => true,
        #[cfg(target_os = "macos")]
        ExternalCacheProvider::MacOsCache | ExternalCacheProvider::MacOsLogs => true,
        #[cfg(target_os = "linux")]
        ExternalCacheProvider::LinuxCache => true,
        _ => which::which(provider.command()).is_ok(),
    }
}

/// Async wrapper for backward compatibility.
pub async fn is_provider_available(provider: ExternalCacheProvider) -> bool {
    is_provider_available_sync(provider)
}

/// Calculate directory size recursively (with timeout).
/// Returns best-effort partial size on timeout instead of 0.
pub async fn calculate_dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }

    let path = path.to_path_buf();
    let partial = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let partial_clone = partial.clone();
    let handle = tokio::task::spawn_blocking(move || {
        calculate_dir_size_sync(&path, &partial_clone, 0, 15, 500_000)
    });
    match tokio::time::timeout(Duration::from_secs(10), handle).await {
        Ok(Ok(size)) => size,
        // On timeout or panic, return whatever partial size was accumulated
        _ => partial.load(std::sync::atomic::Ordering::Relaxed),
    }
}

/// Optimized recursive size calculation.
/// - Uses `entry.metadata()` from `DirEntry` (avoids extra syscall vs `std::fs::metadata`)
/// - Tracks partial size via `AtomicU64` so timeouts return best-effort data
/// - `max_depth` prevents pathological recursion (default 15)
/// - `max_files` is a safety cap (default 500K)
fn calculate_dir_size_sync(
    path: &Path,
    partial: &std::sync::atomic::AtomicU64,
    depth: u16,
    max_depth: u16,
    max_files: u64,
) -> u64 {
    if depth >= max_depth {
        return 0;
    }

    let mut total_size = 0u64;
    let mut file_count = 0u64;

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if file_count >= max_files {
                break;
            }
            // Use entry.metadata() which reuses cached data from read_dir on most platforms
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.is_file() {
                let len = meta.len();
                total_size += len;
                partial.fetch_add(len, std::sync::atomic::Ordering::Relaxed);
                file_count += 1;
            } else if meta.is_dir() {
                let sub = calculate_dir_size_sync(
                    &entry.path(),
                    partial,
                    depth + 1,
                    max_depth,
                    max_files.saturating_sub(file_count),
                );
                total_size += sub;
                file_count += 1;
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

#[derive(Debug, Clone)]
struct ExternalDiscoveryCandidate {
    provider: String,
    display_name: String,
    category: String,
    cache_path: Option<PathBuf>,
    is_available: bool,
    has_clean_command: bool,
    is_custom: bool,
}

fn should_exclude_provider(provider_id: &str, excluded: &[String]) -> bool {
    excluded
        .iter()
        .any(|item| item.eq_ignore_ascii_case(provider_id))
}

fn collect_discovery_candidates(
    excluded: &[String],
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> Vec<ExternalDiscoveryCandidate> {
    let mut candidates = Vec::new();

    for provider in ExternalCacheProvider::all() {
        if should_exclude_provider(provider.id(), excluded) {
            continue;
        }

        let is_available = is_provider_available_sync(provider);
        let has_clean_command = is_available && provider.clean_command().is_some();
        candidates.push(ExternalDiscoveryCandidate {
            provider: provider.id().to_string(),
            display_name: provider.display_name().to_string(),
            category: provider.category().to_string(),
            cache_path: provider.cache_path(),
            is_available,
            has_clean_command,
            is_custom: false,
        });
    }

    for entry in custom_entries {
        if should_exclude_provider(&entry.id, excluded) {
            continue;
        }

        let cache_path = if entry.path.trim().is_empty() {
            None
        } else {
            Some(PathBuf::from(&entry.path))
        };

        candidates.push(ExternalDiscoveryCandidate {
            provider: entry.id.clone(),
            display_name: entry.display_name.clone(),
            category: entry.category.clone(),
            cache_path,
            is_available: true,
            has_clean_command: false,
            is_custom: true,
        });
    }

    candidates
}

fn normalize_discovery_state_without_path(
    candidate: &ExternalDiscoveryCandidate,
) -> Option<(
    bool,
    ExternalCacheDetectionState,
    Option<String>,
    Option<String>,
)> {
    let Some(_) = candidate.cache_path.as_ref() else {
        if candidate.is_custom {
            return Some((
                true,
                ExternalCacheDetectionState::Error,
                Some("invalid_path".to_string()),
                Some("Custom cache path is empty".to_string()),
            ));
        }

        if candidate.is_available {
            return Some((
                true,
                ExternalCacheDetectionState::Skipped,
                Some("path_unresolved".to_string()),
                None,
            ));
        }

        return Some((
            false,
            ExternalCacheDetectionState::Unavailable,
            Some("provider_unavailable".to_string()),
            None,
        ));
    };

    None
}

async fn probe_discovery_state_with_timeout(
    candidate: &ExternalDiscoveryCandidate,
    timeout: Duration,
) -> (
    bool,
    ExternalCacheDetectionState,
    Option<String>,
    Option<String>,
) {
    if let Some(result) = normalize_discovery_state_without_path(candidate) {
        return result;
    }

    let path = match candidate.cache_path.as_ref() {
        Some(p) => p.clone(),
        None => {
            return (
                true,
                ExternalCacheDetectionState::Error,
                Some("probe_failed".to_string()),
                Some("Cache path missing during probe".to_string()),
            );
        }
    };
    let is_available = candidate.is_available;
    let is_custom = candidate.is_custom;
    #[cfg(test)]
    let provider_id = candidate.provider.clone();

    let task = tokio::task::spawn_blocking(move || {
        #[cfg(test)]
        if provider_id.contains("__force_timeout__") {
            std::thread::sleep(Duration::from_millis(30));
        }

        if !path.exists() {
            if is_available || is_custom {
                return (
                    true,
                    ExternalCacheDetectionState::Skipped,
                    Some("path_not_found".to_string()),
                    None,
                );
            }

            return (
                false,
                ExternalCacheDetectionState::Unavailable,
                Some("provider_unavailable".to_string()),
                None,
            );
        }

        if !path.is_dir() {
            return (
                true,
                ExternalCacheDetectionState::Error,
                Some("path_not_directory".to_string()),
                Some("Resolved cache path is not a directory".to_string()),
            );
        }

        if let Err(err) = std::fs::read_dir(&path) {
            return (
                true,
                ExternalCacheDetectionState::Error,
                Some("path_unreadable".to_string()),
                Some(err.to_string()),
            );
        }

        if is_available {
            (true, ExternalCacheDetectionState::Found, None, None)
        } else {
            (
                true,
                ExternalCacheDetectionState::Unavailable,
                Some("provider_unavailable".to_string()),
                None,
            )
        }
    });

    match tokio::time::timeout(timeout, task).await {
        Ok(Ok(result)) => result,
        Ok(Err(join_err)) => (
            true,
            ExternalCacheDetectionState::Error,
            Some("probe_failed".to_string()),
            Some(join_err.to_string()),
        ),
        Err(_) => (
            true,
            ExternalCacheDetectionState::Error,
            Some("probe_timeout".to_string()),
            Some(format!("Probe timed out after {}ms", timeout.as_millis())),
        ),
    }
}

fn build_external_cache_info(
    candidate: &ExternalDiscoveryCandidate,
    size: u64,
    size_pending: bool,
    probe_pending: bool,
    detection_state: ExternalCacheDetectionState,
    detection_reason: Option<String>,
    detection_error: Option<String>,
) -> ExternalCacheInfo {
    let can_clean = match detection_state {
        ExternalCacheDetectionState::Found | ExternalCacheDetectionState::Unavailable => {
            size > 0 || candidate.has_clean_command
        }
        ExternalCacheDetectionState::Skipped | ExternalCacheDetectionState::Error => {
            candidate.has_clean_command
        }
    };

    ExternalCacheInfo {
        provider: candidate.provider.clone(),
        display_name: candidate.display_name.clone(),
        cache_path: candidate
            .cache_path
            .as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
        size,
        size_human: format_size(size),
        is_available: candidate.is_available,
        can_clean,
        category: candidate.category.clone(),
        size_pending,
        probe_pending,
        detection_state,
        detection_reason,
        detection_error,
    }
}

fn build_probe_pending_cache_info(candidate: &ExternalDiscoveryCandidate) -> ExternalCacheInfo {
    let placeholder_state = if candidate.is_available {
        ExternalCacheDetectionState::Skipped
    } else {
        ExternalCacheDetectionState::Unavailable
    };

    build_external_cache_info(
        candidate,
        0,
        true,
        true,
        placeholder_state,
        Some("probe_pending".to_string()),
        None,
    )
}

fn sort_external_caches(caches: &mut [ExternalCacheInfo]) {
    caches.sort_by(|a, b| {
        b.size
            .cmp(&a.size)
            .then_with(|| a.provider.cmp(&b.provider))
            .then_with(|| a.cache_path.cmp(&b.cache_path))
    });
}

fn normalize_discovery_custom_path(path: &str) -> String {
    #[cfg(windows)]
    {
        path.to_ascii_lowercase()
    }
    #[cfg(not(windows))]
    {
        path.to_string()
    }
}

fn discovery_cache_key(
    excluded: &[String],
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> String {
    let mut excluded_ids: Vec<String> = excluded
        .iter()
        .map(|id| id.trim().to_ascii_lowercase())
        .collect();
    excluded_ids.sort();
    excluded_ids.dedup();

    let mut custom_keys: Vec<String> = custom_entries
        .iter()
        .map(|entry| {
            format!(
                "{}={}",
                entry.id.trim().to_ascii_lowercase(),
                normalize_discovery_custom_path(entry.path.trim())
            )
        })
        .collect();
    custom_keys.sort();
    custom_keys.dedup();

    format!(
        "excluded:{}|custom:{}",
        excluded_ids.join(","),
        custom_keys.join(",")
    )
}

/// Discover all external caches on the system (parallelized with timeouts).
/// This is the full discovery that includes size calculation — use
/// `discover_all_caches_fast` for the quick first-pass.
pub async fn discover_all_caches() -> CogniaResult<Vec<ExternalCacheInfo>> {
    discover_all_caches_full_with_custom(&[], &[]).await
}

/// Full discovery with optional exclusion list.
pub async fn discover_all_caches_full(excluded: &[String]) -> CogniaResult<Vec<ExternalCacheInfo>> {
    discover_all_caches_full_with_custom(excluded, &[]).await
}

/// Full discovery with optional exclusion list and custom entries.
pub async fn discover_all_caches_full_with_custom(
    excluded: &[String],
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> CogniaResult<Vec<ExternalCacheInfo>> {
    let candidates = collect_discovery_candidates(excluded, custom_entries);

    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(
        FAST_DISCOVERY_PROBE_CONCURRENCY,
    ));
    let probe_timeout = Duration::from_millis(FAST_DISCOVERY_PROBE_TIMEOUT_MS);

    let futures: Vec<_> = candidates
        .into_iter()
        .map(|candidate| {
            let sem = sem.clone();
            let probe_timeout = probe_timeout;
            async move {
                let _permit = sem.acquire().await.ok();
                let (include, state, reason, error) =
                    probe_discovery_state_with_timeout(&candidate, probe_timeout).await;
                if !include {
                    None
                } else {
                    let size = if matches!(
                        state,
                        ExternalCacheDetectionState::Found
                            | ExternalCacheDetectionState::Unavailable
                    ) {
                        if let Some(path) = candidate.cache_path.as_ref() {
                            calculate_dir_size(path).await
                        } else {
                            0
                        }
                    } else {
                        0
                    };

                    Some(build_external_cache_info(
                        &candidate, size, false, false, state, reason, error,
                    ))
                }
            }
        })
        .collect();

    let results = futures::future::join_all(futures).await;
    let mut caches: Vec<ExternalCacheInfo> = results.into_iter().flatten().collect();
    sort_external_caches(&mut caches);

    Ok(caches)
}

/// Fast discovery: checks availability + path existence only, no size calculation.
/// Returns instantly (~10ms) with `size_pending: true` for each provider.
/// Use `calculate_provider_cache_size()` afterward to fill in sizes on demand.
pub async fn discover_all_caches_fast(excluded: &[String]) -> Vec<ExternalCacheInfo> {
    discover_all_caches_fast_with_custom(excluded, &[]).await
}

/// Fast discovery with custom cache entries included.
pub async fn discover_all_caches_fast_with_custom(
    excluded: &[String],
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> Vec<ExternalCacheInfo> {
    let candidates = collect_discovery_candidates(excluded, custom_entries);
    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(
        FAST_DISCOVERY_PROBE_CONCURRENCY,
    ));
    let probe_timeout = Duration::from_millis(FAST_DISCOVERY_PROBE_TIMEOUT_MS);

    let futures: Vec<_> = candidates
        .into_iter()
        .map(|candidate| {
            let sem = sem.clone();
            let probe_timeout = probe_timeout;
            async move {
                let _permit = sem.acquire().await.ok();
                let (include, state, reason, error) =
                    probe_discovery_state_with_timeout(&candidate, probe_timeout).await;
                if !include {
                    None
                } else {
                    Some(build_external_cache_info(
                        &candidate, 0, true, false, state, reason, error,
                    ))
                }
            }
        })
        .collect();

    let results = futures::future::join_all(futures).await;
    let mut caches: Vec<ExternalCacheInfo> = results.into_iter().flatten().collect();

    sort_external_caches(&mut caches);
    caches
}

/// Return lightweight candidate rows immediately for progressive probing.
pub fn discover_cache_candidates_with_custom(
    excluded: &[String],
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> Vec<ExternalCacheInfo> {
    let mut candidates = collect_discovery_candidates(excluded, custom_entries)
        .into_iter()
        .map(|candidate| build_probe_pending_cache_info(&candidate))
        .collect::<Vec<_>>();
    sort_external_caches(&mut candidates);
    candidates
}

/// Probe a single provider candidate with bounded timeout.
pub async fn probe_cache_provider_with_custom(
    provider_id: &str,
    excluded: &[String],
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> CogniaResult<ExternalCacheInfo> {
    let candidates = collect_discovery_candidates(excluded, custom_entries);
    let Some(candidate) = candidates
        .into_iter()
        .find(|candidate| candidate.provider.eq_ignore_ascii_case(provider_id))
    else {
        return Err(CogniaError::Provider(format!(
            "Unknown or excluded provider: {}",
            provider_id
        )));
    };

    let (include, state, reason, error) = probe_discovery_state_with_timeout(
        &candidate,
        Duration::from_millis(FAST_DISCOVERY_PROBE_TIMEOUT_MS),
    )
    .await;

    let mut info = build_external_cache_info(&candidate, 0, include, false, state, reason, error);
    if !include {
        info.size_pending = false;
    }

    Ok(info)
}

fn provider_size_cache_key(provider_id: &str, cache_path: &Path) -> String {
    #[cfg(windows)]
    let normalized_path = cache_path.to_string_lossy().to_ascii_lowercase();
    #[cfg(not(windows))]
    let normalized_path = cache_path.to_string_lossy().to_string();

    format!("{}::{}", provider_id.to_ascii_lowercase(), normalized_path)
}

fn resolve_provider_cache_path(
    provider_id: &str,
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> CogniaResult<Option<PathBuf>> {
    if let Some(provider) = ExternalCacheProvider::parse_str(provider_id) {
        return Ok(provider.cache_path());
    }

    if let Some(entry) = custom_entries
        .iter()
        .find(|entry| entry.id.eq_ignore_ascii_case(provider_id))
    {
        return Ok(Some(PathBuf::from(&entry.path)));
    }

    Err(CogniaError::Provider(format!(
        "Unknown provider: {}",
        provider_id
    )))
}

async fn try_get_cached_provider_size(key: &str) -> Option<u64> {
    {
        let guard = PROVIDER_SIZE_CACHE.read().await;
        if let Some(entry) = guard.get(key) {
            if entry.timestamp.elapsed().as_secs() < PROVIDER_SIZE_CACHE_TTL_SECS {
                log::debug!("external_cache_size cache hit key={}", key);
                return Some(entry.size);
            }
        }
    }

    let mut guard = PROVIDER_SIZE_CACHE.write().await;
    if let Some(entry) = guard.get(key) {
        if entry.timestamp.elapsed().as_secs() >= PROVIDER_SIZE_CACHE_TTL_SECS {
            guard.remove(key);
            log::debug!("external_cache_size cache stale key={}", key);
        }
    }

    None
}

async fn store_provider_size_if_fresh_epoch(key: String, size: u64, epoch: u64) {
    let current_epoch = PROVIDER_SIZE_CACHE_EPOCH.load(Ordering::Relaxed);
    if current_epoch != epoch {
        log::debug!(
            "external_cache_size skip store due to epoch mismatch key={} started_epoch={} current_epoch={}",
            key,
            epoch,
            current_epoch
        );
        return;
    }

    let mut guard = PROVIDER_SIZE_CACHE.write().await;
    guard.insert(
        key,
        ProviderSizeCacheEntry {
            timestamp: Instant::now(),
            size,
        },
    );
}

pub async fn invalidate_provider_size_cache(provider_id: &str) {
    let provider_prefix = format!("{}::", provider_id.to_ascii_lowercase());
    let mut result_guard = PROVIDER_SIZE_CACHE.write().await;
    result_guard.retain(|key, _| !key.starts_with(&provider_prefix));
    drop(result_guard);

    let mut inflight_guard = PROVIDER_SIZE_INFLIGHT.lock().await;
    inflight_guard.retain(|key, _| !key.starts_with(&provider_prefix));

    PROVIDER_SIZE_CACHE_EPOCH.fetch_add(1, Ordering::Relaxed);
    log::debug!(
        "external_cache_size invalidated provider prefix={} epoch={}",
        provider_prefix,
        PROVIDER_SIZE_CACHE_EPOCH.load(Ordering::Relaxed)
    );
}

pub async fn invalidate_all_provider_size_cache() {
    let mut result_guard = PROVIDER_SIZE_CACHE.write().await;
    result_guard.clear();
    drop(result_guard);

    let mut inflight_guard = PROVIDER_SIZE_INFLIGHT.lock().await;
    inflight_guard.clear();

    PROVIDER_SIZE_CACHE_EPOCH.fetch_add(1, Ordering::Relaxed);
    log::debug!(
        "external_cache_size invalidated all epoch={}",
        PROVIDER_SIZE_CACHE_EPOCH.load(Ordering::Relaxed)
    );
}

/// Calculate size for a single provider by id (also handles custom paths).
pub async fn calculate_provider_cache_size(
    provider_id: &str,
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> CogniaResult<u64> {
    let Some(path) = resolve_provider_cache_path(provider_id, custom_entries)? else {
        return Ok(0);
    };

    let key = provider_size_cache_key(provider_id, &path);
    if let Some(size) = try_get_cached_provider_size(&key).await {
        return Ok(size);
    }

    let request_started = Instant::now();
    let epoch = PROVIDER_SIZE_CACHE_EPOCH.load(Ordering::Relaxed);
    let future = {
        let mut guard = PROVIDER_SIZE_INFLIGHT.lock().await;
        if let Some(existing) = guard.get(&key) {
            log::debug!(
                "external_cache_size in-flight join provider={} key={}",
                provider_id,
                key
            );
            existing.clone()
        } else {
            log::debug!(
                "external_cache_size cache miss provider={} key={}",
                provider_id,
                key
            );
            let path_for_scan = path.clone();
            let provider_for_log = provider_id.to_string();
            let key_for_log = key.clone();

            let shared = async move {
                #[cfg(test)]
                {
                    let mut guard = PROVIDER_SIZE_SCAN_COUNT_BY_KEY.lock().await;
                    *guard.entry(key_for_log.clone()).or_insert(0) += 1;
                }

                let started = Instant::now();
                let size = calculate_dir_size(&path_for_scan).await;
                log::debug!(
                    "external_cache_size scan finished provider={} key={} elapsed_ms={} size={}",
                    provider_for_log,
                    key_for_log,
                    started.elapsed().as_millis(),
                    size
                );
                size
            }
            .boxed()
            .shared();

            guard.insert(key.clone(), shared.clone());
            shared
        }
    };

    let size = future.await;

    {
        let mut guard = PROVIDER_SIZE_INFLIGHT.lock().await;
        guard.remove(&key);
    }

    store_provider_size_if_fresh_epoch(key.clone(), size, epoch).await;
    log::debug!(
        "external_cache_size resolved provider={} key={} elapsed_ms={} size={}",
        provider_id,
        key,
        request_started.elapsed().as_millis(),
        size
    );

    Ok(size)
}

/// Cached fast discovery: returns cached results if still fresh, otherwise re-discovers.
pub async fn discover_all_caches_cached(excluded: &[String]) -> Vec<ExternalCacheInfo> {
    let cache_key = discovery_cache_key(excluded, &[]);

    // Check if cache is fresh
    {
        let guard = DISCOVERY_CACHE.read().await;
        if let Some(entry) = guard.get(&cache_key) {
            if entry.timestamp.elapsed().as_secs() < DISCOVERY_CACHE_TTL_SECS {
                log::debug!(
                    "external_cache_discovery cache hit excluded={} providers={}",
                    excluded.len(),
                    entry.caches.len()
                );
                return entry.caches.clone();
            }
        }
    }

    // Cache miss or stale — re-discover
    let started = Instant::now();
    let result = discover_all_caches_fast(excluded).await;
    log::debug!(
        "external_cache_discovery cache miss excluded={} providers={} elapsed_ms={}",
        excluded.len(),
        result.len(),
        started.elapsed().as_millis()
    );

    // Store in cache
    {
        let mut guard = DISCOVERY_CACHE.write().await;
        guard.insert(
            cache_key,
            DiscoveryCacheEntry {
                timestamp: Instant::now(),
                caches: result.clone(),
            },
        );
    }

    result
}

/// Invalidate the discovery cache (called after clean operations).
/// Cached fast discovery with custom entries.
pub async fn discover_all_caches_cached_with_custom(
    excluded: &[String],
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> Vec<ExternalCacheInfo> {
    let cache_key = discovery_cache_key(excluded, custom_entries);

    // Check if cache is fresh
    {
        let guard = DISCOVERY_CACHE.read().await;
        if let Some(entry) = guard.get(&cache_key) {
            if entry.timestamp.elapsed().as_secs() < DISCOVERY_CACHE_TTL_SECS {
                log::debug!(
                    "external_cache_discovery_with_custom cache hit excluded={} custom={} providers={}",
                    excluded.len(),
                    custom_entries.len(),
                    entry.caches.len()
                );
                return entry.caches.clone();
            }
        }
    }

    // Cache miss or stale - re-discover with custom entries
    let started = Instant::now();
    let result = discover_all_caches_fast_with_custom(excluded, custom_entries).await;
    log::debug!(
        "external_cache_discovery_with_custom cache miss excluded={} custom={} providers={} elapsed_ms={}",
        excluded.len(),
        custom_entries.len(),
        result.len(),
        started.elapsed().as_millis()
    );

    // Store in cache
    {
        let mut guard = DISCOVERY_CACHE.write().await;
        guard.insert(
            cache_key,
            DiscoveryCacheEntry {
                timestamp: Instant::now(),
                caches: result.clone(),
            },
        );
    }

    result
}

pub async fn invalidate_discovery_cache() {
    let mut guard = DISCOVERY_CACHE.write().await;
    guard.clear();
    log::debug!("external_cache_discovery invalidated");
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
        let opts = Some(ProcessOptions::new().with_timeout(Duration::from_secs(120)));
        match process::execute(cmd, args, opts).await {
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
        Ok(()) => {
            invalidate_discovery_cache().await;
            invalidate_provider_size_cache(provider.id()).await;
            Ok(ExternalCacheCleanResult {
                provider: provider.id().to_string(),
                display_name: provider.display_name().to_string(),
                freed_bytes: freed,
                freed_human: format_size(freed),
                success: true,
                error: None,
            })
        }
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

    invalidate_discovery_cache().await;
    invalidate_all_provider_size_cache().await;

    Ok(results)
}

/// Get combined cache statistics (internal + external)
pub async fn get_combined_stats(internal_size: u64) -> CogniaResult<CombinedCacheStats> {
    get_combined_stats_with_custom(internal_size, &[], &[]).await
}

/// Get combined cache statistics (internal + external) with discovery options.
pub async fn get_combined_stats_with_custom(
    internal_size: u64,
    excluded: &[String],
    custom_entries: &[crate::config::settings::CustomCacheEntry],
) -> CogniaResult<CombinedCacheStats> {
    let external_caches = discover_all_caches_full_with_custom(excluded, custom_entries).await?;
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
    use crate::config::settings::CustomCacheEntry;

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

    #[ignore = "Scans real filesystem; can be slow on systems with large cache dirs"]
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_discover_caches() {
        let result = tokio::time::timeout(Duration::from_secs(60), discover_all_caches()).await;
        assert!(result.is_ok(), "discover_all_caches timed out after 60s");
        assert!(result.unwrap().is_ok());
    }

    #[test]
    fn test_all_providers_count() {
        let all = ExternalCacheProvider::all();
        // Should have a reasonable number of providers
        assert!(all.len() >= 20);
        // Each provider should have a non-empty id and display_name
        for p in &all {
            assert!(!p.id().is_empty());
            assert!(!p.display_name().is_empty());
            assert!(!p.command().is_empty());
            assert!(!p.category().is_empty());
        }
    }

    #[test]
    fn test_provider_display_names() {
        assert_eq!(ExternalCacheProvider::Npm.display_name(), "npm (Node.js)");
        assert_eq!(ExternalCacheProvider::Pip.display_name(), "pip (Python)");
        assert_eq!(ExternalCacheProvider::Cargo.display_name(), "Cargo (Rust)");
        assert_eq!(
            ExternalCacheProvider::Gradle.display_name(),
            "Gradle (Java)"
        );
        assert_eq!(
            ExternalCacheProvider::Docker.display_name(),
            "Docker Build Cache"
        );
    }

    #[test]
    fn test_provider_commands() {
        assert_eq!(ExternalCacheProvider::Npm.command(), "npm");
        assert_eq!(ExternalCacheProvider::Maven.command(), "mvn");
        assert_eq!(ExternalCacheProvider::Bundler.command(), "bundle");
        assert_eq!(ExternalCacheProvider::Docker.command(), "docker");
    }

    #[test]
    fn test_provider_clean_commands() {
        // Providers with clean commands
        let (cmd, args) = ExternalCacheProvider::Npm.clean_command().unwrap();
        assert_eq!(cmd, "npm");
        assert!(args.contains(&"clean"));

        // Providers without clean commands (direct delete)
        assert!(ExternalCacheProvider::Cargo.clean_command().is_none());
        assert!(ExternalCacheProvider::Bun.clean_command().is_none());
        assert!(ExternalCacheProvider::Gradle.clean_command().is_none());
    }

    async fn reset_provider_size_test_state() {
        invalidate_all_provider_size_cache().await;
        let mut guard = PROVIDER_SIZE_SCAN_COUNT_BY_KEY.lock().await;
        guard.clear();
    }

    fn make_custom_cache_entry(id: &str, path: &Path) -> Vec<CustomCacheEntry> {
        vec![CustomCacheEntry {
            id: id.to_string(),
            display_name: format!("{} cache", id),
            path: path.display().to_string(),
            category: "devtools".to_string(),
        }]
    }

    async fn scan_count_for_key(key: &str) -> u64 {
        let guard = PROVIDER_SIZE_SCAN_COUNT_BY_KEY.lock().await;
        guard.get(key).copied().unwrap_or(0)
    }

    #[tokio::test]
    async fn test_provider_size_cache_reuse_for_custom_entry() {
        let _guard = PROVIDER_SIZE_TEST_MUTEX.lock().await;
        reset_provider_size_test_state().await;

        let dir = tempfile::tempdir().unwrap();
        let cache_root = dir.path().join("custom-cache");
        tokio::fs::create_dir_all(&cache_root).await.unwrap();
        tokio::fs::write(cache_root.join("a.bin"), vec![0u8; 128])
            .await
            .unwrap();

        let entries = make_custom_cache_entry("custom_reuse", &cache_root);
        let key = provider_size_cache_key("custom_reuse", &cache_root);

        let size1 = calculate_provider_cache_size("custom_reuse", &entries)
            .await
            .unwrap();
        let ts1 = {
            let guard = PROVIDER_SIZE_CACHE.read().await;
            guard.get(&key).map(|entry| entry.timestamp).unwrap()
        };

        tokio::time::sleep(Duration::from_millis(10)).await;

        let size2 = calculate_provider_cache_size("custom_reuse", &entries)
            .await
            .unwrap();
        let ts2 = {
            let guard = PROVIDER_SIZE_CACHE.read().await;
            guard.get(&key).map(|entry| entry.timestamp).unwrap()
        };

        assert_eq!(size1, 128);
        assert_eq!(size2, 128);
        assert_eq!(ts1, ts2, "Expected second read to reuse cached value");
        assert_eq!(
            scan_count_for_key(&key).await,
            1,
            "Expected exactly one size scan due to cache reuse"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_provider_size_inflight_deduplication() {
        let _guard = PROVIDER_SIZE_TEST_MUTEX.lock().await;
        reset_provider_size_test_state().await;

        let dir = tempfile::tempdir().unwrap();
        let cache_root = dir.path().join("custom-dedupe");
        tokio::fs::create_dir_all(&cache_root).await.unwrap();
        for i in 0..300 {
            tokio::fs::write(cache_root.join(format!("{}.bin", i)), vec![0u8; 1024])
                .await
                .unwrap();
        }

        let entries = make_custom_cache_entry("custom_dedupe", &cache_root);
        let results = futures::future::join_all(
            (0..6).map(|_| calculate_provider_cache_size("custom_dedupe", &entries)),
        )
        .await;

        for result in results {
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), 300 * 1024);
        }
        let key = provider_size_cache_key("custom_dedupe", &cache_root);
        assert_eq!(
            scan_count_for_key(&key).await,
            1,
            "Expected concurrent requests to share one in-flight scan"
        );
    }

    #[tokio::test]
    async fn test_provider_size_cache_invalidation() {
        let _guard = PROVIDER_SIZE_TEST_MUTEX.lock().await;
        reset_provider_size_test_state().await;

        let dir = tempfile::tempdir().unwrap();
        let cache_a = dir.path().join("cache-a");
        let cache_b = dir.path().join("cache-b");
        tokio::fs::create_dir_all(&cache_a).await.unwrap();
        tokio::fs::create_dir_all(&cache_b).await.unwrap();
        tokio::fs::write(cache_a.join("a.bin"), vec![0u8; 64])
            .await
            .unwrap();
        tokio::fs::write(cache_b.join("b.bin"), vec![0u8; 96])
            .await
            .unwrap();

        let entries_a = make_custom_cache_entry("custom_a", &cache_a);
        let entries_b = make_custom_cache_entry("custom_b", &cache_b);
        let key_a = provider_size_cache_key("custom_a", &cache_a);
        let key_b = provider_size_cache_key("custom_b", &cache_b);

        let _ = calculate_provider_cache_size("custom_a", &entries_a)
            .await
            .unwrap();
        let _ = calculate_provider_cache_size("custom_b", &entries_b)
            .await
            .unwrap();
        assert_eq!(scan_count_for_key(&key_a).await, 1);
        assert_eq!(scan_count_for_key(&key_b).await, 1);

        invalidate_provider_size_cache("custom_a").await;
        {
            let guard = PROVIDER_SIZE_CACHE.read().await;
            assert!(!guard.contains_key(&key_a));
            assert!(guard.contains_key(&key_b));
        }

        let _ = calculate_provider_cache_size("custom_a", &entries_a)
            .await
            .unwrap();
        assert_eq!(
            scan_count_for_key(&key_a).await,
            2,
            "Expected recalculation after provider-specific invalidation"
        );

        invalidate_all_provider_size_cache().await;
        {
            let guard = PROVIDER_SIZE_CACHE.read().await;
            assert!(guard.is_empty());
        }
    }

    #[tokio::test]
    async fn test_calculate_dir_size() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("size_calc");
        tokio::fs::create_dir_all(&base).await.unwrap();
        tokio::fs::write(base.join("a.bin"), vec![0u8; 100])
            .await
            .unwrap();
        tokio::fs::write(base.join("b.bin"), vec![0u8; 200])
            .await
            .unwrap();

        let size = calculate_dir_size(&base).await;
        assert_eq!(size, 300);

        // Non-existent path should return 0
        let nonexistent = dir.path().join("does_not_exist");
        let size_none = calculate_dir_size(&nonexistent).await;
        assert_eq!(size_none, 0);
    }

    #[tokio::test]
    async fn test_fast_and_full_discovery_provider_sets_are_consistent() {
        let dir = tempfile::tempdir().unwrap();
        let custom_existing = dir.path().join("custom-existing");
        tokio::fs::create_dir_all(&custom_existing).await.unwrap();
        tokio::fs::write(custom_existing.join("sample.bin"), vec![0u8; 16])
            .await
            .unwrap();

        let custom_entries = vec![
            CustomCacheEntry {
                id: "custom_existing".to_string(),
                display_name: "Custom Existing".to_string(),
                path: custom_existing.display().to_string(),
                category: "devtools".to_string(),
            },
            CustomCacheEntry {
                id: "custom_missing".to_string(),
                display_name: "Custom Missing".to_string(),
                path: dir.path().join("missing-path").display().to_string(),
                category: "devtools".to_string(),
            },
        ];

        let fast = discover_all_caches_fast_with_custom(&[], &custom_entries).await;
        let full = discover_all_caches_full_with_custom(&[], &custom_entries)
            .await
            .unwrap();

        let mut fast_ids: Vec<String> = fast.iter().map(|item| item.provider.clone()).collect();
        let mut full_ids: Vec<String> = full.iter().map(|item| item.provider.clone()).collect();
        fast_ids.sort();
        full_ids.sort();

        assert_eq!(fast_ids, full_ids);
        assert!(fast_ids.contains(&"custom_existing".to_string()));
        assert!(fast_ids.contains(&"custom_missing".to_string()));
    }

    #[tokio::test]
    async fn test_discovery_marks_non_directory_custom_path_as_error_without_blocking_others() {
        let dir = tempfile::tempdir().unwrap();
        let custom_existing = dir.path().join("custom-existing");
        tokio::fs::create_dir_all(&custom_existing).await.unwrap();
        tokio::fs::write(custom_existing.join("sample.bin"), vec![0u8; 16])
            .await
            .unwrap();
        let non_dir_path = dir.path().join("not-a-directory.txt");
        tokio::fs::write(&non_dir_path, b"cache file")
            .await
            .unwrap();

        let custom_entries = vec![
            CustomCacheEntry {
                id: "custom_ok".to_string(),
                display_name: "Custom OK".to_string(),
                path: custom_existing.display().to_string(),
                category: "devtools".to_string(),
            },
            CustomCacheEntry {
                id: "custom_broken".to_string(),
                display_name: "Custom Broken".to_string(),
                path: non_dir_path.display().to_string(),
                category: "devtools".to_string(),
            },
        ];

        let caches = discover_all_caches_fast_with_custom(&[], &custom_entries).await;
        let ok = caches
            .iter()
            .find(|item| item.provider == "custom_ok")
            .unwrap();
        let broken = caches
            .iter()
            .find(|item| item.provider == "custom_broken")
            .unwrap();

        assert_eq!(ok.detection_state, ExternalCacheDetectionState::Found);
        assert_eq!(broken.detection_state, ExternalCacheDetectionState::Error);
        assert_eq!(
            broken.detection_reason.as_deref(),
            Some("path_not_directory")
        );
        assert!(broken.detection_error.is_some());
    }

    #[tokio::test]
    async fn test_probe_timeout_is_isolated_per_provider() {
        let dir = tempfile::tempdir().unwrap();
        let ok_path = dir.path().join("ok");
        tokio::fs::create_dir_all(&ok_path).await.unwrap();
        tokio::fs::write(ok_path.join("sample.bin"), vec![0u8; 8])
            .await
            .unwrap();

        let timeout_candidate = ExternalDiscoveryCandidate {
            provider: "timeout_provider__force_timeout__".to_string(),
            display_name: "Timeout Provider".to_string(),
            category: "devtools".to_string(),
            cache_path: Some(ok_path.clone()),
            is_available: true,
            has_clean_command: false,
            is_custom: true,
        };
        let ok_candidate = ExternalDiscoveryCandidate {
            provider: "ok_provider".to_string(),
            display_name: "OK Provider".to_string(),
            category: "devtools".to_string(),
            cache_path: Some(ok_path),
            is_available: true,
            has_clean_command: false,
            is_custom: true,
        };

        let (timeout_result, ok_result) = tokio::join!(
            probe_discovery_state_with_timeout(&timeout_candidate, Duration::from_millis(1)),
            probe_discovery_state_with_timeout(&ok_candidate, Duration::from_secs(2)),
        );

        assert_eq!(timeout_result.1, ExternalCacheDetectionState::Error);
        assert_eq!(timeout_result.2.as_deref(), Some("probe_timeout"));
        assert_eq!(ok_result.1, ExternalCacheDetectionState::Found);
        assert!(ok_result.2.is_none());
    }

    #[test]
    fn test_podman_cache_path_is_none() {
        assert!(get_podman_cache_path().is_none());
    }

    #[test]
    fn test_parse_str_unknown() {
        assert!(ExternalCacheProvider::parse_str("nonexistent_tool").is_none());
        assert!(ExternalCacheProvider::parse_str("").is_none());
    }

    // ── Terminal framework cache provider tests ──

    #[test]
    fn test_terminal_provider_ids() {
        assert_eq!(ExternalCacheProvider::OhMyPosh.id(), "oh_my_posh");
        assert_eq!(ExternalCacheProvider::Starship.id(), "starship");
        assert_eq!(ExternalCacheProvider::OhMyZsh.id(), "oh_my_zsh");
        assert_eq!(ExternalCacheProvider::Zinit.id(), "zinit");
        assert_eq!(ExternalCacheProvider::Powerlevel10k.id(), "powerlevel10k");
    }

    #[test]
    fn test_terminal_provider_display_names() {
        assert_eq!(ExternalCacheProvider::OhMyPosh.display_name(), "Oh My Posh");
        assert_eq!(ExternalCacheProvider::Starship.display_name(), "Starship");
        assert_eq!(ExternalCacheProvider::OhMyZsh.display_name(), "Oh My Zsh");
        assert_eq!(ExternalCacheProvider::Zinit.display_name(), "Zinit");
        assert_eq!(
            ExternalCacheProvider::Powerlevel10k.display_name(),
            "Powerlevel10k"
        );
    }

    #[test]
    fn test_terminal_provider_commands() {
        assert_eq!(ExternalCacheProvider::OhMyPosh.command(), "oh-my-posh");
        assert_eq!(ExternalCacheProvider::Starship.command(), "starship");
        assert_eq!(ExternalCacheProvider::OhMyZsh.command(), "zsh");
        assert_eq!(ExternalCacheProvider::Zinit.command(), "zsh");
        assert_eq!(ExternalCacheProvider::Powerlevel10k.command(), "zsh");
    }

    #[test]
    fn test_terminal_provider_categories() {
        assert_eq!(ExternalCacheProvider::OhMyPosh.category(), "terminal");
        assert_eq!(ExternalCacheProvider::Starship.category(), "terminal");
        assert_eq!(ExternalCacheProvider::OhMyZsh.category(), "terminal");
        assert_eq!(ExternalCacheProvider::Zinit.category(), "terminal");
        assert_eq!(ExternalCacheProvider::Powerlevel10k.category(), "terminal");
    }

    #[test]
    fn test_terminal_provider_should_preserve_dir() {
        assert!(ExternalCacheProvider::OhMyPosh.should_preserve_dir());
        assert!(ExternalCacheProvider::Starship.should_preserve_dir());
        assert!(ExternalCacheProvider::OhMyZsh.should_preserve_dir());
        assert!(ExternalCacheProvider::Zinit.should_preserve_dir());
        assert!(ExternalCacheProvider::Powerlevel10k.should_preserve_dir());
    }

    #[test]
    fn test_terminal_provider_no_clean_command() {
        assert!(ExternalCacheProvider::OhMyPosh.clean_command().is_none());
        assert!(ExternalCacheProvider::Starship.clean_command().is_none());
        assert!(ExternalCacheProvider::OhMyZsh.clean_command().is_none());
        assert!(ExternalCacheProvider::Zinit.clean_command().is_none());
        assert!(ExternalCacheProvider::Powerlevel10k
            .clean_command()
            .is_none());
    }

    #[test]
    fn test_terminal_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::parse_str("oh_my_posh"),
            Some(ExternalCacheProvider::OhMyPosh)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("oh-my-posh"),
            Some(ExternalCacheProvider::OhMyPosh)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("ohmyposh"),
            Some(ExternalCacheProvider::OhMyPosh)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("starship"),
            Some(ExternalCacheProvider::Starship)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("oh_my_zsh"),
            Some(ExternalCacheProvider::OhMyZsh)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("oh-my-zsh"),
            Some(ExternalCacheProvider::OhMyZsh)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("ohmyzsh"),
            Some(ExternalCacheProvider::OhMyZsh)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("zinit"),
            Some(ExternalCacheProvider::Zinit)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("powerlevel10k"),
            Some(ExternalCacheProvider::Powerlevel10k)
        );
        assert_eq!(
            ExternalCacheProvider::parse_str("p10k"),
            Some(ExternalCacheProvider::Powerlevel10k)
        );
    }

    #[test]
    fn test_terminal_cache_paths_not_panic() {
        let _ = get_oh_my_posh_ext_cache_path();
        let _ = get_starship_ext_cache_path();
        let _ = get_oh_my_zsh_ext_cache_path();
        let _ = get_zinit_ext_cache_path();
        let _ = get_powerlevel10k_ext_cache_path();
    }

    #[test]
    fn test_terminal_providers_in_all() {
        let all = ExternalCacheProvider::all();
        let terminal_providers: Vec<_> =
            all.iter().filter(|p| p.category() == "terminal").collect();
        assert_eq!(
            terminal_providers.len(),
            5,
            "Expected 5 terminal framework providers"
        );
    }
}
