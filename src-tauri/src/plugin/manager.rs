use crate::config::Settings;
use crate::error::{CogniaError, CogniaResult};
use crate::plugin::host_functions::HostContext;
use crate::plugin::loader::PluginLoader;
use crate::plugin::manifest::PluginManifest;
use crate::plugin::permissions::{PermissionEnforcementMode, PermissionManager};
use crate::plugin::registry::{PluginInfo, PluginRegistry, PluginSource, PluginToolInfo};
use crate::provider::registry::ProviderRegistry;
use crate::resolver::version::Version;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

// ============================================================================
// Persisted plugin state (survives restarts)
// ============================================================================

/// State that is saved to disk and restored on init
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedPluginState {
    /// plugin_id -> enabled status
    #[serde(default)]
    disabled_plugins: HashSet<String>,
    /// plugin_id -> list of explicitly denied permissions
    #[serde(default)]
    denied_permissions: HashMap<String, Vec<String>>,
    /// plugin_id -> list of explicitly granted dangerous permissions
    #[serde(default)]
    granted_dangerous: HashMap<String, Vec<String>>,
}

impl PersistedPluginState {
    fn state_path(plugins_dir: &Path) -> PathBuf {
        plugins_dir.join("plugin-state.json")
    }

    async fn load(plugins_dir: &Path) -> Self {
        let path = Self::state_path(plugins_dir);
        if !path.exists() {
            return Self::default();
        }
        match tokio::fs::read_to_string(&path).await {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    async fn save(&self, plugins_dir: &Path) -> CogniaResult<()> {
        let path = Self::state_path(plugins_dir);
        if let Some(parent) = path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| CogniaError::Plugin(format!("Failed to serialize plugin state: {}", e)))?;
        tokio::fs::write(&path, content)
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to write plugin state: {}", e)))?;
        Ok(())
    }
}

/// Response from a plugin's update_url endpoint
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginUpdateResponse {
    pub version: String,
    pub download_url: String,
    pub changelog: Option<String>,
}

/// Information about an available plugin update
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginUpdateInfo {
    pub plugin_id: String,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
    pub changelog: Option<String>,
}

/// Shared state references needed by the plugin system
pub struct PluginDeps {
    pub registry: Arc<RwLock<ProviderRegistry>>,
    pub settings: Arc<RwLock<Settings>>,
}

/// Per-plugin health tracking for circuit breaker
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginHealth {
    pub consecutive_failures: u32,
    pub total_calls: u64,
    pub failed_calls: u64,
    pub total_duration_ms: u64,
    pub last_error: Option<String>,
    pub auto_disabled: bool,
}

impl PluginHealth {
    pub fn avg_duration_ms(&self) -> u64 {
        if self.total_calls == 0 {
            0
        } else {
            self.total_duration_ms / self.total_calls
        }
    }

    pub fn error_rate(&self) -> f64 {
        if self.total_calls == 0 {
            0.0
        } else {
            self.failed_calls as f64 / self.total_calls as f64
        }
    }
}

const MAX_CONSECUTIVE_FAILURES: u32 = 3;

/// Central plugin manager that coordinates registry, loader, and permissions
pub struct PluginManager {
    registry: Arc<RwLock<PluginRegistry>>,
    loader: PluginLoader,
    permissions: Arc<RwLock<PermissionManager>>,
    settings: Arc<RwLock<Settings>>,
    plugins_dir: PathBuf,
    health: HashMap<String, PluginHealth>,
}

impl PluginManager {
    pub fn new(base_dir: &Path, deps: PluginDeps) -> Self {
        let plugins_dir = base_dir.join("plugins");
        let data_dir = base_dir.join("plugin-data");
        let settings = deps.settings.clone();

        let permissions = Arc::new(RwLock::new(PermissionManager::new(data_dir)));
        let registry = Arc::new(RwLock::new(PluginRegistry::new(plugins_dir.clone())));

        // Create host context with access to launcher APIs + plugin registry for i18n
        let host_context = HostContext::new(
            deps.registry,
            deps.settings,
            permissions.clone(),
            registry.clone(),
        );

        let loader = PluginLoader::new(host_context);

        Self {
            registry,
            loader,
            permissions,
            settings,
            plugins_dir,
            health: HashMap::new(),
        }
    }

    /// Initialize: discover plugins, restore persisted state, load enabled ones
    pub async fn init(&mut self) -> CogniaResult<()> {
        let mode = {
            let settings = self.settings.read().await;
            PermissionEnforcementMode::from_config_value(
                &settings.plugin.permission_enforcement_mode,
            )
        };
        {
            let mut perms = self.permissions.write().await;
            perms.set_mode(mode);
        }

        // Ensure plugins directory exists
        if !self.plugins_dir.exists() {
            tokio::fs::create_dir_all(&self.plugins_dir)
                .await
                .map_err(|e| CogniaError::Plugin(format!("Failed to create plugins dir: {}", e)))?;
        }

        // Load persisted state (disabled plugins, permission overrides)
        let persisted = PersistedPluginState::load(&self.plugins_dir).await;

        // Discover all plugins
        let discovered = {
            let mut reg = self.registry.write().await;
            reg.discover().await?
        };
        log::info!("Discovered {} plugins", discovered.len());

        // Apply persisted disabled state
        {
            let mut reg = self.registry.write().await;
            for plugin_id in &persisted.disabled_plugins {
                if let Some(plugin) = reg.get_mut(plugin_id) {
                    plugin.enabled = false;
                }
            }
        }

        // Register permissions and load enabled plugins
        for plugin_id in &discovered {
            let reg = self.registry.read().await;
            if let Some(plugin) = reg.get(plugin_id) {
                let perms_clone = plugin.manifest.permissions.clone();
                let enabled = plugin.enabled;
                let wasm_path = plugin.wasm_path.clone();
                drop(reg);

                // Register permissions
                let mut perms = self.permissions.write().await;
                perms.register_plugin(plugin_id, perms_clone);

                // Restore denied permission overrides
                if let Some(denied) = persisted.denied_permissions.get(plugin_id) {
                    for perm in denied {
                        let _ = perms.revoke_permission(plugin_id, perm);
                    }
                }
                // Restore granted dangerous permission overrides
                if let Some(granted) = persisted.granted_dangerous.get(plugin_id) {
                    for perm in granted {
                        let _ = perms.grant_permission(plugin_id, perm);
                    }
                }
                drop(perms);

                // Ensure plugin data directory exists
                let data_dir = self.get_plugin_data_dir(plugin_id).await;
                if let Err(e) = tokio::fs::create_dir_all(&data_dir).await {
                    log::warn!(
                        "Failed to create data dir for plugin '{}': {}",
                        plugin_id,
                        e
                    );
                }

                // WASM is loaded lazily on first call_tool — skip eager loading
                let _ = (enabled, wasm_path);
            }
        }

        Ok(())
    }

