use crate::config::Settings;
use crate::core::health_check::HealthCheckManager;
use crate::core::profiles::{EnvironmentProfile, ProfileManager};
use crate::download::DownloadManager;
use crate::platform::process;
use crate::plugin::permissions::PermissionManager;
use crate::plugin::registry::PluginRegistry as CogniaPluginRegistry;
use crate::provider::registry::ProviderRegistry;
use crate::provider::traits::Provider;
use extism::{host_fn, Error as ExtismError, UserData, ValType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
#[cfg(not(test))]
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tokio::sync::RwLock;

// ============================================================================
// Host Context — shared state available to all host functions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmittedPluginEvent {
    pub source_plugin_id: String,
    pub event_name: String,
    pub payload: serde_json::Value,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EmittedPluginLog {
    pub source_type: String,
    pub source_plugin_id: Option<String>,
    pub level: String,
    pub message: String,
    pub target: Option<String>,
    #[serde(default)]
    pub fields: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub correlation_id: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EmittedPluginUiEffect {
    pub plugin_id: String,
    pub function_name: String,
    pub effect: String,
    pub correlation_id: Option<String>,
    pub payload: serde_json::Value,
}

/// Shared context passed to host functions via Extism UserData.
/// This gives WASM plugins controlled access to the launcher's core APIs.
#[derive(Clone)]
pub struct HostContext {
    pub registry: Arc<RwLock<ProviderRegistry>>,
    pub settings: Arc<RwLock<Settings>>,
    pub permissions: Arc<RwLock<PermissionManager>>,
    /// Plugin registry for accessing plugin locale data
    pub plugin_registry: Arc<RwLock<CogniaPluginRegistry>>,
    /// The ID of the plugin currently executing (set before each call)
    pub current_plugin_id: Arc<RwLock<String>>,
    /// The function currently executing (tool entry or lifecycle callback)
    pub current_function_name: Arc<RwLock<String>>,
    /// Events emitted by plugins during host function calls.
    pub emitted_events: Arc<RwLock<Vec<EmittedPluginEvent>>>,
    /// Logs emitted by plugins during host function calls.
    pub emitted_logs: Arc<RwLock<Vec<EmittedPluginLog>>>,
    /// UI effects emitted by plugins that must be delivered by the active launcher window.
    pub emitted_ui_effects: Arc<RwLock<Vec<EmittedPluginUiEffect>>>,
    /// Suppresses nested log fanout while `cognia_on_log` callbacks execute.
    pub log_dispatch_active: Arc<RwLock<bool>>,
    /// Active app handle when running inside the desktop host.
    pub app_handle: Arc<RwLock<Option<tauri::AppHandle>>>,
    // Extended SDK v1.1 — optional subsystem handles
    /// Download manager for download host functions.
    pub download_manager: Option<Arc<RwLock<DownloadManager>>>,
    /// Profile manager for profile host functions.
    pub profile_manager: Option<Arc<RwLock<ProfileManager>>>,
}

impl HostContext {
    pub fn new(
        registry: Arc<RwLock<ProviderRegistry>>,
        settings: Arc<RwLock<Settings>>,
        permissions: Arc<RwLock<PermissionManager>>,
        plugin_registry: Arc<RwLock<CogniaPluginRegistry>>,
        app_handle: Option<tauri::AppHandle>,
    ) -> Self {
        Self {
            registry,
            settings,
            permissions,
            plugin_registry,
            current_plugin_id: Arc::new(RwLock::new(String::new())),
            current_function_name: Arc::new(RwLock::new(String::new())),
            emitted_events: Arc::new(RwLock::new(Vec::new())),
            emitted_logs: Arc::new(RwLock::new(Vec::new())),
            emitted_ui_effects: Arc::new(RwLock::new(Vec::new())),
            log_dispatch_active: Arc::new(RwLock::new(false)),
            app_handle: Arc::new(RwLock::new(app_handle)),
            download_manager: None,
            profile_manager: None,
        }
    }

    /// Set the current plugin and function before making a WASM call
    pub async fn set_current_call(&self, plugin_id: &str, function_name: &str) {
        let mut id = self.current_plugin_id.write().await;
        *id = plugin_id.to_string();
        drop(id);
        let mut function = self.current_function_name.write().await;
        *function = function_name.to_string();
    }

    pub async fn push_emitted_event(&self, event: EmittedPluginEvent) {
        let mut events = self.emitted_events.write().await;
        events.push(event);
    }

    pub async fn clear_emitted_events(&self) {
        let mut events = self.emitted_events.write().await;
        events.clear();
    }

    pub async fn drain_emitted_events(&self) -> Vec<EmittedPluginEvent> {
        let mut events = self.emitted_events.write().await;
        std::mem::take(&mut *events)
    }

    pub async fn push_emitted_log(&self, log: EmittedPluginLog) -> bool {
        if *self.log_dispatch_active.read().await {
            return false;
        }
        let mut logs = self.emitted_logs.write().await;
        logs.push(log);
        true
    }

    pub async fn clear_emitted_logs(&self) {
        let mut logs = self.emitted_logs.write().await;
        logs.clear();
    }

    pub async fn drain_emitted_logs(&self) -> Vec<EmittedPluginLog> {
        let mut logs = self.emitted_logs.write().await;
        std::mem::take(&mut *logs)
    }

    pub async fn push_emitted_ui_effect(&self, effect: EmittedPluginUiEffect) {
        let mut effects = self.emitted_ui_effects.write().await;
        effects.push(effect);
    }

    pub async fn clear_emitted_ui_effects(&self) {
        let mut effects = self.emitted_ui_effects.write().await;
        effects.clear();
    }

    pub async fn drain_emitted_ui_effects(&self) -> Vec<EmittedPluginUiEffect> {
        let mut effects = self.emitted_ui_effects.write().await;
        std::mem::take(&mut *effects)
    }

    pub async fn set_log_dispatch_active(&self, active: bool) {
        let mut guard = self.log_dispatch_active.write().await;
        *guard = active;
    }

    pub async fn app_handle(&self) -> Option<tauri::AppHandle> {
        self.app_handle.read().await.clone()
    }
}

enum CapturedRuntime {
    MultiThread(tokio::runtime::Handle),
    CurrentThread,
}

struct HostRuntimeBridge {
    captured_runtime: Option<CapturedRuntime>,
}

impl HostRuntimeBridge {
    fn capture() -> Result<Self, ExtismError> {
        let captured_runtime = match tokio::runtime::Handle::try_current() {
            Ok(handle) => match handle.runtime_flavor() {
                tokio::runtime::RuntimeFlavor::CurrentThread => {
                    Some(CapturedRuntime::CurrentThread)
                }
                _ => Some(CapturedRuntime::MultiThread(handle)),
            },
            Err(_) => None,
        };

        Ok(Self { captured_runtime })
    }

    #[track_caller]
    fn block_on<T, Fut>(&self, fut: Fut) -> Result<T, ExtismError>
    where
        Fut: Future<Output = Result<T, ExtismError>>,
    {
        match &self.captured_runtime {
            Some(CapturedRuntime::MultiThread(handle)) => {
                let boundary_result =
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        tokio::task::block_in_place(|| handle.block_on(fut))
                    }));
                match boundary_result {
                    Ok(result) => result,
                    Err(_) => Err(log_boundary_error(
                        None,
                        "runtime",
                        "runtime bridge panic while executing host async section",
                    )),
                }
            }
            Some(CapturedRuntime::CurrentThread) => Err(log_boundary_error(
                None,
                "runtime",
                "current-thread Tokio runtime is not supported for synchronous plugin host bridge",
            )),
            None => {
                let runtime = tokio::runtime::Runtime::new().map_err(|e| {
                    log_boundary_error(
                        None,
                        "runtime",
                        format!("failed to create fallback runtime: {}", e),
                    )
                })?;
                runtime.block_on(fut)
            }
        }
    }
}

#[track_caller]
fn log_boundary_error(
    plugin_id: Option<&str>,
    stage: &str,
    message: impl AsRef<str>,
) -> ExtismError {
    let location = std::panic::Location::caller();
    let plugin = plugin_id.unwrap_or("unknown");
    let detail = message.as_ref();
    log::warn!(
        "[plugin-runtime][plugin:{}][operation:{}:{}][stage:{}] {}",
        plugin,
        location.file(),
        location.line(),
        stage,
        detail
    );
    ExtismError::msg(detail.to_string())
}

async fn require_current_plugin_id(ctx: &HostContext) -> Result<String, ExtismError> {
    let plugin_id = ctx.current_plugin_id.read().await.clone();
    if plugin_id.trim().is_empty() {
        return Err(log_boundary_error(
            Some("unknown"),
            "context",
            "missing current plugin execution context",
        ));
    }
    Ok(plugin_id)
}

#[cfg_attr(test, allow(dead_code))]
async fn require_current_function_name(ctx: &HostContext) -> Result<String, ExtismError> {
    let function_name = ctx.current_function_name.read().await.clone();
    if function_name.trim().is_empty() {
        return Err(log_boundary_error(
            Some("unknown"),
            "context",
            "missing current plugin function context",
        ));
    }
    Ok(function_name)
}

#[track_caller]
fn check_permission(
    perms: &PermissionManager,
    plugin_id: &str,
    permission: &str,
) -> Result<(), ExtismError> {
    perms
        .check_permission(plugin_id, permission)
        .map_err(|e| log_boundary_error(Some(plugin_id), "permission", e.to_string()))
}

#[track_caller]
fn check_fs_access(
    perms: &PermissionManager,
    plugin_id: &str,
    path: &std::path::Path,
    write: bool,
) -> Result<(), ExtismError> {
    perms
        .check_fs_access(plugin_id, path, write)
        .map_err(|e| log_boundary_error(Some(plugin_id), "permission", e.to_string()))
}

#[track_caller]
fn check_http_access(
    perms: &PermissionManager,
    plugin_id: &str,
    url: &str,
) -> Result<(), ExtismError> {
    perms
        .check_http_access(plugin_id, url)
        .map_err(|e| log_boundary_error(Some(plugin_id), "permission", e.to_string()))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpRequestInput {
    url: String,
    #[serde(default = "default_http_method")]
    method: String,
    #[serde(default)]
    headers: HashMap<String, String>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    content_type: Option<String>,
    #[serde(default)]
    timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponseOutput {
    status: u16,
    body: String,
    headers: HashMap<String, String>,
}

fn default_http_method() -> String {
    "GET".to_string()
}

fn default_log_level() -> String {
    "info".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LogInput {
    #[serde(default = "default_log_level")]
    level: String,
    message: String,
    #[serde(default)]
    target: Option<String>,
    #[serde(default)]
    fields: HashMap<String, serde_json::Value>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PluginUiContextPayload {
    locale: String,
    theme: String,
    window_effect: String,
    desktop: bool,
    in_app_effects: bool,
}

#[cfg_attr(test, allow(dead_code))]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginUiFileFilterInput {
    name: String,
    #[serde(default)]
    extensions: Vec<String>,
}

#[cfg_attr(test, allow(dead_code))]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginUiRequestInput {
    effect: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    level: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    default_path: Option<String>,
    #[serde(default)]
    multiple: Option<bool>,
    #[serde(default)]
    filters: Vec<PluginUiFileFilterInput>,
    #[serde(default)]
    correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PluginUiRequestResult {
    effect: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    correlation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
}

fn ui_result(
    effect: &str,
    status: &str,
    correlation_id: Option<String>,
    message: Option<String>,
    data: Option<serde_json::Value>,
) -> PluginUiRequestResult {
    PluginUiRequestResult {
        effect: effect.to_string(),
        status: status.to_string(),
        correlation_id,
        message,
        data,
    }
}

#[cfg_attr(test, allow(dead_code))]
fn normalize_ui_effect_name(value: &str) -> String {
    value.trim().to_ascii_lowercase().replace('_', "-")
}

#[cfg_attr(test, allow(dead_code))]
fn normalize_ui_level(value: Option<&str>) -> String {
    value.unwrap_or("info").trim().to_ascii_lowercase()
}

fn serialize_ui_result(result: &PluginUiRequestResult) -> Result<String, ExtismError> {
    serde_json::to_string(result).map_err(|error| ExtismError::msg(error.to_string()))
}

fn build_ui_context_payload(settings: &Settings) -> PluginUiContextPayload {
    PluginUiContextPayload {
        locale: settings.appearance.language.clone(),
        theme: settings.appearance.theme.clone(),
        window_effect: settings.appearance.window_effect.clone(),
        desktop: true,
        in_app_effects: true,
    }
}

#[cfg_attr(test, allow(dead_code))]
fn normalize_dialog_path(path: &str) -> Option<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
}

#[cfg(not(test))]
fn apply_file_dialog_options<R: tauri::Runtime>(
    mut dialog: tauri_plugin_dialog::FileDialogBuilder<R>,
    request: &PluginUiRequestInput,
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    if let Some(title) = &request.title {
        if !title.trim().is_empty() {
            dialog = dialog.set_title(title);
        }
    }
    if let Some(default_path) = request
        .default_path
        .as_deref()
        .and_then(normalize_dialog_path)
    {
        dialog = dialog.set_directory(default_path);
    }
    for filter in &request.filters {
        if !filter.name.trim().is_empty() && !filter.extensions.is_empty() {
            let exts = filter
                .extensions
                .iter()
                .map(|ext| ext.as_str())
                .collect::<Vec<_>>();
            dialog = dialog.add_filter(&filter.name, &exts);
        }
    }
    dialog
}

#[cfg_attr(test, allow(dead_code))]
fn path_to_json_value(path: &Path) -> serde_json::Value {
    serde_json::Value::String(path.display().to_string())
}

fn normalize_emitted_plugin_log(plugin_id: &str, log_input: LogInput) -> EmittedPluginLog {
    let tags = log_input
        .tags
        .into_iter()
        .map(|tag| tag.trim().to_string())
        .filter(|tag| !tag.is_empty())
        .collect();
    EmittedPluginLog {
        source_type: "plugin".to_string(),
        source_plugin_id: Some(plugin_id.to_string()),
        level: log_input.level.trim().to_ascii_lowercase(),
        message: log_input.message,
        target: log_input
            .target
            .map(|target| target.trim().to_string())
            .filter(|target| !target.is_empty()),
        fields: log_input.fields,
        tags,
        correlation_id: log_input
            .correlation_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

fn format_primary_log_message(record: &EmittedPluginLog) -> String {
    let mut message = record.message.clone();
    let mut extras = Vec::new();
    if let Some(target) = &record.target {
        extras.push(format!("target={}", target));
    }
    if let Some(correlation_id) = &record.correlation_id {
        extras.push(format!("correlationId={}", correlation_id));
    }
    if !record.tags.is_empty() {
        extras.push(format!("tags=[{}]", record.tags.join(",")));
    }
    if !record.fields.is_empty() {
        let fields = serde_json::to_string(&record.fields).unwrap_or_else(|_| "{}".to_string());
        extras.push(format!("fields={}", fields));
    }
    if !extras.is_empty() {
        message.push_str(" | ");
        message.push_str(&extras.join(" "));
    }
    message
}

async fn perform_http_request(
    ctx: HostContext,
    req: HttpRequestInput,
) -> Result<String, ExtismError> {
    let plugin_id = require_current_plugin_id(&ctx).await?;
    let perms = ctx.permissions.read().await;
    check_http_access(&perms, &plugin_id, &req.url)?;
    drop(perms);

    let method =
        reqwest::Method::from_bytes(req.method.trim().to_uppercase().as_bytes()).map_err(|e| {
            ExtismError::msg(format!("Unsupported HTTP method '{}': {}", req.method, e))
        })?;

    let client = reqwest::Client::new();
    let mut request = client
        .request(method, &req.url)
        .header("User-Agent", "CogniaLauncher-Plugin/0.1.0");

    for (key, value) in &req.headers {
        request = request.header(key, value);
    }

    let has_content_type_header = req
        .headers
        .keys()
        .any(|key| key.eq_ignore_ascii_case("content-type"));
    if !has_content_type_header {
        if let Some(content_type) = &req.content_type {
            request = request.header("Content-Type", content_type);
        }
    }

    if let Some(timeout_ms) = req.timeout_ms {
        request = request.timeout(Duration::from_millis(timeout_ms));
    }

    if let Some(body) = req.body {
        request = request.body(body);
    }

    let response = request
        .send()
        .await
        .map_err(|e| ExtismError::msg(format!("HTTP request failed: {}", e)))?;

    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|text| (name.as_str().to_string(), text.to_string()))
        })
        .collect::<HashMap<_, _>>();
    let body = response
        .text()
        .await
        .map_err(|e| ExtismError::msg(format!("Failed to read response: {}", e)))?;

    serde_json::to_string(&HttpResponseOutput {
        status,
        body,
        headers,
    })
    .map_err(|e| ExtismError::msg(format!("Failed to serialize response: {}", e)))
}

const DEFAULT_PLUGIN_PROCESS_TIMEOUT_MS: u64 = 60_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessExecInput {
    command: String,
    #[serde(default)]
    args: Vec<String>,
    cwd: Option<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    timeout_ms: Option<u64>,
    capture_output: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessShellInput {
    command: String,
    cwd: Option<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    timeout_ms: Option<u64>,
    capture_output: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ProcessLookupInput {
    command: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessResultOutput {
    exit_code: i32,
    stdout: String,
    stderr: String,
    success: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessLookupOutput {
    path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessAvailabilityOutput {
    available: bool,
}

fn build_plugin_process_options(
    cwd: Option<String>,
    env: HashMap<String, String>,
    timeout_ms: Option<u64>,
    capture_output: Option<bool>,
) -> process::ProcessOptions {
    let mut options = process::ProcessOptions::new().with_timeout(Duration::from_millis(
        timeout_ms.unwrap_or(DEFAULT_PLUGIN_PROCESS_TIMEOUT_MS),
    ));

    if let Some(cwd) = cwd {
        options = options.with_cwd(cwd);
    }

    for (key, value) in env {
        options = options.with_env(key, value);
    }

    if let Some(capture_output) = capture_output {
        options = options.with_capture(capture_output);
    }

    options
}

fn serialize_process_output(output: process::ProcessOutput) -> Result<String, ExtismError> {
    serde_json::to_string(&ProcessResultOutput {
        exit_code: output.exit_code,
        stdout: output.stdout,
        stderr: output.stderr,
        success: output.success,
    })
    .map_err(|e| ExtismError::msg(format!("Failed to serialize process result: {}", e)))
}

fn serialize_process_lookup(path: Option<String>) -> Result<String, ExtismError> {
    serde_json::to_string(&ProcessLookupOutput { path })
        .map_err(|e| ExtismError::msg(format!("Failed to serialize process lookup: {}", e)))
}

fn serialize_process_availability(available: bool) -> Result<String, ExtismError> {
    serde_json::to_string(&ProcessAvailabilityOutput { available })
        .map_err(|e| ExtismError::msg(format!("Failed to serialize process availability: {}", e)))
}

fn serialize_json<T: Serialize>(value: &T) -> Result<String, ExtismError> {
    serde_json::to_string(value)
        .map_err(|error| ExtismError::msg(format!("Failed to serialize host result: {}", error)))
}

fn map_process_error(error: process::ProcessError) -> ExtismError {
    match error {
        process::ProcessError::StartFailed(err) => {
            ExtismError::msg(format!("Failed to execute command: {}", err))
        }
        process::ProcessError::Timeout(timeout) => {
            ExtismError::msg(format!("Process execution timed out ({:?})", timeout))
        }
        process::ProcessError::ExitCode(code) => {
            ExtismError::msg(format!("Process exited with code {}", code))
        }
        process::ProcessError::Signal => ExtismError::msg("Process terminated by signal"),
    }
}

async fn ensure_process_exec_permission(ctx: &HostContext) -> Result<(), ExtismError> {
    let plugin_id = require_current_plugin_id(ctx).await?;
    let perms = ctx.permissions.read().await;
    check_permission(&perms, &plugin_id, "process_exec")?;
    drop(perms);
    Ok(())
}

// ============================================================================
// Host Function Implementations
// ============================================================================

// --- Configuration ---

// Read a config value. Requires: config_read permission.
// Input: JSON { "key": "some.config.key" }
// Output: JSON { "value": "..." } or { "value": null }
host_fn!(pub cognia_config_get(user_data: HostContext; key: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "config_read")?;
        drop(perms);

        let settings = ctx.settings.read().await;
        let value = settings.get_value(&key);
        Ok::<_, ExtismError>(serde_json::json!({ "value": value }).to_string())
    })?;

    Ok(result)
});

// Write a config value. Requires: config_write permission.
// Input: JSON { "key": "...", "value": "..." }
// Output: JSON { "ok": true }
host_fn!(pub cognia_config_set(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let parsed: HashMap<String, String> = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let key = parsed.get("key").ok_or_else(|| ExtismError::msg("Missing 'key'"))?;
    let value = parsed.get("value").ok_or_else(|| ExtismError::msg("Missing 'value'"))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "config_write")?;
        drop(perms);

        let mut settings = ctx.settings.write().await;
        let _ = settings.set_value(key, value);
        Ok::<_, ExtismError>(())
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// --- Environment ---

// List all environments. Requires: env_read permission.
// Input: (empty string)
// Output: JSON array of { id, display_name }
host_fn!(pub cognia_env_list(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "env_read")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        let env_ids = registry.list_environment_providers();

        #[derive(Serialize)]
        struct EnvEntry { id: String, display_name: String }

        let entries: Vec<EnvEntry> = env_ids.iter().filter_map(|id| {
            registry.get_environment_provider(id).map(|p| EnvEntry {
                id: p.id().to_string(),
                display_name: p.display_name().to_string(),
            })
        }).collect();

        Ok::<_, ExtismError>(serde_json::to_string(&entries)
            .map_err(|e| ExtismError::msg(e.to_string()))?)
    })?;

    Ok(result)
});

// List all available providers. Requires: env_read permission.
// Input: (empty string)
// Output: JSON array of ProviderInfo { id, displayName, capabilities, platforms, priority }
host_fn!(pub cognia_provider_list(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "env_read")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        let info = registry.list_all_info();
        Ok::<_, ExtismError>(serde_json::to_string(&info)
            .map_err(|e| ExtismError::msg(e.to_string()))?)
    })?;

    Ok(result)
});

