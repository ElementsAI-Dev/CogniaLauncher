use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::{ProcessOptions, ProcessOutput};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command as TokioCommand;

/// Default timeout for WSL commands (120 seconds)
const WSL_TIMEOUT: Duration = Duration::from_secs(120);
/// Longer timeout for operations like install/export/import
const WSL_LONG_TIMEOUT: Duration = Duration::from_secs(600);
/// Short timeout for availability checks
const WSL_AVAIL_TIMEOUT: Duration = Duration::from_secs(15);

/// Decode bytes that may be UTF-16LE (common for wsl.exe on Windows) or UTF-8.
///
/// Detection strategy:
/// 1. Check for UTF-16LE BOM (FF FE) → decode as UTF-16LE (skip BOM)
/// 2. Check for UTF-16BE BOM (FE FF) → decode as UTF-16BE (skip BOM)
/// 3. Null-byte heuristic: valid UTF-8 text never contains embedded null bytes
///    (U+0000). UTF-16LE text *always* contains null bytes because even CJK text
///    includes ASCII newlines, spaces, and digits whose high byte is 0x00.
///    If any null byte is found → try UTF-16LE, validate, and use if good.
/// 4. Otherwise → UTF-8
fn decode_wsl_bytes(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    // Check for UTF-16LE BOM (FF FE)
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        return decode_utf16le(&bytes[2..]);
    }

    // Check for UTF-16BE BOM (FE FF)
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        return decode_utf16be(&bytes[2..]);
    }

    // Null-byte heuristic: if any null byte exists, it's very likely UTF-16LE.
    // Valid UTF-8 text never contains embedded null bytes. UTF-16LE text will
    // always contain null bytes because ASCII characters (spaces, newlines,
    // digits, punctuation) have 0x00 as their high byte. Even CJK-heavy output
    // from wsl.exe contains enough ASCII to guarantee null bytes.
    if bytes.len() >= 2 && bytes.contains(&0x00) {
        // UTF-16LE produces even-length byte sequences; handle odd length gracefully
        let data = if bytes.len() % 2 == 0 {
            bytes
        } else {
            &bytes[..bytes.len() - 1]
        };

        let utf16_result = decode_utf16le(data);

        // Validate: reject if the result is mostly replacement characters (U+FFFD),
        // which would indicate a wrong decode.
        let total_chars = utf16_result.chars().count();
        let replacement_count = utf16_result.chars().filter(|&c| c == '\u{FFFD}').count();
        if total_chars > 0 && (replacement_count as f64 / total_chars as f64) < 0.1 {
            return utf16_result;
        }
    }

    // Fall back to UTF-8 (with lossy replacement for invalid sequences)
    let s = String::from_utf8_lossy(bytes).to_string();
    // Still strip stray null bytes that might appear in mixed encoding scenarios
    s.replace('\0', "")
}

