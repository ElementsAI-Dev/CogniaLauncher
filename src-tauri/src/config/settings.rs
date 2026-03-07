use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use crate::tray::{TrayClickBehavior, TrayMenuItemId, TrayNotificationLevel};
use reqwest::Url;
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
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            check_on_start: true,
            auto_install: false,
            notify: true,
        }
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
    /// Ordered list of tray menu items
    pub menu_items: Vec<TrayMenuItemId>,
}

impl Default for TraySettings {
    fn default() -> Self {
        Self {
            minimize_to_tray: true,
            start_minimized: false,
            show_notifications: true,
            notification_level: TrayNotificationLevel::All,
            click_behavior: TrayClickBehavior::ToggleWindow,
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
            cache_auto_clean_threshold: 80,
            cache_monitor_interval: 300, // 5 minutes
            cache_monitor_external: false,
            download_speed_limit: 0,
            update_check_concurrency: 8,
            external_cache_excluded_providers: Vec::new(),
            custom_cache_entries: Vec::new(),
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
    pub enabled: bool,
    pub priority: i32,
    #[serde(flatten)]
    pub extra: HashMap<String, toml::Value>,
}

impl Default for ProviderSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            priority: 0,
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

impl Settings {
    pub fn config_path() -> Option<PathBuf> {
        fs::get_config_dir().map(|dir| dir.join("config.toml"))
    }

    pub async fn load() -> CogniaResult<Self> {
        let path = Self::config_path()
            .ok_or_else(|| CogniaError::Config("Could not determine config path".into()))?;

        if !fs::exists(&path).await {
            return Ok(Self::default());
        }

        let content = fs::read_file_string(&path).await?;
        let settings: Settings = toml::from_str(&content)
            .map_err(|e| CogniaError::Parse(format!("Failed to parse config: {}", e)))?;

        Ok(settings)
    }

    pub async fn save(&self) -> CogniaResult<()> {
        let path = Self::config_path()
            .ok_or_else(|| CogniaError::Config("Could not determine config path".into()))?;

        let content = toml::to_string_pretty(self)
            .map_err(|e| CogniaError::Config(format!("Failed to serialize config: {}", e)))?;

        fs::write_file_atomic(&path, content.as_bytes()).await?;

        Ok(())
    }

    pub fn get_root_dir(&self) -> PathBuf {
        self.paths
            .root
            .clone()
            .or_else(fs::get_cognia_dir)
            .unwrap_or_else(|| PathBuf::from(".cognia"))
    }

    pub fn get_cache_dir(&self) -> PathBuf {
        self.paths
            .cache
            .clone()
            .unwrap_or_else(|| self.get_root_dir().join("cache"))
    }

    pub fn get_environments_dir(&self) -> PathBuf {
        self.paths
            .environments
            .clone()
            .unwrap_or_else(|| self.get_root_dir().join("environments"))
    }

    pub fn get_bin_dir(&self) -> PathBuf {
        self.get_root_dir().join("bin")
    }

    pub fn get_state_dir(&self) -> PathBuf {
        self.get_root_dir().join("state")
    }

    fn parse_tray_menu_items(value: &str) -> CogniaResult<Vec<TrayMenuItemId>> {
        fn parse_item(item: &str) -> Option<TrayMenuItemId> {
            match item {
                "show_hide" => Some(TrayMenuItemId::ShowHide),
                "quick_nav" => Some(TrayMenuItemId::QuickNav),
                "downloads" => Some(TrayMenuItemId::Downloads),
                "settings" => Some(TrayMenuItemId::Settings),
                "check_updates" => Some(TrayMenuItemId::CheckUpdates),
                "toggle_notifications" => Some(TrayMenuItemId::ToggleNotifications),
                "open_logs" => Some(TrayMenuItemId::OpenLogs),
                "always_on_top" => Some(TrayMenuItemId::AlwaysOnTop),
                "autostart" => Some(TrayMenuItemId::Autostart),
                "quit" => Some(TrayMenuItemId::Quit),
                _ => None,
            }
        }

        let mut items = if value.trim().starts_with('[') {
            let raw: Vec<String> = serde_json::from_str(value)
                .map_err(|_| CogniaError::Config("Invalid tray menu_items JSON array".into()))?;
            let mut parsed = Vec::with_capacity(raw.len());
            for item in raw {
                if let Some(parsed_item) = parse_item(item.trim()) {
                    parsed.push(parsed_item);
                }
            }
            parsed
        } else {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                Vec::new()
            } else {
                let mut parsed = Vec::new();
                for item in trimmed
                    .split(',')
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                {
                    if let Some(parsed_item) = parse_item(item) {
                        parsed.push(parsed_item);
                    }
                }
                parsed
            }
        };

        let mut deduped = Vec::with_capacity(items.len());
        for item in items {
            if !deduped.contains(&item) {
                deduped.push(item);
            }
        }
        items = deduped;

        if !items.contains(&TrayMenuItemId::Quit) {
            items.push(TrayMenuItemId::Quit);
        }

        Ok(items)
    }

    fn normalize_proxy_mode(value: &str) -> CogniaResult<String> {
        let normalized = value.trim().to_lowercase();
        if !["global", "none", "custom"].contains(&normalized.as_str()) {
            return Err(CogniaError::Config(
                "Invalid proxy mode. Valid: global, none, custom".into(),
            ));
        }
        Ok(normalized)
    }

    fn normalize_optional_proxy_url(value: &str) -> CogniaResult<Option<String>> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Ok(None);
        }

        let parsed = Url::parse(trimmed)
            .map_err(|e| CogniaError::Config(format!("Invalid proxy URL '{}': {}", trimmed, e)))?;
        if !matches!(parsed.scheme(), "http" | "https" | "socks5" | "socks5h") {
            return Err(CogniaError::Config(
                "Invalid proxy URL scheme. Valid: http://, https://, socks5://".into(),
            ));
        }

