use crate::provider::wsl::{WslCapabilities, WslProvider};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// WSL distribution info returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslDistroStatus {
    pub name: String,
    pub state: String,
    pub wsl_version: String,
    pub is_default: bool,
}

/// WSL system-level status info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslStatus {
    pub version: String,
    pub kernel_version: Option<String>,
    pub wslg_version: Option<String>,
    pub default_distribution: Option<String>,
    pub default_version: Option<String>,
    pub status_info: String,
    pub running_distros: Vec<String>,
}

/// Parsed component versions from `wsl --version`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslVersionInfoDto {
    pub wsl_version: Option<String>,
    pub kernel_version: Option<String>,
    pub wslg_version: Option<String>,
    pub msrdc_version: Option<String>,
    pub direct3d_version: Option<String>,
    pub dxcore_version: Option<String>,
    pub windows_version: Option<String>,
}

/// Runtime WSL capability flags exposed to frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslCapabilitiesDto {
    pub manage: bool,
    #[serde(rename = "move")]
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

/// Options for WSL import operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslImportOptions {
    pub name: String,
    pub install_location: String,
    pub file_path: String,
    pub wsl_version: Option<u8>,
    pub as_vhd: bool,
}

/// Result of executing a command inside a WSL distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Disk usage information for a WSL distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslDiskUsage {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub filesystem_path: String,
}

fn get_provider() -> WslProvider {
    WslProvider::new()
}

fn map_capabilities(capabilities: WslCapabilities) -> WslCapabilitiesDto {
    WslCapabilitiesDto {
        manage: capabilities.manage,
        r#move: capabilities.r#move,
        resize: capabilities.resize,
        set_sparse: capabilities.set_sparse,
        set_default_user: capabilities.set_default_user,
        mount_options: capabilities.mount_options,
        shutdown_force: capabilities.shutdown_force,
        export_format: capabilities.export_format,
        import_in_place: capabilities.import_in_place,
        version: capabilities.version,
    }
}

/// Diagnostic command: returns step-by-step WSL detection info for debugging.
/// This helps identify exactly where detection fails on a given system.
#[tauri::command]
pub async fn wsl_debug_detection() -> Result<serde_json::Value, String> {
    use serde_json::json;

    let mut steps = Vec::new();

    // Helper to run wsl.exe and capture raw + decoded output
    async fn try_wsl(args: &[&str]) -> serde_json::Value {
        use serde_json::json;
        use std::process::Stdio;
        use tokio::process::Command as TokioCommand;

        let mut cmd = TokioCommand::new("wsl.exe");
        cmd.args(args);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000);
        }

        match cmd.output().await {
            Ok(output) => {
                let raw_stdout_len = output.stdout.len();
                let raw_stderr_len = output.stderr.len();
                let raw_stdout_hex: String = output
                    .stdout
                    .iter()
                    .take(40)
                    .map(|b| format!("{:02x}", b))
                    .collect::<Vec<_>>()
                    .join(" ");

                // Try to decode
                let stdout_decoded = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr_decoded = String::from_utf8_lossy(&output.stderr).to_string();

                json!({
                    "success": true,
                    "exit_code": output.status.code(),
                    "raw_stdout_len": raw_stdout_len,
                    "raw_stderr_len": raw_stderr_len,
                    "raw_stdout_hex_first_40": raw_stdout_hex,
                    "stdout_lossy_first_200": stdout_decoded.chars().take(200).collect::<String>(),
                    "stderr_lossy_first_200": stderr_decoded.chars().take(200).collect::<String>(),
                })
            }
            Err(e) => {
                json!({
                    "success": false,
                    "error": format!("{}", e),
                    "error_kind": format!("{:?}", e.kind()),
                })
            }
        }
    }

    // Step 1: wsl --version
    steps.push(json!({
        "step": "wsl --version",
        "result": try_wsl(&["--version"]).await,
    }));

    // Step 2: wsl --status
    steps.push(json!({
        "step": "wsl --status",
        "result": try_wsl(&["--status"]).await,
    }));

    // Step 3: wsl --help
    steps.push(json!({
        "step": "wsl --help",
        "result": try_wsl(&["--help"]).await,
    }));

    // Step 4: Check absolute path
    #[cfg(windows)]
    {
        let abs_path = "C:\\Windows\\System32\\wsl.exe";
        let exists = std::path::Path::new(abs_path).exists();
        steps.push(json!({
            "step": "absolute_path_check",
            "path": abs_path,
            "exists": exists,
        }));
    }

    // Step 5: Run is_available() and report result
    let provider = get_provider();
    use crate::provider::traits::Provider;
    let is_avail = provider.is_available().await;

    // Step 6: Check platform
    let platform = format!("{:?}", crate::platform::env::current_platform());

    Ok(json!({
        "platform": platform,
        "is_available_result": is_avail,
        "steps": steps,
    }))
}

