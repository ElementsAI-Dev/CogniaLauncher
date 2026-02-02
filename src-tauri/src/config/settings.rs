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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppearanceSettings {
    pub theme: String,
    pub accent_color: String,
    pub language: String,
    pub reduced_motion: bool,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            accent_color: "blue".into(),
            language: "en".into(),
            reduced_motion: false,
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
}

impl Default for NetworkSettings {
    fn default() -> Self {
        Self {
            timeout: 30,
            retries: 3,
            proxy: None,
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
            ["general", "resolve_strategy"] => {
                Some(format!("{:?}", self.general.resolve_strategy).to_lowercase())
            }
            ["general", "auto_update_metadata"] => {
                Some(self.general.auto_update_metadata.to_string())
            }
            ["general", "metadata_cache_ttl"] => Some(self.general.metadata_cache_ttl.to_string()),
            ["network", "timeout"] => Some(self.network.timeout.to_string()),
            ["network", "retries"] => Some(self.network.retries.to_string()),
            ["network", "proxy"] => self.network.proxy.clone(),
            ["security", "allow_http"] => Some(self.security.allow_http.to_string()),
            ["security", "verify_certificates"] => {
                Some(self.security.verify_certificates.to_string())
            }
            ["appearance", "theme"] => Some(self.appearance.theme.clone()),
            ["appearance", "accent_color"] => Some(self.appearance.accent_color.clone()),
            ["appearance", "language"] => Some(self.appearance.language.clone()),
            ["appearance", "reduced_motion"] => Some(self.appearance.reduced_motion.to_string()),
            ["mirrors", provider] => {
                self.mirrors.get(*provider).map(|m| m.url.clone())
            }
            ["mirrors", provider, "enabled"] => {
                self.mirrors.get(*provider).map(|m| m.enabled.to_string())
            }
            ["mirrors", provider, "priority"] => {
                self.mirrors.get(*provider).map(|m| m.priority.to_string())
            }
            ["mirrors", provider, "verify_ssl"] => {
                self.mirrors.get(*provider).map(|m| m.verify_ssl.to_string())
            }
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
            ["mirrors", provider] => {
                let config = self.mirrors.entry(provider.to_string()).or_default();
                config.url = value.to_string();
            }
            ["mirrors", provider, "enabled"] => {
                let config = self.mirrors.entry(provider.to_string()).or_default();
                config.enabled = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value for mirror enabled".into()))?;
            }
            ["mirrors", provider, "priority"] => {
                let config = self.mirrors.entry(provider.to_string()).or_default();
                config.priority = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid priority value".into()))?;
            }
            ["mirrors", provider, "verify_ssl"] => {
                let config = self.mirrors.entry(provider.to_string()).or_default();
                config.verify_ssl = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value for verify_ssl".into()))?;
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

    #[test]
    fn test_default_settings() {
        let settings = Settings::default();
        assert_eq!(settings.general.parallel_downloads, 4);
        assert_eq!(settings.general.resolve_strategy, ResolveStrategy::Latest);
    }

    #[test]
    fn test_get_set_value() {
        let mut settings = Settings::default();

        settings
            .set_value("general.parallel_downloads", "8")
            .unwrap();
        assert_eq!(
            settings.get_value("general.parallel_downloads"),
            Some("8".to_string())
        );

        settings
            .set_value("general.resolve_strategy", "minimal")
            .unwrap();
        assert_eq!(settings.general.resolve_strategy, ResolveStrategy::Minimal);
    }

    #[test]
    fn test_serialize_deserialize() {
        let settings = Settings::default();
        let toml_str = toml::to_string(&settings).unwrap();
        let parsed: Settings = toml::from_str(&toml_str).unwrap();

        assert_eq!(
            settings.general.parallel_downloads,
            parsed.general.parallel_downloads
        );
    }

    #[test]
    fn test_mirror_get_set() {
        let mut settings = Settings::default();

        // Set mirror URL
        settings
            .set_value("mirrors.npm", "https://registry.npmmirror.com")
            .unwrap();
        assert_eq!(
            settings.get_value("mirrors.npm"),
            Some("https://registry.npmmirror.com".to_string())
        );

        // Set mirror enabled
        settings.set_value("mirrors.npm.enabled", "true").unwrap();
        assert_eq!(
            settings.get_value("mirrors.npm.enabled"),
            Some("true".to_string())
        );

        // Set mirror priority
        settings.set_value("mirrors.npm.priority", "10").unwrap();
        assert_eq!(
            settings.get_value("mirrors.npm.priority"),
            Some("10".to_string())
        );

        // Test get_mirror_url helper
        assert_eq!(
            settings.get_mirror_url("npm"),
            Some("https://registry.npmmirror.com".to_string())
        );

        // Disable mirror and check get_mirror_url returns None
        settings.set_value("mirrors.npm.enabled", "false").unwrap();
        assert_eq!(settings.get_mirror_url("npm"), None);
    }

    #[test]
    fn test_mirror_config_builder() {
        let config = MirrorConfig::new("https://pypi.tuna.tsinghua.edu.cn/simple")
            .with_priority(5);
        assert_eq!(config.url, "https://pypi.tuna.tsinghua.edu.cn/simple");
        assert_eq!(config.priority, 5);
        assert!(config.enabled);
        assert!(config.verify_ssl);

        let disabled = MirrorConfig::new("https://example.com").disabled();
        assert!(!disabled.enabled);
    }

    #[test]
    fn test_get_enabled_mirrors() {
        let mut settings = Settings::default();

        settings
            .set_value("mirrors.npm", "https://registry.npmmirror.com")
            .unwrap();
        settings.set_value("mirrors.npm.priority", "5").unwrap();

        settings
            .set_value("mirrors.pypi", "https://pypi.tuna.tsinghua.edu.cn/simple")
            .unwrap();
        settings.set_value("mirrors.pypi.priority", "10").unwrap();

        let enabled = settings.get_enabled_mirrors();
        assert_eq!(enabled.len(), 2);
        // Higher priority first
        assert_eq!(enabled[0].0, "pypi");
        assert_eq!(enabled[1].0, "npm");
    }
}
