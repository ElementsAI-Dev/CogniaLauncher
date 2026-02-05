//! External package manager cache management
//!
//! This module provides cross-platform discovery and cleanup of external
//! package manager caches (npm, pip, pnpm, yarn, cargo, uv, etc.)

use crate::error::{CogniaError, CogniaResult};
use crate::platform::{disk::format_size, fs, process};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
    #[cfg(windows)]
    Scoop,
    #[cfg(windows)]
    Chocolatey,
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
            #[cfg(windows)]
            Self::Scoop,
            #[cfg(windows)]
            Self::Chocolatey,
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
            #[cfg(windows)]
            Self::Scoop => "scoop",
            #[cfg(windows)]
            Self::Chocolatey => "chocolatey",
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
            #[cfg(windows)]
            Self::Scoop => "Scoop (Windows)",
            #[cfg(windows)]
            Self::Chocolatey => "Chocolatey (Windows)",
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
            #[cfg(windows)]
            Self::Scoop => "scoop",
            #[cfg(windows)]
            Self::Chocolatey => "choco",
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
            #[cfg(windows)]
            Self::Scoop => get_scoop_cache_path(),
            #[cfg(windows)]
            Self::Chocolatey => get_chocolatey_cache_path(),
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
            Self::Poetry => Some(("poetry", &["cache", "clear", "--all", ".", "-n"])),
            Self::Conda => Some(("conda", &["clean", "--all", "-y"])),
            Self::Deno => Some(("deno", &["clean"])),
            Self::Bun => None, // Direct delete
            Self::Gradle => None, // Direct delete (daemon should be stopped first)
            #[cfg(windows)]
            Self::Scoop => Some(("scoop", &["cache", "rm", "*"])),
            #[cfg(windows)]
            Self::Chocolatey => Some(("choco", &["cache", "remove", "-y"])),
        }
    }

    /// Parse provider from string
    pub fn from_str(s: &str) -> Option<Self> {
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
            #[cfg(windows)]
            "scoop" => Some(Self::Scoop),
            #[cfg(windows)]
            "chocolatey" | "choco" => Some(Self::Chocolatey),
            _ => None,
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
    // pnpm store path can be configured, but defaults to:
    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("pnpm").join("store"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".local").join("share").join("pnpm").join("store"))
    }
}

fn get_yarn_cache_path() -> Option<PathBuf> {
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
        dirs::home_dir().map(|h| h.join(".cache").join("pip"))
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
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join(".cargo").join("registry").join("cache"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".cargo").join("registry").join("cache"))
    }
}

fn get_bundler_cache_path() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("cache").join("bundle"))
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
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| PathBuf::from(p).join("go").join("pkg").join("mod").join("cache"))
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
        if let Some(first) = pkgs_dirs.split(':').next() {
            return Some(PathBuf::from(first));
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

    candidates.into_iter().flatten().find(|p| p.exists())
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
    // User-level cache (non-elevated)
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let user_cache = PathBuf::from(&profile).join(".chocolatey").join("http-cache");
        if user_cache.exists() {
            return Some(user_cache);
        }
    }

    // System-level cache (elevated, requires admin)
    let system_cache = PathBuf::from("C:\\ProgramData\\ChocolateyHttpCache");
    if system_cache.exists() {
        return Some(system_cache);
    }

    // Return user cache path even if it doesn't exist yet
    std::env::var("USERPROFILE")
        .ok()
        .map(|p| PathBuf::from(p).join(".chocolatey").join("http-cache"))
}

// ============================================================================
// Core functions
// ============================================================================

/// Check if a provider's command is available
pub async fn is_provider_available(provider: ExternalCacheProvider) -> bool {
    process::which(provider.command()).await.is_some()
}

/// Calculate directory size recursively
pub async fn calculate_dir_size(path: &PathBuf) -> u64 {
    if !path.exists() {
        return 0;
    }

    let path = path.clone();
    tokio::task::spawn_blocking(move || calculate_dir_size_sync(&path))
        .await
        .unwrap_or(0)
}

fn calculate_dir_size_sync(path: &PathBuf) -> u64 {
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

        // Only include if the cache path exists and has content, or if the tool is available
        if is_available || size > 0 {
            caches.push(ExternalCacheInfo {
                provider: provider.id().to_string(),
                display_name: provider.display_name().to_string(),
                cache_path: path_str,
                size,
                size_human: format_size(size),
                is_available,
                can_clean: is_available && size > 0,
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
    let provider = ExternalCacheProvider::from_str(provider_id).ok_or_else(|| {
        CogniaError::Provider(format!("Unknown cache provider: {}", provider_id))
    })?;

    let cache_path = provider.cache_path();
    let size_before = if let Some(ref path) = cache_path {
        calculate_dir_size(path).await
    } else {
        0
    };

    // Try to clean using the provider's command first
    let result: Result<(), CogniaError> = if let Some((cmd, args)) = provider.clean_command() {
        match process::execute(cmd, args, None).await {
            Ok(output) if output.success => Ok(()),
            Ok(output) => Err(CogniaError::Provider(output.stderr)),
            Err(e) => Err(CogniaError::Internal(e.to_string())),
        }
    } else {
        // Direct delete for providers without clean command (e.g., cargo)
        if let Some(ref path) = cache_path {
            if path.exists() {
                if use_trash {
                    fs::remove_dir_with_option(path, true)
                        .await
                        .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))
                } else {
                    fs::remove_dir_all(path)
                        .await
                        .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))
                }
            } else {
                Ok(())
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
    }

    #[cfg(windows)]
    #[test]
    fn test_windows_provider_ids() {
        assert_eq!(ExternalCacheProvider::Scoop.id(), "scoop");
        assert_eq!(ExternalCacheProvider::Chocolatey.id(), "chocolatey");
    }

    #[test]
    fn test_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::from_str("npm"),
            Some(ExternalCacheProvider::Npm)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("NPM"),
            Some(ExternalCacheProvider::Npm)
        );
        assert_eq!(ExternalCacheProvider::from_str("unknown"), None);
    }

    #[test]
    fn test_new_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::from_str("composer"),
            Some(ExternalCacheProvider::Composer)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("poetry"),
            Some(ExternalCacheProvider::Poetry)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("conda"),
            Some(ExternalCacheProvider::Conda)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("miniconda"),
            Some(ExternalCacheProvider::Conda)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("anaconda"),
            Some(ExternalCacheProvider::Conda)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("deno"),
            Some(ExternalCacheProvider::Deno)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("bun"),
            Some(ExternalCacheProvider::Bun)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("gradle"),
            Some(ExternalCacheProvider::Gradle)
        );
    }

    #[cfg(windows)]
    #[test]
    fn test_windows_provider_from_str() {
        assert_eq!(
            ExternalCacheProvider::from_str("scoop"),
            Some(ExternalCacheProvider::Scoop)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("chocolatey"),
            Some(ExternalCacheProvider::Chocolatey)
        );
        assert_eq!(
            ExternalCacheProvider::from_str("choco"),
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
    }

    #[cfg(windows)]
    #[test]
    fn test_windows_cache_paths_not_panic() {
        let _ = get_scoop_cache_path();
        let _ = get_chocolatey_cache_path();
    }

    #[tokio::test]
    async fn test_discover_caches() {
        let caches = discover_all_caches().await;
        assert!(caches.is_ok());
        // Should return an empty or non-empty list without error
    }
}
