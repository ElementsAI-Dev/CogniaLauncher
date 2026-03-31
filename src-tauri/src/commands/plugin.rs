use crate::plugin::manager::{
    CapabilityAuditRecord, PluginActionReport, PluginHealth, PluginManager, PluginUpdateInfo,
};
use crate::plugin::manifest::PluginManifest;
use crate::plugin::permissions::PermissionEnforcementMode;
use crate::plugin::permissions::PluginPermissionState;
use crate::plugin::registry::{PluginInfo, PluginToolInfo};
use crate::plugin::scaffold::{ScaffoldConfig, ScaffoldResult, ValidationResult};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};

pub type SharedPluginManager = Arc<RwLock<PluginManager>>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginMarketplaceActionError {
    pub category: String,
    pub message: String,
    pub retryable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginMarketplaceActionResult {
    pub ok: bool,
    pub action: String,
    pub plugin_id: Option<String>,
    pub phase: String,
    pub download_task_id: Option<String>,
    pub error: Option<PluginMarketplaceActionError>,
}

fn normalize_marketplace_error(action: &str, message: &str) -> PluginMarketplaceActionError {
    let normalized = message.trim().to_ascii_lowercase();

    if normalized.contains("desktop runtime is required")
        || normalized.contains("incompatible")
        || normalized.contains("compatib")
    {
        return PluginMarketplaceActionError {
            category: "compatibility_blocked".to_string(),
            message: message.to_string(),
            retryable: false,
        };
    }

    if normalized.contains("checksum")
        || normalized.contains("invalid zip")
        || normalized.contains("plugin.toml")
        || normalized.contains("validation")
        || normalized.contains("manifest")
    {
        return PluginMarketplaceActionError {
            category: "validation_failed".to_string(),
            message: message.to_string(),
            retryable: false,
        };
    }

    if normalized.contains("download failed")
        || normalized.contains("network")
        || normalized.contains("timeout")
        || normalized.contains("http ")
        || normalized.contains("source")
        || normalized.contains("unavailable")
    {
        return PluginMarketplaceActionError {
            category: "source_unavailable".to_string(),
            message: message.to_string(),
            retryable: true,
        };
    }

    let retryable = action == "install" || action == "update";
    PluginMarketplaceActionError {
        category: "install_execution_failed".to_string(),
        message: message.to_string(),
        retryable,
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ToolExecutionError {
    Validation { message: String },
    Runtime { message: String },
    Timeout { message: String },
    PermissionDenied { message: String },
    Cancelled { message: String },
}

impl ToolExecutionError {
    fn message(&self) -> &str {
        match self {
            Self::Validation { message }
            | Self::Runtime { message }
            | Self::Timeout { message }
            | Self::PermissionDenied { message }
            | Self::Cancelled { message } => message,
        }
    }

    fn phase(&self) -> &'static str {
        match self {
            Self::Cancelled { .. } => "cancelled",
            _ => "failed",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolProgressEventPayload {
    tool_id: String,
    execution_id: String,
    phase: String,
    progress: Option<u8>,
    message: Option<String>,
    error: Option<ToolExecutionError>,
}

fn classify_tool_execution_error(message: &str) -> ToolExecutionError {
    let normalized = message.trim().to_ascii_lowercase();

    if normalized.contains("timeout") || normalized.contains("timed out") {
        return ToolExecutionError::Timeout {
            message: message.to_string(),
        };
    }

    if normalized.contains("permission") || normalized.contains("denied") {
        return ToolExecutionError::PermissionDenied {
            message: message.to_string(),
        };
    }

    if normalized.contains("cancelled")
        || normalized.contains("canceled")
        || normalized.contains("aborted")
    {
        return ToolExecutionError::Cancelled {
            message: message.to_string(),
        };
    }

    if normalized.contains("not declared")
        || normalized.contains("not found")
        || normalized.contains("invalid")
        || normalized.contains("validation")
        || normalized.contains("blocked by plugin-point")
    {
        return ToolExecutionError::Validation {
            message: message.to_string(),
        };
    }

    ToolExecutionError::Runtime {
        message: message.to_string(),
    }
}

fn emit_tool_progress(
    app: &AppHandle,
    tool_id: &str,
    execution_id: &str,
    phase: &str,
    progress: Option<u8>,
    message: Option<String>,
    error: Option<ToolExecutionError>,
) {
    if let Err(emit_error) = app.emit(
        "toolbox-tool-progress",
        ToolProgressEventPayload {
            tool_id: tool_id.to_string(),
            execution_id: execution_id.to_string(),
            phase: phase.to_string(),
            progress,
            message,
            error,
        },
    ) {
        log::warn!(
            "[plugin-runtime][tool:{}][execution:{}][operation:emit-progress] {}",
            tool_id,
            execution_id,
            emit_error
        );
    }
}

async fn wait_for_tool_cancellation(cancel_token: Arc<std::sync::atomic::AtomicBool>) {
    while !cancel_token.load(Ordering::SeqCst) {
        sleep(Duration::from_millis(50)).await;
    }
}

fn success_marketplace_result(
    action: &str,
    report: PluginActionReport,
) -> PluginMarketplaceActionResult {
    PluginMarketplaceActionResult {
        ok: true,
        action: action.to_string(),
        plugin_id: Some(report.plugin_id),
        phase: report.phase,
        download_task_id: report.download_task_id,
        error: None,
    }
}

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

#[tauri::command]
pub async fn plugin_install_marketplace_with_result(
    store_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<PluginMarketplaceActionResult, String> {
    let mut mgr = manager.write().await;
    match mgr.install_from_marketplace_with_report(&store_id).await {
        Ok(report) => Ok(success_marketplace_result("install", report)),
        Err(error) => {
            let message = error.to_string();
            Ok(PluginMarketplaceActionResult {
                ok: false,
                action: "install".to_string(),
                plugin_id: None,
                phase: "failed".to_string(),
                download_task_id: None,
                error: Some(normalize_marketplace_error("install", &message)),
            })
        }
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
    execution_id: Option<String>,
    tool_id: Option<String>,
    manager: State<'_, SharedPluginManager>,
    app: AppHandle,
    tokens: State<'_, crate::CancellationTokens>,
) -> Result<String, ToolExecutionError> {
    let resolved_execution_id = execution_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let resolved_tool_id =
        tool_id.unwrap_or_else(|| format!("plugin:{}:{}", plugin_id, tool_entry));
    let cancel_token = Arc::new(std::sync::atomic::AtomicBool::new(false));
    tokens
        .write()
        .await
        .insert(resolved_execution_id.clone(), cancel_token.clone());

    emit_tool_progress(
        &app,
        &resolved_tool_id,
        &resolved_execution_id,
        "running",
        Some(5),
        Some("Tool execution started".to_string()),
        None,
    );

    let result = {
        let mut mgr = manager.write().await;
        tokio::select! {
            outcome = mgr.call_tool(&plugin_id, &tool_entry, &input) => {
                outcome.map_err(|error| classify_tool_execution_error(&error.to_string()))
            }
            _ = wait_for_tool_cancellation(cancel_token.clone()) => {
                Err(ToolExecutionError::Cancelled {
                    message: "Tool execution cancelled".to_string(),
                })
            }
        }
    };

    tokens.write().await.remove(&resolved_execution_id);

    let result = match result {
        Ok(value) => value,
        Err(error) => {
            emit_tool_progress(
                &app,
                &resolved_tool_id,
                &resolved_execution_id,
                error.phase(),
                None,
                Some(error.message().to_string()),
                Some(error.clone()),
            );
            return Err(error);
        }
    };

    for effect in &result.ui_effects {
        if matches!(effect.effect.as_str(), "toast" | "navigate") {
            if let Err(error) = app.emit("plugin-ui-effect", effect) {
                log::warn!(
                    "[plugin-runtime][plugin:{}][operation:emit-ui-effect][stage:app-emit] failed to emit UI effect '{}': {}",
                    plugin_id,
                    effect.effect,
                    error
                );
            }
        }
    }

    emit_tool_progress(
        &app,
        &resolved_tool_id,
        &resolved_execution_id,
        "complete",
        Some(100),
        Some("Tool execution complete".to_string()),
        None,
    );

    Ok(result.output)
}

#[tauri::command]
pub async fn toolbox_cancel_tool(
    execution_id: String,
    tokens: State<'_, crate::CancellationTokens>,
) -> Result<bool, String> {
    let token = tokens.read().await.get(&execution_id).cloned();
    if let Some(token) = token {
        token.store(true, Ordering::SeqCst);
        return Ok(true);
    }

    Ok(false)
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

#[tauri::command]
pub async fn plugin_update_with_result(
    plugin_id: String,
    manager: State<'_, SharedPluginManager>,
) -> Result<PluginMarketplaceActionResult, String> {
    let mut mgr = manager.write().await;
    match mgr.update_plugin_with_report(&plugin_id).await {
        Ok(report) => Ok(success_marketplace_result("update", report)),
        Err(error) => {
            let message = error.to_string();
            Ok(PluginMarketplaceActionResult {
                ok: false,
                action: "update".to_string(),
                plugin_id: Some(plugin_id),
                phase: "failed".to_string(),
                download_task_id: None,
                error: Some(normalize_marketplace_error("update", &message)),
            })
        }
    }
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
                message: format!("{}. Opened folder fallback: {}", vscode_err, path.display()),
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
    fn validate_scaffold_open_path_rejects_empty_input() {
        let result = validate_scaffold_open_path("   ");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must not be empty"));
    }

    #[test]
    fn validate_scaffold_open_path_trims_input_before_resolution() {
        let dir = unique_temp_path("cognia_scaffold_dir_trim");
        fs::create_dir_all(&dir).expect("create temp dir");
        let padded = format!("  {}  ", dir.to_string_lossy());

        let result = validate_scaffold_open_path(&padded).expect("validated path");
        assert_eq!(result, dir.canonicalize().expect("canonical dir"));

        let _ = fs::remove_dir_all(&dir);
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
        assert!(result
            .unwrap_err()
            .contains("fallback folder open failed: folder failed"));
    }
}
