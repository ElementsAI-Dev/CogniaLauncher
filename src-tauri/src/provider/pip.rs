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

/// pip - Python package installer (direct, not via uv)
/// 
/// Supports custom PyPI mirror configuration via `--index-url` and `--extra-index-url` flags.
pub struct PipProvider {
    /// Primary index URL (replaces default PyPI)
    index_url: Option<String>,
    /// Additional index URLs to search
    extra_index_urls: Vec<String>,
    /// Trusted hosts for HTTP connections
    trusted_hosts: Vec<String>,
}

impl PipProvider {
    pub fn new() -> Self {
        Self {
            index_url: None,
            extra_index_urls: Vec::new(),
            trusted_hosts: Vec::new(),
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

    /// Add a trusted host for HTTP connections
    pub fn with_trusted_host(mut self, host: impl Into<String>) -> Self {
        self.trusted_hosts.push(host.into());
        self
    }

    /// Update the index URL at runtime
    pub fn set_index_url(&mut self, url: Option<String>) {
        self.index_url = url;
    }

    /// Build pip arguments with mirror configuration
    fn build_pip_args<'a>(&'a self, base_args: &[&'a str]) -> Vec<String> {
        let mut args: Vec<String> = base_args.iter().map(|s| s.to_string()).collect();
        
        if let Some(ref url) = self.index_url {
            args.push("-i".to_string());
            args.push(url.clone());
        }
        
        for url in &self.extra_index_urls {
            args.push("--extra-index-url".to_string());
            args.push(url.clone());
        }
        
        for host in &self.trusted_hosts {
            args.push("--trusted-host".to_string());
            args.push(host.clone());
        }
        
        args
    }

    async fn run_pip(&self, args: &[&str]) -> CogniaResult<String> {
        let full_args = self.build_pip_args(args);
        let args_refs: Vec<&str> = full_args.iter().map(|s| s.as_str()).collect();
        
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("pip", &args_refs, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    /// Run pip without mirror arguments (for commands that don't need them)
    async fn run_pip_raw(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("pip", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    #[allow(dead_code)]
    fn get_site_packages() -> Option<PathBuf> {
        // Get Python site-packages directory
        if cfg!(windows) {
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("Programs").join("Python"))
        } else {
            None
        }
    }
}

impl Default for PipProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for PipProvider {
    fn id(&self) -> &str {
        "pip"
    }

    fn display_name(&self) -> &str {
        "pip (Python Package Installer)"
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
        82
    } // Lower than uv

    async fn is_available(&self) -> bool {
        process::which("pip").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let api = get_api_client();

        // Use PyPI API for search
        match api.search_pypi(query, limit).await {
            Ok(packages) => Ok(packages
                .into_iter()
                .map(|p| PackageSummary {
                    name: p.name,
                    description: p.summary,
                    latest_version: Some(p.version),
                    provider: self.id().into(),
                })
                .collect()),
            Err(_) => {
                // Fallback to pip index versions
                let opts = ProcessOptions::new().with_timeout(Duration::from_secs(15));
                let output =
                    process::execute("pip", &["index", "versions", query], Some(opts)).await;

                if let Ok(result) = output {
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
                Ok(vec![])
            }
        }
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
                versions,
                provider: self.id().into(),
            });
        }

        // Fallback to pip show
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        let output = process::execute("pip", &["show", name], Some(opts)).await;

        let mut description = None;
        let mut version = None;
        let mut homepage = None;
        let mut license = None;

        if let Ok(result) = output {
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
        let api = get_api_client();

        if let Ok(pkg) = api.get_pypi_package(name).await {
            return Ok(pkg
                .releases
                .into_iter()
                .filter(|v| !v.is_empty())
                .map(|v| VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect());
        }

        // Fallback to pip index versions
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(15));
        let output = process::execute("pip", &["index", "versions", name], Some(opts)).await;

        if let Ok(result) = output {
            if result.success {
                if let Some(start) = result.stdout.find('(') {
                    if let Some(end) = result.stdout.find(')') {
                        let versions_str = &result.stdout[start + 1..end];
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

        self.run_pip(&["install", &pkg]).await?;

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
        self.run_pip(&["uninstall", "-y", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        // list doesn't need mirror args
        let output = self.run_pip_raw(&["list", "--format", "json"]).await?;

        if let Ok(packages) = serde_json::from_str::<Vec<serde_json::Value>>(&output) {
            return Ok(packages
                .iter()
                .filter_map(|p| {
                    let name = p["name"].as_str()?.to_string();

                    if let Some(ref name_filter) = filter.name_filter {
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
        // check_updates doesn't need mirror args for listing
        let output = self
            .run_pip_raw(&["list", "--outdated", "--format", "json"])
            .await;

        if let Ok(out_str) = output {
            if let Ok(outdated) = serde_json::from_str::<Vec<serde_json::Value>>(&out_str) {
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
impl SystemPackageProvider for PipProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        // show doesn't need mirror args
        let out = self.run_pip_raw(&["show", name]).await;
        Ok(out.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pip_provider_builder() {
        let provider = PipProvider::new()
            .with_index_url("https://pypi.tuna.tsinghua.edu.cn/simple")
            .with_extra_index_url("https://pypi.org/simple")
            .with_trusted_host("pypi.tuna.tsinghua.edu.cn");
        
        assert_eq!(provider.index_url, Some("https://pypi.tuna.tsinghua.edu.cn/simple".to_string()));
        assert_eq!(provider.extra_index_urls.len(), 1);
        assert_eq!(provider.trusted_hosts.len(), 1);
    }

    #[test]
    fn test_build_pip_args() {
        let provider = PipProvider::new()
            .with_index_url("https://mirror.example.com/simple")
            .with_trusted_host("mirror.example.com");
        
        let args = provider.build_pip_args(&["install", "requests"]);
        
        assert!(args.contains(&"install".to_string()));
        assert!(args.contains(&"requests".to_string()));
        assert!(args.contains(&"-i".to_string()));
        assert!(args.contains(&"https://mirror.example.com/simple".to_string()));
        assert!(args.contains(&"--trusted-host".to_string()));
        assert!(args.contains(&"mirror.example.com".to_string()));
    }

    #[test]
    fn test_pip_provider_no_mirror() {
        let provider = PipProvider::new();
        let args = provider.build_pip_args(&["install", "requests"]);
        
        assert_eq!(args, vec!["install".to_string(), "requests".to_string()]);
    }
}