    /// Save current plugin state to disk
    async fn save_state(&self) -> CogniaResult<()> {
        let reg = self.registry.read().await;
        let perms_mgr = self.permissions.read().await;

        let mut state = PersistedPluginState::default();

        for (plugin_id, plugin) in reg.iter() {
            if !plugin.enabled {
                state.disabled_plugins.insert(plugin_id.clone());
            }
            if let Some(perm_state) = perms_mgr.get_state(plugin_id) {
                let denied: Vec<String> = perm_state.denied.iter().cloned().collect();
                if !denied.is_empty() {
                    state.denied_permissions.insert(plugin_id.clone(), denied);
                }
                // Track dangerous permissions that were explicitly granted
                let dangerous = ["config_write", "pkg_install", "process_exec"];
                let granted_dangerous: Vec<String> = dangerous
                    .iter()
                    .filter(|p| perm_state.is_granted(p))
                    .map(|p| p.to_string())
                    .collect();
                if !granted_dangerous.is_empty() {
                    state
                        .granted_dangerous
                        .insert(plugin_id.clone(), granted_dangerous);
                }
            }
        }

        drop(reg);
        drop(perms_mgr);

        state.save(&self.plugins_dir).await
    }

    /// Install a plugin from a local directory path
    pub async fn install_from_path(&mut self, source_path: &Path) -> CogniaResult<String> {
        // Read manifest
        let manifest_path = source_path.join("plugin.toml");
        let manifest = PluginManifest::from_file(&manifest_path)?;
        let plugin_id = manifest.plugin.id.clone();

        // Check if already installed
        {
            let reg = self.registry.read().await;
            if reg.contains(&plugin_id) {
                return Err(CogniaError::Plugin(format!(
                    "Plugin '{}' is already installed",
                    plugin_id
                )));
            }
        }

        // Check dependencies (warn but don't block)
        if !manifest.dependencies.requires_plugins.is_empty() {
            let reg = self.registry.read().await;
            for dep in &manifest.dependencies.requires_plugins {
                if !reg.contains(dep) {
                    log::warn!(
                        "Plugin '{}' requires plugin '{}' which is not installed",
                        plugin_id,
                        dep
                    );
                }
            }
        }

        // Copy plugin to plugins directory
        let dest_dir = self.plugins_dir.join(&plugin_id);
        if dest_dir.exists() {
            tokio::fs::remove_dir_all(&dest_dir)
                .await
                .map_err(|e| CogniaError::Plugin(format!("Failed to clean install dir: {}", e)))?;
        }
        copy_plugin_runtime_files(source_path, &dest_dir, &manifest).await?;

        let wasm_path = dest_dir.join("plugin.wasm");
        if !wasm_path.exists() {
            // Clean up on failure
            let _ = tokio::fs::remove_dir_all(&dest_dir).await;
            return Err(CogniaError::Plugin(format!(
                "Plugin '{}' is missing plugin.wasm",
                plugin_id
            )));
        }

        // Register in registry
        {
            let mut reg = self.registry.write().await;
            reg.register(
                manifest.clone(),
                wasm_path.clone(),
                dest_dir,
                PluginSource::Local {
                    path: source_path.display().to_string(),
                },
            );
        }

        // Register permissions
        let mut perms = self.permissions.write().await;
        perms.register_plugin(&plugin_id, manifest.permissions.clone());
        drop(perms);

        // Create data directory
        let data_dir = self.get_plugin_data_dir(&plugin_id).await;
        let _ = tokio::fs::create_dir_all(&data_dir).await;

        // Load WASM
        self.loader.load(&plugin_id, &wasm_path)?;

        // Call optional lifecycle hook
        self.loader
            .call_if_exists(&plugin_id, "cognia_on_install", "{}")
            .await;

        // Persist state
        let _ = self.save_state().await;

        log::info!("Installed plugin '{}'", plugin_id);
        Ok(plugin_id)
    }

    /// Install a plugin from a URL (download .zip/.wasm)
    pub async fn install_from_url(&mut self, url: &str) -> CogniaResult<String> {
        // Download to temp directory
        let temp_dir = tempfile::tempdir()
            .map_err(|e| CogniaError::Plugin(format!("Failed to create temp dir: {}", e)))?;

        let client = reqwest::Client::new();
        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to download plugin: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::Plugin(format!(
                "Failed to download plugin: HTTP {}",
                response.status()
            )));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to read download: {}", e)))?;

        // Determine if it's a zip or raw wasm
        if url.ends_with(".zip") {
            // Extract zip to temp dir
            let cursor = std::io::Cursor::new(&bytes);
            let mut archive = zip::ZipArchive::new(cursor)
                .map_err(|e| CogniaError::Plugin(format!("Invalid zip file: {}", e)))?;
            archive
                .extract(temp_dir.path())
                .map_err(|e| CogniaError::Plugin(format!("Failed to extract zip: {}", e)))?;
        } else {
            // Assume raw .wasm file — need a manifest too
            tokio::fs::write(temp_dir.path().join("plugin.wasm"), &bytes)
                .await
                .map_err(|e| CogniaError::Plugin(format!("Failed to write wasm: {}", e)))?;
        }

        // Install from the extracted directory
        self.install_from_path(temp_dir.path()).await
    }

