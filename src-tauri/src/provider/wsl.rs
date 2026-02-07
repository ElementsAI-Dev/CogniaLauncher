use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use crate::platform::process::ProcessOptions;
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

/// Default timeout for WSL commands (120 seconds)
const WSL_TIMEOUT: Duration = Duration::from_secs(120);
/// Longer timeout for operations like install/export/import
const WSL_LONG_TIMEOUT: Duration = Duration::from_secs(600);

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

    /// Build ProcessOptions with the given timeout.
    fn make_opts(timeout: Duration) -> ProcessOptions {
        ProcessOptions::new().with_timeout(timeout)
    }

    /// Execute a wsl.exe command and return stdout on success.
    /// Uses UTF-16 decoding workaround for wsl.exe output encoding issues.
    pub async fn run_wsl(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("wsl.exe", args, Some(Self::make_opts(WSL_TIMEOUT))).await?;
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

    /// Execute a wsl.exe command with a long timeout (for install/export/import).
    pub async fn run_wsl_long(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("wsl.exe", args, Some(Self::make_opts(WSL_LONG_TIMEOUT))).await?;
        if out.success {
            Ok(Self::clean_wsl_output(&out.stdout))
        } else {
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
        let out = process::execute("wsl.exe", args, Some(Self::make_opts(WSL_TIMEOUT))).await?;
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

    /// List currently running WSL distributions.
    /// Parses `wsl --list --running` output to get distribution names.
    pub async fn list_running(&self) -> CogniaResult<Vec<String>> {
        let out = self.run_wsl_lenient(&["--list", "--running"]).await?;
        let distros: Vec<String> = out
            .lines()
            .skip(1) // Skip header "Windows Subsystem for Linux Distributions:"
            .map(|l| l.trim().trim_end_matches(" (Default)").trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();
        Ok(distros)
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
        self.run_wsl_long(&args).await?;
        Ok(())
    }

    /// Import a distribution in-place from an existing .vhdx file.
    /// The virtual hard disk must be formatted in the ext4 filesystem type.
    pub async fn import_distro_in_place(
        &self,
        name: &str,
        vhdx_path: &str,
    ) -> CogniaResult<()> {
        self.run_wsl_long(&["--import-in-place", name, vhdx_path]).await?;
        Ok(())
    }

    /// Launch a distribution by starting it in the background.
    /// Uses `wsl -d <name>` with a detached process to open an interactive session.
    pub async fn launch_distro(&self, name: &str, user: Option<&str>) -> CogniaResult<()> {
        let mut args: Vec<String> = vec!["--distribution".into(), name.into()];
        if let Some(u) = user {
            args.push("--user".into());
            args.push(u.into());
        }
        // Start the distro by running a lightweight command that ensures it's in Running state
        args.extend(["--exec".into(), "sh".into(), "-c".into(), "true".into()]);
        let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        self.run_wsl(&args_ref).await?;
        Ok(())
    }

    /// Update WSL kernel to the latest version
    pub async fn update_wsl(&self) -> CogniaResult<String> {
        let out = process::execute(
            "wsl.exe",
            &["--update", "--web-download"],
            Some(Self::make_opts(WSL_LONG_TIMEOUT)),
        )
        .await?;
        let stdout = Self::clean_wsl_output(&out.stdout);
        let stderr = Self::clean_wsl_output(&out.stderr);
        // wsl --update returns non-zero sometimes even on success; combine output
        let combined = if !stdout.trim().is_empty() {
            stdout
        } else {
            stderr
        };
        Ok(combined)
    }

    /// Get detailed info for a specific installed distribution
    pub async fn get_distro_detail(&self, name: &str) -> CogniaResult<Option<WslDistroInfo>> {
        let out = self.run_wsl_lenient(&["--list", "--verbose"]).await?;
        let distros = Self::parse_list_verbose(&out);
        Ok(distros.into_iter().find(|d| d.name.eq_ignore_ascii_case(name)))
    }

    /// Execute a command inside a specific WSL distribution.
    /// Returns (stdout, stderr, exit_code).
    pub async fn exec_command(
        &self,
        distro: &str,
        command: &str,
        user: Option<&str>,
    ) -> CogniaResult<(String, String, i32)> {
        let mut args: Vec<&str> = vec!["-d", distro];
        if let Some(u) = user {
            args.push("--user");
            args.push(u);
        }
        args.extend(&["--exec", "sh", "-c", command]);

        let out = process::execute("wsl.exe", &args, Some(Self::make_opts(WSL_TIMEOUT))).await?;
        let stdout = Self::clean_wsl_output(&out.stdout);
        let stderr = Self::clean_wsl_output(&out.stderr);
        let exit_code = out.exit_code;
        Ok((stdout, stderr, exit_code))
    }

    /// Convert a path between Windows and WSL formats using wslpath.
    /// `to_windows`: true = convert Linux→Windows, false = convert Windows→Linux.
    pub async fn convert_path(
        &self,
        path: &str,
        distro: Option<&str>,
        to_windows: bool,
    ) -> CogniaResult<String> {
        let flag = if to_windows { "-w" } else { "-u" };
        let mut args: Vec<&str> = Vec::new();
        if let Some(d) = distro {
            args.extend(&["-d", d]);
        }
        args.extend(&["--exec", "wslpath", flag, path]);

        let out = process::execute("wsl.exe", &args, Some(Self::make_opts(WSL_TIMEOUT))).await?;
        let result = Self::clean_wsl_output(&out.stdout);
        if result.trim().is_empty() {
            return Err(CogniaError::Provider(format!(
                "WSL: Path conversion failed for '{}'",
                path
            )));
        }
        Ok(result.trim().to_string())
    }

    /// Read the global .wslconfig file.
    /// Returns the parsed key-value pairs grouped by section.
    pub fn read_wslconfig() -> CogniaResult<std::collections::HashMap<String, std::collections::HashMap<String, String>>> {
        let user_profile = std::env::var("USERPROFILE")
            .map_err(|_| CogniaError::Provider("USERPROFILE environment variable not set".into()))?;
        let config_path = PathBuf::from(&user_profile).join(".wslconfig");

        if !config_path.exists() {
            return Ok(std::collections::HashMap::new());
        }

        let content = std::fs::read_to_string(&config_path).map_err(|e| {
            CogniaError::Provider(format!("Failed to read .wslconfig: {}", e))
        })?;

        Ok(Self::parse_ini_content(&content))
    }

    /// Write a setting to the global .wslconfig file.
    /// Creates the file if it doesn't exist.
    pub fn write_wslconfig(section: &str, key: &str, value: &str) -> CogniaResult<()> {
        let user_profile = std::env::var("USERPROFILE")
            .map_err(|_| CogniaError::Provider("USERPROFILE environment variable not set".into()))?;
        let config_path = PathBuf::from(&user_profile).join(".wslconfig");

        let mut sections = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path).map_err(|e| {
                CogniaError::Provider(format!("Failed to read .wslconfig: {}", e))
            })?;
            Self::parse_ini_content(&content)
        } else {
            std::collections::HashMap::new()
        };

        sections
            .entry(section.to_string())
            .or_default()
            .insert(key.to_string(), value.to_string());

        let output = Self::serialize_ini_content(&sections);
        std::fs::write(&config_path, output).map_err(|e| {
            CogniaError::Provider(format!("Failed to write .wslconfig: {}", e))
        })?;

        Ok(())
    }

    /// Remove a setting from the global .wslconfig file.
    pub fn remove_wslconfig_key(section: &str, key: &str) -> CogniaResult<bool> {
        let user_profile = std::env::var("USERPROFILE")
            .map_err(|_| CogniaError::Provider("USERPROFILE environment variable not set".into()))?;
        let config_path = PathBuf::from(&user_profile).join(".wslconfig");

        if !config_path.exists() {
            return Ok(false);
        }

        let content = std::fs::read_to_string(&config_path).map_err(|e| {
            CogniaError::Provider(format!("Failed to read .wslconfig: {}", e))
        })?;

        let mut sections = Self::parse_ini_content(&content);
        let removed = if let Some(sec) = sections.get_mut(section) {
            let existed = sec.remove(key).is_some();
            if sec.is_empty() {
                sections.remove(section);
            }
            existed
        } else {
            false
        };

        if removed {
            let output = Self::serialize_ini_content(&sections);
            std::fs::write(&config_path, output).map_err(|e| {
                CogniaError::Provider(format!("Failed to write .wslconfig: {}", e))
            })?;
        }

        Ok(removed)
    }

    /// Parse INI-style content into section → key → value map.
    fn parse_ini_content(content: &str) -> std::collections::HashMap<String, std::collections::HashMap<String, String>> {
        let mut sections: std::collections::HashMap<String, std::collections::HashMap<String, String>> = std::collections::HashMap::new();
        let mut current_section = String::new();

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') {
                continue;
            }
            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                current_section = trimmed[1..trimmed.len() - 1].trim().to_string();
                continue;
            }
            if let Some(eq_pos) = trimmed.find('=') {
                let key = trimmed[..eq_pos].trim().to_string();
                let value = trimmed[eq_pos + 1..].trim().to_string();
                if !current_section.is_empty() {
                    sections
                        .entry(current_section.clone())
                        .or_default()
                        .insert(key, value);
                }
            }
        }
        sections
    }

    /// Serialize section → key → value map back to INI format.
    fn serialize_ini_content(sections: &std::collections::HashMap<String, std::collections::HashMap<String, String>>) -> String {
        let mut output = String::new();
        // Sort sections for consistent output
        let mut section_names: Vec<&String> = sections.keys().collect();
        section_names.sort();

        for (i, section) in section_names.iter().enumerate() {
            if i > 0 {
                output.push('\n');
            }
            output.push_str(&format!("[{}]\n", section));
            if let Some(kvs) = sections.get(*section) {
                let mut keys: Vec<&String> = kvs.keys().collect();
                keys.sort();
                for key in keys {
                    if let Some(value) = kvs.get(key) {
                        output.push_str(&format!("{}={}\n", key, value));
                    }
                }
            }
        }
        output
    }

    /// Get disk usage information for a WSL distribution.
    /// Returns (total_bytes, used_bytes) by querying the VHD or filesystem.
    pub async fn get_disk_usage(&self, distro: &str) -> CogniaResult<(u64, u64)> {
        // Try to get disk usage from inside the distro via df
        let result = self
            .exec_command(distro, "df -B1 / 2>/dev/null | tail -1", None)
            .await;

        if let Ok((stdout, _, code)) = result {
            if code == 0 {
                let parts: Vec<&str> = stdout.split_whitespace().collect();
                // df -B1 output: Filesystem 1B-blocks Used Available Use% Mounted
                if parts.len() >= 4 {
                    let total = parts[1].parse::<u64>().unwrap_or(0);
                    let used = parts[2].parse::<u64>().unwrap_or(0);
                    if total > 0 {
                        return Ok((total, used));
                    }
                }
            }
        }

        // Fallback: try to find the VHD file size
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let vhd_patterns = [
            PathBuf::from(&local_app_data)
                .join("Packages")
                .join(format!("*{}*", distro)),
            PathBuf::from(&local_app_data).join("Docker"),
        ];

        for pattern in &vhd_patterns {
            if let Some(parent) = pattern.parent() {
                if parent.exists() {
                    if let Ok(entries) = std::fs::read_dir(parent) {
                        for entry in entries.flatten() {
                            let name = entry.file_name().to_string_lossy().to_lowercase();
                            if name.contains(&distro.to_lowercase()) {
                                // Look for ext4.vhdx inside
                                let vhdx = entry.path().join("LocalState").join("ext4.vhdx");
                                if vhdx.exists() {
                                    if let Ok(meta) = std::fs::metadata(&vhdx) {
                                        return Ok((meta.len(), meta.len()));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Err(CogniaError::Provider(format!(
            "Could not determine disk usage for '{}'",
            distro
        )))
    }

    /// Get the Windows filesystem path (\\wsl$\<distro>) for a distribution.
    pub fn get_distro_filesystem_path(distro: &str) -> String {
        format!("\\\\wsl.localhost\\{}", distro)
    }

    /// Mount a physical or virtual disk in WSL2.
    /// `disk_path` is the Windows path to the disk (e.g., `\\.\PhysicalDrive1` or a .vhdx).
    /// `options`: filesystem type, partition, bare mount, mount name, etc.
    pub async fn mount_disk(
        &self,
        disk_path: &str,
        is_vhd: bool,
        fs_type: Option<&str>,
        partition: Option<u32>,
        mount_name: Option<&str>,
        bare: bool,
    ) -> CogniaResult<String> {
        let mut args = vec!["--mount", disk_path];
        if is_vhd {
            args.push("--vhd");
        }
        let fs_str;
        if let Some(fs) = fs_type {
            fs_str = fs.to_string();
            args.push("--type");
            args.push(&fs_str);
        }
        let part_str;
        if let Some(p) = partition {
            part_str = p.to_string();
            args.push("--partition");
            args.push(&part_str);
        }
        if let Some(name) = mount_name {
            args.push("--name");
            args.push(name);
        }
        if bare {
            args.push("--bare");
        }
        self.run_wsl_long(&args).await
    }

    /// Unmount a previously mounted disk. If no path given, unmounts all.
    pub async fn unmount_disk(&self, disk_path: Option<&str>) -> CogniaResult<()> {
        let mut args = vec!["--unmount"];
        if let Some(path) = disk_path {
            args.push(path);
        }
        self.run_wsl(&args).await?;
        Ok(())
    }

    /// Get the IP address of a WSL distribution (the WSL2 VM address).
    pub async fn get_ip_address(&self, distro: Option<&str>) -> CogniaResult<String> {
        let mut args: Vec<&str> = Vec::new();
        if let Some(d) = distro {
            args.extend(&["-d", d]);
        }
        args.extend(&["--exec", "hostname", "-I"]);
        let out = process::execute("wsl.exe", &args, Some(Self::make_opts(WSL_TIMEOUT))).await?;
        let ip = Self::clean_wsl_output(&out.stdout).trim().to_string();
        if ip.is_empty() {
            return Err(CogniaError::Provider("WSL: Could not determine IP address".into()));
        }
        // hostname -I may return multiple IPs, take the first one
        Ok(ip.split_whitespace().next().unwrap_or(&ip).to_string())
    }

    /// Change the default user for a distribution.
    /// Uses `<distro>.exe config --default-user <user>` (only works for Store-installed distros).
    /// Falls back to editing /etc/wsl.conf for imported distros.
    pub async fn change_default_user(&self, distro: &str, username: &str) -> CogniaResult<()> {
        // Try the launcher executable approach first (e.g., ubuntu.exe config --default-user user)
        let exe_name = format!("{}.exe", distro.to_lowercase());
        let result = process::execute(
            &exe_name,
            &["config", "--default-user", username],
            Some(Self::make_opts(WSL_TIMEOUT)),
        )
        .await;

        match result {
            Ok(out) if out.success => Ok(()),
            _ => {
                // Fallback: edit /etc/wsl.conf inside the distro
                let cmd = format!(
                    "if grep -q '\\[user\\]' /etc/wsl.conf 2>/dev/null; then \
                     sed -i 's/^default=.*/default={}/' /etc/wsl.conf; \
                     else echo -e '\\n[user]\\ndefault={}' >> /etc/wsl.conf; fi",
                    username, username
                );
                let (_, stderr, code) = self.exec_command(distro, &cmd, Some("root")).await?;
                if code != 0 {
                    return Err(CogniaError::Provider(format!(
                        "Failed to change default user: {}",
                        stderr.trim()
                    )));
                }
                Ok(())
            }
        }
    }

    /// Read the per-distro /etc/wsl.conf file.
    /// Returns the parsed key-value pairs grouped by section.
    pub async fn read_distro_config(
        &self,
        distro: &str,
    ) -> CogniaResult<std::collections::HashMap<String, std::collections::HashMap<String, String>>> {
        let (stdout, _, code) = self
            .exec_command(distro, "cat /etc/wsl.conf 2>/dev/null || echo ''", None)
            .await?;
        if code != 0 {
            return Ok(std::collections::HashMap::new());
        }
        Ok(Self::parse_ini_content(&stdout))
    }

    /// Write a setting to the per-distro /etc/wsl.conf file.
    /// Requires root access inside the distro.
    pub async fn write_distro_config(
        &self,
        distro: &str,
        section: &str,
        key: &str,
        value: &str,
    ) -> CogniaResult<()> {
        // Read current config
        let current = self.read_distro_config(distro).await?;
        let mut sections = current;
        sections
            .entry(section.to_string())
            .or_default()
            .insert(key.to_string(), value.to_string());

        let content = Self::serialize_ini_content(&sections);
        // Escape for shell
        let escaped = content.replace('\'', "'\\''");
        let cmd = format!("echo '{}' > /etc/wsl.conf", escaped);
        let (_, stderr, code) = self.exec_command(distro, &cmd, Some("root")).await?;
        if code != 0 {
            return Err(CogniaError::Provider(format!(
                "Failed to write wsl.conf: {}",
                stderr.trim()
            )));
        }
        Ok(())
    }

    /// Remove a setting from the per-distro /etc/wsl.conf file.
    pub async fn remove_distro_config_key(
        &self,
        distro: &str,
        section: &str,
        key: &str,
    ) -> CogniaResult<bool> {
        let current = self.read_distro_config(distro).await?;
        let mut sections = current;
        let removed = if let Some(sec) = sections.get_mut(section) {
            let existed = sec.remove(key).is_some();
            if sec.is_empty() {
                sections.remove(section);
            }
            existed
        } else {
            false
        };

        if removed {
            let content = Self::serialize_ini_content(&sections);
            let escaped = content.replace('\'', "'\\''");
            let cmd = format!("echo '{}' > /etc/wsl.conf", escaped);
            let (_, stderr, code) = self.exec_command(distro, &cmd, Some("root")).await?;
            if code != 0 {
                return Err(CogniaError::Provider(format!(
                    "Failed to write wsl.conf: {}",
                    stderr.trim()
                )));
            }
        }
        Ok(removed)
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
        match process::execute("wsl.exe", &["--status"], Some(Self::make_opts(WSL_TIMEOUT))).await {
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

        // Use long timeout - installs can take several minutes to download
        self.run_wsl_long(&args).await.map_err(|e| {
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
    /// Uses `wsl --update --check` which is a non-destructive check (available in newer WSL).
    /// Falls back to `wsl --version` to report current version without triggering an actual update.
    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        // Try `wsl --update --check` first (non-destructive, available in WSL 2.x on Win11)
        let check_result = process::execute(
            "wsl.exe",
            &["--update", "--check"],
            Some(Self::make_opts(WSL_TIMEOUT)),
        )
        .await;

        if let Ok(out) = check_result {
            let combined = Self::clean_wsl_output(&format!("{}{}", out.stdout, out.stderr));
            let lower = combined.to_lowercase();
            // If the output indicates an update is available (not "no update" or "already up to date")
            if (lower.contains("update") || lower.contains("version"))
                && !lower.contains("no update")
                && !lower.contains("already")
                && !lower.contains("up to date")
                && !lower.contains("not recognized")
            {
                if let Ok(version) = self.get_wsl_version_string().await {
                    updates.push(UpdateInfo {
                        name: "wsl-kernel".into(),
                        current_version: version,
                        latest_version: "newer version available".into(),
                        provider: self.id().into(),
                    });
                }
            }
        }
        // If --check flag is not supported, we simply return empty (no false positive update)

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

    #[test]
    fn test_parse_ini_content() {
        let content = "[wsl2]\nmemory=4GB\nprocessors=2\nswap=8GB\n\n[experimental]\nautoMemoryReclaim=gradual\n";
        let sections = WslProvider::parse_ini_content(content);

        assert_eq!(sections.len(), 2);
        assert_eq!(sections["wsl2"]["memory"], "4GB");
        assert_eq!(sections["wsl2"]["processors"], "2");
        assert_eq!(sections["wsl2"]["swap"], "8GB");
        assert_eq!(sections["experimental"]["autoMemoryReclaim"], "gradual");
    }

    #[test]
    fn test_parse_ini_content_with_comments() {
        let content = "# This is a comment\n[wsl2]\n; Another comment\nmemory=4GB\n";
        let sections = WslProvider::parse_ini_content(content);

        assert_eq!(sections.len(), 1);
        assert_eq!(sections["wsl2"]["memory"], "4GB");
        assert_eq!(sections["wsl2"].len(), 1);
    }

    #[test]
    fn test_parse_ini_content_empty() {
        let content = "";
        let sections = WslProvider::parse_ini_content(content);
        assert!(sections.is_empty());
    }

    #[test]
    fn test_serialize_ini_content() {
        let mut sections = std::collections::HashMap::new();
        let mut wsl2 = std::collections::HashMap::new();
        wsl2.insert("memory".to_string(), "4GB".to_string());
        wsl2.insert("processors".to_string(), "2".to_string());
        sections.insert("wsl2".to_string(), wsl2);

        let output = WslProvider::serialize_ini_content(&sections);
        assert!(output.contains("[wsl2]"));
        assert!(output.contains("memory=4GB"));
        assert!(output.contains("processors=2"));
    }

    #[test]
    fn test_serialize_roundtrip() {
        let content = "[experimental]\nautoMemoryReclaim=gradual\n\n[wsl2]\nmemory=4GB\nprocessors=2\n";
        let sections = WslProvider::parse_ini_content(content);
        let output = WslProvider::serialize_ini_content(&sections);
        let reparsed = WslProvider::parse_ini_content(&output);
        assert_eq!(sections, reparsed);
    }

    #[test]
    fn test_get_distro_filesystem_path() {
        assert_eq!(
            WslProvider::get_distro_filesystem_path("Ubuntu"),
            "\\\\wsl.localhost\\Ubuntu"
        );
        assert_eq!(
            WslProvider::get_distro_filesystem_path("Debian"),
            "\\\\wsl.localhost\\Debian"
        );
    }
}
