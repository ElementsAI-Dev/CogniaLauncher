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

/// Pacman - Package manager for Arch Linux and derivatives
pub struct PacmanProvider;

impl PacmanProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_pacman(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("pacman", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }
}

impl Default for PacmanProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for PacmanProvider {
    fn id(&self) -> &str {
        "pacman"
    }

    fn display_name(&self) -> &str {
        "Pacman (Arch Linux)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
            Capability::UpdateIndex,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux]
    }

    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        process::which("pacman").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let out = self.run_pacman(&["-Ss", query]).await?;

        let mut packages = Vec::new();
        let mut lines = out.lines().peekable();

        while let Some(line) = lines.next() {
            if line.starts_with(' ') || line.is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let full_name = parts[0];
                let name = full_name.split('/').next_back().unwrap_or(full_name);
                let version = parts[1].to_string();

                let description = lines
                    .peek()
                    .filter(|l| l.starts_with(' '))
                    .map(|l| l.trim().to_string());

                if description.is_some() {
                    lines.next();
                }

                packages.push(PackageSummary {
                    name: name.into(),
                    description,
                    latest_version: Some(version),
                    provider: self.id().into(),
                });

                if packages.len() >= limit {
                    break;
                }
            }
        }

        Ok(packages)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_pacman(&["-Si", name]).await?;

        let mut description = None;
        let mut version = None;
        let mut license = None;
        let mut homepage = None;

        for line in out.lines() {
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                let key = parts[0].trim();
                let value = parts[1].trim();

                match key {
                    "Version" => version = Some(value.into()),
                    "Description" => description = Some(value.into()),
                    "Licenses" => license = Some(value.into()),
                    "URL" => homepage = Some(value.into()),
                    _ => {}
                }
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage,
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
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let out =
            process::execute("sudo", &["pacman", "-S", "--noconfirm", &req.name], None).await?;
        if !out.success {
            return Err(CogniaError::Installation(out.stderr));
        }

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_default(),
            provider: self.id().into(),
            install_path: PathBuf::from("/usr"),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let out =
            process::execute("sudo", &["pacman", "-R", "--noconfirm", &req.name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_pacman(&["-Q"]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();

                    if let Some(ref name_filter) = filter.name_filter {
                        if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                            return None;
                        }
                    }

                    let version = parts[1].to_string();

                    Some(InstalledPackage {
                        name,
                        version,
                        provider: self.id().into(),
                        install_path: PathBuf::from("/usr"),
                        installed_at: String::new(),
                        is_global: true,
                    })
                } else {
                    None
                }
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_pacman(&["-Qu"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        let name = parts[0].to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        Some(UpdateInfo {
                            name,
                            current_version: parts[1].into(),
                            latest_version: parts[3].into(),
                            provider: self.id().into(),
                        })
                    } else {
                        None
                    }
                })
                .collect());
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for PacmanProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_pacman(&["--version"]).await?;
        let first_line = out.lines().next().unwrap_or("");
        let version = first_line
            .split_whitespace()
            .last()
            .unwrap_or("")
            .trim_matches('v');
        Ok(version.into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("pacman")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("pacman not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Pacman is the default package manager on Arch Linux and derivatives. It should be pre-installed.".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["pacman", "-Sy"], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute("sudo", &["pacman", "-S", "--noconfirm", name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["pacman", "-Syu", "--noconfirm"], None).await?;
        if out.success {
            Ok(vec!["System upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_pacman(&["-Q", name]).await;
        Ok(out.is_ok())
    }
}
