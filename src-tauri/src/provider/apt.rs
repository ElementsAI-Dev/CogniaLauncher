use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

pub struct AptProvider;

impl AptProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_apt(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = process::ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("apt-cache", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package using dpkg
    async fn query_installed_version_dpkg(&self, name: &str) -> CogniaResult<String> {
        let out = process::execute("dpkg", &["-s", name], None).await?;
        if !out.success {
            return Err(CogniaError::Provider(format!(
                "Package {} not installed",
                name
            )));
        }
        for line in out.stdout.lines() {
            if let Some(version) = line.strip_prefix("Version:") {
                return Ok(version.trim().to_string());
            }
        }
        Err(CogniaError::Provider(format!(
            "Version not found for {}",
            name
        )))
    }
}

impl Default for AptProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for AptProvider {
    fn id(&self) -> &str {
        "apt"
    }
    fn display_name(&self) -> &str {
        "APT Package Manager"
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
        if process::which("apt-get").await.is_none() {
            return false;
        }
        // Verify apt-get actually works
        match process::execute("apt-get", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(&self, query: &str, _: SearchOptions) -> CogniaResult<Vec<PackageSummary>> {
        let out = self.run_apt(&["search", query]).await?;
        Ok(out
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split(" - ").collect();
                if parts.len() >= 2 {
                    let name = parts[0].split('/').next()?.trim();
                    Some(PackageSummary {
                        name: name.into(),
                        description: Some(parts[1].into()),
                        latest_version: None,
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .take(20)
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_apt(&["show", name]).await?;
        let mut desc = None;
        let mut version = None;
        for line in out.lines() {
            if let Some(stripped) = line.strip_prefix("Description:") {
                desc = Some(stripped.trim().into());
            }
            if let Some(stripped) = line.strip_prefix("Version:") {
                version = Some(stripped.trim().into());
            }
        }
        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: desc,
            homepage: None,
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
        let out = self.run_apt(&["policy", name]).await?;
        Ok(out
            .lines()
            .filter_map(|l| {
                let l = l.trim();
                if l.contains("***") || l.starts_with(char::is_numeric) {
                    let v = l.split_whitespace().next()?;
                    Some(VersionInfo {
                        version: v.into(),
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
            format!("{}={}", req.name, v)
        } else {
            req.name.clone()
        };
        let out = process::execute("sudo", &["apt-get", "install", "-y", &pkg], None).await?;
        if !out.success {
            return Err(CogniaError::Installation(out.stderr));
        }

        // Get the actual installed version via dpkg query
        let actual_version = self
            .query_installed_version_dpkg(&req.name)
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
        match self.query_installed_version_dpkg(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let out = process::execute("sudo", &["apt-get", "remove", "-y", &req.name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = process::execute("dpkg", &["-l"], None).await?;
        Ok(out
            .stdout
            .lines()
            .skip(5)
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 3 && parts[0] == "ii" {
                    let name = parts[1].to_string();

                    if let Some(ref name_filter) = filter.name_filter {
                        if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                            return None;
                        }
                    }

                    Some(InstalledPackage {
                        name,
                        version: parts[2].into(),
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
        // Use apt list --upgradable to find available updates
        let out = process::execute("apt", &["list", "--upgradable"], None).await;

        if let Ok(result) = out {
            if result.success {
                return Ok(result
                    .stdout
                    .lines()
                    .filter(|l| !l.is_empty() && l.contains("upgradable"))
                    .filter_map(|line| {
                        // Format: "package/source version arch [upgradable from: old_version]"
                        let name = line.split('/').next()?.to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        let latest = line.split_whitespace().nth(1)?.to_string();
                        let current = line
                            .rsplit("from: ")
                            .next()
                            .map(|s| s.trim_end_matches(']').to_string())
                            .unwrap_or_default();

                        Some(UpdateInfo {
                            name,
                            current_version: current,
                            latest_version: latest,
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
impl SystemPackageProvider for AptProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = process::execute("apt", &["--version"], None).await?;
        Ok(out.stdout.lines().next().unwrap_or("").trim().into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("apt")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("apt not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "APT is the default package manager on Debian/Ubuntu. It should be pre-installed."
                .into(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["apt-get", "update"], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute(
            "sudo",
            &["apt-get", "install", "--only-upgrade", "-y", name],
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
        let out = process::execute("sudo", &["apt-get", "upgrade", "-y"], None).await?;
        if out.success {
            Ok(vec!["All packages upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = process::execute("dpkg", &["-s", name], None).await;
        Ok(out.map(|o| o.success).unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = AptProvider::new();
        assert_eq!(p.id(), "apt");
        assert_eq!(p.display_name(), "APT Package Manager");
        assert_eq!(p.priority(), 80);
    }

    #[test]
    fn test_capabilities() {
        let p = AptProvider::new();
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
        let p = AptProvider::new();
        let platforms = p.supported_platforms();
        assert!(platforms.contains(&Platform::Linux));
        assert_eq!(platforms.len(), 1);
    }

    #[test]
    fn test_requires_elevation() {
        let p = AptProvider::new();
        assert!(p.requires_elevation("install"));
        assert!(p.requires_elevation("uninstall"));
        assert!(p.requires_elevation("update"));
        assert!(p.requires_elevation("upgrade"));
        assert!(!p.requires_elevation("search"));
        assert!(!p.requires_elevation("list"));
    }

    #[test]
    fn test_install_instructions() {
        let p = AptProvider::new();
        let instructions = p.get_install_instructions();
        assert!(instructions.is_some());
        assert!(instructions.unwrap().contains("Debian"));
    }

    #[test]
    fn test_parse_search_output() {
        let output = "nginx/jammy 1.18.0-6ubuntu14 amd64 - small, powerful, scalable web/reverse proxy server\nnginx-common/jammy 1.18.0-6ubuntu14 all - small, powerful, scalable web/reverse proxy server - common files\n";

        let results: Vec<PackageSummary> = output
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split(" - ").collect();
                if parts.len() >= 2 {
                    let name = parts[0].split('/').next()?.trim();
                    Some(PackageSummary {
                        name: name.into(),
                        description: Some(parts[1].into()),
                        latest_version: None,
                        provider: "apt".into(),
                    })
                } else {
                    None
                }
            })
            .take(20)
            .collect();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].name, "nginx");
        assert_eq!(results[1].name, "nginx-common");
        assert!(results[0]
            .description
            .as_ref()
            .unwrap()
            .contains("proxy server"));
    }

    #[test]
    fn test_parse_dpkg_list_output() {
        // dpkg -l output (after skipping 5 header lines)
        let output = "ii  curl           7.88.1-10+deb12u5  amd64  command line tool for transferring data\nii  git            1:2.39.2-1.1       amd64  fast, scalable, distributed revision control system\nrc  old-package    1.0.0              amd64  removed package\n";

        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 3 && parts[0] == "ii" {
                    Some(InstalledPackage {
                        name: parts[1].to_string(),
                        version: parts[2].into(),
                        provider: "apt".into(),
                        install_path: PathBuf::from("/usr"),
                        installed_at: String::new(),
                        is_global: true,
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(packages.len(), 2); // rc (removed) should be filtered out
        assert_eq!(packages[0].name, "curl");
        assert_eq!(packages[0].version, "7.88.1-10+deb12u5");
        assert_eq!(packages[1].name, "git");
        assert_eq!(packages[1].version, "1:2.39.2-1.1");
    }

    #[test]
    fn test_parse_dpkg_list_with_name_filter() {
        let output = "ii  curl           7.88.1  amd64  transfer tool\nii  git            2.39.2  amd64  revision control\nii  curl-dev       7.88.1  amd64  curl dev headers\n";
        let name_filter = Some("curl".to_string());

        let packages: Vec<&str> = output
            .lines()
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 3 && parts[0] == "ii" {
                    let name = parts[1];
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
        assert_eq!(packages[1], "curl-dev");
    }

    #[test]
    fn test_parse_apt_upgradable_output() {
        let output = "Listing...\ncurl/jammy-updates 8.0.0-1 amd64 [upgradable from: 7.88.1-10]\ngit/jammy-updates 1:2.40.0-1 amd64 [upgradable from: 1:2.39.2-1.1]\n";

        let updates: Vec<UpdateInfo> = output
            .lines()
            .filter(|l| !l.is_empty() && l.contains("upgradable"))
            .filter_map(|line| {
                let name = line.split('/').next()?.to_string();
                let latest = line.split_whitespace().nth(1)?.to_string();
                let current = line
                    .rsplit("from: ")
                    .next()
                    .map(|s| s.trim_end_matches(']').to_string())
                    .unwrap_or_default();

                Some(UpdateInfo {
                    name,
                    current_version: current,
                    latest_version: latest,
                    provider: "apt".into(),
                })
            })
            .collect();

        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "curl");
        assert_eq!(updates[0].latest_version, "8.0.0-1");
        assert_eq!(updates[0].current_version, "7.88.1-10");
        assert_eq!(updates[1].name, "git");
    }

    #[test]
    fn test_parse_dpkg_version_output() {
        let output = "Package: curl\nStatus: install ok installed\nVersion: 7.88.1-10+deb12u5\nArchitecture: amd64\n";

        let version = output
            .lines()
            .find_map(|line| line.strip_prefix("Version:").map(|v| v.trim().to_string()));

        assert_eq!(version, Some("7.88.1-10+deb12u5".to_string()));
    }

    #[test]
    fn test_default_impl() {
        let p = AptProvider::default();
        assert_eq!(p.id(), "apt");
    }
}