/// List all installed WSL distributions with verbose info (state, version, default)
#[tauri::command]
pub async fn wsl_list_distros() -> Result<Vec<WslDistroStatus>, String> {
    let provider = get_provider();
    let out = provider
        .run_wsl_lenient(&["--list", "--verbose"])
        .await
        .map_err(|e| e.to_string())?;

    let distros = WslProvider::parse_list_verbose(&out);

    Ok(distros
        .into_iter()
        .map(|d| WslDistroStatus {
            name: d.name,
            state: d.state,
            wsl_version: d.wsl_version,
            is_default: d.is_default,
        })
        .collect())
}

/// List available WSL distributions from the online store
#[tauri::command]
pub async fn wsl_list_online() -> Result<Vec<(String, String)>, String> {
    let provider = get_provider();
    let out = provider
        .run_wsl_lenient(&["--list", "--online"])
        .await
        .map_err(|e| e.to_string())?;

    Ok(WslProvider::parse_list_online(&out))
}

/// Get WSL system status (version, kernel, running distros)
#[tauri::command]
pub async fn wsl_status() -> Result<WslStatus, String> {
    let provider = get_provider();

    let version = provider
        .get_wsl_version_string()
        .await
        .unwrap_or_else(|_| "Unknown".into());

    // Get full version info for kernel/WSLg versions
    let version_info = provider.get_full_version_info().await.ok();

    let status_info = provider
        .get_wsl_status()
        .await
        .unwrap_or_else(|_| "WSL status unavailable".into());

    // Parse status output for default distribution and version
    let (default_distribution, default_version) = WslProvider::parse_status_output(&status_info);

    let running = provider.list_running().await.unwrap_or_default();

    Ok(WslStatus {
        version,
        kernel_version: version_info.as_ref().and_then(|v| v.kernel_version.clone()),
        wslg_version: version_info.as_ref().and_then(|v| v.wslg_version.clone()),
        default_distribution,
        default_version,
        status_info,
        running_distros: running,
    })
}

/// Get full WSL version info (all component versions)
#[tauri::command]
pub async fn wsl_get_version_info() -> Result<WslVersionInfoDto, String> {
    let provider = get_provider();
    let info = provider
        .get_full_version_info()
        .await
        .map_err(|e| e.to_string())?;
    Ok(WslVersionInfoDto {
        wsl_version: info.wsl_version,
        kernel_version: info.kernel_version,
        wslg_version: info.wslg_version,
        msrdc_version: info.msrdc_version,
        direct3d_version: info.direct3d_version,
        dxcore_version: info.dxcore_version,
        windows_version: info.windows_version,
    })
}

/// Get runtime WSL capability flags detected from the current machine.
#[tauri::command]
pub async fn wsl_get_capabilities() -> Result<WslCapabilitiesDto, String> {
    let provider = get_provider();
    let capabilities = provider
        .get_capabilities()
        .await
        .map_err(|e| e.to_string())?;
    Ok(map_capabilities(capabilities))
}

/// Terminate a specific WSL distribution
#[tauri::command]
pub async fn wsl_terminate(name: String) -> Result<(), String> {
    let provider = get_provider();
    provider
        .terminate_distro(&name)
        .await
        .map_err(|e| e.to_string())
}

/// Shutdown all running WSL instances
#[tauri::command]
pub async fn wsl_shutdown() -> Result<(), String> {
    let provider = get_provider();
    provider.shutdown_all().await.map_err(|e| e.to_string())
}

/// Set the default WSL distribution
#[tauri::command]
pub async fn wsl_set_default(name: String) -> Result<(), String> {
    let provider = get_provider();
    provider
        .set_default_distro(&name)
        .await
        .map_err(|e| e.to_string())
}

