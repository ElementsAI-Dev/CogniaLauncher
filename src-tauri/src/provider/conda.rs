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

/// Conda - Package, dependency and environment management for any language
///
/// Supports Anaconda, Miniconda, and Miniforge distributions.
/// Uses `conda` CLI for package management and environment operations.
/// Also supports `mamba` as a faster drop-in replacement.
pub struct CondaProvider {
    /// Preferred command: "conda" or "mamba"
    command: String,
    /// Custom channel URLs
    channels: Vec<String>,
}

impl CondaProvider {
    pub fn new() -> Self {
        Self {
            command: "conda".to_string(),
            channels: vec![],
        }
    }

    /// Prefer mamba over conda if available
    pub async fn detect_best_command() -> Self {
        // Check if mamba is available (faster alternative)
        if process::which("mamba").await.is_some() {
            Self {
                command: "mamba".to_string(),
                channels: vec![],
            }
        } else {
            Self::new()
        }
    }

    /// Add a custom channel
    pub fn with_channel(mut self, channel: impl Into<String>) -> Self {
        self.channels.push(channel.into());
        self
    }

    async fn run_conda(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(300));
        let out = process::execute(&self.command, args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Build args with channel flags
    fn build_channel_args(&self) -> Vec<String> {
        let mut args = Vec::new();
        for ch in &self.channels {
            args.push("-c".to_string());
            args.push(ch.clone());
        }
        args
    }

    /// Get conda info for prefix path
    async fn get_conda_prefix(&self) -> Option<PathBuf> {
        if let Ok(out) = self.run_conda(&["info", "--base"]).await {
            let base = out.trim();
            if !base.is_empty() {
                return Some(PathBuf::from(base));
            }
        }
        // Fallback: check CONDA_PREFIX env var
        std::env::var("CONDA_PREFIX").ok().map(PathBuf::from)
    }

    /// Get installed version of a package in the current environment
    async fn query_installed_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_conda(&["list", "--json", name]).await?;
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            if let Some(arr) = json.as_array() {
                for pkg in arr {
                    if pkg["name"].as_str() == Some(name) {
                        if let Some(v) = pkg["version"].as_str() {
                            return Ok(v.to_string());
                        }
                    }
                }
            }
        }
        Err(CogniaError::Provider(format!("Package {} not found", name)))
    }
}

impl Default for CondaProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for CondaProvider {
    fn id(&self) -> &str {
        "conda"
    }
    fn display_name(&self) -> &str {
        "Conda (Package & Environment Manager)"
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
        80
    }

    async fn is_available(&self) -> bool {
        if process::which(&self.command).await.is_none() {
            return false;
        }
        match process::execute(&self.command, &["--version"], None).await {
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
        let args = vec!["search", "--json", query];
        let channel_args = self.build_channel_args();
        let channel_refs: Vec<&str> = channel_args.iter().map(|s| s.as_str()).collect();
        let all_args: Vec<&str> = args
            .iter()
            .copied()
            .chain(channel_refs.iter().copied())
            .collect();

        let out = self.run_conda(&all_args).await?;

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            if let Some(obj) = json.as_object() {
                let packages: Vec<PackageSummary> = obj
                    .iter()
                    .take(limit)
                    .map(|(name, versions)| {
                        let latest = versions
                            .as_array()
                            .and_then(|arr| arr.last())
                            .and_then(|v| v["version"].as_str())
                            .map(|s| s.to_string());

                        PackageSummary {
                            name: name.clone(),
                            description: None,
                            latest_version: latest,
                            provider: self.id().into(),
                        }
                    })
                    .collect();

                return Ok(packages);
            }
        }

        Ok(vec![])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let args = vec!["search", "--json", name];
        let channel_args = self.build_channel_args();
        let channel_refs: Vec<&str> = channel_args.iter().map(|s| s.as_str()).collect();
        let all_args: Vec<&str> = args
            .iter()
            .copied()
            .chain(channel_refs.iter().copied())
            .collect();

        let out = self.run_conda(&all_args).await?;

        let mut versions = Vec::new();
        let mut license = None;
        let mut description = None;

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            if let Some(obj) = json.as_object() {
                if let Some(pkg_versions) = obj.get(name).and_then(|v| v.as_array()) {
                    for v in pkg_versions {
                        if let Some(ver) = v["version"].as_str() {
                            versions.push(VersionInfo {
                                version: ver.to_string(),
                                release_date: v["timestamp"].as_i64().map(|t| {
                                    chrono::DateTime::from_timestamp(t / 1000, 0)
                                        .map(|dt| dt.to_rfc3339())
                                        .unwrap_or_default()
                                }),
                                deprecated: false,
                                yanked: false,
                            });
                        }
                        // Get metadata from the latest entry
                        if license.is_none() {
                            license = v["license"].as_str().map(|s| s.to_string());
                        }
                        if description.is_none() {
                            description = v["summary"].as_str().map(|s| s.to_string());
                        }
                    }
                }
            }
        }

        versions.dedup_by(|a, b| a.version == b.version);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage: Some(format!("https://anaconda.org/anaconda/{}", name)),
            license,
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn get_dependencies(&self, name: &str, version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use conda info --json to get package dependencies
        let pkg_spec = if version.is_empty() {
            name.to_string()
        } else {
            format!("{}={}", name, version)
        };

        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(60));
        let out = process::execute(&self.command, &["info", &pkg_spec, "--json"], Some(opts)).await;

