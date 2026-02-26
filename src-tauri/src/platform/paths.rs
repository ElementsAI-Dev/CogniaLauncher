//! Cross-platform path utilities for package installation locations
//!
//! This module provides unified path detection for various package managers
//! across Windows, macOS, and Linux platforms.

use super::env::{Architecture, Platform};
use directories::BaseDirs;
use std::path::PathBuf;

/// Unified path utilities for cross-platform package management
pub struct PlatformPaths;

impl PlatformPaths {
    /// Get the current platform
    pub fn current_platform() -> Platform {
        #[cfg(target_os = "windows")]
        {
            Platform::Windows
        }
        #[cfg(target_os = "macos")]
        {
            Platform::MacOS
        }
        #[cfg(target_os = "linux")]
        {
            Platform::Linux
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Platform::Linux
        }
    }

    /// Get the current architecture
    pub fn current_arch() -> Architecture {
        #[cfg(target_arch = "x86_64")]
        {
            Architecture::X86_64
        }
        #[cfg(target_arch = "aarch64")]
        {
            Architecture::Aarch64
        }
        #[cfg(target_arch = "x86")]
        {
            Architecture::X86
        }
        #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64", target_arch = "x86")))]
        {
            Architecture::X86_64
        }
    }

    fn base_dirs() -> Option<BaseDirs> {
        BaseDirs::new()
    }

    /// Get user home directory
    pub fn home_dir() -> Option<PathBuf> {
        Self::base_dirs().map(|dirs| dirs.home_dir().to_path_buf())
    }

    /// Get user data directory (e.g., ~/.local/share on Linux, ~/Library/Application Support on macOS)
    pub fn data_dir() -> Option<PathBuf> {
        Self::base_dirs().map(|dirs| dirs.data_dir().to_path_buf())
    }

    /// Get user config directory
    pub fn config_dir() -> Option<PathBuf> {
        Self::base_dirs().map(|dirs| dirs.config_dir().to_path_buf())
    }

    // ==================== npm/Node.js paths ====================

