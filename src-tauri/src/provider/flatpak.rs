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

const FLATPAK_TIMEOUT: u64 = 120;
const FLATPAK_SUDO_TIMEOUT: u64 = 300;
const FLATPAK_LONG_TIMEOUT: u64 = 600;

/// Flatpak - Universal Linux application sandboxing and distribution
pub struct FlatpakProvider;

impl FlatpakProvider {
    pub fn new() -> Self {
        Self
    }

    fn make_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(FLATPAK_TIMEOUT))
    }

    fn make_sudo_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(FLATPAK_SUDO_TIMEOUT))
    }

    fn make_long_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(FLATPAK_LONG_TIMEOUT))
    }

    async fn run_flatpak(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("flatpak", args, Some(Self::make_opts())).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a flatpak app
    async fn get_app_version(&self, app_id: &str) -> CogniaResult<String> {
        let out = self.run_flatpak(&["info", app_id]).await?;
        for line in out.lines() {
            if let Some(version) = line.strip_prefix("Version:") {
                return Ok(version.trim().to_string());
            }
        }
        Err(CogniaError::Provider(format!(
            "Version not found for {}",
            app_id
        )))
    }
}

impl Default for FlatpakProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for FlatpakProvider {
    fn id(&self) -> &str {
        "flatpak"
    }