        Ok(Some(trimmed.to_string()))
    }

    fn normalize_optional_no_proxy(value: &str) -> Option<String> {
        let normalized = value.replace(';', ",");
        let entries: Vec<String> = normalized
            .split(',')
            .map(|item| item.trim())
            .filter(|item| !item.is_empty())
            .map(|item| item.to_string())
            .collect();

        if entries.is_empty() {
            None
        } else {
            Some(entries.join(","))
        }
    }

    pub fn get_value(&self, key: &str) -> Option<String> {
        let parts: Vec<&str> = key.split('.').collect();

        match parts.as_slice() {
            ["general", "parallel_downloads"] => Some(self.general.parallel_downloads.to_string()),
            ["general", "resolve_strategy"] => Some(
                match self.general.resolve_strategy {
                    ResolveStrategy::Latest => "latest",
                    ResolveStrategy::Minimal => "minimal",
                    ResolveStrategy::Locked => "locked",
                    ResolveStrategy::PreferLocked => "prefer-locked",
                }
                .to_string(),
            ),
            ["general", "auto_update_metadata"] => {
                Some(self.general.auto_update_metadata.to_string())
            }
            ["general", "metadata_cache_ttl"] => Some(self.general.metadata_cache_ttl.to_string()),
            ["general", "cache_max_size"] => Some(self.general.cache_max_size.to_string()),
            ["general", "cache_max_age_days"] => Some(self.general.cache_max_age_days.to_string()),
            ["general", "auto_clean_cache"] => Some(self.general.auto_clean_cache.to_string()),
            ["general", "min_install_space_mb"] => {
                Some(self.general.min_install_space_mb.to_string())
            }
            ["general", "cache_auto_clean_threshold"] => {
                Some(self.general.cache_auto_clean_threshold.to_string())
            }
            ["general", "cache_monitor_interval"] => {
                Some(self.general.cache_monitor_interval.to_string())
            }
            ["general", "cache_monitor_external"] => {
                Some(self.general.cache_monitor_external.to_string())
            }
            ["general", "download_speed_limit"] => {
                Some(self.general.download_speed_limit.to_string())
            }
            ["general", "update_check_concurrency"] => {
                Some(self.general.update_check_concurrency.to_string())
            }
            ["network", "timeout"] => Some(self.network.timeout.to_string()),
            ["network", "retries"] => Some(self.network.retries.to_string()),
            ["network", "proxy"] => self.network.proxy.clone(),
            ["network", "no_proxy"] => self
                .network
                .no_proxy
                .clone()
                .or_else(|| Some(String::new())),
            ["security", "allow_http"] => Some(self.security.allow_http.to_string()),
            ["security", "verify_certificates"] => {
                Some(self.security.verify_certificates.to_string())
            }
            ["security", "allow_self_signed"] => Some(self.security.allow_self_signed.to_string()),
            ["paths", "root"] => Some(
                self.paths
                    .root
                    .as_ref()
                    .map(|p| p.display().to_string())
                    .unwrap_or_default(),
            ),
            ["paths", "cache"] => Some(
                self.paths
                    .cache
                    .as_ref()
                    .map(|p| p.display().to_string())
                    .unwrap_or_default(),
            ),
            ["paths", "environments"] => Some(
                self.paths
                    .environments
                    .as_ref()
                    .map(|p| p.display().to_string())
                    .unwrap_or_default(),
            ),
            ["provider_settings", "disabled_providers"] => Some(
                serde_json::to_string(&self.provider_settings.disabled_providers)
                    .unwrap_or_else(|_| "[]".to_string()),
            ),
            ["appearance", "theme"] => Some(self.appearance.theme.clone()),
            ["appearance", "accent_color"] => Some(self.appearance.accent_color.clone()),
            ["appearance", "chart_color_theme"] => Some(self.appearance.chart_color_theme.clone()),
            ["appearance", "interface_radius"] => {
                Some(self.appearance.interface_radius.to_string())
            }
            ["appearance", "interface_density"] => Some(self.appearance.interface_density.clone()),
            ["appearance", "language"] => Some(self.appearance.language.clone()),
            ["appearance", "reduced_motion"] => Some(self.appearance.reduced_motion.to_string()),
            ["appearance", "window_effect"] => Some(self.appearance.window_effect.clone()),
            ["updates", "check_on_start"] => Some(self.updates.check_on_start.to_string()),
            ["updates", "auto_install"] => Some(self.updates.auto_install.to_string()),
            ["updates", "notify"] => Some(self.updates.notify.to_string()),
            ["tray", "minimize_to_tray"] => Some(self.tray.minimize_to_tray.to_string()),
            ["tray", "start_minimized"] => Some(self.tray.start_minimized.to_string()),
            ["tray", "show_notifications"] => Some(self.tray.show_notifications.to_string()),
            ["tray", "notification_level"] => Some(
                match self.tray.notification_level {
                    TrayNotificationLevel::All => "all",
                    TrayNotificationLevel::ImportantOnly => "important_only",
                    TrayNotificationLevel::None => "none",
                }
                .to_string(),
            ),
            ["tray", "click_behavior"] => Some(
                match self.tray.click_behavior {
                    TrayClickBehavior::ToggleWindow => "toggle_window",
                    TrayClickBehavior::ShowMenu => "show_menu",
                    TrayClickBehavior::CheckUpdates => "check_updates",
                    TrayClickBehavior::DoNothing => "do_nothing",
                }
                .to_string(),
            ),
            ["tray", "menu_items"] => {
                Some(serde_json::to_string(&self.tray.menu_items).unwrap_or_else(|_| "[]".into()))
            }
            ["terminal", "default_shell"] => Some(self.terminal.default_shell.clone()),
            ["terminal", "default_profile_id"] => self
                .terminal
                .default_profile_id
                .clone()
                .or_else(|| Some(String::new())),
            ["terminal", "shell_integration"] => Some(self.terminal.shell_integration.to_string()),
            ["terminal", "proxy_mode"] => Some(self.terminal.proxy_mode.clone()),
            ["terminal", "custom_proxy"] => self
                .terminal
                .custom_proxy
                .clone()
                .or_else(|| Some(String::new())),
            ["terminal", "no_proxy"] => self
                .terminal
                .no_proxy
                .clone()
                .or_else(|| Some(String::new())),
            ["log", "max_retention_days"] => Some(self.log.max_retention_days.to_string()),
            ["log", "max_total_size_mb"] => Some(self.log.max_total_size_mb.to_string()),
            ["log", "auto_cleanup"] => Some(self.log.auto_cleanup.to_string()),
            ["log", "log_level"] => Some(self.log.log_level.clone()),
            ["backup", "auto_backup_enabled"] => Some(self.backup.auto_backup_enabled.to_string()),
            ["backup", "auto_backup_interval_hours"] => {
                Some(self.backup.auto_backup_interval_hours.to_string())
            }
            ["backup", "max_backups"] => Some(self.backup.max_backups.to_string()),
            ["backup", "retention_days"] => Some(self.backup.retention_days.to_string()),
            ["plugin", "auto_load_on_startup"] => {
                Some(self.plugin.auto_load_on_startup.to_string())
            }
            ["plugin", "max_execution_timeout_secs"] => {
                Some(self.plugin.max_execution_timeout_secs.to_string())
            }
            ["plugin", "sandbox_fs"] => Some(self.plugin.sandbox_fs.to_string()),
            ["plugin", "permission_enforcement_mode"] => {
                Some(self.plugin.permission_enforcement_mode.clone())
            }
            ["startup", "scan_environments"] => Some(self.startup.scan_environments.to_string()),
            ["startup", "scan_packages"] => Some(self.startup.scan_packages.to_string()),
            ["startup", "max_concurrent_scans"] => {
                Some(self.startup.max_concurrent_scans.to_string())
            }
            ["startup", "startup_timeout_secs"] => {
                Some(self.startup.startup_timeout_secs.to_string())
            }
            ["startup", "integrity_check"] => Some(self.startup.integrity_check.to_string()),
            ["shortcuts", "enabled"] => Some(self.shortcuts.enabled.to_string()),
            ["shortcuts", "toggle_window"] => Some(self.shortcuts.toggle_window.clone()),
            ["shortcuts", "command_palette"] => Some(self.shortcuts.command_palette.clone()),
            ["shortcuts", "quick_search"] => Some(self.shortcuts.quick_search.clone()),
            ["providers", provider, "token"] => self
                .providers
                .get(*provider)
                .and_then(|ps| ps.extra.get("token"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            ["providers", provider, "url"] => self
                .providers
                .get(*provider)
                .and_then(|ps| ps.extra.get("url"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            ["mirrors", provider] => self.mirrors.get(*provider).map(|m| m.url.clone()),
            ["mirrors", provider, "enabled"] => {
                self.mirrors.get(*provider).map(|m| m.enabled.to_string())
            }
            ["mirrors", provider, "priority"] => {
                self.mirrors.get(*provider).map(|m| m.priority.to_string())
            }
            ["mirrors", provider, "verify_ssl"] => self
                .mirrors
                .get(*provider)
                .map(|m| m.verify_ssl.to_string()),
            _ => None,
        }
    }

    pub fn set_value(&mut self, key: &str, value: &str) -> CogniaResult<()> {
        let parts: Vec<&str> = key.split('.').collect();

        match parts.as_slice() {
            ["general", "parallel_downloads"] => {
                self.general.parallel_downloads = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for parallel_downloads".into())
                })?;
            }
            ["general", "resolve_strategy"] => {
                self.general.resolve_strategy = match value {
                    "latest" => ResolveStrategy::Latest,
                    "minimal" => ResolveStrategy::Minimal,
                    "locked" => ResolveStrategy::Locked,
                    "prefer-locked" => ResolveStrategy::PreferLocked,
                    _ => return Err(CogniaError::Config("Invalid resolve strategy".into())),
                };
            }
            ["general", "auto_update_metadata"] => {
                self.general.auto_update_metadata = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["general", "metadata_cache_ttl"] => {
                self.general.metadata_cache_ttl = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for metadata_cache_ttl".into())
                })?;
            }
            ["general", "cache_max_size"] => {
                self.general.cache_max_size = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid value for cache_max_size".into()))?;
            }
            ["general", "cache_max_age_days"] => {
                self.general.cache_max_age_days = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for cache_max_age_days".into())
                })?;
            }
            ["general", "auto_clean_cache"] => {
                self.general.auto_clean_cache = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["general", "min_install_space_mb"] => {
                self.general.min_install_space_mb = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for min_install_space_mb".into())
                })?;
            }
            ["general", "cache_auto_clean_threshold"] => {
                let v: u8 = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for cache_auto_clean_threshold".into())
                })?;
                if v > 100 {
                    return Err(CogniaError::Config("Threshold must be 0-100".into()));
                }
                self.general.cache_auto_clean_threshold = v;
            }
            ["general", "cache_monitor_interval"] => {
                self.general.cache_monitor_interval = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for cache_monitor_interval".into())
                })?;
            }
            ["general", "cache_monitor_external"] => {
                self.general.cache_monitor_external = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["general", "download_speed_limit"] => {
                self.general.download_speed_limit = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for download_speed_limit".into())
                })?;
            }
            ["general", "update_check_concurrency"] => {
                let v: u32 = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for update_check_concurrency".into())
                })?;
                if v == 0 || v > 32 {
                    return Err(CogniaError::Config(
                        "update_check_concurrency must be 1-32".into(),
                    ));
                }
                self.general.update_check_concurrency = v;
            }
            ["general", "custom_cache_entries"] => {
                self.general.custom_cache_entries =
                    serde_json::from_str(value.trim()).map_err(|_| {
                        CogniaError::Config("Invalid JSON for custom_cache_entries".into())
                    })?;
            }
            ["general", "external_cache_excluded_providers"] => {
                let trimmed = value.trim();
                let parsed: Vec<String> = if trimmed.is_empty() {
                    Vec::new()
                } else if trimmed.starts_with('[') {
                    serde_json::from_str(trimmed).map_err(|_| {
                        CogniaError::Config(
                            "Invalid JSON array for external_cache_excluded_providers".into(),
                        )
                    })?
                } else {
                    trimmed
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|item| !item.is_empty())
                        .collect()
                };
                self.general.external_cache_excluded_providers = parsed;
            }
            ["network", "timeout"] => {
                self.network.timeout = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid value for timeout".into()))?;
            }
            ["network", "retries"] => {
                self.network.retries = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid value for retries".into()))?;
            }
            ["network", "proxy"] => {
                self.network.proxy = if value.is_empty() {
                    None
                } else {
                    Some(value.to_string())
                };
            }
            ["network", "no_proxy"] => {
                self.network.no_proxy = if value.is_empty() {
                    None
                } else {
                    Some(value.to_string())
                };
            }
            ["security", "allow_http"] => {
                self.security.allow_http = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["security", "verify_certificates"] => {
                self.security.verify_certificates = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["security", "allow_self_signed"] => {
                self.security.allow_self_signed = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["paths", "root"] => {
                self.paths.root = if value.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(value))
                };
            }
            ["paths", "cache"] => {
                self.paths.cache = if value.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(value))
                };
            }
            ["paths", "environments"] => {
                self.paths.environments = if value.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(value))
                };
            }
            ["provider_settings", "disabled_providers"] => {
                let trimmed = value.trim();
                let parsed = if trimmed.is_empty() {
                    Vec::new()
                } else if trimmed.starts_with('[') {
                    serde_json::from_str(trimmed).map_err(|_| {
                        CogniaError::Config("Invalid disabled providers list".into())
                    })?
                } else {
                    trimmed
                        .split(',')
                        .map(|item| item.trim().to_string())
                        .filter(|item| !item.is_empty())
                        .collect()
                };
                self.provider_settings.disabled_providers = parsed;
            }
            ["appearance", "theme"] => {
                if !["light", "dark", "system"].contains(&value) {
                    return Err(CogniaError::Config("Invalid theme value".into()));
                }
                self.appearance.theme = value.to_string();
            }
            ["appearance", "accent_color"] => {
                if !["zinc", "blue", "green", "purple", "orange", "rose"].contains(&value) {
                    return Err(CogniaError::Config("Invalid accent color value".into()));
                }
                self.appearance.accent_color = value.to_string();
            }
            ["appearance", "chart_color_theme"] => {
                if ![
                    "default",
                    "vibrant",
                    "pastel",
                    "ocean",
                    "sunset",
                    "monochrome",
                ]
                .contains(&value)
                {
                    return Err(CogniaError::Config(
                        "Invalid chart color theme value".into(),
                    ));
                }
                self.appearance.chart_color_theme = value.to_string();
            }
            ["appearance", "interface_radius"] => {
                let v: f64 = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for interface_radius".into())
                })?;
                if ![0.0, 0.3, 0.5, 0.625, 0.75, 1.0].contains(&v) {
                    return Err(CogniaError::Config("Invalid interface radius value".into()));
                }
                self.appearance.interface_radius = v;
            }
            ["appearance", "interface_density"] => {
                if !["compact", "comfortable", "spacious"].contains(&value) {
                    return Err(CogniaError::Config(
                        "Invalid interface density value".into(),
                    ));
                }
                self.appearance.interface_density = value.to_string();
            }
            ["appearance", "language"] => {
                if !["en", "zh"].contains(&value) {
                    return Err(CogniaError::Config("Invalid language value".into()));
                }
                self.appearance.language = value.to_string();
            }
            ["appearance", "reduced_motion"] => {
                self.appearance.reduced_motion = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["appearance", "window_effect"] => {
                let valid = [
                    "auto",
                    "none",
                    "mica",
                    "mica-tabbed",
                    "acrylic",
                    "blur",
                    "vibrancy",
                ];
                if !valid.contains(&value) {
                    return Err(CogniaError::Config("Invalid window effect value".into()));
                }
                self.appearance.window_effect = value.to_string();
            }
            ["updates", "check_on_start"] => {
                self.updates.check_on_start = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["updates", "auto_install"] => {
                self.updates.auto_install = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["updates", "notify"] => {
                self.updates.notify = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["tray", "minimize_to_tray"] => {
                self.tray.minimize_to_tray = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["tray", "start_minimized"] => {
                self.tray.start_minimized = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["tray", "show_notifications"] => {
                self.tray.show_notifications = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["tray", "notification_level"] => {
                self.tray.notification_level = match value {
                    "all" => TrayNotificationLevel::All,
                    "important_only" => TrayNotificationLevel::ImportantOnly,
                    "none" => TrayNotificationLevel::None,
                    _ => {
                        return Err(CogniaError::Config(
                            "Invalid tray notification level value".into(),
                        ))
                    }
                };
            }
            ["tray", "click_behavior"] => {
                self.tray.click_behavior = match value {
                    "toggle_window" => TrayClickBehavior::ToggleWindow,
                    "show_menu" => TrayClickBehavior::ShowMenu,
                    "check_updates" => TrayClickBehavior::CheckUpdates,
                    "do_nothing" => TrayClickBehavior::DoNothing,
                    _ => {
                        return Err(CogniaError::Config(
                            "Invalid tray click behavior value".into(),
                        ))
                    }
                };
            }
            ["tray", "menu_items"] => {
                self.tray.menu_items = Self::parse_tray_menu_items(value)?;
            }
            ["terminal", "default_shell"] => {
                self.terminal.default_shell = value.to_string();
            }
            ["terminal", "default_profile_id"] => {
                self.terminal.default_profile_id = if value.is_empty() {
                    None
                } else {
                    Some(value.to_string())
                };
            }
            ["terminal", "shell_integration"] => {
                self.terminal.shell_integration = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["terminal", "proxy_mode"] => {
                self.terminal.proxy_mode = Self::normalize_proxy_mode(value)?;
            }
            ["terminal", "custom_proxy"] => {
                self.terminal.custom_proxy = Self::normalize_optional_proxy_url(value)?;
            }
            ["terminal", "no_proxy"] => {
                self.terminal.no_proxy = Self::normalize_optional_no_proxy(value);
            }
            ["log", "max_retention_days"] => {
                self.log.max_retention_days = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for max_retention_days".into())
                })?;
            }
            ["log", "max_total_size_mb"] => {
                self.log.max_total_size_mb = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for max_total_size_mb".into())
                })?;
            }
            ["log", "auto_cleanup"] => {
                self.log.auto_cleanup = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["log", "log_level"] => {
                let valid = ["trace", "debug", "info", "warn", "error"];
                let lower = value.to_lowercase();
                if !valid.contains(&lower.as_str()) {
                    return Err(CogniaError::Config(format!(
                        "Invalid log level '{}'. Must be one of: trace, debug, info, warn, error",
                        value
                    )));
                }
                self.log.log_level = lower;
            }
            ["backup", "auto_backup_enabled"] => {
                self.backup.auto_backup_enabled = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["backup", "auto_backup_interval_hours"] => {
                self.backup.auto_backup_interval_hours = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for auto_backup_interval_hours".into())
                })?;
            }
            ["backup", "max_backups"] => {
                self.backup.max_backups = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid value for max_backups".into()))?;
            }
            ["backup", "retention_days"] => {
                self.backup.retention_days = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid value for retention_days".into()))?;
            }
            ["plugin", "auto_load_on_startup"] => {
                self.plugin.auto_load_on_startup = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["plugin", "max_execution_timeout_secs"] => {
                self.plugin.max_execution_timeout_secs = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for max_execution_timeout_secs".into())
                })?;
            }
            ["plugin", "sandbox_fs"] => {
                self.plugin.sandbox_fs = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["plugin", "permission_enforcement_mode"] => {
                let mode = value.trim().to_ascii_lowercase();
                if mode != "compat" && mode != "strict" {
                    return Err(CogniaError::Config(
                        "Invalid value for permission_enforcement_mode (expected compat|strict)"
                            .into(),
                    ));
                }
                self.plugin.permission_enforcement_mode = mode;
            }
            ["startup", "scan_environments"] => {
                self.startup.scan_environments = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["startup", "scan_packages"] => {
                self.startup.scan_packages = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["startup", "max_concurrent_scans"] => {
                self.startup.max_concurrent_scans = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for max_concurrent_scans".into())
                })?;
            }
            ["startup", "startup_timeout_secs"] => {
                self.startup.startup_timeout_secs = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for startup_timeout_secs".into())
                })?;
            }
            ["startup", "integrity_check"] => {
                self.startup.integrity_check = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["shortcuts", "enabled"] => {
                self.shortcuts.enabled = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["shortcuts", "toggle_window"] => {
                self.shortcuts.toggle_window = value.to_string();
            }
            ["shortcuts", "command_palette"] => {
                self.shortcuts.command_palette = value.to_string();
            }
            ["shortcuts", "quick_search"] => {
                self.shortcuts.quick_search = value.to_string();
            }
            ["providers", provider, "token"] => {
                let ps = self.providers.entry(provider.to_string()).or_default();
                if value.is_empty() {
                    ps.extra.remove("token");
                } else {
                    ps.extra
                        .insert("token".to_string(), toml::Value::String(value.to_string()));
                }
            }
            ["providers", provider, "url"] => {
                let ps = self.providers.entry(provider.to_string()).or_default();
                if value.is_empty() {
                    ps.extra.remove("url");
                } else {
                    ps.extra
                        .insert("url".to_string(), toml::Value::String(value.to_string()));
                }
            }
            ["mirrors", provider] => {
                let config = self.mirrors.entry(provider.to_string()).or_default();
                config.url = value.to_string();
            }
            ["mirrors", provider, "enabled"] => {
                let config = self.mirrors.entry(provider.to_string()).or_default();
                config.enabled = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid boolean value for mirror enabled".into())
                })?;
            }
            ["mirrors", provider, "priority"] => {
                let config = self.mirrors.entry(provider.to_string()).or_default();
                config.priority = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid priority value".into()))?;
            }
            ["mirrors", provider, "verify_ssl"] => {
                let config = self.mirrors.entry(provider.to_string()).or_default();
                config.verify_ssl = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid boolean value for verify_ssl".into())
                })?;
            }
            _ => return Err(CogniaError::Config(format!("Unknown config key: {}", key))),
        }

        Ok(())
    }

    /// Get mirror URL for a specific provider, returning None if not configured or disabled
    pub fn get_mirror_url(&self, provider: &str) -> Option<String> {
        self.mirrors.get(provider).and_then(|m| {
            if m.enabled && !m.url.is_empty() {
                Some(m.url.clone())
            } else {
                None
            }
        })
    }

    /// Get all configured and enabled mirrors sorted by priority (higher priority first)
    pub fn get_enabled_mirrors(&self) -> Vec<(&String, &MirrorConfig)> {
        let mut mirrors: Vec<_> = self
            .mirrors
            .iter()
            .filter(|(_, m)| m.enabled && !m.url.is_empty())
            .collect();
        mirrors.sort_by(|a, b| b.1.priority.cmp(&a.1.priority));
        mirrors
    }

    /// Check if SSL verification should be performed for a specific mirror
    pub fn should_verify_ssl(&self, provider: &str) -> bool {
        self.mirrors
            .get(provider)
            .map(|m| m.verify_ssl)
            .unwrap_or(self.security.verify_certificates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ===== Default values =====

    #[test]
    fn test_default_settings() {
        let s = Settings::default();
        assert_eq!(s.general.parallel_downloads, 4);
        assert_eq!(s.general.resolve_strategy, ResolveStrategy::Latest);
        assert_eq!(s.general.min_install_space_mb, 100);
        assert!(s.updates.check_on_start);
        assert!(!s.updates.auto_install);
        assert!(s.updates.notify);
        assert!(s.tray.minimize_to_tray);
        assert!(!s.tray.start_minimized);
        assert!(s.tray.show_notifications);
        assert_eq!(s.tray.click_behavior, TrayClickBehavior::ToggleWindow);
        assert!(s.tray.menu_items.contains(&TrayMenuItemId::Quit));
        assert!(s.mirrors.is_empty());
        assert!(s.providers.is_empty());
    }

    #[test]
    fn test_default_general() {
        let g = GeneralSettings::default();
        assert_eq!(g.parallel_downloads, 4);
        assert_eq!(g.resolve_strategy, ResolveStrategy::Latest);
        assert!(g.auto_update_metadata);
        assert_eq!(g.metadata_cache_ttl, 3600);
        assert_eq!(g.cache_max_size, 5 * 1024 * 1024 * 1024);
        assert_eq!(g.cache_max_age_days, 30);
        assert!(g.auto_clean_cache);
        assert_eq!(g.min_install_space_mb, 100);
        assert_eq!(g.cache_auto_clean_threshold, 80);
        assert_eq!(g.cache_monitor_interval, 300);
        assert!(!g.cache_monitor_external);
        assert_eq!(g.download_speed_limit, 0);
    }

    #[test]
    fn test_default_appearance() {
        let a = AppearanceSettings::default();
        assert_eq!(a.theme, "system");
        assert_eq!(a.accent_color, "blue");
        assert_eq!(a.chart_color_theme, "default");
        assert_eq!(a.interface_radius, 0.625);
        assert_eq!(a.interface_density, "comfortable");
        assert_eq!(a.language, "en");
        assert!(!a.reduced_motion);
    }

    #[test]
    fn test_default_terminal() {
        let t = TerminalSettings::default();
        assert_eq!(t.default_shell, "auto");
        assert!(t.default_profile_id.is_none());
        assert!(t.shell_integration);
        assert_eq!(t.proxy_mode, "global");
        assert!(t.custom_proxy.is_none());
        assert!(t.no_proxy.is_none());
    }

    #[test]
    fn test_default_network() {
        let n = NetworkSettings::default();
        assert_eq!(n.timeout, 30);
        assert_eq!(n.retries, 3);
        assert!(n.proxy.is_none());
        assert!(n.no_proxy.is_none());
    }

    #[test]
    fn test_default_security() {
        let s = SecuritySettings::default();
        assert!(!s.allow_http);
        assert!(s.verify_certificates);
        assert!(!s.allow_self_signed);
    }

    #[test]
    fn test_default_resolve_strategy() {
        assert_eq!(ResolveStrategy::default(), ResolveStrategy::Latest);
    }

    #[test]
    fn test_default_provider_settings() {
        let ps = ProviderSettings::default();
        assert!(ps.enabled);
        assert_eq!(ps.priority, 0);
        assert!(ps.extra.is_empty());
    }

    #[test]
    fn test_default_global_provider_settings() {
        let gps = GlobalProviderSettings::default();
        assert!(gps.pinned_packages.is_empty());
        assert!(gps.disabled_providers.is_empty());
    }

    #[test]
    fn test_default_path_settings() {
        let ps = PathSettings::default();
        assert!(ps.root.is_none());
        assert!(ps.cache.is_none());
        assert!(ps.environments.is_none());
    }

    #[test]
    fn test_default_mirror_config() {
        let mc = MirrorConfig::default();
        assert_eq!(mc.url, "");
        assert_eq!(mc.priority, 0);
        assert!(mc.enabled);
        assert!(mc.verify_ssl);
    }

    // ===== get_value / set_value: general section =====

    #[test]
    fn test_get_set_parallel_downloads() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("general.parallel_downloads"), Some("4".into()));
        s.set_value("general.parallel_downloads", "8").unwrap();
        assert_eq!(s.get_value("general.parallel_downloads"), Some("8".into()));
        assert_eq!(s.general.parallel_downloads, 8);
    }

    #[test]
    fn test_get_set_resolve_strategy_all_variants() {
        let mut s = Settings::default();
        for (input, expected_enum, expected_str) in [
            ("latest", ResolveStrategy::Latest, "latest"),
            ("minimal", ResolveStrategy::Minimal, "minimal"),
            ("locked", ResolveStrategy::Locked, "locked"),
            (
                "prefer-locked",
                ResolveStrategy::PreferLocked,
                "prefer-locked",
            ),
        ] {
            s.set_value("general.resolve_strategy", input).unwrap();
            assert_eq!(s.general.resolve_strategy, expected_enum);
            assert_eq!(
                s.get_value("general.resolve_strategy"),
                Some(expected_str.to_string())
            );
        }
    }

    #[test]
    fn test_get_set_auto_update_metadata() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("general.auto_update_metadata"),
            Some("true".into())
        );
        s.set_value("general.auto_update_metadata", "false")
            .unwrap();
        assert!(!s.general.auto_update_metadata);
        assert_eq!(
            s.get_value("general.auto_update_metadata"),
            Some("false".into())
        );
    }

    #[test]
    fn test_get_set_metadata_cache_ttl() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("general.metadata_cache_ttl"),
            Some("3600".into())
        );
        s.set_value("general.metadata_cache_ttl", "7200").unwrap();
        assert_eq!(s.general.metadata_cache_ttl, 7200);
    }

    #[test]
    fn test_get_set_cache_max_size() {
        let mut s = Settings::default();
        s.set_value("general.cache_max_size", "1073741824").unwrap();
        assert_eq!(s.general.cache_max_size, 1073741824);
        assert_eq!(
            s.get_value("general.cache_max_size"),
            Some("1073741824".into())
        );
    }

    #[test]
    fn test_get_set_cache_max_age_days() {
        let mut s = Settings::default();
        s.set_value("general.cache_max_age_days", "60").unwrap();
        assert_eq!(s.general.cache_max_age_days, 60);
        assert_eq!(s.get_value("general.cache_max_age_days"), Some("60".into()));
    }

    #[test]
    fn test_get_set_auto_clean_cache() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("general.auto_clean_cache"), Some("true".into()));
        s.set_value("general.auto_clean_cache", "false").unwrap();
        assert!(!s.general.auto_clean_cache);
    }

    #[test]
    fn test_get_set_min_install_space_mb() {
        let mut s = Settings::default();
        s.set_value("general.min_install_space_mb", "250").unwrap();
        assert_eq!(
            s.get_value("general.min_install_space_mb"),
            Some("250".into())
        );
    }

    #[test]
    fn test_get_set_cache_auto_clean_threshold() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("general.cache_auto_clean_threshold"),
            Some("80".into())
        );
        s.set_value("general.cache_auto_clean_threshold", "90")
            .unwrap();
        assert_eq!(s.general.cache_auto_clean_threshold, 90);
    }

    #[test]
    fn test_get_set_cache_monitor_interval() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("general.cache_monitor_interval"),
            Some("300".into())
        );
        s.set_value("general.cache_monitor_interval", "600")
            .unwrap();
        assert_eq!(s.general.cache_monitor_interval, 600);
    }

    #[test]
    fn test_get_set_cache_monitor_external() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("general.cache_monitor_external"),
            Some("false".into())
        );
        s.set_value("general.cache_monitor_external", "true")
            .unwrap();
        assert!(s.general.cache_monitor_external);
    }

    #[test]
    fn test_get_set_download_speed_limit() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("general.download_speed_limit"),
            Some("0".into())
        );
        s.set_value("general.download_speed_limit", "1048576")
            .unwrap();
        assert_eq!(s.general.download_speed_limit, 1048576);
        assert!(s
            .set_value("general.download_speed_limit", "not_a_number")
            .is_err());
    }

    // ===== get_value / set_value: network section =====

    #[test]
    fn test_get_set_network_timeout() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("network.timeout"), Some("30".into()));
        s.set_value("network.timeout", "60").unwrap();
        assert_eq!(s.network.timeout, 60);
    }

    #[test]
    fn test_get_set_network_retries() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("network.retries"), Some("3".into()));
        s.set_value("network.retries", "5").unwrap();
        assert_eq!(s.network.retries, 5);
    }

    #[test]
    fn test_get_set_network_proxy() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("network.proxy"), None);
        s.set_value("network.proxy", "http://proxy:8080").unwrap();
        assert_eq!(
            s.get_value("network.proxy"),
            Some("http://proxy:8080".into())
        );
        s.set_value("network.proxy", "").unwrap();
        assert!(s.network.proxy.is_none());
    }

    #[test]
    fn test_get_set_network_no_proxy() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("network.no_proxy"), Some(String::new()));
        s.set_value("network.no_proxy", "localhost,127.0.0.1")
            .unwrap();
        assert_eq!(
            s.get_value("network.no_proxy"),
            Some("localhost,127.0.0.1".into())
        );
        s.set_value("network.no_proxy", "").unwrap();
        assert!(s.network.no_proxy.is_none());
    }

    // ===== get_value / set_value: security section =====

    #[test]
    fn test_get_set_security_all_keys() {
        let mut s = Settings::default();

        assert_eq!(s.get_value("security.allow_http"), Some("false".into()));
        s.set_value("security.allow_http", "true").unwrap();
        assert!(s.security.allow_http);

        assert_eq!(
            s.get_value("security.verify_certificates"),
            Some("true".into())
        );
        s.set_value("security.verify_certificates", "false")
            .unwrap();
        assert!(!s.security.verify_certificates);

        assert_eq!(
            s.get_value("security.allow_self_signed"),
            Some("false".into())
        );
        s.set_value("security.allow_self_signed", "true").unwrap();
        assert!(s.security.allow_self_signed);
    }

    // ===== get_value / set_value: paths section =====

    #[test]
    fn test_get_set_paths_all_keys() {
        let mut s = Settings::default();

        // All default to empty string
        assert_eq!(s.get_value("paths.root"), Some(String::new()));
        assert_eq!(s.get_value("paths.cache"), Some(String::new()));
        assert_eq!(s.get_value("paths.environments"), Some(String::new()));

        s.set_value("paths.root", "/custom/root").unwrap();
        assert_eq!(s.paths.root, Some(PathBuf::from("/custom/root")));

        s.set_value("paths.cache", "/custom/cache").unwrap();
        assert_eq!(s.paths.cache, Some(PathBuf::from("/custom/cache")));

        s.set_value("paths.environments", "/custom/envs").unwrap();
        assert_eq!(s.paths.environments, Some(PathBuf::from("/custom/envs")));

        // Clear
        s.set_value("paths.root", "").unwrap();
        assert!(s.paths.root.is_none());
        s.set_value("paths.cache", "").unwrap();
        assert!(s.paths.cache.is_none());
        s.set_value("paths.environments", "").unwrap();
        assert!(s.paths.environments.is_none());
    }

    // ===== get_value / set_value: appearance section =====

    #[test]
    fn test_get_set_appearance_theme() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("appearance.theme"), Some("system".into()));
        for valid in ["light", "dark", "system"] {
            s.set_value("appearance.theme", valid).unwrap();
            assert_eq!(s.get_value("appearance.theme"), Some(valid.to_string()));
        }
    }

    #[test]
    fn test_get_set_appearance_accent_color() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("appearance.accent_color"), Some("blue".into()));
        for valid in ["zinc", "blue", "green", "purple", "orange", "rose"] {
            s.set_value("appearance.accent_color", valid).unwrap();
            assert_eq!(s.appearance.accent_color, valid);
        }
    }

    #[test]
    fn test_get_set_appearance_chart_color_theme() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("appearance.chart_color_theme"),
            Some("default".into())
        );
        for valid in [
            "default",
            "vibrant",
            "pastel",
            "ocean",
            "sunset",
            "monochrome",
        ] {
            s.set_value("appearance.chart_color_theme", valid).unwrap();
            assert_eq!(s.appearance.chart_color_theme, valid);
        }
    }

    #[test]
    fn test_get_set_appearance_interface_radius() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("appearance.interface_radius"),
            Some("0.625".into())
        );
        for valid in ["0", "0.3", "0.5", "0.625", "0.75", "1"] {
            s.set_value("appearance.interface_radius", valid).unwrap();
        }
        assert_eq!(s.appearance.interface_radius, 1.0);
    }

    #[test]
    fn test_get_set_appearance_interface_density() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("appearance.interface_density"),
            Some("comfortable".into())
        );
        for valid in ["compact", "comfortable", "spacious"] {
            s.set_value("appearance.interface_density", valid).unwrap();
            assert_eq!(s.appearance.interface_density, valid);
        }
    }

    #[test]
    fn test_get_set_appearance_language() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("appearance.language"), Some("en".into()));
        s.set_value("appearance.language", "zh").unwrap();
        assert_eq!(s.appearance.language, "zh");
    }

    #[test]
    fn test_get_set_appearance_reduced_motion() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("appearance.reduced_motion"),
            Some("false".into())
        );
        s.set_value("appearance.reduced_motion", "true").unwrap();
        assert!(s.appearance.reduced_motion);
    }

    #[test]
    fn test_get_set_appearance_window_effect() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("appearance.window_effect"), Some("auto".into()));
        for valid in [
            "auto",
            "none",
            "mica",
            "mica-tabbed",
            "acrylic",
            "blur",
            "vibrancy",
        ] {
            s.set_value("appearance.window_effect", valid).unwrap();
            assert_eq!(s.appearance.window_effect, valid);
        }
        assert!(s.set_value("appearance.window_effect", "invalid").is_err());
    }

    // ===== get_value / set_value: terminal section =====

    #[test]
    fn test_get_set_terminal_default_shell() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("terminal.default_shell"), Some("auto".into()));
        s.set_value("terminal.default_shell", "bash").unwrap();
        assert_eq!(s.terminal.default_shell, "bash");
    }

    #[test]
    fn test_get_set_terminal_default_profile_id() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("terminal.default_profile_id"),
            Some(String::new())
        );
        s.set_value("terminal.default_profile_id", "my-profile")
            .unwrap();
        assert_eq!(
            s.terminal.default_profile_id,
            Some("my-profile".to_string())
        );
        s.set_value("terminal.default_profile_id", "").unwrap();
        assert!(s.terminal.default_profile_id.is_none());
    }

    #[test]
    fn test_get_set_terminal_shell_integration() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("terminal.shell_integration"),
            Some("true".into())
        );
        s.set_value("terminal.shell_integration", "false").unwrap();
        assert!(!s.terminal.shell_integration);
    }

    #[test]
    fn test_get_set_terminal_proxy_mode() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("terminal.proxy_mode"), Some("global".into()));
        for valid in ["global", "none", "custom"] {
            s.set_value("terminal.proxy_mode", valid).unwrap();
            assert_eq!(s.terminal.proxy_mode, valid);
        }
    }

    #[test]
    fn test_terminal_proxy_mode_is_canonicalized() {
        let mut s = Settings::default();
        s.set_value("terminal.proxy_mode", "  CUSTOM ").unwrap();
        assert_eq!(s.terminal.proxy_mode, "custom");
        assert_eq!(s.get_value("terminal.proxy_mode"), Some("custom".into()));
    }

    #[test]
    fn test_get_set_terminal_custom_proxy() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("terminal.custom_proxy"), Some(String::new()));
        s.set_value("terminal.custom_proxy", "socks5://localhost:1080")
            .unwrap();
        assert_eq!(
            s.terminal.custom_proxy,
            Some("socks5://localhost:1080".into())
        );
        s.set_value("terminal.custom_proxy", "").unwrap();
        assert!(s.terminal.custom_proxy.is_none());
    }

    #[test]
    fn test_terminal_custom_proxy_rejects_invalid_url_non_destructive() {
        let mut s = Settings::default();
        s.set_value("terminal.custom_proxy", "http://proxy.local:8080")
            .unwrap();
        let before = s.terminal.custom_proxy.clone();

        let err = s
            .set_value("terminal.custom_proxy", "ftp://proxy.local:2121")
            .unwrap_err()
            .to_string();

        assert!(err.contains("Invalid proxy URL scheme"));
        assert_eq!(s.terminal.custom_proxy, before);
    }

    #[test]
    fn test_get_set_terminal_no_proxy() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("terminal.no_proxy"), Some(String::new()));
        s.set_value("terminal.no_proxy", "localhost").unwrap();
        assert_eq!(s.terminal.no_proxy, Some("localhost".into()));
        s.set_value("terminal.no_proxy", "").unwrap();
        assert!(s.terminal.no_proxy.is_none());
    }

    #[test]
    fn test_terminal_no_proxy_is_canonicalized() {
        let mut s = Settings::default();
        s.set_value("terminal.no_proxy", " localhost ; 127.0.0.1, .corp.local ")
            .unwrap();
        assert_eq!(
            s.terminal.no_proxy,
            Some("localhost,127.0.0.1,.corp.local".into())
        );
    }

    // ===== get_value / set_value: providers section =====

    #[test]
    fn test_get_set_provider_token() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("providers.github.token"), None);
        s.set_value("providers.github.token", "ghp_abc123").unwrap();
        assert_eq!(
            s.get_value("providers.github.token"),
            Some("ghp_abc123".into())
        );
        // Clear
        s.set_value("providers.github.token", "").unwrap();
        assert_eq!(s.get_value("providers.github.token"), None);
    }

    #[test]
    fn test_get_set_provider_url() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("providers.gitlab.url"), None);
        s.set_value("providers.gitlab.url", "https://gitlab.example.com")
            .unwrap();
        assert_eq!(
            s.get_value("providers.gitlab.url"),
            Some("https://gitlab.example.com".into())
        );
        s.set_value("providers.gitlab.url", "").unwrap();
        assert_eq!(s.get_value("providers.gitlab.url"), None);
    }

    // ===== get_value / set_value: disabled_providers =====

    #[test]
    fn test_set_disabled_providers_json_array() {
        let mut s = Settings::default();
        s.set_value(
            "provider_settings.disabled_providers",
            r#"["snap","flatpak"]"#,
        )
        .unwrap();
        assert_eq!(
            s.provider_settings.disabled_providers,
            vec!["snap", "flatpak"]
        );
        // get_value returns JSON
        let val = s.get_value("provider_settings.disabled_providers").unwrap();
        assert!(val.contains("snap"));
    }

    #[test]
    fn test_set_disabled_providers_csv() {
        let mut s = Settings::default();
        s.set_value(
            "provider_settings.disabled_providers",
            "snap, flatpak, docker",
        )
        .unwrap();
        assert_eq!(
            s.provider_settings.disabled_providers,
            vec!["snap", "flatpak", "docker"]
        );
    }

    #[test]
    fn test_set_disabled_providers_empty() {
        let mut s = Settings::default();
        s.set_value("provider_settings.disabled_providers", "snap")
            .unwrap();
        assert_eq!(s.provider_settings.disabled_providers.len(), 1);
        s.set_value("provider_settings.disabled_providers", "")
            .unwrap();
        assert!(s.provider_settings.disabled_providers.is_empty());
    }

    // ===== Validation errors =====

    #[test]
    fn test_set_invalid_theme() {
        let mut s = Settings::default();
        assert!(s.set_value("appearance.theme", "neon").is_err());
    }

    #[test]
    fn test_set_invalid_accent_color() {
        let mut s = Settings::default();
        assert!(s.set_value("appearance.accent_color", "red").is_err());
    }

    #[test]
    fn test_set_invalid_chart_color_theme() {
        let mut s = Settings::default();
        assert!(s
            .set_value("appearance.chart_color_theme", "rainbow")
            .is_err());
    }

    #[test]
    fn test_set_invalid_interface_radius() {
        let mut s = Settings::default();
        assert!(s.set_value("appearance.interface_radius", "0.9").is_err());
        assert!(s
            .set_value("appearance.interface_radius", "not_float")
            .is_err());
    }

    #[test]
    fn test_set_invalid_interface_density() {
        let mut s = Settings::default();
        assert!(s.set_value("appearance.interface_density", "tiny").is_err());
    }

    #[test]
    fn test_set_invalid_language() {
        let mut s = Settings::default();
        assert!(s.set_value("appearance.language", "fr").is_err());
    }

    #[test]
    fn test_set_invalid_resolve_strategy() {
        let mut s = Settings::default();
        assert!(s.set_value("general.resolve_strategy", "random").is_err());
    }

    #[test]
    fn test_set_invalid_proxy_mode() {
        let mut s = Settings::default();
        assert!(s.set_value("terminal.proxy_mode", "auto").is_err());
    }

    #[test]
    fn test_set_cache_threshold_over_100() {
        let mut s = Settings::default();
        assert!(s
            .set_value("general.cache_auto_clean_threshold", "101")
            .is_err());
        // Edge cases: 0 and 100 are valid
        s.set_value("general.cache_auto_clean_threshold", "0")
            .unwrap();
        assert_eq!(s.general.cache_auto_clean_threshold, 0);
        s.set_value("general.cache_auto_clean_threshold", "100")
            .unwrap();
        assert_eq!(s.general.cache_auto_clean_threshold, 100);
    }

    #[test]
    fn test_set_invalid_boolean() {
        let mut s = Settings::default();
        assert!(s.set_value("general.auto_update_metadata", "yes").is_err());
        assert!(s.set_value("security.allow_http", "1").is_err());
        assert!(s.set_value("terminal.shell_integration", "on").is_err());
    }

    #[test]
    fn test_get_set_update_check_concurrency() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("general.update_check_concurrency"),
            Some("8".into())
        );
        s.set_value("general.update_check_concurrency", "16")
            .unwrap();
        assert_eq!(
            s.get_value("general.update_check_concurrency"),
            Some("16".into())
        );
        assert_eq!(s.general.update_check_concurrency, 16);
    }

    #[test]
    fn test_update_check_concurrency_boundary() {
        let mut s = Settings::default();
        // Min boundary
        s.set_value("general.update_check_concurrency", "1")
            .unwrap();
        assert_eq!(s.general.update_check_concurrency, 1);
        // Max boundary
        s.set_value("general.update_check_concurrency", "32")
            .unwrap();
        assert_eq!(s.general.update_check_concurrency, 32);
        // Below min
        assert!(s
            .set_value("general.update_check_concurrency", "0")
            .is_err());
        // Above max
        assert!(s
            .set_value("general.update_check_concurrency", "33")
            .is_err());
        // Invalid string
        assert!(s
            .set_value("general.update_check_concurrency", "abc")
            .is_err());
    }

    #[test]
    fn test_default_update_check_concurrency() {
        let g = GeneralSettings::default();
        assert_eq!(g.update_check_concurrency, 8);
    }

    #[test]
    fn test_set_invalid_number() {
        let mut s = Settings::default();
        assert!(s.set_value("general.parallel_downloads", "abc").is_err());
        assert!(s.set_value("network.timeout", "xyz").is_err());
        assert!(s.set_value("network.retries", "-1").is_err());
    }

    #[test]
    fn test_set_unknown_key() {
        let mut s = Settings::default();
        assert!(s.set_value("nonexistent.key", "value").is_err());
        assert!(s.set_value("general.nonexistent", "value").is_err());
    }

    #[test]
    fn test_get_unknown_key() {
        let s = Settings::default();
        assert_eq!(s.get_value("nonexistent.key"), None);
        assert_eq!(s.get_value("general.nonexistent"), None);
    }

    // ===== Path helpers =====

    #[test]
    fn test_get_root_dir_custom() {
        let mut s = Settings::default();
        s.paths.root = Some(PathBuf::from("/custom/root"));
        assert_eq!(s.get_root_dir(), PathBuf::from("/custom/root"));
    }

    #[test]
    fn test_get_cache_dir_custom() {
        let mut s = Settings::default();
        s.paths.cache = Some(PathBuf::from("/custom/cache"));
        assert_eq!(s.get_cache_dir(), PathBuf::from("/custom/cache"));
    }

    #[test]
    fn test_get_cache_dir_default_fallback() {
        let mut s = Settings::default();
        s.paths.root = Some(PathBuf::from("/my/root"));
        assert_eq!(s.get_cache_dir(), PathBuf::from("/my/root/cache"));
    }

    #[test]
    fn test_get_environments_dir_custom() {
        let mut s = Settings::default();
        s.paths.environments = Some(PathBuf::from("/custom/envs"));
        assert_eq!(s.get_environments_dir(), PathBuf::from("/custom/envs"));
    }

    #[test]
    fn test_get_environments_dir_default_fallback() {
        let mut s = Settings::default();
        s.paths.root = Some(PathBuf::from("/my/root"));
        assert_eq!(
            s.get_environments_dir(),
            PathBuf::from("/my/root/environments")
        );
    }

    #[test]
    fn test_get_bin_dir() {
        let mut s = Settings::default();
        s.paths.root = Some(PathBuf::from("/my/root"));
        assert_eq!(s.get_bin_dir(), PathBuf::from("/my/root/bin"));
    }

    #[test]
    fn test_get_state_dir() {
        let mut s = Settings::default();
        s.paths.root = Some(PathBuf::from("/my/root"));
        assert_eq!(s.get_state_dir(), PathBuf::from("/my/root/state"));
    }

    // ===== Mirror helpers =====

    #[test]
    fn test_mirror_config_builder() {
        let config = MirrorConfig::new("https://pypi.tuna.tsinghua.edu.cn/simple").with_priority(5);
        assert_eq!(config.url, "https://pypi.tuna.tsinghua.edu.cn/simple");
        assert_eq!(config.priority, 5);
        assert!(config.enabled);
        assert!(config.verify_ssl);

        let disabled = MirrorConfig::new("https://example.com").disabled();
        assert!(!disabled.enabled);
    }

    #[test]
    fn test_mirror_config_builder_chain() {
        let mc = MirrorConfig::new("https://example.com")
            .with_priority(10)
            .disabled();
        assert_eq!(mc.url, "https://example.com");
        assert_eq!(mc.priority, 10);
        assert!(!mc.enabled);
    }

    #[test]
    fn test_mirror_get_set() {
        let mut s = Settings::default();

        s.set_value("mirrors.npm", "https://registry.npmmirror.com")
            .unwrap();
        assert_eq!(
            s.get_value("mirrors.npm"),
            Some("https://registry.npmmirror.com".into())
        );

        s.set_value("mirrors.npm.enabled", "true").unwrap();
        assert_eq!(s.get_value("mirrors.npm.enabled"), Some("true".into()));

        s.set_value("mirrors.npm.priority", "10").unwrap();
        assert_eq!(s.get_value("mirrors.npm.priority"), Some("10".into()));

        assert_eq!(
            s.get_mirror_url("npm"),
            Some("https://registry.npmmirror.com".into())
        );

        s.set_value("mirrors.npm.enabled", "false").unwrap();
        assert_eq!(s.get_mirror_url("npm"), None);
    }

    #[test]
    fn test_mirror_verify_ssl_get_set() {
        let mut s = Settings::default();
        s.set_value("mirrors.npm", "https://registry.npmmirror.com")
            .unwrap();
        assert_eq!(s.get_value("mirrors.npm.verify_ssl"), Some("true".into()));
        s.set_value("mirrors.npm.verify_ssl", "false").unwrap();
        assert!(!s.mirrors.get("npm").unwrap().verify_ssl);
        assert_eq!(s.get_value("mirrors.npm.verify_ssl"), Some("false".into()));
    }

    #[test]
    fn test_get_mirror_url_empty_url() {
        let mut s = Settings::default();
        s.mirrors.insert("npm".into(), MirrorConfig::default());
        assert_eq!(s.get_mirror_url("npm"), None); // empty url
    }

    #[test]
    fn test_get_mirror_url_not_configured() {
        let s = Settings::default();
        assert_eq!(s.get_mirror_url("npm"), None);
    }

    #[test]
    fn test_get_enabled_mirrors() {
        let mut s = Settings::default();

        s.set_value("mirrors.npm", "https://registry.npmmirror.com")
            .unwrap();
        s.set_value("mirrors.npm.priority", "5").unwrap();

        s.set_value("mirrors.pypi", "https://pypi.tuna.tsinghua.edu.cn/simple")
            .unwrap();
        s.set_value("mirrors.pypi.priority", "10").unwrap();

        let enabled = s.get_enabled_mirrors();
        assert_eq!(enabled.len(), 2);
        // Higher priority first
        assert_eq!(enabled[0].0, "pypi");
        assert_eq!(enabled[1].0, "npm");
    }

    #[test]
    fn test_get_enabled_mirrors_excludes_disabled() {
        let mut s = Settings::default();
        s.set_value("mirrors.npm", "https://npm.example.com")
            .unwrap();
        s.set_value("mirrors.npm.enabled", "false").unwrap();
        s.set_value("mirrors.pypi", "https://pypi.example.com")
            .unwrap();

        let enabled = s.get_enabled_mirrors();
        assert_eq!(enabled.len(), 1);
        assert_eq!(enabled[0].0, "pypi");
    }

    #[test]
    fn test_get_enabled_mirrors_excludes_empty_url() {
        let mut s = Settings::default();
        s.mirrors.insert("npm".into(), MirrorConfig::default()); // empty url
        let enabled = s.get_enabled_mirrors();
        assert!(enabled.is_empty());
    }

    // ===== SSL helpers =====

    #[test]
    fn test_should_verify_ssl_with_mirror_config() {
        let mut s = Settings::default();
        s.set_value("mirrors.npm", "https://npm.example.com")
            .unwrap();
        s.set_value("mirrors.npm.verify_ssl", "false").unwrap();
        assert!(!s.should_verify_ssl("npm"));
    }

    #[test]
    fn test_should_verify_ssl_without_mirror_config() {
        let s = Settings::default();
        // Falls back to security.verify_certificates (true by default)
        assert!(s.should_verify_ssl("npm"));
    }

    #[test]
    fn test_should_verify_ssl_fallback_to_security() {
        let mut s = Settings::default();
        s.security.verify_certificates = false;
        assert!(!s.should_verify_ssl("unconfigured_provider"));
    }

    // ===== Serialize / Deserialize =====

    #[test]
    fn test_serialize_deserialize_roundtrip() {
        let settings = Settings::default();
        let toml_str = toml::to_string(&settings).unwrap();
        let parsed: Settings = toml::from_str(&toml_str).unwrap();

        assert_eq!(
            settings.general.parallel_downloads,
            parsed.general.parallel_downloads
        );
        assert_eq!(
            settings.general.resolve_strategy,
            parsed.general.resolve_strategy
        );
        assert_eq!(settings.appearance.theme, parsed.appearance.theme);
        assert_eq!(
            settings.terminal.default_shell,
            parsed.terminal.default_shell
        );
        assert_eq!(
            settings.security.verify_certificates,
            parsed.security.verify_certificates
        );
    }

    #[test]
    fn test_serialize_deserialize_with_custom_values() {
        let mut s = Settings::default();
        s.set_value("general.parallel_downloads", "16").unwrap();
        s.set_value("general.resolve_strategy", "prefer-locked")
            .unwrap();
        s.set_value("appearance.theme", "dark").unwrap();
        s.set_value("network.proxy", "http://proxy:8080").unwrap();
        s.set_value("mirrors.npm", "https://npm.example.com")
            .unwrap();
        s.set_value("providers.github.token", "ghp_test").unwrap();

        let toml_str = toml::to_string(&s).unwrap();
        let parsed: Settings = toml::from_str(&toml_str).unwrap();

        assert_eq!(parsed.general.parallel_downloads, 16);
        assert_eq!(
            parsed.general.resolve_strategy,
            ResolveStrategy::PreferLocked
        );
        assert_eq!(parsed.appearance.theme, "dark");
        assert_eq!(parsed.network.proxy, Some("http://proxy:8080".into()));
        assert_eq!(
            parsed.mirrors.get("npm").unwrap().url,
            "https://npm.example.com"
        );
    }

    // ===== ResolveStrategy serde =====

    #[test]
    fn test_resolve_strategy_serde_all_variants() {
        for (variant, expected_str) in [
            (ResolveStrategy::Latest, "\"latest\""),
            (ResolveStrategy::Minimal, "\"minimal\""),
            (ResolveStrategy::Locked, "\"locked\""),
            (ResolveStrategy::PreferLocked, "\"preferlocked\""),
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            assert_eq!(json, expected_str);
            let parsed: ResolveStrategy = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, variant);
        }
    }

    // ===== Mirror invalid values =====

    #[test]
    fn test_set_mirror_invalid_enabled() {
        let mut s = Settings::default();
        s.set_value("mirrors.npm", "https://example.com").unwrap();
        assert!(s.set_value("mirrors.npm.enabled", "yes").is_err());
    }

    #[test]
    fn test_set_mirror_invalid_priority() {
        let mut s = Settings::default();
        s.set_value("mirrors.npm", "https://example.com").unwrap();
        assert!(s.set_value("mirrors.npm.priority", "high").is_err());
    }

    #[test]
    fn test_set_mirror_invalid_verify_ssl() {
        let mut s = Settings::default();
        s.set_value("mirrors.npm", "https://example.com").unwrap();
        assert!(s.set_value("mirrors.npm.verify_ssl", "yes").is_err());
    }

    // ===== LogSettings defaults and get/set =====

    #[test]
    fn test_default_log_settings() {
        let l = LogSettings::default();
        assert_eq!(l.max_retention_days, 30);
        assert_eq!(l.max_total_size_mb, 100);
        assert!(l.auto_cleanup);
    }

    #[test]
    fn test_get_set_log_max_retention_days() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("log.max_retention_days"), Some("30".into()));
        s.set_value("log.max_retention_days", "60").unwrap();
        assert_eq!(s.log.max_retention_days, 60);
        assert_eq!(s.get_value("log.max_retention_days"), Some("60".into()));
    }

    #[test]
    fn test_get_set_log_max_total_size_mb() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("log.max_total_size_mb"), Some("100".into()));
        s.set_value("log.max_total_size_mb", "200").unwrap();
        assert_eq!(s.log.max_total_size_mb, 200);
        assert_eq!(s.get_value("log.max_total_size_mb"), Some("200".into()));
    }

    #[test]
    fn test_get_set_log_auto_cleanup() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("log.auto_cleanup"), Some("true".into()));
        s.set_value("log.auto_cleanup", "false").unwrap();
        assert!(!s.log.auto_cleanup);
        assert_eq!(s.get_value("log.auto_cleanup"), Some("false".into()));
    }

    #[test]
    fn test_set_log_max_retention_days_zero_unlimited() {
        let mut s = Settings::default();
        s.set_value("log.max_retention_days", "0").unwrap();
        assert_eq!(s.log.max_retention_days, 0);
    }

    #[test]
    fn test_set_log_max_total_size_mb_zero_unlimited() {
        let mut s = Settings::default();
        s.set_value("log.max_total_size_mb", "0").unwrap();
        assert_eq!(s.log.max_total_size_mb, 0);
    }

    #[test]
    fn test_set_log_invalid_values() {
        let mut s = Settings::default();
        assert!(s.set_value("log.max_retention_days", "abc").is_err());
        assert!(s.set_value("log.max_total_size_mb", "xyz").is_err());
        assert!(s.set_value("log.auto_cleanup", "yes").is_err());
    }

    #[test]
    fn test_log_settings_serialize_roundtrip() {
        let mut s = Settings::default();
        s.set_value("log.max_retention_days", "14").unwrap();
        s.set_value("log.max_total_size_mb", "50").unwrap();
        s.set_value("log.auto_cleanup", "false").unwrap();

        let toml_str = toml::to_string(&s).unwrap();
        let parsed: Settings = toml::from_str(&toml_str).unwrap();

        assert_eq!(parsed.log.max_retention_days, 14);
        assert_eq!(parsed.log.max_total_size_mb, 50);
        assert!(!parsed.log.auto_cleanup);
    }

    // ===== BackupSettings defaults and get/set =====

    #[test]
    fn test_default_backup_settings() {
        let b = BackupSettings::default();
        assert!(!b.auto_backup_enabled);
        assert_eq!(b.auto_backup_interval_hours, 24);
        assert_eq!(b.max_backups, 10);
        assert_eq!(b.retention_days, 30);
    }

    #[test]
    fn test_get_set_backup_auto_backup_enabled() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("backup.auto_backup_enabled"),
            Some("false".into())
        );
        s.set_value("backup.auto_backup_enabled", "true").unwrap();
        assert!(s.backup.auto_backup_enabled);
        assert_eq!(
            s.get_value("backup.auto_backup_enabled"),
            Some("true".into())
        );
    }

    #[test]
    fn test_get_set_backup_auto_backup_interval_hours() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("backup.auto_backup_interval_hours"),
            Some("24".into())
        );
        s.set_value("backup.auto_backup_interval_hours", "12")
            .unwrap();
        assert_eq!(s.backup.auto_backup_interval_hours, 12);
    }

    #[test]
    fn test_get_set_backup_max_backups() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("backup.max_backups"), Some("10".into()));
        s.set_value("backup.max_backups", "5").unwrap();
        assert_eq!(s.backup.max_backups, 5);
    }

    #[test]
    fn test_get_set_backup_retention_days() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("backup.retention_days"), Some("30".into()));
        s.set_value("backup.retention_days", "0").unwrap();
        assert_eq!(s.backup.retention_days, 0);
    }

    #[test]
    fn test_set_backup_invalid_values() {
        let mut s = Settings::default();
        assert!(s.set_value("backup.auto_backup_enabled", "yes").is_err());
        assert!(s
            .set_value("backup.auto_backup_interval_hours", "abc")
            .is_err());
        assert!(s.set_value("backup.max_backups", "-1").is_err());
        assert!(s.set_value("backup.retention_days", "xyz").is_err());
    }

    #[test]
    fn test_backup_settings_serialize_roundtrip() {
        let mut s = Settings::default();
        s.set_value("backup.auto_backup_enabled", "true").unwrap();
        s.set_value("backup.auto_backup_interval_hours", "6")
            .unwrap();
        s.set_value("backup.max_backups", "20").unwrap();
        s.set_value("backup.retention_days", "90").unwrap();

        let toml_str = toml::to_string(&s).unwrap();
        let parsed: Settings = toml::from_str(&toml_str).unwrap();

        assert!(parsed.backup.auto_backup_enabled);
        assert_eq!(parsed.backup.auto_backup_interval_hours, 6);
        assert_eq!(parsed.backup.max_backups, 20);
        assert_eq!(parsed.backup.retention_days, 90);
    }

    // ===== UpdateSettings defaults and get/set =====

    #[test]
    fn test_default_update_settings() {
        let u = UpdateSettings::default();
        assert!(u.check_on_start);
        assert!(!u.auto_install);
        assert!(u.notify);
    }

    #[test]
    fn test_get_set_updates_values() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("updates.check_on_start"), Some("true".into()));
        assert_eq!(s.get_value("updates.auto_install"), Some("false".into()));
        assert_eq!(s.get_value("updates.notify"), Some("true".into()));

        s.set_value("updates.check_on_start", "false").unwrap();
        s.set_value("updates.auto_install", "true").unwrap();
        s.set_value("updates.notify", "false").unwrap();

        assert!(!s.updates.check_on_start);
        assert!(s.updates.auto_install);
        assert!(!s.updates.notify);
    }

    // ===== TraySettings defaults and get/set =====

    #[test]
    fn test_default_tray_settings() {
        let t = TraySettings::default();
        assert!(t.minimize_to_tray);
        assert!(!t.start_minimized);
        assert!(t.show_notifications);
        assert_eq!(t.notification_level, TrayNotificationLevel::All);
        assert_eq!(t.click_behavior, TrayClickBehavior::ToggleWindow);
        assert!(t.menu_items.contains(&TrayMenuItemId::ToggleNotifications));
        assert!(t.menu_items.contains(&TrayMenuItemId::Quit));
    }

    #[test]
    fn test_get_set_tray_values() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("tray.minimize_to_tray"), Some("true".into()));
        assert_eq!(s.get_value("tray.start_minimized"), Some("false".into()));
        assert_eq!(s.get_value("tray.show_notifications"), Some("true".into()));
        assert_eq!(s.get_value("tray.notification_level"), Some("all".into()));
        assert_eq!(
            s.get_value("tray.click_behavior"),
            Some("toggle_window".into())
        );

        s.set_value("tray.minimize_to_tray", "false").unwrap();
        s.set_value("tray.start_minimized", "true").unwrap();
        s.set_value("tray.show_notifications", "false").unwrap();
        s.set_value("tray.notification_level", "important_only")
            .unwrap();
        s.set_value("tray.click_behavior", "check_updates")
            .unwrap();

        assert!(!s.tray.minimize_to_tray);
        assert!(s.tray.start_minimized);
        assert!(!s.tray.show_notifications);
        assert_eq!(
            s.tray.notification_level,
            TrayNotificationLevel::ImportantOnly
        );
        assert_eq!(s.tray.click_behavior, TrayClickBehavior::CheckUpdates);
    }

    #[test]
    fn test_set_tray_menu_items_json() {
        let mut s = Settings::default();
        s.set_value(
            "tray.menu_items",
            r#"["show_hide","downloads","toggle_notifications","settings","quit"]"#,
        )
        .unwrap();
        assert_eq!(
            s.tray.menu_items,
            vec![
                TrayMenuItemId::ShowHide,
                TrayMenuItemId::Downloads,
                TrayMenuItemId::ToggleNotifications,
                TrayMenuItemId::Settings,
                TrayMenuItemId::Quit,
            ]
        );
    }

    #[test]
    fn test_set_tray_menu_items_keeps_quit() {
        let mut s = Settings::default();
        s.set_value("tray.menu_items", "show_hide,downloads")
            .unwrap();
        assert!(s.tray.menu_items.contains(&TrayMenuItemId::Quit));
    }

    #[test]
    fn test_set_tray_menu_items_ignores_unknown_and_dedupes() {
        let mut s = Settings::default();
        s.set_value(
            "tray.menu_items",
            r#"["show_hide","unknown","show_hide","quit"]"#,
        )
        .unwrap();
        assert_eq!(
            s.tray.menu_items,
            vec![TrayMenuItemId::ShowHide, TrayMenuItemId::Quit]
        );
    }

    #[test]
    fn test_set_invalid_updates_or_tray_values() {
        let mut s = Settings::default();
        assert!(s.set_value("updates.check_on_start", "yes").is_err());
        assert!(s.set_value("tray.click_behavior", "invalid").is_err());
        assert!(s
            .set_value("tray.notification_level", "sometimes")
            .is_err());
        // unknown items are ignored and default mandatory items are restored
        assert!(s.set_value("tray.menu_items", r#"["unknown"]"#).is_ok());
        assert_eq!(s.tray.menu_items, vec![TrayMenuItemId::Quit]);
    }

    // ===== PluginSettings =====

    #[test]
    fn test_default_plugin_settings() {
        let p = PluginSettings::default();
        assert!(p.auto_load_on_startup);
        assert_eq!(p.max_execution_timeout_secs, 30);
        assert!(p.sandbox_fs);
        assert_eq!(p.permission_enforcement_mode, "compat");
    }

    #[test]
    fn test_get_set_plugin_auto_load() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("plugin.auto_load_on_startup"),
            Some("true".into())
        );
        s.set_value("plugin.auto_load_on_startup", "false").unwrap();
        assert!(!s.plugin.auto_load_on_startup);
        assert_eq!(
            s.get_value("plugin.auto_load_on_startup"),
            Some("false".into())
        );
    }

    #[test]
    fn test_get_set_plugin_timeout() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("plugin.max_execution_timeout_secs"),
            Some("30".into())
        );
        s.set_value("plugin.max_execution_timeout_secs", "60")
            .unwrap();
        assert_eq!(s.plugin.max_execution_timeout_secs, 60);
    }

    #[test]
    fn test_get_set_plugin_sandbox() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("plugin.sandbox_fs"), Some("true".into()));
        s.set_value("plugin.sandbox_fs", "false").unwrap();
        assert!(!s.plugin.sandbox_fs);
    }

    #[test]
    fn test_set_plugin_invalid_values() {
        let mut s = Settings::default();
        assert!(s.set_value("plugin.auto_load_on_startup", "yes").is_err());
        assert!(s
            .set_value("plugin.max_execution_timeout_secs", "abc")
            .is_err());
        assert!(s.set_value("plugin.sandbox_fs", "maybe").is_err());
        assert!(s
            .set_value("plugin.permission_enforcement_mode", "invalid")
            .is_err());
    }

    #[test]
    fn test_get_set_plugin_permission_enforcement_mode() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("plugin.permission_enforcement_mode"),
            Some("compat".into())
        );
        s.set_value("plugin.permission_enforcement_mode", "strict")
            .unwrap();
        assert_eq!(s.plugin.permission_enforcement_mode, "strict");
    }

    #[test]
    fn test_plugin_settings_serialize_roundtrip() {
        let mut s = Settings::default();
        s.set_value("plugin.auto_load_on_startup", "false").unwrap();
        s.set_value("plugin.max_execution_timeout_secs", "120")
            .unwrap();
        s.set_value("plugin.sandbox_fs", "false").unwrap();
        s.set_value("plugin.permission_enforcement_mode", "strict")
            .unwrap();

        let toml_str = toml::to_string(&s).unwrap();
        let parsed: Settings = toml::from_str(&toml_str).unwrap();

        assert!(!parsed.plugin.auto_load_on_startup);
        assert_eq!(parsed.plugin.max_execution_timeout_secs, 120);
        assert!(!parsed.plugin.sandbox_fs);
        assert_eq!(parsed.plugin.permission_enforcement_mode, "strict");
    }

    // ===== ShortcutSettings defaults and get/set =====

    #[test]
    fn test_default_shortcut_settings() {
        let sc = ShortcutSettings::default();
        assert!(sc.enabled);
        assert_eq!(sc.toggle_window, "CmdOrCtrl+Shift+Space");
        assert_eq!(sc.command_palette, "CmdOrCtrl+Shift+K");
        assert_eq!(sc.quick_search, "CmdOrCtrl+Shift+F");
    }

    #[test]
    fn test_get_set_shortcuts_enabled() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("shortcuts.enabled"), Some("true".into()));
        s.set_value("shortcuts.enabled", "false").unwrap();
        assert!(!s.shortcuts.enabled);
        assert_eq!(s.get_value("shortcuts.enabled"), Some("false".into()));
    }

    #[test]
    fn test_set_shortcuts_enabled_invalid() {
        let mut s = Settings::default();
        assert!(s.set_value("shortcuts.enabled", "yes").is_err());
    }

    #[test]
    fn test_get_set_shortcuts_toggle_window() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("shortcuts.toggle_window"),
            Some("CmdOrCtrl+Shift+Space".into())
        );
        s.set_value("shortcuts.toggle_window", "Alt+Space").unwrap();
        assert_eq!(s.shortcuts.toggle_window, "Alt+Space");
        assert_eq!(
            s.get_value("shortcuts.toggle_window"),
            Some("Alt+Space".into())
        );
    }

    #[test]
    fn test_get_set_shortcuts_command_palette() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("shortcuts.command_palette"),
            Some("CmdOrCtrl+Shift+K".into())
        );
        s.set_value("shortcuts.command_palette", "CmdOrCtrl+Shift+P")
            .unwrap();
        assert_eq!(s.shortcuts.command_palette, "CmdOrCtrl+Shift+P");
    }

    #[test]
    fn test_get_set_shortcuts_quick_search() {
        let mut s = Settings::default();
        assert_eq!(
            s.get_value("shortcuts.quick_search"),
            Some("CmdOrCtrl+Shift+F".into())
        );
        s.set_value("shortcuts.quick_search", "CmdOrCtrl+Alt+S")
            .unwrap();
        assert_eq!(s.shortcuts.quick_search, "CmdOrCtrl+Alt+S");
    }

    #[test]
    fn test_shortcuts_serialize_roundtrip() {
        let mut s = Settings::default();
        s.set_value("shortcuts.enabled", "false").unwrap();
        s.set_value("shortcuts.toggle_window", "Alt+Space").unwrap();
        s.set_value("shortcuts.command_palette", "CmdOrCtrl+Shift+P")
            .unwrap();
        s.set_value("shortcuts.quick_search", "CmdOrCtrl+Alt+S")
            .unwrap();

        let toml_str = toml::to_string(&s).unwrap();
        let parsed: Settings = toml::from_str(&toml_str).unwrap();

        assert!(!parsed.shortcuts.enabled);
        assert_eq!(parsed.shortcuts.toggle_window, "Alt+Space");
        assert_eq!(parsed.shortcuts.command_palette, "CmdOrCtrl+Shift+P");
        assert_eq!(parsed.shortcuts.quick_search, "CmdOrCtrl+Alt+S");
    }

    #[test]
    fn test_shortcuts_empty_string_allowed() {
        let mut s = Settings::default();
        s.set_value("shortcuts.toggle_window", "").unwrap();
        assert_eq!(s.shortcuts.toggle_window, "");
        assert_eq!(s.get_value("shortcuts.toggle_window"), Some("".into()));
    }
}
