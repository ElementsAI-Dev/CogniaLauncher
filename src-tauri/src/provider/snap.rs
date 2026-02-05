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

/// Snap - Universal Linux package manager by Canonical
pub struct SnapProvider;

impl SnapProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_snap(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("snap", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }
}

impl Default for SnapProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for SnapProvider {
    fn id(&self) -> &str {
        "snap"
    }

    fn display_name(&self) -> &str {
        "Snap (Universal Linux)"
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
        if process::which("snap").await.is_none() {
            return false;
        }
        // Verify snap actually works
        match process::execute("snap", &["version"], None).await {
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
        let out = self.run_snap(&["find", query]).await?;

        Ok(out
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let name = parts[0].to_string();
                    let version = parts[1].to_string();
                    let description = parts[4..].join(" ");

                    Some(PackageSummary {
                        name,
                        description: if description.is_empty() {
                            None
                        } else {
                            Some(description)
                        },
                        latest_version: Some(version),
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_snap(&["info", name]).await?;

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
                    "stable" | "latest/stable" => {
                        version = value.split_whitespace().next().map(|s| s.into());
                    }
                    "summary" => description = Some(value.into()),
                    "license" => license = Some(value.into()),
                    "contact" | "website" => {
                        if value.starts_with("http") {
                            homepage = Some(value.into());
                        }
                    }
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
        let out = self.run_snap(&["info", name]).await?;

        let mut versions = Vec::new();
        let mut in_channels = false;

        for line in out.lines() {
            if line.starts_with("channels:") {
                in_channels = true;
                continue;
            }

            if in_channels {
                if !line.starts_with("  ") {
                    break;
                }

                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    versions.push(VersionInfo {
                        version: parts[1].into(),
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
        let mut args = vec!["install", &req.name];
        let channel;
        if let Some(v) = &req.version {
            channel = format!("--channel={}", v);
            args.push(&channel);
        }

        let out = process::execute("sudo", &[&["snap"][..], &args[..]].concat(), None).await?;
        if !out.success {
            return Err(CogniaError::Installation(out.stderr));
        }

        // Get the actual installed version
        let actual_version = self
            .get_installed_version(&req.name)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| req.version.clone().unwrap_or_else(|| "unknown".into()));

        Ok(InstallReceipt {
            name: req.name.clone(),
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::from(format!("/snap/{}", req.name)),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        let out = self.run_snap(&["list", name]).await?;
        for line in out.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 && parts[0] == name {
                return Ok(Some(parts[1].to_string()));
            }
        }
        Ok(None)
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let out = process::execute("sudo", &["snap", "remove", &req.name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_snap(&["list"]).await?;

        Ok(out
            .lines()
            .skip(1)
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
                        name: name.clone(),
                        version,
                        provider: self.id().into(),
                        install_path: PathBuf::from(format!("/snap/{}", name)),
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
        let out = self.run_snap(&["refresh", "--list"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .skip(1)
                .filter(|l| !l.is_empty())
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let name = parts[0].to_string();

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
impl SystemPackageProvider for SnapProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_snap(&["version"]).await?;
        for line in out.lines() {
            if line.starts_with("snap") {
                return Ok(line.split_whitespace().nth(1).unwrap_or("").into());
            }
        }
        Ok(String::new())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("snap")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("snap not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install snapd: sudo apt install snapd (Debian/Ubuntu) or sudo dnf install snapd (Fedora)".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute("sudo", &["snap", "refresh", name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["snap", "refresh"], None).await?;
        if out.success {
            Ok(vec!["All snaps refreshed".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_snap(&["list", name]).await;
        Ok(out.is_ok())
    }
}
