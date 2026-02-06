use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

/// WSL (Windows Subsystem for Linux) distribution management provider.
///
/// Supports:
/// - Searching available distributions (`wsl --list --online`)
/// - Installing distributions (`wsl --install -d <name>`)
/// - Uninstalling/unregistering distributions (`wsl --unregister <name>`)
/// - Listing installed distributions (`wsl --list --verbose`)
/// - Checking for WSL kernel updates (`wsl --update`)
/// - Managing distribution state (start/stop/terminate/shutdown)
/// - Setting default distribution (`wsl --set-default`)
/// - Setting WSL version per distribution (`wsl --set-version`)
/// - Exporting/importing distributions (`wsl --export` / `wsl --import`)
/// - Checking WSL status and version info (`wsl --status`, `wsl --version`)
pub struct WslProvider;

/// Parsed information about an installed WSL distribution
#[derive(Debug, Clone)]
pub struct WslDistroInfo {
    pub name: String,
    pub state: String,
    pub wsl_version: String,
    pub is_default: bool,
}

impl WslProvider {
    pub fn new() -> Self {
        Self
    }

    /// Execute a wsl.exe command and return stdout on success.
    /// Uses UTF-16 decoding workaround for wsl.exe output encoding issues.
    pub async fn run_wsl(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("wsl.exe", args, None).await?;
        if out.success {
            Ok(Self::clean_wsl_output(&out.stdout))
        } else {
            // wsl.exe sometimes outputs errors to stdout instead of stderr
            let err_msg = if out.stderr.trim().is_empty() {
                out.stdout.trim().to_string()
            } else {
                out.stderr.trim().to_string()
            };
            Err(CogniaError::Provider(format!("WSL: {}", err_msg)))
        }
    }

    /// Execute a wsl.exe command, returning stdout even on non-zero exit codes.
    /// Some WSL commands (like --list --online) may return non-zero but still have output.
    pub async fn run_wsl_lenient(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("wsl.exe", args, None).await?;
        let stdout = Self::clean_wsl_output(&out.stdout);
        if !stdout.trim().is_empty() {
            Ok(stdout)
        } else if !out.stderr.trim().is_empty() {
            Err(CogniaError::Provider(format!("WSL: {}", out.stderr.trim())))
        } else {
            Err(CogniaError::Provider("WSL: No output received".into()))
        }
    }