// --- Packages ---

// Search packages. Requires: pkg_search permission.
// Input: JSON { "query": "...", "provider": null | "npm" }
// Output: JSON array of PackageSummary
host_fn!(pub cognia_pkg_search(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct SearchInput {
        query: String,
        provider: Option<String>,
    }

    let search: SearchInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        let options = crate::provider::SearchOptions { limit: Some(20), page: None };

        let results = if let Some(provider_id) = &search.provider {
            if let Some(provider) = registry.get(provider_id) {
                provider.search(&search.query, options).await
                    .unwrap_or_default()
            } else {
                vec![]
            }
        } else {
            // Search across all available providers (first match)
            let mut found = vec![];
            for provider_id in registry.list() {
                if let Some(provider) = registry.get(provider_id) {
                    if provider.is_available().await {
                        if let Ok(results) = provider.search(&search.query, options.clone()).await {
                            found.extend(results);
                            if found.len() >= 20 { break; }
                        }
                    }
                }
            }
            found
        };

        Ok::<_, ExtismError>(serde_json::to_string(&results)
            .map_err(|e| ExtismError::msg(e.to_string()))?)
    })?;

    Ok(result)
});

// --- File System (sandboxed) ---

// Read a file from the plugin's data directory. Requires: fs_read permission.
// Input: JSON { "path": "relative/path.txt" }
// Output: file contents as string
host_fn!(pub cognia_fs_read(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        check_fs_access(&perms, &plugin_id, &full_path, false)?;
        drop(perms);

        tokio::fs::read_to_string(&full_path).await
            .map_err(|e| ExtismError::msg(format!("Failed to read file: {}", e)))
    })?;

    Ok(result)
});

// Write a file to the plugin's data directory. Requires: fs_write permission.
// Input: JSON { "path": "relative/path.txt", "content": "..." }
// Output: JSON { "ok": true }
host_fn!(pub cognia_fs_write(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct FsWriteInput { path: String, content: String }

    let fs_input: FsWriteInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        check_fs_access(&perms, &plugin_id, &full_path, true)?;
        drop(perms);

        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| ExtismError::msg(format!("Failed to create dir: {}", e)))?;
        }

        tokio::fs::write(&full_path, &fs_input.content).await
            .map_err(|e| ExtismError::msg(format!("Failed to write file: {}", e)))
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// --- HTTP (restricted to declared domains) ---

// Make an HTTP GET request. Requires: http permission + URL in allowed domains.
// Input: JSON { "url": "https://..." }
// Output: JSON { "status": 200, "body": "..." }
host_fn!(pub cognia_http_get(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct HttpInput { url: String }

    let http_input: HttpInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        perform_http_request(
            ctx.clone(),
            HttpRequestInput {
                url: http_input.url,
                method: "GET".to_string(),
                headers: HashMap::new(),
                body: None,
                content_type: None,
                timeout_ms: None,
            },
        ).await
    })?;

    Ok(result)
});

// --- i18n ---

// Get the current application locale. Always allowed.
// Input: (empty string)
// Output: JSON { "locale": "en" | "zh" }
host_fn!(pub cognia_get_locale(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let settings = ctx.settings.read().await;
        let locale = settings.get_value("language").unwrap_or_else(|| "en".to_string());
        Ok::<_, ExtismError>(serde_json::json!({ "locale": locale }).to_string())
    })?;

    Ok(result)
});

// --- Platform Info ---

// Get platform information. Always allowed.
// Input: (empty string)
// Output: JSON { "os", "arch", "hostname", "osVersion" }
host_fn!(pub cognia_platform_info(user_data: HostContext; _input: String) -> String {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let hostname = sysinfo::System::host_name().unwrap_or_default();
    let os_version = sysinfo::System::os_version().unwrap_or_default();

    Ok(serde_json::json!({
        "os": os,
        "arch": arch,
        "hostname": hostname,
        "osVersion": os_version,
    }).to_string())
});

// --- Environment Detection ---

// Detect installed environment versions (e.g. node, python, rust).
// Requires: env_read permission.
// Input: JSON { "envType": "node" | "python" | "rust" | ... }
// Output: JSON { "available": bool, "currentVersion": ..., "installedVersions": [...] }
host_fn!(pub cognia_env_detect(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct DetectInput { env_type: String }

    let detect: DetectInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "env_read")?;
        drop(perms);

        let registry = ctx.registry.read().await;

        // Find environment provider matching the env_type
        let mut found = false;
        let mut current_version: Option<String> = None;
        let mut installed_versions: Vec<String> = Vec::new();

        for env_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(env_id) {
                // Check if this provider's env_type matches
                let provider_env_type = provider.version_file_name();
                let matches = env_id.contains(&detect.env_type)
                    || provider_env_type.contains(&detect.env_type);

                if matches {
                    found = provider.is_available().await;
                    if found {
                        current_version = provider.get_current_version().await.ok().flatten();
                        installed_versions = provider.list_installed_versions().await
                            .unwrap_or_default()
                            .into_iter()
                            .map(|v| v.version)
                            .collect();
                    }
                    break;
                }
            }
        }

        Ok::<_, ExtismError>(serde_json::json!({
            "available": found,
            "currentVersion": current_version,
            "installedVersions": installed_versions,
        }).to_string())
    })?;

    Ok(result)
});

// --- Package Management ---

// Get package info. Requires: pkg_search permission.
// Input: JSON { "name": "express", "provider": "npm" | null }
// Output: JSON PackageInfo
host_fn!(pub cognia_pkg_info(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct PkgInput { name: String, provider: Option<String> }

    let pkg: PkgInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        let registry = ctx.registry.read().await;

        if let Some(provider_id) = &pkg.provider {
            if let Some(provider) = registry.get(provider_id) {
                let info = provider.get_package_info(&pkg.name).await
                    .map_err(|e| ExtismError::msg(e.to_string()))?;
                return Ok(serde_json::to_string(&info)
                    .map_err(|e| ExtismError::msg(e.to_string()))?);
            }
        }
        // Auto-find provider
        if let Ok(Some(provider)) = registry.find_for_package(&pkg.name).await {
            let info = provider.get_package_info(&pkg.name).await
                .map_err(|e| ExtismError::msg(e.to_string()))?;
            return Ok(serde_json::to_string(&info)
                .map_err(|e| ExtismError::msg(e.to_string()))?);
        }

        Err(ExtismError::msg(format!("Package '{}' not found", pkg.name)))
    })?;

    Ok(result)
});

// List installed packages. Requires: pkg_search permission.
// Input: JSON { "provider": "npm" | null }
// Output: JSON array of InstalledPackage
host_fn!(pub cognia_pkg_list_installed(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct ListInput { provider: Option<String> }

    let list_input: ListInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        let filter = crate::provider::InstalledFilter::default();

        if let Some(provider_id) = &list_input.provider {
            if let Some(provider) = registry.get(provider_id) {
                let packages = provider.list_installed(filter).await
                    .unwrap_or_default();
                return Ok(serde_json::to_string(&packages)
                    .map_err(|e| ExtismError::msg(e.to_string()))?);
            }
        }

        Ok::<_, ExtismError>(r#"[]"#.to_string())
    })?;

    Ok(result)
});

// Install a package. Requires: pkg_install permission (dangerous).
// Input: JSON { "name": "express", "version": null, "provider": "npm" | null }
// Output: JSON { "ok": true, "receipt": ... }
host_fn!(pub cognia_pkg_install(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct InstallInput { name: String, version: Option<String>, provider: Option<String> }

    let install: InstallInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_install")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        let request = crate::provider::InstallRequest {
            name: install.name.clone(),
            version: install.version,
            force: false,
            global: true,
        };

        if let Some(provider_id) = &install.provider {
            if let Some(provider) = registry.get(provider_id) {
                let receipt = provider.install(request).await
                    .map_err(|e| ExtismError::msg(e.to_string()))?;
                return Ok(serde_json::to_string(&receipt)
                    .map_err(|e| ExtismError::msg(e.to_string()))?);
            }
        }

        Err(ExtismError::msg(format!("No provider found for package '{}'", install.name)))
    })?;

    Ok(result)
});

// --- Cache ---

// Get cache info. Requires: env_read permission.
// Input: (empty string)
// Output: JSON with cache stats
host_fn!(pub cognia_cache_info(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "env_read")?;
        drop(perms);

        let settings = ctx.settings.read().await;
        let cache_dir = settings.get_cache_dir();
        let cache_size = {
            let p = cache_dir.clone();
            tokio::task::spawn_blocking(move || {
                fn walk(path: &std::path::Path) -> u64 {
                    let mut total = 0u64;
                    if let Ok(entries) = std::fs::read_dir(path) {
                        for e in entries.flatten() {
                            let p = e.path();
                            if p.is_file() { total += std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0); }
                            else if p.is_dir() { total += walk(&p); }
                        }
                    }
                    total
                }
                walk(&p)
            }).await.unwrap_or(0)
        };
        let cache_size_human = crate::platform::disk::format_size(cache_size);

        Ok::<_, ExtismError>(serde_json::json!({
            "cacheDir": cache_dir.display().to_string(),
            "totalSize": cache_size,
            "totalSizeHuman": cache_size_human,
        }).to_string())
    })?;

    Ok(result)
});

// --- Logging ---

// Write a log message. Always allowed (no permission check).
// Input: JSON { "level": "info|warn|error|debug", "message": "...", "target": "..." | null, "fields": {}, "tags": [], "correlationId": "..." | null }
// Output: JSON { "ok": true }
host_fn!(pub cognia_log(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let log_input: LogInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let plugin_id = rt.block_on(async { require_current_plugin_id(&ctx).await })?;
    let record = normalize_emitted_plugin_log(&plugin_id, log_input);
    let rendered_message = format_primary_log_message(&record);

    match record.level.as_str() {
        "error" => log::error!("[plugin:{}] {}", plugin_id, rendered_message),
        "warn" => log::warn!("[plugin:{}] {}", plugin_id, rendered_message),
        "debug" => log::debug!("[plugin:{}] {}", plugin_id, rendered_message),
        _ => log::info!("[plugin:{}] {}", plugin_id, rendered_message),
    }

    rt.block_on(async {
        ctx.push_emitted_log(record).await;
        Ok::<_, ExtismError>(())
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// --- Package Management (extended) ---

// Uninstall a package. Requires: pkg_install permission.
// Input: JSON { "name": "express", "version": null, "provider": "npm" | null }
// Output: JSON { "ok": true }
host_fn!(pub cognia_pkg_uninstall(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct UninstallInput { name: String, version: Option<String>, provider: Option<String> }

    let req: UninstallInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_install")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        let request = crate::provider::UninstallRequest {
            name: req.name.clone(),
            version: req.version,
            force: false,
        };

        if let Some(provider_id) = &req.provider {
            if let Some(provider) = registry.get(provider_id) {
                provider.uninstall(request).await
                    .map_err(|e| ExtismError::msg(e.to_string()))?;
                return Ok::<_, ExtismError>(());
            }
        }

        Err(ExtismError::msg(format!("No provider found for package '{}'", req.name)))
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// Get available versions for a package. Requires: pkg_search permission.
// Input: JSON { "name": "express", "provider": "npm" | null }
// Output: JSON array of VersionInfo
host_fn!(pub cognia_pkg_versions(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct VersionsInput { name: String, provider: Option<String> }

    let req: VersionsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        let registry = ctx.registry.read().await;

        if let Some(provider_id) = &req.provider {
            if let Some(provider) = registry.get(provider_id) {
                let versions = provider.get_versions(&req.name).await
                    .map_err(|e| ExtismError::msg(e.to_string()))?;
                return Ok(serde_json::to_string(&versions)
                    .map_err(|e| ExtismError::msg(e.to_string()))?);
            }
        }

        Err(ExtismError::msg(format!("No provider found for package '{}'", req.name)))
    })?;

    Ok(result)
});

// Get dependencies for a package. Requires: pkg_search permission.
// Input: JSON { "name": "express", "version": "4.18.0", "provider": "npm" | null }
// Output: JSON array of Dependency
host_fn!(pub cognia_pkg_dependencies(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct DepsInput { name: String, version: String, provider: Option<String> }

    let req: DepsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        let registry = ctx.registry.read().await;

        if let Some(provider_id) = &req.provider {
            if let Some(provider) = registry.get(provider_id) {
                let deps = provider.get_dependencies(&req.name, &req.version).await
                    .map_err(|e| ExtismError::msg(e.to_string()))?;
                return Ok(serde_json::to_string(&deps)
                    .map_err(|e| ExtismError::msg(e.to_string()))?);
            }
        }

        Err(ExtismError::msg(format!("No provider found for package '{}'", req.name)))
    })?;

    Ok(result)
});

// Check updates for packages. Requires: pkg_search permission.
// Input: JSON { "packages": ["express", "lodash"], "provider": "npm" }
// Output: JSON array of UpdateInfo
host_fn!(pub cognia_pkg_check_updates(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct UpdatesInput { packages: Vec<String>, provider: String }

    let req: UpdatesInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        let registry = ctx.registry.read().await;

        if let Some(provider) = registry.get(&req.provider) {
            let updates = provider.check_updates(&req.packages).await
                .map_err(|e| ExtismError::msg(e.to_string()))?;
            return Ok(serde_json::to_string(&updates)
                .map_err(|e| ExtismError::msg(e.to_string()))?);
        }

        Err(ExtismError::msg(format!("Provider '{}' not found", req.provider)))
    })?;

    Ok(result)
});

