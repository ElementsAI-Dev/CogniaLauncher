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

/// Flatpak - Universal Linux application sandboxing and distribution
pub struct FlatpakProvider;

impl FlatpakProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_flatpak(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("flatpak", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a flatpak app
    async fn get_app_version(&self, app_id: &str) -> CogniaResult<String> {
        let out = self.run_flatpak(&["info", app_id]).await?;
        for line in out.lines() {
            if let Some(version) = line.strip_prefix("Version:") {
                return Ok(version.trim().to_string());
            }
        }
        Err(CogniaError::Provider(format!(
            "Version not found for {}",
            app_id
        )))
    }
}

impl Default for FlatpakProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for FlatpakProvider {
    fn id(&self) -> &str {
        "flatpak"
    }

    fn display_name(&self) -> &str {
        "Flatpak (Universal Linux)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux]
    }

    fn priority(&self) -> i32 {
        70
    }

    async fn is_available(&self) -> bool {
        if process::which("flatpak").await.is_none() {
            return false;
        }
        // Verify flatpak actually works
        match process::execute("flatpak", &["--version"], None).await {
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
        let out = self.run_flatpak(&["search", query]).await?;

        Ok(out
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 3 {
                    let name = parts[0].trim().to_string();
                    let description = parts[1].trim().to_string();
                    let app_id = parts[2].trim().to_string();

                    Some(PackageSummary {
                        name: app_id,
                        description: if description.is_empty() {
                            Some(name)
                        } else {
                            Some(description)
                        },
                        latest_version: parts.get(3).map(|s| s.trim().to_string()),
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_flatpak(&["info", name]).await?;

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
                    "Subject" | "Description" => description = Some(value.into()),
                    "License" => license = Some(value.into()),
                    "Homepage" => homepage = Some(value.into()),
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
        let out = self
            .run_flatpak(&["remote-info", "--log", "flathub", name])
            .await?;

        let mut versions = Vec::new();
        for line in out.lines() {
            if line.contains("Version:") {
                if let Some(version) = line.split(':').nth(1) {
                    versions.push(VersionInfo {
                        version: version.trim().into(),
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    });
                }
            }
        }

        Ok(versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let _out = self
            .run_flatpak(&["install", "-y", "flathub", &req.name])
            .await?;

        // Get the actual installed version
        let actual_version = self
            .get_app_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::from("/var/lib/flatpak"),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let _out = self.run_flatpak(&["uninstall", "-y", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self
            .run_flatpak(&["list", "--app", "--columns=application,version"])
            .await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.is_empty() {
                    return None;
                }

                let name = parts[0].trim().to_string();

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                        return None;
                    }
                }

                let version = parts
                    .get(1)
                    .map(|s| s.trim().to_string())
                    .unwrap_or_default();

                Some(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path: PathBuf::from("/var/lib/flatpak"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self
            .run_flatpak(&["remote-ls", "--updates", "--columns=application,version"])
            .await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if parts.is_empty() {
                        return None;
                    }

                    let name = parts[0].trim().to_string();

                    if !packages.is_empty() && !packages.contains(&name) {
                        return None;
                    }

                    Some(UpdateInfo {
                        name,
                        current_version: String::new(),
                        latest_version: parts
                            .get(1)
                            .map(|s| s.trim().to_string())
                            .unwrap_or_default(),
                        provider: self.id().into(),
                    })
                })
                .collect());
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for FlatpakProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_flatpak(&["--version"]).await?;
        let version = out.split_whitespace().last().unwrap_or("").to_string();
        Ok(version)
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("flatpak")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("flatpak not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install flatpak: sudo apt install flatpak (Debian/Ubuntu) or sudo dnf install flatpak (Fedora). Then add Flathub: flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let _out = self.run_flatpak(&["update", "-y", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let _out = self.run_flatpak(&["update", "-y"]).await?;
        Ok(vec!["All flatpaks updated".into()])
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_flatpak(&["info", name]).await;
        Ok(out.is_ok())
    }
}
