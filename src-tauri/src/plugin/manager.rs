use crate::config::Settings;
use crate::download::{DownloadManager, DownloadState, DownloadTask};
use crate::error::{CogniaError, CogniaResult};
use crate::plugin::contract::evaluate_manifest_compatibility;
use crate::plugin::extension_points::get_tool_plugin_point;
use crate::plugin::host_functions::{EmittedPluginLog, EmittedPluginUiEffect, HostContext};
use crate::plugin::loader::PluginLoader;
use crate::plugin::manifest::PluginManifest;
use crate::plugin::permissions::{PermissionEnforcementMode, PermissionManager};
use crate::plugin::registry::{
    PluginInfo, PluginRegistry, PluginSource, PluginToolInfo, BUILTIN_MARKER_FILE,
};
use crate::provider::registry::ProviderRegistry;
use crate::resolver::version::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
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

const BUILTIN_CATALOG_FILE: &str = "manifest.json";
const MARKETPLACE_CATALOG_FILE: &str = "marketplace.json";
const BUILTIN_SYNC_STATE_FILE: &str = "builtin-sync-state.json";
const BUILTIN_SOURCE_ENV: &str = "COGNIA_BUILTIN_PLUGINS_DIR";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuiltInSyncState {
    #[serde(default)]
    entries: HashMap<String, BuiltInSyncEntry>,
}

