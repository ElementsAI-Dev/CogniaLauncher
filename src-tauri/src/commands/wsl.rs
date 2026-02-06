use crate::provider::wsl::WslProvider;
use serde::{Deserialize, Serialize};

/// WSL distribution info returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WslDistroStatus {
    pub name: String,
    pub state: String,
    pub wsl_version: String,
    pub is_default: bool,
}

/// WSL system-level status info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WslStatus {
    pub version: String,
    pub status_info: String,
    pub running_distros: Vec<String>,
}

/// Options for WSL import operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WslImportOptions {
    pub name: String,
    pub install_location: String,
    pub file_path: String,
    pub wsl_version: Option<u8>,
    pub as_vhd: bool,
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