    /// Uninstall a plugin
    pub async fn uninstall(&mut self, plugin_id: &str) -> CogniaResult<()> {
        // Call optional lifecycle hook before unload
        self.loader
            .call_if_exists(plugin_id, "cognia_on_uninstall", "{}")
            .await;

        // Unload WASM
        self.loader.unload(plugin_id);

        // Unregister permissions
        let mut perms = self.permissions.write().await;
        perms.unregister_plugin(plugin_id);
        drop(perms);

        // Remove from registry
        let plugin = {
            let mut reg = self.registry.write().await;
            reg.unregister(plugin_id)
                .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?
        };

        // Delete plugin directory
        if plugin.plugin_dir.exists() {
            tokio::fs::remove_dir_all(&plugin.plugin_dir)
                .await
                .map_err(|e| {
                    CogniaError::Plugin(format!("Failed to delete plugin directory: {}", e))
                })?;
        }

        // Persist state
        let _ = self.save_state().await;

        log::info!("Uninstalled plugin '{}'", plugin_id);
        Ok(())
    }

    /// Enable a plugin
    pub async fn enable(&mut self, plugin_id: &str) -> CogniaResult<()> {
        let wasm_path = {
            let mut reg = self.registry.write().await;
            let plugin = reg
                .get_mut(plugin_id)
                .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;
            plugin.enabled = true;
            plugin.wasm_path.clone()
        };

        // Clear circuit breaker state so re-enabled plugins get a fresh start
        self.reset_plugin_health(plugin_id);

        // Load WASM if not already loaded
        if !self.loader.is_loaded(plugin_id) {
            self.loader.load(plugin_id, &wasm_path)?;
        }

        // Call optional lifecycle hook
        self.loader
            .call_if_exists(plugin_id, "cognia_on_enable", "{}")
            .await;

        // Persist state
        let _ = self.save_state().await;

        Ok(())
    }

    /// Disable a plugin
    pub async fn disable(&mut self, plugin_id: &str) -> CogniaResult<()> {
        {
            let mut reg = self.registry.write().await;
            let plugin = reg
                .get_mut(plugin_id)
                .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;
            plugin.enabled = false;
        }

        // Call optional lifecycle hook before unload
        self.loader
            .call_if_exists(plugin_id, "cognia_on_disable", "{}")
            .await;

        // Unload WASM
        self.loader.unload(plugin_id);

        // Persist state
        let _ = self.save_state().await;

        Ok(())
    }

    /// Reload a plugin (re-read WASM)
    pub async fn reload(&mut self, plugin_id: &str) -> CogniaResult<()> {
        let wasm_path = {
            let reg = self.registry.read().await;
            let plugin = reg
                .get(plugin_id)
                .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;

            if !plugin.enabled {
                return Err(CogniaError::Plugin(format!(
                    "Plugin '{}' is disabled, cannot reload",
                    plugin_id
                )));
            }

            plugin.wasm_path.clone()
        };

        self.loader.reload(plugin_id, &wasm_path)
    }

    /// Call a tool function on a loaded plugin with circuit breaker protection
    pub async fn call_tool(
        &mut self,
        plugin_id: &str,
        tool_entry: &str,
        input: &str,
    ) -> CogniaResult<String> {
        // Check circuit breaker — reject if auto-disabled
        if let Some(h) = self.health.get(plugin_id) {
            if h.auto_disabled {
                return Err(CogniaError::Plugin(format!(
                    "Plugin '{}' was auto-disabled after {} consecutive failures. Last error: {}",
                    plugin_id,
                    MAX_CONSECUTIVE_FAILURES,
                    h.last_error.as_deref().unwrap_or("unknown"),
                )));
            }
        }

        // Verify plugin exists and is enabled, get wasm_path for lazy load
        let wasm_path = {
            let reg = self.registry.read().await;
            let plugin = reg
                .get(plugin_id)
                .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;

            if !plugin.enabled {
                return Err(CogniaError::Plugin(format!(
                    "Plugin '{}' is disabled",
                    plugin_id
                )));
            }

            // Verify tool exists in manifest
            if !plugin.manifest.tools.iter().any(|t| t.entry == tool_entry) {
                return Err(CogniaError::Plugin(format!(
                    "Tool entry '{}' not declared in plugin '{}'",
                    tool_entry, plugin_id
                )));
            }

            plugin.wasm_path.clone()
        };

        // Lazy load WASM on first call
        if !self.loader.is_loaded(plugin_id) {
            self.loader.load(plugin_id, &wasm_path)?;
            self.loader
                .call_if_exists(plugin_id, "cognia_on_enable", "{}")
                .await;
            log::info!("Lazy-loaded WASM for plugin '{}'", plugin_id);
        }

        self.loader.clear_emitted_events().await;

        // Call the WASM function with health tracking
        let start = std::time::Instant::now();
        let result = self
            .loader
            .call_function(plugin_id, tool_entry, input)
            .await;
        let duration_ms = start.elapsed().as_millis() as u64;

        let health = self.health.entry(plugin_id.to_string()).or_default();
        health.total_calls += 1;
        health.total_duration_ms += duration_ms;

        match &result {
            Ok(_) => {
                health.consecutive_failures = 0;
                health.last_error = None;
            }
            Err(e) => {
                health.failed_calls += 1;
                health.consecutive_failures += 1;
                health.last_error = Some(e.to_string());

                if health.consecutive_failures >= MAX_CONSECUTIVE_FAILURES {
                    health.auto_disabled = true;
                    log::warn!(
                        "Plugin '{}' auto-disabled after {} consecutive failures",
                        plugin_id,
                        MAX_CONSECUTIVE_FAILURES,
                    );
                    // Also disable in registry so it won't show as enabled
                    let mut reg = self.registry.write().await;
                    if let Some(plugin) = reg.get_mut(plugin_id) {
                        plugin.enabled = false;
                    }
                    self.loader.unload(plugin_id);
                    let _ = self.save_state().await;
                }
            }
        }

        loop {
            let emitted_events = self.loader.drain_emitted_events().await;
            if emitted_events.is_empty() {
                break;
            }

            for emitted in emitted_events {
                self.dispatch_event_with_meta(
                    &emitted.event_name,
                    &emitted.payload,
                    Some(&emitted.source_plugin_id),
                    Some(&emitted.timestamp),
                )
                .await;
            }
        }

        result
    }

    /// Get health metrics for a specific plugin
    pub fn get_plugin_health(&self, plugin_id: &str) -> PluginHealth {
        self.health.get(plugin_id).cloned().unwrap_or_default()
    }

    /// Get health metrics for all plugins
    pub fn get_all_health(&self) -> HashMap<String, PluginHealth> {
        self.health.clone()
    }

