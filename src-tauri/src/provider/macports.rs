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

/// MacPorts - Package manager for macOS
pub struct MacPortsProvider;

impl MacPortsProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_port(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("port", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a port
    async fn get_port_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_port(&["installed", name]).await?;
        for line in out.lines().skip(1) {
            let line = line.trim();
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 && parts[0] == name {
                return Ok(parts[1].trim_start_matches('@').to_string());
            }
        }
        Err(CogniaError::Provider(format!(
            "Version not found for {}",
            name
        )))
    }
}

impl Default for MacPortsProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for MacPortsProvider {
    fn id(&self) -> &str {
        "macports"
    }

    fn display_name(&self) -> &str {
        "MacPorts"
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
        vec![Platform::MacOS]
    }

    fn priority(&self) -> i32 {
        85
    }

    async fn is_available(&self) -> bool {
        if process::which("port").await.is_none() {
            return false;
        }
        // Verify port actually works
        match process::execute("port", &["version"], None).await {
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
        let out = self
            .run_port(&["search", "--name", "--line", query])
            .await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.is_empty() {
                    return None;
                }

                let name = parts[0].trim().to_string();
                let version = parts.get(1).map(|s| s.trim().to_string());
                let description = parts.get(2).map(|s| s.trim().to_string());

                Some(PackageSummary {
                    name,
                    description,
                    latest_version: version,
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_port(&["info", name]).await?;

        let mut description = None;
        let mut version = None;
        let mut license = None;
        let mut homepage = None;

        for line in out.lines() {
            let line = line.trim();
            if let Some(stripped) = line.strip_prefix("Description:") {
                description = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Version:") {
                version = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("License:") {
                license = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Homepage:") {
                homepage = Some(stripped.trim().into());
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
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            req.name.clone()
        };

        let out = process::execute("sudo", &["port", "install", &pkg], None).await?;
        if !out.success {
            return Err(CogniaError::Installation(out.stderr));
        }

        // Get the actual installed version
        let actual_version = self
            .get_port_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::from("/opt/local"),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.get_port_version(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let out = process::execute("sudo", &["port", "uninstall", &req.name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_port(&["installed"]).await?;

        Ok(out
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let line = line.trim();
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.is_empty() {
                    return None;
                }

                let name = parts[0].to_string();

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                        return None;
                    }
                }

                let version = parts
                    .get(1)
                    .map(|s| s.trim_start_matches('@').to_string())
                    .unwrap_or_default();

                Some(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path: PathBuf::from("/opt/local"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_port(&["outdated"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .skip(1)
                .filter(|l| !l.is_empty())
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        let name = parts[0].to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        Some(UpdateInfo {
                            name,
                            current_version: parts[1].trim_start_matches('@').into(),
                            latest_version: parts[3].trim_start_matches('@').into(),
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
impl SystemPackageProvider for MacPortsProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_port(&["version"]).await?;
        let version = out.split_whitespace().last().unwrap_or("").to_string();
        Ok(version)
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("port")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("port not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install MacPorts from https://www.macports.org/install.php".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["port", "selfupdate"], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute("sudo", &["port", "upgrade", name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["port", "upgrade", "outdated"], None).await?;
        if out.success {
            Ok(vec!["All ports upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_port(&["installed", name]).await;
        Ok(out.map(|s| s.lines().count() > 1).unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = MacPortsProvider::new();
        assert_eq!(p.id(), "macports");
        assert_eq!(p.display_name(), "MacPorts");
        assert_eq!(p.priority(), 85);
    }

    #[test]
    fn test_capabilities() {
        let p = MacPortsProvider::new();
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
        let p = MacPortsProvider::new();
        let platforms = p.supported_platforms();
        assert!(platforms.contains(&Platform::MacOS));
        assert_eq!(platforms.len(), 1);
    }

    #[test]
    fn test_requires_elevation() {
        let p = MacPortsProvider::new();
        assert!(p.requires_elevation("install"));
        assert!(p.requires_elevation("uninstall"));
        assert!(p.requires_elevation("update"));
        assert!(p.requires_elevation("upgrade"));
        assert!(!p.requires_elevation("search"));
    }

    #[test]
    fn test_install_instructions() {
        let p = MacPortsProvider::new();
        let instructions = p.get_install_instructions();
        assert!(instructions.is_some());
        assert!(instructions.unwrap().contains("macports.org"));
    }

    #[test]
    fn test_parse_port_search_output() {
        // port search --name --line output: tab-delimited
        let output = "curl\t8.4.0\tTransfer data with URL syntax\nnginx\t1.25.3\tHTTP and reverse proxy server\n";

        let results: Vec<PackageSummary> = output
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.is_empty() {
                    return None;
                }
                let name = parts[0].trim().to_string();
                let version = parts.get(1).map(|s| s.trim().to_string());
                let description = parts.get(2).map(|s| s.trim().to_string());

                Some(PackageSummary {
                    name,
                    description,
                    latest_version: version,
                    provider: "macports".into(),
                })
            })
            .collect();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].name, "curl");
        assert_eq!(results[0].latest_version, Some("8.4.0".into()));
        assert_eq!(
            results[0].description,
            Some("Transfer data with URL syntax".into())
        );
        assert_eq!(results[1].name, "nginx");
    }

    #[test]
    fn test_parse_port_installed_output() {
        // port installed output: header + indented lines
        let output = "The following ports are currently installed:\n  curl @8.4.0_0 (active)\n  git @2.42.0_0 (active)\n  nginx @1.25.3_0\n";

        let packages: Vec<InstalledPackage> = output
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let line = line.trim();
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.is_empty() {
                    return None;
                }
                let name = parts[0].to_string();
                let version = parts
                    .get(1)
                    .map(|s| s.trim_start_matches('@').to_string())
                    .unwrap_or_default();

                Some(InstalledPackage {
                    name,
                    version,
                    provider: "macports".into(),
                    install_path: PathBuf::from("/opt/local"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect();

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "curl");
        assert_eq!(packages[0].version, "8.4.0_0");
        assert_eq!(packages[1].name, "git");
        assert_eq!(packages[1].version, "2.42.0_0");
        assert_eq!(packages[2].name, "nginx");
        assert!(packages[0]
            .install_path
            .to_str()
            .unwrap()
            .contains("/opt/local"));
    }

    #[test]
    fn test_parse_port_installed_with_name_filter() {
        let output = "The following ports are currently installed:\n  curl @8.4.0_0 (active)\n  git @2.42.0_0 (active)\n  curl-ca-bundle @7.88.1_0 (active)\n";
        let name_filter = Some("curl".to_string());

        let filtered: Vec<String> = output
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let line = line.trim();
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.is_empty() {
                    return None;
                }
                let name = parts[0].to_string();
                if let Some(ref f) = name_filter {
                    if !name.to_lowercase().contains(&f.to_lowercase()) {
                        return None;
                    }
                }
                Some(name)
            })
            .collect();

        assert_eq!(filtered.len(), 2);
        assert_eq!(filtered[0], "curl");
        assert_eq!(filtered[1], "curl-ca-bundle");
    }

    #[test]
    fn test_parse_port_outdated_output() {
        // port outdated output: header + data lines
        let output = "The following installed ports are outdated:\ncurl                           @8.3.0_0  < @8.4.0_0\ngit                            @2.41.0_0 < @2.42.0_0\n";

        let updates: Vec<UpdateInfo> = output
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    Some(UpdateInfo {
                        name: parts[0].to_string(),
                        current_version: parts[1].trim_start_matches('@').into(),
                        latest_version: parts[3].trim_start_matches('@').into(),
                        provider: "macports".into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "curl");
        assert_eq!(updates[0].current_version, "8.3.0_0");
        assert_eq!(updates[0].latest_version, "8.4.0_0");
        assert_eq!(updates[1].name, "git");
    }

    #[test]
    fn test_parse_port_info_output() {
        let output = "curl @8.4.0 (net, www)\nVariants:             gss, sftp_scp\n\nDescription:          curl is a command line tool for transferring data\nHomepage:             https://curl.se/\nLicense:              MIT\n";

        let mut description = None;
        let mut homepage = None;
        let mut license = None;

        for line in output.lines() {
            let line = line.trim();
            if let Some(stripped) = line.strip_prefix("Description:") {
                description = Some(stripped.trim().to_string());
            } else if let Some(stripped) = line.strip_prefix("Homepage:") {
                homepage = Some(stripped.trim().to_string());
            } else if let Some(stripped) = line.strip_prefix("License:") {
                license = Some(stripped.trim().to_string());
            }
        }

        assert_eq!(
            description,
            Some("curl is a command line tool for transferring data".into())
        );
        assert_eq!(homepage, Some("https://curl.se/".into()));
        assert_eq!(license, Some("MIT".into()));
    }

    #[test]
    fn test_default_impl() {
        let p = MacPortsProvider::default();
        assert_eq!(p.id(), "macports");
    }
}
