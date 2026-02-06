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

/// uv - Fast Python Package Manager
///
/// Supports custom PyPI mirror configuration via `--index-url` and `--extra-index-url` flags.
pub struct UvProvider {
    /// Primary index URL (replaces default PyPI)
    index_url: Option<String>,
    /// Additional index URLs to search
    extra_index_urls: Vec<String>,
}

impl UvProvider {
    pub fn new() -> Self {
        Self {
            index_url: None,
            extra_index_urls: Vec::new(),
        }
    }

    /// Set the primary index URL (PyPI mirror)
    pub fn with_index_url(mut self, url: impl Into<String>) -> Self {
        self.index_url = Some(url.into());
        self
    }

    /// Set the primary index URL from an Option
    pub fn with_index_url_opt(mut self, url: Option<String>) -> Self {
        self.index_url = url;
        self
    }

    /// Add an extra index URL
    pub fn with_extra_index_url(mut self, url: impl Into<String>) -> Self {
        self.extra_index_urls.push(url.into());
        self
    }

    /// Update the index URL at runtime
    pub fn set_index_url(&mut self, url: Option<String>) {
        self.index_url = url;
    }

    /// Build uv arguments with mirror configuration
    fn build_uv_args<'a>(&'a self, base_args: &[&'a str]) -> Vec<String> {
        let mut args: Vec<String> = base_args.iter().map(|s| s.to_string()).collect();
        
        if let Some(ref url) = self.index_url {
            args.push("--index-url".to_string());
            args.push(url.clone());
        }
        
        for url in &self.extra_index_urls {
            args.push("--extra-index-url".to_string());
            args.push(url.clone());
        }
        
        args
    }

    /// Get site-packages directory for the current Python
    fn get_site_packages_dir() -> Option<PathBuf> {
        // Try to get from VIRTUAL_ENV first
        if let Ok(venv) = std::env::var("VIRTUAL_ENV") {
            let lib_dir = if cfg!(windows) {
                PathBuf::from(&venv).join("Lib").join("site-packages")
            } else {
                PathBuf::from(&venv).join("lib").join("python3").join("site-packages")
            };
            if lib_dir.exists() {
                return Some(lib_dir);
            }
        }
        // Default user site-packages
        if cfg!(windows) {
            std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("Python").join("site-packages"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".local").join("lib").join("python3").join("site-packages"))
        }
    }

    async fn run_uv(&self, args: &[&str]) -> CogniaResult<String> {
        let full_args = self.build_uv_args(args);
        let args_refs: Vec<&str> = full_args.iter().map(|s| s.as_str()).collect();
        
        let out = process::execute("uv", &args_refs, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Run uv without mirror arguments (for commands that don't need them)
    async fn run_uv_raw(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("uv", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

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

    /// Get the installed version and location of a package using uv pip show
    async fn get_package_info_raw(&self, name: &str) -> CogniaResult<(String, PathBuf)> {
        let output = self.run_uv_raw(&["pip", "show", name]).await?;
        
        let mut version = String::new();
        let mut location = PathBuf::new();
        
        for line in output.lines() {
            if let Some(v) = line.strip_prefix("Version:") {
                version = v.trim().to_string();
            } else if let Some(loc) = line.strip_prefix("Location:") {
                location = PathBuf::from(loc.trim());
            }
        }
        
        if version.is_empty() {
            return Err(CogniaError::Provider(format!("Package {} not found", name)));
        }
        
        Ok((version, location))
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
        system_detection::is_command_available("uv", &["--version"]).await
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

        // Fallback to uv pip (not raw pip) for version lookup
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        let out = process::execute("uv", &["pip", "show", query], Some(opts)).await;

        if let Ok(result) = out {
            if result.success && !result.stdout.is_empty() {
                // Parse `uv pip show` output for Version field
                let mut version = None;
                for line in result.stdout.lines() {
                    if let Some(v) = line.strip_prefix("Version:") {
                        version = Some(v.trim().to_string());
                    }
                }
                if version.is_some() {
                    return Ok(vec![PackageSummary {
                        name: query.into(),
                        description: None,
                        latest_version: version,
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

        // Fallback to uv pip show (not raw pip)
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        let out = process::execute("uv", &["pip", "show", name], Some(opts)).await;

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
        // Use PyPI API first via get_api_client
        let api = get_api_client();
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
            if !versions.is_empty() {
                return Ok(versions);
            }
        }

        // Fallback to pip index versions via uv
        let out = process::execute("uv", &["pip", "index", "versions", name], None).await;

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

    async fn get_dependencies(&self, name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use uv pip show to get requirements for the installed package
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        let out = process::execute("uv", &["pip", "show", name], Some(opts)).await;
        if let Ok(result) = out {
            if result.success {
                for line in result.stdout.lines() {
                    if let Some(reqs) = line.strip_prefix("Requires:") {
                        let deps: Vec<Dependency> = reqs
                            .trim()
                            .split(',')
                            .filter(|s| !s.trim().is_empty())
                            .map(|dep| Dependency {
                                name: dep.trim().to_string(),
                                constraint: VersionConstraint::Any,
                            })
                            .collect();
                        return Ok(deps);
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

        // Get the actual installed version and location
        let (actual_version, install_path) = self.get_package_info_raw(&req.name).await
            .unwrap_or_else(|_| (req.version.clone().unwrap_or_default(), PathBuf::new()));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_uv(&["pip", "uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        // list doesn't need mirror args
        let out = self.run_uv_raw(&["pip", "list", "--format", "json"]).await?;

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

                    // uv packages are stored in site-packages
                    let site_packages = Self::get_site_packages_dir().unwrap_or_default();

                    Some(InstalledPackage {
                        name: name.clone(),
                        version,
                        provider: self.id().into(),
                        install_path: site_packages.join(&name),
                        installed_at: String::new(),
                        is_global: true,
                    })
                })
                .collect());
        }

        Ok(vec![])
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // check_updates doesn't need mirror args for listing
        let out = self
            .run_uv_raw(&["pip", "list", "--outdated", "--format", "json"])
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
        // show doesn't need mirror args
        let out = self.run_uv_raw(&["pip", "show", name]).await;
        Ok(out.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uv_provider_builder() {
        let provider = UvProvider::new()
            .with_index_url("https://pypi.tuna.tsinghua.edu.cn/simple")
            .with_extra_index_url("https://pypi.org/simple");
        
        assert_eq!(provider.index_url, Some("https://pypi.tuna.tsinghua.edu.cn/simple".to_string()));
        assert_eq!(provider.extra_index_urls.len(), 1);
    }

    #[test]
    fn test_build_uv_args() {
        let provider = UvProvider::new()
            .with_index_url("https://mirror.example.com/simple");
        
        let args = provider.build_uv_args(&["pip", "install", "requests"]);
        
        assert!(args.contains(&"pip".to_string()));
        assert!(args.contains(&"install".to_string()));
        assert!(args.contains(&"requests".to_string()));
        assert!(args.contains(&"--index-url".to_string()));
        assert!(args.contains(&"https://mirror.example.com/simple".to_string()));
    }

    #[test]
    fn test_uv_provider_no_mirror() {
        let provider = UvProvider::new();
        let args = provider.build_uv_args(&["pip", "install", "requests"]);
        
        assert_eq!(args, vec!["pip".to_string(), "install".to_string(), "requests".to_string()]);
    }
}
