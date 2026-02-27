use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// fnm (Fast Node Manager) - A fast and simple Node.js version manager
/// Written in Rust, faster than nvm
pub struct FnmProvider {
    fnm_dir: Option<PathBuf>,
}

impl FnmProvider {
    pub fn new() -> Self {
        Self {
            fnm_dir: Self::detect_fnm_dir(),
        }
    }

    fn detect_fnm_dir() -> Option<PathBuf> {
        // Check FNM_DIR environment variable first
        if let Ok(dir) = std::env::var("FNM_DIR") {
            return Some(PathBuf::from(dir));
        }

        // Default locations
        if cfg!(windows) {
            std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("fnm"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".fnm"))
                .or_else(|| {
                    std::env::var("XDG_DATA_HOME")
                        .ok()
                        .map(|p| PathBuf::from(p).join("fnm"))
                })
        }
    }

    fn fnm_dir(&self) -> CogniaResult<PathBuf> {
        self.fnm_dir
            .clone()
            .ok_or_else(|| CogniaError::Provider("FNM directory not found".into()))
    }

    async fn run_fnm(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("fnm", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }
}

impl Default for FnmProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for FnmProvider {
    fn id(&self) -> &str {
        "fnm"
    }

    fn display_name(&self) -> &str {
        "fnm (Fast Node Manager)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::VersionSwitch,
            Capability::MultiVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        88
    } // Higher than nvm

