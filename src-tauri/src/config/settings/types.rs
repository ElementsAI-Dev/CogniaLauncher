use crate::tray::{
    TrayClickBehavior, TrayMenuItemId, TrayNotificationEvent, TrayNotificationLevel,
    TrayQuickAction,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct Settings {
    pub general: GeneralSettings,
    pub network: NetworkSettings,
    pub mirrors: HashMap<String, MirrorConfig>,
    pub providers: HashMap<String, ProviderSettings>,
    pub paths: PathSettings,
    pub security: SecuritySettings,
    pub provider_settings: GlobalProviderSettings,
    pub appearance: AppearanceSettings,
    pub updates: UpdateSettings,
    pub tray: TraySettings,
    pub envvar: EnvVarSettings,
    pub terminal: TerminalSettings,
    pub log: LogSettings,
    pub backup: BackupSettings,
    pub plugin: PluginSettings,
    pub startup: StartupSettings,
    pub shortcuts: ShortcutSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UpdateSettings {
    /// Check for application updates when the app starts
    pub check_on_start: bool,
    /// Automatically download and install updates
    pub auto_install: bool,
    /// Show notifications when updates are available
    pub notify: bool,
    /// Source strategy for self-update endpoint selection
    pub source_mode: UpdateSourceMode,
    /// Optional custom updater endpoints (JSON array in config layer)
    pub custom_endpoints: Vec<String>,
    /// Whether to retry official source when selected source fails
    pub fallback_to_official: bool,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            check_on_start: true,
            auto_install: false,
            notify: true,
            source_mode: UpdateSourceMode::Official,
            custom_endpoints: Vec::new(),
            fallback_to_official: true,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UpdateSourceMode {
    Official,
    Mirror,
    Custom,
}

impl Default for UpdateSourceMode {
    fn default() -> Self {
        Self::Official
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TraySettings {
    /// Hide to tray instead of closing the window
    pub minimize_to_tray: bool,
    /// Start the app hidden in the tray
    pub start_minimized: bool,
    /// Show desktop notifications from tray actions
    pub show_notifications: bool,
    /// Notification visibility policy
    pub notification_level: TrayNotificationLevel,
    /// Left-click behavior for tray icon
    pub click_behavior: TrayClickBehavior,
    /// Action to run when click behavior is set to quick_action
    pub quick_action: TrayQuickAction,
    /// Notification event categories enabled for tray notifications
    pub notification_events: Vec<TrayNotificationEvent>,
    /// Ordered list of tray menu items
    pub menu_items: Vec<TrayMenuItemId>,
    /// Priority menu items that should be shown before other enabled items
    pub menu_priority_items: Vec<TrayMenuItemId>,
}

impl Default for TraySettings {
    fn default() -> Self {
        Self {
            minimize_to_tray: true,
            start_minimized: false,
            show_notifications: true,
            notification_level: TrayNotificationLevel::All,
            click_behavior: TrayClickBehavior::ToggleWindow,
            quick_action: TrayQuickAction::CheckUpdates,
            notification_events: TrayNotificationEvent::defaults(),
            menu_items: vec![
                TrayMenuItemId::ShowHide,
                TrayMenuItemId::QuickNav,
                TrayMenuItemId::Downloads,
                TrayMenuItemId::Settings,
                TrayMenuItemId::CheckUpdates,
                TrayMenuItemId::ToggleNotifications,
                TrayMenuItemId::OpenLogs,
                TrayMenuItemId::AlwaysOnTop,
                TrayMenuItemId::Autostart,
                TrayMenuItemId::Quit,
            ],
            menu_priority_items: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct EnvVarSettings {
    pub default_scope: String,
    pub auto_snapshot: bool,
    pub mask_sensitive: bool,
}

impl Default for EnvVarSettings {
    fn default() -> Self {
        Self {
            default_scope: "all".to_string(),
            auto_snapshot: false,
            mask_sensitive: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct StartupSettings {
    /// Automatically scan environments on launch
    pub scan_environments: bool,
    /// Automatically scan installed packages on launch
    pub scan_packages: bool,
    /// Maximum concurrent provider checks during startup scans
    pub max_concurrent_scans: u32,
    /// Timeout in seconds for the entire startup sequence
    pub startup_timeout_secs: u32,
    /// Run resource integrity check on startup
    pub integrity_check: bool,
}

impl Default for StartupSettings {
    fn default() -> Self {
        Self {
            scan_environments: true,
            scan_packages: true,
            max_concurrent_scans: 6,
            startup_timeout_secs: 30,
            integrity_check: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PluginSettings {
    pub auto_load_on_startup: bool,
    pub max_execution_timeout_secs: u64,
    pub sandbox_fs: bool,
    /// Permission enforcement mode for plugins: "compat" or "strict".
    pub permission_enforcement_mode: String,
}

impl Default for PluginSettings {
    fn default() -> Self {
        Self {
            auto_load_on_startup: true,
            max_execution_timeout_secs: 30,
            sandbox_fs: true,
            permission_enforcement_mode: "compat".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ShortcutSettings {
    /// Enable global shortcuts
    pub enabled: bool,
    /// Show/hide main window
    pub toggle_window: String,
    /// Open command palette
    pub command_palette: String,
    /// Quick search
    pub quick_search: String,
}

impl Default for ShortcutSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            toggle_window: "CmdOrCtrl+Shift+Space".into(),
            command_palette: "CmdOrCtrl+Shift+K".into(),
            quick_search: "CmdOrCtrl+Shift+F".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppearanceSettings {
    pub theme: String,
    pub accent_color: String,
    pub chart_color_theme: String,
    pub interface_radius: f64,
    pub interface_density: String,
    pub language: String,
    pub reduced_motion: bool,
    pub window_effect: String,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            accent_color: "blue".into(),
            chart_color_theme: "default".into(),
            interface_radius: 0.625,
            interface_density: "comfortable".into(),
            language: "en".into(),
            reduced_motion: false,
            window_effect: "auto".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TerminalSettings {
    pub default_shell: String,
    pub default_profile_id: Option<String>,
    pub shell_integration: bool,
    pub proxy_mode: String,
    pub custom_proxy: Option<String>,
    pub no_proxy: Option<String>,
}

impl Default for TerminalSettings {
    fn default() -> Self {
        Self {
            default_shell: "auto".into(),
            default_profile_id: None,
            shell_integration: true,
            proxy_mode: "global".into(),
            custom_proxy: None,
            no_proxy: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LogSettings {
    /// Maximum number of days to retain log files (0 = unlimited)
    pub max_retention_days: u32,
    /// Maximum total size of all log files in MB (0 = unlimited)
    pub max_total_size_mb: u32,
    /// Automatically clean old logs on startup
    pub auto_cleanup: bool,
    /// Backend log level (trace/debug/info/warn/error). Applied on next app restart.
    pub log_level: String,
}

impl Default for LogSettings {
    fn default() -> Self {
        Self {
            max_retention_days: 30,
            max_total_size_mb: 100,
            auto_cleanup: true,
            log_level: "info".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BackupSettings {
    /// Enable automatic backups
    pub auto_backup_enabled: bool,
    /// Interval between auto backups in hours (0 = disabled)
    pub auto_backup_interval_hours: u32,
    /// Maximum number of manual backups to keep (0 = unlimited)
    pub max_backups: u32,
    /// Maximum age of backups in days before auto-cleanup (0 = unlimited)
    pub retention_days: u32,
}

impl Default for BackupSettings {
    fn default() -> Self {
        Self {
            auto_backup_enabled: false,
            auto_backup_interval_hours: 24,
            max_backups: 10,
            retention_days: 30,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct GlobalProviderSettings {
    pub pinned_packages: HashMap<String, Option<String>>,
    pub disabled_providers: Vec<String>,
}

/// A user-defined custom cache directory to monitor.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomCacheEntry {
    pub id: String,
    pub display_name: String,
    pub path: String,
    /// One of: package_manager, devtools, system, terminal
    pub category: String,
}

/// Named presets for scan aggressiveness (mirrors `cache::external::ScanPreset`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CacheScanPreset {
    Quick,
    Standard,
    Deep,
    Custom,
}

impl Default for CacheScanPreset {
    fn default() -> Self {
        Self::Standard
    }
}

/// User-persisted scan configuration.
/// When `preset` is not `Custom`, the other fields are ignored and the preset
/// defaults are used.  When `Custom`, the fields below are applied directly.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CacheScanSettings {
    /// Active scan preset.
    pub preset: CacheScanPreset,
    /// Per-provider probe timeout (ms). Only used when preset = Custom.
    pub probe_timeout_ms: u64,
    /// Max concurrent provider probes. Only used when preset = Custom.
    pub probe_concurrency: usize,
    /// Max directory depth for size calculation. Only used when preset = Custom.
    pub size_calc_max_depth: u32,
    /// Timeout in seconds per size calculation. Only used when preset = Custom.
    pub size_calc_timeout_secs: u64,
    /// Provider IDs to scan first, in order.
    pub provider_priority: Vec<String>,
    /// Category filter – when non-empty, only matching categories are scanned.
    pub category_filter: Vec<String>,
}

impl Default for CacheScanSettings {
    fn default() -> Self {
        Self {
            preset: CacheScanPreset::Standard,
            probe_timeout_ms: 450,
            probe_concurrency: 6,
            size_calc_max_depth: 15,
            size_calc_timeout_secs: 10,
            provider_priority: Vec::new(),
            category_filter: Vec::new(),
        }
    }
}

impl CacheScanSettings {
    /// Convert persisted settings to a runtime `ScanConfig`.
    pub fn to_scan_config(&self) -> crate::cache::external::ScanConfig {
        let mut config = match self.preset {
            CacheScanPreset::Quick => crate::cache::external::ScanConfig::quick(),
            CacheScanPreset::Standard => crate::cache::external::ScanConfig::default(),
            CacheScanPreset::Deep => crate::cache::external::ScanConfig::deep(),
            CacheScanPreset::Custom => crate::cache::external::ScanConfig {
                probe_timeout_ms: self.probe_timeout_ms,
                probe_concurrency: self.probe_concurrency.clamp(1, 16),
                size_calc_max_depth: self.size_calc_max_depth.clamp(1, 50),
                size_calc_max_files: 500_000,
                size_calc_timeout_secs: self.size_calc_timeout_secs.clamp(1, 120),
                ..crate::cache::external::ScanConfig::default()
            },
        };
        // Priority and category filter are always applied regardless of preset.
        config.provider_priority = self.provider_priority.clone();
        config.categories = self.category_filter.clone();
        config
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GeneralSettings {
    pub parallel_downloads: u32,
    pub resolve_strategy: ResolveStrategy,
    pub auto_update_metadata: bool,
    pub metadata_cache_ttl: u64,
    pub cache_max_size: u64,
    pub cache_max_age_days: u32,
    pub auto_clean_cache: bool,
    pub min_install_space_mb: u64,
    /// Queue package downloads larger than this size in MB (0 = disabled)
    pub package_download_threshold_mb: u64,
    /// Threshold percentage (0-100) to trigger auto-cleanup when cache usage exceeds this
    pub cache_auto_clean_threshold: u8,
    /// Size monitoring interval in seconds (0 = disabled)
    pub cache_monitor_interval: u64,
    /// Whether to include external caches in size monitoring
    pub cache_monitor_external: bool,
    /// Download speed limit in bytes/sec (0 = unlimited)
    pub download_speed_limit: u64,
    /// Max concurrent tasks for update checking (1-32, default 8)
    pub update_check_concurrency: u32,
    /// External cache provider IDs to exclude from scanning (e.g. ["gradle","maven"])
    #[serde(default)]
    pub external_cache_excluded_providers: Vec<String>,
    /// User-defined custom cache directories
    #[serde(default)]
    pub custom_cache_entries: Vec<CustomCacheEntry>,
    /// Configurable scan parameters and presets
    #[serde(default)]
    pub cache_scan_settings: CacheScanSettings,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            parallel_downloads: 4,
            resolve_strategy: ResolveStrategy::Latest,
            auto_update_metadata: true,
            metadata_cache_ttl: 3600,
            cache_max_size: 5 * 1024 * 1024 * 1024, // 5 GB
            cache_max_age_days: 30,
            auto_clean_cache: true,
            min_install_space_mb: 100,
            package_download_threshold_mb: 50,
            cache_auto_clean_threshold: 80,
            cache_monitor_interval: 300, // 5 minutes
            cache_monitor_external: false,
            download_speed_limit: 0,
            update_check_concurrency: 8,
            external_cache_excluded_providers: Vec::new(),
            custom_cache_entries: Vec::new(),
            cache_scan_settings: CacheScanSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ResolveStrategy {
    Latest,
    Minimal,
    Locked,
    PreferLocked,
}

impl Default for ResolveStrategy {
    fn default() -> Self {
        Self::Latest
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct NetworkSettings {
    pub timeout: u64,
    pub retries: u32,
    pub proxy: Option<String>,
    pub no_proxy: Option<String>,
}

impl Default for NetworkSettings {
    fn default() -> Self {
        Self {
            timeout: 30,
            retries: 3,
            proxy: None,
            no_proxy: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct MirrorConfig {
    pub url: String,
    pub priority: i32,
    pub enabled: bool,
    pub verify_ssl: bool,
}

impl Default for MirrorConfig {
    fn default() -> Self {
        Self {
            url: String::new(),
            priority: 0,
            enabled: true,
            verify_ssl: true,
        }
    }
}

impl MirrorConfig {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            ..Default::default()
        }
    }

    pub fn with_priority(mut self, priority: i32) -> Self {
        self.priority = priority;
        self
    }

    pub fn disabled(mut self) -> Self {
        self.enabled = false;
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<i32>,
    #[serde(flatten)]
    pub extra: HashMap<String, toml::Value>,
}

impl Default for ProviderSettings {
    fn default() -> Self {
        Self {
            enabled: None,
            priority: None,
            extra: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct PathSettings {
    pub root: Option<PathBuf>,
    pub cache: Option<PathBuf>,
    pub environments: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SecuritySettings {
    pub allow_http: bool,
    pub verify_certificates: bool,
    pub allow_self_signed: bool,
}

impl Default for SecuritySettings {
    fn default() -> Self {
        Self {
            allow_http: false,
            verify_certificates: true,
            allow_self_signed: false,
        }
    }
}