    /// Reset the auto-disabled state for a plugin (allows re-enabling after crash)
    pub fn reset_plugin_health(&mut self, plugin_id: &str) {
        if let Some(h) = self.health.get_mut(plugin_id) {
            h.consecutive_failures = 0;
            h.auto_disabled = false;
            h.last_error = None;
        }
    }

    /// Dispatch a system event to all enabled plugins that listen for it.
    /// Calls the optional `cognia_on_event` WASM export with JSON payload.
    pub async fn dispatch_event(&mut self, event_name: &str, payload: &serde_json::Value) {
        self.dispatch_event_with_meta(event_name, payload, None, None)
            .await;
    }

    async fn dispatch_event_with_meta(
        &mut self,
        event_name: &str,
        payload: &serde_json::Value,
        source_plugin_id: Option<&str>,
        timestamp: Option<&str>,
    ) {
        let mut queue: VecDeque<(String, serde_json::Value, Option<String>, Option<String>)> =
            VecDeque::new();
        queue.push_back((
            event_name.to_string(),
            payload.clone(),
            source_plugin_id.map(|s| s.to_string()),
            timestamp.map(|t| t.to_string()),
        ));

        let mut processed = 0u32;
        while let Some((queued_event, queued_payload, queued_source, queued_timestamp)) =
            queue.pop_front()
        {
            processed += 1;
            if processed > 64 {
                log::warn!("Plugin event dispatch stopped after 64 events to avoid infinite loops");
                break;
            }

            if let Some(source_id) = queued_source.as_deref() {
                let source_known = {
                    let reg = self.registry.read().await;
                    reg.contains(source_id)
                };
                if !source_known {
                    log::warn!(
                        "[plugin-runtime][plugin:{}][operation:dispatch_event][stage:source-context] source plugin id not found in registry; continuing dispatch with isolated boundary",
                        source_id
                    );
                }
            }

            let listeners: Vec<(String, PathBuf)> = {
                let reg = self.registry.read().await;
                reg.iter()
                    .filter(|(_, p)| {
                        p.enabled
                            && p.manifest
                                .plugin
                                .listen_events
                                .iter()
                                .any(|e| e == &queued_event || e == "*")
                    })
                    .map(|(id, p)| (id.clone(), p.wasm_path.clone()))
                    .collect()
            };

            for (plugin_id, wasm_path) in &listeners {
                // Lazy load if needed
                if !self.loader.is_loaded(plugin_id) {
                    if let Err(e) = self.loader.load(plugin_id, wasm_path) {
                        log::warn!(
                            "[plugin-runtime][plugin:{}][operation:dispatch_event][stage:listener-load] failed to lazy-load listener plugin: {}",
                            plugin_id,
                            e
                        );
                        continue;
                    }
                }

                let input = serde_json::json!({
                    "event": queued_event.clone(),
                    "payload": queued_payload.clone(),
                    "sourcePluginId": queued_source.clone(),
                    "timestamp": queued_timestamp
                        .clone()
                        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
                })
                .to_string();

                let callback_output = self.loader
                    .call_if_exists(plugin_id, "cognia_on_event", &input)
                    .await;
                if callback_output.is_none() {
                    log::warn!(
                        "[plugin-runtime][plugin:{}][operation:dispatch_event][stage:listener-callback] listener callback failed or missing export for event '{}' (source={})",
                        plugin_id,
                        queued_event,
                        queued_source.as_deref().unwrap_or("system")
                    );
                }
            }

            if !listeners.is_empty() {
                log::debug!(
                    "Dispatched event '{}' to {} plugin(s)",
                    queued_event,
                    listeners.len()
                );
            }

            let emitted = self.loader.drain_emitted_events().await;
            for event in emitted {
                queue.push_back((
                    event.event_name,
                    event.payload,
                    Some(event.source_plugin_id),
                    Some(event.timestamp),
                ));
            }
        }
    }

    /// Get the settings schema declared in a plugin's manifest
    pub async fn get_plugin_settings_schema(
        &self,
        plugin_id: &str,
    ) -> CogniaResult<Vec<crate::plugin::manifest::SettingDeclaration>> {
        let reg = self.registry.read().await;
        let plugin = reg
            .get(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;
        Ok(plugin.manifest.settings.clone())
    }

    /// Get current setting values for a plugin (from {data_dir}/settings.json)
    pub async fn get_plugin_settings_values(
        &self,
        plugin_id: &str,
    ) -> CogniaResult<HashMap<String, serde_json::Value>> {
        let data_dir = self.get_plugin_data_dir(plugin_id).await;
        let settings_path = data_dir.join("settings.json");
        if !settings_path.exists() {
            return Ok(HashMap::new());
        }
        let content = tokio::fs::read_to_string(&settings_path)
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to read settings: {}", e)))?;
        serde_json::from_str(&content)
            .map_err(|e| CogniaError::Plugin(format!("Invalid settings JSON: {}", e)))
    }

    /// Set a single setting value for a plugin
    pub async fn set_plugin_setting(
        &mut self,
        plugin_id: &str,
        key: &str,
        value: serde_json::Value,
    ) -> CogniaResult<()> {
        let data_dir = self.get_plugin_data_dir(plugin_id).await;
        let _ = tokio::fs::create_dir_all(&data_dir).await;
        let settings_path = data_dir.join("settings.json");

        let mut settings: HashMap<String, serde_json::Value> = if settings_path.exists() {
            let content = tokio::fs::read_to_string(&settings_path)
                .await
                .unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            HashMap::new()
        };

        settings.insert(key.to_string(), value);

        let content = serde_json::to_string_pretty(&settings)
            .map_err(|e| CogniaError::Plugin(format!("Failed to serialize settings: {}", e)))?;
        tokio::fs::write(&settings_path, content)
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to write settings: {}", e)))?;

        Ok(())
    }

    /// Export a plugin's directory + data as a zip file
    pub async fn export_plugin_data(&self, plugin_id: &str) -> CogniaResult<PathBuf> {
        let plugin_dir = {
            let reg = self.registry.read().await;
            let plugin = reg
                .get(plugin_id)
                .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;
            plugin.plugin_dir.clone()
        };
        let data_dir = self.get_plugin_data_dir(plugin_id).await;

        let temp_dir = tempfile::tempdir()
            .map_err(|e| CogniaError::Plugin(format!("Failed to create temp dir: {}", e)))?;
        let zip_path = temp_dir.keep().join(format!("{}.zip", plugin_id));

        let file = std::fs::File::create(&zip_path)
            .map_err(|e| CogniaError::Plugin(format!("Failed to create zip: {}", e)))?;
        let mut zip_writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        // Add plugin dir contents under "plugin/"
        Self::zip_dir_recursive(&mut zip_writer, &plugin_dir, "plugin", &options)?;

        // Add data dir contents under "data/" if it exists
        if data_dir.exists() {
            Self::zip_dir_recursive(&mut zip_writer, &data_dir, "data", &options)?;
        }

        zip_writer
            .finish()
            .map_err(|e| CogniaError::Plugin(format!("Failed to finalize zip: {}", e)))?;

        log::info!("Exported plugin '{}' to {}", plugin_id, zip_path.display());
        Ok(zip_path)
    }

    fn zip_dir_recursive(
        zip: &mut zip::ZipWriter<std::fs::File>,
        src_dir: &Path,
        prefix: &str,
        options: &zip::write::SimpleFileOptions,
    ) -> CogniaResult<()> {
        if !src_dir.exists() {
            return Ok(());
        }
        for entry in walkdir::WalkDir::new(src_dir)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let relative = path.strip_prefix(src_dir).unwrap_or(path);
            let archive_path = format!(
                "{}/{}",
                prefix,
                relative.to_string_lossy().replace('\\', "/")
            );

            if path.is_file() {
                zip.start_file(&archive_path, *options)
                    .map_err(|e| CogniaError::Plugin(format!("Zip error: {}", e)))?;
                let data = std::fs::read(path)
                    .map_err(|e| CogniaError::Plugin(format!("Read error: {}", e)))?;
                std::io::Write::write_all(zip, &data)
                    .map_err(|e| CogniaError::Plugin(format!("Write error: {}", e)))?;
            }
        }
        Ok(())
    }

