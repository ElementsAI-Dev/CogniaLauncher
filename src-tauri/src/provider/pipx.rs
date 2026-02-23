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

/// pipx - Install and Run Python Applications in Isolated Environments
///
/// pipx creates isolated virtual environments for each application,
/// preventing dependency conflicts between CLI tools.
pub struct PipxProvider;

impl PipxProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_pipx(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(180));
        let out = process::execute("pipx", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get pipx home directory
    fn get_pipx_home() -> Option<PathBuf> {
        std::env::var("PIPX_HOME").ok().map(PathBuf::from).or_else(|| {
            if cfg!(windows) {
                std::env::var("USERPROFILE")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".local").join("pipx"))
            } else {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".local").join("pipx"))
            }
        })
    }

    /// Get pipx bin directory
    fn get_pipx_bin() -> Option<PathBuf> {
        std::env::var("PIPX_BIN_DIR").ok().map(PathBuf::from).or_else(|| {
            if cfg!(windows) {
                std::env::var("USERPROFILE")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".local").join("bin"))
            } else {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".local").join("bin"))
            }
        })
    }

    /// Parse `pipx list --json` output
    fn parse_pipx_list_json(output: &str) -> Vec<InstalledPackage> {
        let mut packages = Vec::new();

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(output) {
            if let Some(venvs) = json["venvs"].as_object() {
                for (name, info) in venvs {
                    let metadata = &info["metadata"]["main_package"];
                    let version = metadata["package_version"]
                        .as_str()
                        .unwrap_or("")
                        .to_string();

                    let venv_path = Self::get_pipx_home()
                        .map(|p| p.join("venvs").join(name))
                        .unwrap_or_default();

                    packages.push(InstalledPackage {
                        name: name.clone(),
                        version,
                        provider: "pipx".into(),
                        install_path: venv_path,
                        installed_at: String::new(),
                        is_global: true,
                    });
                }
            }
        }

        packages
    }
}

impl Default for PipxProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for PipxProvider {
    fn id(&self) -> &str {
        "pipx"
    }
    fn display_name(&self) -> &str {
        "pipx (Python CLI Tool Manager)"
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
        78
    }

