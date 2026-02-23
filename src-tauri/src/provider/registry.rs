use super::api::update_api_client_from_settings;
use super::system::{SystemEnvironmentProvider, SystemEnvironmentType};
use super::traits::{Capability, EnvironmentProvider, Provider, SystemPackageProvider};
use super::{
    apk, apt, asdf, brew, bun, bundler, cargo, chocolatey, composer, conan, conda, deno, dnf,
    docker, dotnet, flatpak, fnm, fvm, gem, github, gitlab, goenv, luarocks, macports, mise, msvc,
    msys2, nix, npm, nvm, pacman, phpbrew, pip, pipx, pnpm, podman, poetry, psgallery, pub_dev, pyenv,
    rbenv, rustup, scoop, sdkman, snap, uv, vcpkg, volta, winget, wsl, xmake, yarn, zig, zypper,
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
    system_package_providers: HashMap<String, Arc<dyn SystemPackageProvider>>,
    api_provider_config: HashMap<String, ApiProviderConfig>,
    disabled_providers: HashSet<String>,
}

#[derive(Debug, Clone)]
pub struct ApiProviderConfig {
    pub has_token: bool,
    pub base_url: Option<String>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
            environment_providers: HashMap::new(),
            system_package_providers: HashMap::new(),
            api_provider_config: HashMap::new(),
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
        let go_mirror = settings.get_mirror_url("go");

        let platform = current_platform();

