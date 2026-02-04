use super::api::get_api_client;
use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
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

    fn get_global_dir() -> Option<PathBuf> {
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
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        92 // Higher than npm (90) since bun is faster
    }

    async fn is_available(&self) -> bool {
        process::which("bun").await.is_some()
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

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            req.name.clone()
        };

        let args = if req.global {
            vec!["add", "-g", &pkg]
        } else {
            vec!["add", &pkg]
        };

        self.run_bun(&args).await?;

        let install_path = if req.global {
            Self::get_global_dir().unwrap_or_default()
        } else {
            PathBuf::from("node_modules").join(&req.name)
        };

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_default(),
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let args = if req.force {
            vec!["remove", &req.name]
        } else {
            vec!["remove", &req.name]
        };

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
            let line = line.trim();
            if line.is_empty() || line.starts_with("bun") {
                continue;
            }

            // Parse package@version format
            if let Some((name, version)) = line.rsplit_once('@') {
                let name = name.trim().to_string();
                let version = version.trim().to_string();

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        continue;
                    }
                }

                packages.push(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path: PathBuf::new(),
                    installed_at: String::new(),
                    is_global: filter.global_only,
                });
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        for name in packages {
            if let Ok(info) = self.get_package_info(name).await {
                if let Some(latest) = info.versions.first() {
                    // Get current version
                    let installed = self
                        .list_installed(InstalledFilter {
                            global_only: false,
                            name_filter: Some(name.clone()),
                        })
                        .await
                        .unwrap_or_default();

                    if let Some(pkg) = installed.first() {
                        if pkg.version != latest.version {
                            updates.push(UpdateInfo {
                                name: name.clone(),
                                current_version: pkg.version.clone(),
                                latest_version: latest.version.clone(),
                                provider: self.id().into(),
                            });
                        }
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
        let output = self.run_bun_raw(&["pm", "ls"]).await;
        Ok(output.map(|s| s.contains(name)).unwrap_or(false))
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
}
