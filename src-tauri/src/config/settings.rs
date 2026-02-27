use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
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
    pub terminal: TerminalSettings,
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct GlobalProviderSettings {
    pub pinned_packages: HashMap<String, Option<String>>,
    pub disabled_providers: Vec<String>,
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
                if !["global", "none", "custom"].contains(&value) {
                    return Err(CogniaError::Config(
                        "Invalid proxy mode. Valid: global, none, custom".into(),
                    ));
                }
                self.terminal.proxy_mode = value.to_string();
            }
            ["terminal", "custom_proxy"] => {
                self.terminal.custom_proxy = if value.is_empty() {
                    None
                } else {
                    Some(value.to_string())
                };
            }
            ["terminal", "no_proxy"] => {
                self.terminal.no_proxy = if value.is_empty() {
                    None
                } else {
                    Some(value.to_string())
                };
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
            ("prefer-locked", ResolveStrategy::PreferLocked, "prefer-locked"),
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
        assert_eq!(s.get_value("general.auto_update_metadata"), Some("true".into()));
        s.set_value("general.auto_update_metadata", "false").unwrap();
        assert!(!s.general.auto_update_metadata);
        assert_eq!(s.get_value("general.auto_update_metadata"), Some("false".into()));
    }

    #[test]
    fn test_get_set_metadata_cache_ttl() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("general.metadata_cache_ttl"), Some("3600".into()));
        s.set_value("general.metadata_cache_ttl", "7200").unwrap();
        assert_eq!(s.general.metadata_cache_ttl, 7200);
    }

    #[test]
    fn test_get_set_cache_max_size() {
        let mut s = Settings::default();
        s.set_value("general.cache_max_size", "1073741824").unwrap();
        assert_eq!(s.general.cache_max_size, 1073741824);
        assert_eq!(s.get_value("general.cache_max_size"), Some("1073741824".into()));
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
        assert_eq!(s.get_value("general.min_install_space_mb"), Some("250".into()));
    }

    #[test]
    fn test_get_set_cache_auto_clean_threshold() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("general.cache_auto_clean_threshold"), Some("80".into()));
        s.set_value("general.cache_auto_clean_threshold", "90").unwrap();
        assert_eq!(s.general.cache_auto_clean_threshold, 90);
    }

    #[test]
    fn test_get_set_cache_monitor_interval() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("general.cache_monitor_interval"), Some("300".into()));
        s.set_value("general.cache_monitor_interval", "600").unwrap();
        assert_eq!(s.general.cache_monitor_interval, 600);
    }

    #[test]
    fn test_get_set_cache_monitor_external() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("general.cache_monitor_external"), Some("false".into()));
        s.set_value("general.cache_monitor_external", "true").unwrap();
        assert!(s.general.cache_monitor_external);
    }

    #[test]
    fn test_get_set_download_speed_limit() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("general.download_speed_limit"), Some("0".into()));
        s.set_value("general.download_speed_limit", "1048576").unwrap();
        assert_eq!(s.general.download_speed_limit, 1048576);
        assert!(s.set_value("general.download_speed_limit", "not_a_number").is_err());
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
        assert_eq!(s.get_value("network.proxy"), Some("http://proxy:8080".into()));
        s.set_value("network.proxy", "").unwrap();
        assert!(s.network.proxy.is_none());
    }

    #[test]
    fn test_get_set_network_no_proxy() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("network.no_proxy"), Some(String::new()));
        s.set_value("network.no_proxy", "localhost,127.0.0.1").unwrap();
        assert_eq!(s.get_value("network.no_proxy"), Some("localhost,127.0.0.1".into()));
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

        assert_eq!(s.get_value("security.verify_certificates"), Some("true".into()));
        s.set_value("security.verify_certificates", "false").unwrap();
        assert!(!s.security.verify_certificates);

        assert_eq!(s.get_value("security.allow_self_signed"), Some("false".into()));
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
        assert_eq!(s.get_value("appearance.chart_color_theme"), Some("default".into()));
        for valid in ["default", "vibrant", "pastel", "ocean", "sunset", "monochrome"] {
            s.set_value("appearance.chart_color_theme", valid).unwrap();
            assert_eq!(s.appearance.chart_color_theme, valid);
        }
    }

    #[test]
    fn test_get_set_appearance_interface_radius() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("appearance.interface_radius"), Some("0.625".into()));
        for valid in ["0", "0.3", "0.5", "0.625", "0.75", "1"] {
            s.set_value("appearance.interface_radius", valid).unwrap();
        }
        assert_eq!(s.appearance.interface_radius, 1.0);
    }

    #[test]
    fn test_get_set_appearance_interface_density() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("appearance.interface_density"), Some("comfortable".into()));
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
        assert_eq!(s.get_value("appearance.reduced_motion"), Some("false".into()));
        s.set_value("appearance.reduced_motion", "true").unwrap();
        assert!(s.appearance.reduced_motion);
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
        assert_eq!(s.get_value("terminal.default_profile_id"), Some(String::new()));
        s.set_value("terminal.default_profile_id", "my-profile").unwrap();
        assert_eq!(s.terminal.default_profile_id, Some("my-profile".to_string()));
        s.set_value("terminal.default_profile_id", "").unwrap();
        assert!(s.terminal.default_profile_id.is_none());
    }

    #[test]
    fn test_get_set_terminal_shell_integration() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("terminal.shell_integration"), Some("true".into()));
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
    fn test_get_set_terminal_custom_proxy() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("terminal.custom_proxy"), Some(String::new()));
        s.set_value("terminal.custom_proxy", "socks5://localhost:1080").unwrap();
        assert_eq!(s.terminal.custom_proxy, Some("socks5://localhost:1080".into()));
        s.set_value("terminal.custom_proxy", "").unwrap();
        assert!(s.terminal.custom_proxy.is_none());
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

    // ===== get_value / set_value: providers section =====

    #[test]
    fn test_get_set_provider_token() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("providers.github.token"), None);
        s.set_value("providers.github.token", "ghp_abc123").unwrap();
        assert_eq!(s.get_value("providers.github.token"), Some("ghp_abc123".into()));
        // Clear
        s.set_value("providers.github.token", "").unwrap();
        assert_eq!(s.get_value("providers.github.token"), None);
    }

    #[test]
    fn test_get_set_provider_url() {
        let mut s = Settings::default();
        assert_eq!(s.get_value("providers.gitlab.url"), None);
        s.set_value("providers.gitlab.url", "https://gitlab.example.com").unwrap();
        assert_eq!(s.get_value("providers.gitlab.url"), Some("https://gitlab.example.com".into()));
        s.set_value("providers.gitlab.url", "").unwrap();
        assert_eq!(s.get_value("providers.gitlab.url"), None);
    }

    // ===== get_value / set_value: disabled_providers =====

    #[test]
    fn test_set_disabled_providers_json_array() {
        let mut s = Settings::default();
        s.set_value("provider_settings.disabled_providers", r#"["snap","flatpak"]"#).unwrap();
        assert_eq!(s.provider_settings.disabled_providers, vec!["snap", "flatpak"]);
        // get_value returns JSON
        let val = s.get_value("provider_settings.disabled_providers").unwrap();
        assert!(val.contains("snap"));
    }

    #[test]
    fn test_set_disabled_providers_csv() {
        let mut s = Settings::default();
        s.set_value("provider_settings.disabled_providers", "snap, flatpak, docker").unwrap();
        assert_eq!(
            s.provider_settings.disabled_providers,
            vec!["snap", "flatpak", "docker"]
        );
    }

    #[test]
    fn test_set_disabled_providers_empty() {
        let mut s = Settings::default();
        s.set_value("provider_settings.disabled_providers", "snap").unwrap();
        assert_eq!(s.provider_settings.disabled_providers.len(), 1);
        s.set_value("provider_settings.disabled_providers", "").unwrap();
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
        assert!(s.set_value("appearance.chart_color_theme", "rainbow").is_err());
    }

    #[test]
    fn test_set_invalid_interface_radius() {
        let mut s = Settings::default();
        assert!(s.set_value("appearance.interface_radius", "0.9").is_err());
        assert!(s.set_value("appearance.interface_radius", "not_float").is_err());
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
        assert!(s.set_value("general.cache_auto_clean_threshold", "101").is_err());
        // Edge cases: 0 and 100 are valid
        s.set_value("general.cache_auto_clean_threshold", "0").unwrap();
        assert_eq!(s.general.cache_auto_clean_threshold, 0);
        s.set_value("general.cache_auto_clean_threshold", "100").unwrap();
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
        assert_eq!(s.get_environments_dir(), PathBuf::from("/my/root/environments"));
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

        s.set_value("mirrors.npm", "https://registry.npmmirror.com").unwrap();
        assert_eq!(s.get_value("mirrors.npm"), Some("https://registry.npmmirror.com".into()));

        s.set_value("mirrors.npm.enabled", "true").unwrap();
        assert_eq!(s.get_value("mirrors.npm.enabled"), Some("true".into()));

        s.set_value("mirrors.npm.priority", "10").unwrap();
        assert_eq!(s.get_value("mirrors.npm.priority"), Some("10".into()));

        assert_eq!(s.get_mirror_url("npm"), Some("https://registry.npmmirror.com".into()));

        s.set_value("mirrors.npm.enabled", "false").unwrap();
        assert_eq!(s.get_mirror_url("npm"), None);
    }

    #[test]
    fn test_mirror_verify_ssl_get_set() {
        let mut s = Settings::default();
        s.set_value("mirrors.npm", "https://registry.npmmirror.com").unwrap();
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

        s.set_value("mirrors.npm", "https://registry.npmmirror.com").unwrap();
        s.set_value("mirrors.npm.priority", "5").unwrap();

        s.set_value("mirrors.pypi", "https://pypi.tuna.tsinghua.edu.cn/simple").unwrap();
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
        s.set_value("mirrors.npm", "https://npm.example.com").unwrap();
        s.set_value("mirrors.npm.enabled", "false").unwrap();
        s.set_value("mirrors.pypi", "https://pypi.example.com").unwrap();

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
        s.set_value("mirrors.npm", "https://npm.example.com").unwrap();
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

        assert_eq!(settings.general.parallel_downloads, parsed.general.parallel_downloads);
        assert_eq!(settings.general.resolve_strategy, parsed.general.resolve_strategy);
        assert_eq!(settings.appearance.theme, parsed.appearance.theme);
        assert_eq!(settings.terminal.default_shell, parsed.terminal.default_shell);
        assert_eq!(settings.security.verify_certificates, parsed.security.verify_certificates);
    }

    #[test]
    fn test_serialize_deserialize_with_custom_values() {
        let mut s = Settings::default();
        s.set_value("general.parallel_downloads", "16").unwrap();
        s.set_value("general.resolve_strategy", "prefer-locked").unwrap();
        s.set_value("appearance.theme", "dark").unwrap();
        s.set_value("network.proxy", "http://proxy:8080").unwrap();
        s.set_value("mirrors.npm", "https://npm.example.com").unwrap();
        s.set_value("providers.github.token", "ghp_test").unwrap();

        let toml_str = toml::to_string(&s).unwrap();
        let parsed: Settings = toml::from_str(&toml_str).unwrap();

        assert_eq!(parsed.general.parallel_downloads, 16);
        assert_eq!(parsed.general.resolve_strategy, ResolveStrategy::PreferLocked);
        assert_eq!(parsed.appearance.theme, "dark");
        assert_eq!(parsed.network.proxy, Some("http://proxy:8080".into()));
        assert_eq!(parsed.mirrors.get("npm").unwrap().url, "https://npm.example.com");
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
}
