use super::api::get_api_client;
use super::node_base::parse_node_list_entry;
use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use crate::resolver::{Dependency, VersionConstraint};
use async_trait::async_trait;

use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

/// Bun - Fast JavaScript runtime and package manager
///
/// Bun is a fast all-in-one JavaScript runtime that includes a package manager
/// compatible with npm. It supports custom registry configuration via the
/// `--registry` flag for install commands.
pub struct BunProvider {
    /// Custom registry URL (replaces default npm registry)
    registry_url: Option<String>,
}

impl BunProvider {
    pub fn new() -> Self {
        Self { registry_url: None }
    }

    /// Set the registry URL
    pub fn with_registry(mut self, url: impl Into<String>) -> Self {
        self.registry_url = Some(url.into());
        self
    }

    /// Set the registry URL from an Option
    pub fn with_registry_opt(mut self, url: Option<String>) -> Self {
        self.registry_url = url;
        self
    }

    /// Build bun arguments with registry configuration
    fn build_bun_args<'a>(&'a self, base_args: &[&'a str]) -> Vec<String> {
        let mut args: Vec<String> = base_args.iter().map(|s| s.to_string()).collect();

        if let Some(ref url) = self.registry_url {
            args.push(format!("--registry={}", url));
        }

        args
    }

    async fn run_bun(&self, args: &[&str]) -> CogniaResult<String> {
        let full_args = self.build_bun_args(args);
        let args_refs: Vec<&str> = full_args.iter().map(|s| s.as_str()).collect();

        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("bun", &args_refs, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    /// Run bun without registry arguments (for commands that don't need them)
    async fn run_bun_raw(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("bun", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    fn get_global_dir_fallback() -> Option<PathBuf> {
        if cfg!(windows) {
            std::env::var("USERPROFILE")
                .ok()
                .map(|p| PathBuf::from(p).join(".bun").join("install").join("global"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".bun").join("install").join("global"))
        }
    }

    /// Detect global directory dynamically via `bun pm bin -g`, falling back to default path.
    async fn get_global_dir(&self) -> Option<PathBuf> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        if let Ok(output) = process::execute("bun", &["pm", "bin", "-g"], Some(opts)).await {
            if output.success {
                let bin_dir = output.stdout.trim();
                if !bin_dir.is_empty() {
                    if let Some(parent) = PathBuf::from(bin_dir).parent() {
                        return Some(parent.to_path_buf());
                    }
                }
            }
        }
        Self::get_global_dir_fallback()
    }

    /// Get the installed version of a package using bun pm ls
    async fn get_package_version(&self, name: &str, global: bool) -> CogniaResult<String> {
        let args = if global {
            vec!["pm", "ls", "-g"]
        } else {
            vec!["pm", "ls"]
        };

        let output = self.run_bun_raw(&args).await?;

        // Parse bun pm ls output: package@version format
        for line in output.lines() {
            if let Some((pkg_name, version)) = Self::parse_pm_ls_entry(line) {
                // Use exact match to avoid prefix false positives (e.g., "react" vs "react-dom")
                if pkg_name == name {
                    return Ok(version);
                }
            }
        }

        Err(CogniaError::Provider(format!("Package {} not found", name)))
    }

    /// Parse one line of `bun pm ls` / `bun pm ls -g` output into (name, version).
    ///
    /// Bun output may contain non-package lines such as:
    /// - `bun pm ls v1.1.34`
    /// - `C:\Users\foo\.bun\install\global\node_modules (174)`
    /// - tree drawing characters / metadata annotations
    ///
    /// This parser only accepts tokens that clearly match `name@version`
    /// (including scoped packages like `@scope/name@1.2.3`).
    fn parse_pm_ls_entry(line: &str) -> Option<(String, String)> {
        parse_node_list_entry(line)
    }
}

impl Default for BunProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for BunProvider {
    fn id(&self) -> &str {
        "bun"
    }

    fn display_name(&self) -> &str {
        "Bun (Fast JavaScript Runtime)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        92 // Higher than npm (90) since bun is faster
    }

    async fn is_available(&self) -> bool {
        system_detection::is_command_available("bun", &["--version"]).await
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // Bun uses npm registry for packages, so we use the npm API
        let api = get_api_client();
        let limit = options.limit.unwrap_or(20);

        let packages = api.search_npm(query, limit).await?;

        Ok(packages
            .into_iter()
            .map(|p| PackageSummary {
                name: p.name,
                description: p.description,
                latest_version: Some(p.version),
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let api = get_api_client();
        let info = api.get_npm_package(name).await?;

        let versions: Vec<VersionInfo> = info
            .versions
            .into_iter()
            .map(|v| VersionInfo {
                version: v,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        Ok(PackageInfo {
            name: info.name,
            display_name: None,
            description: info.description,
            homepage: info.homepage,
            license: info.license,
            repository: info.repository,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let api = get_api_client();
        let info = api.get_npm_package(name).await?;

        Ok(info
            .versions
            .into_iter()
            .map(|v| VersionInfo {
                version: v,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn get_dependencies(&self, name: &str, version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use npm registry API since bun uses the same registry
        // Fetch the specific version's dependencies via the registry
        let pkg = if version.is_empty() {
            format!("{}/latest", name)
        } else {
            format!("{}/{}", name, version)
        };

        // Use provider's configured registry or default
        let registry_url = self
            .registry_url
            .as_deref()
            .unwrap_or(super::api::DEFAULT_NPM_REGISTRY);
        let url = format!("{}/{}", registry_url, pkg);

        let client = crate::platform::proxy::get_shared_client();

        if let Ok(resp) = client
            .get(&url)
            .timeout(Duration::from_secs(10))
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(deps) = json["dependencies"].as_object() {
                        return Ok(deps
                            .iter()
                            .filter_map(|(dep_name, constraint_val)| {
                                let constraint_str = constraint_val.as_str()?;
                                let parsed = constraint_str
                                    .parse::<VersionConstraint>()
                                    .unwrap_or(VersionConstraint::Any);
                                Some(Dependency {
                                    name: dep_name.to_string(),
                                    constraint: parsed,
                                })
                            })
                            .collect());
                    }
                }
            }
        }
        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            req.name.clone()
        };

        let mut args = if req.global {
            vec!["add", "-g", &pkg]
        } else {
            vec!["add", &pkg]
        };

        if req.force {
            args.push("--force");
        }

        self.run_bun(&args).await?;

        // Get the actual installed version
        let actual_version = self
            .get_package_version(&req.name, req.global)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = if req.global {
            self.get_global_dir().await.unwrap_or_default().join(&req.name)
        } else {
            PathBuf::from("node_modules").join(&req.name)
        };

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.get_package_version(name, true).await {
            Ok(v) => Ok(Some(v)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let mut args = vec!["remove", "-g", &req.name];
        if req.force {
            args.push("--force");
        }
        self.run_bun_raw(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let args = if filter.global_only {
            vec!["pm", "ls", "-g"]
        } else {
            vec!["pm", "ls"]
        };

        let output = self.run_bun_raw(&args).await?;
        let mut packages = Vec::new();

        for line in output.lines() {
            let Some((pkg_name, version)) = Self::parse_pm_ls_entry(line) else {
                continue;
            };

            if let Some(ref name_filter) = filter.name_filter {
                if !pkg_name.contains(name_filter) {
                    continue;
                }
            }

            // Determine install path based on global or local
            let install_path = if filter.global_only {
                self.get_global_dir().await
                    .map(|p| p.join("node_modules").join(&pkg_name))
                    .unwrap_or_default()
            } else {
                PathBuf::from("node_modules").join(&pkg_name)
            };

            packages.push(InstalledPackage {
                name: pkg_name,
                version: version.to_string(),
                provider: self.id().into(),
                install_path,
                installed_at: String::new(),
                is_global: filter.global_only,
            });
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        // Get all globally installed packages to compare
        let installed = self
            .list_installed(InstalledFilter {
                global_only: true,
                name_filter: None,
            })
            .await
            .unwrap_or_default();

        // Filter to requested packages or all if empty
        let targets: Vec<&InstalledPackage> = if packages.is_empty() {
            installed.iter().collect()
        } else {
            installed
                .iter()
                .filter(|p| packages.contains(&p.name))
                .collect()
        };

        for pkg in targets {
            // Use npm registry API to get latest version (more efficient than per-package CLI calls)
            let api = get_api_client();
            if let Ok(info) = api.get_npm_package(&pkg.name).await {
                if let Some(latest) = info.dist_tags.get("latest") {
                    if *latest != pkg.version {
                        updates.push(UpdateInfo {
                            name: pkg.name.clone(),
                            current_version: pkg.version.clone(),
                            latest_version: latest.clone(),
                            provider: self.id().into(),
                        });
                    }
                }
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl SystemPackageProvider for BunProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_bun_raw(&["--version"]).await?;
        Ok(output.trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("bun")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("bun not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Bun: curl -fsSL https://bun.sh/install | bash (Unix) or powershell -c \"irm bun.sh/install.ps1 | iex\" (Windows)".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let output = self.run_bun_raw(&["pm", "ls", "-g"]).await;
        Ok(output.map(|s| s.contains(name)).unwrap_or(false))
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_bun(&["update", "-g", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        self.run_bun_raw(&["update", "-g"]).await?;
        Ok(vec!["All global bun packages upgraded".into()])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bun_provider_creation() {
        let provider = BunProvider::new();
        assert_eq!(provider.id(), "bun");
        assert_eq!(provider.display_name(), "Bun (Fast JavaScript Runtime)");
    }

    #[test]
    fn test_bun_provider_builder() {
        let provider = BunProvider::new().with_registry("https://registry.npmmirror.com");

        assert_eq!(
            provider.registry_url,
            Some("https://registry.npmmirror.com".to_string())
        );
    }

    #[test]
    fn test_build_bun_args() {
        let provider = BunProvider::new().with_registry("https://registry.npmmirror.com");

        let args = provider.build_bun_args(&["add", "lodash"]);

        assert_eq!(
            args,
            vec![
                "add".to_string(),
                "lodash".to_string(),
                "--registry=https://registry.npmmirror.com".to_string()
            ]
        );
    }

    #[test]
    fn test_build_bun_args_no_registry() {
        let provider = BunProvider::new();

        let args = provider.build_bun_args(&["add", "lodash"]);

        assert_eq!(args, vec!["add".to_string(), "lodash".to_string()]);
    }

    #[test]
    fn test_capabilities() {
        let provider = BunProvider::new();
        let caps = provider.capabilities();

        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
    }

    #[test]
    fn test_supported_platforms() {
        let provider = BunProvider::new();
        let platforms = provider.supported_platforms();

        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_priority() {
        let provider = BunProvider::new();
        assert_eq!(provider.priority(), 92);
    }

    #[test]
    fn test_parse_pm_ls_entry_unscoped_package() {
        let parsed = BunProvider::parse_pm_ls_entry("├── eslint@9.17.0");
        assert_eq!(parsed, Some(("eslint".to_string(), "9.17.0".to_string())));
    }

    #[test]
    fn test_parse_pm_ls_entry_scoped_package() {
        let parsed = BunProvider::parse_pm_ls_entry("└── @types/node@22.10.1");
        assert_eq!(
            parsed,
            Some(("@types/node".to_string(), "22.10.1".to_string()))
        );
    }

    #[test]
    fn test_parse_pm_ls_entry_ignores_root_path_line() {
        let parsed = BunProvider::parse_pm_ls_entry("C:\\Users\\Max Qian\\node_modules (174)");
        assert_eq!(parsed, None);
    }

    #[test]
    fn test_parse_pm_ls_entry_ignores_banner_line() {
        let parsed = BunProvider::parse_pm_ls_entry("bun pm ls v1.1.34");
        assert_eq!(parsed, None);
    }

    #[test]
    fn test_parse_pm_ls_entry_uses_first_token_only() {
        let parsed = BunProvider::parse_pm_ls_entry("├── biome@1.9.4 (workspace root dependency)");
        assert_eq!(parsed, Some(("biome".to_string(), "1.9.4".to_string())));
    }
}