// --- Environment Management (extended) ---

// Get current version of an environment. Requires: env_read permission.
// Input: JSON { "envType": "node" | "python" | ... }
// Output: JSON { "version": "18.0.0" | null }
host_fn!(pub cognia_env_get_current(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct EnvInput { env_type: String }

    let req: EnvInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "env_read")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        for env_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(env_id) {
                if env_id.contains(&req.env_type) || provider.version_file_name().contains(&req.env_type) {
                    let version = provider.get_current_version().await.ok().flatten();
                    return Ok::<_, ExtismError>(serde_json::json!({ "version": version }).to_string());
                }
            }
        }

        Ok(serde_json::json!({ "version": Option::<String>::None }).to_string())
    })?;

    Ok(result)
});

// List installed versions of an environment. Requires: env_read permission.
// Input: JSON { "envType": "node" | "python" | ... }
// Output: JSON array of { version, current }
host_fn!(pub cognia_env_list_versions(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct EnvInput { env_type: String }

    let req: EnvInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "env_read")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        for env_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(env_id) {
                if env_id.contains(&req.env_type) || provider.version_file_name().contains(&req.env_type) {
                    let installed = provider.list_installed_versions().await.unwrap_or_default();
                    let current = provider.get_current_version().await.ok().flatten();

                    #[derive(Serialize)]
                    struct VersionEntry { version: String, current: bool }

                    let entries: Vec<VersionEntry> = installed.into_iter().map(|v| {
                        let is_current = current.as_deref() == Some(&v.version);
                        VersionEntry { version: v.version, current: is_current }
                    }).collect();

                    return Ok::<_, ExtismError>(serde_json::to_string(&entries)
                        .map_err(|e| ExtismError::msg(e.to_string()))?);
                }
            }
        }

        Ok("[]".to_string())
    })?;

    Ok(result)
});

// Install a specific environment version. Requires: pkg_install permission.
// Input: JSON { "envType": "node", "version": "20.0.0" }
// Output: JSON { "ok": true }
host_fn!(pub cognia_env_install_version(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct InstallEnvInput { env_type: String, version: String }

    let req: InstallEnvInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_install")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        for env_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(env_id) {
                if env_id.contains(&req.env_type) || provider.version_file_name().contains(&req.env_type) {
                    // Use Provider::install() to install a specific version
                    let install_req = crate::provider::InstallRequest {
                        name: req.version.clone(),
                        version: Some(req.version.clone()),
                        force: false,
                        global: true,
                    };
                    provider.install(install_req).await
                        .map_err(|e| ExtismError::msg(e.to_string()))?;
                    return Ok::<_, ExtismError>(());
                }
            }
        }

        Err(ExtismError::msg(format!("No environment provider found for '{}'", req.env_type)))
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// Switch to a specific environment version. Requires: pkg_install permission.
// Input: JSON { "envType": "node", "version": "20.0.0" }
// Output: JSON { "ok": true }
host_fn!(pub cognia_env_set_version(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SetVersionInput { env_type: String, version: String }

    let req: SetVersionInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_install")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        for env_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(env_id) {
                if env_id.contains(&req.env_type) || provider.version_file_name().contains(&req.env_type) {
                    provider.set_global_version(&req.version).await
                        .map_err(|e| ExtismError::msg(e.to_string()))?;
                    return Ok::<_, ExtismError>(());
                }
            }
        }

        Err(ExtismError::msg(format!("No environment provider found for '{}'", req.env_type)))
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// --- Process Execution ---

// Execute a direct process command. Requires: process_exec permission (dangerous).
// Input: JSON { "command": "node", "args": ["--version"], "cwd": null }
// Output: JSON { "exitCode": 0, "stdout": "...", "stderr": "...", "success": true }
host_fn!(pub cognia_process_exec(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let req: ProcessExecInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        ensure_process_exec_permission(&ctx).await?;

        let args = req.args.iter().map(String::as_str).collect::<Vec<_>>();
        let output = process::execute(
            &req.command,
            &args,
            Some(build_plugin_process_options(
                req.cwd,
                req.env,
                req.timeout_ms,
                req.capture_output,
            )),
        )
        .await
        .map_err(map_process_error)?;

        serialize_process_output(output)
    })?;

    Ok(result)
});

// Execute a shell command. Requires: process_exec permission (dangerous).
// Input: JSON { "command": "echo hello", "cwd": null }
// Output: JSON { "exitCode": 0, "stdout": "...", "stderr": "...", "success": true }
host_fn!(pub cognia_process_exec_shell(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let req: ProcessShellInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        ensure_process_exec_permission(&ctx).await?;

        let output = process::execute_shell(
            &req.command,
            Some(build_plugin_process_options(
                req.cwd,
                req.env,
                req.timeout_ms,
                req.capture_output,
            )),
        )
        .await
        .map_err(map_process_error)?;

        serialize_process_output(output)
    })?;

    Ok(result)
});

// Resolve a program on the host PATH. Requires: process_exec permission (dangerous).
// Input: JSON { "command": "node" }
// Output: JSON { "path": "..." } or { "path": null }
host_fn!(pub cognia_process_which(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let req: ProcessLookupInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        ensure_process_exec_permission(&ctx).await?;
        let path = process::which(&req.command).await;
        serialize_process_lookup(path)
    })?;

    Ok(result)
});

// Probe program availability on the host PATH. Requires: process_exec permission (dangerous).
// Input: JSON { "command": "node" }
// Output: JSON { "available": true }
host_fn!(pub cognia_process_is_available(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let req: ProcessLookupInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        ensure_process_exec_permission(&ctx).await?;
        let available = process::which(&req.command).await.is_some();
        serialize_process_availability(available)
    })?;

    Ok(result)
});

// --- Clipboard ---

// Read clipboard text. Requires: clipboard permission.
// Input: (empty string)
// Output: JSON { "text": "..." }
host_fn!(pub cognia_clipboard_read(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "clipboard")?;
        drop(perms);

        let text = tokio::task::spawn_blocking(|| {
            let mut clipboard = arboard::Clipboard::new()
                .map_err(|e| ExtismError::msg(format!("Failed to access clipboard: {}", e)))?;
            clipboard.get_text()
                .map_err(|e| ExtismError::msg(format!("Failed to read clipboard: {}", e)))
        }).await
            .map_err(|e| ExtismError::msg(format!("Clipboard task failed: {}", e)))??;

        Ok::<_, ExtismError>(serde_json::json!({ "text": text }).to_string())
    })?;

    Ok(result)
});

// Write text to clipboard. Requires: clipboard permission.
// Input: JSON { "text": "..." }
// Output: JSON { "ok": true }
host_fn!(pub cognia_clipboard_write(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct ClipInput { text: String }

    let req: ClipInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "clipboard")?;
        drop(perms);

        let text = req.text.clone();
        tokio::task::spawn_blocking(move || {
            let mut clipboard = arboard::Clipboard::new()
                .map_err(|e| ExtismError::msg(format!("Failed to access clipboard: {}", e)))?;
            clipboard.set_text(text)
                .map_err(|e| ExtismError::msg(format!("Failed to write clipboard: {}", e)))
        }).await
            .map_err(|e| ExtismError::msg(format!("Clipboard task failed: {}", e)))??;

        Ok::<_, ExtismError>(())
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// --- Notifications ---

// Send a system notification. Requires: notification permission.
// Input: JSON { "title": "...", "body": "..." }
// Output: JSON { "ok": true }
host_fn!(pub cognia_notification_send(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct NotifInput { title: String, body: String }

    let req: NotifInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "notification")?;
        drop(perms);

        // Use notify-rust for cross-platform notifications
        let title = req.title.clone();
        let body = req.body.clone();
        let pid = plugin_id.clone();
        tokio::task::spawn_blocking(move || {
            notify_rust::Notification::new()
                .summary(&format!("[{}] {}", pid, title))
                .body(&body)
                .appname("CogniaLauncher")
                .show()
                .map_err(|e| ExtismError::msg(format!("Failed to send notification: {}", e)))
        }).await
            .map_err(|e| ExtismError::msg(format!("Notification task failed: {}", e)))??;

        Ok::<_, ExtismError>(())
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// --- UI Host Effects ---

host_fn!(pub cognia_ui_get_context(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let settings = ctx.settings.read().await;
        let payload = build_ui_context_payload(&settings);
        serde_json::to_string(&payload).map_err(|error| ExtismError::msg(error.to_string()))
    })?;

    Ok(result)
});

#[cfg(not(test))]
host_fn!(pub cognia_ui_request(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let request: PluginUiRequestInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let function_name = require_current_function_name(&ctx).await?;
        let effect = normalize_ui_effect_name(&request.effect);
        let correlation_id = request.correlation_id.clone();

        match effect.as_str() {
            "toast" => {
                let perms = ctx.permissions.read().await;
                check_permission(&perms, &plugin_id, "ui_feedback")?;
                drop(perms);

                let message = request
                    .message
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .ok_or_else(|| ExtismError::msg("toast message is required"))?;

                ctx.push_emitted_ui_effect(EmittedPluginUiEffect {
                    plugin_id,
                    function_name,
                    effect: effect.clone(),
                    correlation_id: correlation_id.clone(),
                    payload: serde_json::json!({
                        "message": message,
                        "title": request.title,
                        "level": normalize_ui_level(request.level.as_deref()),
                    }),
                }).await;

                serialize_ui_result(&ui_result(&effect, "ok", correlation_id, None, None))
            }
            "navigate" => {
                let perms = ctx.permissions.read().await;
                check_permission(&perms, &plugin_id, "ui_navigation")?;
                drop(perms);

                let path = request
                    .path
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .ok_or_else(|| ExtismError::msg("navigate path is required"))?;

                if !path.starts_with('/') {
                    return serialize_ui_result(&ui_result(
                        &effect,
                        "error",
                        correlation_id,
                        Some("internal navigation paths must start with '/'".to_string()),
                        None,
                    ));
                }

                ctx.push_emitted_ui_effect(EmittedPluginUiEffect {
                    plugin_id,
                    function_name,
                    effect: effect.clone(),
                    correlation_id: correlation_id.clone(),
                    payload: serde_json::json!({ "path": path }),
                }).await;

                serialize_ui_result(&ui_result(&effect, "ok", correlation_id, None, None))
            }
            "confirm" => {
                let perms = ctx.permissions.read().await;
                check_permission(&perms, &plugin_id, "ui_dialog")?;
                drop(perms);

                let Some(app_handle) = ctx.app_handle().await else {
                    return serialize_ui_result(&ui_result(
                        &effect,
                        "unavailable",
                        correlation_id,
                        Some("desktop host is unavailable".to_string()),
                        None,
                    ));
                };

                let message = request
                    .message
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .ok_or_else(|| ExtismError::msg("confirm message is required"))?;
                let title = request.title.clone().unwrap_or_else(|| "CogniaLauncher".to_string());

                let confirmed = tokio::task::spawn_blocking(move || {
                    app_handle
                        .dialog()
                        .message(message)
                        .title(title)
                        .buttons(MessageDialogButtons::OkCancel)
                        .blocking_show()
                }).await
                    .map_err(|error| ExtismError::msg(format!("UI task failed: {}", error)))?;

                if confirmed {
                    serialize_ui_result(&ui_result(
                        &effect,
                        "ok",
                        correlation_id,
                        None,
                        Some(serde_json::json!({ "confirmed": true })),
                    ))
                } else {
                    serialize_ui_result(&ui_result(
                        &effect,
                        "cancelled",
                        correlation_id,
                        None,
                        Some(serde_json::json!({ "confirmed": false })),
                    ))
                }
            }
            "pick-file" => {
                let perms = ctx.permissions.read().await;
                check_permission(&perms, &plugin_id, "ui_file_picker")?;
                drop(perms);

                let Some(app_handle) = ctx.app_handle().await else {
                    return serialize_ui_result(&ui_result(
                        &effect,
                        "unavailable",
                        correlation_id,
                        Some("desktop host is unavailable".to_string()),
                        None,
                    ));
                };

                let request_clone = request.clone();
                let selected = tokio::task::spawn_blocking(move || {
                    let dialog = apply_file_dialog_options(app_handle.dialog().file(), &request_clone);
                    if request_clone.multiple.unwrap_or(false) {
                        dialog.blocking_pick_files().map(|paths| {
                            paths
                                .into_iter()
                                .filter_map(|path| path.into_path().ok())
                                .collect::<Vec<_>>()
                        })
                    } else {
                        dialog
                            .blocking_pick_file()
                            .and_then(|path| path.into_path().ok())
                            .map(|path| vec![path])
                    }
                }).await
                    .map_err(|error| ExtismError::msg(format!("UI task failed: {}", error)))?;

                match selected {
                    Some(paths) if !paths.is_empty() => serialize_ui_result(&ui_result(
                        &effect,
                        "ok",
                        correlation_id,
                        None,
                        Some(serde_json::json!({
                            "paths": paths.iter().map(|path| path_to_json_value(path)).collect::<Vec<_>>()
                        })),
                    )),
                    _ => serialize_ui_result(&ui_result(&effect, "cancelled", correlation_id, None, None)),
                }
            }
            "pick-directory" => {
                let perms = ctx.permissions.read().await;
                check_permission(&perms, &plugin_id, "ui_file_picker")?;
                drop(perms);

                let Some(app_handle) = ctx.app_handle().await else {
                    return serialize_ui_result(&ui_result(
                        &effect,
                        "unavailable",
                        correlation_id,
                        Some("desktop host is unavailable".to_string()),
                        None,
                    ));
                };

                let request_clone = request.clone();
                let selected = tokio::task::spawn_blocking(move || {
                    let dialog = apply_file_dialog_options(app_handle.dialog().file(), &request_clone);
                    dialog
                        .blocking_pick_folder()
                        .and_then(|path| path.into_path().ok())
                }).await
                    .map_err(|error| ExtismError::msg(format!("UI task failed: {}", error)))?;

                match selected {
                    Some(path) => serialize_ui_result(&ui_result(
                        &effect,
                        "ok",
                        correlation_id,
                        None,
                        Some(serde_json::json!({ "path": path_to_json_value(&path) })),
                    )),
                    None => serialize_ui_result(&ui_result(&effect, "cancelled", correlation_id, None, None)),
                }
            }
            "save-file" => {
                let perms = ctx.permissions.read().await;
                check_permission(&perms, &plugin_id, "ui_file_picker")?;
                drop(perms);

                let Some(app_handle) = ctx.app_handle().await else {
                    return serialize_ui_result(&ui_result(
                        &effect,
                        "unavailable",
                        correlation_id,
                        Some("desktop host is unavailable".to_string()),
                        None,
                    ));
                };

                let request_clone = request.clone();
                let selected = tokio::task::spawn_blocking(move || {
                    let dialog = apply_file_dialog_options(app_handle.dialog().file(), &request_clone);
                    dialog
                        .blocking_save_file()
                        .and_then(|path| path.into_path().ok())
                }).await
                    .map_err(|error| ExtismError::msg(format!("UI task failed: {}", error)))?;

                match selected {
                    Some(path) => serialize_ui_result(&ui_result(
                        &effect,
                        "ok",
                        correlation_id,
                        None,
                        Some(serde_json::json!({ "path": path_to_json_value(&path) })),
                    )),
                    None => serialize_ui_result(&ui_result(&effect, "cancelled", correlation_id, None, None)),
                }
            }
            "open-external" => {
                let perms = ctx.permissions.read().await;
                check_permission(&perms, &plugin_id, "ui_navigation")?;
                drop(perms);

                let url = request
                    .url
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .ok_or_else(|| ExtismError::msg("open-external url is required"))?;

                tokio::task::spawn_blocking(move || {
                    tauri_plugin_opener::open_url(&url, None::<&str>)
                        .map_err(|error| ExtismError::msg(format!("Failed to open URL: {}", error)))
                }).await
                    .map_err(|error| ExtismError::msg(format!("UI task failed: {}", error)))??;

                serialize_ui_result(&ui_result(&effect, "ok", correlation_id, None, None))
            }
            "reveal-path" => {
                let perms = ctx.permissions.read().await;
                check_permission(&perms, &plugin_id, "ui_navigation")?;
                drop(perms);

                let raw_path = request
                    .path
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .ok_or_else(|| ExtismError::msg("reveal-path path is required"))?;
                let path = PathBuf::from(raw_path);
                let reveal_target = if path.is_file() {
                    path.parent().map(Path::to_path_buf).unwrap_or(path)
                } else {
                    path
                };

                let path_string = reveal_target.display().to_string();
                tokio::task::spawn_blocking(move || {
                    tauri_plugin_opener::open_path(&path_string, None::<&str>)
                        .map_err(|error| ExtismError::msg(format!("Failed to reveal path: {}", error)))
                }).await
                    .map_err(|error| ExtismError::msg(format!("UI task failed: {}", error)))??;

                serialize_ui_result(&ui_result(
                    &effect,
                    "ok",
                    correlation_id,
                    None,
                    Some(serde_json::json!({ "path": reveal_target.display().to_string() })),
                ))
            }
            _ => serialize_ui_result(&ui_result(
                &effect,
                "error",
                correlation_id,
                Some(format!("unsupported UI effect '{}'", effect)),
                None,
            )),
        }
    })?;

    Ok(result)
});

