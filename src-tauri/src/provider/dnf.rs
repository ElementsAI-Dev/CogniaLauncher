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

/// DNF - Dandified YUM package manager for Fedora, RHEL, CentOS Stream
pub struct DnfProvider;

impl DnfProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_dnf(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("dnf", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package using rpm
    async fn get_installed_version(&self, name: &str) -> CogniaResult<String> {
        let out = process::execute("rpm", &["-q", "--queryformat", "%{VERSION}-%{RELEASE}", name], None).await?;
        if out.success {
            Ok(out.stdout.trim().to_string())
        } else {
            Err(CogniaError::Provider(format!("Package {} not installed", name)))
        }
    }
}

impl Default for DnfProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for DnfProvider {
    fn id(&self) -> &str {
        "dnf"
    }

    fn display_name(&self) -> &str {
        "DNF Package Manager"
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
        if process::which("dnf").await.is_none() {
            return false;
        }
        // Verify dnf actually works
        match process::execute("dnf", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let out = self.run_dnf(&["search", query]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('=') && !l.starts_with("Last metadata"))
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, " : ").collect();
                if parts.len() >= 2 {
                    let name = parts[0].split('.').next()?.trim();
                    Some(PackageSummary {
                        name: name.into(),
                        description: Some(parts[1].trim().into()),
                        latest_version: None,
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .take(limit)
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_dnf(&["info", name]).await?;

        let mut description = None;
        let mut version = None;
        let mut license = None;
        let mut homepage = None;

        for line in out.lines() {
            let line = line.trim();
            if line.starts_with("Version") {
                version = line.split(':').nth(1).map(|s| s.trim().into());
            } else if line.starts_with("Description") {
                description = line.split(':').nth(1).map(|s| s.trim().into());
            } else if line.starts_with("License") {
                license = line.split(':').nth(1).map(|s| s.trim().into());
            } else if line.starts_with("URL") {
                homepage = line.split(':').nth(1).map(|s| s.trim().into());
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
        let out = self.run_dnf(&["--showduplicates", "list", name]).await?;

        Ok(out
            .lines()
            .filter(|l| l.contains(name))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    Some(VersionInfo {
                        version: parts[1].into(),
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
            format!("{}-{}", req.name, v)
        } else {
            req.name.clone()
        };

        let out = process::execute("sudo", &["dnf", "install", "-y", &pkg], None).await?;
        if !out.success {
            return Err(CogniaError::Installation(out.stderr));
        }

        // Get the actual installed version
        let actual_version = self
            .get_installed_version(&req.name)
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

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let out = process::execute("sudo", &["dnf", "remove", "-y", &req.name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_dnf(&["list", "installed"]).await?;

        Ok(out
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let full_name = parts[0];
                    let name = full_name.split('.').next()?.to_string();

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
        let out = self.run_dnf(&["check-update"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .filter(|l| !l.is_empty() && !l.starts_with("Last metadata"))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let full_name = parts[0];
                        let name = full_name.split('.').next()?.to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        Some(UpdateInfo {
                            name,
                            current_version: String::new(),
                            latest_version: parts[1].into(),
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
impl SystemPackageProvider for DnfProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_dnf(&["--version"]).await?;
        Ok(out.lines().next().unwrap_or("").trim().into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("dnf")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("dnf not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("DNF is the default package manager on Fedora, RHEL 8+, and CentOS Stream. It should be pre-installed.".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["dnf", "makecache"], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute("sudo", &["dnf", "upgrade", "-y", name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["dnf", "upgrade", "-y"], None).await?;
        if out.success {
            Ok(vec!["All packages upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_dnf(&["list", "installed", name]).await;
        Ok(out.is_ok())
    }
}