fn decode_utf16le(bytes: &[u8]) -> String {
    let u16_values: Vec<u16> = bytes
        .chunks(2)
        .filter(|chunk| chunk.len() == 2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();
    String::from_utf16_lossy(&u16_values)
}

fn decode_utf16be(bytes: &[u8]) -> String {
    let u16_values: Vec<u16> = bytes
        .chunks(2)
        .filter(|chunk| chunk.len() == 2)
        .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
        .collect();
    String::from_utf16_lossy(&u16_values)
}

/// Execute wsl.exe with proper UTF-16LE output decoding.
///
/// On Windows, wsl.exe outputs UTF-16LE encoded text even when stdout is piped.
/// This function reads raw bytes and decodes them properly instead of using
/// the standard UTF-8 assumption in `process::execute`.
async fn execute_wsl(args: &[&str], timeout: Duration) -> CogniaResult<ProcessOutput> {
    let mut cmd = TokioCommand::new("wsl.exe");
    cmd.args(args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Prevent console window flash on Windows
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd
        .spawn()
        .map_err(|e| CogniaError::Provider(format!("Failed to start wsl.exe: {}", e)))?;

    let output = tokio::time::timeout(timeout, child.wait_with_output())
        .await
        .map_err(|_| CogniaError::Provider(format!("WSL command timed out after {:?}", timeout)))?
        .map_err(|e| CogniaError::Provider(format!("WSL process error: {}", e)))?;

    let stdout = decode_wsl_bytes(&output.stdout);
    let stderr = decode_wsl_bytes(&output.stderr);
    let exit_code = output.status.code().unwrap_or(-1);
    let success = output.status.success();

    Ok(ProcessOutput {
        exit_code,
        stdout,
        stderr,
        success,
    })
}

/// Execute a non-wsl program (e.g., distro launchers like ubuntu.exe) with standard encoding.
async fn execute_program(
    program: &str,
    args: &[&str],
    timeout: Duration,
) -> CogniaResult<ProcessOutput> {
    process::execute(
        program,
        args,
        Some(ProcessOptions::new().with_timeout(timeout)),
    )
    .await
    .map_err(|e| CogniaError::Provider(format!("{}", e)))
}

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

/// Parsed component versions from `wsl --version` output.
///
/// Example output:
/// ```text
/// WSL version: 2.6.1.0
/// Kernel version: 6.6.87.2-1
/// WSLg version: 1.0.66
/// MSRDC version: 1.2.6353
/// Direct3D version: 1.611.1-81528511
/// DXCore version: 10.0.26100.1-240331-1435.ge-release
/// Windows version: 10.0.26100.6584
/// ```
#[derive(Debug, Clone, Default)]
pub struct WslVersionInfo {
    pub wsl_version: Option<String>,
    pub kernel_version: Option<String>,
    pub wslg_version: Option<String>,
    pub msrdc_version: Option<String>,
    pub direct3d_version: Option<String>,
    pub dxcore_version: Option<String>,
    pub windows_version: Option<String>,
}

/// Runtime-detected WSL command capabilities.
#[derive(Debug, Clone, Default)]
pub struct WslCapabilities {
    pub manage: bool,
    pub r#move: bool,
    pub resize: bool,
    pub set_sparse: bool,
    pub set_default_user: bool,
    pub mount_options: bool,
    pub shutdown_force: bool,
    pub export_format: bool,
    pub import_in_place: bool,
    pub version: Option<String>,
}

/// Detected environment information from inside a WSL distribution.
///
/// Populated by parsing `/etc/os-release`, probing binaries, and reading
/// system files inside the running distro via `wsl -d <distro> --exec`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslDistroEnvironment {
    /// Lowercase distro identifier from os-release `ID` (e.g. "ubuntu", "arch", "fedora")
    pub distro_id: String,
    /// Related distro families from os-release `ID_LIKE` (e.g. ["debian"], ["rhel","centos","fedora"])
    pub distro_id_like: Vec<String>,
    /// Human-readable name from os-release `PRETTY_NAME` (e.g. "Ubuntu 24.04.1 LTS")
    pub pretty_name: String,
    /// Version number from os-release `VERSION_ID` (e.g. "24.04")
    pub version_id: Option<String>,
    /// Version codename from os-release `VERSION_CODENAME` (e.g. "noble")
    pub version_codename: Option<String>,
    /// CPU architecture (e.g. "x86_64", "aarch64")
    pub architecture: String,
    /// Linux kernel version (e.g. "5.15.167.4-1-microsoft-standard-WSL2")
    pub kernel_version: String,
    /// Detected package manager binary name (e.g. "apt", "pacman", "dnf", "zypper", "apk")
    pub package_manager: String,
    /// Init system running as PID 1 (e.g. "systemd", "init", "openrc")
    pub init_system: String,
    /// Default login shell for the current user
    pub default_shell: Option<String>,
    /// Default (current) username
    pub default_user: Option<String>,
    /// System uptime in seconds (from /proc/uptime)
    pub uptime_seconds: Option<u64>,
    /// Hostname of the distro
    pub hostname: Option<String>,
    /// Number of installed packages (via the detected package manager)
    pub installed_packages: Option<u64>,
}

impl WslProvider {
    pub fn new() -> Self {
        Self
    }

    /// Execute a wsl.exe command and return stdout on success.
    /// Uses proper UTF-16LE decoding for wsl.exe output on Windows.
    pub async fn run_wsl(&self, args: &[&str]) -> CogniaResult<String> {
        let out = execute_wsl(args, WSL_TIMEOUT).await?;
        if out.success {
            Ok(Self::trim_output(&out.stdout))
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
        let out = execute_wsl(args, WSL_LONG_TIMEOUT).await?;
        if out.success {
            Ok(Self::trim_output(&out.stdout))
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
        let out = execute_wsl(args, WSL_TIMEOUT).await?;
        let stdout = Self::trim_output(&out.stdout);
        if !stdout.trim().is_empty() {
            Ok(stdout)
        } else if !out.stderr.trim().is_empty() {
            Err(CogniaError::Provider(format!("WSL: {}", out.stderr.trim())))
        } else {
            Err(CogniaError::Provider("WSL: No output received".into()))
        }
    }

    /// Trim trailing whitespace from each line of already-decoded output.
    /// UTF-16LE decoding is handled by `execute_wsl`/`decode_wsl_bytes`.
    pub fn trim_output(raw: &str) -> String {
        raw.lines()
            .map(|l| l.trim_end())
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Legacy helper: clean WSL output by stripping null bytes + trimming.
    /// Kept for use in unit tests with pre-constructed strings.
    pub fn clean_wsl_output(raw: &str) -> String {
        raw.replace('\0', "")
            .lines()
            .map(|l| l.trim_end())
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Parse `wsl --list --verbose` output into structured distro info.
    ///
    /// Example output (English):
    /// ```text
    ///   NAME      STATE           VERSION
    /// * Ubuntu    Running         2
    ///   Debian    Stopped         2
    /// ```
    ///
    /// Example output (Chinese):
    /// ```text
    ///   名称      状态            版本
    /// * Ubuntu    Running         2
    ///   Debian    Stopped         2
    /// ```
    pub fn parse_list_verbose(output: &str) -> Vec<WslDistroInfo> {
        let lines: Vec<&str> = output.lines().collect();
        if lines.len() < 2 {
            return vec![];
        }

        // Find the header line containing "NAME" and "STATE" (or localized equivalents)
        let header_idx = lines.iter().position(|l| {
            let upper = l.to_uppercase();
            // English headers
            let en_match = upper.contains("NAME") && upper.contains("STATE");
            // Chinese headers: 名称 (name) + 状态 (state)
            let zh_match = l.contains("名称") && l.contains("状态");
            // Japanese headers
            let ja_match = l.contains("名前") && l.contains("状態");
            en_match || zh_match || ja_match
        });

        let start_idx = match header_idx {
            Some(idx) => idx + 1,
            None => {
                // Heuristic fallback: find first line that starts with '*' or has distro-like data
                // (skip lines that look like headers or descriptions)
                let data_start = lines.iter().position(|l| {
                    let trimmed = l.trim();
                    trimmed.starts_with('*')
                        || (!trimmed.is_empty()
                            && trimmed.split_whitespace().count() >= 2
                            && trimmed
                                .split_whitespace()
                                .last()
                                .map_or(false, |v| v == "1" || v == "2"))
                });
                data_start.unwrap_or(if lines.len() > 1 {
                    1
                } else {
                    return vec![];
                })
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
                    upper[first_name + 4..]
                        .find("NAME")
                        .map(|p| p + first_name + 4)
                        .unwrap_or(32)
                });
                (idx + 1, friendly_start)
            }
            None => {
                // Fallback: skip descriptive lines, look for data
                let data_start = lines
                    .iter()
                    .position(|l| {
                        let trimmed = l.trim();
                        !trimmed.is_empty()
                            && !trimmed.starts_with("The following")
                            && !trimmed.starts_with("Install using")
                            && !trimmed.to_uppercase().contains("NAME")
                    })
                    .unwrap_or(lines.len());
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
        // First line typically: "WSL version: X.Y.Z.P" (English)
        // Or: "WSL 版本: X.Y.Z.P" (Chinese)
        for line in out.lines() {
            let lower = line.to_lowercase();
            // Match English "version" or Chinese "版本"
            let is_wsl_version_line =
                lower.contains("wsl") && (lower.contains("version") || lower.contains("版本"));
            if is_wsl_version_line {
                // Extract version number after ':'
                if let Some(v) = line.split(':').nth(1) {
                    let trimmed = v.trim();
                    if !trimmed.is_empty() {
                        return Ok(trimmed.to_string());
                    }
                }
                // Sometimes format is "WSL version X.Y.Z" (no colon)
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(v) = parts.last() {
                    return Ok(v.to_string());
                }
            }
        }
        // Second pass: look for any line with a version-like pattern (X.Y.Z)
        for line in out.lines() {
            if let Some(v) = line.split(':').nth(1) {
                let trimmed = v.trim();
                if !trimmed.is_empty()
                    && trimmed.chars().next().map_or(false, |c| c.is_ascii_digit())
                {
                    return Ok(trimmed.to_string());
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

    /// Parse `wsl --version` output into structured version info.
    /// Handles both English and Chinese (and other locale) output.
    pub fn parse_version_output(output: &str) -> WslVersionInfo {
        let mut info = WslVersionInfo::default();

        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            // Split on first ':' to get key and value
            if let Some(colon_pos) = trimmed.find(':') {
                let key = trimmed[..colon_pos].trim().to_lowercase();
                let value = trimmed[colon_pos + 1..].trim().to_string();
                if value.is_empty() {
                    continue;
                }

                // Match keys: support English + Chinese (版本 = version)
                if (key.contains("wsl") && !key.contains("wslg"))
                    && (key.contains("version") || key.contains("版本"))
                {
                    info.wsl_version = Some(value);
                } else if key.contains("kernel") || (key.contains("内核") && key.contains("版本"))
                {
                    info.kernel_version = Some(value);
                } else if key.contains("wslg") {
                    info.wslg_version = Some(value);
                } else if key.contains("msrdc") {
                    info.msrdc_version = Some(value);
                } else if key.contains("direct3d") || key.contains("d3d") {
                    info.direct3d_version = Some(value);
                } else if key.contains("dxcore") {
                    info.dxcore_version = Some(value);
                } else if key.contains("windows")
                    && (key.contains("version") || key.contains("版本"))
                {
                    info.windows_version = Some(value);
                }
            }
        }
        info
    }

    /// Get full version info from `wsl --version`, parsed into structured fields.
    pub async fn get_full_version_info(&self) -> CogniaResult<WslVersionInfo> {
        let out = self.run_wsl_lenient(&["--version"]).await?;
        Ok(Self::parse_version_output(&out))
    }

    /// Parse `wsl --status` output into key-value pairs.
    /// Returns default distribution name and default WSL version if found.
    pub fn parse_status_output(output: &str) -> (Option<String>, Option<String>) {
        let mut default_distro: Option<String> = None;
        let mut default_version: Option<String> = None;

        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Some(colon_pos) = trimmed.find(':') {
                let key = trimmed[..colon_pos].trim().to_lowercase();
                let value = trimmed[colon_pos + 1..].trim().to_string();
                if value.is_empty() {
                    continue;
                }

                // Default distribution
                if (key.contains("default") && key.contains("distribution"))
                    || (key.contains("默认") && key.contains("分发"))
                {
                    default_distro = Some(value);
                }
                // Default version
                else if (key.contains("default") && key.contains("version"))
                    || (key.contains("默认") && key.contains("版本"))
                {
                    default_version = Some(value);
                }
            }
        }

        (default_distro, default_version)
    }

    /// Parse `wsl --list --running --quiet` output into a list of distro names.
    pub fn parse_list_running_quiet(output: &str) -> Vec<String> {
        output
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(ToOwned::to_owned)
            .collect()
    }

    fn is_likely_distro_name(value: &str) -> bool {
        if value.is_empty() || value.contains(':') {
            return false;
        }
        if value.contains('\\') || value.contains('/') {
            return false;
        }
        if value.split_whitespace().count() > 1 {
            return false;
        }
        value
            .chars()
            .all(|ch| ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == '.')
    }

    /// Parse legacy `wsl --list --running` output (table or localized text).
    /// Uses table parsing first, then a strict single-token fallback to avoid
    /// misclassifying localized "no running distributions" messages as distro names.
    pub fn parse_list_running(output: &str) -> Vec<String> {
        let parsed = Self::parse_list_verbose(output);
        if !parsed.is_empty() {
            return parsed.into_iter().map(|d| d.name).collect();
        }

        output
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(|line| line.trim_start_matches('*').trim())
            .filter(|line| Self::is_likely_distro_name(line))
            .map(ToOwned::to_owned)
            .collect()
    }

    fn help_has_flag(help_output: &str, flag: &str) -> bool {
        help_output.contains(flag)
    }

    /// Parse capabilities from `wsl --help` (primary) and `wsl --version` (optional).
    pub fn parse_capabilities(help_output: &str, version_output: Option<&str>) -> WslCapabilities {
        let manage = Self::help_has_flag(help_output, "--manage");
        let has_mount = Self::help_has_flag(help_output, "--mount");
        let has_shutdown = Self::help_has_flag(help_output, "--shutdown");
        let has_export = Self::help_has_flag(help_output, "--export");

        let version = version_output.and_then(|raw| {
            let parsed = Self::parse_version_output(raw);
            parsed.wsl_version.or_else(|| {
                raw.lines()
                    .map(str::trim)
                    .find(|line| !line.is_empty())
                    .map(ToOwned::to_owned)
            })
        });

        WslCapabilities {
            manage,
            r#move: manage && Self::help_has_flag(help_output, "--move"),
            resize: manage && Self::help_has_flag(help_output, "--resize"),
            set_sparse: manage && Self::help_has_flag(help_output, "--set-sparse"),
            set_default_user: manage && Self::help_has_flag(help_output, "--set-default-user"),
            mount_options: has_mount && Self::help_has_flag(help_output, "--options"),
            shutdown_force: has_shutdown && Self::help_has_flag(help_output, "--force"),
            export_format: has_export && Self::help_has_flag(help_output, "--format"),
            import_in_place: Self::help_has_flag(help_output, "--import-in-place"),
            version,
        }
    }

    /// Detect available WSL capabilities by probing `wsl --help` and `wsl --version`.
    pub async fn get_capabilities(&self) -> CogniaResult<WslCapabilities> {
        let help_output = self.run_wsl_lenient(&["--help"]).await.unwrap_or_default();
        let version_output = self.run_wsl_lenient(&["--version"]).await.ok();
        Ok(Self::parse_capabilities(
            &help_output,
            version_output.as_deref(),
        ))
    }

    fn is_unsupported_option_error(message: &str) -> bool {
        let lower = message.to_lowercase();
        lower.contains("unknown option")
            || lower.contains("unrecognized option")
            || lower.contains("invalid option")
            || lower.contains("invalid command")
            || lower.contains("not supported")
            || lower.contains("未知选项")
            || lower.contains("未识别")
            || lower.contains("不支持")
            || lower.contains("无效选项")
    }

    /// Set sparse VHD mode for a WSL distribution.
    /// When enabled, the virtual disk will automatically reclaim unused space.
    /// Requires WSL 2.0.0+ (Store version).
    pub async fn set_sparse_vhd(&self, distro: &str, enabled: bool) -> CogniaResult<()> {
        let flag = if enabled { "true" } else { "false" };
        self.run_wsl(&["--manage", distro, "--set-sparse", flag])
            .await?;
        Ok(())
    }

    /// Install WSL engine only, without installing a default distribution.
    /// Uses `wsl --install --no-distribution`.
    /// Requires elevation (admin privileges).
    pub async fn install_wsl_only(&self) -> CogniaResult<String> {
        self.run_wsl_long(&["--install", "--no-distribution"]).await
    }

    /// Install a distribution to a custom location.
    /// Uses `wsl --install -d <name> --location <path>`.
    pub async fn install_with_location(&self, name: &str, location: &str) -> CogniaResult<String> {
        self.run_wsl_long(&[
            "--install",
            "-d",
            name,
            "--no-launch",
            "--web-download",
            "--location",
            location,
        ])
        .await
    }

    fn build_move_args(distro: &str, location: &str) -> Vec<String> {
        vec![
            "--manage".into(),
            distro.into(),
            "--move".into(),
            location.into(),
        ]
    }

    fn build_resize_args(distro: &str, size: &str) -> Vec<String> {
        vec![
            "--manage".into(),
            distro.into(),
            "--resize".into(),
            size.into(),
        ]
    }

    fn build_mount_args(
        disk_path: &str,
        is_vhd: bool,
        fs_type: Option<&str>,
        partition: Option<u32>,
        mount_name: Option<&str>,
        mount_options: Option<&str>,
        bare: bool,
    ) -> Vec<String> {
        let mut args = vec!["--mount".into(), disk_path.into()];
        if is_vhd {
            args.push("--vhd".into());
        }
        if let Some(fs) = fs_type {
            args.push("--type".into());
            args.push(fs.into());
        }
        if let Some(p) = partition {
            args.push("--partition".into());
            args.push(p.to_string());
        }
        if let Some(name) = mount_name {
            args.push("--name".into());
            args.push(name.into());
        }
        if let Some(options) = mount_options {
            args.push("--options".into());
            args.push(options.into());
        }
        if bare {
            args.push("--bare".into());
        }
        args
    }

    /// Move a distribution's virtual disk to a new location.
    /// Uses `wsl --manage <distro> --move <location>`.
    pub async fn move_distro(&self, distro: &str, location: &str) -> CogniaResult<String> {
        let args = Self::build_move_args(distro, location);
        let args_ref: Vec<&str> = args.iter().map(String::as_str).collect();
        self.run_wsl_long(&args_ref).await
    }

    /// Resize a distribution's virtual disk.
    /// Uses `wsl --manage <distro> --resize <size>`.
    pub async fn resize_distro(&self, distro: &str, size: &str) -> CogniaResult<String> {
        let args = Self::build_resize_args(distro, size);
        let args_ref: Vec<&str> = args.iter().map(String::as_str).collect();
        self.run_wsl_long(&args_ref).await
    }

    /// List currently running WSL distributions.
    /// Tries `wsl --list --running --quiet` first for locale-safe parsing, then
    /// falls back to legacy `wsl --list --running` parsing.
    pub async fn list_running(&self) -> CogniaResult<Vec<String>> {
        if let Ok(out) = execute_wsl(&["--list", "--running", "--quiet"], WSL_TIMEOUT).await {
            if out.success {
                let stdout = Self::trim_output(&out.stdout);
                return Ok(Self::parse_list_running_quiet(&stdout));
            }
        }

        let out = self.run_wsl_lenient(&["--list", "--running"]).await?;
        Ok(Self::parse_list_running(&out))
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
    pub async fn export_distro(
        &self,
        name: &str,
        file_path: &str,
        as_vhd: bool,
    ) -> CogniaResult<()> {
        let mut args = vec!["--export", name, file_path];
        if as_vhd {
            args.push("--vhd");
        }
        self.run_wsl_long(&args).await?;
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
    pub async fn import_distro_in_place(&self, name: &str, vhdx_path: &str) -> CogniaResult<()> {
        self.run_wsl_long(&["--import-in-place", name, vhdx_path])
            .await?;
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
        let out = execute_wsl(&["--update", "--web-download"], WSL_LONG_TIMEOUT).await?;
        let stdout = Self::trim_output(&out.stdout);
        let stderr = Self::trim_output(&out.stderr);
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
        Ok(distros
            .into_iter()
            .find(|d| d.name.eq_ignore_ascii_case(name)))
    }

    /// Execute a command inside a specific WSL distribution.
    /// Returns (stdout, stderr, exit_code).
    ///
    /// Note: Commands run inside Linux distros output UTF-8, not UTF-16LE.
    /// But we still use `execute_wsl` since the wsl.exe wrapper may re-encode.
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

        let out = execute_wsl(&args, WSL_TIMEOUT).await?;
        let stdout = Self::trim_output(&out.stdout);
        let stderr = Self::trim_output(&out.stderr);
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

        let out = execute_wsl(&args, WSL_TIMEOUT).await?;
        let result = Self::trim_output(&out.stdout);
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
    pub fn read_wslconfig(
    ) -> CogniaResult<std::collections::HashMap<String, std::collections::HashMap<String, String>>>
    {
        let user_profile = std::env::var("USERPROFILE").map_err(|_| {
            CogniaError::Provider("USERPROFILE environment variable not set".into())
        })?;
        let config_path = PathBuf::from(&user_profile).join(".wslconfig");

        if !config_path.exists() {
            return Ok(std::collections::HashMap::new());
        }

        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| CogniaError::Provider(format!("Failed to read .wslconfig: {}", e)))?;

        Ok(Self::parse_ini_content(&content))
    }

    /// Write a setting to the global .wslconfig file.
    /// Creates the file if it doesn't exist.
    pub fn write_wslconfig(section: &str, key: &str, value: &str) -> CogniaResult<()> {
        let user_profile = std::env::var("USERPROFILE").map_err(|_| {
            CogniaError::Provider("USERPROFILE environment variable not set".into())
        })?;
        let config_path = PathBuf::from(&user_profile).join(".wslconfig");

        let mut sections = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)
                .map_err(|e| CogniaError::Provider(format!("Failed to read .wslconfig: {}", e)))?;
            Self::parse_ini_content(&content)
        } else {
            std::collections::HashMap::new()
        };

        sections
            .entry(section.to_string())
            .or_default()
            .insert(key.to_string(), value.to_string());

        let output = Self::serialize_ini_content(&sections);
        std::fs::write(&config_path, output)
            .map_err(|e| CogniaError::Provider(format!("Failed to write .wslconfig: {}", e)))?;

        Ok(())
    }

    /// Remove a setting from the global .wslconfig file.
    pub fn remove_wslconfig_key(section: &str, key: &str) -> CogniaResult<bool> {
        let user_profile = std::env::var("USERPROFILE").map_err(|_| {
            CogniaError::Provider("USERPROFILE environment variable not set".into())
        })?;
        let config_path = PathBuf::from(&user_profile).join(".wslconfig");

        if !config_path.exists() {
            return Ok(false);
        }

        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| CogniaError::Provider(format!("Failed to read .wslconfig: {}", e)))?;

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
            std::fs::write(&config_path, output)
                .map_err(|e| CogniaError::Provider(format!("Failed to write .wslconfig: {}", e)))?;
        }

        Ok(removed)
    }

    /// Parse INI-style content into section → key → value map.
    fn parse_ini_content(
        content: &str,
    ) -> std::collections::HashMap<String, std::collections::HashMap<String, String>> {
        let mut sections: std::collections::HashMap<
            String,
            std::collections::HashMap<String, String>,
        > = std::collections::HashMap::new();
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
    fn serialize_ini_content(
        sections: &std::collections::HashMap<String, std::collections::HashMap<String, String>>,
    ) -> String {
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
        mount_options: Option<&str>,
        bare: bool,
    ) -> CogniaResult<String> {
        let args = Self::build_mount_args(
            disk_path,
            is_vhd,
            fs_type,
            partition,
            mount_name,
            mount_options,
            bare,
        );
        let args_ref: Vec<&str> = args.iter().map(String::as_str).collect();
        self.run_wsl_long(&args_ref).await
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
        let out = execute_wsl(&args, WSL_TIMEOUT).await?;
        let ip = Self::trim_output(&out.stdout).trim().to_string();
        if ip.is_empty() {
            return Err(CogniaError::Provider(
                "WSL: Could not determine IP address".into(),
            ));
        }
        // hostname -I may return multiple IPs, take the first one
        Ok(ip.split_whitespace().next().unwrap_or(&ip).to_string())
    }

    /// Change the default user for a distribution.
    /// Prefers `wsl --manage <distro> --set-default-user <user>` on modern WSL,
    /// then falls back to launcher/config-based strategies for compatibility.
    pub async fn change_default_user(&self, distro: &str, username: &str) -> CogniaResult<()> {
        // Preferred modern path (WSL manage command).
        match self
            .run_wsl(&["--manage", distro, "--set-default-user", username])
            .await
        {
            Ok(_) => return Ok(()),
            Err(err) if !Self::is_unsupported_option_error(&err.to_string()) => return Err(err),
            Err(_) => {}
        }

        // Fallback 1: launcher executable approach
        // (e.g., ubuntu.exe config --default-user user).
        let exe_name = format!("{}.exe", distro.to_lowercase());
        let result = execute_program(
            &exe_name,
            &["config", "--default-user", username],
            WSL_TIMEOUT,
        )
        .await;

        match result {
            Ok(out) if out.success => Ok(()),
            _ => {
                // Fallback 2: edit /etc/wsl.conf inside the distro.
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
    ) -> CogniaResult<std::collections::HashMap<String, std::collections::HashMap<String, String>>>
    {
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

    // ========================================================================
    // Distro environment detection
    // ========================================================================

    /// Parse `/etc/os-release` content into a key-value map.
    ///
    /// The file format is `KEY=VALUE` or `KEY="VALUE"` per line.
    /// Lines starting with `#` are comments. Blank lines are ignored.
    pub fn parse_os_release(content: &str) -> std::collections::HashMap<String, String> {
        let mut map = std::collections::HashMap::new();
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            if let Some(eq_pos) = trimmed.find('=') {
                let key = trimmed[..eq_pos].trim().to_string();
                let raw_value = trimmed[eq_pos + 1..].trim();
                // Strip surrounding quotes (single or double)
                let value = if (raw_value.starts_with('"') && raw_value.ends_with('"'))
                    || (raw_value.starts_with('\'') && raw_value.ends_with('\''))
                {
                    raw_value[1..raw_value.len() - 1].to_string()
                } else {
                    raw_value.to_string()
                };
                map.insert(key, value);
            }
        }
        map
    }

    /// Detect the package manager from the distro `ID` and `ID_LIKE` fields.
    ///
    /// Returns `None` if no known mapping exists (caller should fall back to
    /// binary probing).
    pub fn detect_package_manager_from_id(id: &str, id_like: &[String]) -> Option<&'static str> {
        // Check exact ID first
        let pm = match id {
            "ubuntu" | "debian" | "linuxmint" | "pop" | "elementary" | "zorin" | "kali"
            | "parrot" | "raspbian" | "elxr" | "pengwin" | "wlinux" | "deepin" | "mx" => {
                Some("apt")
            }

            "arch" | "manjaro" | "endeavouros" | "garuda" | "artix" => Some("pacman"),

            "fedora" | "rhel" | "centos" | "rocky" | "almalinux" | "nobara" | "amazon" => {
                Some("dnf")
            }

            "opensuse-tumbleweed" | "opensuse-leap" | "opensuse" | "sles" | "sled" | "suse" => {
                Some("zypper")
            }

            "alpine" => Some("apk"),
            "void" => Some("xbps-install"),
            "gentoo" | "funtoo" => Some("emerge"),
            "nixos" => Some("nix"),
            "clear-linux-os" | "clearlinux" => Some("swupd"),
            "solus" => Some("eopkg"),

            // Oracle Linux: 7.x uses yum, 8+ uses dnf — prefer dnf
            "ol" | "oraclelinux" => Some("dnf"),

            _ => None,
        };

        if pm.is_some() {
            return pm;
        }

        // Fall back to ID_LIKE families
        for like in id_like {
            match like.as_str() {
                "debian" | "ubuntu" => return Some("apt"),
                "arch" => return Some("pacman"),
                "fedora" | "rhel" | "centos" => return Some("dnf"),
                "suse" | "opensuse" => return Some("zypper"),
                _ => {}
            }
        }

        None
    }

    /// Return the shell command to count installed packages for a given package manager.
    pub fn get_package_count_command(pm: &str) -> Option<&'static str> {
        match pm {
            "apt" => Some("dpkg --list 2>/dev/null | grep -c '^ii'"),
            "pacman" => Some("pacman -Q 2>/dev/null | wc -l"),
            "dnf" | "yum" => Some("rpm -qa 2>/dev/null | wc -l"),
            "zypper" => Some("rpm -qa 2>/dev/null | wc -l"),
            "apk" => Some("apk list --installed 2>/dev/null | wc -l"),
            "xbps-install" => Some("xbps-query -l 2>/dev/null | wc -l"),
            "emerge" => {
                Some("qlist -I 2>/dev/null | wc -l || ls /var/db/pkg/*/* -d 2>/dev/null | wc -l")
            }
            "nix" => Some("nix-env -q 2>/dev/null | wc -l"),
            _ => None,
        }
    }

    /// Return the package update and upgrade commands for a given package manager.
    pub fn get_distro_update_command(pm: &str) -> Option<(&'static str, &'static str)> {
        match pm {
            "apt" => Some(("apt update", "apt upgrade -y")),
            "pacman" => Some(("pacman -Sy", "pacman -Syu --noconfirm")),
            "dnf" => Some(("dnf check-update", "dnf upgrade -y")),
            "yum" => Some(("yum check-update", "yum upgrade -y")),
            "zypper" => Some(("zypper refresh", "zypper update -y")),
            "apk" => Some(("apk update", "apk upgrade")),
            "xbps-install" => Some(("xbps-install -S", "xbps-install -Su")),
            "emerge" => Some(("emerge --sync", "emerge -uDN @world")),
            "nix" => Some(("nix-channel --update", "nix-env -u")),
            "swupd" => Some(("swupd check-update", "swupd update")),
            _ => None,
        }
    }

    /// Detect the full environment inside a WSL distribution.
    ///
    /// The distro must be in a running or startable state. This method executes
    /// a series of lightweight commands inside the distro to gather metadata.
    pub async fn detect_distro_environment(
        &self,
        distro: &str,
    ) -> CogniaResult<WslDistroEnvironment> {
        // Run all detection commands in a single shell invocation for efficiency.
        // Each result is separated by a unique delimiter.
        let delim = "---COGNIA_DELIM---";
        let script = format!(
            concat!(
                "cat /etc/os-release 2>/dev/null || echo 'ID=unknown'",
                "; echo '{d}'",
                "; uname -m 2>/dev/null || echo 'unknown'",
                "; echo '{d}'",
                "; uname -r 2>/dev/null || echo 'unknown'",
                "; echo '{d}'",
                "; cat /proc/1/comm 2>/dev/null || echo 'unknown'",
                "; echo '{d}'",
                // Probe for package managers — print the first found
                "; for pm in apt pacman dnf yum zypper apk xbps-install nix emerge swupd eopkg; do",
                "   if command -v $pm >/dev/null 2>&1; then echo $pm; break; fi;",
                " done; echo ''",
                "; echo '{d}'",
                "; whoami 2>/dev/null || echo 'unknown'",
                "; echo '{d}'",
                // Get default shell from /etc/passwd for current user
                "; getent passwd $(whoami) 2>/dev/null | cut -d: -f7 || echo ''",
                "; echo '{d}'",
                "; hostname 2>/dev/null || echo ''",
                "; echo '{d}'",
                "; cat /proc/uptime 2>/dev/null | cut -d' ' -f1 || echo ''"
            ),
            d = delim
        );

        let (stdout, stderr, code) = self.exec_command(distro, &script, None).await?;
        if code != 0 && stdout.trim().is_empty() {
            return Err(CogniaError::Provider(format!(
                "Failed to detect environment in '{}': {}",
                distro,
                stderr.trim()
            )));
        }

        let parts: Vec<&str> = stdout.split(delim).collect();
        if parts.len() < 9 {
            return Err(CogniaError::Provider(format!(
                "Unexpected detection output from '{}': got {} sections, expected 9",
                distro,
                parts.len()
            )));
        }

        // 1. Parse /etc/os-release
        let os_release = Self::parse_os_release(parts[0].trim());
        let distro_id = os_release
            .get("ID")
            .cloned()
            .unwrap_or_else(|| "unknown".to_string());
        let id_like_str = os_release.get("ID_LIKE").cloned().unwrap_or_default();
        let distro_id_like: Vec<String> = id_like_str
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();
        let pretty_name = os_release
            .get("PRETTY_NAME")
            .cloned()
            .unwrap_or_else(|| distro_id.clone());
        let version_id = os_release.get("VERSION_ID").cloned();
        let version_codename = os_release.get("VERSION_CODENAME").cloned();

        // 2. Architecture
        let architecture = parts[1].trim().to_string();

        // 3. Kernel version
        let kernel_version = parts[2].trim().to_string();

        // 4. Init system
        let init_system = parts[3].trim().to_string();

        // 5. Package manager — prefer ID-based detection, fall back to binary probe
        let probed_pm = parts[4]
            .trim()
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        let package_manager = Self::detect_package_manager_from_id(&distro_id, &distro_id_like)
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                if probed_pm.is_empty() {
                    "unknown".to_string()
                } else {
                    probed_pm.clone()
                }
            });

        // 6. Default user
        let default_user = {
            let u = parts[5].trim().to_string();
            if u.is_empty() || u == "unknown" {
                None
            } else {
                Some(u)
            }
        };

        // 7. Default shell
        let default_shell = {
            let s = parts[6].trim().to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        };

        // 8. Hostname
        let hostname = {
            let h = parts[7].trim().to_string();
            if h.is_empty() {
                None
            } else {
                Some(h)
            }
        };

        // 9. Uptime
        let uptime_seconds = parts[8].trim().parse::<f64>().ok().map(|f| f as u64);

        // 10. Get installed package count using the detected package manager
        let installed_packages =
            if let Some(cmd) = Self::get_package_count_command(&package_manager) {
                match self.exec_command(distro, cmd, None).await {
                    Ok((out, _, 0)) => out.trim().parse::<u64>().ok(),
                    _ => None,
                }
            } else {
                None
            };

        Ok(WslDistroEnvironment {
            distro_id,
            distro_id_like,
            pretty_name,
            version_id,
            version_codename,
            architecture,
            kernel_version,
            package_manager,
            init_system,
            default_shell,
            default_user,
            uptime_seconds,
            hostname,
            installed_packages,
        })
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
        // Multi-step detection strategy, ordered by reliability:
        // 1. `wsl --version` — most reliable, available on Store-installed WSL 2.x
        // 2. `wsl --status` — available on modern WSL (may be missing on inbox/legacy)
        // 3. `wsl --help` — universally available if wsl.exe exists at all
        //
        // Uses positive pattern matching (look for version-like output) instead of
        // fragile negative matching against localized error strings.

        // Step 1: Try `wsl --version` (best indicator of a working WSL installation)
        log::debug!("[WSL] is_available: Step 1 — trying wsl --version");
        match execute_wsl(&["--version"], WSL_AVAIL_TIMEOUT).await {
            Ok(out) => {
                let combined = format!("{} {}", out.stdout, out.stderr);
                log::debug!(
                    "[WSL] --version exit_code={}, success={}, stdout_len={}, stderr_len={}, combined_first_200='{}'",
                    out.exit_code,
                    out.success,
                    out.stdout.len(),
                    out.stderr.len(),
                    &combined.chars().take(200).collect::<String>()
                );
                let has_digit = combined.chars().any(|c| c.is_ascii_digit());
                let has_marker =
                    combined.contains('.') || combined.contains("WSL") || combined.contains("wsl");
                if has_digit && has_marker {
                    log::debug!(
                        "[WSL] is_available: Step 1 PASSED (has_digit={}, has_marker={})",
                        has_digit,
                        has_marker
                    );
                    return true;
                }
                log::debug!("[WSL] is_available: Step 1 failed positive check (has_digit={}, has_marker={})", has_digit, has_marker);
            }
            Err(e) => {
                log::debug!("[WSL] is_available: Step 1 execute_wsl error: {}", e);
            }
        }

        // Step 2: Try `wsl --status` (modern WSL, may not exist on older inbox versions)
        log::debug!("[WSL] is_available: Step 2 — trying wsl --status");
        match execute_wsl(&["--status"], WSL_AVAIL_TIMEOUT).await {
            Ok(out) => {
                let combined = format!("{} {}", out.stdout, out.stderr);
                let trimmed = combined.trim();
                log::debug!(
                    "[WSL] --status exit_code={}, trimmed_len={}, first_200='{}'",
                    out.exit_code,
                    trimmed.len(),
                    &trimmed.chars().take(200).collect::<String>()
                );
                if !trimmed.is_empty() && trimmed.len() > 10 {
                    let lower = trimmed.to_lowercase();
                    let is_error = lower.contains("not recognized")
                        || lower.contains("enable the virtual machine")
                        || lower.contains("not installed");
                    if !is_error {
                        log::debug!("[WSL] is_available: Step 2 PASSED");
                        return true;
                    }
                    log::debug!("[WSL] is_available: Step 2 failed — error indicator found");
                } else {
                    log::debug!("[WSL] is_available: Step 2 failed — output too short or empty");
                }
            }
            Err(e) => {
                log::debug!("[WSL] is_available: Step 2 execute_wsl error: {}", e);
            }
        }

        // Step 3: Try `wsl --help` (universally supported if wsl.exe exists)
        log::debug!("[WSL] is_available: Step 3 — trying wsl --help");
        match execute_wsl(&["--help"], WSL_AVAIL_TIMEOUT).await {
            Ok(out) => {
                let combined = format!("{}{}", out.stdout, out.stderr);
                log::debug!(
                    "[WSL] --help exit_code={}, combined_len={}, non_empty={}",
                    out.exit_code,
                    combined.len(),
                    !combined.trim().is_empty()
                );
                if !combined.trim().is_empty() {
                    log::debug!("[WSL] is_available: Step 3 PASSED");
                    return true;
                }
            }
            Err(e) => {
                log::debug!("[WSL] is_available: Step 3 execute_wsl error: {}", e);
            }
        }

        // Step 4: Absolute path fallback — try C:\Windows\System32\wsl.exe directly
        #[cfg(windows)]
        {
            let abs_path = "C:\\Windows\\System32\\wsl.exe";
            let exists = std::path::Path::new(abs_path).exists();
            log::debug!(
                "[WSL] is_available: Step 4 — absolute path fallback, exists={}",
                exists
            );
            if exists {
                match TokioCommand::new(abs_path)
                    .arg("--help")
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .creation_flags(0x08000000) // CREATE_NO_WINDOW
                    .output()
                    .await
                {
                    Ok(output) => {
                        let stdout = decode_wsl_bytes(&output.stdout);
                        let stderr = decode_wsl_bytes(&output.stderr);
                        let combined = format!("{}{}", stdout, stderr);
                        log::debug!(
                            "[WSL] abs_path --help: status={:?}, combined_len={}, non_empty={}",
                            output.status.code(),
                            combined.len(),
                            !combined.trim().is_empty()
                        );
                        if !combined.trim().is_empty() {
                            log::debug!("[WSL] is_available: Step 4 PASSED");
                            return true;
                        }
                    }
                    Err(e) => {
                        log::debug!("[WSL] is_available: Step 4 spawn error: {}", e);
                    }
                }
            }
        }

        log::debug!("[WSL] is_available: ALL STEPS FAILED — returning false");
        false
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
                    if info.is_default {
                        "default"
                    } else {
                        "not default"
                    }
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

        self.run_wsl(&["--unregister", &req.name])
            .await
            .map_err(|e| {
                CogniaError::Provider(format!(
                    "Failed to unregister WSL distribution '{}': {}. All data will be lost.",
                    req.name, e
                ))
            })?;
        Ok(())
    }

    /// List all installed WSL distributions with their state and version.
    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_wsl_lenient(&["--list", "--verbose"]).await?;
        let distros = Self::parse_list_verbose(&out);

        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\Users".into());

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

    /// Check for WSL updates non-destructively.
    /// Uses `winget list Microsoft.WSL` to compare installed vs available version.
    /// Does NOT use `wsl --update` which would actually perform an update.
    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        // Get current WSL version
        let current_version = match self.get_wsl_version_string().await {
            Ok(v) => v,
            Err(_) => return Ok(updates),
        };

        // Use winget to check for available updates (non-destructive)
        let winget_result = process::execute(
            "winget",
            &[
                "list",
                "Microsoft.WSL",
                "--accept-source-agreements",
                "--disable-interactivity",
            ],
            Some(ProcessOptions::new().with_timeout(Duration::from_secs(30))),
        )
        .await;

        if let Ok(out) = winget_result {
            // winget list output is fixed-width columns:
            // Name                        Id            Version Available Source
            // Windows Subsystem for Linux  Microsoft.WSL 2.6.1.0 2.6.3     winget
            let stdout = &out.stdout;
            for line in stdout.lines() {
                if !line.contains("Microsoft.WSL") {
                    continue;
                }
                let parts: Vec<&str> = line.split_whitespace().collect();
                // Find version fields: look for two adjacent version-like strings
                // where the second (Available) differs from the first (Installed)
                let mut found_installed = false;
                for (i, part) in parts.iter().enumerate() {
                    if part.contains('.')
                        && part.chars().next().map_or(false, |c| c.is_ascii_digit())
                    {
                        if !found_installed {
                            found_installed = true;
                        } else {
                            // This is the "Available" column
                            let available = *part;
                            if available != current_version && available != parts[i - 1] {
                                updates.push(UpdateInfo {
                                    name: "wsl".into(),
                                    current_version: current_version.clone(),
                                    latest_version: available.to_string(),
                                    provider: self.id().into(),
                                });
                            }
                            break;
                        }
                    }
                }
            }
        }
        // If winget is not available, return empty (no false positive)

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
            let out = execute_wsl(
                &["-d", name, "--exec", "sh", "-c", "apt update && apt upgrade -y 2>/dev/null || dnf upgrade -y 2>/dev/null || pacman -Syu --noconfirm 2>/dev/null || zypper update -y 2>/dev/null || apk upgrade 2>/dev/null || echo 'Update completed'"],
                WSL_LONG_TIMEOUT,
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
            Ok(output) => Ok(output.lines().any(|l| l.trim().eq_ignore_ascii_case(name))),
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
        let content =
            "[experimental]\nautoMemoryReclaim=gradual\n\n[wsl2]\nmemory=4GB\nprocessors=2\n";
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

    // ========================================================================
    // UTF-16LE decoding tests
    // ========================================================================

    #[test]
    fn test_decode_wsl_bytes_empty() {
        assert_eq!(decode_wsl_bytes(&[]), "");
    }

    #[test]
    fn test_decode_wsl_bytes_utf8_ascii() {
        let input = b"Hello World";
        assert_eq!(decode_wsl_bytes(input), "Hello World");
    }

    #[test]
    fn test_decode_wsl_bytes_utf16le_ascii() {
        // "NAME" in UTF-16LE: 4E 00 41 00 4D 00 45 00
        let input: &[u8] = &[0x4E, 0x00, 0x41, 0x00, 0x4D, 0x00, 0x45, 0x00];
        assert_eq!(decode_wsl_bytes(input), "NAME");
    }

    #[test]
    fn test_decode_wsl_bytes_utf16le_with_bom() {
        // BOM (FF FE) + "Hi" in UTF-16LE
        let input: &[u8] = &[0xFF, 0xFE, 0x48, 0x00, 0x69, 0x00];
        assert_eq!(decode_wsl_bytes(input), "Hi");
    }

    #[test]
    fn test_decode_wsl_bytes_utf16le_chinese() {
        // "WSL 版本: 2.6.1.0" in UTF-16LE
        // WSL = 57 00 53 00 4C 00
        // space = 20 00
        // 版 = 48 72, 本 = 2C 67
        // : = 3A 00, space = 20 00
        // 2 = 32 00, . = 2E 00, 6 = 36 00, . = 2E 00, 1 = 31 00, . = 2E 00, 0 = 30 00
        let input: &[u8] = &[
            0x57, 0x00, 0x53, 0x00, 0x4C, 0x00, 0x20, 0x00, // WSL
            0x48, 0x72, 0x2C, 0x67, // 版本
            0x3A, 0x00, 0x20, 0x00, // :
            0x32, 0x00, 0x2E, 0x00, 0x36, 0x00, 0x2E, 0x00, // 2.6.
            0x31, 0x00, 0x2E, 0x00, 0x30, 0x00, // 1.0
        ];
        let decoded = decode_wsl_bytes(input);
        assert!(decoded.contains("WSL"));
        assert!(decoded.contains("版本"));
        assert!(decoded.contains("2.6.1.0"));
    }

    #[test]
    fn test_decode_wsl_bytes_utf16le_list_verbose() {
        // "  NAME      STATE" in UTF-16LE
        let text = "  NAME      STATE";
        let utf16le: Vec<u8> = text.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
        let decoded = decode_wsl_bytes(&utf16le);
        assert_eq!(decoded, "  NAME      STATE");
    }

    #[test]
    fn test_decode_wsl_bytes_utf16be_with_bom() {
        // BOM (FE FF) + "OK" in UTF-16BE
        let input: &[u8] = &[0xFE, 0xFF, 0x00, 0x4F, 0x00, 0x4B];
        assert_eq!(decode_wsl_bytes(input), "OK");
    }

    #[test]
    fn test_decode_wsl_bytes_utf8_chinese() {
        // Pure UTF-8 Chinese text (not UTF-16LE)
        let input = "你好世界".as_bytes();
        assert_eq!(decode_wsl_bytes(input), "你好世界");
    }

    #[test]
    fn test_decode_wsl_bytes_utf16le_cjk_heavy() {
        // "适用于 Linux 的 Windows 子系统分发:\nUbuntu (默认)\n" in UTF-16LE
        // This is the exact scenario that caused garbled text: CJK-heavy headers
        // where the old heuristic (odd-byte sampling) failed.
        let text = "适用于 Linux 的 Windows 子系统分发:\nUbuntu (默认)\n";
        let utf16le: Vec<u8> = text.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
        let decoded = decode_wsl_bytes(&utf16le);
        assert!(decoded.contains("Ubuntu"), "decoded={}", decoded);
        assert!(decoded.contains("适用于"), "decoded={}", decoded);
        assert!(decoded.contains("默认"), "decoded={}", decoded);
    }

    #[test]
    fn test_decode_wsl_bytes_utf16le_running_list() {
        // Simulates `wsl --list --running` output in Chinese locale
        let text = "适用于 Linux 的 Windows 子系统分发:\nUbuntu-24.04 (默认)\nDebian\n";
        let utf16le: Vec<u8> = text.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
        let decoded = decode_wsl_bytes(&utf16le);
        assert!(decoded.contains("Ubuntu-24.04"), "decoded={}", decoded);
        assert!(decoded.contains("Debian"), "decoded={}", decoded);
    }

    #[test]
    fn test_decode_wsl_bytes_utf16le_japanese() {
        // Japanese locale header
        let text = "Linux 用 Windows サブシステム ディストリビューション:\nUbuntu\n";
        let utf16le: Vec<u8> = text.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
        let decoded = decode_wsl_bytes(&utf16le);
        assert!(decoded.contains("Ubuntu"), "decoded={}", decoded);
        assert!(decoded.contains("サブシステム"), "decoded={}", decoded);
    }

    // ========================================================================
    // Chinese locale header parsing tests
    // ========================================================================

    #[test]
    fn test_parse_list_verbose_chinese_headers() {
        let output = "  名称                      状态            版本\n* Ubuntu-24.04              Stopped         2\n  Debian                    Stopped         2\n";
        let distros = WslProvider::parse_list_verbose(output);

        assert_eq!(distros.len(), 2);
        assert_eq!(distros[0].name, "Ubuntu-24.04");
        assert_eq!(distros[0].state, "Stopped");
        assert_eq!(distros[0].wsl_version, "2");
        assert!(distros[0].is_default);
        assert_eq!(distros[1].name, "Debian");
        assert!(!distros[1].is_default);
    }

    #[test]
    fn test_parse_list_verbose_no_header_fallback() {
        // Output with no recognizable header but valid data lines
        let output =
            "UNKNOWN_HEADER_LINE\n* Ubuntu    Running         2\n  Debian    Stopped         1\n";
        let distros = WslProvider::parse_list_verbose(output);

        assert_eq!(distros.len(), 2);
        assert_eq!(distros[0].name, "Ubuntu");
        assert!(distros[0].is_default);
        assert_eq!(distros[1].name, "Debian");
        assert_eq!(distros[1].wsl_version, "1");
    }

    #[test]
    fn test_parse_list_running_quiet_empty() {
        let running = WslProvider::parse_list_running_quiet("");
        assert!(running.is_empty());
    }

    #[test]
    fn test_parse_list_running_localized_no_running_message() {
        let output = "当前没有正在运行的分发。";
        let running = WslProvider::parse_list_running(output);
        assert!(running.is_empty());
    }

    #[test]
    fn test_trim_output() {
        let input = "line1  \nline2  \n  line3  ";
        let result = WslProvider::trim_output(input);
        assert_eq!(result, "line1\nline2\n  line3");
    }

    // ========================================================================
    // parse_version_output tests
    // ========================================================================

    #[test]
    fn test_parse_version_output_english() {
        let output = "\
WSL version: 2.6.1.0
Kernel version: 6.6.87.2-1
WSLg version: 1.0.66
MSRDC version: 1.2.6353
Direct3D version: 1.611.1-81528511
DXCore version: 10.0.26100.1-240331-1435.ge-release
Windows version: 10.0.26100.6584";
        let info = WslProvider::parse_version_output(output);

        assert_eq!(info.wsl_version.as_deref(), Some("2.6.1.0"));
        assert_eq!(info.kernel_version.as_deref(), Some("6.6.87.2-1"));
        assert_eq!(info.wslg_version.as_deref(), Some("1.0.66"));
        assert_eq!(info.msrdc_version.as_deref(), Some("1.2.6353"));
        assert_eq!(info.direct3d_version.as_deref(), Some("1.611.1-81528511"));
        assert_eq!(
            info.dxcore_version.as_deref(),
            Some("10.0.26100.1-240331-1435.ge-release")
        );
        assert_eq!(info.windows_version.as_deref(), Some("10.0.26100.6584"));
    }

    #[test]
    fn test_parse_version_output_chinese() {
        let output = "\
WSL 版本: 2.4.12.0
内核版本: 5.15.167.4-1
WSLg 版本: 1.0.65
MSRDC 版本: 1.2.5716
Direct3D 版本: 1.611.1-81528511
DXCore 版本: 10.0.26100.1-240331-1435.ge-release
Windows 版本: 10.0.22635.4805";
        let info = WslProvider::parse_version_output(output);

        assert_eq!(info.wsl_version.as_deref(), Some("2.4.12.0"));
        assert_eq!(info.kernel_version.as_deref(), Some("5.15.167.4-1"));
        assert_eq!(info.wslg_version.as_deref(), Some("1.0.65"));
        assert_eq!(info.windows_version.as_deref(), Some("10.0.22635.4805"));
    }

    #[test]
    fn test_parse_version_output_empty() {
        let info = WslProvider::parse_version_output("");
        assert!(info.wsl_version.is_none());
        assert!(info.kernel_version.is_none());
    }

    #[test]
    fn test_parse_version_output_partial() {
        let output = "WSL version: 2.0.0\nSome random line\n";
        let info = WslProvider::parse_version_output(output);
        assert_eq!(info.wsl_version.as_deref(), Some("2.0.0"));
        assert!(info.kernel_version.is_none());
    }

    // ========================================================================
    // parse_status_output tests
    // ========================================================================

    #[test]
    fn test_parse_status_output_english() {
        let output = "\
Default Distribution: Ubuntu
Default Version: 2
";
        let (distro, version) = WslProvider::parse_status_output(output);
        assert_eq!(distro.as_deref(), Some("Ubuntu"));
        assert_eq!(version.as_deref(), Some("2"));
    }

    #[test]
    fn test_parse_status_output_empty() {
        let (distro, version) = WslProvider::parse_status_output("");
        assert!(distro.is_none());
        assert!(version.is_none());
    }

    #[test]
    fn test_parse_capabilities_english_help() {
        let help = r#"
Usage: wsl.exe [Argument]
  --manage <Distro>
  --move <Location>
  --resize <Size>
  --set-default-user <UserName>
  --set-sparse <true|false>
  --mount <DiskPath>
  --options <Options>
  --shutdown
  --force
  --export <Distro> <FileName>
  --format <tar|vhd>
  --import-in-place <Distro> <FileName>
"#;
        let version = "WSL version: 2.6.1.0";
        let caps = WslProvider::parse_capabilities(help, Some(version));

        assert!(caps.manage);
        assert!(caps.r#move);
        assert!(caps.resize);
        assert!(caps.set_default_user);
        assert!(caps.set_sparse);
        assert!(caps.mount_options);
        assert!(caps.shutdown_force);
        assert!(caps.export_format);
        assert!(caps.import_in_place);
        assert_eq!(caps.version.as_deref(), Some("2.6.1.0"));
    }

    #[test]
    fn test_parse_capabilities_without_manage() {
        let help = r#"
用法: wsl.exe [参数]
  --mount <DiskPath>
  --unmount [DiskPath]
  --import-in-place <Distro> <FileName>
"#;
        let caps = WslProvider::parse_capabilities(help, None);

        assert!(!caps.manage);
        assert!(!caps.r#move);
        assert!(!caps.resize);
        assert!(!caps.set_sparse);
        assert!(!caps.set_default_user);
        assert!(!caps.mount_options);
        assert!(!caps.shutdown_force);
        assert!(!caps.export_format);
        assert!(caps.import_in_place);
    }

    #[test]
    fn test_build_move_and_resize_args() {
        let move_args = WslProvider::build_move_args("Ubuntu", "D:\\WSL\\Ubuntu");
        let resize_args = WslProvider::build_resize_args("Ubuntu", "300GB");

        assert_eq!(
            move_args,
            vec!["--manage", "Ubuntu", "--move", "D:\\WSL\\Ubuntu"]
        );
        assert_eq!(resize_args, vec!["--manage", "Ubuntu", "--resize", "300GB"]);
    }

    #[test]
    fn test_build_mount_args_with_options() {
        let args = WslProvider::build_mount_args(
            r"\\.\PhysicalDrive1",
            true,
            Some("ext4"),
            Some(2),
            Some("data"),
            Some("uid=1000,gid=1000"),
            true,
        );

        assert_eq!(
            args,
            vec![
                "--mount",
                r"\\.\PhysicalDrive1",
                "--vhd",
                "--type",
                "ext4",
                "--partition",
                "2",
                "--name",
                "data",
                "--options",
                "uid=1000,gid=1000",
                "--bare",
            ]
        );
    }

    // ========================================================================
    // os-release parsing tests
    // ========================================================================

    #[test]
    fn test_parse_os_release_ubuntu() {
        let content = r#"NAME="Ubuntu"
VERSION="24.04.1 LTS (Noble Numbat)"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 24.04.1 LTS"
VERSION_ID="24.04"
VERSION_CODENAME=noble
UBUNTU_CODENAME=noble
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "ubuntu");
        assert_eq!(map.get("ID_LIKE").unwrap(), "debian");
        assert_eq!(map.get("PRETTY_NAME").unwrap(), "Ubuntu 24.04.1 LTS");
        assert_eq!(map.get("VERSION_ID").unwrap(), "24.04");
        assert_eq!(map.get("VERSION_CODENAME").unwrap(), "noble");
        assert_eq!(map.get("NAME").unwrap(), "Ubuntu");
    }

    #[test]
    fn test_parse_os_release_arch() {
        let content = r#"NAME="Arch Linux"
PRETTY_NAME="Arch Linux"
ID=arch
BUILD_ID=rolling
ANSI_COLOR="38;2;23;147;209"
HOME_URL="https://archlinux.org/"
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "arch");
        assert_eq!(map.get("PRETTY_NAME").unwrap(), "Arch Linux");
        assert!(map.get("ID_LIKE").is_none());
        assert!(map.get("VERSION_ID").is_none());
    }

    #[test]
    fn test_parse_os_release_fedora() {
        let content = r#"NAME="Fedora Linux"
VERSION="42 (Container Image)"
ID=fedora
VERSION_ID=42
PRETTY_NAME="Fedora Linux 42 (Container Image)"
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "fedora");
        assert_eq!(map.get("VERSION_ID").unwrap(), "42");
    }

    #[test]
    fn test_parse_os_release_opensuse() {
        let content = r#"NAME="openSUSE Tumbleweed"
ID="opensuse-tumbleweed"
ID_LIKE="opensuse suse"
PRETTY_NAME="openSUSE Tumbleweed"
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "opensuse-tumbleweed");
        assert_eq!(map.get("ID_LIKE").unwrap(), "opensuse suse");
    }

    #[test]
    fn test_parse_os_release_alpine() {
        let content = r#"NAME="Alpine Linux"
ID=alpine
VERSION_ID=3.20.0
PRETTY_NAME="Alpine Linux v3.20"
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "alpine");
        assert_eq!(map.get("VERSION_ID").unwrap(), "3.20.0");
    }

    #[test]
    fn test_parse_os_release_debian() {
        let content = r#"PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
NAME="Debian GNU/Linux"
VERSION_ID="12"
VERSION="12 (bookworm)"
VERSION_CODENAME=bookworm
ID=debian
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "debian");
        assert_eq!(map.get("VERSION_ID").unwrap(), "12");
        assert_eq!(map.get("VERSION_CODENAME").unwrap(), "bookworm");
    }

    #[test]
    fn test_parse_os_release_almalinux() {
        let content = r#"NAME="AlmaLinux"
VERSION="9.4 (Seafoam Ocelot)"
ID="almalinux"
ID_LIKE="rhel centos fedora"
VERSION_ID="9.4"
PRETTY_NAME="AlmaLinux 9.4 (Seafoam Ocelot)"
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "almalinux");
        assert_eq!(map.get("ID_LIKE").unwrap(), "rhel centos fedora");
        assert_eq!(map.get("VERSION_ID").unwrap(), "9.4");
    }

    #[test]
    fn test_parse_os_release_kali() {
        let content = r#"PRETTY_NAME="Kali GNU/Linux Rolling"
NAME="Kali GNU/Linux"
VERSION_ID="2024.3"
ID=kali
ID_LIKE=debian
VERSION_CODENAME=kali-rolling
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "kali");
        assert_eq!(map.get("ID_LIKE").unwrap(), "debian");
        assert_eq!(map.get("VERSION_CODENAME").unwrap(), "kali-rolling");
    }

    #[test]
    fn test_parse_os_release_oracle() {
        let content = r#"NAME="Oracle Linux Server"
VERSION="9.5"
ID="ol"
ID_LIKE="fedora"
PRETTY_NAME="Oracle Linux Server 9.5"
VERSION_ID="9.5"
"#;
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "ol");
        assert_eq!(map.get("ID_LIKE").unwrap(), "fedora");
    }

    #[test]
    fn test_parse_os_release_with_comments() {
        let content = "# This is a comment\nID=ubuntu\n# Another comment\nVERSION_ID=\"22.04\"\n";
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "ubuntu");
        assert_eq!(map.get("VERSION_ID").unwrap(), "22.04");
        assert_eq!(map.len(), 2);
    }

    #[test]
    fn test_parse_os_release_empty() {
        let map = WslProvider::parse_os_release("");
        assert!(map.is_empty());
    }

    #[test]
    fn test_parse_os_release_single_quotes() {
        let content = "ID='ubuntu'\nPRETTY_NAME='Ubuntu 22.04'\n";
        let map = WslProvider::parse_os_release(content);
        assert_eq!(map.get("ID").unwrap(), "ubuntu");
        assert_eq!(map.get("PRETTY_NAME").unwrap(), "Ubuntu 22.04");
    }

    // ========================================================================
    // Package manager detection tests
    // ========================================================================

    #[test]
    fn test_detect_pm_ubuntu() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("ubuntu", &[]),
            Some("apt")
        );
    }

    #[test]
    fn test_detect_pm_debian() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("debian", &[]),
            Some("apt")
        );
    }

    #[test]
    fn test_detect_pm_kali() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("kali", &["debian".into()]),
            Some("apt")
        );
    }

    #[test]
    fn test_detect_pm_arch() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("arch", &[]),
            Some("pacman")
        );
    }

    #[test]
    fn test_detect_pm_manjaro() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("manjaro", &["arch".into()]),
            Some("pacman")
        );
    }

    #[test]
    fn test_detect_pm_fedora() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("fedora", &[]),
            Some("dnf")
        );
    }

    #[test]
    fn test_detect_pm_almalinux() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id(
                "almalinux",
                &["rhel".into(), "centos".into(), "fedora".into()]
            ),
            Some("dnf")
        );
    }

    #[test]
    fn test_detect_pm_opensuse() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id(
                "opensuse-tumbleweed",
                &["opensuse".into(), "suse".into()]
            ),
            Some("zypper")
        );
    }

    #[test]
    fn test_detect_pm_alpine() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("alpine", &[]),
            Some("apk")
        );
    }

    #[test]
    fn test_detect_pm_oracle() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("ol", &["fedora".into()]),
            Some("dnf")
        );
    }

    #[test]
    fn test_detect_pm_void() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("void", &[]),
            Some("xbps-install")
        );
    }

    #[test]
    fn test_detect_pm_nixos() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("nixos", &[]),
            Some("nix")
        );
    }

    #[test]
    fn test_detect_pm_unknown_with_id_like_debian() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("custom-distro", &["debian".into()]),
            Some("apt")
        );
    }

    #[test]
    fn test_detect_pm_unknown_no_id_like() {
        assert_eq!(
            WslProvider::detect_package_manager_from_id("custom-distro", &[]),
            None
        );
    }

    // ========================================================================
    // Package count command tests
    // ========================================================================

    #[test]
    fn test_package_count_command_apt() {
        assert!(WslProvider::get_package_count_command("apt").is_some());
    }

    #[test]
    fn test_package_count_command_pacman() {
        assert!(WslProvider::get_package_count_command("pacman").is_some());
    }

    #[test]
    fn test_package_count_command_unknown() {
        assert!(WslProvider::get_package_count_command("unknown").is_none());
    }

    // ========================================================================
    // Update command tests
    // ========================================================================

    #[test]
    fn test_update_command_apt() {
        let (update, upgrade) = WslProvider::get_distro_update_command("apt").unwrap();
        assert!(update.contains("apt update"));
        assert!(upgrade.contains("apt upgrade"));
    }

    #[test]
    fn test_update_command_pacman() {
        let (update, upgrade) = WslProvider::get_distro_update_command("pacman").unwrap();
        assert!(update.contains("pacman"));
        assert!(upgrade.contains("pacman"));
    }

    #[test]
    fn test_update_command_unknown() {
        assert!(WslProvider::get_distro_update_command("unknown").is_none());
    }
}