#[cfg(test)]
host_fn!(pub cognia_ui_request(_user_data: HostContext; _input: String) -> String {
    serialize_ui_result(&ui_result(
        "ui-request",
        "unavailable",
        None,
        Some("ui dialog host effects are unavailable in unit tests".to_string()),
        None,
    ))
});

// --- HTTP (extended) ---

// Make an HTTP POST request. Requires: http permission + URL in allowed domains.
// Input: JSON { "url": "https://...", "body": "...", "contentType": "application/json" }
// Output: JSON { "status": 200, "body": "..." }
host_fn!(pub cognia_http_post(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct HttpPostInput {
        url: String,
        body: String,
        #[serde(default = "default_content_type")]
        content_type: String,
    }

    fn default_content_type() -> String { "application/json".to_string() }

    let req: HttpPostInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        perform_http_request(
            ctx.clone(),
            HttpRequestInput {
                url: req.url,
                method: "POST".to_string(),
                headers: HashMap::new(),
                body: Some(req.body),
                content_type: Some(req.content_type),
                timeout_ms: None,
            },
        ).await
    })?;

    Ok(result)
});

// Make a generic HTTP request. Requires: http permission + URL in allowed domains.
// Input: JSON { "url": "...", "method": "PATCH", "headers": { ... }, "body": "...", "contentType": "application/json", "timeoutMs": 3000 }
// Output: JSON { "status": 200, "body": "...", "headers": { ... } }
host_fn!(pub cognia_http_request(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let req: HttpRequestInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async { perform_http_request(ctx.clone(), req).await })?;

    Ok(result)
});

// --- File System (extended) ---

// List files in plugin data directory. Requires: fs_read permission.
// Input: JSON { "path": "relative/dir" }
// Output: JSON array of { name, isDir, size }
host_fn!(pub cognia_fs_list_dir(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        check_fs_access(&perms, &plugin_id, &full_path, false)?;
        drop(perms);

        let mut entries = tokio::fs::read_dir(&full_path).await
            .map_err(|e| ExtismError::msg(format!("Failed to read dir: {}", e)))?;

        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct DirEntry { name: String, is_dir: bool, size: u64 }

        let mut items = Vec::new();
        while let Ok(Some(entry)) = entries.next_entry().await {
            let meta = entry.metadata().await.ok();
            items.push(DirEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                is_dir: meta.as_ref().map_or(false, |m| m.is_dir()),
                size: meta.as_ref().map_or(0, |m| m.len()),
            });
        }

        Ok::<_, ExtismError>(serde_json::to_string(&items)
            .map_err(|e| ExtismError::msg(e.to_string()))?)
    })?;

    Ok(result)
});

// Delete a file in plugin data directory. Requires: fs_write permission.
// Input: JSON { "path": "relative/file.txt" }
// Output: JSON { "ok": true }
host_fn!(pub cognia_fs_delete(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        check_fs_access(&perms, &plugin_id, &full_path, true)?;
        drop(perms);

        let meta = tokio::fs::metadata(&full_path).await
            .map_err(|e| ExtismError::msg(format!("Path not found: {}", e)))?;

        if meta.is_dir() {
            tokio::fs::remove_dir_all(&full_path).await
                .map_err(|e| ExtismError::msg(format!("Failed to delete directory: {}", e)))?;
        } else {
            tokio::fs::remove_file(&full_path).await
                .map_err(|e| ExtismError::msg(format!("Failed to delete file: {}", e)))?;
        }

        Ok::<_, ExtismError>(())
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// Check if file exists in plugin data directory. Requires: fs_read permission.
// Input: JSON { "path": "relative/file.txt" }
// Output: JSON { "exists": true, "isDir": false }
host_fn!(pub cognia_fs_exists(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        check_fs_access(&perms, &plugin_id, &full_path, false)?;
        drop(perms);

        let exists = full_path.exists();
        let is_dir = full_path.is_dir();

        Ok::<_, ExtismError>(serde_json::json!({
            "exists": exists,
            "isDir": is_dir,
        }).to_string())
    })?;

    Ok(result)
});

// Create directory in plugin data directory. Requires: fs_write permission.
// Input: JSON { "path": "relative/dir" }
// Output: JSON { "ok": true }
host_fn!(pub cognia_fs_mkdir(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        check_fs_access(&perms, &plugin_id, &full_path, true)?;
        drop(perms);

        tokio::fs::create_dir_all(&full_path).await
            .map_err(|e| ExtismError::msg(format!("Failed to create directory: {}", e)))?;

        Ok::<_, ExtismError>(())
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// --- i18n (extended) ---

// Translate a key using the plugin's locale data. Always allowed.
// Input: JSON { "key": "greeting", "params": { "name": "World" } }
// Output: JSON { "text": "Hello, World!" }
// Falls back to: current locale -> "en" -> raw key
host_fn!(pub cognia_i18n_translate(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct TranslateInput {
        key: String,
        #[serde(default)]
        params: HashMap<String, String>,
    }

    let req: TranslateInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;

        // Get current locale from settings
        let settings = ctx.settings.read().await;
        let locale = settings.get_value("language").unwrap_or_else(|| "en".to_string());
        drop(settings);

        // Look up the key in plugin's locale data
        let plugin_reg = ctx.plugin_registry.read().await;
        let text = if let Some(plugin) = plugin_reg.get(&plugin_id) {
            let locales = &plugin.manifest.locales;
            // Try current locale, then fallback to "en", then raw key
            locales.get(&locale)
                .and_then(|m| m.get(&req.key))
                .or_else(|| locales.get("en").and_then(|m| m.get(&req.key)))
                .cloned()
                .unwrap_or_else(|| req.key.clone())
        } else {
            req.key.clone()
        };
        drop(plugin_reg);

        // Interpolate parameters: replace {param} with value
        let mut result = text;
        for (k, v) in &req.params {
            result = result.replace(&format!("{{{}}}", k), v);
        }

        Ok::<_, ExtismError>(serde_json::json!({ "text": result }).to_string())
    })?;

    Ok(result)
});

// Get all locale strings for the plugin's current locale. Always allowed.
// Input: (empty string)
// Output: JSON { "locale": "en", "strings": { "key": "value", ... } }
host_fn!(pub cognia_i18n_get_all(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;

        let settings = ctx.settings.read().await;
        let locale = settings.get_value("language").unwrap_or_else(|| "en".to_string());
        drop(settings);

        let plugin_reg = ctx.plugin_registry.read().await;
        let strings = if let Some(plugin) = plugin_reg.get(&plugin_id) {
            let locales = &plugin.manifest.locales;
            // Try current locale, fallback to "en", then empty
            locales.get(&locale)
                .or_else(|| locales.get("en"))
                .cloned()
                .unwrap_or_default()
        } else {
            HashMap::new()
        };
        drop(plugin_reg);

        Ok::<_, ExtismError>(serde_json::json!({
            "locale": locale,
            "strings": strings,
        }).to_string())
    })?;

    Ok(result)
});

// --- Events ---

// Emit an event from a plugin. Always allowed.
// Input: JSON { "name": "my-event", "payload": { ... } }
// Output: JSON { "ok": true }
host_fn!(pub cognia_event_emit(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    #[derive(Deserialize)]
    struct EventInput { name: String, payload: serde_json::Value }

    let req: EventInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = HostRuntimeBridge::capture()?;

    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        ctx.push_emitted_event(EmittedPluginEvent {
            source_plugin_id: plugin_id.clone(),
            event_name: req.name.clone(),
            payload: req.payload.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).await;
        log::info!("[plugin:{}] event_emit: {} payload={}", plugin_id, req.name, req.payload);
        Ok::<_, ExtismError>(())
    })?;

    Ok(r#"{"ok":true}"#.to_string())
});

// Get the plugin's own ID. Always allowed.
// Input: (empty string)
// Output: JSON { "pluginId": "com.example.my-plugin" }
host_fn!(pub cognia_get_plugin_id(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx
        .lock()
        .map_err(|_| log_boundary_error(None, "context", "failed to acquire host context lock"))?
        .clone();

    let rt = HostRuntimeBridge::capture()?;

    let result = rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        Ok::<_, ExtismError>(serde_json::json!({ "pluginId": plugin_id }).to_string())
    })?;

    Ok(result)
});

// ============================================================================
// Extended SDK v1.1 — Download Module
// ============================================================================

host_fn!(pub cognia_download_list(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_read")?;
        drop(perms);
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        let tasks = mgr.list_tasks().await;
        serialize_json(&tasks)
    })
});

host_fn!(pub cognia_download_get(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_read")?;
        drop(perms);
        let task_id = parsed
            .get("id")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'id'"))?;
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        let task = mgr.get_task(task_id).await;
        serialize_json(&task)
    })
});

host_fn!(pub cognia_download_stats(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_read")?;
        drop(perms);
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        let stats = mgr.stats().await;
        let payload = serde_json::json!({
            "active": stats.downloading,
            "queued": stats.queued,
            "completed": stats.completed,
            "failed": stats.failed,
            "totalSpeed": 0.0_f64,
        });
        serialize_json(&payload)
    })
});

host_fn!(pub cognia_download_history_list(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_read")?;
        drop(perms);
        // History is tracked via the download manager's completed tasks
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        let tasks = mgr.list_tasks().await;
        let limit = parsed.get("limit").and_then(|value| value.as_u64()).map(|value| value as usize);
        let offset = parsed.get("offset").and_then(|value| value.as_u64()).map(|value| value as usize).unwrap_or(0);
        let completed: Vec<_> = tasks.into_iter()
            .filter(|t| {
                matches!(
                    t.state,
                    crate::download::DownloadState::Completed
                        | crate::download::DownloadState::Cancelled
                        | crate::download::DownloadState::Failed { .. }
                )
            })
            .skip(offset)
            .take(limit.unwrap_or(usize::MAX))
            .map(|task| {
                let directory = task
                    .destination
                    .parent()
                    .map(|path| path.display().to_string())
                    .unwrap_or_default();
                serde_json::json!({
                    "id": task.id,
                    "url": task.url,
                    "filename": task.name,
                    "directory": directory,
                    "totalBytes": task.progress.total_bytes,
                    "status": task.state.status_text(),
                    "completedAt": task.completed_at.map(|value| value.to_rfc3339()),
                    "error": task.error,
                })
            })
            .collect();
        serialize_json(&completed)
    })
});

host_fn!(pub cognia_download_history_search(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_read")?;
        drop(perms);
        let query = parsed
            .get("query")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'query'"))?;
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        let tasks = mgr.list_tasks().await;
        let q = query.to_lowercase();
        let matched: Vec<_> = tasks.into_iter()
            .filter(|t| {
                t.name.to_lowercase().contains(&q) || t.url.to_lowercase().contains(&q)
            })
            .map(|task| {
                let directory = task
                    .destination
                    .parent()
                    .map(|path| path.display().to_string())
                    .unwrap_or_default();
                serde_json::json!({
                    "id": task.id,
                    "url": task.url,
                    "filename": task.name,
                    "directory": directory,
                    "totalBytes": task.progress.total_bytes,
                    "status": task.state.status_text(),
                    "completedAt": task.completed_at.map(|value| value.to_rfc3339()),
                    "error": task.error,
                })
            })
            .collect();
        serialize_json(&matched)
    })
});

host_fn!(pub cognia_download_history_stats(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_read")?;
        drop(perms);
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        let tasks = mgr.list_tasks().await;
        let total_downloads = tasks.len();
        let total_bytes = tasks
            .iter()
            .filter_map(|task| task.progress.total_bytes)
            .sum::<u64>();
        let success_count = tasks
            .iter()
            .filter(|task| matches!(task.state, crate::download::DownloadState::Completed))
            .count();
        let fail_count = tasks
            .iter()
            .filter(|task| matches!(task.state, crate::download::DownloadState::Failed { .. }))
            .count();
        let payload = serde_json::json!({
            "totalDownloads": total_downloads,
            "totalBytes": total_bytes,
            "successCount": success_count,
            "failCount": fail_count,
        });
        serialize_json(&payload)
    })
});

host_fn!(pub cognia_download_add(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_write")?;
        drop(perms);
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let url = parsed.get("url").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'url'"))?;
        let filename = parsed.get("filename").and_then(|v| v.as_str()).unwrap_or("");
        let directory = parsed.get("directory").and_then(|v| v.as_str()).unwrap_or("");
        let destination = if filename.is_empty() {
            PathBuf::from(url.rsplit('/').next().filter(|segment| !segment.is_empty()).unwrap_or("download"))
        } else if directory.is_empty() {
            PathBuf::from(filename)
        } else {
            PathBuf::from(directory).join(filename)
        };
        let name = if filename.is_empty() {
            destination
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("download")
                .to_string()
        } else {
            filename.to_string()
        };
        let mgr = dm.read().await;
        let id = mgr.download(url.to_string(), destination, name).await;
        serialize_json(&id)
    })
});

host_fn!(pub cognia_download_pause(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_write")?;
        drop(perms);
        let task_id = parsed
            .get("id")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'id'"))?;
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        mgr.pause(task_id).await.map_err(|e| ExtismError::msg(e.to_string()))?;
        Ok(r#"{"ok":true}"#.to_string())
    })
});

host_fn!(pub cognia_download_resume(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_write")?;
        drop(perms);
        let task_id = parsed
            .get("id")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'id'"))?;
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        mgr.resume(task_id).await.map_err(|e| ExtismError::msg(e.to_string()))?;
        Ok(r#"{"ok":true}"#.to_string())
    })
});

host_fn!(pub cognia_download_cancel(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_write")?;
        drop(perms);
        let task_id = parsed
            .get("id")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'id'"))?;
        let dm = ctx.download_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("download manager not available"))?;
        let mgr = dm.read().await;
        mgr.cancel(task_id).await.map_err(|e| ExtismError::msg(e.to_string()))?;
        Ok(r#"{"ok":true}"#.to_string())
    })
});

host_fn!(pub cognia_download_verify(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "download_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let expected = parsed.get("hash").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'hash'"))?;
        let algorithm = parsed.get("algorithm").and_then(|v| v.as_str()).unwrap_or("sha256");
        // Use std file hash verification
        use sha2::{Sha256, Digest};
        let data = tokio::fs::read(path).await
            .map_err(|e| ExtismError::msg(format!("Failed to read file: {}", e)))?;
        let actual = match algorithm {
            "sha256" | "SHA256" => {
                let mut hasher = Sha256::new();
                hasher.update(&data);
                format!("{:x}", hasher.finalize())
            }
            _ => return Err(ExtismError::msg(format!("Unsupported algorithm: {}", algorithm))),
        };
        let valid = actual.eq_ignore_ascii_case(expected);
        Ok(serde_json::json!({
            "valid": valid,
            "actualHash": actual,
            "expectedHash": expected,
            "algorithm": algorithm
        }).to_string())
    })
});

// ============================================================================
// Extended SDK v1.1 — Git Module
// ============================================================================

host_fn!(pub cognia_git_is_available(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let provider = crate::provider::git::GitProvider::new();
        let available = provider.is_available().await;
        serialize_json(&available)
    })
});

host_fn!(pub cognia_git_get_version(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let provider = crate::provider::git::GitProvider::new();
        let version = provider
            .get_git_version()
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?
            .unwrap_or_default();
        serialize_json(&version)
    })
});

host_fn!(pub cognia_git_get_repo_info(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let info = provider.get_repo_info(path).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&info)
    })
});

host_fn!(pub cognia_git_get_status(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let status = provider.get_status(path).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&status)
    })
});

host_fn!(pub cognia_git_get_branches(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let branches = provider.get_branches(path).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&branches)
    })
});

host_fn!(pub cognia_git_get_current_branch(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let info = provider.get_repo_info(path).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&info.current_branch)
    })
});

host_fn!(pub cognia_git_get_tags(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let tags = provider.get_tags(path).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&tags)
    })
});

host_fn!(pub cognia_git_get_log(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let limit = parsed
            .get("limit")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32)
            .unwrap_or(50);
        let skip = parsed
            .get("skip")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32)
            .unwrap_or(0);
        let author = parsed
            .get("author")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let since = parsed
            .get("since")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let until = parsed
            .get("until")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let file = parsed
            .get("file")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let provider = crate::provider::git::GitProvider::new();
        let log = provider
            .get_log(
                path,
                limit,
                skip,
                author.as_deref(),
                since.as_deref(),
                until.as_deref(),
                file.as_deref(),
            )
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serde_json::to_string(&log).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

host_fn!(pub cognia_git_get_commit_detail(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let hash = parsed.get("hash").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'hash'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let detail = provider.get_commit_detail(path, hash).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serde_json::to_string(&detail).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

host_fn!(pub cognia_git_get_blame(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let file = parsed.get("file").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'file'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let blame = provider.get_blame(path, file).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serde_json::to_string(&blame).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

host_fn!(pub cognia_git_get_diff(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let staged = parsed
            .get("staged")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let file = parsed.get("file").and_then(|v| v.as_str()).map(|s| s.to_string());
        let provider = crate::provider::git::GitProvider::new();
        let diff = provider
            .get_diff(path, staged, file.as_deref(), None)
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&diff)
    })
});

host_fn!(pub cognia_git_get_diff_between(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let from = parsed.get("from").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'from'"))?;
        let to = parsed.get("to").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'to'"))?;
        let file = parsed.get("file").and_then(|v| v.as_str()).map(|s| s.to_string());
        let provider = crate::provider::git::GitProvider::new();
        let diff = provider.get_diff_between(path, from, to, file.as_deref(), None).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&diff)
    })
});

