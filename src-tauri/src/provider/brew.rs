use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

pub struct BrewProvider;

impl BrewProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_brew(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = process::ProcessOptions::new()
            .with_timeout(Duration::from_secs(300)); // brew operations can be slow
        let out = process::execute("brew", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            let msg = if out.stderr.trim().is_empty() { out.stdout } else { out.stderr };
            Err(CogniaError::Provider(msg))
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
            Capability::Upgrade,
            Capability::UpdateIndex,
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
        let mut args = vec!["install", &*pkg];
        if req.force {
            args.push("--force");
        }
        let _out = self.run_brew(&args).await?;
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
        let mut args = vec!["uninstall", &*req.name];
        if req.force {
            args.push("--force");
        }
        self.run_brew(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_brew(&["list", "--versions"]).await?;
        let brew_prefix = self.run_brew(&["--prefix"]).await
            .map(|s| PathBuf::from(s.trim()))
            .unwrap_or_else(|_| PathBuf::from("/opt/homebrew"));

        Ok(out
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();

                    if let Some(ref name_filter) = filter.name_filter {
                        if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                            return None;
                        }
                    }

                    Some(InstalledPackage {
                        name: name.clone(),
                        version: parts[1].into(),
                        provider: self.id().into(),
                        install_path: brew_prefix.join("Cellar").join(&name),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = BrewProvider::new();
        assert_eq!(p.id(), "brew");
        assert_eq!(p.display_name(), "Homebrew");
        assert_eq!(p.priority(), 90);
    }

    #[test]
    fn test_capabilities() {
        let p = BrewProvider::new();
        let caps = p.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
        assert!(caps.contains(&Capability::UpdateIndex));
        assert_eq!(caps.len(), 7);
    }

    #[test]
    fn test_supported_platforms() {
        let p = BrewProvider::new();
        let platforms = p.supported_platforms();
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
        assert_eq!(platforms.len(), 2);
    }

    #[test]
    fn test_requires_elevation() {
        let p = BrewProvider::new();
        // Homebrew does NOT require elevation for any operation
        assert!(!p.requires_elevation("install"));
        assert!(!p.requires_elevation("uninstall"));
        assert!(!p.requires_elevation("update"));
        assert!(!p.requires_elevation("upgrade"));
    }

    #[test]
    fn test_install_instructions() {
        let p = BrewProvider::new();
        let instructions = p.get_install_instructions();
        assert!(instructions.is_some());
        assert!(instructions.unwrap().contains("Homebrew"));
    }

    #[test]
    fn test_parse_search_output() {
        // brew search returns simple list of names
        let output = "==> Formulae\nnginx\nnginx-full\nnginx-unit\n\n==> Casks\nnginx\n";
        let results: Vec<PackageSummary> = output
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('='))
            .map(|name| PackageSummary {
                name: name.trim().into(),
                description: None,
                latest_version: None,
                provider: "brew".into(),
            })
            .take(20)
            .collect();

        assert_eq!(results.len(), 4);
        assert_eq!(results[0].name, "nginx");
        assert_eq!(results[1].name, "nginx-full");
        assert_eq!(results[3].name, "nginx");
        assert_eq!(results[0].provider, "brew");
    }

    #[test]
    fn test_parse_list_versions_output() {
        let output = "git 2.42.0\nnode 20.10.0 20.9.0\ncurl 8.4.0\n";
        let brew_prefix = PathBuf::from("/opt/homebrew");

        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();
                    Some(InstalledPackage {
                        name: name.clone(),
                        version: parts[1].into(),
                        provider: "brew".into(),
                        install_path: brew_prefix.join("Cellar").join(&name),
                        installed_at: String::new(),
                        is_global: true,
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "git");
        assert_eq!(packages[0].version, "2.42.0");
        assert_eq!(packages[1].name, "node");
        assert_eq!(packages[1].version, "20.10.0"); // First version listed
        assert_eq!(packages[2].name, "curl");
        assert!(packages[0].install_path.ends_with("Cellar/git") || packages[0].install_path.ends_with("Cellar\\git"));
    }

    #[test]
    fn test_parse_list_versions_with_name_filter() {
        let output = "git 2.42.0\nnode 20.10.0\ncurl 8.4.0\ngit-lfs 3.4.0\n";
        let name_filter = Some("git".to_string());

        let packages: Vec<&str> = output
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0];
                    if let Some(ref f) = name_filter {
                        if !name.to_lowercase().contains(&f.to_lowercase()) {
                            return None;
                        }
                    }
                    Some(name)
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0], "git");
        assert_eq!(packages[1], "git-lfs");
    }

    #[test]
    fn test_parse_outdated_json() {
        let json_str = r#"{"formulae":[{"name":"git","installed_versions":["2.41.0"],"current_version":"2.42.0"},{"name":"curl","installed_versions":["8.3.0"],"current_version":"8.4.0"}],"casks":[]}"#;
        let json: serde_json::Value = serde_json::from_str(json_str).unwrap();

        let updates: Vec<UpdateInfo> = json["formulae"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|f| {
                Some(UpdateInfo {
                    name: f["name"].as_str()?.into(),
                    current_version: f["installed_versions"][0].as_str()?.into(),
                    latest_version: f["current_version"].as_str()?.into(),
                    provider: "brew".into(),
                })
            })
            .collect();

        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "git");
        assert_eq!(updates[0].current_version, "2.41.0");
        assert_eq!(updates[0].latest_version, "2.42.0");
        assert_eq!(updates[1].name, "curl");
    }

    #[test]
    fn test_parse_brew_info_json_formula() {
        let json_str = r#"{"formulae":[{"full_name":"git","desc":"Distributed revision control system","homepage":"https://git-scm.com","license":"GPL-2.0-only","versions":{"stable":"2.42.0"},"deprecated":false,"installed":[{"version":"2.42.0"}]}],"casks":[]}"#;
        let json: serde_json::Value = serde_json::from_str(json_str).unwrap();
        let pkg = &json["formulae"][0];

        assert_eq!(pkg["full_name"].as_str().unwrap(), "git");
        assert_eq!(pkg["desc"].as_str().unwrap(), "Distributed revision control system");
        assert_eq!(pkg["homepage"].as_str().unwrap(), "https://git-scm.com");
        assert_eq!(pkg["license"].as_str().unwrap(), "GPL-2.0-only");
        assert_eq!(pkg["versions"]["stable"].as_str().unwrap(), "2.42.0");
        assert_eq!(pkg["installed"][0]["version"].as_str().unwrap(), "2.42.0");
    }

    #[test]
    fn test_default_impl() {
        let p = BrewProvider::default();
        assert_eq!(p.id(), "brew");
    }
}
