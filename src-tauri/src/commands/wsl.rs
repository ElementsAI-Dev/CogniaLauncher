use crate::provider::wsl::WslProvider;
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
    pub status_info: String,
    pub running_distros: Vec<String>,
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

    let status_info = provider
        .get_wsl_status()
        .await
        .unwrap_or_else(|_| "WSL status unavailable".into());

    let running = provider
        .list_running()
        .await
        .unwrap_or_default();

    Ok(WslStatus {
        version,
        status_info,
        running_distros: running,
    })
}

/// Terminate a specific WSL distribution
#[tauri::command]
pub async fn wsl_terminate(name: String) -> Result<(), String> {
    let provider = get_provider();
    provider.terminate_distro(&name).await.map_err(|e| e.to_string())
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
    provider.set_default_distro(&name).await.map_err(|e| e.to_string())
}

/// Set WSL version (1 or 2) for a distribution
#[tauri::command]
pub async fn wsl_set_version(name: String, version: u8) -> Result<(), String> {
    if version != 1 && version != 2 {
        return Err("WSL version must be 1 or 2".into());
    }
    let provider = get_provider();
    provider.set_distro_version(&name, version).await.map_err(|e| e.to_string())
}

/// Set the default WSL version for new installations
#[tauri::command]
pub async fn wsl_set_default_version(version: u8) -> Result<(), String> {
    if version != 1 && version != 2 {
        return Err("WSL version must be 1 or 2".into());
    }
    let provider = get_provider();
    provider.set_default_version(version).await.map_err(|e| e.to_string())
}

/// Export a WSL distribution to a file (tar or vhdx)
#[tauri::command]
pub async fn wsl_export(name: String, file_path: String, as_vhd: Option<bool>) -> Result<(), String> {
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