host_fn!(pub cognia_git_get_remotes(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let remotes = provider.get_remotes(path).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&remotes)
    })
});

host_fn!(pub cognia_git_get_stashes(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let stashes = provider.get_stashes(path).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&stashes)
    })
});

host_fn!(pub cognia_git_get_contributors(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let provider = crate::provider::git::GitProvider::new();
        let contributors = provider.get_contributors(path).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&contributors)
    })
});

host_fn!(pub cognia_git_search_commits(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let query = parsed.get("query").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'query'"))?;
        let limit = parsed.get("limit").and_then(|v| v.as_u64()).map(|v| v as u32).unwrap_or(50);
        let search_type = parsed.get("searchType").and_then(|v| v.as_str()).unwrap_or("message");
        let skip = parsed.get("skip").and_then(|v| v.as_u64()).map(|v| v as u32).unwrap_or(0);
        let provider = crate::provider::git::GitProvider::new();
        let results = provider.search_commits(path, query, search_type, limit, skip).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&results)
    })
});

host_fn!(pub cognia_git_get_file_history(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let file = parsed.get("file").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'file'"))?;
        let limit = parsed.get("limit").and_then(|v| v.as_u64()).map(|v| v as u32).unwrap_or(50);
        let skip = parsed.get("skip").and_then(|v| v.as_u64()).map(|v| v as u32).unwrap_or(0);
        let provider = crate::provider::git::GitProvider::new();
        let history = provider.get_file_history(path, file, limit, skip).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&history)
    })
});

host_fn!(pub cognia_git_get_ahead_behind(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_read")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let branch = parsed.get("branch").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'branch'"))?;
        let upstream = parsed.get("upstream").and_then(|v| v.as_str()).map(|s| s.to_string());
        let provider = crate::provider::git::GitProvider::new();
        let ab = provider.get_ahead_behind(path, branch, upstream.as_deref()).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serde_json::to_string(&ab).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

host_fn!(pub cognia_git_stage_files(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_write")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let files: Vec<String> = parsed.get("files").and_then(|v| serde_json::from_value(v.clone()).ok())
            .ok_or_else(|| ExtismError::msg("Missing 'files' array"))?;
        let provider = crate::provider::git::GitProvider::new();
        let file_refs: Vec<&str> = files.iter().map(String::as_str).collect();
        provider
            .stage_files(path, &file_refs)
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        Ok(r#"{"ok":true}"#.to_string())
    })
});

host_fn!(pub cognia_git_commit(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "git_write")?;
        drop(perms);
        let path = parsed.get("path").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'path'"))?;
        let message = parsed.get("message").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'message'"))?;
        let amend = parsed.get("amend").and_then(|v| v.as_bool()).unwrap_or(false);
        let allow_empty = parsed.get("allowEmpty").and_then(|v| v.as_bool()).unwrap_or(false);
        let signoff = parsed.get("signoff").and_then(|v| v.as_bool()).unwrap_or(false);
        let no_verify = parsed.get("noVerify").and_then(|v| v.as_bool()).unwrap_or(false);
        let provider = crate::provider::git::GitProvider::new();
        let result = provider.commit(path, message, amend, allow_empty, signoff, no_verify).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&result)
    })
});

// ============================================================================
// Extended SDK v1.1 — Health Check Module
// ============================================================================

host_fn!(pub cognia_health_check_all(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "health_read")?;
        drop(perms);
        let manager = HealthCheckManager::new(ctx.registry.clone());
        let result = manager.check_all().await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serde_json::to_string(&result).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

host_fn!(pub cognia_health_check_environment(user_data: HostContext; env_type: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "health_read")?;
        drop(perms);
        let manager = HealthCheckManager::new(ctx.registry.clone());
        let result = manager.check_environment(&env_type).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serde_json::to_string(&result).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

host_fn!(pub cognia_health_check_package_managers(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "health_read")?;
        drop(perms);
        let manager = HealthCheckManager::new(ctx.registry.clone());
        let result = manager.check_package_managers().await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serde_json::to_string(&result).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

host_fn!(pub cognia_health_check_package_manager(user_data: HostContext; provider_id: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "health_read")?;
        drop(perms);
        let manager = HealthCheckManager::new(ctx.registry.clone());
        let result = manager.check_package_manager(&provider_id).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serde_json::to_string(&result).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

// ============================================================================
// Extended SDK v1.1 — Profiles Module
// ============================================================================

host_fn!(pub cognia_profile_list(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "profiles_read")?;
        drop(perms);
        let pm = ctx.profile_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("profile manager not available"))?;
        let mgr = pm.read().await;
        let profiles = mgr.list();
        serde_json::to_string(&profiles).map_err(|e| ExtismError::msg(e.to_string()))
    })
});

host_fn!(pub cognia_profile_get(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "profiles_read")?;
        drop(perms);
        let id = parsed.get("id").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'id'"))?;
        let pm = ctx.profile_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("profile manager not available"))?;
        let mgr = pm.read().await;
        let profile = mgr.get(id);
        serialize_json(&profile)
    })
});

host_fn!(pub cognia_profile_create_from_current(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "profiles_write")?;
        drop(perms);
        let name = parsed.get("name").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'name'"))?;
        let pm = ctx.profile_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("profile manager not available"))?;
        let mut mgr = pm.write().await;
        let profile = mgr.create_from_current(name, false, false).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&profile.id)
    })
});

host_fn!(pub cognia_profile_create(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "profiles_write")?;
        drop(perms);
        let pm = ctx.profile_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("profile manager not available"))?;
        let name = parsed.get("name").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'name'"))?;
        let description = parsed.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
        let environments: Vec<crate::core::profiles::ProfileEnvironment> =
            parsed.get("entries").and_then(|v| serde_json::from_value(v.clone()).ok())
                .ok_or_else(|| ExtismError::msg("Missing 'entries'"))?;
        let mut mgr = pm.write().await;
        let mut profile = EnvironmentProfile::new(name);
        if let Some(description) = description {
            profile = profile.with_description(description);
        }
        profile.environments = environments;
        let profile = mgr.create(profile).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&profile.id)
    })
});

host_fn!(pub cognia_profile_apply(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "profiles_write")?;
        drop(perms);
        let id = parsed.get("id").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'id'"))?;
        let pm = ctx.profile_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("profile manager not available"))?;
        let mgr = pm.write().await;
        mgr.apply(id)
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        Ok(r#"{"ok":true}"#.to_string())
    })
});

host_fn!(pub cognia_profile_export(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "profiles_read")?;
        drop(perms);
        let id = parsed.get("id").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'id'"))?;
        let pm = ctx.profile_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("profile manager not available"))?;
        let mgr = pm.read().await;
        let json = mgr.export(id)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&json)
    })
});

host_fn!(pub cognia_profile_import(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "profiles_write")?;
        drop(perms);
        let json = parsed.get("json").and_then(|v| v.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'json'"))?;
        let pm = ctx.profile_manager.as_ref()
            .ok_or_else(|| ExtismError::msg("profile manager not available"))?;
        let mut mgr = pm.write().await;
        let profile = mgr.import(json).await
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        serialize_json(&profile.id)
    })
});

// ============================================================================
// Extended SDK v1.1 — Cache Module (Extended)
// ============================================================================

host_fn!(pub cognia_cache_detail_info(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "cache_read")?;
        drop(perms);
        let settings = ctx.settings.read().await;
        let cache_dir = settings.get_cache_dir();
        let metadata_cache_ttl = settings.general.metadata_cache_ttl as i64;
        drop(settings);

        let download_cache = crate::cache::DownloadCache::open(&cache_dir)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let metadata_cache = crate::cache::MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let download_stats = download_cache
            .stats()
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let metadata_stats = metadata_cache
            .stats()
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let total_size = download_stats.total_size + metadata_stats.total_size;
        let entry_count = (download_stats.entry_count + metadata_stats.entry_count) as u32;

        serialize_json(&serde_json::json!({
            "cacheDir": cache_dir.display().to_string(),
            "totalSize": total_size,
            "totalSizeHuman": crate::platform::disk::format_size(total_size),
            "entryCount": entry_count,
        }))
    })
});

host_fn!(pub cognia_cache_list_entries(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "cache_read")?;
        drop(perms);
        let settings = ctx.settings.read().await;
        let cache_dir = settings.get_cache_dir();
        drop(settings);
        let entry_type = parsed
            .get("cacheType")
            .or_else(|| parsed.get("entryType"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_ascii_lowercase());
        let search = parsed.get("search").and_then(|v| v.as_str()).map(|s| s.to_string());
        let limit = parsed.get("limit").and_then(|v| v.as_u64()).map(|v| v as usize).unwrap_or(100);
        let offset = parsed.get("offset").and_then(|v| v.as_u64()).map(|v| v as usize).unwrap_or(0);
        let download_cache = crate::cache::DownloadCache::open(&cache_dir)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let entry_type_filter = match entry_type.as_deref() {
            Some("download") | Some("downloads") => Some(crate::cache::CacheEntryType::Download),
            Some("metadata") => Some(crate::cache::CacheEntryType::Metadata),
            Some("partial") | Some("partials") => Some(crate::cache::CacheEntryType::Partial),
            Some("index") => Some(crate::cache::CacheEntryType::Index),
            Some("all") | None => None,
            Some(other) => {
                return Err(ExtismError::msg(format!("Unsupported cache type '{}'", other)));
            }
        };
        let (entries, _total_count) = download_cache
            .list_filtered(entry_type_filter, search.as_deref(), None, limit, offset)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let payload: Vec<_> = entries
            .into_iter()
            .map(|entry| {
                let cache_type = match entry.entry_type {
                    crate::cache::CacheEntryType::Download => "download",
                    crate::cache::CacheEntryType::Metadata => "metadata",
                    crate::cache::CacheEntryType::Partial => "partial",
                    crate::cache::CacheEntryType::Index => "index",
                };
                serde_json::json!({
                    "key": entry.key,
                    "cacheType": cache_type,
                    "size": entry.size,
                    "sizeHuman": crate::platform::disk::format_size(entry.size),
                    "createdAt": entry.created_at.to_rfc3339(),
                    "lastAccessed": entry.last_accessed.map(|value| value.to_rfc3339()),
                    "accessCount": entry.hit_count,
                })
            })
            .collect();
        serialize_json(&payload)
    })
});

host_fn!(pub cognia_cache_get_access_stats(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "cache_read")?;
        drop(perms);
        let settings = ctx.settings.read().await;
        let cache_dir = settings.get_cache_dir();
        drop(settings);
        let download_cache = crate::cache::DownloadCache::open(&cache_dir)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let stats = download_cache.get_access_stats();
        serialize_json(&serde_json::json!({
            "hits": stats.hits,
            "misses": stats.misses,
            "hitRate": stats.hit_rate,
            "totalRequests": stats.total_requests,
        }))
    })
});

host_fn!(pub cognia_cache_get_cleanup_history(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "cache_read")?;
        drop(perms);
        let settings = ctx.settings.read().await;
        let cache_dir = settings.get_cache_dir();
        drop(settings);
        let limit = parsed.get("limit").and_then(|v| v.as_u64()).map(|v| v as usize);
        let history = crate::cache::CleanupHistory::open(&cache_dir)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let payload: Vec<_> = history
            .list(limit)
            .iter()
            .cloned()
            .map(|record| {
                serde_json::json!({
                    "cacheType": record.clean_type,
                    "bytesFreed": record.freed_bytes,
                    "entriesRemoved": record.file_count,
                    "cleanedAt": record.timestamp.to_rfc3339(),
                })
            })
            .collect();
        serialize_json(&payload)
    })
});

host_fn!(pub cognia_cache_discover_external(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "cache_read")?;
        drop(perms);
        let settings = ctx.settings.read().await;
        let excluded = settings.general.external_cache_excluded_providers.clone();
        let custom = settings.general.custom_cache_entries.clone();
        drop(settings);
        let caches = crate::cache::external::discover_all_caches_full_with_custom(&excluded, &custom)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let payload: Vec<_> = caches
            .into_iter()
            .map(|cache| {
                serde_json::json!({
                    "provider": cache.provider,
                    "displayName": cache.display_name,
                    "path": cache.cache_path,
                    "size": cache.size,
                    "sizeHuman": cache.size_human,
                    "available": cache.is_available,
                })
            })
            .collect();
        serialize_json(&payload)
    })
});

host_fn!(pub cognia_cache_get_external_paths(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "cache_read")?;
        drop(perms);
        let settings = ctx.settings.read().await;
        let excluded = settings.general.external_cache_excluded_providers.clone();
        let custom = settings.general.custom_cache_entries.clone();
        drop(settings);
        let paths = crate::cache::external::discover_all_caches_fast_with_custom(&excluded, &custom).await;
        let payload: Vec<_> = paths
            .into_iter()
            .map(|cache| {
                let path = cache.cache_path;
                let exists = !path.is_empty() && Path::new(&path).exists();
                serde_json::json!({
                    "provider": cache.provider,
                    "path": path,
                    "exists": exists,
                })
            })
            .collect();
        serialize_json(&payload)
    })
});

host_fn!(pub cognia_cache_clean_preview(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "cache_read")?;
        drop(perms);
        let settings = ctx.settings.read().await;
        let cache_dir = settings.get_cache_dir();
        let metadata_cache_ttl = settings.general.metadata_cache_ttl as i64;
        drop(settings);
        let clean_type = parsed
            .get("cacheType")
            .and_then(|v| v.as_str())
            .unwrap_or("all")
            .to_ascii_lowercase();
        let download_cache = crate::cache::DownloadCache::open(&cache_dir)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let metadata_cache = crate::cache::MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let (entries_to_remove, bytes_to_free) = match clean_type.as_str() {
            "download" | "downloads" => {
                let entries = download_cache
                    .preview_clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                let bytes = entries.iter().map(|entry| entry.size).sum::<u64>();
                (entries.len() as u32, bytes)
            }
            "metadata" => {
                let entries = metadata_cache
                    .preview_clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                let bytes = entries.iter().map(|entry| entry.size).sum::<u64>();
                (entries.len() as u32, bytes)
            }
            "all" => {
                let download_entries = download_cache
                    .preview_clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                let metadata_entries = metadata_cache
                    .preview_clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                let bytes = download_entries.iter().map(|entry| entry.size).sum::<u64>()
                    + metadata_entries.iter().map(|entry| entry.size).sum::<u64>();
                ((download_entries.len() + metadata_entries.len()) as u32, bytes)
            }
            other => return Err(ExtismError::msg(format!("Unsupported cache type '{}'", other))),
        };
        serialize_json(&serde_json::json!({
            "cacheType": clean_type,
            "entriesToRemove": entries_to_remove,
            "bytesToFree": bytes_to_free,
            "bytesToFreeHuman": crate::platform::disk::format_size(bytes_to_free),
        }))
    })
});

host_fn!(pub cognia_cache_clean(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "cache_write")?;
        drop(perms);
        let settings = ctx.settings.read().await;
        let cache_dir = settings.get_cache_dir();
        let metadata_cache_ttl = settings.general.metadata_cache_ttl as i64;
        drop(settings);
        let clean_type = parsed
            .get("cacheType")
            .and_then(|v| v.as_str())
            .unwrap_or("all")
            .to_ascii_lowercase();
        let mut download_cache = crate::cache::DownloadCache::open(&cache_dir)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let mut metadata_cache = crate::cache::MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl)
            .await
            .map_err(|error| ExtismError::msg(error.to_string()))?;
        let (entries_removed, bytes_freed) = match clean_type.as_str() {
            "download" | "downloads" => {
                let entries = download_cache
                    .preview_clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                let bytes = download_cache
                    .clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                (entries.len() as u32, bytes)
            }
            "metadata" => {
                let entries = metadata_cache
                    .preview_clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                let bytes = entries.iter().map(|entry| entry.size).sum::<u64>();
                metadata_cache
                    .clean_all()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                (entries.len() as u32, bytes)
            }
            "all" => {
                let download_entries = download_cache
                    .preview_clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                let metadata_entries = metadata_cache
                    .preview_clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                let metadata_bytes = metadata_entries.iter().map(|entry| entry.size).sum::<u64>();
                let download_bytes = download_cache
                    .clean()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                metadata_cache
                    .clean_all()
                    .await
                    .map_err(|error| ExtismError::msg(error.to_string()))?;
                (
                    (download_entries.len() + metadata_entries.len()) as u32,
                    download_bytes + metadata_bytes,
                )
            }
            other => return Err(ExtismError::msg(format!("Unsupported cache type '{}'", other))),
        };
        serialize_json(&serde_json::json!({
            "cacheType": clean_type,
            "entriesRemoved": entries_removed,
            "bytesFreed": bytes_freed,
            "bytesFreedHuman": crate::platform::disk::format_size(bytes_freed),
            "success": true,
        }))
    })
});

// ============================================================================
// Extended SDK v1.1 — Shell Module
// ============================================================================

host_fn!(pub cognia_shell_detect_shells(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "shell_read")?;
        drop(perms);

        let shells = crate::core::terminal::detect_installed_shells()
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let mapped: Vec<serde_json::Value> = shells
            .into_iter()
            .map(|shell| {
                serde_json::json!({
                    "name": shell.id,
                    "path": shell.executable_path,
                    "version": shell.version,
                    "isDefault": shell.is_default,
                })
            })
            .collect();

        serialize_json(&mapped)
    })
});

