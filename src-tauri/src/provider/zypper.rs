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

/// Zypper - Package manager for openSUSE and SUSE Linux Enterprise
pub struct ZypperProvider;

impl ZypperProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_zypper(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("zypper", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package using rpm (more reliable than zypper info)
    async fn query_installed_version_rpm(&self, name: &str) -> CogniaResult<String> {
        let out = process::execute(
            "rpm",
            &["-q", "--queryformat", "%{VERSION}-%{RELEASE}", name],
            None,
        )
        .await?;
        if out.success {
            Ok(out.stdout.trim().to_string())
        } else {
            Err(CogniaError::Provider(format!(
                "Package {} not installed",
                name
            )))
        }
    }
}

impl Default for ZypperProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ZypperProvider {
    fn id(&self) -> &str {
        "zypper"
    }

    fn display_name(&self) -> &str {
        "Zypper (openSUSE)"
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
        if process::which("zypper").await.is_none() {
            return false;
        }
        // Verify zypper actually works
        match process::execute("zypper", &["--version"], None).await {
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
        let out = self.run_zypper(&["search", query]).await?;

        Ok(out
            .lines()
            .skip(4)
            .filter(|l| !l.is_empty() && !l.starts_with('-'))
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 3 {
                    let name = parts[1].trim();
                    let summary = parts.get(2).map(|s| s.trim().to_string());

                    Some(PackageSummary {
                        name: name.into(),
                        description: summary,
                        latest_version: None,
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_zypper(&["info", name]).await?;

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
                    "Description" | "Summary" => description = Some(value.into()),
                    "License" => license = Some(value.into()),
                    "URL" => homepage = Some(value.into()),
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
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}={}", req.name, v)
        } else {
            req.name.clone()
        };

        let out = process::execute(
            "sudo",
            &["zypper", "--non-interactive", "install", &pkg],
            None,
        )
        .await?;
        if !out.success {
            return Err(CogniaError::Installation(out.stderr));
        }

        // Get the actual installed version via rpm query
        let actual_version = self
            .query_installed_version_rpm(&req.name)
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

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        // Use rpm query for accurate version detection
        match self.query_installed_version_rpm(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => {
                // Fallback to zypper info
                let out = self.run_zypper(&["info", name]).await?;
                for line in out.lines() {
                    if let Some(version) = line.strip_prefix("Version:") {
                        return Ok(Some(version.trim().to_string()));
                    }
                }
                Ok(None)
            }
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let out = process::execute(
            "sudo",
            &["zypper", "--non-interactive", "remove", &req.name],
            None,
        )
        .await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_zypper(&["search", "--installed-only"]).await?;

        Ok(out
            .lines()
            .skip(4)
            .filter(|l| !l.is_empty() && !l.starts_with('-'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 4 {
                    let name = parts[1].trim().to_string();

                    if let Some(ref name_filter) = filter.name_filter {
                        if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                            return None;
                        }
                    }

                    let version = parts
                        .get(3)
                        .map(|s| s.trim().to_string())
                        .unwrap_or_default();

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
        let out = self.run_zypper(&["list-updates"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .skip(4)
                .filter(|l| !l.is_empty() && !l.starts_with('-'))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() >= 5 {
                        let name = parts[2].trim().to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        Some(UpdateInfo {
                            name,
                            current_version: parts[3].trim().into(),
                            latest_version: parts[4].trim().into(),
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
impl SystemPackageProvider for ZypperProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_zypper(&["--version"]).await?;
        let version = out.split_whitespace().last().unwrap_or("").to_string();
        Ok(version)
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("zypper")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("zypper not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Zypper is the default package manager on openSUSE and SUSE Linux Enterprise. It should be pre-installed.".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["zypper", "refresh"], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute(
            "sudo",
            &["zypper", "--non-interactive", "update", name],
            None,
        )
        .await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out =
            process::execute("sudo", &["zypper", "--non-interactive", "update"], None).await?;
        if out.success {
            Ok(vec!["All packages upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self
            .run_zypper(&["search", "--installed-only", "--match-exact", name])
            .await;
        Ok(out.map(|s| s.contains(name)).unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = ZypperProvider::new();
        assert_eq!(p.id(), "zypper");
        assert_eq!(p.display_name(), "Zypper (openSUSE)");
        assert_eq!(p.priority(), 80);
    }

    #[test]
    fn test_capabilities() {
        let p = ZypperProvider::new();
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
        let p = ZypperProvider::new();
        let platforms = p.supported_platforms();
        assert!(platforms.contains(&Platform::Linux));
        assert_eq!(platforms.len(), 1);
    }

    #[test]
    fn test_requires_elevation() {
        let p = ZypperProvider::new();
        assert!(p.requires_elevation("install"));
        assert!(p.requires_elevation("uninstall"));
        assert!(p.requires_elevation("update"));
        assert!(p.requires_elevation("upgrade"));
        assert!(!p.requires_elevation("search"));
    }

    #[test]
    fn test_install_instructions() {
        let p = ZypperProvider::new();
        let instructions = p.get_install_instructions();
        assert!(instructions.is_some());
        assert!(instructions.unwrap().contains("openSUSE"));
    }

    #[test]
    fn test_parse_zypper_search_output() {
        // zypper search output: skip 4 header lines, pipe-delimited
        let output = "Loading repository data...\nReading installed packages...\n\nS  | Name           | Summary                | Type\n---+----------------+------------------------+--------\ni  | curl           | transfer a URL         | package\n   | curl-devel     | dev files for curl     | package\n   | git            | distributed VCS        | package\n";

        let results: Vec<PackageSummary> = output
            .lines()
            .skip(4)
            .filter(|l| !l.is_empty() && !l.starts_with('-'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 3 {
                    let name = parts[1].trim();
                    let summary = parts.get(2).map(|s| s.trim().to_string());
                    Some(PackageSummary {
                        name: name.into(),
                        description: summary,
                        latest_version: None,
                        provider: "zypper".into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].name, "curl");
        assert_eq!(results[0].description, Some("transfer a URL".into()));
        assert_eq!(results[1].name, "curl-devel");
        assert_eq!(results[2].name, "git");
    }

    #[test]
    fn test_parse_zypper_list_installed_output() {
        let output = "Loading repository data...\nReading installed packages...\n\nS  | Name       | Type    | Version\n---+------------+---------+---------\ni  | curl       | package | 8.4.0-1.1\ni  | git        | package | 2.42.0-1.2\ni  | vim        | package | 9.0.2081-1\n";

        let packages: Vec<InstalledPackage> = output
            .lines()
            .skip(4)
            .filter(|l| !l.is_empty() && !l.starts_with('-'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 4 {
                    let name = parts[1].trim().to_string();
                    let version = parts
                        .get(3)
                        .map(|s| s.trim().to_string())
                        .unwrap_or_default();
                    Some(InstalledPackage {
                        name,
                        version,
                        provider: "zypper".into(),
                        install_path: PathBuf::from("/usr"),
                        installed_at: String::new(),
                        is_global: true,
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "curl");
        assert_eq!(packages[0].version, "8.4.0-1.1");
        assert_eq!(packages[1].name, "git");
        assert_eq!(packages[2].name, "vim");
    }

    #[test]
    fn test_parse_zypper_list_updates_output() {
        let output = "Loading repository data...\nReading installed packages...\n\nS  | Repository | Name   | Current Version | Available Version | Arch\n---+------------+--------+-----------------+-------------------+------\nv  | updates    | curl   | 8.3.0-1.1       | 8.4.0-1.1         | x86_64\nv  | updates    | git    | 2.41.0-1.2      | 2.42.0-1.2        | x86_64\n";

        let updates: Vec<UpdateInfo> = output
            .lines()
            .skip(4)
            .filter(|l| !l.is_empty() && !l.starts_with('-'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 5 {
                    let name = parts[2].trim().to_string();
                    Some(UpdateInfo {
                        name,
                        current_version: parts[3].trim().into(),
                        latest_version: parts[4].trim().into(),
                        provider: "zypper".into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "curl");
        assert_eq!(updates[0].current_version, "8.3.0-1.1");
        assert_eq!(updates[0].latest_version, "8.4.0-1.1");
        assert_eq!(updates[1].name, "git");
    }

    #[test]
    fn test_parse_zypper_info_output() {
        let output = "Name        : curl\nVersion     : 8.4.0-1.1\nSummary     : A tool for transferring data\nLicense     : MIT\nURL         : https://curl.se/\n";

        let mut description = None;
        let mut version = None;
        let mut license = None;
        let mut homepage = None;

        for line in output.lines() {
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                let key = parts[0].trim();
                let value = parts[1].trim();
                match key {
                    "Version" => version = Some(value.to_string()),
                    "Description" | "Summary" => description = Some(value.to_string()),
                    "License" => license = Some(value.to_string()),
                    "URL" => homepage = Some(value.to_string()),
                    _ => {}
                }
            }
        }

        assert_eq!(version, Some("8.4.0-1.1".into()));
        assert_eq!(description, Some("A tool for transferring data".into()));
        assert_eq!(license, Some("MIT".into()));
        assert_eq!(homepage, Some("https://curl.se/".into()));
    }

    #[test]
    fn test_default_impl() {
        let p = ZypperProvider::default();
        assert_eq!(p.id(), "zypper");
    }
}
