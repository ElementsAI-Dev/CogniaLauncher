use super::api::get_api_client;
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

/// npm - Node Package Manager
///
/// Supports custom npm registry configuration via `--registry` flag.
pub struct NpmProvider {
    /// Custom registry URL (replaces default npm registry)
    registry_url: Option<String>,
}

impl NpmProvider {
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

    /// Update the registry URL at runtime
    pub fn set_registry_url(&mut self, url: Option<String>) {
        self.registry_url = url;
    }

    /// Build npm arguments with registry configuration
    fn build_npm_args<'a>(&'a self, base_args: &[&'a str]) -> Vec<String> {
        let mut args: Vec<String> = base_args.iter().map(|s| s.to_string()).collect();
        
        if let Some(ref url) = self.registry_url {
            args.push(format!("--registry={}", url));
        }
        
        args
    }

    async fn run_npm(&self, args: &[&str]) -> CogniaResult<String> {
        let full_args = self.build_npm_args(args);
        let args_refs: Vec<&str> = full_args.iter().map(|s| s.as_str()).collect();
        
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("npm", &args_refs, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Run npm without registry arguments (for commands that don't need them)
    async fn run_npm_raw(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("npm", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    fn get_global_prefix(&self) -> Option<PathBuf> {
        if cfg!(windows) {
            std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("npm").join("node_modules"))
        } else {
            Some(PathBuf::from("/usr/local/lib/node_modules"))
        }
    }

    /// Get the installed version of a package
    async fn get_package_version(&self, name: &str, global: bool) -> CogniaResult<String> {
        let args = if global {
            vec!["list", "-g", name, "--depth=0", "--json"]
        } else {
            vec!["list", name, "--depth=0", "--json"]
        };

        let out = self.run_npm_raw(&args).await?;

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            // Try to find the package in dependencies
            if let Some(deps) = json["dependencies"].as_object() {
                if let Some(pkg_info) = deps.get(name) {
                    if let Some(version) = pkg_info["version"].as_str() {
                        return Ok(version.to_string());
                    }
                }
            }
        }

        Err(CogniaError::Provider(format!("Could not determine version for {}", name)))
    }
}

impl Default for NpmProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for NpmProvider {
    fn id(&self) -> &str {
        "npm"
    }
    fn display_name(&self) -> &str {
        "npm (Node Package Manager)"
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
        85
    }

    async fn is_available(&self) -> bool {
        // Check if npm exists and is actually executable
        if process::which("npm").await.is_none() {
            return false;
        }
        // Verify npm works by running --version
        match process::execute("npm", &["--version"], None).await {
            Ok(output) => output.success && !output.stdout.is_empty(),
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let api = get_api_client();

        // Use npm registry API for faster and more reliable search
        if let Ok(packages) = api.search_npm(query, limit).await {
            return Ok(packages
                .into_iter()
                .map(|p| PackageSummary {
                    name: p.name,
                    description: p.description,
                    latest_version: Some(p.version),
                    provider: self.id().into(),
                })
                .collect());
        }

        // Fallback to npm CLI with timeout
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(30));
        let out = process::execute("npm", &["search", query, "--json"], Some(opts)).await;

        if let Ok(result) = out {
            if result.success {
                if let Ok(packages) = serde_json::from_str::<Vec<serde_json::Value>>(&result.stdout)
                {
                    return Ok(packages
                        .iter()
                        .take(limit)
                        .filter_map(|p| {
                            Some(PackageSummary {
                                name: p["name"].as_str()?.into(),
                                description: p["description"].as_str().map(|s| s.into()),
                                latest_version: p["version"].as_str().map(|s| s.into()),
                                provider: self.id().into(),
                            })
                        })
                        .collect());
                }
            }
        }

        Ok(vec![])
    }

    async fn get_dependencies(&self, name: &str, version: &str) -> CogniaResult<Vec<Dependency>> {
        let pkg = if version.is_empty() { name.to_string() } else { format!("{}@{}", name, version) };
        let out = self
            .run_npm(&["view", &pkg, "dependencies", "--json"])
            .await?;

        let value: serde_json::Value = serde_json::from_str(&out).unwrap_or(serde_json::Value::Null);
        let deps = value
            .as_object()
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
            .unwrap_or_default();

        Ok(deps)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_npm(&["view", name, "--json"]).await?;

        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&out) {
            let versions = if let Some(v) = pkg["versions"].as_array() {
                v.iter()
                    .filter_map(|ver| {
                        Some(VersionInfo {
                            version: ver.as_str()?.into(),
                            release_date: None,
                            deprecated: false,
                            yanked: false,
                        })
                    })
                    .collect()
            } else if let Some(v) = pkg["version"].as_str() {
                vec![VersionInfo {
                    version: v.into(),
                    release_date: None,
                    deprecated: pkg["deprecated"].as_str().is_some(),
                    yanked: false,
                }]
            } else {
                vec![]
            };

            let homepage = pkg["homepage"].as_str().map(|s| s.into());
            let repository = pkg["repository"]["url"]
                .as_str()
                .or_else(|| pkg["repository"].as_str())
                .map(|s| s.into());

            return Ok(PackageInfo {
                name: name.into(),
                display_name: pkg["name"].as_str().map(|s| s.into()),
                description: pkg["description"].as_str().map(|s| s.into()),
                homepage,
                license: pkg["license"].as_str().map(|s| s.into()),
                repository,
                versions,
                provider: self.id().into(),
            });
        }

        Err(CogniaError::Provider(format!("Package {} not found", name)))
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let out = self.run_npm(&["view", name, "versions", "--json"]).await?;

        if let Ok(versions) = serde_json::from_str::<Vec<String>>(&out) {
            return Ok(versions
                .into_iter()
                .map(|v| VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect());
        }

        if let Ok(version) = serde_json::from_str::<String>(&out) {
            return Ok(vec![VersionInfo {
                version,
                release_date: None,
                deprecated: false,
                yanked: false,
            }]);
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
            vec!["install", "-g", &pkg]
        } else {
            vec!["install", &pkg]
        };

        if req.force {
            args.push("--force");
        }

        self.run_npm(&args).await?;

        // Get the actual installed version by querying npm
        let actual_version = self
            .get_package_version(&req.name, req.global)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = if req.global {
            self.get_global_prefix().unwrap_or_default().join(&req.name)
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

    /// Get the installed version of a specific package
    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.get_package_version(name, true).await {
            Ok(v) => Ok(Some(v)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let mut args = vec!["uninstall", "-g", &req.name];
        if req.force {
            args.push("--force");
        }
        self.run_npm(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        // list doesn't need registry args
        let args = vec!["list", "-g", "--depth=0", "--json"];

        let out = self.run_npm_raw(&args).await?;

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            if let Some(deps) = json["dependencies"].as_object() {
                let packages: Vec<InstalledPackage> = deps
                    .iter()
                    .filter_map(|(name, info)| {
                        if let Some(name_filter) = &filter.name_filter {
                            if !name.contains(name_filter) {
                                return None;
                            }
                        }

                        let version = info["version"].as_str().unwrap_or("unknown").to_string();
                        let _resolved = info["resolved"].as_str().unwrap_or("");

                        Some(InstalledPackage {
                            name: name.clone(),
                            version,
                            provider: self.id().into(),
                            install_path: self.get_global_prefix().unwrap_or_default().join(name),
                            installed_at: String::new(),
                            is_global: true,
                        })
                    })
                    .collect();

                return Ok(packages);
            }
        }

        Ok(vec![])
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // npm outdated returns exit code 1 when packages are outdated (not an error)
        // So we must read stdout directly instead of using run_npm_raw which treats non-zero as error
        let result = process::execute("npm", &["outdated", "-g", "--json"], None).await;

        let out_str = match result {
            Ok(output) => {
                // exit code 0 = no outdated packages, exit code 1 = has outdated packages
                // Both cases have valid JSON in stdout
                if output.stdout.trim().is_empty() {
                    return Ok(vec![]);
                }
                output.stdout
            }
            Err(_) => return Ok(vec![]),
        };

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out_str) {
            if let Some(obj) = json.as_object() {
                let updates: Vec<UpdateInfo> = obj
                    .iter()
                    .filter_map(|(name, info)| {
                        if !packages.is_empty() && !packages.contains(name) {
                            return None;
                        }

                        let current = info["current"].as_str()?;
                        let latest = info["latest"].as_str()?;

                        if current != latest {
                            Some(UpdateInfo {
                                name: name.clone(),
                                current_version: current.into(),
                                latest_version: latest.into(),
                                provider: self.id().into(),
                            })
                        } else {
                            None
                        }
                    })
                    .collect();

                return Ok(updates);
            }
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for NpmProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_npm_raw(&["--version"]).await?;
        Ok(output.trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("npm")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("npm not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Node.js from https://nodejs.org which includes npm".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        // list doesn't need registry args
        let out = self.run_npm_raw(&["list", "-g", name, "--depth=0"]).await;
        Ok(out.map(|s| s.contains(name)).unwrap_or(false))
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_npm(&["update", "-g", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        self.run_npm_raw(&["update", "-g"]).await?;
        Ok(vec!["All global npm packages upgraded".into()])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_npm_provider_builder() {
        let provider = NpmProvider::new()
            .with_registry("https://registry.npmmirror.com");
        
        assert_eq!(provider.registry_url, Some("https://registry.npmmirror.com".to_string()));
    }

    #[test]
    fn test_build_npm_args() {
        let provider = NpmProvider::new()
            .with_registry("https://registry.npmmirror.com");
        
        let args = provider.build_npm_args(&["install", "lodash"]);
        
        assert!(args.contains(&"install".to_string()));
        assert!(args.contains(&"lodash".to_string()));
        assert!(args.contains(&"--registry=https://registry.npmmirror.com".to_string()));
    }

    #[test]
    fn test_npm_provider_no_mirror() {
        let provider = NpmProvider::new();
        let args = provider.build_npm_args(&["install", "lodash"]);
        
        assert_eq!(args, vec!["install".to_string(), "lodash".to_string()]);
    }

    #[test]
    fn test_npm_capabilities_include_upgrade() {
        let provider = NpmProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Upgrade));
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Update));
    }

    #[test]
    fn test_npm_global_prefix_includes_node_modules() {
        let provider = NpmProvider::new();
        if let Some(prefix) = provider.get_global_prefix() {
            if cfg!(windows) {
                assert!(prefix.to_string_lossy().contains("node_modules"));
            }
        }
    }
}
