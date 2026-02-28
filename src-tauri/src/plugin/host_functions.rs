use crate::config::Settings;
use crate::provider::registry::ProviderRegistry;
use crate::plugin::permissions::PermissionManager;
use crate::plugin::registry::PluginRegistry as CogniaPluginRegistry;
use extism::{host_fn, UserData, ValType, Error as ExtismError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// ============================================================================
// Host Context — shared state available to all host functions
// ============================================================================

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
}

impl HostContext {
    pub fn new(
        registry: Arc<RwLock<ProviderRegistry>>,
        settings: Arc<RwLock<Settings>>,
        permissions: Arc<RwLock<PermissionManager>>,
        plugin_registry: Arc<RwLock<CogniaPluginRegistry>>,
    ) -> Self {
        Self {
            registry,
            settings,
            permissions,
            plugin_registry,
            current_plugin_id: Arc::new(RwLock::new(String::new())),
        }
    }

    /// Set the current plugin ID before making a WASM call
    pub async fn set_current_plugin(&self, plugin_id: &str) {
        let mut id = self.current_plugin_id.write().await;
        *id = plugin_id.to_string();
    }
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
    let ctx = ctx.lock().unwrap();

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "config_read")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    let parsed: HashMap<String, String> = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let key = parsed.get("key").ok_or_else(|| ExtismError::msg("Missing 'key'"))?;
    let value = parsed.get("value").ok_or_else(|| ExtismError::msg("Missing 'value'"))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "config_write")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "env_read")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "env_read")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct SearchInput {
        query: String,
        provider: Option<String>,
    }

    let search: SearchInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_search")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        perms.check_fs_access(&plugin_id, &full_path, false)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct FsWriteInput { path: String, content: String }

    let fs_input: FsWriteInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        perms.check_fs_access(&plugin_id, &full_path, true)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct HttpInput { url: String }

    let http_input: HttpInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_http_access(&plugin_id, &http_input.url)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        drop(perms);

        let client = reqwest::Client::new();
        let response = client.get(&http_input.url)
            .header("User-Agent", "CogniaLauncher-Plugin/0.1.0")
            .send()
            .await
            .map_err(|e| ExtismError::msg(format!("HTTP request failed: {}", e)))?;

        let status = response.status().as_u16();
        let body = response.text().await
            .map_err(|e| ExtismError::msg(format!("Failed to read response: {}", e)))?;

        Ok::<_, ExtismError>(serde_json::json!({
            "status": status,
            "body": body
        }).to_string())
    })?;

    Ok(result)
});

// --- i18n ---

// Get the current application locale. Always allowed.
// Input: (empty string)
// Output: JSON { "locale": "en" | "zh" }
host_fn!(pub cognia_get_locale(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().unwrap();

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct DetectInput { env_type: String }

    let detect: DetectInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "env_read")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct PkgInput { name: String, provider: Option<String> }

    let pkg: PkgInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_search")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct ListInput { provider: Option<String> }

    let list_input: ListInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_search")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct InstallInput { name: String, version: Option<String>, provider: Option<String> }

    let install: InstallInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_install")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "env_read")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
// Input: JSON { "level": "info|warn|error|debug", "message": "..." }
// Output: JSON { "ok": true }
host_fn!(pub cognia_log(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct LogInput { level: String, message: String }

    let log_input: LogInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let plugin_id = rt.block_on(async {
        ctx.current_plugin_id.read().await.clone()
    });

    match log_input.level.as_str() {
        "error" => log::error!("[plugin:{}] {}", plugin_id, log_input.message),
        "warn" => log::warn!("[plugin:{}] {}", plugin_id, log_input.message),
        "debug" => log::debug!("[plugin:{}] {}", plugin_id, log_input.message),
        _ => log::info!("[plugin:{}] {}", plugin_id, log_input.message),
    }

    Ok(r#"{"ok":true}"#.to_string())
});

// --- Package Management (extended) ---

// Uninstall a package. Requires: pkg_install permission.
// Input: JSON { "name": "express", "version": null, "provider": "npm" | null }
// Output: JSON { "ok": true }
host_fn!(pub cognia_pkg_uninstall(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct UninstallInput { name: String, version: Option<String>, provider: Option<String> }

    let req: UninstallInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_install")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct VersionsInput { name: String, provider: Option<String> }

    let req: VersionsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_search")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct DepsInput { name: String, version: String, provider: Option<String> }

    let req: DepsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_search")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct UpdatesInput { packages: Vec<String>, provider: String }

    let req: UpdatesInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_search")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct EnvInput { env_type: String }

    let req: EnvInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "env_read")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct EnvInput { env_type: String }

    let req: EnvInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "env_read")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct InstallEnvInput { env_type: String, version: String }

    let req: InstallEnvInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_install")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SetVersionInput { env_type: String, version: String }

    let req: SetVersionInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "pkg_install")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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

// Execute a shell command. Requires: process_exec permission (dangerous).
// Input: JSON { "command": "node", "args": ["--version"], "cwd": null }
// Output: JSON { "exitCode": 0, "stdout": "...", "stderr": "..." }
host_fn!(pub cognia_process_exec(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct ExecInput {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        cwd: Option<String>,
    }

    let req: ExecInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "process_exec")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        drop(perms);

        let mut cmd = tokio::process::Command::new(&req.command);
        cmd.args(&req.args);
        if let Some(cwd) = &req.cwd {
            cmd.current_dir(cwd);
        }
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let output = tokio::time::timeout(
            std::time::Duration::from_secs(60),
            cmd.output(),
        ).await
            .map_err(|_| ExtismError::msg("Process execution timed out (60s)"))?
            .map_err(|e| ExtismError::msg(format!("Failed to execute command: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        Ok::<_, ExtismError>(serde_json::json!({
            "exitCode": exit_code,
            "stdout": stdout,
            "stderr": stderr,
        }).to_string())
    })?;

    Ok(result)
});

