use crate::plugin::manager::{PluginManager, PluginUpdateInfo};
use crate::plugin::manifest::PluginManifest;
use crate::plugin::registry::{PluginInfo, PluginToolInfo};
use crate::plugin::permissions::PluginPermissionState;
use crate::plugin::scaffold::{ScaffoldConfig, ScaffoldResult, ValidationResult};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedPluginManager = Arc<RwLock<PluginManager>>;

/// List all installed plugins
#[tauri::command]
pub async fn plugin_list(
    manager: State<'_, SharedPluginManager>,
) -> Result<Vec<PluginInfo>, String> {
    let mgr = manager.read().await;
    Ok(mgr.list_plugins().await)
}

/// Get detailed info about a specific plugin
#[tauri::command]
pub async fn plugin_get_info(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<PluginManifest, String> {
    let mgr = manager.read().await;
    mgr.get_plugin_manifest(&plugin_id).await.ok_or_else(|| {
        format!("Plugin '{}' not found", plugin_id)
    })
}

/// List all tools from all enabled plugins
#[tauri::command]
pub async fn plugin_list_all_tools(
    manager: State<'_, SharedPluginManager>,
) -> Result<Vec<PluginToolInfo>, String> {
    let mgr = manager.read().await;
    Ok(mgr.list_all_tools().await)
}

/// Get tools for a specific plugin
#[tauri::command]
pub async fn plugin_get_tools(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<Vec<PluginToolInfo>, String> {
    let mgr = manager.read().await;
    let all = mgr.list_all_tools().await;
    Ok(all.into_iter().filter(|t| t.plugin_id == plugin_id).collect())
}

/// Install a plugin from a local directory path
#[tauri::command]
pub async fn plugin_import_local(
    path: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<String, String> {
    let mut mgr = manager.write().await;
    mgr.install_from_path(&PathBuf::from(path))
        .await
        .map_err(|e| e.to_string())
}

/// Install a plugin from a URL
#[tauri::command]
pub async fn plugin_install(
    source: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<String, String> {
    let mut mgr = manager.write().await;
    if source.starts_with("http://") || source.starts_with("https://") {
        mgr.install_from_url(&source)
            .await
            .map_err(|e| e.to_string())
    } else {
        mgr.install_from_path(&PathBuf::from(&source))
            .await
            .map_err(|e| e.to_string())
    }
}

/// Uninstall a plugin
#[tauri::command]
pub async fn plugin_uninstall(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.uninstall(&plugin_id).await.map_err(|e| e.to_string())
}

/// Enable a plugin
#[tauri::command]
pub async fn plugin_enable(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.enable(&plugin_id).await.map_err(|e| e.to_string())
}

/// Disable a plugin
#[tauri::command]
pub async fn plugin_disable(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.disable(&plugin_id).await.map_err(|e| e.to_string())
}

/// Reload a plugin (re-read WASM file)
#[tauri::command]
pub async fn plugin_reload(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.reload(&plugin_id).await.map_err(|e| e.to_string())
}

/// Call a tool function on a plugin
#[tauri::command]
pub async fn plugin_call_tool(
    plugin_id: String,
    tool_entry: String,
    input: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<String, String> {
    let mut mgr = manager.write().await;
    mgr.call_tool(&plugin_id, &tool_entry, &input)
        .await
        .map_err(|e| e.to_string())
}

/// Get permissions for a plugin
#[tauri::command]
pub async fn plugin_get_permissions(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<PluginPermissionState, String> {
    let mgr = manager.read().await;
    mgr.get_permissions(&plugin_id)
        .await
        .map_err(|e| e.to_string())
}

/// Grant a permission to a plugin
#[tauri::command]
pub async fn plugin_grant_permission(
    plugin_id: String,
    permission: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.grant_permission(&plugin_id, &permission)
        .await
        .map_err(|e| e.to_string())
}

/// Revoke a permission from a plugin
#[tauri::command]
pub async fn plugin_revoke_permission(
    plugin_id: String,
    permission: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mgr = manager.read().await;
    mgr.revoke_permission(&plugin_id, &permission)
        .await
        .map_err(|e| e.to_string())
}

/// Get plugin data directory path
#[tauri::command]
pub async fn plugin_get_data_dir(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<String, String> {
    let mgr = manager.read().await;
    let dir = mgr.get_plugin_data_dir(&plugin_id).await;
    Ok(dir.display().to_string())
}

/// Get plugin locale data for frontend i18n
#[tauri::command]
pub async fn plugin_get_locales(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<HashMap<String, HashMap<String, String>>, String> {
    let mgr = manager.read().await;
    mgr.get_plugin_locales(&plugin_id)
        .await
        .map_err(|e| e.to_string())
}

/// Scaffold a new plugin project
#[tauri::command]
pub async fn plugin_scaffold(
    config: ScaffoldConfig,
) -> Result<ScaffoldResult, String> {
    crate::plugin::scaffold::scaffold_plugin(&config)
        .await
        .map_err(|e| e.to_string())
}

/// Validate a plugin directory
#[tauri::command]
pub async fn plugin_validate(
    path: String,
) -> Result<ValidationResult, String> {
    crate::plugin::scaffold::validate_plugin(&PathBuf::from(path))
        .await
        .map_err(|e| e.to_string())
}

/// Check if an update is available for a plugin
#[tauri::command]
pub async fn plugin_check_update(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<Option<PluginUpdateInfo>, String> {
    let mgr = manager.read().await;
    mgr.check_update(&plugin_id)
        .await
        .map_err(|e| e.to_string())
}

/// Update a plugin to its latest version
#[tauri::command]
pub async fn plugin_update(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.update_plugin(&plugin_id)
        .await
        .map_err(|e| e.to_string())
}

/// Entry data for rendering a plugin's iframe UI
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginUiEntry {
    pub html: String,
    pub plugin_id: String,
    pub permissions: Vec<String>,
}

/// Allowed file extensions for plugin UI assets
const ALLOWED_UI_EXTENSIONS: &[&str] = &[
    "html", "js", "css", "json", "svg", "png", "jpg", "jpeg", "gif", "webp",
    "woff", "woff2", "ttf", "eot", "ico", "map",
];

/// Get the iframe entry HTML for a plugin's custom UI
#[tauri::command]
pub async fn plugin_get_ui_entry(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<PluginUiEntry, String> {
    let mgr = manager.read().await;

    let ui_config = mgr
        .get_plugin_ui_config(&plugin_id)
        .await
        .ok_or_else(|| format!("Plugin '{}' has no [ui] configuration", plugin_id))?;

    let plugin_dir = mgr
        .get_plugin_dir(&plugin_id)
        .await
        .ok_or_else(|| format!("Plugin '{}' not found", plugin_id))?;

    let entry_path = plugin_dir.join(&ui_config.entry);
    if !entry_path.exists() {
        return Err(format!(
            "Plugin UI entry file not found: {}",
            entry_path.display()
        ));
    }

    let html = tokio::fs::read_to_string(&entry_path)
        .await
        .map_err(|e| format!("Failed to read UI entry: {}", e))?;

    let permissions = mgr.get_granted_permissions(&plugin_id).await;

    Ok(PluginUiEntry {
        html,
        plugin_id: plugin_id.clone(),
        permissions,
    })
}

/// Serve a static asset from a plugin's UI directory
#[tauri::command]
pub async fn plugin_get_ui_asset(
    plugin_id: String,
    asset_path: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<Vec<u8>, String> {
    // Security: reject path traversal
    if asset_path.contains("..") {
        return Err("Path traversal not allowed".to_string());
    }

    let mgr = manager.read().await;

    let plugin_dir = mgr
        .get_plugin_dir(&plugin_id)
        .await
        .ok_or_else(|| format!("Plugin '{}' not found", plugin_id))?;

    // Determine the UI base directory from config, fallback to "ui/"
    let ui_base = match mgr.get_plugin_ui_config(&plugin_id).await {
        Some(config) => {
            let entry = std::path::Path::new(&config.entry);
            entry
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from("ui"))
        }
        None => PathBuf::from("ui"),
    };

    let full_path = plugin_dir.join(&ui_base).join(&asset_path);

    // Security: ensure canonical path is within plugin directory
    let canonical = full_path
        .canonicalize()
        .map_err(|_| format!("Asset not found: {}", asset_path))?;
    let canonical_plugin = plugin_dir
        .canonicalize()
        .map_err(|_| "Plugin directory error".to_string())?;
    if !canonical.starts_with(&canonical_plugin) {
        return Err("Access denied: path outside plugin directory".to_string());
    }

    // Security: check file extension allowlist
    let ext = full_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if !ALLOWED_UI_EXTENSIONS.contains(&ext) {
        return Err(format!("File type not allowed: .{}", ext));
    }

    tokio::fs::read(&full_path)
        .await
        .map_err(|e| format!("Failed to read asset: {}", e))
}
