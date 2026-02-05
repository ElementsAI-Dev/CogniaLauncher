use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct ScoopProvider;

impl ScoopProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_scoop(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("scoop", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package
    async fn get_installed_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_scoop(&["info", name]).await?;
        for line in out.lines() {
            let line = line.trim();
            if let Some(version) = line.strip_prefix("Version:") {
                return Ok(version.trim().to_string());
            }
            // Also check "Installed:" line which shows current version
            if let Some(installed) = line.strip_prefix("Installed:") {
                let installed = installed.trim();
                if !installed.is_empty() && installed != "No" {
                    return Ok(installed.to_string());
                }
            }
        }
        Err(CogniaError::Provider(format!("Version not found for {}", name)))
    }

    fn get_scoop_dir() -> Option<PathBuf> {
        std::env::var("SCOOP").ok().map(PathBuf::from).or_else(|| {
            std::env::var("USERPROFILE")
                .ok()
                .map(|h| PathBuf::from(h).join("scoop"))
        })
    }
}

impl Default for ScoopProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ScoopProvider {
    fn id(&self) -> &str {
        "scoop"
    }
    fn display_name(&self) -> &str {
        "Scoop (Windows Package Manager)"
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
        85
    }

    async fn is_available(&self) -> bool {
        if process::which("scoop").await.is_none() {
            return false;
        }
        // Verify scoop actually works
        match process::execute("scoop", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let out = self.run_scoop(&["search", query]).await?;
        let limit = options.limit.unwrap_or(20);

        // Parse scoop search output
        // Format: 'name' (version) bucket
        let packages: Vec<PackageSummary> = out
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with("Results") && l.contains('\''))
            .take(limit)
            .filter_map(|line| {
                // Extract name between quotes
                let name_start = line.find('\'')?;
                let name_end = line[name_start + 1..].find('\'')? + name_start + 1;
                let name = &line[name_start + 1..name_end];

                // Extract version in parentheses
                let version = line
                    .find('(')
                    .and_then(|start| line.find(')').map(|end| &line[start + 1..end]))
                    .map(|v| v.to_string());

                Some(PackageSummary {
                    name: name.into(),
                    description: None,
                    latest_version: version,
                    provider: self.id().into(),
                })
            })
            .collect();

        Ok(packages)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_scoop(&["info", name]).await?;

        let mut description = None;
        let mut version = None;
        let mut homepage = None;
        let mut license = None;

        for line in out.lines() {
            let line = line.trim();
            if let Some(stripped) = line.strip_prefix("Description:") {
                description = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Version:") {
                version = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Website:") {
                homepage = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Homepage:") {
                homepage = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("License:") {
                license = Some(stripped.trim().into());
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
        // Scoop doesn't have a direct versions command, use info
        let out = self.run_scoop(&["info", name]).await?;

        for line in out.lines() {
            if line.trim().starts_with("Version:") {
                let version = line.trim()[8..].trim().to_string();
                return Ok(vec![VersionInfo {
                    version,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                }]);
            }
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            req.name.clone()
        };

        self.run_scoop(&["install", &pkg]).await?;

        // Get the actual installed version
        let actual_version = self
            .get_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = Self::get_scoop_dir()
            .map(|p| p.join("apps").join(&req.name).join("current"))
            .unwrap_or_default();

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
        self.run_scoop(&["uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_scoop(&["list"]).await?;
        let scoop_dir = Self::get_scoop_dir().unwrap_or_default();

        let packages: Vec<InstalledPackage> = out
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with("Installed") && !l.starts_with("Name"))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.is_empty() {
                    return None;
                }

                let name = parts[0].to_string();

                if let Some(name_filter) = &filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                let version = parts.get(1).unwrap_or(&"").to_string();
                let install_path = scoop_dir.join("apps").join(&name);

                Some(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path,
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_scoop(&["status"]).await;

        if let Ok(output) = out {
            let updates: Vec<UpdateInfo> = output
                .lines()
                .filter(|l| !l.is_empty() && !l.starts_with("Name") && !l.starts_with("---"))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        let name = parts[0].to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        let current = parts[1].to_string();
                        let latest = parts[2].to_string();

                        if current != latest {
                            Some(UpdateInfo {
                                name,
                                current_version: current,
                                latest_version: latest,
                                provider: self.id().into(),
                            })
                        } else {
                            None
                        }
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
impl SystemPackageProvider for ScoopProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false // Scoop is user-space
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_scoop(&["--version"]).await?;
        for line in out.lines() {
            if line.starts_with("Scoop") {
                return Ok(line.split_whitespace().last().unwrap_or("").into());
            }
        }
        Ok(String::new())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("scoop")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("scoop not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Scoop: irm get.scoop.sh | iex (PowerShell)".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        self.run_scoop(&["update"]).await?;
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_scoop(&["update", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        self.run_scoop(&["update", "*"]).await?;
        Ok(vec!["All packages upgraded".into()])
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_scoop(&["list"]).await;
        Ok(out
            .map(|s| s.lines().any(|l| l.split_whitespace().next() == Some(name)))
            .unwrap_or(false))
    }
}