    /// List all registered plugins
    pub async fn list_plugins(&self) -> Vec<PluginInfo> {
        let reg = self.registry.read().await;
        reg.list()
    }

    /// List all tools from all enabled plugins
    pub async fn list_all_tools(&self) -> Vec<PluginToolInfo> {
        let reg = self.registry.read().await;
        reg.list_all_tools()
    }

    /// Get plugin manifest by ID
    pub async fn get_plugin_manifest(&self, plugin_id: &str) -> Option<PluginManifest> {
        let reg = self.registry.read().await;
        reg.get(plugin_id).map(|p| p.manifest.clone())
    }

    /// Get plugin locales for frontend i18n
    pub async fn get_plugin_locales(
        &self,
        plugin_id: &str,
    ) -> CogniaResult<std::collections::HashMap<String, std::collections::HashMap<String, String>>>
    {
        let reg = self.registry.read().await;
        let plugin = reg
            .get(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;
        Ok(plugin.manifest.locales.clone())
    }

    /// Check if a plugin exists
    pub async fn contains_plugin(&self, plugin_id: &str) -> bool {
        let reg = self.registry.read().await;
        reg.contains(plugin_id)
    }

    /// Get plugin data directory
    pub async fn get_plugin_data_dir(&self, plugin_id: &str) -> PathBuf {
        let perms = self.permissions.read().await;
        perms.get_plugin_data_dir(plugin_id)
    }

    /// Grant a permission to a plugin
    pub async fn grant_permission(&self, plugin_id: &str, permission: &str) -> CogniaResult<()> {
        let mut perms = self.permissions.write().await;
        perms.grant_permission(plugin_id, permission)?;
        drop(perms);
        let _ = self.save_state().await;
        Ok(())
    }

    /// Revoke a permission from a plugin
    pub async fn revoke_permission(&self, plugin_id: &str, permission: &str) -> CogniaResult<()> {
        let mut perms = self.permissions.write().await;
        perms.revoke_permission(plugin_id, permission)?;
        drop(perms);
        let _ = self.save_state().await;
        Ok(())
    }

    /// Get permission state for a plugin
    pub async fn get_permissions(
        &self,
        plugin_id: &str,
    ) -> CogniaResult<crate::plugin::permissions::PluginPermissionState> {
        let perms = self.permissions.read().await;
        perms
            .get_state(plugin_id)
            .cloned()
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))
    }

    /// Get the plugins directory path
    pub fn plugins_dir(&self) -> &Path {
        &self.plugins_dir
    }

    /// Get a plugin's installation directory
    pub async fn get_plugin_dir(&self, plugin_id: &str) -> Option<std::path::PathBuf> {
        let reg = self.registry.read().await;
        reg.get(plugin_id).map(|p| p.plugin_dir.clone())
    }

    /// Get a plugin's UI configuration (for iframe-mode plugins)
    pub async fn get_plugin_ui_config(
        &self,
        plugin_id: &str,
    ) -> Option<crate::plugin::manifest::UiConfig> {
        let reg = self.registry.read().await;
        reg.get(plugin_id).and_then(|p| p.manifest.ui.clone())
    }

    /// Check if an update is available for a plugin
    pub async fn check_update(&self, plugin_id: &str) -> CogniaResult<Option<PluginUpdateInfo>> {
        let reg = self.registry.read().await;
        let plugin = reg
            .get(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;

        let update_url = match &plugin.manifest.plugin.update_url {
            Some(url) => url.clone(),
            None => return Ok(None),
        };

        let current_version = plugin.manifest.plugin.version.clone();
        drop(reg);

        // Fetch update info from URL
        let client = reqwest::Client::new();
        let response = client
            .get(&update_url)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to check update: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::Plugin(format!(
                "Update check failed: HTTP {}",
                response.status()
            )));
        }

        let info: PluginUpdateResponse = response
            .json()
            .await
            .map_err(|e| CogniaError::Plugin(format!("Invalid update response: {}", e)))?;

        // Compare versions using proper semver parsing
        let current: Version = current_version.parse().unwrap_or(Version::new(0, 0, 0));
        let latest: Version = info.version.parse().unwrap_or(Version::new(0, 0, 0));
        if latest > current {
            Ok(Some(PluginUpdateInfo {
                plugin_id: plugin_id.to_string(),
                current_version,
                latest_version: info.version,
                download_url: info.download_url,
                changelog: info.changelog,
            }))
        } else {
            Ok(None)
        }
    }

    /// Update a plugin to the latest version from its update URL
    pub async fn update_plugin(&mut self, plugin_id: &str) -> CogniaResult<()> {
        let update_info = self
            .check_update(plugin_id)
            .await?
            .ok_or_else(|| CogniaError::Plugin("No update available".to_string()))?;

        // Unload current WASM
        self.loader.unload(plugin_id);

        // Download and install the update
        let temp_dir = tempfile::tempdir()
            .map_err(|e| CogniaError::Plugin(format!("Failed to create temp dir: {}", e)))?;

        let client = reqwest::Client::new();
        let response = client
            .get(&update_info.download_url)
            .send()
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to download update: {}", e)))?;

        let bytes = response
            .bytes()
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to read update: {}", e)))?;

        // Extract to temp dir
        if update_info.download_url.ends_with(".zip") {
            let cursor = std::io::Cursor::new(&bytes);
            let mut archive = zip::ZipArchive::new(cursor)
                .map_err(|e| CogniaError::Plugin(format!("Invalid zip: {}", e)))?;
            archive
                .extract(temp_dir.path())
                .map_err(|e| CogniaError::Plugin(format!("Failed to extract: {}", e)))?;
        } else {
            tokio::fs::write(temp_dir.path().join("plugin.wasm"), &bytes)
                .await
                .map_err(|e| CogniaError::Plugin(format!("Failed to write wasm: {}", e)))?;
        }

        // Get the plugin's install directory
        let dest_dir = {
            let reg = self.registry.read().await;
            let plugin = reg
                .get(plugin_id)
                .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;
            plugin.plugin_dir.clone()
        };

        // Copy new files over existing installation
        copy_dir_recursive(temp_dir.path(), &dest_dir).await?;

        // Re-read manifest and update registry
        let manifest_path = dest_dir.join("plugin.toml");
        let manifest = PluginManifest::from_file(&manifest_path)?;
        let wasm_path = dest_dir.join("plugin.wasm");

        {
            let mut reg = self.registry.write().await;
            if let Some(plugin) = reg.get_mut(plugin_id) {
                plugin.manifest = manifest.clone();
                plugin.wasm_path = wasm_path.clone();
                plugin.updated_at = Some(chrono::Utc::now());
            }
        }

        // Update permissions
        let mut perms = self.permissions.write().await;
        perms.register_plugin(plugin_id, manifest.permissions);
        drop(perms);

        // Reload WASM
        self.loader.load(plugin_id, &wasm_path)?;

        // Persist state
        let _ = self.save_state().await;

        log::info!(
            "Updated plugin '{}' from {} to {}",
            plugin_id,
            update_info.current_version,
            update_info.latest_version
        );
        Ok(())
    }

    /// Check for updates across all plugins that have an update_url
    pub async fn check_all_updates(&self) -> Vec<PluginUpdateInfo> {
        let plugin_ids: Vec<String> = {
            let reg = self.registry.read().await;
            reg.iter()
                .filter(|(_, p)| p.manifest.plugin.update_url.is_some())
                .map(|(id, _)| id.clone())
                .collect()
        };

        let mut updates = Vec::new();
        for plugin_id in &plugin_ids {
            match self.check_update(plugin_id).await {
                Ok(Some(info)) => updates.push(info),
                Ok(None) => {}
                Err(e) => log::warn!("Failed to check update for '{}': {}", plugin_id, e),
            }
        }
        updates
    }

    /// Update all plugins that have available updates
    pub async fn update_all(&mut self) -> Vec<Result<String, String>> {
        let updates = self.check_all_updates().await;
        let mut results = Vec::new();
        for update in &updates {
            match self.update_plugin(&update.plugin_id).await {
                Ok(()) => results.push(Ok(update.plugin_id.clone())),
                Err(e) => results.push(Err(format!("{}: {}", update.plugin_id, e))),
            }
        }
        results
    }

    /// Get the granted permissions list for a plugin (for iframe bridge)
    pub async fn get_granted_permissions(&self, plugin_id: &str) -> Vec<String> {
        let perms = self.permissions.read().await;
        match perms.get_state(plugin_id) {
            Some(state) => state
                .granted
                .iter()
                .filter(|p| !state.denied.contains(*p))
                .cloned()
                .collect(),
            None => vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Settings;
    use crate::plugin::manifest::{
        PluginDependencies, PluginManifest, PluginMeta, PluginPermissions,
    };
    use crate::plugin::registry::PluginSource;
    use crate::provider::registry::ProviderRegistry;
    use std::collections::HashMap;
    use tokio::sync::RwLock;

    fn make_test_manager(temp_root: &Path) -> PluginManager {
        let deps = PluginDeps {
            registry: Arc::new(RwLock::new(ProviderRegistry::new())),
            settings: Arc::new(RwLock::new(Settings::default())),
        };
        PluginManager::new(temp_root, deps)
    }

    fn make_listener_manifest(plugin_id: &str, events: Vec<&str>) -> PluginManifest {
        PluginManifest {
            plugin: PluginMeta {
                id: plugin_id.to_string(),
                name: "Listener".to_string(),
                version: "1.0.0".to_string(),
                description: "listener test plugin".to_string(),
                authors: vec![],
                license: None,
                repository: None,
                homepage: None,
                min_cognia_version: None,
                icon: None,
                update_url: None,
                listen_events: events.into_iter().map(|e| e.to_string()).collect(),
            },
            tools: vec![],
            permissions: PluginPermissions::default(),
            locales: HashMap::new(),
            ui: None,
            dependencies: PluginDependencies::default(),
            settings: vec![],
        }
    }

    #[test]
    fn test_persisted_state_default() {
        let state = PersistedPluginState::default();
        assert!(state.disabled_plugins.is_empty());
        assert!(state.denied_permissions.is_empty());
        assert!(state.granted_dangerous.is_empty());
    }

    #[test]
    fn test_persisted_state_serialization() {
        let mut state = PersistedPluginState::default();
        state
            .disabled_plugins
            .insert("com.example.disabled".to_string());
        state.denied_permissions.insert(
            "com.example.plugin".to_string(),
            vec!["clipboard".to_string()],
        );
        state.granted_dangerous.insert(
            "com.example.plugin".to_string(),
            vec!["process_exec".to_string()],
        );

        let json = serde_json::to_string(&state).unwrap();
        let restored: PersistedPluginState = serde_json::from_str(&json).unwrap();

        assert!(restored.disabled_plugins.contains("com.example.disabled"));
        assert_eq!(
            restored.denied_permissions["com.example.plugin"],
            vec!["clipboard"]
        );
        assert_eq!(
            restored.granted_dangerous["com.example.plugin"],
            vec!["process_exec"]
        );
    }

    #[tokio::test]
    async fn test_persisted_state_save_and_load() {
        let temp_dir = tempfile::tempdir().unwrap();
        let plugins_dir = temp_dir.path().to_path_buf();

        let mut state = PersistedPluginState::default();
        state.disabled_plugins.insert("test-plugin".to_string());
        state
            .granted_dangerous
            .insert("test-plugin".to_string(), vec!["config_write".to_string()]);

        state.save(&plugins_dir).await.unwrap();

        let loaded = PersistedPluginState::load(&plugins_dir).await;
        assert!(loaded.disabled_plugins.contains("test-plugin"));
        assert_eq!(
            loaded.granted_dangerous["test-plugin"],
            vec!["config_write"]
        );
    }

    #[tokio::test]
    async fn test_persisted_state_load_missing_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let loaded = PersistedPluginState::load(temp_dir.path()).await;
        assert!(loaded.disabled_plugins.is_empty());
    }

    #[test]
    fn test_persisted_state_path() {
        let path = PersistedPluginState::state_path(std::path::Path::new("/cognia/plugins"));
        assert_eq!(
            path,
            std::path::PathBuf::from("/cognia/plugins/plugin-state.json")
        );
    }

    #[tokio::test]
    async fn test_dispatch_event_no_listeners_is_noop() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());

        manager
            .dispatch_event("unit.event.no_listeners", &serde_json::json!({ "ok": true }))
            .await;
    }

    #[tokio::test]
    async fn test_dispatch_event_listener_load_failure_isolated() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.example.listener";

        {
            let mut reg = manager.registry.write().await;
            reg.register(
                make_listener_manifest(plugin_id, vec!["unit.event"]),
                temp_dir.path().join("missing").join("plugin.wasm"),
                temp_dir.path().join("missing"),
                PluginSource::BuiltIn,
            );
        }

        manager
            .dispatch_event("unit.event", &serde_json::json!({ "x": 1 }))
            .await;

        assert!(!manager.loader.is_loaded(plugin_id));
    }

    #[tokio::test]
    async fn test_dispatch_event_unknown_source_context_isolated() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.example.listener";

        {
            let mut reg = manager.registry.write().await;
            reg.register(
                make_listener_manifest(plugin_id, vec!["unit.event"]),
                temp_dir.path().join("missing").join("plugin.wasm"),
                temp_dir.path().join("missing"),
                PluginSource::BuiltIn,
            );
        }

        manager
            .dispatch_event_with_meta(
                "unit.event",
                &serde_json::json!({ "x": 1 }),
                Some("com.example.unknown-source"),
                Some("2026-03-04T00:00:00Z"),
            )
            .await;

        assert!(!manager.loader.is_loaded(plugin_id));
    }

    #[tokio::test]
    async fn test_dispatch_event_multiple_listener_failures_are_isolated() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_a = "com.example.listener-a";
        let plugin_b = "com.example.listener-b";

        {
            let mut reg = manager.registry.write().await;
            reg.register(
                make_listener_manifest(plugin_a, vec!["unit.event"]),
                temp_dir.path().join("missing-a").join("plugin.wasm"),
                temp_dir.path().join("missing-a"),
                PluginSource::BuiltIn,
            );
            reg.register(
                make_listener_manifest(plugin_b, vec!["unit.event"]),
                temp_dir.path().join("missing-b").join("plugin.wasm"),
                temp_dir.path().join("missing-b"),
                PluginSource::BuiltIn,
            );
        }

        manager
            .dispatch_event("unit.event", &serde_json::json!({ "x": 1 }))
            .await;

        assert!(!manager.loader.is_loaded(plugin_a));
        assert!(!manager.loader.is_loaded(plugin_b));
    }

    #[tokio::test]
    async fn test_copy_plugin_runtime_files_only_required_artifacts() {
        let temp_dir = tempfile::tempdir().unwrap();
        let src = temp_dir.path().join("src");
        let dst = temp_dir.path().join("dst");

        tokio::fs::create_dir_all(src.join("node_modules").join("pkg"))
            .await
            .unwrap();
        tokio::fs::create_dir_all(src.join(".tools").join("cache"))
            .await
            .unwrap();
        tokio::fs::create_dir_all(src.join("target").join("debug"))
            .await
            .unwrap();
        tokio::fs::create_dir_all(src.join("ui")).await.unwrap();
        tokio::fs::create_dir_all(src.join("dist")).await.unwrap();
        tokio::fs::create_dir_all(src.join(".bin")).await.unwrap();

        tokio::fs::write(
            src.join("plugin.toml"),
            "[plugin]\nid=\"p\"\nname=\"P\"\nversion=\"1.0.0\"\ndescription=\"d\"\nauthors=[]\n\n[[tools]]\nid=\"view\"\nname_en=\"View\"\ndescription_en=\"View\"\nentry=\"render_view\"\nui_mode=\"iframe\"\n\n[ui]\nentry=\"ui/index.html\"\n",
        )
        .await
        .unwrap();
        tokio::fs::write(src.join("plugin.wasm"), b"\0asm").await.unwrap();
        tokio::fs::write(src.join("node_modules").join("pkg").join("index.js"), "x")
            .await
            .unwrap();
        tokio::fs::write(src.join(".tools").join("cache").join("binary"), "x")
            .await
            .unwrap();
        tokio::fs::write(src.join("target").join("debug").join("artifact"), "x")
            .await
            .unwrap();
        tokio::fs::write(src.join("ui").join("index.html"), "<html></html>")
            .await
            .unwrap();
        tokio::fs::write(src.join("dist").join("plugin.js"), "bundle")
            .await
            .unwrap();
        tokio::fs::write(src.join(".bin").join("tool"), "bin")
            .await
            .unwrap();

        let manifest = PluginManifest::from_file(&src.join("plugin.toml")).unwrap();
        copy_plugin_runtime_files(&src, &dst, &manifest)
            .await
            .unwrap();

        assert!(dst.join("plugin.toml").exists());
        assert!(dst.join("plugin.wasm").exists());
        assert!(dst.join("ui").join("index.html").exists());

        assert!(!dst.join("node_modules").exists());
        assert!(!dst.join(".tools").exists());
        assert!(!dst.join("target").exists());
        assert!(!dst.join("dist").exists());
        assert!(!dst.join(".bin").exists());
    }

    #[tokio::test]
    async fn test_copy_dir_recursive_rejects_destination_inside_source() {
        let temp_dir = tempfile::tempdir().unwrap();
        let src = temp_dir.path().join("src");
        let nested_dst = src.join("nested").join("dst");
        tokio::fs::create_dir_all(&src).await.unwrap();
        tokio::fs::write(src.join("plugin.toml"), "x").await.unwrap();

        let err = copy_dir_recursive(&src, &nested_dst).await.unwrap_err();
        assert!(err.to_string().contains("inside source"));
    }
}