    fn display_name(&self) -> &str {
        "Flatpak (Universal Linux)"
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
        if process::which("flatpak").await.is_none() {
            return false;
        }
        // Verify flatpak actually works
        match process::execute("flatpak", &["--version"], None).await {
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
        let out = self.run_flatpak(&["search", query]).await?;

        Ok(out
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 3 {
                    let name = parts[0].trim().to_string();
                    let description = parts[1].trim().to_string();
                    let app_id = parts[2].trim().to_string();

                    Some(PackageSummary {
                        name: app_id,
                        description: if description.is_empty() {
                            Some(name)
                        } else {
                            Some(description)
                        },
                        latest_version: parts.get(3).map(|s| s.trim().to_string()),
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_flatpak(&["info", name]).await?;

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
                    "Subject" | "Description" => description = Some(value.into()),
                    "License" => license = Some(value.into()),
                    "Homepage" => homepage = Some(value.into()),
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
        let out = self
            .run_flatpak(&["remote-info", "--log", "flathub", name])
            .await?;

        let mut versions = Vec::new();
        for line in out.lines() {
            if line.contains("Version:") {
                if let Some(version) = line.split(':').nth(1) {
                    versions.push(VersionInfo {
                        version: version.trim().into(),
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    });
                }
            }
        }

        Ok(versions)
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.get_app_version(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["flatpak", "install", "-y"];
        if req.force {
            args.push("--reinstall");
        }
        if !req.global {
            args.push("--user");
        }
        args.push("flathub");
        args.push(&req.name);

        let opts = if req.global {
            Self::make_long_opts()
        } else {
            Self::make_long_opts()
        };

        if req.global {
            let out = process::execute("sudo", &args, Some(opts)).await?;
            if !out.success {
                return Err(CogniaError::Installation(out.stderr));
            }
        } else {
            // User install doesn't need sudo
            let user_args: Vec<&str> = args[1..].to_vec(); // Skip "flatpak" from sudo args
            let out = process::execute("flatpak", &user_args, Some(opts)).await?;
            if !out.success {
                return Err(CogniaError::Installation(out.stderr));
            }
        }

        // Get the actual installed version
        let actual_version = self
            .get_app_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::from("/var/lib/flatpak"),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let mut args = vec!["uninstall", "-y"];
        if req.force {
            args.push("--force-remove");
        }
        args.push(&req.name);
        let _out = self.run_flatpak(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self
            .run_flatpak(&["list", "--app", "--columns=application,version"])
            .await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.is_empty() {
                    return None;
                }

                let name = parts[0].trim().to_string();

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                        return None;
                    }
                }

                let version = parts
                    .get(1)
                    .map(|s| s.trim().to_string())
                    .unwrap_or_default();

                Some(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path: PathBuf::from("/var/lib/flatpak"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self
            .run_flatpak(&["remote-ls", "--updates", "--columns=application,version"])
            .await;

        if let Ok(output) = out {
            let mut updates: Vec<UpdateInfo> = output
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if parts.is_empty() {
                        return None;
                    }

                    let name = parts[0].trim().to_string();

                    if !packages.is_empty() && !packages.contains(&name) {
                        return None;
                    }

                    Some(UpdateInfo {
                        name,
                        current_version: String::new(),
                        latest_version: parts
                            .get(1)
                            .map(|s| s.trim().to_string())
                            .unwrap_or_default(),
                        provider: self.id().into(),
                    })
                })
                .collect();

            // Populate current_version from flatpak info
            for update in &mut updates {
                if let Ok(ver) = self.get_app_version(&update.name).await {
                    update.current_version = ver;
                }
            }

            return Ok(updates);
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for FlatpakProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_flatpak(&["--version"]).await?;
        let version = out.split_whitespace().last().unwrap_or("").to_string();
        Ok(version)
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("flatpak")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("flatpak not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install flatpak: sudo apt install flatpak (Debian/Ubuntu) or sudo dnf install flatpak (Fedora). Then add Flathub: flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute("sudo", &["flatpak", "update", "-y", name], Some(FlatpakProvider::make_sudo_opts())).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["flatpak", "update", "-y"], Some(FlatpakProvider::make_long_opts())).await?;
        if out.success {
            Ok(vec!["All flatpaks updated".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_flatpak(&["info", name]).await;
        Ok(out.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let provider = FlatpakProvider::new();
        assert_eq!(provider.id(), "flatpak");
        assert_eq!(provider.display_name(), "Flatpak (Universal Linux)");
        assert_eq!(provider.priority(), 70);
    }

    #[test]
    fn test_capabilities() {
        let provider = FlatpakProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
    }

    #[test]
    fn test_supported_platforms_linux_only() {
        let provider = FlatpakProvider::new();
        let platforms = provider.supported_platforms();
        assert_eq!(platforms, vec![Platform::Linux]);
    }

    #[test]
    fn test_requires_elevation() {
        let provider = FlatpakProvider::new();
        assert!(provider.requires_elevation("install"));
        assert!(provider.requires_elevation("uninstall"));
        assert!(provider.requires_elevation("update"));
        assert!(provider.requires_elevation("upgrade"));
        assert!(!provider.requires_elevation("search"));
        assert!(!provider.requires_elevation("list"));
    }

    #[test]
    fn test_get_install_instructions() {
        let provider = FlatpakProvider::new();
        let instructions = provider.get_install_instructions();
        assert!(instructions.is_some());
        assert!(instructions.unwrap().contains("flatpak"));
    }

    #[test]
    fn test_parse_flatpak_search_output() {
        // flatpak search output: tab-separated
        let output = "Name\tDescription\tApplication ID\tVersion\tBranch\tRemotes\nFirefox\tFast, Private & Safe Web Browser\torg.mozilla.firefox\t120.0\tstable\tflathub\nVLC\tMedia player\torg.videolan.VLC\t3.0.18\tstable\tflathub\n";

        let results: Vec<PackageSummary> = output
            .lines()
            .skip(1)
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 3 {
                    let name = parts[0].trim().to_string();
                    let description = parts[1].trim().to_string();
                    let app_id = parts[2].trim().to_string();
                    Some(PackageSummary {
                        name: app_id,
                        description: if description.is_empty() {
                            Some(name)
                        } else {
                            Some(description)
                        },
                        latest_version: parts.get(3).map(|s| s.trim().to_string()),
                        provider: "flatpak".into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].name, "org.mozilla.firefox");
        assert_eq!(results[0].description, Some("Fast, Private & Safe Web Browser".into()));
        assert_eq!(results[0].latest_version, Some("120.0".into()));
        assert_eq!(results[1].name, "org.videolan.VLC");
    }

    #[test]
    fn test_parse_flatpak_list_installed_output() {
        let output = "org.mozilla.firefox\t120.0\norg.videolan.VLC\t3.0.18\norg.gnome.Calculator\t45.0\n";

        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.is_empty() {
                    return None;
                }
                let name = parts[0].trim().to_string();
                let version = parts.get(1).map(|s| s.trim().to_string()).unwrap_or_default();
                Some(InstalledPackage {
                    name,
                    version,
                    provider: "flatpak".into(),
                    install_path: PathBuf::from("/var/lib/flatpak"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect();

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "org.mozilla.firefox");
        assert_eq!(packages[0].version, "120.0");
        assert_eq!(packages[1].name, "org.videolan.VLC");
        assert_eq!(packages[2].name, "org.gnome.Calculator");
    }

    #[test]
    fn test_parse_flatpak_updates_output() {
        let output = "org.mozilla.firefox\t121.0\norg.videolan.VLC\t3.0.19\n";

        let updates: Vec<UpdateInfo> = output
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.is_empty() {
                    return None;
                }
                let name = parts[0].trim().to_string();
                Some(UpdateInfo {
                    name,
                    current_version: String::new(),
                    latest_version: parts.get(1).map(|s| s.trim().to_string()).unwrap_or_default(),
                    provider: "flatpak".into(),
                })
            })
            .collect();

        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "org.mozilla.firefox");
        assert_eq!(updates[0].latest_version, "121.0");
        assert_eq!(updates[1].name, "org.videolan.VLC");
    }

    #[test]
    fn test_parse_flatpak_info_output() {
        let output = "Ref: app/org.mozilla.firefox/x86_64/stable\nVersion: 120.0\nSubject: Update to 120.0\nLicense: MPL-2.0\nHomepage: https://www.mozilla.org/firefox/\n";

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
                    "License" => license = Some(value.to_string()),
                    "Homepage" => homepage = Some(value.to_string()),
                    _ => {}
                }
            }
        }

        assert_eq!(version, Some("120.0".into()));
        assert_eq!(license, Some("MPL-2.0".into()));
        assert_eq!(homepage, Some("https://www.mozilla.org/firefox/".into()));
    }

    #[test]
    fn test_default_impl() {
        let _provider = FlatpakProvider::default();
    }
}