    /// Get npm global packages directory
    pub fn npm_global_dir() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::Windows => std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("npm")),
            Platform::MacOS | Platform::Linux | Platform::Unknown => {
                // Check npm prefix first
                if let Ok(prefix) = std::env::var("NPM_CONFIG_PREFIX") {
                    return Some(PathBuf::from(prefix).join("lib").join("node_modules"));
                }
                // Default locations
                Self::home_dir().map(|h| h.join(".npm-global").join("lib").join("node_modules"))
            }
        }
    }

    /// Get npm cache directory
    pub fn npm_cache_dir() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::Windows => std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("npm-cache")),
            Platform::MacOS | Platform::Linux | Platform::Unknown => {
                Self::home_dir().map(|h| h.join(".npm"))
            }
        }
    }

    // ==================== pip/Python paths ====================

    /// Get pip site-packages directory for user installs
    pub fn pip_user_site() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::Windows => std::env::var("APPDATA").ok().map(|p| {
                PathBuf::from(p)
                    .join("Python")
                    .join("Python3")
                    .join("site-packages")
            }),
            Platform::MacOS => Self::home_dir().map(|h| {
                h.join("Library")
                    .join("Python")
                    .join("3.11")
                    .join("lib")
                    .join("python")
                    .join("site-packages")
            }),
            Platform::Linux | Platform::Unknown => Self::home_dir().map(|h| {
                h.join(".local")
                    .join("lib")
                    .join("python3")
                    .join("site-packages")
            }),
        }
    }

    /// Get pip scripts/bin directory for user installs
    pub fn pip_user_bin() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::Windows => std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("Python").join("Scripts")),
            Platform::MacOS | Platform::Linux | Platform::Unknown => {
                Self::home_dir().map(|h| h.join(".local").join("bin"))
            }
        }
    }

    // ==================== Cargo/Rust paths ====================

    /// Get cargo home directory
    pub fn cargo_home() -> Option<PathBuf> {
        std::env::var("CARGO_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".cargo")))
    }

    /// Get cargo bin directory
    pub fn cargo_bin() -> Option<PathBuf> {
        Self::cargo_home().map(|h| h.join("bin"))
    }

    // ==================== Homebrew paths ====================

    /// Get Homebrew prefix based on platform and architecture
    pub fn brew_prefix() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::MacOS => match Self::current_arch() {
                Architecture::Aarch64 => Some(PathBuf::from("/opt/homebrew")),
                _ => Some(PathBuf::from("/usr/local")),
            },
            Platform::Linux | Platform::Unknown => {
                Some(PathBuf::from("/home/linuxbrew/.linuxbrew"))
            }
            Platform::Windows => None,
        }
    }

    /// Get Homebrew Cellar directory
    pub fn brew_cellar() -> Option<PathBuf> {
        Self::brew_prefix().map(|p| p.join("Cellar"))
    }

    // ==================== Windows package manager paths ====================

    /// Get winget packages directory (typically Program Files)
    pub fn winget_install_dir() -> Option<PathBuf> {
        if Self::current_platform() != Platform::Windows {
            return None;
        }
        std::env::var("ProgramFiles").ok().map(PathBuf::from)
    }

    /// Get scoop directory
    pub fn scoop_dir() -> Option<PathBuf> {
        if Self::current_platform() != Platform::Windows {
            return None;
        }
        std::env::var("SCOOP")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join("scoop")))
    }

    /// Get scoop apps directory
    pub fn scoop_apps() -> Option<PathBuf> {
        Self::scoop_dir().map(|p| p.join("apps"))
    }

    /// Get chocolatey install directory
    pub fn chocolatey_dir() -> Option<PathBuf> {
        if Self::current_platform() != Platform::Windows {
            return None;
        }
        std::env::var("ChocolateyInstall")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Some(PathBuf::from("C:\\ProgramData\\chocolatey")))
    }

    // ==================== Linux package manager paths ====================

    /// Get system package install directory (for apt, dnf, pacman, etc.)
    pub fn system_pkg_dir() -> PathBuf {
        PathBuf::from("/usr")
    }

    /// Get snap install directory
    pub fn snap_dir() -> PathBuf {
        PathBuf::from("/snap")
    }

    /// Get flatpak install directory
    pub fn flatpak_dir() -> PathBuf {
        PathBuf::from("/var/lib/flatpak")
    }

    // ==================== Version manager paths ====================

    /// Get NVM directory
    pub fn nvm_dir() -> Option<PathBuf> {
        std::env::var("NVM_DIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".nvm")))
    }

    /// Get FNM directory
    pub fn fnm_dir() -> Option<PathBuf> {
        std::env::var("FNM_DIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| match Self::current_platform() {
                Platform::Windows => Self::data_dir().map(|d| d.join("fnm")),
                _ => Self::home_dir().map(|h| h.join(".fnm")),
            })
    }

    /// Get pyenv root directory
    pub fn pyenv_root() -> Option<PathBuf> {
        std::env::var("PYENV_ROOT")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".pyenv")))
    }

    /// Get rbenv root directory
    pub fn rbenv_root() -> Option<PathBuf> {
        std::env::var("RBENV_ROOT")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".rbenv")))
    }

    /// Get rustup home directory
    pub fn rustup_home() -> Option<PathBuf> {
        std::env::var("RUSTUP_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".rustup")))
    }

    /// Get SDKMAN directory
    pub fn sdkman_dir() -> Option<PathBuf> {
        std::env::var("SDKMAN_DIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".sdkman")))
    }

    /// Get goenv root directory
    pub fn goenv_root() -> Option<PathBuf> {
        std::env::var("GOENV_ROOT")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".goenv")))
    }

    /// Get deno directory
    pub fn deno_dir() -> Option<PathBuf> {
        std::env::var("DENO_INSTALL")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".deno")))
    }

    // ==================== Other package manager paths ====================

    /// Get composer global directory
    pub fn composer_home() -> Option<PathBuf> {
        std::env::var("COMPOSER_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| match Self::current_platform() {
                Platform::Windows => std::env::var("APPDATA")
                    .ok()
                    .map(|p| PathBuf::from(p).join("Composer")),
                Platform::MacOS | Platform::Linux | Platform::Unknown => {
                    Self::home_dir().map(|h| h.join(".composer"))
                }
            })
    }

    /// Get poetry home directory
    pub fn poetry_home() -> Option<PathBuf> {
        std::env::var("POETRY_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| match Self::current_platform() {
                Platform::Windows => Self::data_dir().map(|d| d.join("pypoetry")),
                Platform::MacOS | Platform::Linux | Platform::Unknown => {
                    Self::home_dir().map(|h| h.join(".local").join("share").join("pypoetry"))
                }
            })
    }

    /// Get bundler/gem home directory
    pub fn gem_home() -> Option<PathBuf> {
        std::env::var("GEM_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".gem")))
    }

    /// Get PowerShell modules directory
    pub fn powershell_modules() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::Windows => Self::home_dir().map(|h| {
                h.join("Documents")
                    .join("WindowsPowerShell")
                    .join("Modules")
            }),
            Platform::MacOS | Platform::Linux | Platform::Unknown => Self::home_dir().map(|h| {
                h.join(".local")
                    .join("share")
                    .join("powershell")
                    .join("Modules")
            }),
        }
    }

    /// Get vcpkg root directory
    pub fn vcpkg_root() -> Option<PathBuf> {
        std::env::var("VCPKG_ROOT").ok().map(PathBuf::from).or_else(
            || match Self::current_platform() {
                Platform::Windows => Some(PathBuf::from("C:\\vcpkg")),
                _ => Self::home_dir().map(|h| h.join("vcpkg")),
            },
        )
    }

    /// Get Docker data directory
    pub fn docker_data_dir() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::Windows => Some(PathBuf::from("C:\\ProgramData\\Docker")),
            Platform::MacOS => Self::home_dir().map(|h| {
                h.join("Library")
                    .join("Containers")
                    .join("com.docker.docker")
            }),
            Platform::Linux | Platform::Unknown => Some(PathBuf::from("/var/lib/docker")),
        }
    }

    /// Get .NET global tools directory
    pub fn dotnet_tools() -> Option<PathBuf> {
        Self::home_dir().map(|h| h.join(".dotnet").join("tools"))
    }

    /// Get NuGet packages directory
    pub fn nuget_packages() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::Windows => std::env::var("USERPROFILE")
                .ok()
                .map(|p| PathBuf::from(p).join(".nuget").join("packages")),
            _ => Self::home_dir().map(|h| h.join(".nuget").join("packages")),
        }
    }

    /// Get bun install directory
    pub fn bun_install() -> Option<PathBuf> {
        std::env::var("BUN_INSTALL")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::home_dir().map(|h| h.join(".bun")))
    }

    /// Get pnpm home directory
    pub fn pnpm_home() -> Option<PathBuf> {
        std::env::var("PNPM_HOME").ok().map(PathBuf::from).or_else(
            || match Self::current_platform() {
                Platform::Windows => Self::data_dir().map(|d| d.join("pnpm")),
                _ => Self::home_dir().map(|h| h.join(".local").join("share").join("pnpm")),
            },
        )
    }

    /// Get yarn global directory
    pub fn yarn_global() -> Option<PathBuf> {
        match Self::current_platform() {
            Platform::Windows => Self::data_dir().map(|d| d.join("Yarn").join("global")),
            _ => Self::home_dir().map(|h| h.join(".yarn").join("global")),
        }
    }

    /// Get uv cache/install directory
    pub fn uv_cache() -> Option<PathBuf> {
        std::env::var("UV_CACHE_DIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| match Self::current_platform() {
                Platform::Windows => Self::data_dir().map(|d| d.join("uv")),
                Platform::MacOS => {
                    Self::home_dir().map(|h| h.join("Library").join("Caches").join("uv"))
                }
                Platform::Linux | Platform::Unknown => {
                    Self::home_dir().map(|h| h.join(".cache").join("uv"))
                }
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_current_platform() {
        let platform = PlatformPaths::current_platform();
        #[cfg(target_os = "windows")]
        assert_eq!(platform, Platform::Windows);
        #[cfg(target_os = "macos")]
        assert_eq!(platform, Platform::MacOS);
        #[cfg(target_os = "linux")]
        assert_eq!(platform, Platform::Linux);
    }

    #[test]
    fn test_home_dir() {
        assert!(PlatformPaths::home_dir().is_some());
    }

    #[test]
    fn test_cargo_home() {
        let cargo_home = PlatformPaths::cargo_home();
        assert!(cargo_home.is_some());
    }
}
