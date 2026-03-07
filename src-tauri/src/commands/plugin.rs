use crate::plugin::manager::{CapabilityAuditRecord, PluginHealth, PluginManager, PluginUpdateInfo};
use crate::plugin::manifest::PluginManifest;
use crate::plugin::permissions::PluginPermissionState;
use crate::plugin::permissions::PermissionEnforcementMode;
use crate::plugin::registry::{PluginInfo, PluginToolInfo};
use crate::plugin::scaffold::{ScaffoldConfig, ScaffoldResult, ValidationResult};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
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
    mgr.get_plugin_manifest(&plugin_id)
        .await
        .ok_or_else(|| format!("Plugin '{}' not found", plugin_id))
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
    Ok(all
        .into_iter()
        .filter(|t| t.plugin_id == plugin_id)
        .collect())
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

#[tauri::command]
pub async fn plugin_install_marketplace(
    store_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<String, String> {
    let mut mgr = manager.write().await;
    mgr.install_from_marketplace(&store_id)
        .await
        .map_err(|e| e.to_string())
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

/// Get global plugin permission enforcement mode (`compat` | `strict`)
#[tauri::command]
pub async fn plugin_get_permission_mode(
    manager: State<'_, SharedPluginManager>,
) -> Result<String, String> {
    let mgr = manager.read().await;
    let mode = mgr.get_permission_mode().await;
    let value = match mode {
        PermissionEnforcementMode::Compat => "compat",
        PermissionEnforcementMode::Strict => "strict",
    };
    Ok(value.to_string())
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
pub async fn plugin_scaffold(config: ScaffoldConfig) -> Result<ScaffoldResult, String> {
    crate::plugin::scaffold::scaffold_plugin(&config)
        .await
        .map_err(|e| e.to_string())
}

/// Validate a plugin directory
#[tauri::command]
pub async fn plugin_validate(path: String) -> Result<ValidationResult, String> {
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

/// Result of opening scaffold output paths/folders
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldOpenResult {
    pub opened_with: String,
    pub fallback_used: bool,
    pub message: String,
}

/// Allowed file extensions for plugin UI assets
const ALLOWED_UI_EXTENSIONS: &[&str] = &[
    "html", "js", "css", "json", "svg", "png", "jpg", "jpeg", "gif", "webp", "woff", "woff2",
    "ttf", "eot", "ico", "map",
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
    let ext = full_path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !ALLOWED_UI_EXTENSIONS.contains(&ext) {
        return Err(format!("File type not allowed: .{}", ext));
    }

    tokio::fs::read(&full_path)
        .await
        .map_err(|e| format!("Failed to read asset: {}", e))
}

/// Get health metrics for a specific plugin
#[tauri::command]
pub async fn plugin_get_health(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<PluginHealth, String> {
    let mgr = manager.read().await;
    Ok(mgr.get_plugin_health(&plugin_id))
}

/// Get health metrics for all plugins
#[tauri::command]
pub async fn plugin_get_all_health(
    manager: State<'_, SharedPluginManager>,
) -> Result<HashMap<String, PluginHealth>, String> {
    let mgr = manager.read().await;
    Ok(mgr.get_all_health())
}

/// Get capability audit records (optionally scoped by plugin ID)
#[tauri::command]
pub async fn plugin_get_capability_audit(
    plugin_id: Option<String>,
    manager: State<'_, SharedPluginManager>,
) -> Result<Vec<CapabilityAuditRecord>, String> {
    let mgr = manager.read().await;
    Ok(mgr.get_capability_audit(plugin_id.as_deref()))
}

/// Reset the auto-disabled state for a plugin
#[tauri::command]
pub async fn plugin_reset_health(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.reset_plugin_health(&plugin_id);
    Ok(())
}

/// Export a plugin's directory + data as a zip file, returns the zip path
#[tauri::command]
pub async fn plugin_export_data(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<String, String> {
    let mgr = manager.read().await;
    let path = mgr
        .export_plugin_data(&plugin_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Open a scaffold output folder in system file manager
#[tauri::command]
pub async fn plugin_open_scaffold_folder(path: String) -> Result<ScaffoldOpenResult, String> {
    let validated = validate_scaffold_open_path(&path)?;
    open_folder_path(&validated)?;
    Ok(ScaffoldOpenResult {
        opened_with: "folder".to_string(),
        fallback_used: false,
        message: format!("Opened folder: {}", validated.display()),
    })
}

/// Open a scaffold output folder in VSCode, fallback to opening folder on failure
#[tauri::command]
pub async fn plugin_open_scaffold_in_vscode(path: String) -> Result<ScaffoldOpenResult, String> {
    let validated = validate_scaffold_open_path(&path)?;
    let vscode_result = open_path_with_vscode(&validated);
    let folder_result = if vscode_result.is_err() {
        open_folder_path(&validated)
    } else {
        Ok(())
    };

    compose_vscode_open_result(&validated, vscode_result, folder_result)
}

/// Get settings schema for a plugin
#[tauri::command]
pub async fn plugin_get_settings_schema(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<Vec<crate::plugin::manifest::SettingDeclaration>, String> {
    let mgr = manager.read().await;
    mgr.get_plugin_settings_schema(&plugin_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get current settings values for a plugin
#[tauri::command]
pub async fn plugin_get_settings_values(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let mgr = manager.read().await;
    mgr.get_plugin_settings_values(&plugin_id)
        .await
        .map_err(|e| e.to_string())
}

/// Set a single setting value for a plugin
#[tauri::command]
pub async fn plugin_set_setting(
    plugin_id: String,
    key: String,
    value: serde_json::Value,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.set_plugin_setting(&plugin_id, &key, value)
        .await
        .map_err(|e| e.to_string())
}

/// Check for updates across all plugins
#[tauri::command]
pub async fn plugin_check_all_updates(
    manager: State<'_, SharedPluginManager>,
) -> Result<Vec<PluginUpdateInfo>, String> {
    let mgr = manager.read().await;
    Ok(mgr.check_all_updates().await)
}

/// Update all plugins that have available updates
#[tauri::command]
pub async fn plugin_update_all(
    manager: State<'_, SharedPluginManager>,
) -> Result<Vec<Result<String, String>>, String> {
    let mut mgr = manager.write().await;
    Ok(mgr.update_all().await)
}

/// Dispatch a system event to all listening plugins
#[tauri::command]
pub async fn plugin_dispatch_event(
    event_name: String,
    payload: serde_json::Value,
    manager: State<'_, SharedPluginManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.dispatch_event(&event_name, &payload).await;
    Ok(())
}

fn validate_scaffold_open_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Scaffold path must not be empty".to_string());
    }

    let candidate = PathBuf::from(trimmed);
    if !candidate.exists() {
        return Err(format!("Scaffold path does not exist: {}", trimmed));
    }
    if !candidate.is_dir() {
        return Err(format!("Scaffold path is not a directory: {}", trimmed));
    }

    candidate
        .canonicalize()
        .map_err(|e| format!("Failed to resolve scaffold path '{}': {}", trimmed, e))
}

fn open_folder_path(path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy().to_string();
    tauri_plugin_opener::open_path(&path_str, None::<&str>)
        .map_err(|e| format!("Failed to open folder '{}': {}", path.display(), e))
}

fn open_path_with_vscode(path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy().to_string();
    tauri_plugin_opener::open_path(&path_str, Some("code"))
        .map_err(|e| format!("Failed to open in VSCode '{}': {}", path.display(), e))
}

fn compose_vscode_open_result(
    path: &Path,
    vscode_result: Result<(), String>,
    folder_result: Result<(), String>,
) -> Result<ScaffoldOpenResult, String> {
    match vscode_result {
        Ok(()) => Ok(ScaffoldOpenResult {
            opened_with: "vscode".to_string(),
            fallback_used: false,
            message: format!("Opened in VSCode: {}", path.display()),
        }),
        Err(vscode_err) => match folder_result {
            Ok(()) => Ok(ScaffoldOpenResult {
                opened_with: "folder".to_string(),
                fallback_used: true,
                message: format!(
                    "{}. Opened folder fallback: {}",
                    vscode_err,
                    path.display()
                ),
            }),
            Err(folder_err) => Err(format!(
                "{}; fallback folder open failed: {}",
                vscode_err, folder_err
            )),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_path(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time went backwards")
            .as_nanos();
        std::env::temp_dir().join(format!("{}_{}", prefix, nanos))
    }

    #[test]
    fn validate_scaffold_open_path_accepts_existing_directory() {
        let dir = unique_temp_path("cognia_scaffold_dir");
        fs::create_dir_all(&dir).expect("create temp dir");

        let result = validate_scaffold_open_path(dir.to_string_lossy().as_ref());
        assert!(result.is_ok());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn validate_scaffold_open_path_rejects_non_directory() {
        let file_path = unique_temp_path("cognia_scaffold_file");
        fs::write(&file_path, "x").expect("create temp file");

        let result = validate_scaffold_open_path(file_path.to_string_lossy().as_ref());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a directory"));

        let _ = fs::remove_file(&file_path);
    }

    #[test]
    fn validate_scaffold_open_path_rejects_missing_path() {
        let missing = unique_temp_path("cognia_missing_dir");
        let result = validate_scaffold_open_path(missing.to_string_lossy().as_ref());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn compose_vscode_open_result_success_without_fallback() {
        let path = PathBuf::from("C:/tmp/example");
        let result = compose_vscode_open_result(&path, Ok(()), Ok(())).expect("result");
        assert_eq!(result.opened_with, "vscode");
        assert!(!result.fallback_used);
    }

    #[test]
    fn compose_vscode_open_result_uses_folder_fallback() {
        let path = PathBuf::from("C:/tmp/example");
        let result = compose_vscode_open_result(&path, Err("vscode failed".to_string()), Ok(()))
            .expect("fallback result");
        assert_eq!(result.opened_with, "folder");
        assert!(result.fallback_used);
        assert!(result.message.contains("vscode failed"));
    }

    #[test]
    fn compose_vscode_open_result_returns_combined_error_when_both_fail() {
        let path = PathBuf::from("C:/tmp/example");
        let result = compose_vscode_open_result(
            &path,
            Err("vscode failed".to_string()),
            Err("folder failed".to_string()),
        );
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .contains("fallback folder open failed: folder failed")
        );
    }
}
