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

/// MSYS2 Package Manager Provider
///
/// Windows-only provider that wraps the MSYS2 pacman package manager.
/// MSYS2 uses a Windows port of pacman (from Arch Linux) with identical
/// output formats. Default environment: UCRT64.
///
/// Key CLI commands:
///   - `pacman -Ss <query>` — Search packages
///   - `pacman -S --noconfirm <pkg>` — Install
///   - `pacman -R --noconfirm <pkg>` — Uninstall
///   - `pacman -Q` — List installed
///   - `pacman -Qu` — Check updates
///   - `pacman -Si <pkg>` — Package info
///   - `pacman -Sy` — Update database
///   - `pacman -Syu --noconfirm` — System upgrade
pub struct Msys2Provider {
    msys2_root: Option<PathBuf>,
}

impl Msys2Provider {
    pub fn new() -> Self {
        let msys2_root = find_msys2_root();
        Self { msys2_root }
    }

    /// Get the full path to pacman.exe
    fn get_pacman_exe(&self) -> Option<String> {
        self.msys2_root.as_ref().map(|root| {
            root.join("usr")
                .join("bin")
                .join("pacman.exe")
                .to_string_lossy()
                .to_string()
        })
    }

    fn make_opts(&self) -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(120))
    }

    /// Run pacman with given arguments
    async fn run_pacman(&self, args: &[&str]) -> CogniaResult<String> {
        let exe = self
            .get_pacman_exe()
            .ok_or_else(|| CogniaError::Provider("MSYS2 pacman.exe not found".into()))?;

        let opts = self.make_opts();
        let out = process::execute(&exe, args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a specific package
    async fn query_installed_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_pacman(&["-Q", name]).await?;
        let parts: Vec<&str> = out.trim().split_whitespace().collect();
        if parts.len() >= 2 {
            Ok(parts[1].to_string())
        } else {
            Err(CogniaError::Provider(format!(
                "Version not found for {}",
                name
            )))
        }
    }
}

impl Default for Msys2Provider {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Helper functions (private, unit-testable)
// ---------------------------------------------------------------------------

/// Locate MSYS2 installation root
fn find_msys2_root() -> Option<PathBuf> {
    // 1. Check MSYS2_ROOT environment variable
    if let Ok(root) = std::env::var("MSYS2_ROOT") {
        let path = PathBuf::from(&root);
        if path.join("usr").join("bin").join("pacman.exe").exists() {
            return Some(path);
        }
    }

    // 2. Check default installation path
    let default = PathBuf::from(r"C:\msys64");
    if default.join("usr").join("bin").join("pacman.exe").exists() {
        return Some(default);
    }

    // 3. Check legacy 32-bit path
    let legacy = PathBuf::from(r"C:\msys32");
    if legacy.join("usr").join("bin").join("pacman.exe").exists() {
        return Some(legacy);
    }

    // 4. Check user profile
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let user_path = PathBuf::from(profile).join("msys64");
        if user_path
            .join("usr")
            .join("bin")
            .join("pacman.exe")
            .exists()
        {
            return Some(user_path);
        }
    }

    None
}

/// Parse `pacman -Ss` search output
/// Format: "repo/package-name version [installed]\n    Description text"
fn parse_search_output(output: &str, limit: usize) -> Vec<PackageSummary> {
    let mut packages = Vec::new();
    let mut lines = output.lines().peekable();

    while let Some(line) = lines.next() {
        if line.starts_with(' ') || line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let full_name = parts[0];
            let name = full_name.split('/').next_back().unwrap_or(full_name);
            let version = parts[1].to_string();

            let description = lines
                .peek()
                .filter(|l| l.starts_with(' '))
                .map(|l| l.trim().to_string());

            if description.is_some() {
                lines.next();
            }

            packages.push(PackageSummary {
                name: name.into(),
                description,
                latest_version: Some(version),
                provider: "msys2".into(),
            });

            if packages.len() >= limit {
                break;
            }
        }
    }

    packages
}

/// Parse `pacman -Q` list output
/// Format: "package-name version" per line
fn parse_list_output(output: &str) -> Vec<(String, String)> {
    output
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                Some((parts[0].to_string(), parts[1].to_string()))
            } else {
                None
            }
        })
        .collect()
}

/// Parse `pacman -Qu` update output
/// Format: "package-name old_version -> new_version" per line
fn parse_update_output(output: &str) -> Vec<UpdateInfo> {
    output
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                Some(UpdateInfo {
                    name: parts[0].to_string(),
                    current_version: parts[1].into(),
                    latest_version: parts[3].into(),
                    provider: "msys2".into(),
                })
            } else {
                None
            }
        })
        .collect()
}

