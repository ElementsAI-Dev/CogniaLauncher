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

    /// Get the installed version of a package using brew info JSON
    async fn query_installed_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_brew(&["info", "--json=v2", name]).await?;
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            // Check formulae first
            if let Some(versions) = json["formulae"][0]["installed"][0]["version"].as_str() {
                return Ok(versions.to_string());
            }
            // Check casks
            if let Some(versions) = json["casks"][0]["installed"].as_str() {
                return Ok(versions.to_string());
            }
        }
        Err(CogniaError::Provider(format!("Version not found for {}", name)))
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
        if process::which("brew").await.is_none() {
            return false;
        }
        // Verify brew actually works
        match process::execute("brew", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
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
        // Use JSON API for richer info (description, homepage, license)
        let out = self.run_brew(&["info", "--json=v2", name]).await?;
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
            // Try formulae first, then casks
            let pkg = json["formulae"].get(0)
                .or_else(|| json["casks"].get(0));

            if let Some(pkg) = pkg {
                let version = pkg["versions"]["stable"].as_str()
                    .or_else(|| pkg["version"].as_str())
                    .map(|s| s.to_string());

                return Ok(PackageInfo {
                    name: name.into(),
                    display_name: pkg["full_name"].as_str()
                        .or_else(|| pkg["token"].as_str())
                        .map(|s| s.to_string()),
                    description: pkg["desc"].as_str().map(|s| s.to_string()),
                    homepage: pkg["homepage"].as_str().map(|s| s.to_string()),
                    license: pkg["license"].as_str().map(|s| s.to_string()),
                    repository: None,
                    versions: version
                        .map(|v| vec![VersionInfo {
                            version: v,
                            release_date: None,
                            deprecated: pkg["deprecated"].as_bool().unwrap_or(false),
                            yanked: false,
                        }])
                        .unwrap_or_default(),
                    provider: self.id().into(),
                });
            }
        }

        // Fallback to text parsing
        let out = self.run_brew(&["info", name]).await?;
        let first_line = out.lines().next().unwrap_or("");
        let parts: Vec<&str> = first_line.splitn(2, ':').collect();
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

        // Get the actual installed version
        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::from(prefix.trim()),
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
        self.run_brew(&["uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, _: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_brew(&["list", "--versions"]).await?;
        let brew_prefix = self.run_brew(&["--prefix"]).await
            .map(|s| PathBuf::from(s.trim()))
            .unwrap_or_else(|_| PathBuf::from("/opt/homebrew"));

        Ok(out
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0];
                    Some(InstalledPackage {
                        name: name.into(),
                        version: parts[1].into(),
                        provider: self.id().into(),
                        install_path: brew_prefix.join("Cellar").join(name),
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