host_fn!(pub cognia_shell_list_profiles(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "shell_read")?;
        drop(perms);

        let root_dir = ctx.settings.read().await.get_root_dir();
        let manager = crate::core::terminal::TerminalProfileManager::new(&root_dir)
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let mapped: Vec<serde_json::Value> = manager
            .list_profiles()
            .iter()
            .map(|profile| {
                serde_json::json!({
                    "id": profile.id,
                    "name": profile.name,
                    "shell": profile.shell_id,
                    "args": profile.args,
                    "env": profile.env_vars,
                    "cwd": profile.cwd,
                    "isDefault": profile.is_default,
                })
            })
            .collect();

        serialize_json(&mapped)
    })
});

host_fn!(pub cognia_shell_get_default_profile(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "shell_read")?;
        drop(perms);

        let root_dir = ctx.settings.read().await.get_root_dir();
        let manager = crate::core::terminal::TerminalProfileManager::new(&root_dir)
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let profile = manager.get_default_profile().map(|value| {
            serde_json::json!({
                "id": value.id,
                "name": value.name,
                "shell": value.shell_id,
                "args": value.args,
                "env": value.env_vars,
                "cwd": value.cwd,
                "isDefault": value.is_default,
            })
        });

        serialize_json(&profile)
    })
});

host_fn!(pub cognia_shell_get_profile(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "shell_read")?;
        drop(perms);

        let profile_id = parsed
            .get("id")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'id'"))?;

        let root_dir = ctx.settings.read().await.get_root_dir();
        let manager = crate::core::terminal::TerminalProfileManager::new(&root_dir)
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let profile = manager.get_profile(profile_id).map(|value| {
            serde_json::json!({
                "id": value.id,
                "name": value.name,
                "shell": value.shell_id,
                "args": value.args,
                "env": value.env_vars,
                "cwd": value.cwd,
                "isDefault": value.is_default,
            })
        });

        serialize_json(&profile)
    })
});

host_fn!(pub cognia_shell_get_info(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "shell_read")?;
        drop(perms);

        let shell_name = parsed
            .get("shell")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'shell'"))?;

        let shells = crate::core::terminal::detect_installed_shells()
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let shell = shells
            .into_iter()
            .find(|entry| {
                entry.id.eq_ignore_ascii_case(shell_name) || entry.name.eq_ignore_ascii_case(shell_name)
            })
            .ok_or_else(|| ExtismError::msg(format!("Shell '{}' not found", shell_name)))?;

        let config_files: Vec<String> = shell
            .config_files
            .iter()
            .map(|file| file.path.clone())
            .collect();
        let features = vec![shell.shell_type.id().to_string()];

        serialize_json(&serde_json::json!({
            "name": shell.id,
            "version": shell.version,
            "path": shell.executable_path,
            "configFiles": config_files,
            "features": features,
        }))
    })
});

host_fn!(pub cognia_shell_get_env_vars(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "shell_read")?;
        drop(perms);

        let pairs = crate::commands::terminal::terminal_get_shell_env_vars()
            .await
            .map_err(ExtismError::msg)?;
        let vars: HashMap<String, String> = pairs
            .into_iter()
            .map(|entry| (entry.key, entry.value.display_value))
            .collect();
        serialize_json(&vars)
    })
});

host_fn!(pub cognia_shell_check_health(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "shell_read")?;
        drop(perms);

        let requested_shell = parsed
            .get("shell")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string());

        let shells = crate::core::terminal::detect_installed_shells()
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let selected = if let Some(shell_name) = requested_shell {
            shells
                .into_iter()
                .find(|entry| {
                    entry.id.eq_ignore_ascii_case(&shell_name)
                        || entry.name.eq_ignore_ascii_case(&shell_name)
                })
                .ok_or_else(|| ExtismError::msg(format!("Shell '{}' not found", shell_name)))?
        } else {
            match shells
                .iter()
                .find(|entry| entry.is_default)
                .cloned()
                .or_else(|| shells.first().cloned())
            {
                Some(shell) => shell,
                None => {
                    return serialize_json(&serde_json::json!({
                        "shell": "unknown",
                        "healthy": false,
                        "issues": ["No shells detected"],
                        "startupTime": serde_json::Value::Null,
                    }))
                }
            }
        };

        let health = crate::core::terminal::check_shell_health(&selected).await;
        let issues: Vec<String> = health
            .issues
            .into_iter()
            .map(|issue| issue.message)
            .collect();
        let healthy = matches!(health.status, crate::core::health_check::HealthStatus::Healthy);

        serialize_json(&serde_json::json!({
            "shell": selected.id,
            "healthy": healthy,
            "issues": issues,
            "startupTime": serde_json::Value::Null,
        }))
    })
});

host_fn!(pub cognia_shell_detect_framework(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "shell_read")?;
        drop(perms);

        let requested_shell = parsed
            .get("shell")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'shell'"))?;

        let shell_type = if let Some(kind) =
            crate::platform::env::ShellType::from_id(&requested_shell.to_ascii_lowercase())
        {
            kind
        } else {
            let shells = crate::core::terminal::detect_installed_shells()
                .await
                .map_err(|e| ExtismError::msg(e.to_string()))?;
            shells
                .into_iter()
                .find(|entry| {
                    entry.id.eq_ignore_ascii_case(requested_shell)
                        || entry.name.eq_ignore_ascii_case(requested_shell)
                })
                .map(|entry| entry.shell_type)
                .ok_or_else(|| ExtismError::msg(format!("Shell '{}' not found", requested_shell)))?
        };

        let framework = crate::core::terminal::detect_shell_framework(shell_type)
            .await
            .into_iter()
            .next()
            .map(|entry| {
                serde_json::json!({
                    "name": entry.name,
                    "version": entry.version,
                    "shell": shell_type.id(),
                    "configDir": entry.config_path,
                })
            });

        serialize_json(&framework)
    })
});

// ============================================================================
// Extended SDK v1.1 — WSL Module
// ============================================================================

host_fn!(pub cognia_wsl_is_available(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        drop(perms);
        let available = crate::commands::wsl::wsl_is_available()
            .await
            .map_err(ExtismError::msg)?;
        serialize_json(&available)
    })
});

host_fn!(pub cognia_wsl_status(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        drop(perms);

        let available = crate::commands::wsl::wsl_is_available()
            .await
            .unwrap_or(false);
        let status = crate::commands::wsl::wsl_status()
            .await
            .map_err(ExtismError::msg)?;

        let wsl_version = if status.version.trim().is_empty() || status.version == "Unknown" {
            None
        } else {
            Some(status.version)
        };

        serialize_json(&serde_json::json!({
            "available": available,
            "wslVersion": wsl_version,
            "kernelVersion": status.kernel_version,
            "defaultDistro": status.default_distribution,
        }))
    })
});

host_fn!(pub cognia_wsl_get_version_info(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        drop(perms);

        let version = crate::commands::wsl::wsl_get_version_info()
            .await
            .map_err(ExtismError::msg)?;

        serialize_json(&serde_json::json!({
            "wslVersion": version.wsl_version.unwrap_or_default(),
            "kernelVersion": version.kernel_version.unwrap_or_default(),
            "wslgVersion": version.wslg_version,
        }))
    })
});

host_fn!(pub cognia_wsl_list_distros(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        drop(perms);

        let distros = crate::commands::wsl::wsl_list_distros()
            .await
            .map_err(ExtismError::msg)?;

        let mapped: Vec<serde_json::Value> = distros
            .into_iter()
            .map(|distro| {
                serde_json::json!({
                    "name": distro.name,
                    "state": distro.state,
                    "version": distro.wsl_version.parse::<u32>().unwrap_or(0),
                    "isDefault": distro.is_default,
                })
            })
            .collect();

        serialize_json(&mapped)
    })
});

host_fn!(pub cognia_wsl_list_running(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        drop(perms);

        let running = crate::commands::wsl::wsl_list_running()
            .await
            .map_err(ExtismError::msg)?;
        let distros = crate::commands::wsl::wsl_list_distros()
            .await
            .unwrap_or_default();

        let mapped: Vec<serde_json::Value> = running
            .into_iter()
            .map(|name| {
                if let Some(details) = distros
                    .iter()
                    .find(|entry| entry.name.eq_ignore_ascii_case(&name))
                {
                    serde_json::json!({
                        "name": details.name,
                        "state": details.state,
                        "version": details.wsl_version.parse::<u32>().unwrap_or(0),
                        "isDefault": details.is_default,
                    })
                } else {
                    serde_json::json!({
                        "name": name,
                        "state": "Running",
                        "version": 0,
                        "isDefault": false,
                    })
                }
            })
            .collect();

        serialize_json(&mapped)
    })
});

host_fn!(pub cognia_wsl_list_online(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        drop(perms);

        let distros = crate::commands::wsl::wsl_list_online()
            .await
            .map_err(ExtismError::msg)?;
        let mapped: Vec<serde_json::Value> = distros
            .into_iter()
            .map(|(name, friendly_name)| {
                serde_json::json!({
                    "name": name,
                    "friendlyName": friendly_name,
                })
            })
            .collect();

        serialize_json(&mapped)
    })
});

host_fn!(pub cognia_wsl_get_ip(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        drop(perms);

        let distro = parsed
            .get("distro")
            .and_then(|value| value.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let ip = crate::commands::wsl::wsl_get_ip(distro)
            .await
            .map_err(ExtismError::msg)?;
        let ip = if ip.trim().is_empty() { None } else { Some(ip) };
        serialize_json(&ip)
    })
});

host_fn!(pub cognia_wsl_disk_usage(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        drop(perms);

        let distro = parsed
            .get("distro")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'distro'"))?;
        let usage = crate::commands::wsl::wsl_disk_usage(distro.to_string())
            .await
            .map_err(ExtismError::msg)?;
        let size_bytes = usage.used_bytes;
        let size_human = crate::platform::disk::format_size(size_bytes);

        serialize_json(&serde_json::json!({
            "distro": distro,
            "sizeBytes": size_bytes,
            "sizeHuman": size_human,
        }))
    })
});

host_fn!(pub cognia_wsl_exec(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let parsed: serde_json::Value = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "wsl_read")?;
        check_permission(&perms, &plugin_id, "process_exec")?;
        drop(perms);

        let distro = parsed
            .get("distro")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'distro'"))?;
        let command = parsed
            .get("command")
            .and_then(|value| value.as_str())
            .ok_or_else(|| ExtismError::msg("Missing 'command'"))?;
        let user = parsed
            .get("user")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string());

        let result = crate::commands::wsl::wsl_exec(distro.to_string(), command.to_string(), user)
            .await
            .map_err(ExtismError::msg)?;

        serialize_json(&serde_json::json!({
            "exitCode": result.exit_code,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.exit_code == 0,
        }))
    })
});

// ============================================================================
// Extended SDK v1.1 — Batch Module
// ============================================================================

host_fn!(pub cognia_batch_install(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct BatchInstallInput {
        #[serde(default)]
        items: Vec<BatchItemInput>,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct BatchItemInput {
        name: String,
        #[serde(default)]
        version: Option<String>,
        #[serde(default)]
        provider: Option<String>,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: BatchInstallInput = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_install")?;
        drop(perms);

        let specs: Vec<String> = req
            .items
            .iter()
            .map(|item| {
                let mut spec = String::new();
                if let Some(provider) = item.provider.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
                    spec.push_str(provider);
                    spec.push(':');
                }
                spec.push_str(item.name.trim());
                if let Some(version) = item.version.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
                    spec.push('@');
                    spec.push_str(version);
                }
                spec
            })
            .collect();

        let provider_lookup: HashMap<String, String> = req
            .items
            .iter()
            .map(|item| {
                (
                    item.name.to_ascii_lowercase(),
                    item.provider.clone().unwrap_or_default(),
                )
            })
            .collect();

        let settings = ctx.settings.read().await.clone();
        let manager = crate::core::batch::BatchManager::new(ctx.registry.clone(), settings);
        let result = manager
            .batch_install(
                crate::core::batch::BatchInstallRequest {
                    packages: specs,
                    dry_run: false,
                    parallel: true,
                    force: false,
                    global: true,
                },
                |_| {},
            )
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let mut rows: Vec<serde_json::Value> = Vec::new();
        let succeeded_count = result.successful.len() + result.skipped.len();
        let failed_count = result.failed.len();

        for item in result.successful {
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": item.provider,
                "success": true,
                "error": serde_json::Value::Null,
            }));
        }

        for item in result.skipped {
            let provider = provider_lookup
                .get(&item.name.to_ascii_lowercase())
                .cloned()
                .unwrap_or_default();
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": provider,
                "success": true,
                "error": format!("Skipped: {}", item.reason),
            }));
        }

        for item in result.failed {
            let provider = provider_lookup
                .get(&item.name.to_ascii_lowercase())
                .cloned()
                .unwrap_or_default();
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": provider,
                "success": false,
                "error": item.error,
            }));
        }

        serialize_json(&serde_json::json!({
            "total": (succeeded_count + failed_count) as u32,
            "succeeded": succeeded_count as u32,
            "failed": failed_count as u32,
            "results": rows,
        }))
    })
});

host_fn!(pub cognia_batch_uninstall(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct BatchUninstallInput {
        #[serde(default)]
        items: Vec<BatchItemInput>,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct BatchItemInput {
        name: String,
        #[serde(default)]
        version: Option<String>,
        #[serde(default)]
        provider: Option<String>,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: BatchUninstallInput = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_install")?;
        drop(perms);

        let specs: Vec<String> = req
            .items
            .iter()
            .map(|item| {
                let mut spec = String::new();
                if let Some(provider) = item.provider.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
                    spec.push_str(provider);
                    spec.push(':');
                }
                spec.push_str(item.name.trim());
                if let Some(version) = item.version.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
                    spec.push('@');
                    spec.push_str(version);
                }
                spec
            })
            .collect();

        let provider_lookup: HashMap<String, String> = req
            .items
            .iter()
            .map(|item| {
                (
                    item.name.to_ascii_lowercase(),
                    item.provider.clone().unwrap_or_default(),
                )
            })
            .collect();

        let settings = ctx.settings.read().await.clone();
        let manager = crate::core::batch::BatchManager::new(ctx.registry.clone(), settings);
        let result = manager
            .batch_uninstall(specs, false, |_| {})
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let mut rows: Vec<serde_json::Value> = Vec::new();
        let succeeded_count = result.successful.len() + result.skipped.len();
        let failed_count = result.failed.len();

        for item in result.successful {
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": item.provider,
                "success": true,
                "error": serde_json::Value::Null,
            }));
        }

        for item in result.skipped {
            let provider = provider_lookup
                .get(&item.name.to_ascii_lowercase())
                .cloned()
                .unwrap_or_default();
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": provider,
                "success": true,
                "error": format!("Skipped: {}", item.reason),
            }));
        }

        for item in result.failed {
            let provider = provider_lookup
                .get(&item.name.to_ascii_lowercase())
                .cloned()
                .unwrap_or_default();
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": provider,
                "success": false,
                "error": item.error,
            }));
        }

        serialize_json(&serde_json::json!({
            "total": (succeeded_count + failed_count) as u32,
            "succeeded": succeeded_count as u32,
            "failed": failed_count as u32,
            "results": rows,
        }))
    })
});

host_fn!(pub cognia_batch_update(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct BatchUpdateInput {
        #[serde(default)]
        items: Vec<BatchItemInput>,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct BatchItemInput {
        name: String,
        #[serde(default)]
        version: Option<String>,
        #[serde(default)]
        provider: Option<String>,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: BatchUpdateInput = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_install")?;
        drop(perms);

        let specs: Vec<String> = req
            .items
            .iter()
            .map(|item| {
                let mut spec = String::new();
                if let Some(provider) = item.provider.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
                    spec.push_str(provider);
                    spec.push(':');
                }
                spec.push_str(item.name.trim());
                if let Some(version) = item.version.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
                    spec.push('@');
                    spec.push_str(version);
                }
                spec
            })
            .collect();

        let provider_lookup: HashMap<String, String> = req
            .items
            .iter()
            .map(|item| {
                (
                    item.name.to_ascii_lowercase(),
                    item.provider.clone().unwrap_or_default(),
                )
            })
            .collect();

        let settings = ctx.settings.read().await.clone();
        let manager = crate::core::batch::BatchManager::new(ctx.registry.clone(), settings);
        let result = manager
            .batch_update(if specs.is_empty() { None } else { Some(specs) }, |_| {})
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let mut rows: Vec<serde_json::Value> = Vec::new();
        let succeeded_count = result.successful.len() + result.skipped.len();
        let failed_count = result.failed.len();

        for item in result.successful {
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": item.provider,
                "success": true,
                "error": serde_json::Value::Null,
            }));
        }

        for item in result.skipped {
            let provider = provider_lookup
                .get(&item.name.to_ascii_lowercase())
                .cloned()
                .unwrap_or_default();
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": provider,
                "success": true,
                "error": format!("Skipped: {}", item.reason),
            }));
        }

        for item in result.failed {
            let provider = provider_lookup
                .get(&item.name.to_ascii_lowercase())
                .cloned()
                .unwrap_or_default();
            rows.push(serde_json::json!({
                "name": item.name,
                "provider": provider,
                "success": false,
                "error": item.error,
            }));
        }

        serialize_json(&serde_json::json!({
            "total": (succeeded_count + failed_count) as u32,
            "succeeded": succeeded_count as u32,
            "failed": failed_count as u32,
            "results": rows,
        }))
    })
});

