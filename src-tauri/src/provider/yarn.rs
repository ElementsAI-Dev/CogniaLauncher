use super::api::{get_api_client, DEFAULT_NPM_REGISTRY};
use super::node_base::{
    parse_dependency_constraints_from_json_output, parse_node_list_json_line,
    parse_node_list_json_output,
};
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

    /// Parse a single JSON line from `yarn global list --json` into package entries.
    /// Supports both classic `data: "<tree text>"` and structured `data.trees` forms.
    fn parse_yarn_global_list_line(line: &str) -> Vec<(String, String)> {
        parse_node_list_json_line(line)
    }

    /// Detect and cache the Yarn major version (1 for Classic, 2+ for Berry)
    async fn get_major_version(&self) -> u32 {
        *self
            .major_version
            .get_or_init(|| async {
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
            })
            .await
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
        for (pkg_name, version) in parse_node_list_json_output(&output) {
            if pkg_name == name {
                return Ok(version);
            }
        }

        Err(CogniaError::Provider(format!("Package {} not found", name)))
    }

    /// Fetch dependencies via npm registry API (used as fallback for Berry)
    async fn get_dependencies_via_api(
        &self,
        name: &str,
        version: &str,
    ) -> CogniaResult<Vec<Dependency>> {
        let pkg_path = if version.is_empty() {
            format!("{}/latest", name)
        } else {
            format!("{}/{}", name, version)
        };

        let registry_url = self.registry_url.as_deref().unwrap_or(DEFAULT_NPM_REGISTRY);
        let url = format!("{}/{}", registry_url, pkg_path);

        let client = crate::platform::proxy::get_shared_client();

        let resp = client
            .get(&url)
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|err| {
                CogniaError::Provider(format!(
                    "failed to query yarn dependency metadata for {}: {}",
                    name, err
                ))
            })?;
        if !resp.status().is_success() {
            return Err(CogniaError::Provider(format!(
                "yarn dependency metadata request failed for {}: status {}",
                name,
                resp.status()
            )));
        }
        let json = resp.json::<serde_json::Value>().await.map_err(|err| {
            CogniaError::Provider(format!(
                "failed to parse yarn dependency metadata for {}: {}",
                name, err
            ))
        })?;

        let pairs = json
            .get("dependencies")
            .map(super::node_base::parse_dependency_constraints_from_value)
            .unwrap_or_default();
        Ok(pairs
            .into_iter()
            .map(|(dep_name, constraint)| Dependency {
                name: dep_name,
                constraint: constraint
                    .parse::<VersionConstraint>()
                    .unwrap_or(VersionConstraint::Any),
            })
            .collect())
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

        let pkg = if version.is_empty() {
            name.to_string()
        } else {
            format!("{}@{}", name, version)
        };
        let out = self
            .run_yarn(&["info", &pkg, "dependencies", "--json"])
            .await?;
        let pairs = parse_dependency_constraints_from_json_output(&out).map_err(|err| {
            CogniaError::Provider(format!(
                "failed to parse yarn dependencies for {}: {}",
                pkg, err
            ))
        })?;
        Ok(pairs
            .into_iter()
            .map(|(dep_name, constraint)| Dependency {
                name: dep_name,
                constraint: constraint
                    .parse::<VersionConstraint>()
                    .unwrap_or(VersionConstraint::Any),
            })
            .collect())
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

        let parsed = parse_node_list_json_output(&output);
        if !output.trim().is_empty() && parsed.is_empty() {
            log::warn!("yarn list installed parse produced no entries from non-empty output");
        }

        let packages = parsed
            .into_iter()
            .filter(|(pkg_name, _)| {
                filter
                    .name_filter
                    .as_ref()
                    .map(|needle| pkg_name.contains(needle))
                    .unwrap_or(true)
            })
            .map(|(pkg_name, version)| InstalledPackage {
                install_path: Self::get_global_dir().unwrap_or_default().join(&pkg_name),
                name: pkg_name,
                version,
                provider: self.id().into(),
                installed_at: String::new(),
                is_global: true,
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // For Yarn Berry or global package checking, use npm registry API
        // (Yarn Classic's `yarn outdated` only checks local project deps, not global)
        let installed = self
            .list_installed(InstalledFilter {
                global_only: true,
                name_filter: None,
            })
            .await
            .unwrap_or_default();

        let targets: Vec<&InstalledPackage> = if packages.is_empty() {
            installed.iter().collect()
        } else {
            installed
                .iter()
                .filter(|p| packages.contains(&p.name))
                .collect()
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
                "Yarn Berry (v2+) does not support global packages. Use npm or pnpm for upgrades."
                    .into(),
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
        let provider = YarnProvider::new().with_registry("https://registry.npmmirror.com");

        assert_eq!(
            provider.registry_url,
            Some("https://registry.npmmirror.com".to_string())
        );
    }

    #[test]
    fn test_build_yarn_args() {
        let provider = YarnProvider::new().with_registry("https://registry.npmmirror.com");

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

    #[test]
    fn test_provider_metadata() {
        let provider = YarnProvider::new();
        assert_eq!(provider.id(), "yarn");
        assert_eq!(provider.display_name(), "Yarn (Node.js Package Manager)");
        assert_eq!(provider.priority(), 84);
    }

    #[test]
    fn test_capabilities() {
        let provider = YarnProvider::new();
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
        let provider = YarnProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_yarn_no_registry() {
        let provider = YarnProvider::new();
        let args = provider.build_yarn_args(&["add", "lodash"]);
        assert_eq!(args, vec!["add".to_string(), "lodash".to_string()]);
    }

    #[test]
    fn test_default_impl() {
        let _provider = YarnProvider::default();
    }

    #[test]
    fn test_parse_yarn_global_list_line_tree_text() {
        let line = r#"{"type":"tree","data":"├── lodash@4.17.21\n└── @types/node@22.10.1\nC:\\Users\\Max\\node_modules (174)"}"#;
        let entries = YarnProvider::parse_yarn_global_list_line(line);
        assert_eq!(entries.len(), 2);
        assert!(entries.contains(&("lodash".to_string(), "4.17.21".to_string())));
        assert!(entries.contains(&("@types/node".to_string(), "22.10.1".to_string())));
    }

    #[test]
    fn test_parse_yarn_global_list_line_trees_array() {
        let line = r#"{"type":"tree","data":{"trees":[{"name":"lodash@4.17.21"},{"name":"@types/node@22.10.1"}]}}"#;
        let entries = YarnProvider::parse_yarn_global_list_line(line);
        assert_eq!(entries.len(), 2);
        assert!(entries.contains(&("lodash".to_string(), "4.17.21".to_string())));
        assert!(entries.contains(&("@types/node".to_string(), "22.10.1".to_string())));
    }

    #[test]
    fn test_parse_yarn_global_list_line_comma_separated_tree_text() {
        let line = r#"{"type":"tree","data":"lodash@4.17.21, @types/node@22.10.1, C:\\Users\\Max\\node_modules (174)"}"#;
        let entries = YarnProvider::parse_yarn_global_list_line(line);
        assert_eq!(entries.len(), 2);
        assert!(entries.contains(&("lodash".to_string(), "4.17.21".to_string())));
        assert!(entries.contains(&("@types/node".to_string(), "22.10.1".to_string())));
    }

    #[test]
    fn test_parse_yarn_dependency_payload_from_stringified_data() {
        let output = r#"{"type":"inspect","data":"{\"dependencies\":{\"chalk\":\"^5.3.0\"}}"}"#;
        let deps = parse_dependency_constraints_from_json_output(output).unwrap();

        assert_eq!(deps, vec![("chalk".to_string(), "^5.3.0".to_string())]);
    }

    #[test]
    fn test_parse_yarn_global_list_multi_line_output_via_shared_parser() {
        let output = r#"{"type":"tree","data":"├── lodash@4.17.21"}
{"type":"tree","data":{"trees":[{"name":"@types/node@22.10.1"}]}}"#;
        let entries = parse_node_list_json_output(output);

        assert_eq!(entries.len(), 2);
        assert!(entries.contains(&("lodash".to_string(), "4.17.21".to_string())));
        assert!(entries.contains(&("@types/node".to_string(), "22.10.1".to_string())));
    }
}
