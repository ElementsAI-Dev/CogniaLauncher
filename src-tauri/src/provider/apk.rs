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

/// APK - Alpine Package Keeper for Alpine Linux
pub struct ApkProvider;

impl ApkProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_apk(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("apk", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package
    async fn get_pkg_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_apk(&["info", "-v", name]).await?;
        // Output format: package-version
        if let Some(line) = out.lines().next() {
            let line = line.trim();
            if let Some(pos) = line.rfind('-') {
                return Ok(line[pos + 1..].to_string());
            }
        }
        Err(CogniaError::Provider(format!(
            "Version not found for {}",
            name
        )))
    }
}

impl Default for ApkProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ApkProvider {
    fn id(&self) -> &str {
        "apk"
    }

    fn display_name(&self) -> &str {
        "APK (Alpine Linux)"
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
        if process::which("apk").await.is_none() {
            return false;
        }
        // Verify apk actually works
        match process::execute("apk", &["--version"], None).await {
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
        let out = self.run_apk(&["search", "-v", query]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, " - ").collect();
                let name_version = parts[0];
                let description = parts.get(1).map(|s| s.to_string());

                let name = name_version
                    .rsplit('-')
                    .skip(1)
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect::<Vec<_>>()
                    .join("-");

                if name.is_empty() {
                    return None;
                }

                Some(PackageSummary {
                    name,
                    description,
                    latest_version: None,
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_apk(&["info", "-a", name]).await?;

        let mut description = None;
        let mut version = None;
        let mut license = None;
        let mut homepage = None;

        for line in out.lines() {
            if line.starts_with(name) && line.contains(" description:") {
                description = line.split(':').nth(1).map(|s| s.trim().into());
            } else if line.starts_with(name) && line.contains(" webpage:") {
                homepage = line.split(':').nth(1).map(|s| s.trim().into());
            } else if line.starts_with(name) && line.contains(" license:") {
                license = line.split(':').nth(1).map(|s| s.trim().into());
            } else if line.contains("-r") && line.contains(name) {
                version = line
                    .split_whitespace()
                    .next()
                    .and_then(|s| s.strip_prefix(&format!("{}-", name)))
                    .map(|s| s.into());
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

        let out = process::execute("sudo", &["apk", "add", &pkg], None).await?;
        if !out.success {
            return Err(CogniaError::Installation(out.stderr));
        }

        // Get the actual installed version
        let actual_version = self
            .get_pkg_version(&req.name)
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
        match self.get_pkg_version(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let out = process::execute("sudo", &["apk", "del", &req.name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_apk(&["list", "--installed"]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.is_empty() {
                    return None;
                }

                let name_version = parts[0];
                let dash_pos = name_version.rfind('-')?;
                let name = name_version[..dash_pos].to_string();
                let version = name_version[dash_pos + 1..].to_string();

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path: PathBuf::from("/usr"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_apk(&["version", "-l", "<"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .filter(|l| !l.is_empty() && l.contains('<'))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        let name = parts[0].to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        Some(UpdateInfo {
                            name,
                            current_version: parts[1].into(),
                            latest_version: parts[2].into(),
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
impl SystemPackageProvider for ApkProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_apk(&["--version"]).await?;
        let version = out.split_whitespace().nth(1).unwrap_or("").to_string();
        Ok(version)
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("apk")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("apk not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "APK is the default package manager on Alpine Linux. It should be pre-installed."
                .into(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["apk", "update"], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute("sudo", &["apk", "upgrade", name], None).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["apk", "upgrade"], None).await?;
        if out.success {
            Ok(vec!["All packages upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_apk(&["info", "-e", name]).await;
        Ok(out.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = ApkProvider::new();
        assert_eq!(p.id(), "apk");
        assert_eq!(p.display_name(), "APK (Alpine Linux)");
        assert_eq!(p.priority(), 80);
    }

    #[test]
    fn test_capabilities() {
        let p = ApkProvider::new();
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
        let p = ApkProvider::new();
        let platforms = p.supported_platforms();
        assert!(platforms.contains(&Platform::Linux));
        assert_eq!(platforms.len(), 1);
    }

    #[test]
    fn test_requires_elevation() {
        let p = ApkProvider::new();
        assert!(p.requires_elevation("install"));
        assert!(p.requires_elevation("uninstall"));
        assert!(p.requires_elevation("update"));
        assert!(p.requires_elevation("upgrade"));
        assert!(!p.requires_elevation("search"));
    }

    #[test]
    fn test_install_instructions() {
        let p = ApkProvider::new();
        let instructions = p.get_install_instructions();
        assert!(instructions.is_some());
        assert!(instructions.unwrap().contains("Alpine"));
    }

    #[test]
    fn test_parse_apk_search_output() {
        // apk search -v output: name-version - description
        let output = "curl-8.4.0-r0 - A URL retrieval utility and library\ngit-2.42.0-r0 - Distributed version control system\ncurl-dev-8.4.0-r0 - A URL retrieval utility (dev)\n";

        let results: Vec<PackageSummary> = output
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, " - ").collect();
                let name_version = parts[0];
                let description = parts.get(1).map(|s| s.to_string());

                let name = name_version
                    .rsplit('-')
                    .skip(1)
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect::<Vec<_>>()
                    .join("-");

                if name.is_empty() {
                    return None;
                }

                Some(PackageSummary {
                    name,
                    description,
                    latest_version: None,
                    provider: "apk".into(),
                })
            })
            .collect();

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].name, "curl-8.4.0");
        assert_eq!(
            results[0].description,
            Some("A URL retrieval utility and library".into())
        );
    }

    #[test]
    fn test_parse_apk_list_installed_output() {
        // apk list --installed output
        let output = "curl-8.4.0-r0 x86_64 {curl} (MIT)\ngit-2.42.0-r0 x86_64 {git} (GPL-2.0-only)\nbusybox-1.36.1-r2 x86_64 {busybox} (GPL-2.0-only)\n";

        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.is_empty() {
                    return None;
                }
                let name_version = parts[0];
                let dash_pos = name_version.rfind('-')?;
                let name = name_version[..dash_pos].to_string();
                let version = name_version[dash_pos + 1..].to_string();

                Some(InstalledPackage {
                    name,
                    version,
                    provider: "apk".into(),
                    install_path: PathBuf::from("/usr"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect();

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "curl-8.4.0");
        assert_eq!(packages[0].version, "r0");
        assert_eq!(packages[2].name, "busybox-1.36.1");
    }

    #[test]
    fn test_parse_apk_version_output() {
        // apk version -l < output
        let output = "curl-8.3.0-r0 < 8.4.0-r0\ngit-2.41.0-r0 < 2.42.0-r0\n";

        let updates: Vec<UpdateInfo> = output
            .lines()
            .filter(|l| !l.is_empty() && l.contains('<'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    Some(UpdateInfo {
                        name: parts[0].to_string(),
                        current_version: parts[1].into(),
                        latest_version: parts[2].into(),
                        provider: "apk".into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "curl-8.3.0-r0");
        assert_eq!(updates[0].current_version, "<");
        assert_eq!(updates[0].latest_version, "8.4.0-r0");
    }

    #[test]
    fn test_parse_apk_pkg_version() {
        // apk info -v output: package-version
        let line = "curl-8.4.0-r0";
        if let Some(pos) = line.rfind('-') {
            let version = &line[pos + 1..];
            assert_eq!(version, "r0");
        }
    }

    #[test]
    fn test_default_impl() {
        let p = ApkProvider::default();
        assert_eq!(p.id(), "apk");
    }
}
