use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct ChocolateyProvider;

impl ChocolateyProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_choco(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("choco", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package using choco list
    async fn query_installed_version(&self, name: &str) -> CogniaResult<String> {
        // In Chocolatey v2+, `choco list` only lists local packages (--local-only was removed)
        let out = self.run_choco(&["list", "-r"]).await?;
        for line in out.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 2 && parts[0].eq_ignore_ascii_case(name) {
                return Ok(parts[1].to_string());
            }
        }
        Err(CogniaError::Provider(format!("Package {} not installed", name)))
    }

    fn get_choco_dir() -> PathBuf {
        std::env::var("ChocolateyInstall")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("C:\\ProgramData\\chocolatey"))
    }
}

impl Default for ChocolateyProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ChocolateyProvider {
    fn id(&self) -> &str {
        "chocolatey"
    }
    fn display_name(&self) -> &str {
        "Chocolatey (Windows Package Manager)"
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
        88
    }

    async fn is_available(&self) -> bool {
        if process::which("choco").await.is_none() {
            return false;
        }
        // Verify choco actually works
        match process::execute("choco", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20).to_string();
        let out = self
            .run_choco(&["search", query, "--limit", &limit, "-r"])
            .await?;

        // -r flag gives parseable output: name|version
        let packages: Vec<PackageSummary> = out
            .lines()
            .filter(|l| !l.is_empty() && l.contains('|'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 2 {
                    Some(PackageSummary {
                        name: parts[0].into(),
                        description: None,
                        latest_version: Some(parts[1].into()),
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(packages)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_choco(&["info", name, "-r"]).await?;

        let mut version = None;
        let mut description = None;

        // Parse chocolatey info output
        for line in out.lines() {
            if line.contains('|') {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 2 && parts[0] == name {
                    version = Some(parts[1].to_string());
                }
            }
        }

        // Try to get more detailed info
        if let Ok(detailed) = self.run_choco(&["info", name]).await {
            for line in detailed.lines() {
                let line = line.trim();
                if line.starts_with("Description:") || line.starts_with("Summary:") {
                    let start = line.find(':').unwrap_or(0) + 1;
                    description = Some(line[start..].trim().into());
                    break;
                }
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage: Some(format!(
                "https://community.chocolatey.org/packages/{}",
                name
            )),
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
            .run_choco(&["search", name, "--all-versions", "-r", "--limit", "20"])
            .await?;

        let versions: Vec<VersionInfo> = out
            .lines()
            .filter(|l| l.contains('|'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 2 && parts[0] == name {
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
            .collect();

        Ok(versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["install", &req.name, "-y"];
        let ver;
        if let Some(v) = &req.version {
            ver = v.clone();
            args.extend(&["--version", &ver]);
        }

        self.run_choco(&args).await?;

        // Get the actual installed version
        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = Self::get_choco_dir().join("lib").join(&req.name);

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
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_choco(&["uninstall", &req.name, "-y"]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_choco(&["list", "-r"]).await?;
        let choco_dir = Self::get_choco_dir();

        let packages: Vec<InstalledPackage> = out
            .lines()
            .filter(|l| l.contains('|'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();

                    if let Some(name_filter) = &filter.name_filter {
                        if !name.contains(name_filter) {
                            return None;
                        }
                    }

                    let version = parts[1].to_string();
                    let install_path = choco_dir.join("lib").join(&name);

                    Some(InstalledPackage {
                        name,
                        version,
                        provider: self.id().into(),
                        install_path,
                        installed_at: String::new(),
                        is_global: true,
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_choco(&["outdated", "-r"]).await;

        if let Ok(output) = out {
            let updates: Vec<UpdateInfo> = output
                .lines()
                .filter(|l| l.contains('|'))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() >= 4 {
                        let name = parts[0].to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        let current = parts[1].to_string();
                        let latest = parts[2].to_string();

                        Some(UpdateInfo {
                            name,
                            current_version: current,
                            latest_version: latest,
                            provider: self.id().into(),
                        })
                    } else {
                        None
                    }
                })
                .collect();

            return Ok(updates);
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for ChocolateyProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, operation: &str) -> bool {
        // Chocolatey typically requires admin for install/uninstall
        matches!(operation, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_choco(&["--version"]).await?;
        Ok(out.trim().into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("choco")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("choco not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "Install Chocolatey: https://chocolatey.org/install (requires admin PowerShell)".into(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_choco(&["upgrade", name, "-y"]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        self.run_choco(&["upgrade", "all", "-y"]).await?;
        Ok(vec!["All packages upgraded".into()])
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_choco(&["list", "-r"]).await;
        Ok(out
            .map(|s| s.lines().any(|l| l.split('|').next() == Some(name)))
            .unwrap_or(false))
    }
}