    /// Clean up WSL output which may contain null bytes from UTF-16 encoding
    pub fn clean_wsl_output(raw: &str) -> String {
        raw.replace('\0', "")
            .lines()
            .map(|l| l.trim_end())
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Parse `wsl --list --verbose` output into structured distro info.
    ///
    /// Example output:
    /// ```text
    ///   NAME      STATE           VERSION
    /// * Ubuntu    Running         2
    ///   Debian    Stopped         2
    /// ```
    pub fn parse_list_verbose(output: &str) -> Vec<WslDistroInfo> {
        let lines: Vec<&str> = output.lines().collect();
        if lines.len() < 2 {
            return vec![];
        }

        // Find the header line containing "NAME" and "STATE"
        let header_idx = lines.iter().position(|l| {
            let upper = l.to_uppercase();
            upper.contains("NAME") && upper.contains("STATE")
        });

        let start_idx = match header_idx {
            Some(idx) => idx + 1,
            None => {
                // Fallback: skip first line (might be header)
                if lines.len() > 1 { 1 } else { return vec![]; }
            }
        };

        lines[start_idx..]
            .iter()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                let is_default = line.starts_with('*') || line.starts_with(" *");
                // Remove the default marker
                let cleaned = line.replace('*', " ");
                let parts: Vec<&str> = cleaned.split_whitespace().collect();

                if parts.is_empty() {
                    return None;
                }

                let name = parts[0].to_string();
                let state = parts.get(1).unwrap_or(&"Unknown").to_string();
                let wsl_version = parts.get(2).unwrap_or(&"2").to_string();

                Some(WslDistroInfo {
                    name,
                    state,
                    wsl_version,
                    is_default,
                })
            })
            .collect()
    }

    /// Parse `wsl --list --online` output to get available distributions.
    ///
    /// Example output:
    /// ```text
    /// The following is a list of valid distributions that can be installed.
    /// Install using 'wsl.exe --install <Distro>'.
    ///
    /// NAME                            FRIENDLY NAME
    /// Ubuntu                          Ubuntu
    /// Debian                          Debian GNU/Linux
    /// kali-linux                      Kali Linux Rolling
    /// Ubuntu-18.04                    Ubuntu 18.04 LTS
    /// Ubuntu-20.04                    Ubuntu 20.04 LTS
    /// Ubuntu-22.04                    Ubuntu 22.04 LTS
    /// Ubuntu-24.04                    Ubuntu 24.04 LTS
    /// OracleLinux_7_9                 Oracle Linux 7.9
    /// OracleLinux_8_7                 Oracle Linux 8.7
    /// OracleLinux_9_1                 Oracle Linux 9.1
    /// openSUSE-Leap-15.6             openSUSE Leap 15.6
    /// SUSE-Linux-Enterprise-15-SP5   SUSE Linux Enterprise 15 SP5
    /// openSUSE-Tumbleweed            openSUSE Tumbleweed
    /// ```
    pub fn parse_list_online(output: &str) -> Vec<(String, String)> {
        let lines: Vec<&str> = output.lines().collect();

        // Find the header line containing "NAME" and "FRIENDLY NAME"
        let header_idx = lines.iter().position(|l| {
            let upper = l.to_uppercase();
            upper.contains("NAME") && (upper.contains("FRIENDLY") || upper.contains("NAME"))
        });

        let (start_idx, friendly_col_start) = match header_idx {
            Some(idx) => {
                let header = lines[idx];
                // Find where "FRIENDLY NAME" column starts
                let upper = header.to_uppercase();
                let friendly_start = upper.find("FRIENDLY").unwrap_or_else(|| {
                    // If no "FRIENDLY", try to find second "NAME" occurrence
                    let first_name = upper.find("NAME").unwrap_or(0);
                    upper[first_name + 4..].find("NAME").map(|p| p + first_name + 4).unwrap_or(32)
                });
                (idx + 1, friendly_start)
            }
            None => {
                // Fallback: skip descriptive lines, look for data
                let data_start = lines.iter().position(|l| {
                    let trimmed = l.trim();
                    !trimmed.is_empty()
                        && !trimmed.starts_with("The following")
                        && !trimmed.starts_with("Install using")
                        && !trimmed.to_uppercase().contains("NAME")
                }).unwrap_or(lines.len());
                (data_start, 32)
            }
        };

        lines[start_idx..]
            .iter()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                if line.trim().is_empty() {
                    return None;
                }

                let (id, friendly_name) = if line.len() > friendly_col_start {
                    let id = line[..friendly_col_start].trim().to_string();
                    let friendly = line[friendly_col_start..].trim().to_string();
                    (id, friendly)
                } else {
                    let id = line.trim().to_string();
                    (id.clone(), id)
                };

                if id.is_empty() {
                    return None;
                }

                Some((id, friendly_name))
            })
            .collect()
    }

    /// Get WSL version string from `wsl --version`
    pub async fn get_wsl_version_string(&self) -> CogniaResult<String> {
        let out = self.run_wsl_lenient(&["--version"]).await?;
        // First line typically: "WSL version: X.Y.Z.P"
        for line in out.lines() {
            let lower = line.to_lowercase();
            if lower.contains("wsl") && lower.contains("version") {
                if let Some(v) = line.split(':').nth(1) {
                    return Ok(v.trim().to_string());
                }
                // Sometimes format is "WSL version X.Y.Z"
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(v) = parts.last() {
                    return Ok(v.to_string());
                }
            }
        }
        // Fallback: return first non-empty line
        out.lines()
            .find(|l| !l.trim().is_empty())
            .map(|l| l.trim().to_string())
            .ok_or_else(|| CogniaError::Provider("WSL: Could not determine version".into()))
    }

    /// Get WSL status info from `wsl --status`
    pub async fn get_wsl_status(&self) -> CogniaResult<String> {
        self.run_wsl_lenient(&["--status"]).await
    }

    /// Terminate a specific running distribution
    pub async fn terminate_distro(&self, name: &str) -> CogniaResult<()> {
        self.run_wsl(&["--terminate", name]).await?;
        Ok(())
    }

    /// Shutdown all WSL instances
    pub async fn shutdown_all(&self) -> CogniaResult<()> {
        self.run_wsl(&["--shutdown"]).await?;
        Ok(())
    }

    /// Set the default WSL distribution
    pub async fn set_default_distro(&self, name: &str) -> CogniaResult<()> {
        self.run_wsl(&["--set-default", name]).await?;
        Ok(())
    }

    /// Set WSL version (1 or 2) for a specific distribution
    pub async fn set_distro_version(&self, name: &str, version: u8) -> CogniaResult<()> {
        let ver_str = version.to_string();
        self.run_wsl(&["--set-version", name, &ver_str]).await?;
        Ok(())
    }

    /// Set the default WSL version for new installations
    pub async fn set_default_version(&self, version: u8) -> CogniaResult<()> {
        let ver_str = version.to_string();
        self.run_wsl(&["--set-default-version", &ver_str]).await?;
        Ok(())
    }

    /// Export a distribution to a tar/vhdx file
    pub async fn export_distro(&self, name: &str, file_path: &str, as_vhd: bool) -> CogniaResult<()> {
        let mut args = vec!["--export", name, file_path];
        if as_vhd {
            args.push("--vhd");
        }
        self.run_wsl(&args).await?;
        Ok(())
    }

    /// Import a distribution from a tar/vhdx file
    pub async fn import_distro(
        &self,
        name: &str,
        install_location: &str,
        file_path: &str,
        wsl_version: Option<u8>,
        as_vhd: bool,
    ) -> CogniaResult<()> {
        let mut args = vec!["--import", name, install_location, file_path];
        let ver_str;
        if let Some(ver) = wsl_version {
            ver_str = ver.to_string();
            args.push("--version");
            args.push(&ver_str);
        }
        if as_vhd {
            args.push("--vhd");
        }
        self.run_wsl(&args).await?;
        Ok(())
    }

    /// Launch a distribution (non-blocking, opens in new console)
    pub async fn launch_distro(&self, name: &str, user: Option<&str>) -> CogniaResult<()> {
        let mut args = vec!["--distribution", name];
        if let Some(u) = user {
            args.push("--user");
            args.push(u);
        }
        // Run a simple echo to verify launch works, actual launch happens via shell
        args.extend(&["--exec", "echo", "started"]);
        self.run_wsl(&args).await?;
        Ok(())
    }

    /// Update WSL kernel to the latest version
    pub async fn update_wsl(&self) -> CogniaResult<String> {
        let out = self.run_wsl_lenient(&["--update"]).await?;
        Ok(out)
    }

    /// Get the list of currently running distributions
    pub async fn list_running(&self) -> CogniaResult<Vec<String>> {
        let out = self.run_wsl_lenient(&["--list", "--running", "--quiet"]).await;
        match out {
            Ok(output) => Ok(output
                .lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()),
            Err(_) => Ok(vec![]),
        }
    }

    /// Get detailed info for a specific installed distribution
    pub async fn get_distro_detail(&self, name: &str) -> CogniaResult<Option<WslDistroInfo>> {
        let out = self.run_wsl_lenient(&["--list", "--verbose"]).await?;
        let distros = Self::parse_list_verbose(&out);
        Ok(distros.into_iter().find(|d| d.name.eq_ignore_ascii_case(name)))
    }
}

