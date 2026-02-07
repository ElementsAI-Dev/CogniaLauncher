use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{dirs_home, EnvModifications, Platform},
    process,
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub struct NvmProvider {
    nvm_dir: Option<PathBuf>,
}

impl NvmProvider {
    pub fn new() -> Self {
        let nvm_dir = std::env::var("NVM_DIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs_home().map(|h| h.join(".nvm")));

        Self { nvm_dir }
    }

    fn nvm_dir(&self) -> CogniaResult<&PathBuf> {
        self.nvm_dir
            .as_ref()
            .ok_or_else(|| CogniaError::Provider("NVM_DIR not found".into()))
    }

    async fn run_nvm(&self, args: &[&str]) -> CogniaResult<String> {
        #[cfg(unix)]
        {
            let nvm_dir = self.nvm_dir()?;
            let nvm_sh = nvm_dir.join("nvm.sh");
            let cmd = format!("source \"{}\" && nvm {}", nvm_sh.display(), args.join(" "));
            let output = process::execute_shell(&cmd, None).await?;
            if output.success {
                Ok(output.stdout)
            } else {
                Err(CogniaError::Provider(output.stderr))
            }
        }

        #[cfg(windows)]
        {
            // nvm_dir is not used on windows for running nvm command as it uses system PATH
            let output = process::execute("nvm", args, None).await?;
            if output.success {
                Ok(output.stdout)
            } else {
                Err(CogniaError::Provider(output.stderr))
            }
        }
    }
}

impl Default for NvmProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for NvmProvider {
    fn id(&self) -> &str {
        "nvm"
    }

    fn display_name(&self) -> &str {
        "Node Version Manager"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::List,
            Capability::VersionSwitch,
            Capability::MultiVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux, Platform::MacOS, Platform::Windows]
    }

    fn priority(&self) -> i32 {
        100
    }

    async fn is_available(&self) -> bool {
        if let Some(_nvm_dir) = &self.nvm_dir {
            #[cfg(unix)]
            {
                _nvm_dir.join("nvm.sh").exists()
            }
            #[cfg(windows)]
            {
                process::which("nvm").await.is_some()
            }
        } else {
            false
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let output = self.run_nvm(&["ls-remote", "--lts"]).await?;

        let versions: Vec<PackageSummary> = output
            .lines()
            .filter(|line| line.contains(query) || query.is_empty())
            .filter_map(|line| {
                let version = line.split_whitespace().next()?;
                if version.starts_with('v') {
                    Some(PackageSummary {
                        name: format!("node@{}", version),
                        description: Some("Node.js runtime".into()),
                        latest_version: Some(version.to_string()),
                        provider: self.id().to_string(),
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(versions)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let versions = self.get_versions(name).await?;

        Ok(PackageInfo {
            name: "node".to_string(),
            display_name: Some("Node.js".to_string()),
            description: Some(
                "JavaScript runtime built on Chrome's V8 JavaScript engine".to_string(),
            ),
            homepage: Some("https://nodejs.org".to_string()),
            license: Some("MIT".to_string()),
            repository: Some("https://github.com/nodejs/node".to_string()),
            versions,
            provider: self.id().to_string(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let output = self.run_nvm(&["ls-remote"]).await?;

        let versions: Vec<VersionInfo> = output
            .lines()
            .filter_map(|line| {
                let version = line.split_whitespace().next()?;
                if version.starts_with('v') {
                    Some(VersionInfo {
                        version: version.to_string(),
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(versions)
    }

    async fn install(&self, request: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = request.version.as_deref().unwrap_or("--lts");

        self.run_nvm(&["install", version]).await?;

        // Resolve actual version (especially when --lts was used)
        let actual_version = if version == "--lts" || version == "lts" {
            self.get_current_version()
                .await?
                .unwrap_or_else(|| version.to_string())
        } else {
            version.to_string()
        };

        let nvm_dir = self.nvm_dir()?;
        let install_path = nvm_dir.join("versions").join("node").join(&actual_version);

        Ok(InstallReceipt {
            name: "node".to_string(),
            version: actual_version,
            provider: self.id().to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, request: UninstallRequest) -> CogniaResult<()> {
        let version = request
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for uninstall".into()))?;

        self.run_nvm(&["uninstall", &version]).await?;
        Ok(())
    }

    async fn list_installed(
        &self,
        filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_nvm(&["ls"]).await?;
        let nvm_dir = self.nvm_dir()?;

        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                let version = line.split_whitespace().find(|s| s.starts_with('v'))?;

                let name = "node".to_string();

                // Apply name filter
                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) && !version.contains(name_filter) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name,
                    version: version.to_string(),
                    provider: self.id().to_string(),
                    install_path: nvm_dir.join("versions").join("node").join(version),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for NvmProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_nvm(&["ls"]).await?;
        let current = self.get_current_version().await?.unwrap_or_default();
        let nvm_dir = self.nvm_dir()?;

        let versions: Vec<InstalledVersion> = output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                let version = line.split_whitespace().find(|s| s.starts_with('v'))?;

                Some(InstalledVersion {
                    version: version.to_string(),
                    install_path: nvm_dir.join("versions").join("node").join(version),
                    size: None,
                    installed_at: None,
                    is_current: version == current,
                })
            })
            .collect();

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let output = self.run_nvm(&["current"]).await?;
        let version = output.trim();

        if version == "none" || version == "system" || version.is_empty() {
            Ok(None)
        } else {
            Ok(Some(version.to_string()))
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_nvm(&["alias", "default", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let version_file = project_path.join(self.version_file_name());
        crate::platform::fs::write_file_string(&version_file, version).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();

        // Walk up directory tree looking for version files
        loop {
            // 1. Check .node-version file (highest priority)
            let version_file = current.join(self.version_file_name());
            if version_file.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&version_file).await {
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

            // 2. Check .nvmrc file
            let nvmrc = current.join(".nvmrc");
            if nvmrc.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&nvmrc).await {
                    let version = content.trim().to_string();
                    if !version.is_empty() {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(nvmrc),
                        }));
                    }
                }
            }

            // 3. Check .tool-versions file (asdf-style)
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

        // 4. Check package.json engines field
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

        // 5. Fall back to current nvm version
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
        let nvm_dir = self.nvm_dir()?;

        #[cfg(windows)]
        {
            // nvm-windows stores Node.js directly in the version directory (no /bin subdir)
            let node_path = nvm_dir.join(version);
            Ok(EnvModifications::new().prepend_path(node_path))
        }

        #[cfg(not(windows))]
        {
            // POSIX nvm uses versions/node/<version>/bin/
            let node_path = nvm_dir
                .join("versions")
                .join("node")
                .join(version)
                .join("bin");
            Ok(EnvModifications::new().prepend_path(node_path))
        }
    }

    fn version_file_name(&self) -> &str {
        ".node-version"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}