host_fn!(pub cognia_batch_check_updates(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct BatchUpdateCheckInput {
        #[serde(default)]
        packages: Vec<String>,
        #[serde(default)]
        provider: Option<String>,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: BatchUpdateCheckInput = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        if req.packages.is_empty() {
            return serialize_json(&Vec::<serde_json::Value>::new());
        }

        let registry = ctx.registry.read().await;
        let mut updates: Vec<crate::provider::UpdateInfo> = Vec::new();

        if let Some(provider_id) = req.provider.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
            let provider = registry
                .get(provider_id)
                .ok_or_else(|| ExtismError::msg(format!("Provider '{}' not found", provider_id)))?;
            updates = provider
                .check_updates(&req.packages)
                .await
                .map_err(|e| ExtismError::msg(e.to_string()))?;
        } else {
            for package in &req.packages {
                if let Some(provider) = registry
                    .find_for_package(package)
                    .await
                    .map_err(|e| ExtismError::msg(e.to_string()))?
                {
                    let query = vec![package.clone()];
                    if let Ok(found) = provider.check_updates(&query).await {
                        updates.extend(found);
                    }
                }
            }
        }

        let mapped: Vec<serde_json::Value> = updates
            .into_iter()
            .map(|update| {
                serde_json::json!({
                    "name": update.name,
                    "currentVersion": update.current_version,
                    "latestVersion": update.latest_version,
                })
            })
            .collect();

        serialize_json(&mapped)
    })
});

host_fn!(pub cognia_batch_get_history(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct BatchHistoryInput {
        #[serde(default)]
        limit: Option<u32>,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: BatchHistoryInput = serde_json::from_str(&input).unwrap_or_default();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        let history = crate::core::HistoryManager::get_history(req.limit.map(|value| value as usize))
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let mapped: Vec<serde_json::Value> = history
            .into_iter()
            .map(|entry| {
                serde_json::json!({
                    "name": entry.name,
                    "version": entry.version,
                    "provider": entry.provider,
                    "action": entry.action.to_string(),
                    "timestamp": entry.timestamp,
                    "success": entry.success,
                })
            })
            .collect();

        serialize_json(&mapped)
    })
});

host_fn!(pub cognia_batch_get_pinned(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "pkg_search")?;
        drop(perms);

        let settings = ctx.settings.read().await;
        let mut pinned: Vec<(String, Option<String>)> = settings
            .provider_settings
            .pinned_packages
            .iter()
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect();
        drop(settings);

        pinned.sort_by(|a, b| a.0.cmp(&b.0));
        let pinned_at = chrono::Utc::now().to_rfc3339();
        let mapped: Vec<serde_json::Value> = pinned
            .into_iter()
            .map(|(scoped_name, version)| {
                let (provider, name) = if let Some((provider, package)) = scoped_name.split_once(':')
                {
                    (provider.to_string(), package.to_string())
                } else {
                    (String::new(), scoped_name)
                };
                serde_json::json!({
                    "name": name,
                    "version": version.unwrap_or_else(|| "latest".to_string()),
                    "provider": provider,
                    "pinnedAt": pinned_at,
                })
            })
            .collect();

        serialize_json(&mapped)
    })
});

// ============================================================================
// Extended SDK v1.1 — Launch Module
// ============================================================================

host_fn!(pub cognia_launch_with_env(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LaunchWithEnvInput {
        command: Option<String>,
        program: Option<String>,
        #[serde(default)]
        args: Vec<String>,
        env_type: String,
        #[serde(default)]
        version: Option<String>,
        #[serde(default)]
        cwd: Option<String>,
        #[serde(default)]
        env: HashMap<String, String>,
        #[serde(default)]
        timeout_ms: Option<u64>,
        #[serde(default)]
        capture_output: Option<bool>,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: LaunchWithEnvInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "launch")?;
        check_permission(&perms, &plugin_id, "process_exec")?;
        drop(perms);

        let command = req
            .command
            .or(req.program)
            .ok_or_else(|| ExtismError::msg("Missing 'command'"))?;

        let env_type = req.env_type.clone();
        let resolved_version = if let Some(version) = req.version {
            version
        } else {
            let registry = ctx.registry.read().await;
            let mut detected: Option<String> = None;
            for env_id in registry.list_environment_providers() {
                if let Some(provider) = registry.get_environment_provider(env_id) {
                    if env_id.contains(&env_type) || provider.version_file_name().contains(&env_type)
                    {
                        detected = provider.get_current_version().await.ok().flatten();
                        if detected.is_some() {
                            break;
                        }
                    }
                }
            }
            detected.ok_or_else(|| ExtismError::msg(format!("No current {} version set", env_type)))?
        };

        let manager = crate::core::EnvironmentManager::new(ctx.registry.clone());
        let env_mods = manager
            .get_env_modifications(&env_type, &resolved_version, None)
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        let mut options = build_plugin_process_options(
            req.cwd,
            req.env,
            req.timeout_ms,
            req.capture_output,
        );

        for path in &env_mods.path_prepend {
            if let Some(path_str) = path.to_str() {
                let current_path = std::env::var("PATH").unwrap_or_default();
                let separator = if cfg!(windows) { ";" } else { ":" };
                options = options.with_env("PATH", format!("{}{}{}", path_str, separator, current_path));
            }
        }
        for (key, value) in &env_mods.set_variables {
            options = options.with_env(key, value);
        }

        let args = req.args.iter().map(String::as_str).collect::<Vec<_>>();
        let output = process::execute(&command, &args, Some(options))
            .await
            .map_err(map_process_error)?;
        serialize_process_output(output)
    })
});

host_fn!(pub cognia_launch_get_env_info(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LaunchEnvInfoInput {
        env_type: String,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: LaunchEnvInfoInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "env_read")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        let mut matched = false;
        let mut current_version: Option<String> = None;
        let mut available_versions: Vec<String> = Vec::new();

        for env_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(env_id) {
                if env_id.contains(&req.env_type) || provider.version_file_name().contains(&req.env_type)
                {
                    matched = true;
                    current_version = provider.get_current_version().await.ok().flatten();
                    available_versions = provider
                        .list_installed_versions()
                        .await
                        .unwrap_or_default()
                        .into_iter()
                        .map(|version| version.version)
                        .collect();
                    break;
                }
            }
        }
        drop(registry);

        if !matched {
            return Err(ExtismError::msg(format!(
                "No environment provider found for '{}'",
                req.env_type
            )));
        }

        let manager = crate::core::EnvironmentManager::new(ctx.registry.clone());
        let active_path = if let Some(version) = current_version.clone() {
            manager
                .get_env_modifications(&req.env_type, &version, None)
                .await
                .ok()
                .and_then(|mods| {
                    mods.path_prepend
                        .first()
                        .and_then(|path| path.to_str().map(|value| value.to_string()))
                })
        } else {
            None
        };

        serialize_json(&serde_json::json!({
            "envType": req.env_type,
            "currentVersion": current_version,
            "availableVersions": available_versions,
            "activePath": active_path,
        }))
    })
});

host_fn!(pub cognia_launch_which_program(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LaunchWhichInput {
        command: String,
        #[serde(default)]
        env_type: Option<String>,
        #[serde(default)]
        version: Option<String>,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: LaunchWhichInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "env_read")?;
        drop(perms);

        let env_type = if let Some(env_type) = req.env_type.as_deref() {
            env_type.to_string()
        } else {
            return serialize_json(&process::which(&req.command).await);
        };

        let resolved_version = if let Some(version) = req.version {
            Some(version)
        } else {
            let registry = ctx.registry.read().await;
            let mut detected: Option<String> = None;
            for env_id in registry.list_environment_providers() {
                if let Some(provider) = registry.get_environment_provider(env_id) {
                    if env_id.contains(&env_type) || provider.version_file_name().contains(&env_type)
                    {
                        detected = provider.get_current_version().await.ok().flatten();
                        if detected.is_some() {
                            break;
                        }
                    }
                }
            }
            detected
        };

        let resolved_version = if let Some(version) = resolved_version {
            version
        } else {
            return serialize_json(&Option::<String>::None);
        };

        let manager = crate::core::EnvironmentManager::new(ctx.registry.clone());
        let env_mods = manager
            .get_env_modifications(&env_type, &resolved_version, None)
            .await
            .map_err(|e| ExtismError::msg(e.to_string()))?;

        #[cfg(windows)]
        let extensions = vec!["", ".exe", ".cmd", ".bat"];
        #[cfg(not(windows))]
        let extensions = vec![""];

        for bin_path in &env_mods.path_prepend {
            for ext in &extensions {
                let full_path = bin_path.join(format!("{}{}", req.command, ext));
                if full_path.exists() {
                    let found = full_path.to_str().map(|value| value.to_string());
                    return serialize_json(&found);
                }
            }
        }

        serialize_json(&process::which(&req.command).await)
    })
});

host_fn!(pub cognia_launch_activate(user_data: HostContext; input: String) -> String {
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LaunchActivateInput {
        env_type: String,
        version: String,
    }

    let ctx = user_data.get()?;
    let ctx = ctx.lock().map_err(|_| log_boundary_error(None, "context", "lock failed"))?.clone();
    let req: LaunchActivateInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;
    let rt = HostRuntimeBridge::capture()?;
    rt.block_on(async {
        let plugin_id = require_current_plugin_id(&ctx).await?;
        let perms = ctx.permissions.read().await;
        check_permission(&perms, &plugin_id, "launch")?;
        drop(perms);

        let registry = ctx.registry.read().await;
        let mut matched = false;
        for env_id in registry.list_environment_providers() {
            if let Some(provider) = registry.get_environment_provider(env_id) {
                if env_id.contains(&req.env_type) || provider.version_file_name().contains(&req.env_type)
                {
                    provider
                        .set_global_version(&req.version)
                        .await
                        .map_err(|e| ExtismError::msg(e.to_string()))?;
                    matched = true;
                    break;
                }
            }
        }
        drop(registry);

        if !matched {
            return Err(ExtismError::msg(format!(
                "No environment provider found for '{}'",
                req.env_type
            )));
        }

        let manager = crate::core::EnvironmentManager::new(ctx.registry.clone());
        let activated_path = manager
            .get_env_modifications(&req.env_type, &req.version, None)
            .await
            .ok()
            .and_then(|mods| {
                mods.path_prepend
                    .first()
                    .and_then(|path| path.to_str().map(|value| value.to_string()))
            });

        serialize_json(&serde_json::json!({
            "success": true,
            "envType": req.env_type,
            "version": req.version,
            "activatedPath": activated_path,
            "error": serde_json::Value::Null,
        }))
    })
});

// ============================================================================
// Build all host functions into a Vec for Extism PluginBuilder
// ============================================================================

/// Create the UserData wrapper containing the HostContext
pub fn create_user_data(ctx: HostContext) -> UserData<HostContext> {
    UserData::new(ctx)
}