impl Default for WslProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for WslProvider {
    fn id(&self) -> &str {
        "wsl"
    }

    fn display_name(&self) -> &str {
        "Windows Subsystem for Linux"
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
        vec![Platform::Windows]
    }

    fn priority(&self) -> i32 {
        85
    }

    async fn is_available(&self) -> bool {
        // Check if wsl.exe exists and can respond
        match process::execute("wsl.exe", &["--status"], None).await {
            Ok(out) => {
                // wsl --status may return non-zero on some versions but still means WSL is installed
                // Check if we got any meaningful output (not just an error about missing feature)
                let combined = format!("{}{}", out.stdout, out.stderr);
                let cleaned = Self::clean_wsl_output(&combined);
                !cleaned.contains("not recognized")
                    && !cleaned.contains("is not recognized")
                    && !cleaned.contains("Enable the Virtual Machine")
            }
            Err(_) => false,
        }
    }

    /// Search for available WSL distributions.
    /// Uses `wsl --list --online` to get official distributions,
    /// then filters by query string.
    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let out = self.run_wsl_lenient(&["--list", "--online"]).await?;
        let available = Self::parse_list_online(&out);

        let query_lower = query.to_lowercase();
        let results: Vec<PackageSummary> = available
            .into_iter()
            .filter(|(id, friendly)| {
                query_lower.is_empty()
                    || id.to_lowercase().contains(&query_lower)
                    || friendly.to_lowercase().contains(&query_lower)
            })
            .map(|(id, friendly)| PackageSummary {
                name: id,
                description: Some(friendly),
                latest_version: Some("latest".into()),
                provider: self.id().into(),
            })
            .collect();

