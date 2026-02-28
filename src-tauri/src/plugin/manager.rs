use crate::config::Settings;
use crate::error::{CogniaError, CogniaResult};
use crate::plugin::host_functions::HostContext;
use crate::plugin::loader::PluginLoader;
use crate::plugin::manifest::PluginManifest;
use crate::plugin::permissions::PermissionManager;
use crate::plugin::registry::{PluginInfo, PluginRegistry, PluginSource, PluginToolInfo};
use crate::provider::registry::ProviderRegistry;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
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
        tokio::fs::write(&path, content).await
            .map_err(|e| CogniaError::Plugin(format!("Failed to write plugin state: {}", e)))?;
        Ok(())
    }
}

/// Shared state references needed by the plugin system
pub struct PluginDeps {
    pub registry: Arc<RwLock<ProviderRegistry>>,
    pub settings: Arc<RwLock<Settings>>,
}

/// Central plugin manager that coordinates registry, loader, and permissions
pub struct PluginManager {
    registry: Arc<RwLock<PluginRegistry>>,
    loader: PluginLoader,
    permissions: Arc<RwLock<PermissionManager>>,
    plugins_dir: PathBuf,
}

impl PluginManager {
    pub fn new(base_dir: &Path, deps: PluginDeps) -> Self {
        let plugins_dir = base_dir.join("plugins");
        let data_dir = base_dir.join("plugin-data");

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
            plugins_dir,
        }
    }

    /// Initialize: discover plugins, restore persisted state, load enabled ones
    pub async fn init(&mut self) -> CogniaResult<()> {
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
                    log::warn!("Failed to create data dir for plugin '{}': {}", plugin_id, e);
                }

                // Load WASM if enabled
                if enabled {
                    if let Err(e) = self.loader.load(plugin_id, &wasm_path) {
                        log::warn!("Failed to load plugin '{}': {}", plugin_id, e);
                    }
                }
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
                let granted_dangerous: Vec<String> = dangerous.iter()
                    .filter(|p| perm_state.is_granted(p))
                    .map(|p| p.to_string())
                    .collect();
                if !granted_dangerous.is_empty() {
                    state.granted_dangerous.insert(plugin_id.clone(), granted_dangerous);
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

        // Copy plugin to plugins directory
        let dest_dir = self.plugins_dir.join(&plugin_id);
        if dest_dir.exists() {
            tokio::fs::remove_dir_all(&dest_dir)
                .await
                .map_err(|e| CogniaError::Plugin(format!("Failed to clean install dir: {}", e)))?;
        }
        copy_dir_recursive(source_path, &dest_dir).await?;

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
        // Unload WASM
        self.loader.unload(plugin_id);

        // Unregister permissions
        let mut perms = self.permissions.write().await;
        perms.unregister_plugin(plugin_id);
        drop(perms);

        // Remove from registry
        let plugin = {
            let mut reg = self.registry.write().await;
            reg.unregister(plugin_id).ok_or_else(|| {
                CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id))
            })?
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
            let plugin = reg.get_mut(plugin_id).ok_or_else(|| {
                CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id))
            })?;
            plugin.enabled = true;
            plugin.wasm_path.clone()
        };

        // Load WASM if not already loaded
        if !self.loader.is_loaded(plugin_id) {
            self.loader.load(plugin_id, &wasm_path)?;
        }

        // Persist state
        let _ = self.save_state().await;

        Ok(())
    }

    /// Disable a plugin
    pub async fn disable(&mut self, plugin_id: &str) -> CogniaResult<()> {
        {
            let mut reg = self.registry.write().await;
            let plugin = reg.get_mut(plugin_id).ok_or_else(|| {
                CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id))
            })?;
            plugin.enabled = false;
        }

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
            let plugin = reg.get(plugin_id).ok_or_else(|| {
                CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id))
            })?;

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

    /// Call a tool function on a loaded plugin
    pub async fn call_tool(
        &mut self,
        plugin_id: &str,
        tool_entry: &str,
        input: &str,
    ) -> CogniaResult<String> {
        // Verify plugin is loaded and enabled
        {
            let reg = self.registry.read().await;
            let plugin = reg.get(plugin_id).ok_or_else(|| {
                CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id))
            })?;

            if !plugin.enabled {
                return Err(CogniaError::Plugin(format!(
                    "Plugin '{}' is disabled",
                    plugin_id
                )));
            }

            // Verify tool exists in manifest
            if !plugin
                .manifest
                .tools
                .iter()
                .any(|t| t.entry == tool_entry)
            {
                return Err(CogniaError::Plugin(format!(
                    "Tool entry '{}' not declared in plugin '{}'",
                    tool_entry, plugin_id
                )));
            }
        }

        // Call the WASM function (async to set current_plugin_id for host function permission checks)
        self.loader.call_function(plugin_id, tool_entry, input).await
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
    ) -> CogniaResult<std::collections::HashMap<String, std::collections::HashMap<String, String>>> {
        let reg = self.registry.read().await;
        let plugin = reg.get(plugin_id).ok_or_else(|| {
            CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id))
        })?;
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
    pub async fn grant_permission(
        &self,
        plugin_id: &str,
        permission: &str,
    ) -> CogniaResult<()> {
        let mut perms = self.permissions.write().await;
        perms.grant_permission(plugin_id, permission)?;
        drop(perms);
        let _ = self.save_state().await;
        Ok(())
    }

    /// Revoke a permission from a plugin
    pub async fn revoke_permission(
        &self,
        plugin_id: &str,
        permission: &str,
    ) -> CogniaResult<()> {
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
        reg.get(plugin_id)
            .and_then(|p| p.manifest.ui.clone())
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
        state.disabled_plugins.insert("com.example.disabled".to_string());
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
        assert_eq!(restored.denied_permissions["com.example.plugin"], vec!["clipboard"]);
        assert_eq!(restored.granted_dangerous["com.example.plugin"], vec!["process_exec"]);
    }

    #[tokio::test]
    async fn test_persisted_state_save_and_load() {
        let temp_dir = tempfile::tempdir().unwrap();
        let plugins_dir = temp_dir.path().to_path_buf();

        let mut state = PersistedPluginState::default();
        state.disabled_plugins.insert("test-plugin".to_string());
        state.granted_dangerous.insert(
            "test-plugin".to_string(),
            vec!["config_write".to_string()],
        );

        state.save(&plugins_dir).await.unwrap();

        let loaded = PersistedPluginState::load(&plugins_dir).await;
        assert!(loaded.disabled_plugins.contains("test-plugin"));
        assert_eq!(loaded.granted_dangerous["test-plugin"], vec!["config_write"]);
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
        assert_eq!(path, std::path::PathBuf::from("/cognia/plugins/plugin-state.json"));
    }
}

/// Recursively copy a directory
async fn copy_dir_recursive(src: &Path, dst: &Path) -> CogniaResult<()> {
    tokio::fs::create_dir_all(dst)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to create dir {}: {}", dst.display(), e)))?;

    let mut entries = tokio::fs::read_dir(src)
        .await
        .map_err(|e| CogniaError::Plugin(format!("Failed to read dir {}: {}", src.display(), e)))?;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            Box::pin(copy_dir_recursive(&src_path, &dst_path)).await?;
        } else {
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
}
