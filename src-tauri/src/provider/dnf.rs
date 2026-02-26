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

/// DNF - Dandified YUM package manager for Fedora, RHEL, CentOS Stream
pub struct DnfProvider;

impl DnfProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_dnf(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("dnf", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package using rpm (more reliable than dnf info)
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

impl Default for DnfProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for DnfProvider {
    fn id(&self) -> &str {
        "dnf"
    }

    fn display_name(&self) -> &str {
        "DNF Package Manager"
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
        if process::which("dnf").await.is_none() {
            return false;
        }
        // Verify dnf actually works
        match process::execute("dnf", &["--version"], None).await {
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
        let out = self.run_dnf(&["search", query]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('=') && !l.starts_with("Last metadata"))
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, " : ").collect();
                if parts.len() >= 2 {
                    let name = parts[0].split('.').next()?.trim();
                    Some(PackageSummary {
                        name: name.into(),
                        description: Some(parts[1].trim().into()),
                        latest_version: None,
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .take(limit)
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_dnf(&["info", name]).await?;

        let mut description = None;
        let mut version = None;
        let mut license = None;
        let mut homepage = None;

        for line in out.lines() {
            let line = line.trim();
            // Use splitn(2, ':') to avoid breaking URLs or values containing colons
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                let key = parts[0].trim();
                let value = parts[1].trim();
                match key {
                    "Version" => version = Some(value.into()),
                    "Description" => description = Some(value.into()),
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
        let out = self.run_dnf(&["--showduplicates", "list", name]).await?;

        Ok(out
            .lines()
            .filter(|l| l.contains(name))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
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
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}-{}", req.name, v)
        } else {
            req.name.clone()
        };

        let out = process::execute("sudo", &["dnf", "install", "-y", &pkg], None).await?;
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
        match self.query_installed_version_rpm(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let out = process::execute("sudo", &["dnf", "remove", "-y", &req.name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_dnf(&["list", "installed"]).await?;

        Ok(out
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let full_name = parts[0];
                    let name = full_name.split('.').next()?.to_string();

                    if let Some(ref name_filter) = filter.name_filter {
                        if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                            return None;
                        }
                    }

                    let version = parts[1].to_string();

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
        let out = self.run_dnf(&["check-update"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .filter(|l| !l.is_empty() && !l.starts_with("Last metadata"))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let full_name = parts[0];
                        let name = full_name.split('.').next()?.to_string();

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
impl SystemPackageProvider for DnfProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_dnf(&["--version"]).await?;
        Ok(out.lines().next().unwrap_or("").trim().into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("dnf")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("dnf not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("DNF is the default package manager on Fedora, RHEL 8+, and CentOS Stream. It should be pre-installed.".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["dnf", "makecache"], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute("sudo", &["dnf", "upgrade", "-y", name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["dnf", "upgrade", "-y"], None).await?;
        if out.success {
            Ok(vec!["All packages upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_dnf(&["list", "installed", name]).await;
        Ok(out.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = DnfProvider::new();
        assert_eq!(p.id(), "dnf");
        assert_eq!(p.display_name(), "DNF Package Manager");
        assert_eq!(p.priority(), 80);
    }

    #[test]
    fn test_capabilities() {
        let p = DnfProvider::new();
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
        let p = DnfProvider::new();
        let platforms = p.supported_platforms();
        assert!(platforms.contains(&Platform::Linux));
        assert_eq!(platforms.len(), 1);
    }

    #[test]
    fn test_requires_elevation() {
        let p = DnfProvider::new();
        assert!(p.requires_elevation("install"));
        assert!(p.requires_elevation("uninstall"));
        assert!(p.requires_elevation("update"));
        assert!(p.requires_elevation("upgrade"));
        assert!(!p.requires_elevation("search"));
        assert!(!p.requires_elevation("list"));
    }

    #[test]
    fn test_install_instructions() {
        let p = DnfProvider::new();
        let instructions = p.get_install_instructions();
        assert!(instructions.is_some());
        assert!(instructions.unwrap().contains("Fedora"));
    }

    #[test]
    fn test_parse_dnf_search_output() {
        let output = "Last metadata expiration check: 0:15:32 ago.\n======================== Name Exactly Matched: vim ========================\nvim.x86_64 : The VIM editor\n======================== Name Matched: vim ========================\nvim-enhanced.x86_64 : A version of the VIM editor which includes recent enhancements\nvim-minimal.x86_64 : A minimal version of the VIM editor\n";

        let results: Vec<PackageSummary> = output
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('=') && !l.starts_with("Last metadata"))
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, " : ").collect();
                if parts.len() >= 2 {
                    let name = parts[0].split('.').next()?.trim();
                    Some(PackageSummary {
                        name: name.into(),
                        description: Some(parts[1].trim().into()),
                        latest_version: None,
                        provider: "dnf".into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].name, "vim");
        assert_eq!(results[0].description, Some("The VIM editor".into()));
        assert_eq!(results[1].name, "vim-enhanced");
        assert_eq!(results[2].name, "vim-minimal");
    }

    #[test]
    fn test_parse_dnf_info_output() {
        let output = "Name         : curl\nVersion      : 8.0.1\nRelease      : 4.fc38\nArchitecture : x86_64\nSize         : 768 k\nSource       : curl-8.0.1-4.fc38.src.rpm\nRepository   : updates\nSummary      : A utility for getting files from remote servers\nURL          : https://curl.se/\nLicense      : MIT\nDescription  : curl is a command line tool for transferring data\n";

        let mut description = None;
        let mut version = None;
        let mut license = None;
        let mut homepage = None;

        for line in output.lines() {
            let line = line.trim();
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                let key = parts[0].trim();
                let value = parts[1].trim();
                match key {
                    "Version" => version = Some(value.to_string()),
                    "Description" => description = Some(value.to_string()),
                    "License" => license = Some(value.to_string()),
                    "URL" => homepage = Some(value.to_string()),
                    _ => {}
                }
            }
        }

        assert_eq!(version, Some("8.0.1".into()));
        assert_eq!(
            description,
            Some("curl is a command line tool for transferring data".into())
        );
        assert_eq!(license, Some("MIT".into()));
        assert_eq!(homepage, Some("https://curl.se/".into()));
    }

    #[test]
    fn test_parse_dnf_list_installed_output() {
        let output = "Installed Packages\ncurl.x86_64              8.0.1-4.fc38       @updates\ngit.x86_64               2.41.0-1.fc38      @updates\nvim-enhanced.x86_64      9.0.1927-1.fc38    @updates\n";

        let packages: Vec<InstalledPackage> = output
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let full_name = parts[0];
                    let name = full_name.split('.').next()?.to_string();
                    let version = parts[1].to_string();
                    Some(InstalledPackage {
                        name,
                        version,
                        provider: "dnf".into(),
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
        assert_eq!(packages[0].version, "8.0.1-4.fc38");
        assert_eq!(packages[1].name, "git");
        assert_eq!(packages[2].name, "vim-enhanced");
    }

    #[test]
    fn test_parse_dnf_list_installed_with_name_filter() {
        let output = "Installed Packages\ncurl.x86_64              8.0.1    @updates\ngit.x86_64               2.41.0   @updates\ncurl-devel.x86_64        8.0.1    @updates\n";
        let name_filter = Some("curl".to_string());

        let packages: Vec<String> = output
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0].split('.').next()?.to_string();
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
        assert_eq!(packages[0], "curl");
        assert_eq!(packages[1], "curl-devel");
    }

    #[test]
    fn test_parse_dnf_check_update_output() {
        let output = "Last metadata expiration check: 0:45:12 ago.\n\ncurl.x86_64              8.1.0-1.fc38     updates\ngit.x86_64               2.42.0-1.fc38    updates\n";
        let packages: Vec<String> = vec![];

        let updates: Vec<UpdateInfo> = output
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with("Last metadata"))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let full_name = parts[0];
                    let name = full_name.split('.').next()?.to_string();
                    if !packages.is_empty() && !packages.contains(&name) {
                        return None;
                    }
                    Some(UpdateInfo {
                        name,
                        current_version: String::new(),
                        latest_version: parts[1].into(),
                        provider: "dnf".into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "curl");
        assert_eq!(updates[0].latest_version, "8.1.0-1.fc38");
        assert_eq!(updates[1].name, "git");
    }

    #[test]
    fn test_default_impl() {
        let p = DnfProvider::default();
        assert_eq!(p.id(), "dnf");
    }
}