        if let Ok(result) = out {
            if result.success {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&result.stdout) {
                    // conda info --json returns: { "package_name": [{ "depends": [...] }] }
                    if let Some(pkg_arr) = json.get(name).and_then(|v| v.as_array()) {
                        if let Some(pkg_info) = pkg_arr.first() {
                            if let Some(depends) = pkg_info["depends"].as_array() {
                                return Ok(depends
                                    .iter()
                                    .filter_map(|d| {
                                        let dep_str = d.as_str()?;
                                        // Format: "package_name >=1.0,<2.0" or "package_name"
                                        let parts: Vec<&str> = dep_str.splitn(2, ' ').collect();
                                        let dep_name = parts[0].to_string();
                                        let constraint = if parts.len() > 1 {
                                            parts[1]
                                                .parse::<VersionConstraint>()
                                                .unwrap_or(VersionConstraint::Any)
                                        } else {
                                            VersionConstraint::Any
                                        };
                                        Some(Dependency {
                                            name: dep_name,
                                            constraint,
                                        })
                                    })
                                    .collect());
                            }
                        }
                    }
                }
            }
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}={}", req.name, v)
        } else {
            req.name.clone()
        };

        let args = vec!["install", "-y", &pkg];
        let channel_args = self.build_channel_args();
        let channel_refs: Vec<&str> = channel_args.iter().map(|s| s.as_str()).collect();
        let all_args: Vec<&str> = args
            .iter()
            .copied()
            .chain(channel_refs.iter().copied())
            .collect();

        self.run_conda(&all_args).await?;

        // Get actual installed version
        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = self
            .get_conda_prefix()
            .await
            .unwrap_or_else(|| PathBuf::from("conda"));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.query_installed_version(name).await {
            Ok(v) => Ok(Some(v)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_conda(&["remove", "-y", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_conda(&["list", "--json"]).await?;
        let prefix = self.get_conda_prefix().await.unwrap_or_default();

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            if let Some(arr) = json.as_array() {
                let packages: Vec<InstalledPackage> = arr
                    .iter()
                    .filter_map(|pkg| {
                        let name = pkg["name"].as_str()?.to_string();

                        if let Some(ref name_filter) = filter.name_filter {
                            if !name.contains(name_filter) {
                                return None;
                            }
                        }

                        let version = pkg["version"].as_str().unwrap_or("").to_string();
                        let channel = pkg["channel"].as_str().unwrap_or("").to_string();

                        Some(InstalledPackage {
                            name,
                            version,
                            provider: format!("{}:{}", self.id(), channel),
                            install_path: prefix.clone(),
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
        // conda update --all --dry-run --json shows available updates
        let out = self
            .run_conda(&["update", "--all", "--dry-run", "--json"])
            .await;

        if let Ok(output) = out {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output) {
                if let Some(actions) = json["actions"]["LINK"].as_array() {
                    let installed = self
                        .list_installed(InstalledFilter::default())
                        .await
                        .unwrap_or_default();
                    let installed_map: std::collections::HashMap<String, String> =
                        installed.into_iter().map(|p| (p.name, p.version)).collect();

                    let updates: Vec<UpdateInfo> = actions
                        .iter()
                        .filter_map(|pkg| {
                            let name = pkg["name"].as_str()?.to_string();
                            let new_version = pkg["version"].as_str()?.to_string();

                            if !packages.is_empty() && !packages.contains(&name) {
                                return None;
                            }

                            let current = installed_map.get(&name)?.clone();
                            if current != new_version {
                                Some(UpdateInfo {
                                    name,
                                    current_version: current,
                                    latest_version: new_version,
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
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for CondaProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_conda(&["--version"]).await?;
        // Output: "conda 24.11.1"
        Ok(out
            .trim()
            .split_whitespace()
            .last()
            .unwrap_or("unknown")
            .to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which(&self.command)
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider(format!("{} not found", self.command)))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Download Miniconda: https://docs.conda.io/en/latest/miniconda.html".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        Ok(self.query_installed_version(name).await.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let provider = CondaProvider::new();
        assert_eq!(provider.id(), "conda");
        assert_eq!(
            provider.display_name(),
            "Conda (Package & Environment Manager)"
        );
        assert_eq!(provider.priority(), 80);

        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_capabilities() {
        let provider = CondaProvider::new();
        let caps = provider.capabilities();

        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::LockVersion));
    }

    #[test]
    fn test_default_command() {
        let provider = CondaProvider::new();
        assert_eq!(provider.command, "conda");
        assert!(provider.channels.is_empty());
    }

    #[test]
    fn test_with_channel() {
        let provider = CondaProvider::new()
            .with_channel("conda-forge")
            .with_channel("bioconda");
        assert_eq!(provider.channels.len(), 2);
    }

    #[test]
    fn test_build_channel_args() {
        let provider = CondaProvider::new().with_channel("conda-forge");
        let args = provider.build_channel_args();
        assert_eq!(args, vec!["-c", "conda-forge"]);
    }

    #[test]
    fn test_build_channel_args_empty() {
        let provider = CondaProvider::new();
        let args = provider.build_channel_args();
        assert!(args.is_empty());
    }
}