    async fn is_available(&self) -> bool {
        if process::which("pipx").await.is_none() {
            return false;
        }
        match process::execute("pipx", &["--version"], None).await {
            Ok(output) => output.success && !output.stdout.is_empty(),
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // pipx doesn't have a search command; use PyPI API via pip index
        // Fall back to returning a single result assuming exact name match
        use super::api::get_api_client;
        let api = get_api_client();
        match api.search_pypi(query, 20).await {
            Ok(results) => Ok(results
                .into_iter()
                .map(|p| PackageSummary {
                    name: p.name,
                    description: p.summary,
                    latest_version: Some(p.version),
                    provider: self.id().into(),
                })
                .collect()),
            Err(_) => Ok(vec![PackageSummary {
                name: query.into(),
                description: Some("Search PyPI for this package".into()),
                latest_version: None,
                provider: self.id().into(),
            }]),
        }
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Use PyPI API for package info
        use super::api::get_api_client;
        let api = get_api_client();
        if let Ok(pkg) = api.get_pypi_package(name).await {
            return Ok(PackageInfo {
                name: pkg.name.clone(),
                display_name: Some(pkg.name),
                description: pkg.summary,
                homepage: pkg.homepage,
                license: pkg.license,
                repository: None,
                versions: pkg
                    .releases
                    .into_iter()
                    .filter(|v| !v.is_empty())
                    .map(|v| VersionInfo {
                        version: v,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    })
                    .collect(),
                provider: self.id().into(),
            });
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: None,
            homepage: Some(format!("https://pypi.org/project/{}/", name)),
            license: None,
            repository: None,
            versions: vec![],
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["install"];

        let pkg_spec;
        if let Some(v) = &req.version {
            pkg_spec = format!("{}=={}", req.name, v);
            args.push(&pkg_spec);
        } else {
            args.push(&req.name);
        }

        self.run_pipx(&args).await?;

        // Get actual installed version from pipx list
        let actual_version = if let Ok(out) = self.run_pipx(&["list", "--json"]).await {
            let packages = Self::parse_pipx_list_json(&out);
            packages
                .iter()
                .find(|p| p.name.eq_ignore_ascii_case(&req.name))
                .map(|p| p.version.clone())
                .unwrap_or_else(|| req.version.clone().unwrap_or_else(|| "unknown".into()))
        } else {
            req.version.clone().unwrap_or_else(|| "unknown".into())
        };

        let install_path = Self::get_pipx_home()
            .map(|p| p.join("venvs").join(&req.name))
            .unwrap_or_else(|| PathBuf::from("pipx").join("venvs").join(&req.name));

        // Collect binary files installed by this package
        let bin_files = if let Some(bin_dir) = Self::get_pipx_bin() {
            let bin_name = if cfg!(windows) {
                format!("{}.exe", req.name)
            } else {
                req.name.clone()
            };
            let bin_path = bin_dir.join(&bin_name);
            if bin_path.exists() {
                vec![bin_path]
            } else {
                vec![bin_dir]
            }
        } else {
            vec![]
        };

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path,
            files: bin_files,
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        if let Ok(out) = self.run_pipx(&["list", "--json"]).await {
            let packages = Self::parse_pipx_list_json(&out);
            if let Some(pkg) = packages.iter().find(|p| p.name.eq_ignore_ascii_case(name)) {
                return Ok(Some(pkg.version.clone()));
            }
        }
        Ok(None)
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_pipx(&["uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_pipx(&["list", "--json"]).await?;
        let mut packages = Self::parse_pipx_list_json(&out);

        if let Some(ref name_filter) = filter.name_filter {
            packages.retain(|p| p.name.contains(name_filter));
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // pipx doesn't have a built-in outdated check
        // We compare installed versions with PyPI latest
        use super::api::get_api_client;
        let api = get_api_client();

        let installed = self.list_installed(InstalledFilter::default()).await?;
        let mut updates = Vec::new();

        for pkg in &installed {
            if !packages.is_empty() && !packages.contains(&pkg.name) {
                continue;
            }

            if let Ok(pypi_pkg) = api.get_pypi_package(&pkg.name).await {
                if let Some(latest) = pypi_pkg.releases.last() {
                    if *latest != pkg.version && !latest.is_empty() {
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
impl SystemPackageProvider for PipxProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_pipx(&["--version"]).await?;
        // Output: "1.7.1"
        Ok(out.trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("pipx")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("pipx not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("pip install pipx && pipx ensurepath".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        Ok(self.get_installed_version(name).await?.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let provider = PipxProvider::new();
        assert_eq!(provider.id(), "pipx");
        assert_eq!(provider.display_name(), "pipx (Python CLI Tool Manager)");
        assert_eq!(provider.priority(), 78);

        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_capabilities_include_search() {
        let provider = PipxProvider::new();
        let caps = provider.capabilities();

        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
    }

    #[test]
    fn test_default_construction() {
        let provider = PipxProvider::default();
        assert_eq!(provider.id(), "pipx");
    }

    #[test]
    fn test_parse_pipx_list_json() {
        let json = r#"{
            "venvs": {
                "black": {
                    "metadata": {
                        "main_package": {
                            "package_version": "24.3.0"
                        }
                    }
                },
                "ruff": {
                    "metadata": {
                        "main_package": {
                            "package_version": "0.3.4"
                        }
                    }
                }
            }
        }"#;

        let packages = PipxProvider::parse_pipx_list_json(json);
        assert_eq!(packages.len(), 2);

        let black = packages.iter().find(|p| p.name == "black");
        assert!(black.is_some());
        assert_eq!(black.unwrap().version, "24.3.0");

        let ruff = packages.iter().find(|p| p.name == "ruff");
        assert!(ruff.is_some());
        assert_eq!(ruff.unwrap().version, "0.3.4");
    }

    #[test]
    fn test_parse_pipx_list_json_empty() {
        let json = r#"{"venvs": {}}"#;
        let packages = PipxProvider::parse_pipx_list_json(json);
        assert!(packages.is_empty());
    }
}
