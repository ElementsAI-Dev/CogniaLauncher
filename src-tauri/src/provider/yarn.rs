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

/// Yarn package manager for Node.js
///
/// Supports custom npm registry configuration via `--registry` flag.
pub struct YarnProvider {
    /// Custom registry URL
    registry_url: Option<String>,
}

impl YarnProvider {
    pub fn new() -> Self {
        Self {
            registry_url: None,
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
        process::which("yarn").await.is_some()
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
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            req.name.clone()
        };

        let args = if req.global {
            vec!["global", "add", &pkg]
        } else {
            vec!["add", &pkg]
        };

        self.run_yarn(&args).await?;

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
        let args = vec!["global", "remove", &req.name];
        self.run_yarn(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
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
                            if part.contains('@') {
                                let name = part.split('@').next().unwrap_or(part).trim();

                                if let Some(ref name_filter) = filter.name_filter {
                                    if !name.contains(name_filter) {
                                        continue;
                                    }
                                }

                                packages.push(InstalledPackage {
                                    name: name.to_string(),
                                    version: "unknown".to_string(),
                                    provider: self.id().into(),
                                    install_path: Self::get_global_dir()
                                        .unwrap_or_default()
                                        .join(name),
                                    installed_at: String::new(),
                                    is_global: true,
                                });
                            }
                        }
                    }
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let output = self.run_yarn_raw(&["outdated", "--json"]).await;

        let Ok(out_str) = output else {
            return Ok(vec![]);
        };

        let mut updates = Vec::new();
        for line in out_str.lines() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(data) = json.get("data") {
                    if let Some(body) = data.get("body") {
                        if let Some(arr) = body.as_array() {
                            for item in arr {
                                if let Some(pkg_arr) = item.as_array() {
                                    if pkg_arr.len() >= 4 {
                                        let name = pkg_arr[0].as_str().unwrap_or("").to_string();
                                        let current = pkg_arr[1].as_str().unwrap_or("").to_string();
                                        let latest = pkg_arr[3].as_str().unwrap_or("").to_string();

                                        if !name.is_empty() && current != latest {
                                            updates.push(UpdateInfo {
                                                name,
                                                current_version: current,
                                                latest_version: latest,
                                                provider: self.id().into(),
                                            });
                                        }
                                    }
                                }
                            }
                        }
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

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_yarn_raw(&["global", "list", "--depth=0"]).await;
        Ok(out.map(|s| s.contains(name)).unwrap_or(false))
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
}