// --- Clipboard ---

// Read clipboard text. Requires: clipboard permission.
// Input: (empty string)
// Output: JSON { "text": "..." }
host_fn!(pub cognia_clipboard_read(user_data: HostContext; _input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().unwrap();

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "clipboard")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct ClipInput { text: String }

    let req: ClipInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "clipboard")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct NotifInput { title: String, body: String }

    let req: NotifInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_permission(&plugin_id, "notification")
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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

// --- HTTP (extended) ---

// Make an HTTP POST request. Requires: http permission + URL in allowed domains.
// Input: JSON { "url": "https://...", "body": "...", "contentType": "application/json" }
// Output: JSON { "status": 200, "body": "..." }
host_fn!(pub cognia_http_post(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().unwrap();

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

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        perms.check_http_access(&plugin_id, &req.url)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
        drop(perms);

        let client = reqwest::Client::new();
        let response = client.post(&req.url)
            .header("User-Agent", "CogniaLauncher-Plugin/0.1.0")
            .header("Content-Type", &req.content_type)
            .body(req.body.clone())
            .send()
            .await
            .map_err(|e| ExtismError::msg(format!("HTTP POST failed: {}", e)))?;

        let status = response.status().as_u16();
        let body = response.text().await
            .map_err(|e| ExtismError::msg(format!("Failed to read response: {}", e)))?;

        Ok::<_, ExtismError>(serde_json::json!({
            "status": status,
            "body": body
        }).to_string())
    })?;

    Ok(result)
});

// --- File System (extended) ---

// List files in plugin data directory. Requires: fs_read permission.
// Input: JSON { "path": "relative/dir" }
// Output: JSON array of { name, isDir, size }
host_fn!(pub cognia_fs_list_dir(user_data: HostContext; input: String) -> String {
    let ctx = user_data.get()?;
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        perms.check_fs_access(&plugin_id, &full_path, false)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        perms.check_fs_access(&plugin_id, &full_path, true)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        perms.check_fs_access(&plugin_id, &full_path, false)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct FsInput { path: String }

    let fs_input: FsInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        let perms = ctx.permissions.read().await;
        let data_dir = perms.get_plugin_data_dir(&plugin_id);
        let full_path = data_dir.join(&fs_input.path);
        perms.check_fs_access(&plugin_id, &full_path, true)
            .map_err(|e| ExtismError::msg(e.to_string()))?;
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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct TranslateInput {
        key: String,
        #[serde(default)]
        params: HashMap<String, String>,
    }

    let req: TranslateInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();

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
    let ctx = ctx.lock().unwrap();

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();

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
    let ctx = ctx.lock().unwrap();

    #[derive(Deserialize)]
    struct EventInput { name: String, payload: serde_json::Value }

    let req: EventInput = serde_json::from_str(&input)
        .map_err(|e| ExtismError::msg(format!("Invalid input: {}", e)))?;

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
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
    let ctx = ctx.lock().unwrap();

    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());

    let result = rt.block_on(async {
        let plugin_id = ctx.current_plugin_id.read().await.clone();
        Ok::<_, ExtismError>(serde_json::json!({ "pluginId": plugin_id }).to_string())
    })?;

    Ok(result)
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
            user_data,
            cognia_get_plugin_id,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Settings;
    use crate::plugin::permissions::PermissionManager;
    use crate::provider::registry::ProviderRegistry;
    use std::path::PathBuf;

    fn make_host_context() -> HostContext {
        let registry = Arc::new(RwLock::new(ProviderRegistry::new()));
        let settings = Arc::new(RwLock::new(Settings::default()));
        let permissions = Arc::new(RwLock::new(
            PermissionManager::new(PathBuf::from("/tmp/test-data")),
        ));
        let plugin_registry = Arc::new(RwLock::new(
            CogniaPluginRegistry::new(PathBuf::from("/tmp/test-plugins")),
        ));
        HostContext::new(registry, settings, permissions, plugin_registry)
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
    fn test_set_current_plugin() {
        let ctx = make_host_context();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            ctx.set_current_plugin("test-plugin-123").await;
            let id = ctx.current_plugin_id.read().await.clone();
            assert_eq!(id, "test-plugin-123");

            // Overwrite
            ctx.set_current_plugin("another-plugin").await;
            let id = ctx.current_plugin_id.read().await.clone();
            assert_eq!(id, "another-plugin");
        });
    }

    #[test]
    fn test_build_host_functions_count() {
        let ctx = make_host_context();
        let user_data = create_user_data(ctx);
        let functions = build_host_functions(user_data);
        // 16 original + 19 extended + 2 events/meta = 37 host functions
        assert_eq!(functions.len(), 37);
    }

    #[test]
    fn test_host_context_clone() {
        let ctx = make_host_context();
        let ctx2 = ctx.clone();
        // Both share the same Arc references
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            ctx.set_current_plugin("shared-id").await;
            let id = ctx2.current_plugin_id.read().await.clone();
            assert_eq!(id, "shared-id");
        });
    }
}
