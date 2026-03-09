use crate::error::{CogniaError, CogniaResult};
use crate::plugin::host_functions::{self, EmittedPluginEvent, HostContext};
use extism::{Manifest, Plugin, Wasm};
use std::collections::HashMap;
use std::path::Path;

/// Maximum execution time for a single plugin call (30 seconds)
const MAX_EXECUTION_SECS: u64 = 30;

/// Manages loaded WASM plugin instances via Extism
pub struct PluginLoader {
    /// plugin_id -> loaded Extism Plugin instance
    instances: HashMap<String, Plugin>,
    /// Shared host context for all plugins (provides access to launcher APIs)
    host_context: HostContext,
}

impl PluginLoader {
    fn log_runtime_boundary(
        plugin_id: &str,
        operation: &str,
        stage: &str,
        detail: impl AsRef<str>,
    ) {
        log::warn!(
            "[plugin-runtime][plugin:{}][operation:{}][stage:{}] {}",
            plugin_id,
            operation,
            stage,
            detail.as_ref()
        );
    }

    pub fn new(host_context: HostContext) -> Self {
        Self {
            instances: HashMap::new(),
            host_context,
        }
    }

    /// Load a plugin from a WASM file, registering host functions
    pub fn load(&mut self, plugin_id: &str, wasm_path: &Path) -> CogniaResult<()> {
        if !wasm_path.exists() {
            return Err(CogniaError::Plugin(format!(
                "WASM file not found: {}",
                wasm_path.display()
            )));
        }

        let wasm = Wasm::file(wasm_path);
        let manifest =
            Manifest::new([wasm]).with_timeout(std::time::Duration::from_secs(MAX_EXECUTION_SECS));

        // Build host functions with shared launcher context
        let user_data = host_functions::create_user_data(self.host_context.clone());
        let functions = host_functions::build_host_functions(user_data);

        let plugin = Plugin::new(&manifest, functions, true).map_err(|e| {
            CogniaError::Plugin(format!(
                "Failed to load WASM plugin '{}' from {}: {}",
                plugin_id,
                wasm_path.display(),
                e
            ))
        })?;

        self.instances.insert(plugin_id.to_string(), plugin);
        log::info!("Loaded WASM plugin '{}' with host functions", plugin_id);
        Ok(())
    }

    /// Unload a plugin instance
    pub fn unload(&mut self, plugin_id: &str) -> bool {
        let removed = self.instances.remove(plugin_id).is_some();
        if removed {
            log::info!("Unloaded WASM plugin '{}'", plugin_id);
        }
        removed
    }

