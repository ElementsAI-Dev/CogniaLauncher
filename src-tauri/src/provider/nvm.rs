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

        let nvm_dir = self.nvm_dir()?;
        let install_path = nvm_dir.join("versions").join("node").join(version);

        Ok(InstallReceipt {
            name: "node".to_string(),
            version: version.to_string(),
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
        _filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_nvm(&["ls"]).await?;
        let nvm_dir = self.nvm_dir()?;

        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                let version = line.split_whitespace().find(|s| s.starts_with('v'))?;

                Some(InstalledPackage {
                    name: "node".to_string(),
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

        loop {
            let version_file = current.join(self.version_file_name());
            if version_file.exists() {
                let version = crate::platform::fs::read_file_string(&version_file).await?;
                return Ok(Some(VersionDetection {
                    version: version.trim().to_string(),
                    source: VersionSource::LocalFile,
                    source_path: Some(version_file),
                }));
            }

            let nvmrc = current.join(".nvmrc");
            if nvmrc.exists() {
                let version = crate::platform::fs::read_file_string(&nvmrc).await?;
                return Ok(Some(VersionDetection {
                    version: version.trim().to_string(),
                    source: VersionSource::LocalFile,
                    source_path: Some(nvmrc),
                }));
            }

            if !current.pop() {
                break;
            }
        }

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
        let node_path = nvm_dir
            .join("versions")
            .join("node")
            .join(version)
            .join("bin");

        Ok(EnvModifications::new().prepend_path(node_path))
    }

    fn version_file_name(&self) -> &str {
        ".node-version"
    }
}