    async fn is_available(&self) -> bool {
        if process::which("fnm").await.is_none() {
            return false;
        }
        // Verify fnm actually works
        match process::execute("fnm", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // fnm ls-remote lists all available Node.js versions
        let output = self.run_fnm(&["ls-remote"]).await?;

        let versions: Vec<PackageSummary> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .filter(|line| line.contains(query) || query.is_empty())
            .take(20)
            .map(|version| PackageSummary {
                name: format!("node@{}", version),
                description: Some("Node.js JavaScript runtime".into()),
                latest_version: Some(version.to_string()),
                provider: self.id().to_string(),
            })
            .collect();

        Ok(versions)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name.strip_prefix("node@").unwrap_or(name);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("Node.js {}", version)),
            description: Some("Node.js JavaScript runtime".into()),
            homepage: Some("https://nodejs.org".into()),
            license: Some("MIT".into()),
            repository: Some("https://github.com/nodejs/node".into()),
            versions: vec![VersionInfo {
                version: version.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            }],
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let output = self.run_fnm(&["ls-remote"]).await?;

        Ok(output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(|version| VersionInfo {
                version: version.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        self.install_with_progress(req, None).await
    }

    async fn install_with_progress(
        &self,
        req: InstallRequest,
        progress: Option<ProgressSender>,
    ) -> CogniaResult<InstallReceipt> {
        let version = req.version.as_deref().unwrap_or("--lts");
        let package_name = format!("node@{}", version);

        // Stage 1: Fetching
        if let Some(ref tx) = progress {
            let _ = tx.send(InstallProgressEvent::fetching(&package_name)).await;
        }

        // Stage 2: Downloading/Installing (fnm handles this internally)
        if let Some(ref tx) = progress {
            let _ = tx
                .send(InstallProgressEvent::downloading(
                    &package_name,
                    0,
                    None,
                    0.0,
                ))
                .await;
        }

        // Run the actual installation
        let result = self.run_fnm(&["install", version]).await;

        if let Err(ref e) = result {
            if let Some(ref tx) = progress {
                let _ = tx
                    .send(InstallProgressEvent::failed(&package_name, &e.to_string()))
                    .await;
            }
            return Err(result.unwrap_err());
        }

        // Stage 3: Post-install - verify actual version
        if let Some(ref tx) = progress {
            let _ = tx
                .send(InstallProgressEvent::configuring(
                    &package_name,
                    "Verifying installation",
                ))
                .await;
        }

        let fnm_dir = self.fnm_dir()?;

        // Get actual installed version (handle --lts case)
        let actual_version = if version == "--lts" {
            // After installing LTS, get the actual version number
            self.get_current_version()
                .await?
                .unwrap_or_else(|| version.to_string())
        } else {
            version.to_string()
        };

        let install_path = fnm_dir.join("node-versions").join(&actual_version);

        // Stage 4: Done
        if let Some(ref tx) = progress {
            let _ = tx
                .send(InstallProgressEvent::done(&package_name, &actual_version))
                .await;
        }

        Ok(InstallReceipt {
            name: "node".to_string(),
            version: actual_version,
            provider: self.id().to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for uninstall".into()))?;

        self.run_fnm(&["uninstall", &version]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_fnm(&["list"]).await?;
        let fnm_dir = self.fnm_dir()?;

        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if line.is_empty() {
                    return None;
                }

                // Parse fnm list output: "* v18.17.0 default" or "v16.20.0"
                let version = line.split_whitespace().find(|s| s.starts_with('v'))?;

                let name = format!("node@{}", version);

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name,
                    version: version.to_string(),
                    provider: self.id().into(),
                    install_path: fnm_dir.join("node-versions").join(version),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let installed = self.list_installed_versions().await.unwrap_or_default();
        if installed.is_empty() {
            return Ok(vec![]);
        }

        let remote_output = self.run_fnm(&["ls-remote"]).await.unwrap_or_default();
        let remote_versions: Vec<&str> = remote_output
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect();

        let mut updates = Vec::new();
        for iv in &installed {
            let ver = iv.version.trim_start_matches('v');
            let parts: Vec<&str> = ver.split('.').collect();
            if parts.len() < 2 {
                continue;
            }
            let major = parts[0];

            // Find the latest version in the same major line
            let latest_in_major = remote_versions
                .iter()
                .filter_map(|rv| {
                    let rv_clean = rv.trim_start_matches('v');
                    let rv_parts: Vec<&str> = rv_clean.split('.').collect();
                    if rv_parts.first() == Some(&major) {
                        Some(*rv)
                    } else {
                        None
                    }
                })
                .next_back(); // remote list is sorted ascending

            if let Some(latest) = latest_in_major {
                let latest_clean = latest.trim_start_matches('v');
                if latest_clean != ver {
                    updates.push(UpdateInfo {
                        name: format!("node@{}", iv.version),
                        current_version: iv.version.clone(),
                        latest_version: latest.to_string(),
                        provider: self.id().into(),
                    });
                }
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl EnvironmentProvider for FnmProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_fnm(&["list"]).await?;
        let current = self.get_current_version().await?.unwrap_or_default();
        let fnm_dir = self.fnm_dir()?;

        let versions: Vec<InstalledVersion> = output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if line.is_empty() {
                    return None;
                }

                let version = line
                    .split_whitespace()
                    .find(|s| s.starts_with('v'))?
                    .to_string();

                Some(InstalledVersion {
                    version: version.clone(),
                    install_path: fnm_dir.join("node-versions").join(&version),
                    size: None,
                    installed_at: None,
                    is_current: version == current,
                })
            })
            .collect();

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let output = self.run_fnm(&["current"]).await?;
        let version = output.trim();

        if version == "none" || version == "system" || version.is_empty() {
            Ok(None)
        } else {
            Ok(Some(version.to_string()))
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_fnm(&["default", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let version_file = project_path.join(self.version_file_name());
        crate::platform::fs::write_file_string(&version_file, version).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        // Check for .node-version or .nvmrc file
        let version_files = [".node-version", ".nvmrc"];

        let mut current = start_path.to_path_buf();
        loop {
            // 1. Check .node-version and .nvmrc files (highest priority)
            for file_name in &version_files {
                let version_file = current.join(file_name);
                if version_file.exists() {
                    if let Ok(content) = crate::platform::fs::read_file_string(&version_file).await
                    {
                        let version = content.trim().to_string();
                        if !version.is_empty() {
                            return Ok(Some(VersionDetection {
                                version,
                                source: VersionSource::LocalFile,
                                source_path: Some(version_file),
                            }));
                        }
                    }
                }
            }

            // 2. Check .tool-versions file (asdf-style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("nodejs ") || line.starts_with("node ") {
                            let version = line
                                .strip_prefix("nodejs ")
                                .or_else(|| line.strip_prefix("node "))
                                .unwrap_or("")
                                .trim();
                            if !version.is_empty() {
                                return Ok(Some(VersionDetection {
                                    version: version.to_string(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(tool_versions),
                                }));
                            }
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        // 3. Check package.json engines field
        let package_json = start_path.join("package.json");
        if package_json.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&package_json).await {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(node_version) = json["engines"]["node"].as_str() {
                        return Ok(Some(VersionDetection {
                            version: node_version.to_string(),
                            source: VersionSource::Manifest,
                            source_path: Some(package_json),
                        }));
                    }
                }
            }
        }

        // 4. Fall back to current version
        if let Some(version) = self.get_current_version().await? {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemDefault,
                source_path: None,
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, version: &str) -> CogniaResult<EnvModifications> {
        let fnm_dir = self.fnm_dir()?;
        let node_path = fnm_dir
            .join("node-versions")
            .join(version)
            .join("installation");

        #[cfg(windows)]
        let bin_path = node_path;

        #[cfg(not(windows))]
        let bin_path = node_path.join("bin");

        Ok(EnvModifications::new().prepend_path(bin_path))
    }

    fn version_file_name(&self) -> &str {
        ".node-version"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[async_trait]
impl SystemPackageProvider for FnmProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let versions = self.list_installed_versions().await?;
        Ok(versions.iter().any(|v| v.version == name))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let provider = FnmProvider::new();
        assert_eq!(provider.id(), "fnm");
        assert_eq!(provider.display_name(), "fnm (Fast Node Manager)");
        assert_eq!(provider.priority(), 88);
    }

    #[test]
    fn test_capabilities() {
        let provider = FnmProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::VersionSwitch));
        assert!(caps.contains(&Capability::MultiVersion));
        assert!(caps.contains(&Capability::ProjectLocal));
    }

    #[test]
    fn test_supported_platforms() {
        let provider = FnmProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_requires_elevation() {
        let provider = FnmProvider::new();
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
    }

    #[test]
    fn test_version_file_name() {
        let provider = FnmProvider::new();
        assert_eq!(provider.version_file_name(), ".node-version");
    }

    #[test]
    fn test_default_impl() {
        let _provider = FnmProvider::default();
    }
}