    /// Call an exported function on a loaded plugin.
    /// Sets the current plugin ID in HostContext before the call so host functions
    /// can perform permission checks against the correct plugin.
    pub async fn call_function(
        &mut self,
        plugin_id: &str,
        function_name: &str,
        input: &str,
    ) -> CogniaResult<String> {
        // Set current plugin ID for host function permission checks
        self.host_context.set_current_plugin(plugin_id).await;

        let plugin = self
            .instances
            .get_mut(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' is not loaded", plugin_id)))?;

        // Check if the function exists
        if !plugin.function_exists(function_name) {
            return Err(CogniaError::Plugin(format!(
                "Function '{}' not found in plugin '{}'",
                function_name, plugin_id
            )));
        }

        let call_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            plugin
                .call::<&str, &str>(function_name, input)
                .map(|result| result.to_string())
        }));
        let result = match call_result {
            Ok(Ok(result)) => result,
            Ok(Err(e)) => {
                Self::log_runtime_boundary(
                    plugin_id,
                    function_name,
                    "wasm-call",
                    format!("plugin call returned error: {}", e),
                );
                return Err(CogniaError::Plugin(format!(
                    "Plugin '{}' function '{}' failed: {}",
                    plugin_id, function_name, e
                )));
            }
            Err(_) => {
                Self::log_runtime_boundary(
                    plugin_id,
                    function_name,
                    "wasm-call",
                    "plugin call panicked while executing function",
                );
                return Err(CogniaError::Plugin(format!(
                    "Plugin '{}' function '{}' panicked while executing",
                    plugin_id, function_name
                )));
            }
        };

        Ok(result)
    }

    pub async fn clear_emitted_events(&self) {
        self.host_context.clear_emitted_events().await;
    }

    pub async fn drain_emitted_events(&self) -> Vec<EmittedPluginEvent> {
        self.host_context.drain_emitted_events().await
    }

    /// Check if a plugin is loaded
    pub fn is_loaded(&self, plugin_id: &str) -> bool {
        self.instances.contains_key(plugin_id)
    }

    /// Reload a plugin (unload + load)
    pub fn reload(&mut self, plugin_id: &str, wasm_path: &Path) -> CogniaResult<()> {
        self.unload(plugin_id);
        self.load(plugin_id, wasm_path)
    }

    /// Call a function on a plugin if it exists, ignoring if the function is not exported.
    /// Used for optional lifecycle hooks (cognia_on_install, cognia_on_enable, etc.)
    pub async fn call_if_exists(
        &mut self,
        plugin_id: &str,
        function_name: &str,
        input: &str,
    ) -> Option<String> {
        self.host_context.set_current_plugin(plugin_id).await;
        let plugin = self.instances.get_mut(plugin_id)?;
        if !plugin.function_exists(function_name) {
            return None;
        }
        let call_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            plugin
                .call::<&str, &str>(function_name, input)
                .map(|result| result.to_string())
        }));
        match call_result {
            Ok(Ok(result)) => Some(result),
            Ok(Err(e)) => {
                Self::log_runtime_boundary(
                    plugin_id,
                    function_name,
                    "lifecycle-hook",
                    format!("lifecycle hook failed: {}", e),
                );
                None
            }
            Err(_) => {
                Self::log_runtime_boundary(
                    plugin_id,
                    function_name,
                    "lifecycle-hook",
                    "lifecycle hook panicked while executing",
                );
                None
            }
        }
    }

    /// Get list of loaded plugin IDs
    pub fn loaded_plugins(&self) -> Vec<String> {
        self.instances.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Settings;
    use crate::plugin::permissions::PermissionManager;
    use crate::provider::registry::ProviderRegistry;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    fn make_loader() -> PluginLoader {
        let registry = Arc::new(RwLock::new(ProviderRegistry::new()));
        let settings = Arc::new(RwLock::new(Settings::default()));
        let permissions = Arc::new(RwLock::new(PermissionManager::new(
            std::path::PathBuf::from("/tmp/test-data"),
        )));
        let plugin_registry = Arc::new(RwLock::new(crate::plugin::registry::PluginRegistry::new(
            std::path::PathBuf::from("/tmp/test-plugins"),
        )));
        let ctx = HostContext::new(registry, settings, permissions, plugin_registry);
        PluginLoader::new(ctx)
    }

    #[test]
    fn test_new_loader_has_no_plugins() {
        let loader = make_loader();
        assert!(loader.loaded_plugins().is_empty());
        assert!(!loader.is_loaded("anything"));
    }

    #[test]
    fn test_load_nonexistent_wasm_fails() {
        let mut loader = make_loader();
        let result = loader.load("test", Path::new("/nonexistent/plugin.wasm"));
        assert!(result.is_err());
        assert!(!loader.is_loaded("test"));
    }

    #[test]
    fn test_unload_nonexistent_returns_false() {
        let mut loader = make_loader();
        assert!(!loader.unload("nonexistent"));
    }

    #[test]
    fn test_reload_nonexistent_wasm_fails() {
        let mut loader = make_loader();
        let result = loader.reload("test", Path::new("/nonexistent/plugin.wasm"));
        assert!(result.is_err());
    }

    #[test]
    fn test_call_function_not_loaded_fails() {
        let mut loader = make_loader();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(loader.call_function("not-loaded", "fn", "{}"));
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("not loaded"));
    }

    #[test]
    fn test_call_if_exists_not_loaded_returns_none() {
        let mut loader = make_loader();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(loader.call_if_exists("not-loaded", "hook", "{}"));
        assert!(result.is_none());
    }
}