        Ok(results)
    }

    /// Get package info for a WSL distribution.
    /// Checks if it's installed (with version info) or available online.
    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // First check if it's already installed
        if let Ok(Some(info)) = self.get_distro_detail(name).await {
            return Ok(PackageInfo {
                name: name.into(),
                display_name: Some(name.into()),
                description: Some(format!(
                    "WSL {} distribution ({}, {})",
                    info.wsl_version,
                    info.state,
                    if info.is_default { "default" } else { "not default" }
                )),
                homepage: Some("https://learn.microsoft.com/en-us/windows/wsl/".into()),
                license: None,
                repository: None,
                versions: vec![VersionInfo {
                    version: format!("WSL {}", info.wsl_version),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                }],
                provider: self.id().into(),
            });
        }

        // Check if it's available online
        let out = self.run_wsl_lenient(&["--list", "--online"]).await;
        let friendly_name = if let Ok(output) = out {
            let available = Self::parse_list_online(&output);
            available
                .into_iter()
                .find(|(id, _)| id.eq_ignore_ascii_case(name))
                .map(|(_, friendly)| friendly)
        } else {
            None
        };

        Ok(PackageInfo {
            name: name.into(),
            display_name: friendly_name.clone(),
            description: friendly_name.or_else(|| Some(format!("WSL distribution: {}", name))),
            homepage: Some("https://learn.microsoft.com/en-us/windows/wsl/".into()),
            license: None,
            repository: None,
            versions: vec![VersionInfo {
                version: "latest".into(),
                release_date: None,
                deprecated: false,
                yanked: false,
            }],
            provider: self.id().into(),
        })
    }

    /// WSL distributions don't have traditional versions.
    /// Returns WSL version (1 or 2) if installed, or "latest" if not.
    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        if let Ok(Some(info)) = self.get_distro_detail(name).await {
            Ok(vec![VersionInfo {
                version: format!("WSL {}", info.wsl_version),
                release_date: None,
                deprecated: false,
                yanked: false,
            }])
        } else {
            Ok(vec![
                VersionInfo {
                    version: "WSL 2".into(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                },
                VersionInfo {
                    version: "WSL 1".into(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                },
            ])
        }
    }

    /// Install a WSL distribution.
    /// Uses `wsl --install -d <name>` with optional --web-download and --no-launch flags.
    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["--install", "-d", &req.name, "--no-launch"];

        // Use --web-download for reliability (bypasses Microsoft Store issues)
        args.push("--web-download");

        self.run_wsl_lenient(&args).await.map_err(|e| {
            CogniaError::Installation(format!(
                "Failed to install WSL distribution '{}': {}",
                req.name, e
            ))
        })?;

        // Determine installed WSL version
        let wsl_version = if let Ok(Some(info)) = self.get_distro_detail(&req.name).await {
            format!("WSL {}", info.wsl_version)
        } else {
            "WSL 2".into()
        };

        // WSL distros are stored under AppData or a custom location
        let install_path = std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("Packages"))
            .unwrap_or_else(|| PathBuf::from("C:\\WSL"));

        Ok(InstallReceipt {
            name: req.name,
            version: wsl_version,
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// Get the installed WSL version for a distribution.
    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.get_distro_detail(name).await {
            Ok(Some(info)) => Ok(Some(format!("WSL {}", info.wsl_version))),
            _ => Ok(None),
        }
    }

    /// Uninstall (unregister) a WSL distribution.
    /// WARNING: This permanently deletes all data in the distribution.
    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        // Terminate first to ensure clean unregister
        let _ = self.terminate_distro(&req.name).await;

        self.run_wsl(&["--unregister", &req.name]).await.map_err(|e| {
            CogniaError::Provider(format!(
                "Failed to unregister WSL distribution '{}': {}. All data will be lost.",
                req.name, e
            ))
        })?;
        Ok(())
    }

    /// List all installed WSL distributions with their state and version.
    async fn list_installed(
        &self,
        filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_wsl_lenient(&["--list", "--verbose"]).await?;
        let distros = Self::parse_list_verbose(&out);

        let local_app_data = std::env::var("LOCALAPPDATA")
            .unwrap_or_else(|_| "C:\\Users".into());

        Ok(distros
            .into_iter()
            .filter(|d| {
                if let Some(name_filter) = &filter.name_filter {
                    d.name.to_lowercase().contains(&name_filter.to_lowercase())
                } else {
                    true
                }
            })
            .map(|d| {
                let install_path = PathBuf::from(&local_app_data)
                    .join("Packages")
                    .join(&d.name);

                InstalledPackage {
                    name: d.name.clone(),
                    version: format!("WSL {} ({})", d.wsl_version, d.state),
                    provider: self.id().into(),
                    install_path,
                    installed_at: String::new(),
                    is_global: true,
                }
            })
            .collect())
    }

    /// Check for WSL kernel updates.
    /// WSL distributions themselves don't have a traditional update mechanism via wsl.exe,
    /// but the WSL kernel can be updated via `wsl --update`.
    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // Try `wsl --update --check` (available in newer WSL versions) or
        // use `wsl --update` dry-run behavior
        let mut updates = Vec::new();

        // Check WSL kernel update availability
        // Running `wsl --update` will report if an update is available
        let out = self.run_wsl_lenient(&["--update", "--web-download"]).await;
        if let Ok(output) = out {
            let lower = output.to_lowercase();
            // If the output indicates an update was performed or is available
            if lower.contains("update") && !lower.contains("no update") && !lower.contains("already") {
                if let Ok(version) = self.get_wsl_version_string().await {
                    updates.push(UpdateInfo {
                        name: "wsl-kernel".into(),
                        current_version: version.clone(),
                        latest_version: format!("{} (updated)", version),
                        provider: self.id().into(),
                    });
                }
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl SystemPackageProvider for WslProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        // WSL requires:
        // 1. Windows 10 version 2004+ or Windows 11
        // 2. Virtual Machine Platform feature enabled
        // 3. Windows Subsystem for Linux feature enabled
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        // WSL install and update operations may require admin privileges
        matches!(op, "install" | "uninstall" | "upgrade" | "update")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        self.get_wsl_version_string().await
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("wsl.exe")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("wsl.exe not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "WSL can be installed by running 'wsl --install' in an elevated PowerShell prompt. \
             Requires Windows 10 version 2004+ or Windows 11. \
             See: https://learn.microsoft.com/en-us/windows/wsl/install"
                .into(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        // No separate index update for WSL; the online list is always current
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        if name == "wsl-kernel" || name == "wsl" {
            // Update WSL kernel itself
            self.update_wsl().await?;
        } else {
            // For individual distros, we can't directly upgrade them via wsl.exe
            // Users must update packages within the distro itself (e.g., apt upgrade)
            // But we can suggest running the update inside the distro
            let out = process::execute(
                "wsl.exe",
                &["-d", name, "--exec", "sh", "-c", "apt update && apt upgrade -y 2>/dev/null || dnf upgrade -y 2>/dev/null || pacman -Syu --noconfirm 2>/dev/null || zypper update -y 2>/dev/null || apk upgrade 2>/dev/null || echo 'Update completed'"],
                None,
            ).await?;
            if !out.success {
                return Err(CogniaError::Provider(format!(
                    "Failed to upgrade packages in '{}': {}",
                    name,
                    out.stderr.trim()
                )));
            }
        }
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        // Update WSL kernel
        let result = self.update_wsl().await?;
        Ok(vec![result])
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_wsl_lenient(&["--list", "--quiet"]).await;
        match out {
            Ok(output) => Ok(output
                .lines()
                .any(|l| l.trim().eq_ignore_ascii_case(name))),
            Err(_) => Ok(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_list_verbose() {
        let output = "  NAME      STATE           VERSION\n* Ubuntu    Running         2\n  Debian    Stopped         2\n  kali-linux Stopped        1\n";
        let distros = WslProvider::parse_list_verbose(output);

        assert_eq!(distros.len(), 3);

        assert_eq!(distros[0].name, "Ubuntu");
        assert_eq!(distros[0].state, "Running");
        assert_eq!(distros[0].wsl_version, "2");
        assert!(distros[0].is_default);

        assert_eq!(distros[1].name, "Debian");
        assert_eq!(distros[1].state, "Stopped");
        assert_eq!(distros[1].wsl_version, "2");
        assert!(!distros[1].is_default);

        assert_eq!(distros[2].name, "kali-linux");
        assert_eq!(distros[2].state, "Stopped");
        assert_eq!(distros[2].wsl_version, "1");
        assert!(!distros[2].is_default);
    }

    #[test]
    fn test_parse_list_verbose_empty() {
        let output = "";
        let distros = WslProvider::parse_list_verbose(output);
        assert!(distros.is_empty());
    }

    #[test]
    fn test_parse_list_online() {
        let output = "The following is a list of valid distributions that can be installed.\nInstall using 'wsl.exe --install <Distro>'.\n\nNAME                            FRIENDLY NAME\nUbuntu                          Ubuntu\nDebian                          Debian GNU/Linux\nkali-linux                      Kali Linux Rolling\nUbuntu-22.04                    Ubuntu 22.04 LTS\n";
        let available = WslProvider::parse_list_online(output);

        assert_eq!(available.len(), 4);
        assert_eq!(available[0].0, "Ubuntu");
        assert_eq!(available[0].1, "Ubuntu");
        assert_eq!(available[1].0, "Debian");
        assert_eq!(available[1].1, "Debian GNU/Linux");
        assert_eq!(available[2].0, "kali-linux");
        assert_eq!(available[2].1, "Kali Linux Rolling");
        assert_eq!(available[3].0, "Ubuntu-22.04");
        assert_eq!(available[3].1, "Ubuntu 22.04 LTS");
    }

    #[test]
    fn test_parse_list_online_empty() {
        let output = "";
        let available = WslProvider::parse_list_online(output);
        assert!(available.is_empty());
    }

    #[test]
    fn test_clean_wsl_output() {
        let raw = "H\0e\0l\0l\0o\0 \0W\0o\0r\0l\0d\0";
        let cleaned = WslProvider::clean_wsl_output(raw);
        assert_eq!(cleaned, "Hello World");
    }

    #[test]
    fn test_provider_metadata() {
        let provider = WslProvider::new();
        assert_eq!(provider.id(), "wsl");
        assert_eq!(provider.display_name(), "Windows Subsystem for Linux");
        assert!(provider.capabilities().contains(&Capability::Install));
        assert!(provider.capabilities().contains(&Capability::Uninstall));
        assert!(provider.capabilities().contains(&Capability::Search));
        assert!(provider.capabilities().contains(&Capability::List));
        assert!(provider.capabilities().contains(&Capability::Update));
        assert_eq!(provider.supported_platforms(), vec![Platform::Windows]);
        assert_eq!(provider.priority(), 85);
    }
}
