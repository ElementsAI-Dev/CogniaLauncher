use crate::config::Settings;
use crate::core::{PathManager, ShimConfig, ShimManager};
use crate::platform::fs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedSettings = Arc<RwLock<Settings>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShimInfo {
    pub binary_name: String,
    pub env_type: String,
    pub version: Option<String>,
    pub target_path: String,
    pub shim_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathStatus {
    pub shim_dir: String,
    pub is_in_path: bool,
    pub add_command: String,
}

/// Create a new shim for a binary
#[tauri::command]
pub async fn shim_create(
    binary_name: String,
    env_type: String,
    version: Option<String>,
    target_path: String,
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
    let settings = settings.read().await;
    let base_dir = settings.get_root_dir();

    let mut manager = ShimManager::new(&base_dir)
        .await
        .map_err(|e| e.to_string())?;

    let config = ShimConfig {
        env_type,
        binary_name: binary_name.clone(),
        version,
        target_path: PathBuf::from(target_path),
    };

    let shim_path = manager
        .create_shim(config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(shim_path.display().to_string())
}

/// Remove a shim
#[tauri::command]
pub async fn shim_remove(
    binary_name: String,
    settings: State<'_, SharedSettings>,
) -> Result<bool, String> {
    let settings = settings.read().await;
    let base_dir = settings.get_root_dir();

    let mut manager = ShimManager::new(&base_dir)
        .await
        .map_err(|e| e.to_string())?;

    manager
        .remove_shim(&binary_name)
        .await
        .map_err(|e| e.to_string())
}

/// List all shims
#[tauri::command]
pub async fn shim_list(settings: State<'_, SharedSettings>) -> Result<Vec<ShimInfo>, String> {
    let settings = settings.read().await;
    let base_dir = settings.get_root_dir();

    let manager = ShimManager::new(&base_dir)
        .await
        .map_err(|e| e.to_string())?;

    let shims: Vec<ShimInfo> = manager
        .list_shims()
        .iter()
        .map(|config| {
            let shim_dir = manager.shim_dir();
            ShimInfo {
                binary_name: config.binary_name.clone(),
                env_type: config.env_type.clone(),
                version: config.version.clone(),
                target_path: config.target_path.display().to_string(),
                shim_path: shim_dir.join(&config.binary_name).display().to_string(),
            }
        })
        .collect();

    Ok(shims)
}

/// Update a shim to point to a new version
#[tauri::command]
pub async fn shim_update(
    binary_name: String,
    version: Option<String>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let settings = settings.read().await;
    let base_dir = settings.get_root_dir();

    let mut manager = ShimManager::new(&base_dir)
        .await
        .map_err(|e| e.to_string())?;

    manager
        .update_shim_version(&binary_name, version)
        .await
        .map_err(|e| e.to_string())
}

/// Regenerate all shims
#[tauri::command]
pub async fn shim_regenerate_all(settings: State<'_, SharedSettings>) -> Result<(), String> {
    let settings = settings.read().await;
    let base_dir = settings.get_root_dir();

    let mut manager = ShimManager::new(&base_dir)
        .await
        .map_err(|e| e.to_string())?;

    manager.regenerate_all().await.map_err(|e| e.to_string())
}

/// Get PATH status and shim directory info
#[tauri::command]
pub async fn path_status(settings: State<'_, SharedSettings>) -> Result<PathStatus, String> {
    let settings = settings.read().await;
    let shim_dir = settings.get_bin_dir();

    let path_manager = PathManager::new(shim_dir.clone());

    Ok(PathStatus {
        shim_dir: shim_dir.display().to_string(),
        is_in_path: path_manager.is_in_path(),
        add_command: path_manager.get_add_to_path_command(),
    })
}

/// Add shim directory to PATH
#[tauri::command]
pub async fn path_setup(settings: State<'_, SharedSettings>) -> Result<(), String> {
    let settings = settings.read().await;
    let shim_dir = settings.get_bin_dir();

    // Ensure the directory exists
    fs::create_dir_all(&shim_dir)
        .await
        .map_err(|e| e.to_string())?;

    let path_manager = PathManager::new(shim_dir);
    path_manager.add_to_path().await.map_err(|e| e.to_string())
}

/// Remove shim directory from PATH
#[tauri::command]
pub async fn path_remove(settings: State<'_, SharedSettings>) -> Result<(), String> {
    let settings = settings.read().await;
    let shim_dir = settings.get_bin_dir();

    let path_manager = PathManager::new(shim_dir);
    path_manager
        .remove_from_path()
        .await
        .map_err(|e| e.to_string())
}

/// Check if shim directory is in PATH
#[tauri::command]
pub async fn path_check(settings: State<'_, SharedSettings>) -> Result<bool, String> {
    let settings = settings.read().await;
    let shim_dir = settings.get_bin_dir();

    let path_manager = PathManager::new(shim_dir);
    Ok(path_manager.is_in_path())
}

/// Get the command to manually add shim directory to PATH
#[tauri::command]
pub async fn path_get_add_command(settings: State<'_, SharedSettings>) -> Result<String, String> {
    let settings = settings.read().await;
    let shim_dir = settings.get_bin_dir();

    let path_manager = PathManager::new(shim_dir);
    Ok(path_manager.get_add_to_path_command())
}
