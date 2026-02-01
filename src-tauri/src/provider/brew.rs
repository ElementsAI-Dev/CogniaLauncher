use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct BrewProvider;

impl BrewProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_brew(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("brew", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }
}

impl Default for BrewProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for BrewProvider {
    fn id(&self) -> &str {
        "brew"
    }
    fn display_name(&self) -> &str {
        "Homebrew"
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
        vec![Platform::MacOS, Platform::Linux]
    }
    fn priority(&self) -> i32 {
        90
    }

    async fn is_available(&self) -> bool {
        process::which("brew").await.is_some()
    }

    async fn search(&self, query: &str, _: SearchOptions) -> CogniaResult<Vec<PackageSummary>> {
        let out = self.run_brew(&["search", query]).await?;
        Ok(out
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('='))
            .map(|name| PackageSummary {
                name: name.trim().into(),
                description: None,
                latest_version: None,
                provider: self.id().into(),
            })
            .take(20)
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_brew(&["info", name]).await?;
        let first_line = out.lines().next().unwrap_or("");
        let parts: Vec<&str> = first_line.split(':').collect();
        let desc = parts.get(1).map(|s| s.trim().to_string());

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: desc,
            homepage: None,
            license: None,
            repository: None,
            versions: self.get_versions(name).await?,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let out = self.run_brew(&["info", "--json=v2", name]).await?;
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            if let Some(versions) = json["formulae"][0]["versions"]["stable"].as_str() {
                return Ok(vec![VersionInfo {
                    version: versions.into(),
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
        let _out = self.run_brew(&["install", &pkg]).await?;
        let prefix = self
            .run_brew(&["--prefix", &req.name])
            .await
            .unwrap_or_default();

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_default(),
            provider: self.id().into(),
            install_path: PathBuf::from(prefix.trim()),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_brew(&["uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, _: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_brew(&["list", "--versions"]).await?;
        Ok(out
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    Some(InstalledPackage {
                        name: parts[0].into(),
                        version: parts[1].into(),
                        provider: self.id().into(),
                        install_path: PathBuf::new(),
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
        let out = self.run_brew(&["outdated", "--json=v2"]).await?;
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            if let Some(formulae) = json["formulae"].as_array() {
                return Ok(formulae
                    .iter()
                    .filter_map(|f| {
                        Some(UpdateInfo {
                            name: f["name"].as_str()?.into(),
                            current_version: f["installed_versions"][0].as_str()?.into(),
                            latest_version: f["current_version"].as_str()?.into(),
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
impl SystemPackageProvider for BrewProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_brew(&["--version"]).await?;
        Ok(out
            .lines()
            .next()
            .unwrap_or("")
            .split_whitespace()
            .nth(1)
            .unwrap_or("")
            .into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("brew")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("brew not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Homebrew: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        self.run_brew(&["update"]).await?;
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_brew(&["upgrade", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        self.run_brew(&["upgrade"]).await?;
        Ok(vec!["All packages upgraded".into()])
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_brew(&["list", name]).await;
        Ok(out.is_ok())
    }
}