/// Get all host function definitions to register with Extism.
/// Returns (function_name, input_types, output_types, function_pointer, user_data)
pub fn build_host_functions(user_data: UserData<HostContext>) -> Vec<extism::Function> {
    vec![
        extism::Function::new(
            "cognia_config_get",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_config_get,
        ),
        extism::Function::new(
            "cognia_config_set",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_config_set,
        ),
        extism::Function::new(
            "cognia_env_list",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_env_list,
        ),
        extism::Function::new(
            "cognia_provider_list",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_provider_list,
        ),
        extism::Function::new(
            "cognia_pkg_search",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_pkg_search,
        ),
        extism::Function::new(
            "cognia_fs_read",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_fs_read,
        ),
        extism::Function::new(
            "cognia_fs_write",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_fs_write,
        ),
        extism::Function::new(
            "cognia_http_get",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_http_get,
        ),
        extism::Function::new(
            "cognia_http_request",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_http_request,
        ),
        extism::Function::new(
            "cognia_get_locale",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_get_locale,
        ),
        extism::Function::new(
            "cognia_platform_info",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_platform_info,
        ),
        extism::Function::new(
            "cognia_env_detect",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_env_detect,
        ),
        extism::Function::new(
            "cognia_pkg_info",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_pkg_info,
        ),
        extism::Function::new(
            "cognia_pkg_list_installed",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_pkg_list_installed,
        ),
        extism::Function::new(
            "cognia_pkg_install",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_pkg_install,
        ),
        extism::Function::new(
            "cognia_cache_info",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_info,
        ),
        extism::Function::new(
            "cognia_log",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_log,
        ),
        // --- Extended Package Management ---
        extism::Function::new(
            "cognia_pkg_uninstall",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_pkg_uninstall,
        ),
        extism::Function::new(
            "cognia_pkg_versions",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_pkg_versions,
        ),
        extism::Function::new(
            "cognia_pkg_dependencies",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_pkg_dependencies,
        ),
        extism::Function::new(
            "cognia_pkg_check_updates",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_pkg_check_updates,
        ),
        // --- Extended Environment Management ---
        extism::Function::new(
            "cognia_env_get_current",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_env_get_current,
        ),
        extism::Function::new(
            "cognia_env_list_versions",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_env_list_versions,
        ),
        extism::Function::new(
            "cognia_env_install_version",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_env_install_version,
        ),
        extism::Function::new(
            "cognia_env_set_version",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_env_set_version,
        ),
        // --- Process Execution ---
        extism::Function::new(
            "cognia_process_exec",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_process_exec,
        ),
        extism::Function::new(
            "cognia_process_exec_shell",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_process_exec_shell,
        ),
        extism::Function::new(
            "cognia_process_which",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_process_which,
        ),
        extism::Function::new(
            "cognia_process_is_available",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_process_is_available,
        ),
        // --- Clipboard ---
        extism::Function::new(
            "cognia_clipboard_read",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_clipboard_read,
        ),
        extism::Function::new(
            "cognia_clipboard_write",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_clipboard_write,
        ),
        // --- Notifications ---
        extism::Function::new(
            "cognia_notification_send",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_notification_send,
        ),
        // --- UI Host Effects ---
        extism::Function::new(
            "cognia_ui_get_context",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_ui_get_context,
        ),
        extism::Function::new(
            "cognia_ui_request",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_ui_request,
        ),
        // --- HTTP POST ---
        extism::Function::new(
            "cognia_http_post",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_http_post,
        ),
        // --- Extended File System ---
        extism::Function::new(
            "cognia_fs_list_dir",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_fs_list_dir,
        ),
        extism::Function::new(
            "cognia_fs_delete",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_fs_delete,
        ),
        extism::Function::new(
            "cognia_fs_exists",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_fs_exists,
        ),
        extism::Function::new(
            "cognia_fs_mkdir",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_fs_mkdir,
        ),
        // --- i18n ---
        extism::Function::new(
            "cognia_i18n_translate",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_i18n_translate,
        ),
        extism::Function::new(
            "cognia_i18n_get_all",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_i18n_get_all,
        ),
        // --- Events & Meta ---
        extism::Function::new(
            "cognia_event_emit",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_event_emit,
        ),
        extism::Function::new(
            "cognia_get_plugin_id",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_get_plugin_id,
        ),
        // --- Download ---
        extism::Function::new(
            "cognia_download_list",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_list,
        ),
        extism::Function::new(
            "cognia_download_get",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_get,
        ),
        extism::Function::new(
            "cognia_download_stats",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_stats,
        ),
        extism::Function::new(
            "cognia_download_history_list",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_history_list,
        ),
        extism::Function::new(
            "cognia_download_history_search",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_history_search,
        ),
        extism::Function::new(
            "cognia_download_history_stats",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_history_stats,
        ),
        extism::Function::new(
            "cognia_download_add",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_add,
        ),
        extism::Function::new(
            "cognia_download_pause",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_pause,
        ),
        extism::Function::new(
            "cognia_download_resume",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_resume,
        ),
        extism::Function::new(
            "cognia_download_cancel",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_cancel,
        ),
        extism::Function::new(
            "cognia_download_verify",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_download_verify,
        ),
        // --- Git ---
        extism::Function::new(
            "cognia_git_is_available",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_is_available,
        ),
        extism::Function::new(
            "cognia_git_get_version",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_version,
        ),
        extism::Function::new(
            "cognia_git_get_repo_info",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_repo_info,
        ),
        extism::Function::new(
            "cognia_git_get_status",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_status,
        ),
        extism::Function::new(
            "cognia_git_get_branches",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_branches,
        ),
        extism::Function::new(
            "cognia_git_get_current_branch",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_current_branch,
        ),
        extism::Function::new(
            "cognia_git_get_tags",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_tags,
        ),
        extism::Function::new(
            "cognia_git_get_log",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_log,
        ),
        extism::Function::new(
            "cognia_git_get_commit_detail",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_commit_detail,
        ),
        extism::Function::new(
            "cognia_git_get_blame",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_blame,
        ),
        extism::Function::new(
            "cognia_git_get_diff",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_diff,
        ),
        extism::Function::new(
            "cognia_git_get_diff_between",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_diff_between,
        ),
        extism::Function::new(
            "cognia_git_get_remotes",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_remotes,
        ),
        extism::Function::new(
            "cognia_git_get_stashes",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_stashes,
        ),
        extism::Function::new(
            "cognia_git_get_contributors",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_contributors,
        ),
        extism::Function::new(
            "cognia_git_search_commits",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_search_commits,
        ),
        extism::Function::new(
            "cognia_git_get_file_history",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_file_history,
        ),
        extism::Function::new(
            "cognia_git_get_ahead_behind",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_get_ahead_behind,
        ),
        extism::Function::new(
            "cognia_git_stage_files",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_stage_files,
        ),
        extism::Function::new(
            "cognia_git_commit",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_git_commit,
        ),
        // --- Health Check ---
        extism::Function::new(
            "cognia_health_check_all",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_health_check_all,
        ),
        extism::Function::new(
            "cognia_health_check_environment",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_health_check_environment,
        ),
        extism::Function::new(
            "cognia_health_check_package_managers",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_health_check_package_managers,
        ),
        extism::Function::new(
            "cognia_health_check_package_manager",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_health_check_package_manager,
        ),
        // --- Profiles ---
        extism::Function::new(
            "cognia_profile_list",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_profile_list,
        ),
        extism::Function::new(
            "cognia_profile_get",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_profile_get,
        ),
        extism::Function::new(
            "cognia_profile_create_from_current",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_profile_create_from_current,
        ),
        extism::Function::new(
            "cognia_profile_create",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_profile_create,
        ),
        extism::Function::new(
            "cognia_profile_apply",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_profile_apply,
        ),
        extism::Function::new(
            "cognia_profile_export",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_profile_export,
        ),
        extism::Function::new(
            "cognia_profile_import",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_profile_import,
        ),
        // --- Cache (Extended) ---
        extism::Function::new(
            "cognia_cache_detail_info",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_detail_info,
        ),
        extism::Function::new(
            "cognia_cache_list_entries",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_list_entries,
        ),
        extism::Function::new(
            "cognia_cache_get_access_stats",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_get_access_stats,
        ),
        extism::Function::new(
            "cognia_cache_get_cleanup_history",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_get_cleanup_history,
        ),
        extism::Function::new(
            "cognia_cache_discover_external",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_discover_external,
        ),
        extism::Function::new(
            "cognia_cache_get_external_paths",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_get_external_paths,
        ),
        extism::Function::new(
            "cognia_cache_clean_preview",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_clean_preview,
        ),
        extism::Function::new(
            "cognia_cache_clean",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_cache_clean,
        ),
        // --- Shell ---
        extism::Function::new(
            "cognia_shell_detect_shells",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_shell_detect_shells,
        ),
        extism::Function::new(
            "cognia_shell_list_profiles",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_shell_list_profiles,
        ),
        extism::Function::new(
            "cognia_shell_get_default_profile",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_shell_get_default_profile,
        ),
        extism::Function::new(
            "cognia_shell_get_profile",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_shell_get_profile,
        ),
        extism::Function::new(
            "cognia_shell_get_info",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_shell_get_info,
        ),
        extism::Function::new(
            "cognia_shell_get_env_vars",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_shell_get_env_vars,
        ),
        extism::Function::new(
            "cognia_shell_check_health",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_shell_check_health,
        ),
        extism::Function::new(
            "cognia_shell_detect_framework",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_shell_detect_framework,
        ),
        // --- WSL ---
        extism::Function::new(
            "cognia_wsl_is_available",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_is_available,
        ),
        extism::Function::new(
            "cognia_wsl_status",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_status,
        ),
        extism::Function::new(
            "cognia_wsl_get_version_info",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_get_version_info,
        ),
        extism::Function::new(
            "cognia_wsl_list_distros",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_list_distros,
        ),
        extism::Function::new(
            "cognia_wsl_list_running",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_list_running,
        ),
        extism::Function::new(
            "cognia_wsl_list_online",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_list_online,
        ),
        extism::Function::new(
            "cognia_wsl_get_ip",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_get_ip,
        ),
        extism::Function::new(
            "cognia_wsl_disk_usage",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_disk_usage,
        ),
        extism::Function::new(
            "cognia_wsl_exec",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_wsl_exec,
        ),
        // --- Batch ---
        extism::Function::new(
            "cognia_batch_install",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_batch_install,
        ),
        extism::Function::new(
            "cognia_batch_uninstall",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_batch_uninstall,
        ),
        extism::Function::new(
            "cognia_batch_update",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_batch_update,
        ),
        extism::Function::new(
            "cognia_batch_check_updates",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_batch_check_updates,
        ),
        extism::Function::new(
            "cognia_batch_get_history",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_batch_get_history,
        ),
        extism::Function::new(
            "cognia_batch_get_pinned",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_batch_get_pinned,
        ),
        // --- Launch ---
        extism::Function::new(
            "cognia_launch_with_env",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_launch_with_env,
        ),
        extism::Function::new(
            "cognia_launch_get_env_info",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_launch_get_env_info,
        ),
        extism::Function::new(
            "cognia_launch_which_program",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_launch_which_program,
        ),
        extism::Function::new(
            "cognia_launch_activate",
            [ValType::I64],
            [ValType::I64],
            user_data.clone(),
            cognia_launch_activate,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Settings;
    use crate::plugin::manifest::PluginPermissions;
    use crate::plugin::permissions::PermissionManager;
    use crate::provider::registry::ProviderRegistry;
    use std::path::PathBuf;

    fn make_host_context() -> HostContext {
        let registry = Arc::new(RwLock::new(ProviderRegistry::new()));
        let settings = Arc::new(RwLock::new(Settings::default()));
        let permissions = Arc::new(RwLock::new(PermissionManager::new(PathBuf::from(
            "/tmp/test-data",
        ))));
        let plugin_registry = Arc::new(RwLock::new(CogniaPluginRegistry::new(PathBuf::from(
            "/tmp/test-plugins",
        ))));
        HostContext::new(registry, settings, permissions, plugin_registry, None)
    }

    #[test]
    fn test_host_context_new() {
        let ctx = make_host_context();
        // current_plugin_id should be empty initially
        let rt = tokio::runtime::Runtime::new().unwrap();
        let id = rt.block_on(async { ctx.current_plugin_id.read().await.clone() });
        assert!(id.is_empty());
    }

    #[test]
    fn test_set_current_call_updates_plugin_and_function() {
        let ctx = make_host_context();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            ctx.set_current_call("test-plugin-123", "run_tool").await;
            let id = ctx.current_plugin_id.read().await.clone();
            assert_eq!(id, "test-plugin-123");
            let function_name = ctx.current_function_name.read().await.clone();
            assert_eq!(function_name, "run_tool");

            // Overwrite
            ctx.set_current_call("another-plugin", "refresh").await;
            let id = ctx.current_plugin_id.read().await.clone();
            assert_eq!(id, "another-plugin");
            let function_name = ctx.current_function_name.read().await.clone();
            assert_eq!(function_name, "refresh");
        });
    }

    #[test]
    fn test_build_host_functions_count() {
        let ctx = make_host_context();
        let user_data = create_user_data(ctx);
        let functions = build_host_functions(user_data);
        assert_eq!(functions.len(), 120);
    }

    #[test]
    fn test_host_context_clone() {
        let ctx = make_host_context();
        let ctx2 = ctx.clone();
        // Both share the same Arc references
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            ctx.set_current_call("shared-id", "shared-fn").await;
            let id = ctx2.current_plugin_id.read().await.clone();
            assert_eq!(id, "shared-id");
            let function_name = ctx2.current_function_name.read().await.clone();
            assert_eq!(function_name, "shared-fn");
        });
    }

    #[test]
    fn test_emitted_event_queue_roundtrip() {
        let ctx = make_host_context();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            ctx.push_emitted_event(EmittedPluginEvent {
                source_plugin_id: "plugin-a".to_string(),
                event_name: "hello".to_string(),
                payload: serde_json::json!({ "x": 1 }),
                timestamp: "2026-01-01T00:00:00Z".to_string(),
            })
            .await;

            let events = ctx.drain_emitted_events().await;
            assert_eq!(events.len(), 1);
            assert_eq!(events[0].source_plugin_id, "plugin-a");
            assert_eq!(events[0].event_name, "hello");

            let empty = ctx.drain_emitted_events().await;
            assert!(empty.is_empty());
        });
    }

    #[test]
    fn test_emitted_log_queue_roundtrip() {
        let ctx = make_host_context();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let pushed = ctx
                .push_emitted_log(EmittedPluginLog {
                    source_type: "plugin".to_string(),
                    source_plugin_id: Some("plugin-a".to_string()),
                    level: "info".to_string(),
                    message: "hello".to_string(),
                    target: Some("plugin.test".to_string()),
                    fields: HashMap::from([("answer".to_string(), serde_json::json!(42))]),
                    tags: vec!["demo".to_string()],
                    correlation_id: Some("corr-1".to_string()),
                    timestamp: "2026-01-01T00:00:00Z".to_string(),
                })
                .await;

            assert!(pushed);
            let logs = ctx.drain_emitted_logs().await;
            assert_eq!(logs.len(), 1);
            assert_eq!(logs[0].source_plugin_id.as_deref(), Some("plugin-a"));
            assert_eq!(logs[0].fields.get("answer"), Some(&serde_json::json!(42)));

            let empty = ctx.drain_emitted_logs().await;
            assert!(empty.is_empty());
        });
    }

    #[test]
    fn test_emitted_ui_effect_queue_roundtrip() {
        let ctx = make_host_context();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            ctx.push_emitted_ui_effect(EmittedPluginUiEffect {
                plugin_id: "plugin-a".to_string(),
                function_name: "run".to_string(),
                effect: "toast".to_string(),
                correlation_id: Some("corr-1".to_string()),
                payload: serde_json::json!({ "message": "hello" }),
            })
            .await;

            let effects = ctx.drain_emitted_ui_effects().await;
            assert_eq!(effects.len(), 1);
            assert_eq!(effects[0].plugin_id, "plugin-a");
            assert_eq!(effects[0].function_name, "run");
            assert_eq!(effects[0].effect, "toast");

            let empty = ctx.drain_emitted_ui_effects().await;
            assert!(empty.is_empty());
        });
    }

    #[test]
    fn test_build_ui_context_payload_reads_settings() {
        let mut settings = Settings::default();
        settings.appearance.language = "zh".to_string();
        settings.appearance.theme = "dark".to_string();
        settings.appearance.window_effect = "mica".to_string();

        let payload = build_ui_context_payload(&settings);
        assert_eq!(payload.locale, "zh");
        assert_eq!(payload.theme, "dark");
        assert_eq!(payload.window_effect, "mica");
        assert!(payload.desktop);
        assert!(payload.in_app_effects);
    }

    #[test]
    fn test_log_dispatch_suppresses_nested_emitted_logs() {
        let ctx = make_host_context();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            ctx.set_log_dispatch_active(true).await;
            let pushed = ctx
                .push_emitted_log(EmittedPluginLog {
                    source_type: "plugin".to_string(),
                    source_plugin_id: Some("plugin-a".to_string()),
                    level: "info".to_string(),
                    message: "nested".to_string(),
                    target: None,
                    fields: HashMap::new(),
                    tags: vec![],
                    correlation_id: None,
                    timestamp: "2026-01-01T00:00:00Z".to_string(),
                })
                .await;

            assert!(!pushed);
            assert!(ctx.drain_emitted_logs().await.is_empty());

            ctx.set_log_dispatch_active(false).await;
            let pushed_after_reset = ctx
                .push_emitted_log(EmittedPluginLog {
                    source_type: "plugin".to_string(),
                    source_plugin_id: Some("plugin-a".to_string()),
                    level: "info".to_string(),
                    message: "top-level".to_string(),
                    target: None,
                    fields: HashMap::new(),
                    tags: vec![],
                    correlation_id: None,
                    timestamp: "2026-01-01T00:00:00Z".to_string(),
                })
                .await;
            assert!(pushed_after_reset);
        });
    }

    #[test]
    fn test_normalize_emitted_plugin_log_keeps_structured_metadata() {
        let record = normalize_emitted_plugin_log(
            "plugin-a",
            LogInput {
                level: "WARN".to_string(),
                message: "hello".to_string(),
                target: Some(" plugin.target ".to_string()),
                fields: HashMap::from([("count".to_string(), serde_json::json!(3))]),
                tags: vec![" demo ".to_string(), "".to_string()],
                correlation_id: Some(" corr-1 ".to_string()),
            },
        );

        assert_eq!(record.source_type, "plugin");
        assert_eq!(record.source_plugin_id.as_deref(), Some("plugin-a"));
        assert_eq!(record.level, "warn");
        assert_eq!(record.target.as_deref(), Some("plugin.target"));
        assert_eq!(record.tags, vec!["demo"]);
        assert_eq!(record.correlation_id.as_deref(), Some("corr-1"));
        assert_eq!(record.fields.get("count"), Some(&serde_json::json!(3)));
    }

    #[test]
    fn test_format_primary_log_message_includes_structured_metadata() {
        let rendered = format_primary_log_message(&EmittedPluginLog {
            source_type: "plugin".to_string(),
            source_plugin_id: Some("plugin-a".to_string()),
            level: "info".to_string(),
            message: "hello".to_string(),
            target: Some("plugin.target".to_string()),
            fields: HashMap::from([("count".to_string(), serde_json::json!(3))]),
            tags: vec!["demo".to_string()],
            correlation_id: Some("corr-1".to_string()),
            timestamp: "2026-01-01T00:00:00Z".to_string(),
        });

        assert!(rendered.contains("hello"));
        assert!(rendered.contains("target=plugin.target"));
        assert!(rendered.contains("correlationId=corr-1"));
        assert!(rendered.contains("tags=[demo]"));
        assert!(rendered.contains("fields={"));
    }

    #[test]
    fn test_runtime_bridge_outside_runtime() {
        let bridge = HostRuntimeBridge::capture().unwrap();
        let value = bridge
            .block_on(async { Ok::<_, ExtismError>("ok".to_string()) })
            .unwrap();
        assert_eq!(value, "ok");
    }

    #[test]
    fn test_runtime_bridge_inside_tokio_runtime_worker() {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .unwrap();

        let value = rt
            .block_on(async {
                tokio::spawn(async {
                    let bridge = HostRuntimeBridge::capture().unwrap();
                    bridge.block_on(async { Ok::<_, ExtismError>("ok".to_string()) })
                })
                .await
                .unwrap()
            })
            .unwrap();

        assert_eq!(value, "ok");
    }

    #[test]
    fn test_runtime_bridge_rejects_current_thread_runtime() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let err = rt.block_on(async {
            let bridge = HostRuntimeBridge::capture().unwrap();
            bridge
                .block_on(async { Ok::<_, ExtismError>("ok".to_string()) })
                .unwrap_err()
        });

        assert!(err
            .to_string()
            .contains("current-thread Tokio runtime is not supported"));
    }

    #[test]
    fn test_runtime_bridge_multi_thread_concurrent_calls() {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(4)
            .enable_all()
            .build()
            .unwrap();

        let values = rt.block_on(async {
            let mut handles = Vec::new();
            for idx in 0..32usize {
                handles.push(tokio::spawn(async move {
                    let bridge = HostRuntimeBridge::capture().unwrap();
                    bridge.block_on(async move { Ok::<_, ExtismError>(format!("ok-{idx}")) })
                }));
            }

            let mut out = Vec::new();
            for handle in handles {
                out.push(handle.await.unwrap().unwrap());
            }
            out
        });

        assert_eq!(values.len(), 32);
        assert!(values.contains(&"ok-0".to_string()));
        assert!(values.contains(&"ok-31".to_string()));
    }

    #[test]
    fn test_require_current_plugin_id_rejects_missing_context() {
        let ctx = make_host_context();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let err = rt
            .block_on(async { require_current_plugin_id(&ctx).await })
            .unwrap_err();
        assert!(err
            .to_string()
            .contains("missing current plugin execution context"));
    }

    #[test]
    fn test_build_plugin_process_options_applies_defaults_and_fields() {
        let options = build_plugin_process_options(
            Some("/tmp/demo".to_string()),
            HashMap::from([("DEMO".to_string(), "1".to_string())]),
            None,
            Some(false),
        );

        assert_eq!(options.cwd.as_deref(), Some("/tmp/demo"));
        assert_eq!(options.env.get("DEMO").map(String::as_str), Some("1"));
        assert_eq!(options.timeout, Some(Duration::from_secs(60)));
        assert!(!options.capture_output);
    }

    #[test]
    fn test_serialize_process_output_includes_success_field() {
        let json = serialize_process_output(crate::platform::process::ProcessOutput {
            exit_code: 7,
            stdout: "out".to_string(),
            stderr: "err".to_string(),
            success: false,
        })
        .unwrap();

        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["exitCode"], 7);
        assert_eq!(parsed["stdout"], "out");
        assert_eq!(parsed["stderr"], "err");
        assert_eq!(parsed["success"], false);
    }

    #[test]
    fn test_map_process_error_formats_actionable_messages() {
        let timeout = map_process_error(crate::platform::process::ProcessError::Timeout(
            Duration::from_millis(250),
        ));
        assert!(timeout.to_string().contains("timed out"));

        let start_failed = map_process_error(crate::platform::process::ProcessError::StartFailed(
            std::io::Error::new(std::io::ErrorKind::NotFound, "missing demo binary"),
        ));
        assert!(start_failed
            .to_string()
            .contains("Failed to execute command"));
        assert!(start_failed.to_string().contains("missing demo binary"));
    }

    #[test]
    fn test_ensure_process_exec_permission_uses_existing_permission_gate() {
        let ctx = make_host_context();
        let rt = tokio::runtime::Runtime::new().unwrap();

        let denied = rt.block_on(async {
            ctx.set_current_call("plugin-a", "tool_entry").await;
            ensure_process_exec_permission(&ctx).await.unwrap_err()
        });
        assert!(denied.to_string().contains("Plugin 'plugin-a' not found"));

        rt.block_on(async {
            let mut perms = ctx.permissions.write().await;
            let mut declared = PluginPermissions::default();
            declared.process_exec = true;
            perms.register_plugin("plugin-a", declared);
            perms.grant_permission("plugin-a", "process_exec").unwrap();
        });

        rt.block_on(async {
            ctx.set_current_call("plugin-a", "tool_entry").await;
            ensure_process_exec_permission(&ctx).await.unwrap();
        });
    }
}