async fn copy_plugin_runtime_files(
    source_root: &Path,
    dest_root: &Path,
    manifest: &PluginManifest,
) -> CogniaResult<()> {
    copy_required_relative_file(source_root, dest_root, Path::new("plugin.toml")).await?;
    copy_required_relative_file(source_root, dest_root, Path::new("plugin.wasm")).await?;

    let locales_src = source_root.join("locales");
    if locales_src.is_dir() {
        copy_dir_recursive(&locales_src, &dest_root.join("locales")).await?;
    }

    if let Some(ui) = &manifest.ui {
        let ui_entry = Path::new(&ui.entry);
        validate_safe_relative_path(ui_entry, "ui.entry")?;
        copy_required_relative_file(source_root, dest_root, ui_entry).await?;

        if let Some(ui_parent) = ui_entry.parent() {
            if !ui_parent.as_os_str().is_empty() {
                copy_dir_recursive(&source_root.join(ui_parent), &dest_root.join(ui_parent)).await?;
            }
        }
    }

    Ok(())
}

fn validate_safe_relative_path(path: &Path, field: &str) -> CogniaResult<()> {
    use std::path::Component;

    if path.is_absolute() {
        return Err(CogniaError::Plugin(format!(
            "Invalid {} path (must be relative): {}",
            field,
            path.display()
        )));
    }

    if path.components().any(|c| {
        matches!(
            c,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err(CogniaError::Plugin(format!(
            "Invalid {} path (path traversal not allowed): {}",
            field,
            path.display()
        )));
    }

    Ok(())
}

async fn copy_required_relative_file(
    source_root: &Path,
    dest_root: &Path,
    relative_path: &Path,
) -> CogniaResult<()> {
    validate_safe_relative_path(relative_path, "plugin file")?;

    let src = source_root.join(relative_path);
    if !src.exists() {
        return Err(CogniaError::Plugin(format!(
            "Required plugin file not found: {}",
            src.display()
        )));
    }

    let metadata = tokio::fs::metadata(&src).await.map_err(|e| {
        CogniaError::Plugin(format!(
            "Failed to read metadata for {}: {}",
            src.display(),
            e
        ))
    })?;

    if !metadata.is_file() {
        return Err(CogniaError::Plugin(format!(
            "Expected file but found directory: {}",
            src.display()
        )));
    }

    let dst = dest_root.join(relative_path);
    if let Some(parent) = dst.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            CogniaError::Plugin(format!(
                "Failed to create dir {}: {}",
                parent.display(),
                e
            ))
        })?;
    }

    tokio::fs::copy(&src, &dst).await.map_err(|e| {
        CogniaError::Plugin(format!(
            "Failed to copy {} -> {}: {}",
            src.display(),
            dst.display(),
            e
        ))
    })?;

    Ok(())
}

