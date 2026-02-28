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
        let mut opts = ProcessOptions::new().with_timeout(Duration::from_secs(180));
        if let Some(ref url) = self.index_url {
            opts = opts.with_env("PIP_INDEX_URL", url);
        }
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
            std::env::var("HOME").ok().map(|h| {
                PathBuf::from(h)
                    .join(".local")
                    .join("share")
                    .join("pypoetry")
            })
        }
    }

    fn parse_poetry_show_output(output: &str) -> Vec<InstalledPackage> {
        let mut packages = Vec::new();
        let poetry_home = Self::get_poetry_home();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Poetry show format: package-name version description
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let install_path = poetry_home
                    .as_ref()
                    .map(|p| p.join("venv").join("lib").join(&name))
                    .unwrap_or_else(|| {
                        PathBuf::from("pypoetry")
                            .join("venv")
                            .join("lib")
                            .join(&name)
                    });

                packages.push(InstalledPackage {
                    name,
                    version: parts[1].to_string(),
                    provider: "poetry".into(),
                    install_path,
                    installed_at: String::new(),
                    is_global: false,
                });
            }
        }

        packages
    }

    /// Get the installed version of a package
    async fn get_pkg_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_poetry(&["show", name]).await?;
        for line in out.lines() {
            if let Some(version) = line.strip_prefix("version") {
                let version = version.trim().trim_start_matches(':').trim();
                return Ok(version.to_string());
            }
        }
        Err(CogniaError::Provider(format!(
            "Version not found for {}",
            name
        )))
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
        if process::which("poetry").await.is_none() {
            return false;
        }
        // Verify poetry actually works
        match process::execute("poetry", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
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

    async fn get_dependencies(&self, name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use poetry show to get dependencies for a specific package
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(15));
        let out = process::execute("poetry", &["show", name], Some(opts)).await;
        if let Ok(result) = out {
            if result.success {
                let mut deps = Vec::new();
                let mut in_deps_section = false;
                for line in result.stdout.lines() {
                    let line = line.trim();
                    if line.starts_with("dependencies") || line.starts_with("requires") {
                        in_deps_section = true;
                        continue;
                    }
                    if in_deps_section {
                        if line.is_empty() || line.starts_with("required") {
                            break;
                        }
                        // Format: " - package_name (>=1.0,<2.0)"
                        let dep_line = line.trim_start_matches(" - ").trim();
                        if !dep_line.is_empty() {
                            let dep_name =
                                dep_line.split_whitespace().next().unwrap_or("").to_string();
                            let constraint = dep_line
                                .find('(')
                                .and_then(|start| {
                                    dep_line.find(')').map(|end| {
                                        dep_line[start + 1..end]
                                            .parse::<VersionConstraint>()
                                            .unwrap_or(VersionConstraint::Any)
                                    })
                                })
                                .unwrap_or(VersionConstraint::Any);

                            if !dep_name.is_empty() {
                                deps.push(Dependency {
                                    name: dep_name,
                                    constraint,
                                });
                            }
                        }
                    }
                }
                if !deps.is_empty() {
                    return Ok(deps);
                }
            }
        }
        Ok(vec![])
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.get_pkg_version(name).await {
            Ok(v) => Ok(Some(v)),
            Err(_) => Ok(None),
        }
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}=={}", req.name, v)
        } else {
            req.name.clone()
        };

        // Poetry add command
        self.run_poetry(&["add", &pkg]).await?;

        // Get the actual installed version
        let actual_version = self
            .get_pkg_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        // Determine install path based on Poetry home
        let install_path = Self::get_poetry_home()
            .map(|p| p.join("venv").join("lib").join(&req.name))
            .unwrap_or_else(|| {
                PathBuf::from("pypoetry")
                    .join("venv")
                    .join("lib")
                    .join(&req.name)
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