        // Register environment/version managers. Availability is treated as "status",
        // not a gating condition for whether a provider exists in the registry.
        let volta_provider = Arc::new(volta::VoltaProvider::new());
        if volta_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(volta_provider.clone());
            registry.register_system_provider(volta_provider);
        }

        let fnm_provider = Arc::new(fnm::FnmProvider::new());
        if fnm_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(fnm_provider.clone());
            registry.register_system_provider(fnm_provider);
        }

        let nvm_provider = Arc::new(nvm::NvmProvider::new());
        if nvm_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(nvm_provider.clone());
            registry.register_system_provider(nvm_provider);
        }

        let mise_provider = Arc::new(mise::MiseProvider::new());
        if mise_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(mise_provider);
        }

        let asdf_provider = Arc::new(asdf::AsdfProvider::new());
        if asdf_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(asdf_provider);
        }

        let pyenv_provider = Arc::new(pyenv::PyenvProvider::new());
        if pyenv_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(pyenv_provider);
        }

        let rustup_provider = Arc::new(rustup::RustupProvider::new());
        if rustup_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(rustup_provider.clone());
            registry.register_system_provider(rustup_provider);
        }

        let goenv_provider = Arc::new(goenv::GoenvProvider::new());
        if goenv_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(goenv_provider.clone());
            registry.register_system_provider(goenv_provider);
        }

        let rbenv_provider = Arc::new(rbenv::RbenvProvider::new());
        if rbenv_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(rbenv_provider.clone());
            registry.register_system_provider(rbenv_provider);
        }

        let sdkman_java = Arc::new(sdkman::SdkmanProvider::java());
        if sdkman_java.supported_platforms().contains(&platform) {
            registry.register_environment_provider(sdkman_java.clone());
            registry.register_system_provider(sdkman_java);
        }

        let sdkman_kotlin = Arc::new(sdkman::SdkmanProvider::kotlin());
        if sdkman_kotlin.supported_platforms().contains(&platform) {
            registry.register_environment_provider(sdkman_kotlin.clone());
            registry.register_system_provider(sdkman_kotlin);
        }

        let sdkman_scala = Arc::new(sdkman::SdkmanProvider::new("scala"));
        if sdkman_scala.supported_platforms().contains(&platform) {
            registry.register_environment_provider(sdkman_scala.clone());
            registry.register_system_provider(sdkman_scala);
        }

        let sdkman_groovy = Arc::new(sdkman::SdkmanProvider::new("groovy"));
        if sdkman_groovy.supported_platforms().contains(&platform) {
            registry.register_environment_provider(sdkman_groovy.clone());
            registry.register_system_provider(sdkman_groovy);
        }

        let phpbrew_provider = Arc::new(phpbrew::PhpbrewProvider::new());
        if phpbrew_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(phpbrew_provider.clone());
            registry.register_system_provider(phpbrew_provider);
        }

        let dotnet_provider = Arc::new(dotnet::DotnetProvider::new());
        if dotnet_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(dotnet_provider.clone());
            registry.register_system_provider(dotnet_provider);
        }

        let deno_provider = Arc::new(deno::DenoProvider::new());
        if deno_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(deno_provider.clone());
            registry.register_system_provider(deno_provider);
        }

        let fvm_provider = Arc::new(fvm::FvmProvider::new());
        if fvm_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(fvm_provider.clone());
            registry.register_system_provider(fvm_provider);
        }

        let pub_provider = Arc::new(pub_dev::PubProvider::new());
        if pub_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(pub_provider);
        }

        let zig_provider = Arc::new(zig::ZigProvider::new());
        if zig_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(zig_provider.clone());
            registry.register_system_provider(zig_provider);
        }

        let nix_provider = Arc::new(nix::NixProvider::new());
        if nix_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(nix_provider);
        }

        // Always register system environment providers as fallbacks (availability is a status).
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Node,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Python,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Go,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Rust,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Ruby,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Java,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Kotlin,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Php,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Dotnet,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Deno,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Bun,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Zig,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Dart,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Lua,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Scala,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Groovy,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Elixir,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Erlang,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Swift,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Julia,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Perl,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::R,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Haskell,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Clojure,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Crystal,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Nim,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Ocaml,
        )));
        registry.register_environment_provider(Arc::new(SystemEnvironmentProvider::new(
            SystemEnvironmentType::Fortran,
        )));

        // GitHub provider with optional token from settings
        let github_token = settings
            .providers
            .get("github")
            .and_then(|ps| ps.extra.get("token"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| std::env::var("GITHUB_TOKEN").ok());
        let github_has_token = github_token.is_some();
        let github_provider = Arc::new(github::GitHubProvider::new().with_token(github_token));
        registry.register_provider(github_provider);
        registry.api_provider_config.insert(
            "github".into(),
            ApiProviderConfig {
                has_token: github_has_token,
                base_url: Some("https://api.github.com".into()),
            },
        );

        // GitLab provider with optional token and custom instance URL from settings
        let gitlab_token = settings
            .providers
            .get("gitlab")
            .and_then(|ps| ps.extra.get("token"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| std::env::var("GITLAB_TOKEN").ok());
        let gitlab_has_token = gitlab_token.is_some();
        let gitlab_url = settings
            .providers
            .get("gitlab")
            .and_then(|ps| ps.extra.get("url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let gitlab_base_url = gitlab_url
            .clone()
            .or_else(|| Some("https://gitlab.com".into()));
        let gitlab_provider = Arc::new(
            gitlab::GitLabProvider::new()
                .with_token(gitlab_token)
                .with_instance_url(gitlab_url),
        );
        registry.register_provider(gitlab_provider);
        registry.api_provider_config.insert(
            "gitlab".into(),
            ApiProviderConfig {
                has_token: gitlab_has_token,
                base_url: gitlab_base_url,
            },
        );

        // Register npm provider with mirror configuration
        let npm_provider = Arc::new(npm::NpmProvider::new().with_registry_opt(npm_mirror.clone()));
        if npm_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(npm_provider);
        }

        // Register pnpm provider with mirror configuration
        let pnpm_provider =
            Arc::new(pnpm::PnpmProvider::new().with_registry_opt(npm_mirror.clone()));
        if pnpm_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(pnpm_provider);
        }

        // Register yarn provider with mirror configuration
        let yarn_provider =
            Arc::new(yarn::YarnProvider::new().with_registry_opt(npm_mirror.clone()));
        if yarn_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(yarn_provider);
        }

        // Register Bun provider with mirror configuration (faster alternative to npm)
        let bun_provider = Arc::new(bun::BunProvider::new().with_registry_opt(npm_mirror.clone()));
        if bun_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(bun_provider);
        }

        // Register pip provider with mirror configuration
        let pip_provider =
            Arc::new(pip::PipProvider::new().with_index_url_opt(pypi_mirror.clone()));
        if pip_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(pip_provider);
        }

        // Register Go modules provider with mirror configuration
        let go_provider = Arc::new(goenv::GoModProvider::new().with_proxy_opt(go_mirror));
        if go_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(go_provider);
        }

        // Register vcpkg provider (cross-platform C++ package manager)
        let vcpkg_provider = Arc::new(vcpkg::VcpkgProvider::new());
        if vcpkg_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(vcpkg_provider);
        }

        // Register Conan provider (cross-platform C/C++ package manager)
        let conan_provider = Arc::new(conan::ConanProvider::new());
        if conan_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(conan_provider);
        }

        // Register Xmake/Xrepo provider (cross-platform C/C++ build & package manager)
        let xmake_provider = Arc::new(xmake::XmakeProvider::new());
        if xmake_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(xmake_provider);
        }

        // Register Docker provider (cross-platform)
        let docker_provider = Arc::new(docker::DockerProvider::new());
        if docker_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(docker_provider);
        }

        // Register Podman provider (cross-platform, daemonless alternative to Docker)
        let podman_provider = Arc::new(podman::PodmanProvider::new());
        if podman_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(podman_provider);
        }

        // Register uv provider with mirror configuration (package manager + Python version manager)
        let uv_provider = Arc::new(uv::UvProvider::new().with_index_url_opt(pypi_mirror.clone()));
        if uv_provider.supported_platforms().contains(&platform) {
            registry.register_environment_provider(uv_provider.clone());
            registry.register_system_provider(uv_provider);
        }

        // Register Poetry provider with mirror configuration (Python dependency management)
        let poetry_provider =
            Arc::new(poetry::PoetryProvider::new().with_index_url_opt(pypi_mirror.clone()));
        if poetry_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(poetry_provider);
        }

        // Register cargo provider with mirror configuration
        let cargo_provider =
            Arc::new(cargo::CargoProvider::new().with_registry_opt(crates_mirror.clone()));
        if cargo_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(cargo_provider);
        }

        // Register PSGallery provider (cross-platform PowerShell)
        let psgallery_provider = Arc::new(psgallery::PSGalleryProvider::new());
        if psgallery_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(psgallery_provider);
        }

        // Register Bundler provider (Ruby dependency management)
        let bundler_provider = Arc::new(bundler::BundlerProvider::new());
        if bundler_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(bundler_provider);
        }

        // Register RubyGems provider (standalone gem management)
        let gem_provider = Arc::new(gem::GemProvider::new());
        if gem_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(gem_provider);
        }

        // Register LuaRocks provider (Lua package manager)
        let luarocks_provider = Arc::new(luarocks::LuaRocksProvider::new());
        if luarocks_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(luarocks_provider);
        }

        // Register Composer provider (PHP dependency management)
        let composer_provider = Arc::new(composer::ComposerProvider::new());
        if composer_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(composer_provider);
        }

        // Register Conda provider (Python data science package manager)
        let conda_provider = Arc::new(conda::CondaProvider::new());
        if conda_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(conda_provider);
        }

        // Register pipx provider (isolated Python CLI tools)
        let pipx_provider = Arc::new(pipx::PipxProvider::new());
        if pipx_provider.supported_platforms().contains(&platform) {
            registry.register_system_provider(pipx_provider);
        }

        let platform = current_platform();

        match platform {
            Platform::Linux => {
                // APT (Debian/Ubuntu)
                let apt_provider = Arc::new(apt::AptProvider::new());
                registry.register_system_provider(apt_provider);

                // DNF (Fedora/RHEL/CentOS)
                let dnf_provider = Arc::new(dnf::DnfProvider::new());
                registry.register_system_provider(dnf_provider);

                // Pacman (Arch Linux)
                let pacman_provider = Arc::new(pacman::PacmanProvider::new());
                registry.register_system_provider(pacman_provider);

                // Zypper (openSUSE)
                let zypper_provider = Arc::new(zypper::ZypperProvider::new());
                registry.register_system_provider(zypper_provider);

                // APK (Alpine Linux)
                let apk_provider = Arc::new(apk::ApkProvider::new());
                registry.register_system_provider(apk_provider);

                // Snap (Universal Linux)
                let snap_provider = Arc::new(snap::SnapProvider::new());
                registry.register_system_provider(snap_provider);

                // Flatpak (Universal Linux)
                let flatpak_provider = Arc::new(flatpak::FlatpakProvider::new());
                registry.register_system_provider(flatpak_provider);
            }
            Platform::MacOS => {
                // Homebrew
                let brew_provider = Arc::new(brew::BrewProvider::new());
                registry.register_system_provider(brew_provider);

                // MacPorts
                let macports_provider = Arc::new(macports::MacPortsProvider::new());
                registry.register_system_provider(macports_provider);
            }
            Platform::Windows => {
                let winget_provider = Arc::new(winget::WingetProvider::new());
                registry.register_system_provider(winget_provider);

                // Register Scoop provider (Windows only)
                let scoop_provider = Arc::new(scoop::ScoopProvider::new());
                registry.register_system_provider(scoop_provider);

                // Register Chocolatey provider (Windows only)
                let chocolatey_provider = Arc::new(chocolatey::ChocolateyProvider::new());
                registry.register_system_provider(chocolatey_provider);

                // Register WSL provider (Windows only)
                let wsl_provider = Arc::new(wsl::WslProvider::new());
                registry.register_system_provider(wsl_provider);

                // Register MSVC provider (Visual Studio Build Tools detection)
                let msvc_provider = Arc::new(msvc::MsvcProvider::new());
                registry.register_system_provider(msvc_provider);

                // Register MSYS2 provider (pacman-based package manager)
                let msys2_provider = Arc::new(msys2::Msys2Provider::new());
                registry.register_system_provider(msys2_provider);
            }
            _ => {}
        }

        Ok(registry)
    }

    pub fn register_provider<P: Provider + 'static>(&mut self, provider: Arc<P>) {
        let id = provider.id().to_string();
        self.providers.insert(id, provider);
    }

    pub fn register_system_provider<P: SystemPackageProvider + 'static>(
        &mut self,
        provider: Arc<P>,
    ) {
        let id = provider.id().to_string();
        self.system_package_providers
            .insert(id.clone(), provider.clone());
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

    pub fn get_system_provider(&self, id: &str) -> Option<Arc<dyn SystemPackageProvider>> {
        self.system_package_providers.get(id).cloned()
    }

    pub fn list_system_package_provider_ids(&self) -> Vec<String> {
        self.system_package_providers
            .keys()
            .cloned()
            .collect::<Vec<_>>()
    }

    pub fn get_api_provider_config(&self, id: &str) -> Option<ApiProviderConfig> {
        self.api_provider_config.get(id).cloned()
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

    /// List all environment providers, regardless of enabled/disabled state.
    ///
    /// This is primarily used for UI enumeration and provider detail views, where "disabled"
    /// should not hide a provider from visibility.
    pub fn list_all_environment_providers(&self) -> Vec<&str> {
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
            Platform::Windows => vec!["winget", "scoop", "chocolatey", "wsl", "msvc", "msys2"],
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
pub async fn create_shared_registry_with_settings(
    settings: &Settings,
) -> CogniaResult<SharedRegistry> {
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

    #[tokio::test]
    async fn with_defaults_registers_known_providers_for_platform() {
        let registry = ProviderRegistry::with_defaults().await.unwrap();

        // Cross-platform providers that should always be visible (regardless of installation state).
        for id in [
            "github",
            "gitlab",
            "npm",
            "pnpm",
            "yarn",
            "pip",
            "uv",
            "cargo",
            "system-node",
            "system-python",
            "system-go",
            "system-rust",
            "system-deno",
            "system-bun",
            "system-zig",
        ] {
            assert!(
                registry.get_provider_info(id).is_some(),
                "expected provider '{}' to be registered",
                id
            );
        }

        #[cfg(windows)]
        for id in ["winget", "scoop", "chocolatey", "wsl", "msvc", "msys2"] {
            assert!(
                registry.get_provider_info(id).is_some(),
                "expected provider '{}' to be registered on Windows",
                id
            );
        }

        #[cfg(target_os = "macos")]
        for id in ["brew", "macports"] {
            assert!(
                registry.get_provider_info(id).is_some(),
                "expected provider '{}' to be registered on macOS",
                id
            );
        }

        #[cfg(target_os = "linux")]
        for id in ["apt", "dnf", "pacman", "zypper", "apk", "snap", "flatpak"] {
            assert!(
                registry.get_provider_info(id).is_some(),
                "expected provider '{}' to be registered on Linux",
                id
            );
        }
    }

    #[tokio::test]
    async fn disabled_providers_remain_visible_in_provider_list() {
        let mut settings = Settings::default();
        settings
            .provider_settings
            .disabled_providers
            .push("npm".to_string());

        let registry = ProviderRegistry::with_settings(&settings).await.unwrap();
        let npm_info = registry.get_provider_info("npm").expect("npm must exist");
        assert!(!npm_info.enabled, "disabled providers must remain visible");
    }
}