/// Recursively copy a directory
async fn copy_dir_recursive(src: &Path, dst: &Path) -> CogniaResult<()> {
    if dst.starts_with(src) {
        return Err(CogniaError::Plugin(format!(
            "Refusing to copy directory with destination inside source: {} -> {}",
            src.display(),
            dst.display()
        )));
    }

    let mut visited_dirs = HashSet::new();
    copy_dir_recursive_impl(src, dst, 0, &mut visited_dirs).await
}

fn copy_dir_recursive_impl<'a>(
    src: &'a Path,
    dst: &'a Path,
    depth: usize,
    visited_dirs: &'a mut HashSet<PathBuf>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = CogniaResult<()>> + Send + 'a>> {
    Box::pin(async move {
        let canonical_src = src.canonicalize().map_err(|e| {
            CogniaError::Plugin(format!(
                "Failed to resolve source dir {}: {}",
                src.display(),
                e
            ))
        })?;

        if !visited_dirs.insert(canonical_src) {
            return Ok(());
        }

        tokio::fs::create_dir_all(dst).await.map_err(|e| {
            CogniaError::Plugin(format!("Failed to create dir {}: {}", dst.display(), e))
        })?;

        let mut entries = tokio::fs::read_dir(src).await.map_err(|e| {
            CogniaError::Plugin(format!("Failed to read dir {}: {}", src.display(), e))
        })?;

        while let Ok(Some(entry)) = entries.next_entry().await {
            let src_path = entry.path();
            let file_name = entry.file_name();
            let dst_path = dst.join(&file_name);
            let file_type = entry.file_type().await.map_err(|e| {
                CogniaError::Plugin(format!(
                    "Failed to inspect {}: {}",
                    src_path.display(),
                    e
                ))
            })?;

            if file_type.is_symlink() {
                continue;
            }

            if file_type.is_dir() {
                let name = file_name.to_string_lossy();
                if should_skip_plugin_copy_dir(name.as_ref(), depth) {
                    continue;
                }
                copy_dir_recursive_impl(&src_path, &dst_path, depth + 1, visited_dirs).await?;
            } else if file_type.is_file() {
                tokio::fs::copy(&src_path, &dst_path).await.map_err(|e| {
                    CogniaError::Plugin(format!(
                        "Failed to copy {} -> {}: {}",
                        src_path.display(),
                        dst_path.display(),
                        e
                    ))
                })?;
            }
        }

        Ok(())
    })
}

fn should_skip_plugin_copy_dir(name: &str, depth: usize) -> bool {
    if depth != 0 {
        return false;
    }
    matches!(name, "node_modules" | ".tools" | "target" | ".git")
}
