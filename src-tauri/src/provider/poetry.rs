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

/// Poetry - Modern Python dependency management and packaging
///
/// Poetry is a tool for dependency management and packaging in Python.
/// It supports custom PyPI mirror configuration via `--source` or config.
pub struct PoetryProvider {
    /// Primary index URL (replaces default PyPI)
    index_url: Option<String>,
}

impl PoetryProvider {
    pub fn new() -> Self {
        Self { index_url: None }
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

    async fn run_poetry(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(180));
        let output = process::execute("poetry", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    fn get_poetry_home() -> Option<PathBuf> {
        // Check POETRY_HOME first
        if let Ok(home) = std::env::var("POETRY_HOME") {
            return Some(PathBuf::from(home));
        }

        // Default locations
        if cfg!(windows) {
            std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("pypoetry"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".local").join("share").join("pypoetry"))
        }
    }

    fn parse_poetry_show_output(output: &str) -> Vec<InstalledPackage> {
        let mut packages = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Poetry show format: package-name version description
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                packages.push(InstalledPackage {
                    name: parts[0].to_string(),
                    version: parts[1].to_string(),
                    provider: "poetry".into(),
                    install_path: PathBuf::new(),
                    installed_at: String::new(),
                    is_global: false,
                });
            }
        }

        packages
    }
}

impl Default for PoetryProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for PoetryProvider {
    fn id(&self) -> &str {
        "poetry"
    }

    fn display_name(&self) -> &str {
        "Poetry (Python Dependency Management)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::LockVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        88 // Higher than pip (85) for Python project management
    }

    async fn is_available(&self) -> bool {
        process::which("poetry").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // Poetry uses PyPI, so we use the PyPI API
        let api = get_api_client();
        let limit = options.limit.unwrap_or(20);

        // PyPI search returns exact match, try to get package info
        if let Ok(packages) = api.search_pypi(query, limit).await {
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

        Ok(vec![])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let api = get_api_client();
        let info = api.get_pypi_package(name).await?;

        let mut versions: Vec<VersionInfo> = info
            .releases
            .into_iter()
            .map(|v| VersionInfo {
                version: v,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        // Sort versions in descending order
        versions.sort_by(|a, b| b.version.cmp(&a.version));

        Ok(PackageInfo {
            name: info.name,
            display_name: None,
            description: info.summary,
            homepage: info.homepage,
            license: info.license,
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let api = get_api_client();
        let info = api.get_pypi_package(name).await?;

        let mut versions: Vec<VersionInfo> = info
            .releases
            .into_iter()
            .map(|v| VersionInfo {
                version: v,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        versions.sort_by(|a, b| b.version.cmp(&a.version));
        Ok(versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}=={}", req.name, v)
        } else {
            req.name.clone()
        };

        // Poetry add command
        self.run_poetry(&["add", &pkg]).await?;

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
        self.run_poetry(&["remove", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_poetry(&["show"]).await?;
        let mut packages = Self::parse_poetry_show_output(&output);

        if let Some(ref name_filter) = filter.name_filter {
            packages.retain(|p| p.name.contains(name_filter));
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        // Use poetry show --outdated
        if let Ok(output) = self.run_poetry(&["show", "--outdated"]).await {
            for line in output.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    let name = parts[0].to_string();
                    let current = parts[1].to_string();
                    let latest = parts[2].to_string();

                    if packages.is_empty() || packages.contains(&name) {
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

        Ok(updates)
    }
}

#[async_trait]
impl SystemPackageProvider for PoetryProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_poetry(&["--version"]).await?;
        // Output: "Poetry (version 1.x.x)"
        let version = output
            .trim()
            .strip_prefix("Poetry (version ")
            .and_then(|s| s.strip_suffix(')'))
            .unwrap_or(output.trim());
        Ok(version.to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("poetry")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("poetry not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Poetry: curl -sSL https://install.python-poetry.org | python3 - (Unix) or (Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python - (Windows)".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let output = self.run_poetry(&["show", name]).await;
        Ok(output.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_poetry_provider_creation() {
        let provider = PoetryProvider::new();
        assert_eq!(provider.id(), "poetry");
        assert_eq!(
            provider.display_name(),
            "Poetry (Python Dependency Management)"
        );
    }

    #[test]
    fn test_poetry_provider_builder() {
        let provider =
            PoetryProvider::new().with_index_url("https://pypi.tuna.tsinghua.edu.cn/simple");

        assert_eq!(
            provider.index_url,
            Some("https://pypi.tuna.tsinghua.edu.cn/simple".to_string())
        );
    }

    #[test]
    fn test_capabilities() {
        let provider = PoetryProvider::new();
        let caps = provider.capabilities();

        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::LockVersion));
        assert!(caps.contains(&Capability::ProjectLocal));
    }

    #[test]
    fn test_parse_poetry_show_output() {
        let output = r#"
certifi       2023.7.22  Python package for providing Mozilla's CA Bundle.
charset-normalizer 3.3.0  The Real First Universal Charset Detector.
requests      2.31.0     Python HTTP for Humans.
"#;

        let packages = PoetryProvider::parse_poetry_show_output(output);

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "certifi");
        assert_eq!(packages[0].version, "2023.7.22");
        assert_eq!(packages[2].name, "requests");
        assert_eq!(packages[2].version, "2.31.0");
    }

    #[test]
    fn test_supported_platforms() {
        let provider = PoetryProvider::new();
        let platforms = provider.supported_platforms();

        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_priority() {
        let provider = PoetryProvider::new();
        assert_eq!(provider.priority(), 88);
    }
}