/// Set WSL version (1 or 2) for a distribution
#[tauri::command]
pub async fn wsl_set_version(name: String, version: u8) -> Result<(), String> {
    if version != 1 && version != 2 {
        return Err("WSL version must be 1 or 2".into());
    }
    let provider = get_provider();
    provider
        .set_distro_version(&name, version)
        .await
        .map_err(|e| e.to_string())
}

/// Set the default WSL version for new installations
#[tauri::command]
pub async fn wsl_set_default_version(version: u8) -> Result<(), String> {
    if version != 1 && version != 2 {
        return Err("WSL version must be 1 or 2".into());
    }
    let provider = get_provider();
    provider
        .set_default_version(version)
        .await
        .map_err(|e| e.to_string())
}

/// Move a WSL distribution's disk to a new location.
#[tauri::command]
pub async fn wsl_move_distro(name: String, location: String) -> Result<String, String> {
    let provider = get_provider();
    provider
        .move_distro(&name, &location)
        .await
        .map_err(|e| e.to_string())
}

/// Resize a WSL distribution's disk.
#[tauri::command]
pub async fn wsl_resize_distro(name: String, size: String) -> Result<String, String> {
    let provider = get_provider();
    provider
        .resize_distro(&name, &size)
        .await
        .map_err(|e| e.to_string())
}

