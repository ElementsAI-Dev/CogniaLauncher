use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct WingetProvider;

impl WingetProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_winget(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("winget", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package using winget show
    async fn get_installed_version(&self, id: &str) -> CogniaResult<String> {
        let out = self.run_winget(&["show", "--id", id, "--accept-source-agreements"]).await?;
        
        for line in out.lines() {
            if let Some(version) = line.strip_prefix("Version:") {
                return Ok(version.trim().to_string());
            }
        }
        
        Err(CogniaError::Provider(format!("Version not found for {}", id)))
    }
}

impl Default for WingetProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for WingetProvider {
    fn id(&self) -> &str {
        "winget"
    }
    fn display_name(&self) -> &str {
        "Windows Package Manager"
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
        vec![Platform::Windows]
    }
    fn priority(&self) -> i32 {
        90
    }

    async fn is_available(&self) -> bool {
        system_detection::is_command_available("winget", &["--version"]).await
    }

    async fn search(&self, query: &str, _: SearchOptions) -> CogniaResult<Vec<PackageSummary>> {
        let out = self
            .run_winget(&["search", query, "--accept-source-agreements"])
            .await?;
        Ok(out
            .lines()
            .skip(2)
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    Some(PackageSummary {
                        name: parts[0].into(),
                        description: None,
                        latest_version: parts.get(1).map(|s| s.to_string()),
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
        let out = self
            .run_winget(&["show", name, "--accept-source-agreements"])
            .await?;
        let mut desc = None;
        let mut version = None;
        let mut homepage = None;

        for line in out.lines() {
            if let Some(stripped) = line.strip_prefix("Description:") {
                desc = Some(stripped.trim().into());
            }
            if let Some(stripped) = line.strip_prefix("Version:") {
                version = Some(stripped.trim().into());
            }
            if let Some(stripped) = line.strip_prefix("Homepage:") {
                homepage = Some(stripped.trim().into());
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: desc,
            homepage,
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
        let out = self
            .run_winget(&["show", name, "--versions", "--accept-source-agreements"])
            .await?;
        Ok(out
            .lines()
            .skip(2)
            .filter_map(|l| {
                let v = l.trim();
                if !v.is_empty() {
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
        let mut args = vec![
            "install",
            "--id",
            &req.name,
            "--accept-package-agreements",
            "--accept-source-agreements",
        ];
        let ver;
        if let Some(v) = &req.version {
            ver = v.clone();
            args.extend(&["--version", &ver]);
        }

        let _out = self.run_winget(&args).await?;

        // Get the actual installed version
        let actual_version = self
            .get_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        // Winget installs to Program Files typically
        let install_path = std::env::var("ProgramFiles")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("C:\\Program Files"));

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
        self.run_winget(&["uninstall", "--id", &req.name, "--accept-source-agreements"])
            .await?;
        Ok(())
    }

    async fn list_installed(&self, _: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self
            .run_winget(&["list", "--accept-source-agreements"])
            .await?;
        
        // Common Windows install paths
        let program_files = std::env::var("ProgramFiles")
            .unwrap_or_else(|_| "C:\\Program Files".to_string());

        Ok(out
            .lines()
            .skip(2)
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name: String = parts[0].into();
                    Some(InstalledPackage {
                        name: name.clone(),
                        version: parts.get(1).unwrap_or(&"").to_string(),
                        provider: self.id().into(),
                        install_path: PathBuf::from(&program_files).join(&name),
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
        let out = self
            .run_winget(&["upgrade", "--accept-source-agreements"])
            .await?;
        Ok(out
            .lines()
            .skip(2)
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 3 {
                    Some(UpdateInfo {
                        name: parts[0].into(),
                        current_version: parts[1].into(),
                        latest_version: parts[2].into(),
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .collect())
    }
}

#[async_trait]
impl SystemPackageProvider for WingetProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_winget(&["--version"]).await?;
        Ok(out.trim().trim_start_matches('v').into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("winget")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("winget not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("WinGet is included with Windows 11 and App Installer from Microsoft Store on Windows 10.".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        self.run_winget(&["source", "update"]).await?;
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_winget(&[
            "upgrade",
            "--id",
            name,
            "--accept-package-agreements",
            "--accept-source-agreements",
        ])
        .await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        self.run_winget(&[
            "upgrade",
            "--all",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ])
        .await?;
        Ok(vec!["All packages upgraded".into()])
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self
            .run_winget(&["list", "--id", name, "--accept-source-agreements"])
            .await;
        Ok(out.map(|s| s.lines().count() > 2).unwrap_or(false))
    }
}
