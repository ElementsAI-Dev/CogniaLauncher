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

    /// Get the installed version and location of a package using pip show
    async fn get_package_info_raw(&self, name: &str) -> CogniaResult<(String, PathBuf)> {
        let output = self.run_pip_raw(&["show", name]).await?;

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

    /// Get only the installed version of a package
    async fn get_package_version(&self, name: &str) -> CogniaResult<String> {
        self.get_package_info_raw(name).await.map(|(v, _)| v)
    }

    /// Get the installation location of a package
    async fn get_package_location(&self, name: &str) -> CogniaResult<PathBuf> {
        self.get_package_info_raw(name).await.map(|(_, p)| p)
    }

    fn default_site_packages() -> PathBuf {
        std::env::var("PYTHONUSERBASE")
            .ok()
            .map(|p| PathBuf::from(p).join("lib").join("site-packages"))
            .unwrap_or_else(|| PathBuf::from("site-packages"))
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
        // Check if pip exists and is actually executable
        if process::which("pip").await.is_none() {
            return false;
        }
        // Verify pip works by running --version
        match process::execute("pip", &["--version"], None).await {
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

    async fn get_dependencies(&self, name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use pip show to get requirements for the installed package
        let out = process::execute("pip", &["show", name], None).await;
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

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        self.get_package_version(name).await.map(Some)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}=={}", req.name, v)
        } else {
            req.name.clone()
        };

        self.run_pip(&["install", &pkg]).await?;

        // Get the actual installed version and location
        let (actual_version, install_path) = self
            .get_package_info_raw(&req.name)
            .await
            .unwrap_or_else(|_| {
                (
                    req.version.clone().unwrap_or_default(),
                    Self::default_site_packages(),
                )
            });

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
        self.run_pip(&["uninstall", "-y", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        // list doesn't need mirror args
        let output = self.run_pip_raw(&["list", "--format", "json"]).await?;

        if let Ok(packages) = serde_json::from_str::<Vec<serde_json::Value>>(&output) {
            let mut results = Vec::new();
            for pkg in packages {
                let name = match pkg["name"].as_str() {
                    Some(value) => value.to_string(),
                    None => continue,
                };

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                        continue;
                    }
                }

                let version = pkg["version"].as_str().unwrap_or("").to_string();
                let install_path = self
                    .get_package_location(&name)
                    .await
                    .unwrap_or_else(|_| Self::default_site_packages());

                results.push(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path,
                    installed_at: String::new(),
                    is_global: true,
                });
            }

            return Ok(results);
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

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_pip_raw(&["--version"]).await?;
        // Output: "pip 24.3.1 from /path/site-packages/pip (python 3.12)"
        Ok(out
            .split_whitespace()
            .nth(1)
            .unwrap_or("unknown")
            .to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("pip")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("pip not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("python -m ensurepip --upgrade".into())
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

        assert_eq!(
            provider.index_url,
            Some("https://pypi.tuna.tsinghua.edu.cn/simple".to_string())
        );
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

    #[test]
    fn test_provider_metadata() {
        let provider = PipProvider::new();
        assert_eq!(provider.id(), "pip");
        assert_eq!(provider.display_name(), "pip (Python Package Installer)");
        assert_eq!(provider.priority(), 82);
    }

    #[test]
    fn test_capabilities() {
        let provider = PipProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
    }

    #[test]
    fn test_supported_platforms() {
        let provider = PipProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_default_impl() {
        let _provider = PipProvider::default();
    }

    #[test]
    fn test_builder_chain() {
        let provider = PipProvider::new()
            .with_index_url("https://a.com/simple")
            .with_extra_index_url("https://b.com/simple")
            .with_extra_index_url("https://c.com/simple")
            .with_trusted_host("a.com")
            .with_trusted_host("b.com");

        assert_eq!(provider.extra_index_urls.len(), 2);
        assert_eq!(provider.trusted_hosts.len(), 2);

        let args = provider.build_pip_args(&["install", "pkg"]);
        // Should have two --extra-index-url and two --trusted-host entries
        assert_eq!(
            args.iter().filter(|a| *a == "--extra-index-url").count(),
            2
        );
        assert_eq!(args.iter().filter(|a| *a == "--trusted-host").count(), 2);
    }
}