/// Parse `pacman -Si` info output
/// Format: "Key            : Value" per line
fn parse_info_output(output: &str) -> std::collections::HashMap<String, String> {
    let mut info = std::collections::HashMap::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(2, ':').collect();
        if parts.len() == 2 {
            let key = parts[0].trim().to_string();
            let value = parts[1].trim().to_string();
            if !key.is_empty() && !value.is_empty() {
                info.insert(key, value);
            }
        }
    }
    info
}

// ---------------------------------------------------------------------------
// Provider + SystemPackageProvider trait implementations
// ---------------------------------------------------------------------------

#[async_trait]
impl Provider for Msys2Provider {
    fn id(&self) -> &str {
        "msys2"
    }

    fn display_name(&self) -> &str {
        "MSYS2 (pacman)"
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
        vec![Platform::Windows]
    }

    fn priority(&self) -> i32 {
        65
    }

    async fn is_available(&self) -> bool {
        let Some(exe) = self.get_pacman_exe() else {
            return false;
        };

        // Check if pacman.exe exists at the expected path
        if !PathBuf::from(&exe).exists() {
            return false;
        }

        // Verify it actually works
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        match process::execute(&exe, &["--version"], Some(opts)).await {
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
        let out = self.run_pacman(&["-Ss", query]).await?;
        Ok(parse_search_output(&out, limit))
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_pacman(&["-Si", name]).await?;
        let info = parse_info_output(&out);

        let version = info.get("Version").cloned();
        let description = info.get("Description").cloned();
        let license = info.get("Licenses").cloned();
        let homepage = info.get("URL").cloned();

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
        self.run_pacman(&["-S", "--noconfirm", &req.name]).await?;

        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = self
            .msys2_root
            .clone()
            .unwrap_or_else(|| PathBuf::from(r"C:\msys64"));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path,
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
        self.run_pacman(&["-R", "--noconfirm", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_pacman(&["-Q"]).await?;
        let install_path = self
            .msys2_root
            .clone()
            .unwrap_or_else(|| PathBuf::from(r"C:\msys64"));

        let packages = parse_list_output(&out);

        Ok(packages
            .into_iter()
            .filter_map(|(name, version)| {
                if let Some(ref name_filter) = filter.name_filter {
                    if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path: install_path.clone(),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_pacman(&["-Qu"]).await;

        if let Ok(output) = out {
            let mut updates = parse_update_output(&output);
            if !packages.is_empty() {
                updates.retain(|u| packages.contains(&u.name));
            }
            return Ok(updates);
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for Msys2Provider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        // MSYS2 pacman operates within its own prefix; no sudo/elevation needed
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_pacman(&["--version"]).await?;
        // Output: "  .--.                  Pacman v6.0.2 - libalpm v13.0.2\n ..."
        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.contains("Pacman v") || trimmed.contains("pacman v") {
                // Extract version after "Pacman v" or "pacman v"
                if let Some(pos) = trimmed.to_lowercase().find("pacman v") {
                    let after = &trimmed[pos + 8..]; // skip "pacman v" (8 chars)
                    let version = after
                        .split(|c: char| !c.is_ascii_digit() && c != '.')
                        .next()
                        .unwrap_or("")
                        .trim();
                    if !version.is_empty() {
                        return Ok(version.to_string());
                    }
                }
            }
        }
        // Fallback: just return the first meaningful line
        Ok(out
            .lines()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("unknown")
            .trim()
            .to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        self.get_pacman_exe()
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("MSYS2 pacman.exe not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Download and install MSYS2 from https://www.msys2.org/".to_string())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        self.run_pacman(&["-Sy"]).await?;
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_pacman(&["-S", "--noconfirm", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        self.run_pacman(&["-Syu", "--noconfirm"]).await?;
        Ok(vec!["MSYS2 system upgraded".into()])
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_pacman(&["-Q", name]).await;
        Ok(out.is_ok())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_msys2_root_env() {
        // Verify the env var check logic (path construction only)
        let root = PathBuf::from(r"C:\msys64");
        let pacman = root.join("usr").join("bin").join("pacman.exe");
        assert!(pacman.to_string_lossy().contains("pacman.exe"));
        assert!(pacman.to_string_lossy().contains(r"C:\msys64"));
    }

    #[test]
    fn test_find_msys2_root_default() {
        let default = PathBuf::from(r"C:\msys64");
        let expected = default.join("usr").join("bin").join("pacman.exe");
        assert_eq!(expected.to_string_lossy(), r"C:\msys64\usr\bin\pacman.exe");
    }

    #[test]
    fn test_parse_search_output() {
        let output = "ucrt64/mingw-w64-ucrt-x86_64-gcc 13.2.0-2\n    GNU Compiler Collection (C,C++,OpenMP) for MinGW-w64\nucrt64/mingw-w64-ucrt-x86_64-gdb 14.1-1\n    GNU Debugger for MinGW-w64\n";

        let packages = parse_search_output(output, 20);
        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].name, "mingw-w64-ucrt-x86_64-gcc");
        assert_eq!(packages[0].latest_version, Some("13.2.0-2".into()));
        assert_eq!(
            packages[0].description,
            Some("GNU Compiler Collection (C,C++,OpenMP) for MinGW-w64".into())
        );
        assert_eq!(packages[1].name, "mingw-w64-ucrt-x86_64-gdb");
    }

    #[test]
    fn test_parse_search_output_with_installed_marker() {
        let output = "ucrt64/mingw-w64-ucrt-x86_64-cmake 3.28.1-1 [installed]\n    A cross-platform open-source make system\n";

        let packages = parse_search_output(output, 20);
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].name, "mingw-w64-ucrt-x86_64-cmake");
        // The version string includes [installed] marker — the version is the second token
        assert_eq!(packages[0].latest_version, Some("3.28.1-1".into()));
    }

    #[test]
    fn test_parse_list_output() {
        let output = "base 2022.06-1\nbash 5.2.026-1\ncurl 8.4.0-1\ngit 2.42.0-1\n";

        let packages = parse_list_output(output);
        assert_eq!(packages.len(), 4);
        assert_eq!(packages[0], ("base".to_string(), "2022.06-1".to_string()));
        assert_eq!(packages[1], ("bash".to_string(), "5.2.026-1".to_string()));
        assert_eq!(packages[2], ("curl".to_string(), "8.4.0-1".to_string()));
        assert_eq!(packages[3], ("git".to_string(), "2.42.0-1".to_string()));
    }

    #[test]
    fn test_parse_list_output_with_filter() {
        let output = "curl 8.4.0-1\ngit 2.42.0-1\ncurl-dev 8.4.0-1\n";
        let packages = parse_list_output(output);
        let name_filter = "curl";

        let filtered: Vec<_> = packages
            .iter()
            .filter(|(name, _)| name.to_lowercase().contains(&name_filter.to_lowercase()))
            .collect();

        assert_eq!(filtered.len(), 2);
        assert_eq!(filtered[0].0, "curl");
        assert_eq!(filtered[1].0, "curl-dev");
    }

    #[test]
    fn test_parse_update_output() {
        let output = "curl 8.3.0-1 -> 8.4.0-1\ngit 2.41.0-1 -> 2.42.0-1\n";

        let updates = parse_update_output(output);
        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "curl");
        assert_eq!(updates[0].current_version, "8.3.0-1");
        assert_eq!(updates[0].latest_version, "8.4.0-1");
        assert_eq!(updates[1].name, "git");
        assert_eq!(updates[1].current_version, "2.41.0-1");
        assert_eq!(updates[1].latest_version, "2.42.0-1");
    }

    #[test]
    fn test_parse_info_output() {
        let output = "Name            : mingw-w64-ucrt-x86_64-gcc\nVersion         : 13.2.0-2\nDescription     : GNU Compiler Collection (C,C++,OpenMP) for MinGW-w64\nURL             : https://gcc.gnu.org/\nLicenses        : GPL\nArchitecture    : any\n";

        let info = parse_info_output(output);
        assert_eq!(info.get("Name").unwrap(), "mingw-w64-ucrt-x86_64-gcc");
        assert_eq!(info.get("Version").unwrap(), "13.2.0-2");
        assert_eq!(
            info.get("Description").unwrap(),
            "GNU Compiler Collection (C,C++,OpenMP) for MinGW-w64"
        );
        assert_eq!(info.get("URL").unwrap(), "https://gcc.gnu.org/");
        assert_eq!(info.get("Licenses").unwrap(), "GPL");
    }

    #[test]
    fn test_provider_metadata() {
        let p = Msys2Provider { msys2_root: None };
        assert_eq!(p.id(), "msys2");
        assert_eq!(p.display_name(), "MSYS2 (pacman)");
        assert_eq!(p.priority(), 65);
    }

    #[test]
    fn test_capabilities() {
        let p = Msys2Provider { msys2_root: None };
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
}
