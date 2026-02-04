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
        
        let out = process::execute("npm", &args_refs, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Run npm without registry arguments (for commands that don't need them)
    async fn run_npm_raw(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("npm", args, None).await?;
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
                .map(|p| PathBuf::from(p).join("npm"))
        } else {
            Some(PathBuf::from("/usr/local/lib/node_modules"))
        }
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
        ])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }
    fn priority(&self) -> i32 {
        85
    }

    async fn is_available(&self) -> bool {
        process::which("npm").await.is_some()
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

        let args = if req.global {
            vec!["install", "-g", &pkg]
        } else {
            vec!["install", &pkg]
        };

        self.run_npm(&args).await?;

        let install_path = if req.global {
            self.get_global_prefix().unwrap_or_default()
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
        let args = vec!["uninstall", "-g", &req.name];
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
        // outdated doesn't need registry args
        let out = self.run_npm_raw(&["outdated", "-g", "--json"]).await;

        let out_str = match out {
            Ok(s) => s,
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

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        // list doesn't need registry args
        let out = self.run_npm_raw(&["list", "-g", name, "--depth=0"]).await;
        Ok(out.map(|s| s.contains(name)).unwrap_or(false))
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
}
