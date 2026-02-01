use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct AptProvider;

impl AptProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_apt(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("apt-cache", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }
}

impl Default for AptProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for AptProvider {
    fn id(&self) -> &str {
        "apt"
    }
    fn display_name(&self) -> &str {
        "APT Package Manager"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
        ])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux]
    }
    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        process::which("apt-get").await.is_some()
    }

    async fn search(&self, query: &str, _: SearchOptions) -> CogniaResult<Vec<PackageSummary>> {
        let out = self.run_apt(&["search", query]).await?;
        Ok(out
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split(" - ").collect();
                if parts.len() >= 2 {
                    let name = parts[0].split('/').next()?.trim();
                    Some(PackageSummary {
                        name: name.into(),
                        description: Some(parts[1].into()),
                        latest_version: None,
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .take(20)
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_apt(&["show", name]).await?;
        let mut desc = None;
        let mut version = None;
        for line in out.lines() {
            if let Some(stripped) = line.strip_prefix("Description:") {
                desc = Some(stripped.trim().into());
            }
            if let Some(stripped) = line.strip_prefix("Version:") {
                version = Some(stripped.trim().into());
            }
        }
        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: desc,
            homepage: None,
            license: None,
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
        let out = self.run_apt(&["policy", name]).await?;
        Ok(out
            .lines()
            .filter_map(|l| {
                let l = l.trim();
                if l.contains("***") || l.starts_with(char::is_numeric) {
                    let v = l.split_whitespace().next()?;
                    Some(VersionInfo {
                        version: v.into(),
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    })
                } else {
                    None
                }
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}={}", req.name, v)
        } else {
            req.name.clone()
        };
        let out = process::execute("sudo", &["apt-get", "install", "-y", &pkg], None).await?;
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
        let out = process::execute("sudo", &["apt-get", "remove", "-y", &req.name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, _: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = process::execute("dpkg", &["-l"], None).await?;
        Ok(out
            .stdout
            .lines()
            .skip(5)
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 3 && parts[0] == "ii" {
                    Some(InstalledPackage {
                        name: parts[1].into(),
                        version: parts[2].into(),
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

    async fn check_updates(&self, _: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for AptProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = process::execute("apt", &["--version"], None).await?;
        Ok(out.stdout.lines().next().unwrap_or("").trim().into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("apt")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("apt not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "APT is the default package manager on Debian/Ubuntu. It should be pre-installed."
                .into(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["apt-get", "update"], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute(
            "sudo",
            &["apt-get", "install", "--only-upgrade", "-y", name],
            None,
        )
        .await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["apt-get", "upgrade", "-y"], None).await?;
        if out.success {
            Ok(vec!["All packages upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = process::execute("dpkg", &["-s", name], None).await;
        Ok(out.map(|o| o.success).unwrap_or(false))
    }
}
