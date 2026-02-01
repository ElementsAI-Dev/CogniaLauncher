use super::traits::{Capability, EnvironmentProvider, Provider};
use super::{
    apk, apt, brew, cargo, chocolatey, dnf, docker, flatpak, fnm, github, goenv, macports, npm,
    nvm, pacman, pip, pnpm, psgallery, pyenv, rustup, scoop, snap, uv, vcpkg, winget, yarn, zypper,
};
use crate::error::CogniaResult;
use crate::platform::env::{current_platform, Platform};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn Provider>>,
    environment_providers: HashMap<String, Arc<dyn EnvironmentProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
            environment_providers: HashMap::new(),
        }
    }

    pub async fn with_defaults() -> CogniaResult<Self> {
        let mut registry = Self::new();

        // Node.js version managers - prefer fnm over nvm
        let fnm_provider = Arc::new(fnm::FnmProvider::new());
        if fnm_provider.is_available().await {
            registry.register_environment_provider(fnm_provider);
        } else {
            let nvm_provider = Arc::new(nvm::NvmProvider::new());
            if nvm_provider.is_available().await {
                registry.register_environment_provider(nvm_provider);
            }
        }

        // Python version manager
        let pyenv_provider = Arc::new(pyenv::PyenvProvider::new());
        if pyenv_provider.is_available().await {
            registry.register_environment_provider(pyenv_provider);
        }

        // Rust version manager
        let rustup_provider = Arc::new(rustup::RustupProvider::new());
        if rustup_provider.is_available().await {
            registry.register_environment_provider(rustup_provider);
        }

        // Go version manager
        let goenv_provider = Arc::new(goenv::GoenvProvider::new());
        if goenv_provider.is_available().await {
            registry.register_environment_provider(goenv_provider);
        }

        let github_provider = Arc::new(github::GitHubProvider::new());
        registry.register_provider(github_provider);

        // Register npm provider (cross-platform)
        let npm_provider = Arc::new(npm::NpmProvider::new());
        if npm_provider.is_available().await {
            registry.register_provider(npm_provider);
        }

        // Register pnpm provider (cross-platform)
        let pnpm_provider = Arc::new(pnpm::PnpmProvider::new());
        if pnpm_provider.is_available().await {
            registry.register_provider(pnpm_provider);
        }

        // Register yarn provider (cross-platform)
        let yarn_provider = Arc::new(yarn::YarnProvider::new());
        if yarn_provider.is_available().await {
            registry.register_provider(yarn_provider);
        }

        // Register pip provider (cross-platform Python)
        let pip_provider = Arc::new(pip::PipProvider::new());
        if pip_provider.is_available().await {
            registry.register_provider(pip_provider);
        }

        // Register Go modules provider
        let go_provider = Arc::new(goenv::GoModProvider::new());
        if go_provider.is_available().await {
            registry.register_provider(go_provider);
        }

        // Register vcpkg provider (cross-platform)
        let vcpkg_provider = Arc::new(vcpkg::VcpkgProvider::new());
        if vcpkg_provider.is_available().await {
            registry.register_provider(vcpkg_provider);
        }

        // Register Docker provider (cross-platform)
        let docker_provider = Arc::new(docker::DockerProvider::new());
        if docker_provider.is_available().await {
            registry.register_provider(docker_provider);
        }

        // Register uv provider (cross-platform Python)
        let uv_provider = Arc::new(uv::UvProvider::new());
        if uv_provider.is_available().await {
            registry.register_provider(uv_provider);
        }

        // Register cargo provider (cross-platform Rust)
        let cargo_provider = Arc::new(cargo::CargoProvider::new());
        if cargo_provider.is_available().await {
            registry.register_provider(cargo_provider);
        }

        // Register PSGallery provider (cross-platform PowerShell)
        let psgallery_provider = Arc::new(psgallery::PSGalleryProvider::new());
        if psgallery_provider.is_available().await {
            registry.register_provider(psgallery_provider);
        }

        let platform = current_platform();

        match platform {
            Platform::Linux => {
                // APT (Debian/Ubuntu)
                let apt_provider = Arc::new(apt::AptProvider::new());
                if apt_provider.is_available().await {
                    registry.register_provider(apt_provider);
                }

                // DNF (Fedora/RHEL/CentOS)
                let dnf_provider = Arc::new(dnf::DnfProvider::new());
                if dnf_provider.is_available().await {
                    registry.register_provider(dnf_provider);
                }

                // Pacman (Arch Linux)
                let pacman_provider = Arc::new(pacman::PacmanProvider::new());
                if pacman_provider.is_available().await {
                    registry.register_provider(pacman_provider);
                }

                // Zypper (openSUSE)
                let zypper_provider = Arc::new(zypper::ZypperProvider::new());
                if zypper_provider.is_available().await {
                    registry.register_provider(zypper_provider);
                }

                // APK (Alpine Linux)
                let apk_provider = Arc::new(apk::ApkProvider::new());
                if apk_provider.is_available().await {
                    registry.register_provider(apk_provider);
                }

                // Snap (Universal Linux)
                let snap_provider = Arc::new(snap::SnapProvider::new());
                if snap_provider.is_available().await {
                    registry.register_provider(snap_provider);
                }

                // Flatpak (Universal Linux)
                let flatpak_provider = Arc::new(flatpak::FlatpakProvider::new());
                if flatpak_provider.is_available().await {
                    registry.register_provider(flatpak_provider);
                }
            }
            Platform::MacOS => {
                // Homebrew
                let brew_provider = Arc::new(brew::BrewProvider::new());
                if brew_provider.is_available().await {
                    registry.register_provider(brew_provider);
                }

                // MacPorts
                let macports_provider = Arc::new(macports::MacPortsProvider::new());
                if macports_provider.is_available().await {
                    registry.register_provider(macports_provider);
                }
            }
            Platform::Windows => {
                let winget_provider = Arc::new(winget::WingetProvider::new());
                if winget_provider.is_available().await {
                    registry.register_provider(winget_provider);
                }

                // Register Scoop provider (Windows only)
                let scoop_provider = Arc::new(scoop::ScoopProvider::new());
                if scoop_provider.is_available().await {
                    registry.register_provider(scoop_provider);
                }

                // Register Chocolatey provider (Windows only)
                let chocolatey_provider = Arc::new(chocolatey::ChocolateyProvider::new());
                if chocolatey_provider.is_available().await {
                    registry.register_provider(chocolatey_provider);
                }
            }
            _ => {}
        }

        Ok(registry)
    }

    pub fn register_provider<P: Provider + 'static>(&mut self, provider: Arc<P>) {
        let id = provider.id().to_string();
        self.providers.insert(id, provider);
    }

    pub fn register_environment_provider<P: EnvironmentProvider + 'static>(
        &mut self,
        provider: Arc<P>,
    ) {
        let id = provider.id().to_string();
        self.environment_providers
            .insert(id.clone(), provider.clone());
        self.providers.insert(id, provider);
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn Provider>> {
        self.providers.get(id).cloned()
    }

    pub fn get_environment_provider(&self, id: &str) -> Option<Arc<dyn EnvironmentProvider>> {
        self.environment_providers.get(id).cloned()
    }

    pub fn list(&self) -> Vec<&str> {
        self.providers.keys().map(|s| s.as_str()).collect()
    }

    pub fn list_environment_providers(&self) -> Vec<&str> {
        self.environment_providers
            .keys()
            .map(|s| s.as_str())
            .collect()
    }

    pub fn find_by_capability(&self, capability: Capability) -> Vec<Arc<dyn Provider>> {
        let platform = current_platform();

        let mut providers: Vec<_> = self
            .providers
            .values()
            .filter(|p| {
                p.capabilities().contains(&capability)
                    && p.supported_platforms().contains(&platform)
            })
            .cloned()
            .collect();

        providers.sort_by_key(|b| std::cmp::Reverse(b.priority()));
        providers
    }

    pub async fn find_for_package(
        &self,
        package_name: &str,
    ) -> CogniaResult<Option<Arc<dyn Provider>>> {
        let platform = current_platform();

        let mut candidates: Vec<_> = self
            .providers
            .values()
            .filter(|p| p.supported_platforms().contains(&platform))
            .cloned()
            .collect();

        candidates.sort_by_key(|b| std::cmp::Reverse(b.priority()));

        for provider in candidates {
            if provider.is_available().await {
                if let Ok(info) = provider.get_package_info(package_name).await {
                    if !info.versions.is_empty() {
                        return Ok(Some(provider));
                    }
                }
            }
        }

        Ok(None)
    }

    pub fn get_provider_info(&self, id: &str) -> Option<ProviderInfo> {
        self.providers.get(id).map(|p| ProviderInfo {
            id: p.id().to_string(),
            display_name: p.display_name().to_string(),
            capabilities: p.capabilities().into_iter().collect(),
            platforms: p.supported_platforms(),
            priority: p.priority(),
            is_environment_provider: self.environment_providers.contains_key(id),
        })
    }

    pub fn list_all_info(&self) -> Vec<ProviderInfo> {
        self.providers
            .keys()
            .filter_map(|id| self.get_provider_info(id))
            .collect()
    }

    pub fn get_system_provider_ids(&self) -> Vec<String> {
        let platform = current_platform();

        let system_providers = match platform {
            Platform::Windows => vec!["winget", "scoop", "chocolatey"],
            Platform::MacOS => vec!["brew", "macports"],
            Platform::Linux => vec!["apt", "dnf", "pacman", "zypper", "apk", "snap", "flatpak"],
            _ => vec![],
        };

        system_providers
            .into_iter()
            .map(|s| s.to_string())
            .collect()
    }

    pub async fn check_provider_available(&self, id: &str) -> bool {
        if let Some(provider) = self.providers.get(id) {
            provider.is_available().await
        } else {
            false
        }
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub display_name: String,
    pub capabilities: Vec<Capability>,
    pub platforms: Vec<Platform>,
    pub priority: i32,
    pub is_environment_provider: bool,
}

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;

pub fn create_shared_registry() -> SharedRegistry {
    Arc::new(RwLock::new(ProviderRegistry::new()))
}

pub async fn create_shared_registry_with_defaults() -> CogniaResult<SharedRegistry> {
    let registry = ProviderRegistry::with_defaults().await?;
    Ok(Arc::new(RwLock::new(registry)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_creation() {
        let registry = ProviderRegistry::new();
        assert!(registry.list().is_empty());
    }
}
