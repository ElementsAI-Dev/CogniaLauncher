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

pub struct UvProvider;

impl UvProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_uv(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("uv", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    #[allow(dead_code)]
    #[allow(dead_code)]
    #[allow(dead_code)]
    #[allow(dead_code)]
    fn get_cache_dir() -> Option<PathBuf> {
        std::env::var("UV_CACHE_DIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                if cfg!(windows) {
                    std::env::var("LOCALAPPDATA")
                        .ok()
                        .map(|p| PathBuf::from(p).join("uv").join("cache"))
                } else {
                    std::env::var("HOME")
                        .ok()
                        .map(|h| PathBuf::from(h).join(".cache").join("uv"))
                }
            })
    }
}

impl Default for UvProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for UvProvider {
    fn id(&self) -> &str {
        "uv"
    }
    fn display_name(&self) -> &str {
        "uv (Fast Python Package Manager)"
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
        87
    } // Higher priority than pip

    async fn is_available(&self) -> bool {
        process::which("uv").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let api = get_api_client();

        // Try PyPI API first for exact match
        match api.search_pypi(query, limit).await {
            Ok(packages) if !packages.is_empty() => {
                return Ok(packages
                    .into_iter()
                    .map(|p| PackageSummary {
                        name: p.name,
                        description: p.summary,
                        latest_version: Some(p.version),
                        provider: self.id().into(),
                    })
                    .collect());
            }
            _ => {}
        }

        // Fallback to pip index versions with timeout
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        let out = process::execute("pip", &["index", "versions", query], Some(opts)).await;

        if let Ok(result) = out {
            if result.success && !result.stdout.is_empty() {
                let first_line = result.stdout.lines().next().unwrap_or("");
                if first_line.to_lowercase().contains(&query.to_lowercase()) {
                    return Ok(vec![PackageSummary {
                        name: query.into(),
                        description: None,
                        latest_version: first_line
                            .split_whitespace()
                            .last()
                            .map(|s| s.trim_matches(|c| c == '(' || c == ')').into()),
                        provider: self.id().into(),
                    }]);
                }
            }
        }

        // Return empty if nothing found
        Ok(vec![])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let api = get_api_client();

        // Try PyPI API first
        if let Ok(pkg) = api.get_pypi_package(name).await {
            let versions: Vec<VersionInfo> = pkg
                .releases
                .into_iter()
                .filter(|v| !v.is_empty())
                .map(|v| VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect();

            return Ok(PackageInfo {
                name: pkg.name.clone(),
                display_name: Some(pkg.name),
                description: pkg.summary,
                homepage: pkg
                    .homepage
                    .or_else(|| Some(format!("https://pypi.org/project/{}/", name))),
                license: pkg.license,
                repository: None,
                versions: if versions.is_empty() {
                    vec![VersionInfo {
                        version: pkg.version,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }]
                } else {
                    versions
                },
                provider: self.id().into(),
            });
        }

        // Fallback to pip show
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        let out = process::execute("pip", &["show", name], Some(opts)).await;

        let mut description = None;
        let mut version = None;
        let mut homepage = None;
        let mut license = None;

        if let Ok(result) = out {
            if result.success {
                for line in result.stdout.lines() {
                    if let Some(stripped) = line.strip_prefix("Version:") {
                        version = Some(stripped.trim().into());
                    } else if let Some(stripped) = line.strip_prefix("Summary:") {
                        description = Some(stripped.trim().into());
                    } else if let Some(stripped) = line.strip_prefix("Home-page:") {
                        let hp = stripped.trim();
                        if !hp.is_empty() && hp != "UNKNOWN" {
                            homepage = Some(hp.into());
                        }
                    } else if let Some(stripped) = line.strip_prefix("License:") {
                        let lic = stripped.trim();
                        if !lic.is_empty() && lic != "UNKNOWN" {
                            license = Some(lic.into());
                        }
                    }
                }
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage: homepage.or_else(|| Some(format!("https://pypi.org/project/{}/", name))),
            license,
            repository: None,
            versions: version
                .map(|v| {
                    vec![VersionInfo {
                        version: v,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }]
                })
                .unwrap_or_default(),
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Use pip index versions
        let out = process::execute("pip", &["index", "versions", name], None).await;

        if let Ok(result) = out {
            if result.success {
                // Parse output like: package (version1, version2, ...)
                let stdout = result.stdout;
                if let Some(start) = stdout.find('(') {
                    if let Some(end) = stdout.find(')') {
                        let versions_str = &stdout[start + 1..end];
                        return Ok(versions_str
                            .split(',')
                            .map(|v| VersionInfo {
                                version: v.trim().into(),
                                release_date: None,
                                deprecated: false,
                                yanked: false,
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
            format!("{}=={}", req.name, v)
        } else {
            req.name.clone()
        };

        self.run_uv(&["pip", "install", &pkg]).await?;

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_default(),
            provider: self.id().into(),
            install_path: PathBuf::new(),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_uv(&["pip", "uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_uv(&["pip", "list", "--format", "json"]).await?;

        if let Ok(packages) = serde_json::from_str::<Vec<serde_json::Value>>(&out) {
            return Ok(packages
                .iter()
                .filter_map(|p| {
                    let name = p["name"].as_str()?.to_string();

                    if let Some(name_filter) = &filter.name_filter {
                        if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                            return None;
                        }
                    }

                    let version = p["version"].as_str().unwrap_or("").to_string();

                    Some(InstalledPackage {
                        name,
                        version,
                        provider: self.id().into(),
                        install_path: PathBuf::new(),
                        installed_at: String::new(),
                        is_global: true,
                    })
                })
                .collect());
        }

        Ok(vec![])
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self
            .run_uv(&["pip", "list", "--outdated", "--format", "json"])
            .await;

        if let Ok(output) = out {
            if let Ok(outdated) = serde_json::from_str::<Vec<serde_json::Value>>(&output) {
                return Ok(outdated
                    .iter()
                    .filter_map(|p| {
                        let name = p["name"].as_str()?.to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        let current = p["version"].as_str()?.to_string();
                        let latest = p["latest_version"].as_str()?.to_string();

                        Some(UpdateInfo {
                            name,
                            current_version: current,
                            latest_version: latest,
                            provider: self.id().into(),
                        })
                    })
                    .collect());
            }
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for UvProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_uv(&["pip", "show", name]).await;
        Ok(out.is_ok())
    }
}
