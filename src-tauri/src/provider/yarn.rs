use super::api::{get_api_client, DEFAULT_NPM_REGISTRY};
use super::node_base::split_name_version;
use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use crate::resolver::{Dependency, VersionConstraint};
use async_trait::async_trait;
use reqwest::Client;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;
use tokio::sync::OnceCell;

/// Yarn package manager for Node.js
///
/// Supports both Yarn Classic (v1) and Yarn Berry (v2+/v4+).
/// Yarn Berry removed `yarn global` — global package operations are
/// only available on Yarn Classic.
pub struct YarnProvider {
    /// Custom registry URL
    registry_url: Option<String>,
    /// Cached major version (detected lazily)
    major_version: OnceCell<u32>,
}

impl YarnProvider {
    pub fn new() -> Self {
        Self {
            registry_url: None,
            major_version: OnceCell::new(),
        }
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

    /// Build yarn arguments with registry configuration
    fn build_yarn_args<'a>(&'a self, base_args: &[&'a str]) -> Vec<String> {
        let mut args: Vec<String> = base_args.iter().map(|s| s.to_string()).collect();
        
        if let Some(ref url) = self.registry_url {
            args.push(format!("--registry={}", url));
        }
        
        args
    }

    async fn run_yarn(&self, args: &[&str]) -> CogniaResult<String> {
        let full_args = self.build_yarn_args(args);
        let args_refs: Vec<&str> = full_args.iter().map(|s| s.as_str()).collect();
        
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("yarn", &args_refs, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    async fn run_yarn_raw(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("yarn", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    fn get_global_dir() -> Option<PathBuf> {
        if cfg!(windows) {
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("Yarn").join("Data").join("global"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".yarn").join("global"))
        }
    }

    /// Detect and cache the Yarn major version (1 for Classic, 2+ for Berry)
    async fn get_major_version(&self) -> u32 {
        *self.major_version.get_or_init(|| async {
            let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
            match process::execute("yarn", &["--version"], Some(opts)).await {
                Ok(output) if output.success => {
                    let version_str = output.stdout.trim();
                    version_str
                        .split('.')
                        .next()
                        .and_then(|s| s.parse::<u32>().ok())
                        .unwrap_or(1)
                }
                _ => 1,
            }
        }).await
    }

    /// Check if this is Yarn Berry (v2+)
    async fn is_berry(&self) -> bool {
        self.get_major_version().await >= 2
    }

    /// Get the installed version of a global package (Yarn Classic only)
    async fn get_package_version(&self, name: &str, global: bool) -> CogniaResult<String> {
        if global && self.is_berry().await {
            return Err(CogniaError::Provider(
                "Yarn Berry (v2+) does not support global packages".into(),
            ));
        }

        let args = if global {
            vec!["global", "list", "--depth=0", "--json"]
        } else {
            vec!["list", "--depth=0", "--json"]
        };
        
        let output = self.run_yarn_raw(&args).await?;
        
        // Parse yarn list output to find the package
        for line in output.lines() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(data) = json.get("data") {
                    if let Some(trees) = data.as_str() {
                        for part in trees.split(',') {
                            let part = part.trim();
                            let (pkg_name, pkg_version) = split_name_version(part);
                            if pkg_name == name {
                                if let Some(v) = pkg_version {
                                    return Ok(v.trim().to_string());
                                }
                            }
                        }
                    }
                    if let Some(trees) = data.get("trees").and_then(|t| t.as_array()) {
                        for tree in trees {
                            if let Some(tree_name) = tree.get("name").and_then(|n| n.as_str()) {
                                let (pkg_name, pkg_version) = split_name_version(tree_name);
                                if pkg_name == name {
                                    if let Some(v) = pkg_version {
                                        return Ok(v.trim().to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Err(CogniaError::Provider(format!("Package {} not found", name)))
    }

    /// Fetch dependencies via npm registry API (used as fallback for Berry)
    async fn get_dependencies_via_api(&self, name: &str, version: &str) -> CogniaResult<Vec<Dependency>> {
        let pkg_path = if version.is_empty() {
            format!("{}/latest", name)
        } else {
            format!("{}/{}", name, version)
        };

        let registry_url = self.registry_url
            .as_deref()
            .unwrap_or(DEFAULT_NPM_REGISTRY);
        let url = format!("{}/{}", registry_url, pkg_path);

        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .map_err(|e| CogniaError::Provider(e.to_string()))?;

        if let Ok(resp) = client.get(&url).send().await {
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
}

impl Default for YarnProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for YarnProvider {
    fn id(&self) -> &str {
        "yarn"
    }

    fn display_name(&self) -> &str {
        "Yarn (Node.js Package Manager)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
            Capability::LockVersion,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        84
    }

    async fn is_available(&self) -> bool {
        system_detection::is_command_available("yarn", &["--version"]).await
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let api = get_api_client();

        // Use npm registry API (Yarn uses the same registry)
        match api.search_npm(query, limit).await {
            Ok(packages) => Ok(packages
                .into_iter()
                .map(|p| PackageSummary {
                    name: p.name,
                    description: p.description,
                    latest_version: Some(p.version),
                    provider: self.id().into(),
                })
                .collect()),
            Err(_) => Ok(vec![]),
        }
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let api = get_api_client();

        match api.get_npm_package(name).await {
            Ok(pkg) => {
                let _latest = pkg.dist_tags.get("latest").cloned();
                Ok(PackageInfo {
                    name: pkg.name.clone(),
                    display_name: Some(pkg.name),
                    description: pkg.description,
                    homepage: pkg.homepage,
                    license: pkg.license,
                    repository: pkg.repository,
                    versions: pkg
                        .versions
                        .into_iter()
                        .map(|v| VersionInfo {
                            version: v,
                            release_date: None,
                            deprecated: false,
                            yanked: false,
                        })
                        .collect(),
                    provider: self.id().into(),
                })
            }
            Err(e) => Err(e),
        }
    }

    async fn get_dependencies(&self, name: &str, version: &str) -> CogniaResult<Vec<Dependency>> {
        // Yarn Berry uses `yarn npm info` instead of `yarn info`
        if self.is_berry().await {
            return self.get_dependencies_via_api(name, version).await;
        }

        let pkg = if version.is_empty() { name.to_string() } else { format!("{}@{}", name, version) };
        let out = self.run_yarn(&["info", &pkg, "dependencies", "--json"]).await?;

        let value: serde_json::Value = serde_json::from_str(&out).unwrap_or(serde_json::Value::Null);
        let data = value.get("data").cloned().unwrap_or(value);
        let parsed = if let Some(data_str) = data.as_str() {
            serde_json::from_str::<serde_json::Value>(data_str).unwrap_or(serde_json::Value::Null)
        } else {
            data
        };

        let deps_obj = parsed
            .get("dependencies")
            .and_then(|deps| deps.as_object())
            .or_else(|| parsed.as_object());

        let deps = deps_obj
            .map(|obj| {
                obj.iter()
                    .filter_map(|(dep_name, constraint)| {
                        let constraint_str = constraint.as_str()?;
                        let parsed = constraint_str
                            .parse::<VersionConstraint>()
                            .unwrap_or(VersionConstraint::Any);
                        Some(Dependency {
                            name: dep_name.to_string(),
                            constraint: parsed,
                        })
                    })
                    .collect()
            })
            .unwrap_or_else(Vec::new);

        Ok(deps)
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let api = get_api_client();

        match api.get_npm_package(name).await {
            Ok(pkg) => Ok(pkg
                .versions
                .into_iter()
                .map(|v| VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect()),
            Err(e) => Err(e),
        }
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        if req.global && self.is_berry().await {
            return Err(CogniaError::Provider(
                "Yarn Berry (v2+) does not support global packages. Use npm or pnpm for global installs.".into(),
            ));
        }

        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            req.name.clone()
        };

        let mut args = if req.global {
            vec!["global", "add", &pkg]
        } else {
            vec!["add", &pkg]
        };

        if req.force {
            args.push("--force");
        }

        self.run_yarn(&args).await?;

        let actual_version = self
            .get_package_version(&req.name, req.global)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = if req.global {
            Self::get_global_dir().unwrap_or_default().join(&req.name)
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
        if self.is_berry().await {
            return Err(CogniaError::Provider(
                "Yarn Berry (v2+) does not support global packages. Use npm or pnpm for global uninstalls.".into(),
            ));
        }

        let mut args = vec!["global", "remove", &req.name];
        if req.force {
            args.push("--force");
        }
        self.run_yarn(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        if self.is_berry().await {
            return Ok(vec![]);
        }

        let output = self.run_yarn_raw(&["global", "list", "--json"]).await?;

        let mut packages = Vec::new();

        // Parse yarn global list output
        for line in output.lines() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(data) = json.get("data") {
                    if let Some(trees) = data.as_str() {
                        // Parse package names from tree output
                        for part in trees.split(',') {
                            let part = part.trim();
                            if part.is_empty() {
                                continue;
                            }
                            let (pkg_name, pkg_version) = split_name_version(part);
                            if pkg_name.is_empty() {
                                continue;
                            }

                            if let Some(ref name_filter) = filter.name_filter {
                                if !pkg_name.contains(name_filter) {
                                    continue;
                                }
                            }

                            packages.push(InstalledPackage {
                                name: pkg_name.to_string(),
                                version: pkg_version.unwrap_or("unknown").to_string(),
                                provider: self.id().into(),
                                install_path: Self::get_global_dir()
                                    .unwrap_or_default()
                                    .join(pkg_name),
                                installed_at: String::new(),
                                is_global: true,
                            });
                        }
                    }
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // For Yarn Berry or global package checking, use npm registry API
        // (Yarn Classic's `yarn outdated` only checks local project deps, not global)
        let installed = self.list_installed(InstalledFilter {
            global_only: true,
            name_filter: None,
        }).await.unwrap_or_default();

        let targets: Vec<&InstalledPackage> = if packages.is_empty() {
            installed.iter().collect()
        } else {
            installed.iter().filter(|p| packages.contains(&p.name)).collect()
        };

        let mut updates = Vec::new();
        let api = get_api_client();

        for pkg in targets {
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
impl SystemPackageProvider for YarnProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_yarn_raw(&["--version"]).await?;
        Ok(output.trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("yarn")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("yarn not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Yarn: npm install -g yarn or corepack enable yarn".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        if self.is_berry().await {
            return Ok(false);
        }
        let out = self.run_yarn_raw(&["global", "list", "--depth=0"]).await;
        Ok(out.map(|s| s.contains(name)).unwrap_or(false))
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        if self.is_berry().await {
            return Err(CogniaError::Provider(
                "Yarn Berry (v2+) does not support global packages. Use npm or pnpm for upgrades.".into(),
            ));
        }
        self.run_yarn(&["global", "upgrade", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        if self.is_berry().await {
            return Err(CogniaError::Provider(
                "Yarn Berry (v2+) does not support global packages.".into(),
            ));
        }
        self.run_yarn_raw(&["global", "upgrade"]).await?;
        Ok(vec!["All global yarn packages upgraded".into()])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_yarn_provider_builder() {
        let provider = YarnProvider::new()
            .with_registry("https://registry.npmmirror.com");
        
        assert_eq!(provider.registry_url, Some("https://registry.npmmirror.com".to_string()));
    }

    #[test]
    fn test_build_yarn_args() {
        let provider = YarnProvider::new()
            .with_registry("https://registry.npmmirror.com");
        
        let args = provider.build_yarn_args(&["add", "lodash"]);
        
        assert!(args.contains(&"add".to_string()));
        assert!(args.contains(&"lodash".to_string()));
        assert!(args.contains(&"--registry=https://registry.npmmirror.com".to_string()));
    }

    #[test]
    fn test_yarn_default_version() {
        let provider = YarnProvider::new();
        // major_version is lazily initialized, default state is unset
        assert!(provider.major_version.get().is_none());
    }
}
