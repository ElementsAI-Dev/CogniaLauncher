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

    /// Get the installed version of a package using dpkg
    async fn query_installed_version_dpkg(&self, name: &str) -> CogniaResult<String> {
        let out = process::execute("dpkg", &["-s", name], None).await?;
        if !out.success {
            return Err(CogniaError::Provider(format!("Package {} not installed", name)));
        }
        for line in out.stdout.lines() {
            if let Some(version) = line.strip_prefix("Version:") {
                return Ok(version.trim().to_string());
            }
        }
        Err(CogniaError::Provider(format!("Version not found for {}", name)))
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
        if process::which("apt-get").await.is_none() {
            return false;
        }
        // Verify apt-get actually works
        match process::execute("apt-get", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
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

        // Get the actual installed version via dpkg query
        let actual_version = self
            .query_installed_version_dpkg(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::from("/usr"),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.query_installed_version_dpkg(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
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

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // Use apt list --upgradable to find available updates
        let out = process::execute("apt", &["list", "--upgradable"], None).await;

        if let Ok(result) = out {
            if result.success {
                return Ok(result.stdout
                    .lines()
                    .filter(|l| !l.is_empty() && l.contains("upgradable"))
                    .filter_map(|line| {
                        // Format: "package/source version arch [upgradable from: old_version]"
                        let name = line.split('/').next()?.to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        let latest = line.split_whitespace().nth(1)?.to_string();
                        let current = line
                            .rsplit("from: ")
                            .next()
                            .map(|s| s.trim_end_matches(']').to_string())
                            .unwrap_or_default();

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