impl BuiltInSyncState {
    fn state_path(plugins_dir: &Path) -> PathBuf {
        plugins_dir.join(BUILTIN_SYNC_STATE_FILE)
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
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                CogniaError::Plugin(format!(
                    "Failed to create built-in sync state dir {}: {}",
                    parent.display(),
                    e
                ))
            })?;
        }
        let content = serde_json::to_string_pretty(self).map_err(|e| {
            CogniaError::Plugin(format!("Failed to serialize built-in sync state: {}", e))
        })?;
        tokio::fs::write(&path, content).await.map_err(|e| {
            CogniaError::Plugin(format!("Failed to write built-in sync state: {}", e))
        })?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuiltInSyncEntry {
    status: String,
    version: String,
    checksum_sha256: String,
    message: Option<String>,
    updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuiltInCatalog {
    plugins: Vec<BuiltInCatalogPlugin>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuiltInCatalogPlugin {
    id: String,
    version: String,
    framework: String,
    plugin_dir: String,
    artifact: String,
    checksum_sha256: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketplaceCatalog {
    listings: Vec<MarketplaceCatalogListing>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketplaceCatalogListing {
    id: String,
    plugin_id: String,
    version: String,
    source: MarketplaceCatalogSource,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketplaceCatalogSource {
    store_id: String,
    #[serde(default)]
    plugin_dir: String,
    #[serde(default = "default_marketplace_artifact")]
    artifact: String,
    checksum_sha256: String,
    #[serde(default)]
    download_url: Option<String>,
    #[serde(default)]
    mirror_urls: Vec<String>,
    #[serde(default)]
    size_bytes: Option<u64>,
}

fn default_marketplace_artifact() -> String {
    "plugin.wasm".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuiltInMarker {
    plugin_id: String,
    version: String,
    checksum_sha256: String,
    synced_at: String,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginActionReport {
    pub plugin_id: String,
    pub phase: String,
    pub download_task_id: Option<String>,
}

/// Shared state references needed by the plugin system
pub struct PluginDeps {
    pub registry: Arc<RwLock<ProviderRegistry>>,
    pub settings: Arc<RwLock<Settings>>,
    pub download_manager: Option<Arc<RwLock<DownloadManager>>>,
    pub app_handle: Option<tauri::AppHandle>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginToolCallResult {
    pub output: String,
    pub ui_effects: Vec<EmittedPluginUiEffect>,
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
const MAX_CAPABILITY_AUDIT_RECORDS: usize = 500;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityAuditRecord {
    pub plugin_id: String,
    pub tool_entry: String,
    pub permission: String,
    pub capability: String,
    pub allowed: bool,
    pub timestamp: String,
    pub reason: Option<String>,
}

fn permission_to_capability(permission: &str) -> Option<&'static str> {
    match permission {
        "ui_feedback" => Some("ui.feedback"),
        "ui_dialog" => Some("ui.dialog"),
        "ui_file_picker" => Some("ui.file-picker"),
        "ui_navigation" => Some("ui.navigation"),
        "config_read" => Some("settings.read"),
        "config_write" => Some("settings.write"),
        "env_read" => Some("environment.read"),
        "pkg_search" => Some("packages.search"),
        "pkg_install" => Some("packages.install"),
        "clipboard" => Some("clipboard.readwrite"),
        "notification" => Some("notification.send"),
        "process_exec" => Some("process.exec"),
        "fs_read" => Some("fs.read"),
        "fs_write" => Some("fs.write"),
        "http" => Some("http.request"),
        _ => None,
    }
}

fn incompatible_plugin_error(plugin_id: &str, reason: Option<&str>) -> CogniaError {
    CogniaError::Plugin(format!(
        "Plugin '{}' is incompatible with current host: {}",
        plugin_id,
        reason.unwrap_or("unspecified compatibility failure")
    ))
}

/// Central plugin manager that coordinates registry, loader, and permissions
pub struct PluginManager {
    registry: Arc<RwLock<PluginRegistry>>,
    loader: PluginLoader,
    permissions: Arc<RwLock<PermissionManager>>,
    settings: Arc<RwLock<Settings>>,
    plugins_dir: PathBuf,
    health: HashMap<String, PluginHealth>,
    capability_audit: VecDeque<CapabilityAuditRecord>,
    builtin_sync: BuiltInSyncState,
    builtin_catalog_ids: HashSet<String>,
    builtin_source_override: Option<PathBuf>,
    download_manager: Option<Arc<RwLock<DownloadManager>>>,
}

impl PluginManager {
    pub fn new(base_dir: &Path, deps: PluginDeps) -> Self {
        let plugins_dir = base_dir.join("plugins");
        let data_dir = base_dir.join("plugin-data");
        let settings = deps.settings.clone();

        let permissions = Arc::new(RwLock::new(PermissionManager::new(data_dir)));
        let registry = Arc::new(RwLock::new(PluginRegistry::new(plugins_dir.clone())));

        // Create host context with access to launcher APIs + plugin registry for i18n
        let mut host_context = HostContext::new(
            deps.registry,
            deps.settings,
            permissions.clone(),
            registry.clone(),
            deps.app_handle,
        );
        host_context.download_manager = deps.download_manager.clone();

        let loader = PluginLoader::new(host_context);

        Self {
            registry,
            loader,
            permissions,
            settings,
            plugins_dir,
            health: HashMap::new(),
            capability_audit: VecDeque::new(),
            builtin_sync: BuiltInSyncState::default(),
            builtin_catalog_ids: HashSet::new(),
            builtin_source_override: None,
            download_manager: deps.download_manager,
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
        self.builtin_sync = BuiltInSyncState::load(&self.plugins_dir).await;

        // Sync built-ins into runtime storage before discovery.
        if let Err(e) = self.sync_builtin_plugins().await {
            log::warn!("Built-in plugin sync failed: {}", e);
        }

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
                let compatibility = evaluate_manifest_compatibility(&plugin.manifest);
                drop(reg);

                if !compatibility.compatible {
                    log::warn!(
                        "Disabling incompatible plugin '{}' during init: {}",
                        plugin_id,
                        compatibility
                            .reason
                            .as_deref()
                            .unwrap_or("unspecified compatibility failure")
                    );
                    let mut reg = self.registry.write().await;
                    if let Some(plugin) = reg.get_mut(plugin_id) {
                        plugin.enabled = false;
                    }
                    drop(reg);
                }

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

    async fn sync_builtin_plugins(&mut self) -> CogniaResult<()> {
        if !self.plugins_dir.exists() {
            tokio::fs::create_dir_all(&self.plugins_dir)
                .await
                .map_err(|e| {
                    CogniaError::Plugin(format!(
                        "Failed to create plugins dir for built-in sync {}: {}",
                        self.plugins_dir.display(),
                        e
                    ))
                })?;
        }

        let Some(source_root) = self.resolve_builtin_source_dir() else {
            self.builtin_catalog_ids.clear();
            self.builtin_sync.entries.clear();
            self.builtin_sync.save(&self.plugins_dir).await?;
            return Ok(());
        };

        let catalog = self.load_builtin_catalog(&source_root).await?;
        self.builtin_catalog_ids = catalog.plugins.iter().map(|p| p.id.clone()).collect();

        let mut entries = HashMap::new();
        for plugin in &catalog.plugins {
            let entry = match self.sync_single_builtin_plugin(&source_root, plugin).await {
                Ok((status, message)) => Self::make_builtin_sync_entry(plugin, status, message),
                Err(e) => {
                    log::warn!("Built-in sync failed for '{}': {}", plugin.id, e);
                    Self::make_builtin_sync_entry(plugin, "failed".to_string(), Some(e.to_string()))
                }
            };
            entries.insert(plugin.id.clone(), entry);
        }

        self.builtin_sync.entries = entries;
        self.builtin_sync.save(&self.plugins_dir).await
    }

    async fn sync_single_builtin_plugin(
        &self,
        source_root: &Path,
        plugin: &BuiltInCatalogPlugin,
    ) -> CogniaResult<(String, Option<String>)> {
        let plugin_dir_rel = Path::new(&plugin.plugin_dir);
        validate_safe_relative_path(plugin_dir_rel, "catalog.pluginDir")?;
        if plugin_dir_rel.as_os_str().is_empty() {
            return Err(CogniaError::Plugin(format!(
                "Catalog pluginDir is empty for '{}'",
                plugin.id
            )));
        }

        let artifact_rel = Path::new(&plugin.artifact);
        validate_safe_relative_path(artifact_rel, "catalog.artifact")?;
        if plugin.artifact != "plugin.wasm" {
            return Err(CogniaError::Plugin(format!(
                "Unsupported built-in artifact '{}' for '{}' (expected plugin.wasm)",
                plugin.artifact, plugin.id
            )));
        }

        let source_plugin_dir = source_root.join(plugin_dir_rel);
        let source_manifest_path = source_plugin_dir.join("plugin.toml");
        let source_artifact_path = source_plugin_dir.join(artifact_rel);

        ensure_dir_exists(&source_plugin_dir, "Built-in source plugin directory")?;
        ensure_file_exists(&source_manifest_path, "Built-in source plugin manifest")?;
        ensure_file_exists(&source_artifact_path, "Built-in source plugin artifact")?;

        let source_manifest = PluginManifest::from_file(&source_manifest_path)?;
        if source_manifest.plugin.id != plugin.id {
            return Err(CogniaError::Plugin(format!(
                "Catalog id '{}' does not match plugin.toml id '{}'",
                plugin.id, source_manifest.plugin.id
            )));
        }

        let source_checksum = Self::sha256_file(&source_artifact_path).await?;
        if !source_checksum.eq_ignore_ascii_case(plugin.checksum_sha256.as_str()) {
            return Err(CogniaError::Plugin(format!(
                "Built-in checksum mismatch for '{}': catalog={} source={}",
                plugin.id, plugin.checksum_sha256, source_checksum
            )));
        }

        let dest_plugin_dir = self.plugins_dir.join(&plugin.id);
        if !dest_plugin_dir.exists() {
            self.install_or_replace_builtin_plugin(plugin, &source_plugin_dir, &source_manifest)
                .await?;
            return Ok((
                "installed".to_string(),
                Some("Installed built-in plugin from bundled catalog.".to_string()),
            ));
        }

        let dest_metadata = tokio::fs::metadata(&dest_plugin_dir).await.map_err(|e| {
            CogniaError::Plugin(format!(
                "Failed to inspect runtime plugin directory {}: {}",
                dest_plugin_dir.display(),
                e
            ))
        })?;
        if !dest_metadata.is_dir() {
            return Ok((
                "conflict".to_string(),
                Some(format!(
                    "Existing runtime path for '{}' is not a directory; built-in sync skipped.",
                    plugin.id
                )),
            ));
        }

        let marker = match Self::read_builtin_marker(&dest_plugin_dir).await {
            Ok(Some(marker)) => marker,
            Ok(None) => {
                return Ok((
                    "conflict".to_string(),
                    Some(
                        "Existing plugin with same id is user-managed; built-in sync skipped."
                            .to_string(),
                    ),
                ));
            }
            Err(e) => {
                return Ok((
                    "conflict".to_string(),
                    Some(format!(
                        "Existing plugin has invalid built-in marker; sync skipped: {}",
                        e
                    )),
                ));
            }
        };

        if marker.plugin_id != plugin.id {
            return Ok((
                "conflict".to_string(),
                Some(format!(
                    "Built-in marker plugin id '{}' does not match catalog id '{}'; sync skipped.",
                    marker.plugin_id, plugin.id
                )),
            ));
        }

        let dest_artifact = dest_plugin_dir.join(artifact_rel);
        let artifact_matches_catalog = if dest_artifact.exists() {
            let dest_checksum = Self::sha256_file(&dest_artifact).await?;
            dest_checksum.eq_ignore_ascii_case(plugin.checksum_sha256.as_str())
        } else {
            false
        };

        let marker_matches_catalog = marker.version == plugin.version
            && marker
                .checksum_sha256
                .eq_ignore_ascii_case(plugin.checksum_sha256.as_str());

        if marker_matches_catalog && artifact_matches_catalog {
            return Ok(("upToDate".to_string(), None));
        }

        self.install_or_replace_builtin_plugin(plugin, &source_plugin_dir, &source_manifest)
            .await?;

        if marker.version == plugin.version {
            Ok((
                "upgraded".to_string(),
                Some("Refreshed built-in plugin because checksum changed.".to_string()),
            ))
        } else {
            Ok((
                "upgraded".to_string(),
                Some(format!(
                    "Upgraded built-in plugin from {} to {}.",
                    marker.version, plugin.version
                )),
            ))
        }
    }

    async fn install_or_replace_builtin_plugin(
        &self,
        plugin: &BuiltInCatalogPlugin,
        source_plugin_dir: &Path,
        source_manifest: &PluginManifest,
    ) -> CogniaResult<()> {
        let staging_parent = tempfile::Builder::new()
            .prefix(".builtin-sync-")
            .tempdir_in(&self.plugins_dir)
            .map_err(|e| {
                CogniaError::Plugin(format!("Failed to create built-in staging dir: {}", e))
            })?;
        let staging_plugin_dir = staging_parent.path().join(&plugin.id);

        copy_plugin_runtime_files(source_plugin_dir, &staging_plugin_dir, source_manifest).await?;

        let marker = BuiltInMarker {
            plugin_id: plugin.id.clone(),
            version: plugin.version.clone(),
            checksum_sha256: plugin.checksum_sha256.clone(),
            synced_at: chrono::Utc::now().to_rfc3339(),
        };
        Self::write_builtin_marker(&staging_plugin_dir, &marker).await?;

        let dest_plugin_dir = self.plugins_dir.join(&plugin.id);
        if dest_plugin_dir.exists() {
            tokio::fs::remove_dir_all(&dest_plugin_dir)
                .await
                .map_err(|e| {
                    CogniaError::Plugin(format!(
                        "Failed to remove existing built-in directory {}: {}",
                        dest_plugin_dir.display(),
                        e
                    ))
                })?;
        }

        tokio::fs::rename(&staging_plugin_dir, &dest_plugin_dir)
            .await
            .map_err(|e| {
                CogniaError::Plugin(format!(
                    "Failed to move staged built-in plugin {} -> {}: {}",
                    staging_plugin_dir.display(),
                    dest_plugin_dir.display(),
                    e
                ))
            })?;

        Ok(())
    }

    fn resolve_builtin_source_dir(&self) -> Option<PathBuf> {
        if let Some(override_dir) = &self.builtin_source_override {
            if Self::has_builtin_catalog(override_dir) {
                return Some(override_dir.clone());
            }
            log::warn!(
                "Built-in source override does not contain {}: {}",
                BUILTIN_CATALOG_FILE,
                override_dir.display()
            );
        }

        if let Ok(value) = std::env::var(BUILTIN_SOURCE_ENV) {
            let candidate = PathBuf::from(value);
            if Self::has_builtin_catalog(&candidate) {
                return Some(candidate);
            }
            log::warn!(
                "Built-in source env {} does not contain {}: {}",
                BUILTIN_SOURCE_ENV,
                BUILTIN_CATALOG_FILE,
                candidate.display()
            );
        }

        for candidate in self.builtin_source_candidates() {
            if Self::has_builtin_catalog(&candidate) {
                return Some(candidate);
            }
        }

        None
    }

    fn builtin_source_candidates(&self) -> Vec<PathBuf> {
        let mut candidates = Vec::new();

        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("plugins"));
            if let Some(found) = Self::find_plugins_dir_upwards(&cwd) {
                candidates.push(found);
            }
        }

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidates.push(exe_dir.join("plugins"));
                if let Some(found) = Self::find_plugins_dir_upwards(exe_dir) {
                    candidates.push(found);
                }
                candidates.push(exe_dir.join("resources").join("plugins"));

                if let Some(parent) = exe_dir.parent() {
                    candidates.push(parent.join("resources").join("plugins"));
                    candidates.push(parent.join("Resources").join("plugins"));
                    if let Some(grandparent) = parent.parent() {
                        candidates.push(grandparent.join("Resources").join("plugins"));
                    }
                }
            }
        }

        Self::dedup_paths(candidates)
    }

    fn find_plugins_dir_upwards(start: &Path) -> Option<PathBuf> {
        for ancestor in start.ancestors() {
            let candidate = ancestor.join("plugins");
            if Self::has_builtin_catalog(&candidate) {
                return Some(candidate);
            }
        }
        None
    }

    fn dedup_paths(candidates: Vec<PathBuf>) -> Vec<PathBuf> {
        let mut seen = HashSet::new();
        let mut result = Vec::new();

        for candidate in candidates {
            let normalized = candidate
                .canonicalize()
                .unwrap_or_else(|_| candidate.clone());
            if seen.insert(normalized) {
                result.push(candidate);
            }
        }

        result
    }

    fn has_builtin_catalog(path: &Path) -> bool {
        path.join(BUILTIN_CATALOG_FILE).is_file()
    }

    async fn load_builtin_catalog(&self, source_root: &Path) -> CogniaResult<BuiltInCatalog> {
        let catalog_path = source_root.join(BUILTIN_CATALOG_FILE);
        ensure_file_exists(&catalog_path, "Built-in catalog file")?;

        let raw = tokio::fs::read_to_string(&catalog_path)
            .await
            .map_err(|e| {
                CogniaError::Plugin(format!(
                    "Failed to read built-in catalog {}: {}",
                    catalog_path.display(),
                    e
                ))
            })?;

        let catalog: BuiltInCatalog = serde_json::from_str(&raw).map_err(|e| {
            CogniaError::Plugin(format!(
                "Invalid built-in catalog {}: {}",
                catalog_path.display(),
                e
            ))
        })?;

        Self::validate_builtin_catalog(&catalog)?;
        Ok(catalog)
    }

    async fn load_marketplace_catalog(
        &self,
        source_root: &Path,
    ) -> CogniaResult<MarketplaceCatalog> {
        let catalog_path = source_root.join(MARKETPLACE_CATALOG_FILE);
        ensure_file_exists(&catalog_path, "Marketplace catalog file")?;

        let raw = tokio::fs::read_to_string(&catalog_path)
            .await
            .map_err(|e| {
                CogniaError::Plugin(format!(
                    "Failed to read marketplace catalog {}: {}",
                    catalog_path.display(),
                    e
                ))
            })?;
        let catalog: MarketplaceCatalog = serde_json::from_str(&raw).map_err(|e| {
            CogniaError::Plugin(format!(
                "Invalid marketplace catalog {}: {}",
                catalog_path.display(),
                e
            ))
        })?;
        Self::validate_marketplace_catalog(&catalog)?;
        Ok(catalog)
    }

    fn validate_builtin_catalog(catalog: &BuiltInCatalog) -> CogniaResult<()> {
        if catalog.plugins.is_empty() {
            return Err(CogniaError::Plugin(
                "Built-in catalog must contain at least one plugin entry.".to_string(),
            ));
        }

        let mut seen_ids = HashSet::new();
        for plugin in &catalog.plugins {
            if !seen_ids.insert(plugin.id.clone()) {
                return Err(CogniaError::Plugin(format!(
                    "Duplicate built-in plugin id in catalog: {}",
                    plugin.id
                )));
            }

            if plugin.id.trim().is_empty() {
                return Err(CogniaError::Plugin(
                    "Built-in catalog entry has empty id.".to_string(),
                ));
            }

            if plugin.version.trim().is_empty() {
                return Err(CogniaError::Plugin(format!(
                    "Built-in catalog entry '{}' has empty version.",
                    plugin.id
                )));
            }
            let _: Version = plugin.version.parse().map_err(|e| {
                CogniaError::Plugin(format!(
                    "Built-in catalog entry '{}' has invalid version '{}': {}",
                    plugin.id, plugin.version, e
                ))
            })?;

            if plugin.framework != "rust" && plugin.framework != "typescript" {
                return Err(CogniaError::Plugin(format!(
                    "Built-in catalog entry '{}' has unsupported framework '{}'.",
                    plugin.id, plugin.framework
                )));
            }

            validate_safe_relative_path(Path::new(&plugin.plugin_dir), "catalog.pluginDir")?;
            if Path::new(&plugin.plugin_dir).as_os_str().is_empty() {
                return Err(CogniaError::Plugin(format!(
                    "Built-in catalog entry '{}' has empty pluginDir.",
                    plugin.id
                )));
            }

            validate_safe_relative_path(Path::new(&plugin.artifact), "catalog.artifact")?;
            if plugin.artifact != "plugin.wasm" {
                return Err(CogniaError::Plugin(format!(
                    "Built-in catalog entry '{}' must use artifact 'plugin.wasm', got '{}'.",
                    plugin.id, plugin.artifact
                )));
            }

            if !Self::is_valid_sha256(plugin.checksum_sha256.as_str()) {
                return Err(CogniaError::Plugin(format!(
                    "Built-in catalog entry '{}' has invalid checksumSha256 '{}'.",
                    plugin.id, plugin.checksum_sha256
                )));
            }
        }

        Ok(())
    }

    fn is_valid_sha256(value: &str) -> bool {
        value.len() == 64 && value.chars().all(|c| c.is_ascii_hexdigit())
    }

    async fn sha256_file(path: &Path) -> CogniaResult<String> {
        ensure_file_exists(path, "Artifact for sha256")?;
        let bytes = tokio::fs::read(path).await.map_err(|e| {
            CogniaError::Plugin(format!(
                "Failed to read artifact for checksum {}: {}",
                path.display(),
                e
            ))
        })?;
        Ok(format!("{:x}", Sha256::digest(bytes)))
    }

    fn make_builtin_sync_entry(
        plugin: &BuiltInCatalogPlugin,
        status: String,
        message: Option<String>,
    ) -> BuiltInSyncEntry {
        BuiltInSyncEntry {
            status,
            version: plugin.version.clone(),
            checksum_sha256: plugin.checksum_sha256.clone(),
            message,
            updated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    async fn read_builtin_marker(plugin_dir: &Path) -> CogniaResult<Option<BuiltInMarker>> {
        let marker_path = plugin_dir.join(BUILTIN_MARKER_FILE);
        if !marker_path.exists() {
            return Ok(None);
        }

        let raw = tokio::fs::read_to_string(&marker_path).await.map_err(|e| {
            CogniaError::Plugin(format!(
                "Failed to read built-in marker {}: {}",
                marker_path.display(),
                e
            ))
        })?;

        let marker = serde_json::from_str::<BuiltInMarker>(&raw).map_err(|e| {
            CogniaError::Plugin(format!(
                "Invalid built-in marker {}: {}",
                marker_path.display(),
                e
            ))
        })?;

        Ok(Some(marker))
    }

    async fn write_builtin_marker(plugin_dir: &Path, marker: &BuiltInMarker) -> CogniaResult<()> {
        let marker_path = plugin_dir.join(BUILTIN_MARKER_FILE);
        if let Some(parent) = marker_path.parent() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                CogniaError::Plugin(format!(
                    "Failed to create built-in marker dir {}: {}",
                    parent.display(),
                    e
                ))
            })?;
        }

        let content = serde_json::to_string_pretty(marker).map_err(|e| {
            CogniaError::Plugin(format!("Failed to serialize built-in marker: {}", e))
        })?;

        tokio::fs::write(&marker_path, content).await.map_err(|e| {
            CogniaError::Plugin(format!(
                "Failed to write built-in marker {}: {}",
                marker_path.display(),
                e
            ))
        })?;

        Ok(())
    }

    async fn install_from_dir(
        &mut self,
        source_path: &Path,
        source: PluginSource,
        allow_replace: bool,
        expected_plugin_id: Option<&str>,
        expected_version: Option<&str>,
        expected_checksum_sha256: Option<&str>,
    ) -> CogniaResult<String> {
        // Read manifest
        let manifest_path = source_path.join("plugin.toml");
        let manifest = PluginManifest::from_file(&manifest_path)?;
        let plugin_id = manifest.plugin.id.clone();
        if let Some(expected_plugin_id) = expected_plugin_id {
            if plugin_id != expected_plugin_id {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace plugin id mismatch: expected '{}', got '{}'",
                    expected_plugin_id, plugin_id
                )));
            }
        }
        if let Some(expected_version) = expected_version {
            if manifest.plugin.version != expected_version {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace plugin version mismatch for '{}': expected '{}', got '{}'",
                    plugin_id, expected_version, manifest.plugin.version
                )));
            }
        }

        let compatibility = evaluate_manifest_compatibility(&manifest);
        if !compatibility.compatible {
            return Err(incompatible_plugin_error(
                &plugin_id,
                compatibility.reason.as_deref(),
            ));
        }

        // Check if already installed
        {
            let mut reg = self.registry.write().await;
            if reg.contains(&plugin_id) {
                if !allow_replace {
                    return Err(CogniaError::Plugin(format!(
                        "Plugin '{}' is already installed",
                        plugin_id
                    )));
                }
                reg.unregister(&plugin_id);
            }
        }
        if allow_replace {
            self.loader.unload(&plugin_id);
            let mut perms = self.permissions.write().await;
            perms.unregister_plugin(&plugin_id);
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

        if let Some(expected_checksum_sha256) = expected_checksum_sha256 {
            let source_checksum = Self::sha256_file(&source_path.join("plugin.wasm")).await?;
            if !source_checksum.eq_ignore_ascii_case(expected_checksum_sha256) {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace checksum mismatch for '{}': expected {}, got {}",
                    plugin_id, expected_checksum_sha256, source_checksum
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
            reg.register(manifest.clone(), wasm_path.clone(), dest_dir, source);
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

    /// Install a plugin from a local directory path
    pub async fn install_from_path(&mut self, source_path: &Path) -> CogniaResult<String> {
        self.install_from_dir(
            source_path,
            PluginSource::Local {
                path: source_path.display().to_string(),
            },
            false,
            None,
            None,
            None,
        )
        .await
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
        self.install_from_dir(
            temp_dir.path(),
            PluginSource::Url {
                url: url.to_string(),
            },
            false,
            None,
            None,
            None,
        )
        .await
    }

    async fn wait_for_download_task_completion(&self, task_id: &str) -> CogniaResult<()> {
        let Some(download_manager) = self.download_manager.clone() else {
            return Err(CogniaError::Plugin(
                "Download manager is unavailable for marketplace operations.".to_string(),
            ));
        };

        let deadline = tokio::time::Instant::now() + Duration::from_secs(15 * 60);
        loop {
            if tokio::time::Instant::now() > deadline {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace download timed out for task '{}'.",
                    task_id
                )));
            }

            let task = {
                let mgr = download_manager.read().await;
                mgr.get_task(task_id).await
            };

            let Some(task) = task else {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace download task '{}' was not found.",
                    task_id
                )));
            };

            match task.state {
                DownloadState::Completed => return Ok(()),
                DownloadState::Cancelled => {
                    return Err(CogniaError::Plugin(
                        "Marketplace download cancelled by user.".to_string(),
                    ));
                }
                DownloadState::Failed { error, recoverable } => {
                    return Err(CogniaError::Plugin(format!(
                        "Marketplace download failed (recoverable={}): {}",
                        recoverable, error
                    )));
                }
                _ => {
                    tokio::time::sleep(Duration::from_millis(150)).await;
                }
            }
        }
    }

    async fn queue_marketplace_download(
        &self,
        listing: &MarketplaceCatalogListing,
        action_kind: &str,
        download_url: &str,
        destination: &Path,
    ) -> CogniaResult<String> {
        let Some(download_manager) = self.download_manager.clone() else {
            return Err(CogniaError::Plugin(
                "Download manager is unavailable for marketplace operations.".to_string(),
            ));
        };

        let mut builder = DownloadTask::builder(
            download_url.to_string(),
            destination.to_path_buf(),
            format!("Marketplace {} {}", action_kind, listing.id),
        )
        .with_priority(90)
        .with_provider("plugin-marketplace".to_string())
        .with_tag("plugin-marketplace".to_string())
        .with_tag(action_kind.to_string())
        .with_metadata("listingId".to_string(), listing.id.clone())
        .with_metadata("pluginId".to_string(), listing.plugin_id.clone())
        .with_metadata("actionKind".to_string(), action_kind.to_string());

        if !listing.source.checksum_sha256.trim().is_empty() {
            builder = builder.with_checksum(listing.source.checksum_sha256.clone());
        }

        if !listing.source.mirror_urls.is_empty() {
            builder = builder.with_mirrors(listing.source.mirror_urls.clone());
        }

        let task_id = {
            let mgr = download_manager.read().await;
            mgr.add_task(builder.build()).await
        };

        self.wait_for_download_task_completion(&task_id).await?;
        Ok(task_id)
    }

    fn find_plugin_package_root(root: &Path) -> Option<PathBuf> {
        if root.join("plugin.toml").is_file() && root.join("plugin.wasm").is_file() {
            return Some(root.to_path_buf());
        }

        let mut stack = vec![root.to_path_buf()];
        let mut depth_map: HashMap<PathBuf, usize> = HashMap::new();
        depth_map.insert(root.to_path_buf(), 0);

        while let Some(dir) = stack.pop() {
            let depth = depth_map.get(&dir).copied().unwrap_or(0);
            if depth >= 4 {
                continue;
            }

            let entries = match std::fs::read_dir(&dir) {
                Ok(entries) => entries,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                if path.join("plugin.toml").is_file() && path.join("plugin.wasm").is_file() {
                    return Some(path);
                }
                depth_map.insert(path.clone(), depth + 1);
                stack.push(path);
            }
        }

        None
    }

    async fn install_from_marketplace_remote_package(
        &mut self,
        listing: &MarketplaceCatalogListing,
        download_url: &str,
    ) -> CogniaResult<PluginActionReport> {
        if !download_url.to_ascii_lowercase().ends_with(".zip") {
            return Err(CogniaError::Plugin(format!(
                "Marketplace download URL for '{}' must point to a .zip package.",
                listing.id
            )));
        }

        let temp_dir = tempfile::tempdir()
            .map_err(|e| CogniaError::Plugin(format!("Failed to create temp dir: {}", e)))?;
        let archive_path = temp_dir.path().join("marketplace-package.zip");
        let download_task_id = self
            .queue_marketplace_download(listing, "install", download_url, &archive_path)
            .await?;

        let extract_root = temp_dir.path().join("extracted");
        tokio::fs::create_dir_all(&extract_root)
            .await
            .map_err(|e| CogniaError::Plugin(format!("Failed to create extract dir: {}", e)))?;

        let archive_file = std::fs::File::open(&archive_path).map_err(|e| {
            CogniaError::Plugin(format!("Failed to open downloaded archive: {}", e))
        })?;
        let mut archive = zip::ZipArchive::new(archive_file)
            .map_err(|e| CogniaError::Plugin(format!("Invalid marketplace zip file: {}", e)))?;
        archive.extract(&extract_root).map_err(|e| {
            CogniaError::Plugin(format!("Failed to extract marketplace zip package: {}", e))
        })?;

        let source_dir = Self::find_plugin_package_root(&extract_root).ok_or_else(|| {
            CogniaError::Plugin(
                "Marketplace package is missing required plugin.toml/plugin.wasm files."
                    .to_string(),
            )
        })?;

        let plugin_id = self
            .install_from_dir(
                &source_dir,
                PluginSource::Store {
                    store_id: listing.source.store_id.clone(),
                },
                true,
                Some(listing.plugin_id.as_str()),
                Some(listing.version.as_str()),
                Some(listing.source.checksum_sha256.as_str()),
            )
            .await?;

        Ok(PluginActionReport {
            plugin_id,
            phase: "completed".to_string(),
            download_task_id: Some(download_task_id),
        })
    }

    pub async fn install_from_marketplace_with_report(
        &mut self,
        store_id: &str,
    ) -> CogniaResult<PluginActionReport> {
        let source_root = self.resolve_builtin_source_dir().ok_or_else(|| {
            CogniaError::Plugin(
                "Marketplace catalog is unavailable because plugin source root could not be resolved."
                    .to_string(),
            )
        })?;
        let catalog = self.load_marketplace_catalog(&source_root).await?;
        let listing = catalog
            .listings
            .into_iter()
            .find(|candidate| candidate.source.store_id == store_id || candidate.id == store_id)
            .ok_or_else(|| {
                CogniaError::Plugin(format!(
                    "Marketplace listing '{}' was not found in catalog.",
                    store_id
                ))
            })?;

        if !Self::is_valid_sha256(listing.source.checksum_sha256.as_str()) {
            return Err(CogniaError::Plugin(format!(
                "Marketplace listing '{}' has invalid checksum '{}'.",
                listing.id, listing.source.checksum_sha256
            )));
        }

        if let Some(download_url) = listing
            .source
            .download_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return self
                .install_from_marketplace_remote_package(&listing, download_url)
                .await;
        }

        validate_safe_relative_path(
            Path::new(&listing.source.plugin_dir),
            "marketplace.pluginDir",
        )?;
        validate_safe_relative_path(Path::new(&listing.source.artifact), "marketplace.artifact")?;

        let source_dir = source_root.join(&listing.source.plugin_dir);
        ensure_file_exists(
            &source_dir.join("plugin.toml"),
            "Marketplace plugin manifest",
        )?;
        ensure_file_exists(
            &source_dir.join(&listing.source.artifact),
            "Marketplace plugin artifact",
        )?;

        let plugin_id = self
            .install_from_dir(
                &source_dir,
                PluginSource::Store {
                    store_id: listing.source.store_id.clone(),
                },
                true,
                Some(listing.plugin_id.as_str()),
                Some(listing.version.as_str()),
                Some(listing.source.checksum_sha256.as_str()),
            )
            .await?;

        Ok(PluginActionReport {
            plugin_id,
            phase: "completed".to_string(),
            download_task_id: None,
        })
    }

    pub async fn install_from_marketplace(&mut self, store_id: &str) -> CogniaResult<String> {
        let report = self.install_from_marketplace_with_report(store_id).await?;
        Ok(report.plugin_id)
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
        let (manifest, wasm_path) = {
            let reg = self.registry.read().await;
            let plugin = reg
                .get(plugin_id)
                .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;
            (plugin.manifest.clone(), plugin.wasm_path.clone())
        };
        let compatibility = evaluate_manifest_compatibility(&manifest);
        if !compatibility.compatible {
            return Err(incompatible_plugin_error(
                plugin_id,
                compatibility.reason.as_deref(),
            ));
        }
        {
            let mut reg = self.registry.write().await;
            if let Some(plugin) = reg.get_mut(plugin_id) {
                plugin.enabled = true;
            }
        }

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
    ) -> CogniaResult<PluginToolCallResult> {
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

        // Verify plugin exists and is enabled, get wasm_path and declared capabilities
        let (wasm_path, tool_capabilities) = {
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

            let compatibility = evaluate_manifest_compatibility(&plugin.manifest);
            if !compatibility.compatible {
                return Err(incompatible_plugin_error(
                    plugin_id,
                    compatibility.reason.as_deref(),
                ));
            }

            // Verify tool exists in manifest and capture its declared capabilities
            let tool = plugin
                .manifest
                .tools
                .iter()
                .find(|t| t.entry == tool_entry)
                .ok_or_else(|| {
                    CogniaError::Plugin(format!(
                        "Tool entry '{}' not declared in plugin '{}'",
                        tool_entry, plugin_id
                    ))
                })?;

            if let Some(point) = get_tool_plugin_point(&plugin.manifest, tool_entry)? {
                if !point.discoverable {
                    return Err(CogniaError::Plugin(format!(
                        "Tool entry '{}' in plugin '{}' is blocked by plugin-point validation: {}",
                        tool_entry,
                        plugin_id,
                        point
                            .blocking_reason
                            .as_deref()
                            .unwrap_or("unknown plugin-point issue"),
                    )));
                }
            }

            (plugin.wasm_path.clone(), tool.capabilities.clone())
        };

        self.enforce_tool_capability_handshake(plugin_id, tool_entry, &tool_capabilities)
            .await?;

        // Lazy load WASM on first call
        if !self.loader.is_loaded(plugin_id) {
            self.loader.load(plugin_id, &wasm_path)?;
            self.loader
                .call_if_exists(plugin_id, "cognia_on_enable", "{}")
                .await;
            log::info!("Lazy-loaded WASM for plugin '{}'", plugin_id);
        }

        self.loader.clear_emitted_events().await;
        self.loader.clear_emitted_logs().await;
        self.loader.clear_emitted_ui_effects().await;

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

        let mut ui_effects = Vec::new();

        loop {
            let emitted_events = self.loader.drain_emitted_events().await;
            let emitted_logs = self.loader.drain_emitted_logs().await;
            let emitted_ui_effects = self.loader.drain_emitted_ui_effects().await;
            if emitted_events.is_empty() && emitted_logs.is_empty() && emitted_ui_effects.is_empty() {
                break;
            }

            if !emitted_ui_effects.is_empty() {
                ui_effects.extend(emitted_ui_effects);
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

            for emitted in emitted_logs {
                self.dispatch_log_with_meta(emitted).await;
            }
        }

        result.map(|output| PluginToolCallResult { output, ui_effects })
    }

    fn push_capability_audit(&mut self, record: CapabilityAuditRecord) {
        if self.capability_audit.len() >= MAX_CAPABILITY_AUDIT_RECORDS {
            self.capability_audit.pop_front();
        }
        self.capability_audit.push_back(record);
    }

    async fn enforce_tool_capability_handshake(
        &mut self,
        plugin_id: &str,
        tool_entry: &str,
        tool_capabilities: &[String],
    ) -> CogniaResult<()> {
        let (mode, granted_permissions) = {
            let perms = self.permissions.read().await;
            let mode = perms.mode();
            let granted = perms
                .get_state(plugin_id)
                .map(|state| state.granted.iter().cloned().collect::<Vec<_>>())
                .unwrap_or_default();
            (mode, granted)
        };

        if mode != PermissionEnforcementMode::Strict {
            return Ok(());
        }

        for permission in granted_permissions {
            let Some(required_capability) = permission_to_capability(&permission) else {
                continue;
            };
            let allowed = tool_capabilities
                .iter()
                .any(|cap| cap == required_capability);
            let reason = if allowed {
                None
            } else {
                Some(format!(
                    "Missing capability '{}' for granted permission '{}'",
                    required_capability, permission
                ))
            };
            self.push_capability_audit(CapabilityAuditRecord {
                plugin_id: plugin_id.to_string(),
                tool_entry: tool_entry.to_string(),
                permission: permission.clone(),
                capability: required_capability.to_string(),
                allowed,
                timestamp: chrono::Utc::now().to_rfc3339(),
                reason: reason.clone(),
            });

            if !allowed {
                return Err(CogniaError::Plugin(format!(
                    "Plugin '{}' tool '{}' failed capability handshake: {}",
                    plugin_id,
                    tool_entry,
                    reason.unwrap_or_else(|| "missing capability declaration".to_string())
                )));
            }
        }

        Ok(())
    }

    pub fn get_capability_audit(&self, plugin_id: Option<&str>) -> Vec<CapabilityAuditRecord> {
        self.capability_audit
            .iter()
            .filter(|record| plugin_id.map(|id| id == record.plugin_id).unwrap_or(true))
            .cloned()
            .collect()
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

    fn matches_log_listener_filter(filter: &str, source_type: &str) -> bool {
        filter == "*" || filter == source_type
    }

    async fn dispatch_log_with_meta(&mut self, record: EmittedPluginLog) {
        let listeners: Vec<(String, PathBuf)> = {
            let reg = self.registry.read().await;
            reg.iter()
                .filter(|(_, plugin)| {
                    plugin.enabled
                        && plugin
                            .manifest
                            .plugin
                            .listen_logs
                            .iter()
                            .any(|filter| Self::matches_log_listener_filter(filter, &record.source_type))
                })
                .map(|(id, plugin)| (id.clone(), plugin.wasm_path.clone()))
                .collect()
        };

        if listeners.is_empty() {
            return;
        }

        self.loader.set_log_dispatch_active(true).await;
        for (plugin_id, wasm_path) in &listeners {
            if !self.loader.is_loaded(plugin_id) {
                if let Err(error) = self.loader.load(plugin_id, wasm_path) {
                    log::warn!(
                        "[plugin-runtime][plugin:{}][operation:dispatch_log][stage:listener-load] failed to lazy-load log listener plugin: {}",
                        plugin_id,
                        error
                    );
                    continue;
                }
            }

            let input = serde_json::to_string(&record).unwrap_or_else(|_| "{}".to_string());
            let callback_output = self
                .loader
                .call_if_exists(plugin_id, "cognia_on_log", &input)
                .await;
            if callback_output.is_none() {
                log::warn!(
                    "[plugin-runtime][plugin:{}][operation:dispatch_log][stage:listener-callback] log listener callback failed or missing export for level '{}' (source={})",
                    plugin_id,
                    record.level,
                    record.source_type
                );
            }
        }
        self.loader.set_log_dispatch_active(false).await;

        if !listeners.is_empty() {
            log::debug!(
                "Dispatched log '{}' from {} to {} plugin(s)",
                record.level,
                record.source_type,
                listeners.len()
            );
        }

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

                let callback_output = self
                    .loader
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

            let emitted_logs = self.loader.drain_emitted_logs().await;
            for log_record in emitted_logs {
                self.dispatch_log_with_meta(log_record).await;
            }

            let emitted_after_logs = self.loader.drain_emitted_events().await;
            for event in emitted_after_logs {
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

    fn validate_marketplace_catalog(catalog: &MarketplaceCatalog) -> CogniaResult<()> {
        if catalog.listings.is_empty() {
            return Err(CogniaError::Plugin(
                "Marketplace catalog must contain at least one listing.".to_string(),
            ));
        }
        let mut seen_listing_ids = HashSet::new();
        let mut seen_store_ids = HashSet::new();
        for listing in &catalog.listings {
            if listing.id.trim().is_empty() {
                return Err(CogniaError::Plugin(
                    "Marketplace listing has empty id.".to_string(),
                ));
            }
            if !seen_listing_ids.insert(listing.id.clone()) {
                return Err(CogniaError::Plugin(format!(
                    "Duplicate marketplace listing id '{}'.",
                    listing.id
                )));
            }
            if listing.plugin_id.trim().is_empty() {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace listing '{}' has empty pluginId.",
                    listing.id
                )));
            }
            if listing.version.trim().is_empty() {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace listing '{}' has empty version.",
                    listing.id
                )));
            }
            if listing.source.store_id.trim().is_empty() {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace listing '{}' has empty source.storeId.",
                    listing.id
                )));
            }
            if !seen_store_ids.insert(listing.source.store_id.clone()) {
                return Err(CogniaError::Plugin(format!(
                    "Duplicate marketplace source.storeId '{}'.",
                    listing.source.store_id
                )));
            }

            let has_remote_download = listing
                .source
                .download_url
                .as_deref()
                .map(str::trim)
                .is_some_and(|value| !value.is_empty());

            if has_remote_download {
                let download_url = listing.source.download_url.as_deref().unwrap_or_default();
                if !(download_url.starts_with("https://") || download_url.starts_with("http://")) {
                    return Err(CogniaError::Plugin(format!(
                        "Marketplace listing '{}' has invalid source.downloadUrl '{}'.",
                        listing.id, download_url
                    )));
                }
                for mirror in &listing.source.mirror_urls {
                    if !(mirror.starts_with("https://") || mirror.starts_with("http://")) {
                        return Err(CogniaError::Plugin(format!(
                            "Marketplace listing '{}' has invalid mirror URL '{}'.",
                            listing.id, mirror
                        )));
                    }
                }
                if listing.source.size_bytes.is_some_and(|size| size == 0) {
                    return Err(CogniaError::Plugin(format!(
                        "Marketplace listing '{}' has invalid source.sizeBytes value 0.",
                        listing.id
                    )));
                }
            }

            let has_local_source = !listing.source.plugin_dir.trim().is_empty();
            if has_local_source {
                validate_safe_relative_path(
                    Path::new(&listing.source.plugin_dir),
                    "marketplace.pluginDir",
                )?;
                validate_safe_relative_path(
                    Path::new(&listing.source.artifact),
                    "marketplace.artifact",
                )?;
            }

            if !has_local_source && !has_remote_download {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace listing '{}' must declare either local source.pluginDir or source.downloadUrl.",
                    listing.id
                )));
            }

            if listing.source.artifact.trim().is_empty() {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace listing '{}' has empty artifact.",
                    listing.id
                )));
            }
            if !Self::is_valid_sha256(listing.source.checksum_sha256.as_str()) {
                return Err(CogniaError::Plugin(format!(
                    "Marketplace listing '{}' has invalid checksumSha256 '{}'.",
                    listing.id, listing.source.checksum_sha256
                )));
            }
        }
        Ok(())
    }

    /// List all registered plugins
    pub async fn list_plugins(&self) -> Vec<PluginInfo> {
        let reg = self.registry.read().await;
        let mut plugins = reg.list();
        drop(reg);

        for plugin in &mut plugins {
            let is_builtin_candidate = self.builtin_catalog_ids.contains(&plugin.id);
            plugin.builtin_candidate = is_builtin_candidate;

            if let Some(sync) = self.builtin_sync.entries.get(&plugin.id) {
                plugin.builtin_sync_status = Some(sync.status.clone());
                plugin.builtin_sync_message = sync.message.clone();
                continue;
            }

            if is_builtin_candidate && matches!(&plugin.source, PluginSource::BuiltIn) {
                plugin.builtin_sync_status = Some("upToDate".to_string());
                plugin.builtin_sync_message = None;
            }
        }

        plugins
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

    /// Get current plugin permission enforcement mode.
    pub async fn get_permission_mode(&self) -> PermissionEnforcementMode {
        let perms = self.permissions.read().await;
        perms.mode()
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
    pub async fn update_plugin_with_report(
        &mut self,
        plugin_id: &str,
    ) -> CogniaResult<PluginActionReport> {
        let update_info = self
            .check_update(plugin_id)
            .await?
            .ok_or_else(|| CogniaError::Plugin("No update available".to_string()))?;

        // Unload current WASM
        self.loader.unload(plugin_id);

        // Download and install the update
        let temp_dir = tempfile::tempdir()
            .map_err(|e| CogniaError::Plugin(format!("Failed to create temp dir: {}", e)))?;
        let mut download_task_id: Option<String> = None;

        if self.download_manager.is_some() {
            let listing = MarketplaceCatalogListing {
                id: update_info.plugin_id.clone(),
                plugin_id: update_info.plugin_id.clone(),
                version: update_info.latest_version.clone(),
                source: MarketplaceCatalogSource {
                    store_id: update_info.plugin_id.clone(),
                    plugin_dir: String::new(),
                    artifact: "plugin.wasm".to_string(),
                    checksum_sha256: String::new(),
                    download_url: Some(update_info.download_url.clone()),
                    mirror_urls: Vec::new(),
                    size_bytes: None,
                },
            };
            let payload_path = if update_info.download_url.ends_with(".zip") {
                temp_dir.path().join("plugin-update.zip")
            } else {
                temp_dir.path().join("plugin.wasm")
            };
            let task_id = self
                .queue_marketplace_download(
                    &listing,
                    "update",
                    &update_info.download_url,
                    &payload_path,
                )
                .await?;
            download_task_id = Some(task_id);

            if update_info.download_url.ends_with(".zip") {
                let archive_file = std::fs::File::open(&payload_path).map_err(|e| {
                    CogniaError::Plugin(format!("Failed to open update archive: {}", e))
                })?;
                let mut archive = zip::ZipArchive::new(archive_file)
                    .map_err(|e| CogniaError::Plugin(format!("Invalid zip: {}", e)))?;
                let extract_root = temp_dir.path().join("extracted");
                tokio::fs::create_dir_all(&extract_root)
                    .await
                    .map_err(|e| {
                        CogniaError::Plugin(format!("Failed to create update extract dir: {}", e))
                    })?;
                archive.extract(&extract_root).map_err(|e| {
                    CogniaError::Plugin(format!("Failed to extract update archive: {}", e))
                })?;
                let package_root =
                    Self::find_plugin_package_root(&extract_root).ok_or_else(|| {
                        CogniaError::Plugin(
                            "Update package is missing required plugin.toml/plugin.wasm files."
                                .to_string(),
                        )
                    })?;
                copy_dir_recursive(&package_root, temp_dir.path()).await?;
            }
        } else {
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
        Ok(PluginActionReport {
            plugin_id: plugin_id.to_string(),
            phase: "completed".to_string(),
            download_task_id,
        })
    }

    pub async fn update_plugin(&mut self, plugin_id: &str) -> CogniaResult<()> {
        let _ = self.update_plugin_with_report(plugin_id).await?;
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
    use crate::plugin::permissions::PermissionEnforcementMode;
    use crate::plugin::registry::PluginSource;
    use crate::provider::registry::ProviderRegistry;
    use std::collections::HashMap;
    use tokio::sync::RwLock;

    fn make_test_manager(temp_root: &Path) -> PluginManager {
        let deps = PluginDeps {
            registry: Arc::new(RwLock::new(ProviderRegistry::new())),
            settings: Arc::new(RwLock::new(Settings::default())),
            download_manager: None,
            app_handle: None,
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
                tool_contract_version: None,
                compatible_cognia_versions: None,
                icon: None,
                update_url: None,
                listen_events: events.into_iter().map(|e| e.to_string()).collect(),
                listen_logs: vec![],
            },
            tools: vec![],
            permissions: PluginPermissions::default(),
            locales: HashMap::new(),
            ui: None,
            dependencies: PluginDependencies::default(),
            settings: vec![],
        }
    }

    fn make_log_listener_manifest(plugin_id: &str, filters: Vec<&str>) -> PluginManifest {
        let mut manifest = make_listener_manifest(plugin_id, vec![]);
        manifest.plugin.listen_logs = filters.into_iter().map(|filter| filter.to_string()).collect();
        manifest
    }

    async fn write_builtin_fixture(
        temp_root: &Path,
        plugin_id: &str,
        plugin_version: &str,
        wasm_bytes: &[u8],
    ) -> (PathBuf, String) {
        let builtin_root = temp_root.join("builtin-fixture");
        let plugin_dir = builtin_root.join("rust").join("sample");
        tokio::fs::create_dir_all(&plugin_dir).await.unwrap();

        let plugin_toml = format!(
            "[plugin]\nid=\"{}\"\nname=\"Builtin Sample\"\nversion=\"{}\"\ndescription=\"builtin sample\"\nauthors=[]\n\n[permissions]\n",
            plugin_id, plugin_version
        );
        tokio::fs::write(plugin_dir.join("plugin.toml"), plugin_toml)
            .await
            .unwrap();
        tokio::fs::write(plugin_dir.join("plugin.wasm"), wasm_bytes)
            .await
            .unwrap();

        let checksum = PluginManager::sha256_file(&plugin_dir.join("plugin.wasm"))
            .await
            .unwrap();

        let catalog = serde_json::json!({
            "schemaVersion": 1,
            "plugins": [
                {
                    "id": plugin_id,
                    "version": plugin_version,
                    "framework": "rust",
                    "pluginDir": "rust/sample",
                    "artifact": "plugin.wasm",
                    "checksumSha256": checksum
                }
            ]
        });
        tokio::fs::write(
            builtin_root.join("manifest.json"),
            serde_json::to_vec_pretty(&catalog).unwrap(),
        )
        .await
        .unwrap();

        (builtin_root, checksum)
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

    #[test]
    fn test_validate_builtin_catalog_rejects_duplicate_ids() {
        let checksum = "a".repeat(64);
        let catalog = BuiltInCatalog {
            plugins: vec![
                BuiltInCatalogPlugin {
                    id: "com.cognia.builtin.same".to_string(),
                    version: "0.1.0".to_string(),
                    framework: "rust".to_string(),
                    plugin_dir: "rust/sample-a".to_string(),
                    artifact: "plugin.wasm".to_string(),
                    checksum_sha256: checksum.clone(),
                },
                BuiltInCatalogPlugin {
                    id: "com.cognia.builtin.same".to_string(),
                    version: "0.1.0".to_string(),
                    framework: "typescript".to_string(),
                    plugin_dir: "typescript/sample-b".to_string(),
                    artifact: "plugin.wasm".to_string(),
                    checksum_sha256: checksum,
                },
            ],
        };

        let err = PluginManager::validate_builtin_catalog(&catalog)
            .unwrap_err()
            .to_string();
        assert!(err.contains("Duplicate built-in plugin id"));
    }

    #[tokio::test]
    async fn test_sync_builtin_plugins_installs_and_tracks_up_to_date_status() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.cognia.builtin.sample";

        let (builtin_root, _) =
            write_builtin_fixture(temp_dir.path(), plugin_id, "0.1.0", b"\0asm-builtin-v1").await;
        manager.builtin_source_override = Some(builtin_root);

        manager.sync_builtin_plugins().await.unwrap();

        let runtime_plugin_dir = temp_dir.path().join("plugins").join(plugin_id);
        assert!(runtime_plugin_dir.join("plugin.toml").exists());
        assert!(runtime_plugin_dir.join("plugin.wasm").exists());
        assert!(runtime_plugin_dir.join(BUILTIN_MARKER_FILE).exists());

        let first_sync = manager.builtin_sync.entries.get(plugin_id).unwrap();
        assert_eq!(first_sync.status, "installed");

        manager.sync_builtin_plugins().await.unwrap();
        let second_sync = manager.builtin_sync.entries.get(plugin_id).unwrap();
        assert_eq!(second_sync.status, "upToDate");
    }

    #[tokio::test]
    async fn test_sync_builtin_plugins_conflict_does_not_overwrite_user_plugin() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.cognia.builtin.sample";

        let (builtin_root, _) =
            write_builtin_fixture(temp_dir.path(), plugin_id, "0.1.0", b"\0asm-builtin-v1").await;
        manager.builtin_source_override = Some(builtin_root);

        let runtime_plugin_dir = temp_dir.path().join("plugins").join(plugin_id);
        tokio::fs::create_dir_all(&runtime_plugin_dir)
            .await
            .unwrap();
        tokio::fs::write(
            runtime_plugin_dir.join("plugin.toml"),
            format!(
                "[plugin]\nid=\"{}\"\nname=\"User Copy\"\nversion=\"9.9.9\"\ndescription=\"user\"\nauthors=[]\n\n[permissions]\n",
                plugin_id
            ),
        )
        .await
        .unwrap();
        tokio::fs::write(runtime_plugin_dir.join("plugin.wasm"), b"user-wasm")
            .await
            .unwrap();

        manager.sync_builtin_plugins().await.unwrap();

        let runtime_wasm = tokio::fs::read(runtime_plugin_dir.join("plugin.wasm"))
            .await
            .unwrap();
        assert_eq!(runtime_wasm, b"user-wasm");
        assert!(!runtime_plugin_dir.join(BUILTIN_MARKER_FILE).exists());

        let entry = manager.builtin_sync.entries.get(plugin_id).unwrap();
        assert_eq!(entry.status, "conflict");
        assert!(entry
            .message
            .clone()
            .unwrap_or_default()
            .contains("user-managed"));
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
            .dispatch_event(
                "unit.event.no_listeners",
                &serde_json::json!({ "ok": true }),
            )
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
    async fn test_dispatch_log_listener_load_failure_isolated() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.example.log-listener";

        {
            let mut reg = manager.registry.write().await;
            reg.register(
                make_log_listener_manifest(plugin_id, vec!["plugin"]),
                temp_dir.path().join("missing-log-listener").join("plugin.wasm"),
                temp_dir.path().join("missing-log-listener"),
                PluginSource::BuiltIn,
            );
        }

        manager
            .dispatch_log_with_meta(EmittedPluginLog {
                source_type: "plugin".to_string(),
                source_plugin_id: Some("com.example.source".to_string()),
                level: "info".to_string(),
                message: "hello".to_string(),
                target: None,
                fields: HashMap::new(),
                tags: vec![],
                correlation_id: None,
                timestamp: "2026-03-12T00:00:00Z".to_string(),
            })
            .await;

        assert!(!manager.loader.is_loaded(plugin_id));
    }

    #[tokio::test]
    async fn test_dispatch_log_ignores_non_matching_filters() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.example.log-listener";

        {
            let mut reg = manager.registry.write().await;
            reg.register(
                make_log_listener_manifest(plugin_id, vec!["plugin"]),
                temp_dir.path().join("missing-log-listener").join("plugin.wasm"),
                temp_dir.path().join("missing-log-listener"),
                PluginSource::BuiltIn,
            );
        }

        manager
            .dispatch_log_with_meta(EmittedPluginLog {
                source_type: "system".to_string(),
                source_plugin_id: None,
                level: "info".to_string(),
                message: "hello".to_string(),
                target: None,
                fields: HashMap::new(),
                tags: vec![],
                correlation_id: None,
                timestamp: "2026-03-12T00:00:00Z".to_string(),
            })
            .await;

        assert!(!manager.loader.is_loaded(plugin_id));
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
        tokio::fs::write(src.join("plugin.wasm"), b"\0asm")
            .await
            .unwrap();
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
        tokio::fs::write(src.join("plugin.toml"), "x")
            .await
            .unwrap();

        let err = copy_dir_recursive(&src, &nested_dst).await.unwrap_err();
        assert!(err.to_string().contains("inside source"));
    }

    #[tokio::test]
    async fn test_enable_rejects_incompatible_plugin() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.example.incompatible";
        let mut manifest = make_listener_manifest(plugin_id, vec![]);
        manifest.plugin.compatible_cognia_versions = Some("<0.1.0".to_string());

        {
            let mut reg = manager.registry.write().await;
            reg.register(
                manifest,
                temp_dir.path().join("missing").join("plugin.wasm"),
                temp_dir.path().join("missing"),
                PluginSource::BuiltIn,
            );
        }

        let err = manager.enable(plugin_id).await.unwrap_err().to_string();
        assert!(err.contains("incompatible with current host"));
    }

    #[tokio::test]
    async fn test_strict_capability_handshake_denies_missing_capability_and_records_audit() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.example.cap-audit";

        {
            let mut perms = manager.permissions.write().await;
            perms.set_mode(PermissionEnforcementMode::Strict);
            let mut declared = PluginPermissions::default();
            declared.process_exec = true;
            perms.register_plugin(plugin_id, declared);
            perms.grant_permission(plugin_id, "process_exec").unwrap();
        }

        let err = manager
            .enforce_tool_capability_handshake(plugin_id, "run", &[])
            .await
            .unwrap_err()
            .to_string();
        assert!(err.contains("failed capability handshake"));

        let records = manager.get_capability_audit(Some(plugin_id));
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].permission, "process_exec");
        assert_eq!(records[0].capability, "process.exec");
        assert!(!records[0].allowed);
    }

    #[tokio::test]
    async fn test_strict_capability_handshake_allows_declared_capability() {
        let temp_dir = tempfile::tempdir().unwrap();
        let mut manager = make_test_manager(temp_dir.path());
        let plugin_id = "com.example.cap-ok";

        {
            let mut perms = manager.permissions.write().await;
            perms.set_mode(PermissionEnforcementMode::Strict);
            let mut declared = PluginPermissions::default();
            declared.process_exec = true;
            perms.register_plugin(plugin_id, declared);
            perms.grant_permission(plugin_id, "process_exec").unwrap();
        }

        let caps = vec!["process.exec".to_string()];
        manager
            .enforce_tool_capability_handshake(plugin_id, "run", &caps)
            .await
            .unwrap();

        let records = manager.get_capability_audit(Some(plugin_id));
        assert_eq!(records.len(), 1);
        assert!(records[0].allowed);
    }
}

fn ensure_file_exists(path: &Path, label: &str) -> CogniaResult<()> {
    let metadata = std::fs::metadata(path).map_err(|e| {
        CogniaError::Plugin(format!("{} not found at {}: {}", label, path.display(), e))
    })?;
    if !metadata.is_file() {
        return Err(CogniaError::Plugin(format!(
            "{} is not a file: {}",
            label,
            path.display()
        )));
    }
    Ok(())
}

fn ensure_dir_exists(path: &Path, label: &str) -> CogniaResult<()> {
    let metadata = std::fs::metadata(path).map_err(|e| {
        CogniaError::Plugin(format!("{} not found at {}: {}", label, path.display(), e))
    })?;
    if !metadata.is_dir() {
        return Err(CogniaError::Plugin(format!(
            "{} is not a directory: {}",
            label,
            path.display()
        )));
    }
    Ok(())
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
                copy_dir_recursive(&source_root.join(ui_parent), &dest_root.join(ui_parent))
                    .await?;
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
            CogniaError::Plugin(format!("Failed to create dir {}: {}", parent.display(), e))
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
                CogniaError::Plugin(format!("Failed to inspect {}: {}", src_path.display(), e))
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