/// Export a WSL distribution to a file (tar or vhdx)
#[tauri::command]
pub async fn wsl_export(
    name: String,
    file_path: String,
    as_vhd: Option<bool>,
) -> Result<(), String> {
    let provider = get_provider();
    provider
        .export_distro(&name, &file_path, as_vhd.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

/// Import a WSL distribution from a file
#[tauri::command]
pub async fn wsl_import(options: WslImportOptions) -> Result<(), String> {
    let provider = get_provider();
    provider
        .import_distro(
            &options.name,
            &options.install_location,
            &options.file_path,
            options.wsl_version,
            options.as_vhd,
        )
        .await
        .map_err(|e| e.to_string())
}

/// Update the WSL kernel
#[tauri::command]
pub async fn wsl_update() -> Result<String, String> {
    let provider = get_provider();
    provider.update_wsl().await.map_err(|e| e.to_string())
}

/// Launch/start a WSL distribution
#[tauri::command]
pub async fn wsl_launch(name: String, user: Option<String>) -> Result<(), String> {
    let provider = get_provider();
    provider
        .launch_distro(&name, user.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// List currently running WSL distributions
#[tauri::command]
pub async fn wsl_list_running() -> Result<Vec<String>, String> {
    let provider = get_provider();
    provider.list_running().await.map_err(|e| e.to_string())
}

/// Check if WSL is available on this system
#[tauri::command]
pub async fn wsl_is_available() -> Result<bool, String> {
    use crate::provider::traits::Provider;
    let provider = get_provider();
    Ok(provider.is_available().await)
}

/// Execute a command inside a WSL distribution
#[tauri::command]
pub async fn wsl_exec(
    distro: String,
    command: String,
    user: Option<String>,
) -> Result<WslExecResult, String> {
    let provider = get_provider();
    let (stdout, stderr, exit_code) = provider
        .exec_command(&distro, &command, user.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    Ok(WslExecResult {
        stdout,
        stderr,
        exit_code,
    })
}

/// Convert a path between Windows and WSL formats
#[tauri::command]
pub async fn wsl_convert_path(
    path: String,
    distro: Option<String>,
    to_windows: bool,
) -> Result<String, String> {
    let provider = get_provider();
    provider
        .convert_path(&path, distro.as_deref(), to_windows)
        .await
        .map_err(|e| e.to_string())
}

/// Read the global .wslconfig file
#[tauri::command]
pub async fn wsl_get_config() -> Result<HashMap<String, HashMap<String, String>>, String> {
    WslProvider::read_wslconfig().map_err(|e| e.to_string())
}

/// Write a setting to the global .wslconfig file
#[tauri::command]
pub async fn wsl_set_config(
    section: String,
    key: String,
    value: Option<String>,
) -> Result<(), String> {
    if let Some(val) = value {
        WslProvider::write_wslconfig(&section, &key, &val).map_err(|e| e.to_string())
    } else {
        WslProvider::remove_wslconfig_key(&section, &key)
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

/// Get disk usage for a WSL distribution
#[tauri::command]
pub async fn wsl_disk_usage(name: String) -> Result<WslDiskUsage, String> {
    let provider = get_provider();
    let (total_bytes, used_bytes) = provider
        .get_disk_usage(&name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(WslDiskUsage {
        total_bytes,
        used_bytes,
        filesystem_path: WslProvider::get_distro_filesystem_path(&name),
    })
}

/// Options for WSL mount operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslMountOptions {
    pub disk_path: String,
    pub is_vhd: bool,
    pub fs_type: Option<String>,
    pub partition: Option<u32>,
    pub mount_name: Option<String>,
    pub mount_options: Option<String>,
    pub bare: bool,
}

/// Import a distribution in-place from an existing .vhdx file
#[tauri::command]
pub async fn wsl_import_in_place(name: String, vhdx_path: String) -> Result<(), String> {
    let provider = get_provider();
    provider
        .import_distro_in_place(&name, &vhdx_path)
        .await
        .map_err(|e| e.to_string())
}

/// Mount a physical or virtual disk in WSL2
#[tauri::command]
pub async fn wsl_mount(options: WslMountOptions) -> Result<String, String> {
    let provider = get_provider();
    provider
        .mount_disk(
            &options.disk_path,
            options.is_vhd,
            options.fs_type.as_deref(),
            options.partition,
            options.mount_name.as_deref(),
            options.mount_options.as_deref(),
            options.bare,
        )
        .await
        .map_err(|e| e.to_string())
}

/// Unmount a previously mounted disk (or all if no path given)
#[tauri::command]
pub async fn wsl_unmount(disk_path: Option<String>) -> Result<(), String> {
    let provider = get_provider();
    provider
        .unmount_disk(disk_path.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Get the IP address of a WSL distribution
#[tauri::command]
pub async fn wsl_get_ip(distro: Option<String>) -> Result<String, String> {
    let provider = get_provider();
    provider
        .get_ip_address(distro.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Change the default user for a distribution
#[tauri::command]
pub async fn wsl_change_default_user(distro: String, username: String) -> Result<(), String> {
    let provider = get_provider();
    provider
        .change_default_user(&distro, &username)
        .await
        .map_err(|e| e.to_string())
}

/// Read the per-distro /etc/wsl.conf file
#[tauri::command]
pub async fn wsl_get_distro_config(
    distro: String,
) -> Result<HashMap<String, HashMap<String, String>>, String> {
    let provider = get_provider();
    provider
        .read_distro_config(&distro)
        .await
        .map_err(|e| e.to_string())
}

/// Set sparse VHD mode for a WSL distribution
#[tauri::command]
pub async fn wsl_set_sparse(distro: String, enabled: bool) -> Result<(), String> {
    let provider = get_provider();
    provider
        .set_sparse_vhd(&distro, enabled)
        .await
        .map_err(|e| e.to_string())
}

/// Install WSL engine only, without a default distribution
#[tauri::command]
pub async fn wsl_install_wsl_only() -> Result<String, String> {
    let provider = get_provider();
    provider.install_wsl_only().await.map_err(|e| e.to_string())
}

/// Install a distribution to a custom location
#[tauri::command]
pub async fn wsl_install_with_location(name: String, location: String) -> Result<String, String> {
    let provider = get_provider();
    provider
        .install_with_location(&name, &location)
        .await
        .map_err(|e| e.to_string())
}

/// Write a setting to the per-distro /etc/wsl.conf file
#[tauri::command]
pub async fn wsl_set_distro_config(
    distro: String,
    section: String,
    key: String,
    value: Option<String>,
) -> Result<(), String> {
    let provider = get_provider();
    if let Some(val) = value {
        provider
            .write_distro_config(&distro, &section, &key, &val)
            .await
            .map_err(|e| e.to_string())
    } else {
        provider
            .remove_distro_config_key(&distro, &section, &key)
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

/// Detect the environment inside a WSL distribution.
///
/// Parses `/etc/os-release`, detects the package manager, architecture,
/// kernel version, init system, default shell/user, hostname, uptime,
/// and installed package count.
///
/// The distro must be running or startable (will be launched if stopped).
#[tauri::command]
pub async fn wsl_detect_distro_env(
    distro: String,
) -> Result<crate::provider::wsl::WslDistroEnvironment, String> {
    let provider = get_provider();
    provider
        .detect_distro_environment(&distro)
        .await
        .map_err(|e| e.to_string())
}
