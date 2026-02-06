use super::api::update_api_client_from_settings;
use super::system::{SystemEnvironmentProvider, SystemEnvironmentType};
use super::traits::{Capability, EnvironmentProvider, Provider};
use super::{
    apk, apt, asdf, brew, bun, bundler, cargo, chocolatey, composer, conda, deno, dnf, docker,
    dotnet, flatpak, fnm, gem, github, gitlab, goenv, macports, mise, nix, npm, nvm, pacman,
    phpbrew, pip, pipx, pnpm, poetry, psgallery, pyenv, rbenv, rustup, scoop, sdkman, snap, uv,
    vcpkg, volta, winget, yarn, zypper,
};
use crate::config::Settings;
use crate::error::CogniaResult;
use crate::platform::env::{current_platform, Platform};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn Provider>>,
    environment_providers: HashMap<String, Arc<dyn EnvironmentProvider>>,
    disabled_providers: HashSet<String>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
            environment_providers: HashMap::new(),
            disabled_providers: HashSet::new(),
        }
    }

    pub async fn with_defaults() -> CogniaResult<Self> {
        Self::with_settings(&Settings::default()).await
    }

    /// Create a registry with providers configured from settings
    pub async fn with_settings(settings: &Settings) -> CogniaResult<Self> {
        let mut registry = Self::new();

        registry.disabled_providers = settings
            .provider_settings
            .disabled_providers
            .iter()
            .cloned()
            .collect();

        // Update the global API client with mirror settings
        update_api_client_from_settings(settings);

        // Get mirror URLs from settings
        let npm_mirror = settings.get_mirror_url("npm");
        let pypi_mirror = settings.get_mirror_url("pypi");
        let crates_mirror = settings.get_mirror_url("crates");

        // Track which environment types have version managers available
        let mut has_node_manager = false;
        let mut has_python_manager = false;
        let mut has_rust_manager = false;
        let mut has_go_manager = false;
        let mut has_ruby_manager = false;
        let mut has_java_manager = false;
        let mut has_php_manager = false;
        let mut has_dotnet_manager = false;
        let mut has_deno_manager = false;

        // Node.js version managers - prefer volta > fnm > nvm
        let volta_provider = Arc::new(volta::VoltaProvider::new());
        if volta_provider.is_available().await {
            registry.register_environment_provider(volta_provider);
            has_node_manager = true;
        } else {
            let fnm_provider = Arc::new(fnm::FnmProvider::new());
            if fnm_provider.is_available().await {
                registry.register_environment_provider(fnm_provider);
                has_node_manager = true;
            } else {
                let nvm_provider = Arc::new(nvm::NvmProvider::new());
                if nvm_provider.is_available().await {
                    registry.register_environment_provider(nvm_provider);
                    has_node_manager = true;
                }
            }
        }

        // mise - modern polyglot version manager (preferred over asdf)
        let mise_provider = Arc::new(mise::MiseProvider::new());
        if mise_provider.is_available().await {
            registry.register_environment_provider(mise_provider);
        } else {
            // asdf - polyglot version manager (macOS/Linux only)
            let asdf_provider = Arc::new(asdf::AsdfProvider::new());
            if asdf_provider.is_available().await {
                registry.register_environment_provider(asdf_provider);
            }
        }

        // Python version manager
        let pyenv_provider = Arc::new(pyenv::PyenvProvider::new());
        if pyenv_provider.is_available().await {
            registry.register_environment_provider(pyenv_provider);
            has_python_manager = true;
        }

        // Rust version manager
        let rustup_provider = Arc::new(rustup::RustupProvider::new());
        if rustup_provider.is_available().await {
            registry.register_environment_provider(rustup_provider);
            has_rust_manager = true;
        }

        // Go version manager
        let goenv_provider = Arc::new(goenv::GoenvProvider::new());
        if goenv_provider.is_available().await {
            registry.register_environment_provider(goenv_provider);
            has_go_manager = true;
        }

        // Ruby version manager
        let rbenv_provider = Arc::new(rbenv::RbenvProvider::new());
        if rbenv_provider.is_available().await {
            registry.register_environment_provider(rbenv_provider);
            has_ruby_manager = true;
        }

        // Java version manager (SDKMAN!)
        let sdkman_provider = Arc::new(sdkman::SdkmanProvider::new());
        if sdkman_provider.is_available().await {
            registry.register_environment_provider(sdkman_provider);
            has_java_manager = true;
        }

        // PHP version manager (PHPBrew) - macOS/Linux only
        let phpbrew_provider = Arc::new(phpbrew::PhpbrewProvider::new());
        if phpbrew_provider.is_available().await {
            registry.register_environment_provider(phpbrew_provider);
            has_php_manager = true;
        }

        // .NET SDK version manager
        let dotnet_provider = Arc::new(dotnet::DotnetProvider::new());
        if dotnet_provider.is_available().await {
            registry.register_environment_provider(dotnet_provider);
            has_dotnet_manager = true;
        }

        // Deno runtime version manager
        let deno_provider = Arc::new(deno::DenoProvider::new());
        if deno_provider.is_available().await {
            registry.register_environment_provider(deno_provider);
            has_deno_manager = true;
        }

        // Register system environment providers as fallback for environments
        // that don't have a version manager installed
        // These detect environments installed via official installers, package managers, etc.

        if !has_node_manager {
            let system_node = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Node));
            if system_node.is_available().await {
                registry.register_environment_provider(system_node);
            }
        }

        if !has_python_manager {
            let system_python = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Python));
            if system_python.is_available().await {
                registry.register_environment_provider(system_python);
            }
        }

        if !has_go_manager {
            let system_go = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Go));
            if system_go.is_available().await {
                registry.register_environment_provider(system_go);
            }
        }

        if !has_rust_manager {
            let system_rust = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Rust));
            if system_rust.is_available().await {
                registry.register_environment_provider(system_rust);
            }
        }

        if !has_ruby_manager {
            let system_ruby = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Ruby));
            if system_ruby.is_available().await {
                registry.register_environment_provider(system_ruby);
            }
        }

        if !has_java_manager {
            let system_java = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Java));
            if system_java.is_available().await {
                registry.register_environment_provider(system_java);
            }
        }

        if !has_php_manager {
            let system_php = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Php));
            if system_php.is_available().await {
                registry.register_environment_provider(system_php);
            }
        }

        if !has_dotnet_manager {
            let system_dotnet = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Dotnet));
            if system_dotnet.is_available().await {
                registry.register_environment_provider(system_dotnet);
            }
        }

        if !has_deno_manager {
            let system_deno = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Deno));
            if system_deno.is_available().await {
                registry.register_environment_provider(system_deno);
            }
        }

        // Bun doesn't have a dedicated version manager, always use system detection
        let system_bun = Arc::new(SystemEnvironmentProvider::new(SystemEnvironmentType::Bun));
        if system_bun.is_available().await {
            registry.register_environment_provider(system_bun);
        }

        // GitHub provider with optional token from settings
        let github_token = settings.providers.get("github")
            .and_then(|ps| ps.extra.get("token"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| std::env::var("GITHUB_TOKEN").ok());
        let github_provider = Arc::new(
            github::GitHubProvider::new().with_token(github_token)
        );
        registry.register_provider(github_provider);

        // GitLab provider with optional token and custom instance URL from settings
        let gitlab_token = settings.providers.get("gitlab")
            .and_then(|ps| ps.extra.get("token"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| std::env::var("GITLAB_TOKEN").ok());
        let gitlab_url = settings.providers.get("gitlab")
            .and_then(|ps| ps.extra.get("url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let gitlab_provider = Arc::new(
            gitlab::GitLabProvider::new()
                .with_token(gitlab_token)
                .with_instance_url(gitlab_url)
        );
        registry.register_provider(gitlab_provider);

        // Register npm provider with mirror configuration
        let npm_provider = Arc::new(
            npm::NpmProvider::new().with_registry_opt(npm_mirror.clone())
        );
        if npm_provider.is_available().await {
            registry.register_provider(npm_provider);
        }

        // Register pnpm provider with mirror configuration
        let pnpm_provider = Arc::new(
            pnpm::PnpmProvider::new().with_registry_opt(npm_mirror.clone())
        );
        if pnpm_provider.is_available().await {
            registry.register_provider(pnpm_provider);
        }

        // Register yarn provider with mirror configuration
        let yarn_provider = Arc::new(
            yarn::YarnProvider::new().with_registry_opt(npm_mirror.clone())
        );
        if yarn_provider.is_available().await {
            registry.register_provider(yarn_provider);
        }

        // Register Bun provider with mirror configuration (faster alternative to npm)
        let bun_provider = Arc::new(
            bun::BunProvider::new().with_registry_opt(npm_mirror)
        );
        if bun_provider.is_available().await {
            registry.register_provider(bun_provider);
        }

        // Register pip provider with mirror configuration
        let pip_provider = Arc::new(
            pip::PipProvider::new().with_index_url_opt(pypi_mirror.clone())
        );
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

        // Register uv provider with mirror configuration
        let uv_provider = Arc::new(
            uv::UvProvider::new().with_index_url_opt(pypi_mirror.clone())
        );
        if uv_provider.is_available().await {
            registry.register_provider(uv_provider);
        }

        // Register Poetry provider with mirror configuration (Python dependency management)
        let poetry_provider = Arc::new(
            poetry::PoetryProvider::new().with_index_url_opt(pypi_mirror)
        );
        if poetry_provider.is_available().await {
            registry.register_provider(poetry_provider);
        }

        // Register cargo provider with mirror configuration
        let cargo_provider = Arc::new(
            cargo::CargoProvider::new().with_registry_opt(crates_mirror)
        );
        if cargo_provider.is_available().await {
            registry.register_provider(cargo_provider);
        }

        // Register PSGallery provider (cross-platform PowerShell)
        let psgallery_provider = Arc::new(psgallery::PSGalleryProvider::new());
        if psgallery_provider.is_available().await {
            registry.register_provider(psgallery_provider);
        }

        // Register Bundler provider (Ruby dependency management)
        let bundler_provider = Arc::new(bundler::BundlerProvider::new());
        if bundler_provider.is_available().await {
            registry.register_provider(bundler_provider);
        }

        // Register RubyGems provider (standalone gem management)
        let gem_provider = Arc::new(gem::GemProvider::new());
        if gem_provider.is_available().await {
            registry.register_provider(gem_provider);
        }

        // Register Composer provider (PHP dependency management)
        let composer_provider = Arc::new(composer::ComposerProvider::new());
        if composer_provider.is_available().await {
            registry.register_provider(composer_provider);
        }

        // Register Conda provider (Python data science package manager)
        let conda_provider = Arc::new(conda::CondaProvider::new());
        if conda_provider.is_available().await {
            registry.register_provider(conda_provider);
        }

        // Register pipx provider (isolated Python CLI tools)
        let pipx_provider = Arc::new(pipx::PipxProvider::new());
        if pipx_provider.is_available().await {
            registry.register_provider(pipx_provider);
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

                // Nix (Linux)
                let nix_provider = Arc::new(nix::NixProvider::new());
                if nix_provider.is_available().await {
                    registry.register_provider(nix_provider);
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

                // Nix (macOS)
                let nix_provider = Arc::new(nix::NixProvider::new());
                if nix_provider.is_available().await {
                    registry.register_provider(nix_provider);
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
        self.providers
            .keys()
            .filter(|id| self.is_provider_enabled(id))
            .map(|s| s.as_str())
            .collect()
    }

    pub fn list_environment_providers(&self) -> Vec<&str> {
        self.environment_providers
            .keys()
            .filter(|id| self.is_provider_enabled(id))
            .map(|s| s.as_str())
            .collect()
    }

    pub fn find_by_capability(&self, capability: Capability) -> Vec<Arc<dyn Provider>> {
        let platform = current_platform();

        let mut providers: Vec<_> = self
            .providers
            .values()
            .filter(|p| {
                self.is_provider_enabled(p.id())
                    && p.capabilities().contains(&capability)
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
            .filter(|p| self.is_provider_enabled(p.id()))
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
            enabled: self.is_provider_enabled(id),
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
        if !self.is_provider_enabled(id) {
            return false;
        }

        if let Some(provider) = self.providers.get(id) {
            provider.is_available().await
        } else {
            false
        }
    }

    pub fn set_provider_enabled(&mut self, id: &str, enabled: bool) {
        if enabled {
            self.disabled_providers.remove(id);
        } else {
            self.disabled_providers.insert(id.to_string());
        }
    }

    pub fn is_provider_enabled(&self, id: &str) -> bool {
        !self.disabled_providers.contains(id)
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
    pub enabled: bool,
}

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;

pub fn create_shared_registry() -> SharedRegistry {
    Arc::new(RwLock::new(ProviderRegistry::new()))
}

pub async fn create_shared_registry_with_defaults() -> CogniaResult<SharedRegistry> {
    let registry = ProviderRegistry::with_defaults().await?;
    Ok(Arc::new(RwLock::new(registry)))
}

/// Create a shared registry with providers configured from settings
pub async fn create_shared_registry_with_settings(settings: &Settings) -> CogniaResult<SharedRegistry> {
    let registry = ProviderRegistry::with_settings(settings).await?;
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

    #[test]
    fn test_provider_enabled_state() {
        let mut registry = ProviderRegistry::new();

        registry.set_provider_enabled("npm", false);
        assert!(!registry.is_provider_enabled("npm"));

        registry.set_provider_enabled("npm", true);
        assert!(registry.is_provider_enabled("npm"));
    }
}
