use super::types::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use crate::tray::{
    TrayClickBehavior, TrayMenuItemId, TrayNotificationEvent, TrayNotificationLevel,
    TrayQuickAction,
};
use reqwest::Url;
use std::path::PathBuf;

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
        let settings = Self::load_from_toml_with_tray_fallback(&content)?;

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

    fn prune_provider_entry_if_empty(&mut self, provider: &str) {
        let should_remove = self
            .providers
            .get(provider)
            .map(|settings| {
                settings.enabled.is_none()
                    && settings.priority.is_none()
                    && settings.extra.is_empty()
            })
            .unwrap_or(false);

        if should_remove {
            self.providers.remove(provider);
        }
    }

    pub fn get_provider_enabled_override(&self, provider: &str) -> Option<bool> {
        self.providers
            .get(provider)
            .and_then(|settings| settings.enabled)
    }

    pub fn get_provider_legacy_token(&self, provider: &str) -> Option<String> {
        self.providers
            .get(provider)
            .and_then(|settings| settings.extra.get("token"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
    }

    pub fn set_provider_legacy_token(&mut self, provider: &str, value: &str) -> CogniaResult<()> {
        let settings = self.providers.entry(provider.to_string()).or_default();
        if value.is_empty() {
            settings.extra.remove("token");
            self.prune_provider_entry_if_empty(provider);
        } else {
            settings
                .extra
                .insert("token".to_string(), toml::Value::String(value.to_string()));
        }

        Ok(())
    }

    pub fn clear_provider_legacy_token(&mut self, provider: &str) {
        if let Some(settings) = self.providers.get_mut(provider) {
            settings.extra.remove("token");
        }
        self.prune_provider_entry_if_empty(provider);
    }

    pub fn get_provider_secret_saved(&self, provider: &str) -> bool {
        self.providers
            .get(provider)
            .and_then(|settings| settings.extra.get("secret_saved"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false)
    }

    pub fn set_provider_secret_saved(&mut self, provider: &str, saved: bool) {
        if saved {
            self.providers
                .entry(provider.to_string())
                .or_default()
                .extra
                .insert("secret_saved".to_string(), toml::Value::Boolean(true));
        } else {
            if let Some(settings) = self.providers.get_mut(provider) {
                settings.extra.remove("secret_saved");
            }
            self.prune_provider_entry_if_empty(provider);
        }
    }

    pub fn get_provider_enabled_effective(&self, provider: &str) -> Option<bool> {
        self.get_provider_enabled_override(provider).or_else(|| {
            if self
                .provider_settings
                .disabled_providers
                .iter()
                .any(|disabled| disabled == provider)
            {
                Some(false)
            } else {
                None
            }
        })
    }

    pub fn set_provider_enabled_override(&mut self, provider: &str, enabled: Option<bool>) {
        match enabled {
            Some(value) => {
                let settings = self.providers.entry(provider.to_string()).or_default();
                settings.enabled = Some(value);

                self.provider_settings
                    .disabled_providers
                    .retain(|disabled| disabled != provider);
                if !value {
                    self.provider_settings
                        .disabled_providers
                        .push(provider.to_string());
                }
            }
            None => {
                if let Some(settings) = self.providers.get_mut(provider) {
                    settings.enabled = None;
                }
                self.prune_provider_entry_if_empty(provider);
            }
        }
    }

    pub fn get_provider_priority_override(&self, provider: &str) -> Option<i32> {
        self.providers
            .get(provider)
            .and_then(|settings| settings.priority)
    }

    pub fn set_provider_priority_override(&mut self, provider: &str, priority: Option<i32>) {
        match priority {
            Some(value) => {
                let settings = self.providers.entry(provider.to_string()).or_default();
                settings.priority = Some(value);
            }
            None => {
                if let Some(settings) = self.providers.get_mut(provider) {
                    settings.priority = None;
                }
                self.prune_provider_entry_if_empty(provider);
            }
        }
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

    pub(super) fn load_from_toml_with_tray_fallback(content: &str) -> CogniaResult<Self> {
        match toml::from_str(content) {
            Ok(settings) => Ok(settings),
            Err(parse_error) => {
                let mut raw: toml::Value = toml::from_str(content).map_err(|_| {
                    CogniaError::Parse(format!("Failed to parse config: {}", parse_error))
                })?;

                if !Self::sanitize_tray_fields(&mut raw) {
                    return Err(CogniaError::Parse(format!(
                        "Failed to parse config: {}",
                        parse_error
                    )));
                }

                raw.try_into().map_err(|retry_error| {
                    CogniaError::Parse(format!(
                        "Failed to parse config after tray fallback: {}",
                        retry_error
                    ))
                })
            }
        }
    }

    fn sanitize_tray_fields(raw: &mut toml::Value) -> bool {
        let Some(tray) = raw.get_mut("tray").and_then(|value| value.as_table_mut()) else {
            return false;
        };

        let mut changed = false;

        changed |= Self::sanitize_tray_string_field(tray, "click_behavior", |value| {
            matches!(
                value,
                "toggle_window" | "show_menu" | "check_updates" | "quick_action" | "do_nothing"
            )
        });

        changed |= Self::sanitize_tray_string_field(tray, "notification_level", |value| {
            matches!(value, "all" | "important_only" | "none")
        });

        changed |= Self::sanitize_tray_string_field(tray, "quick_action", |value| {
            Self::parse_tray_quick_action(value).is_ok()
        });

        changed |= Self::sanitize_tray_string_array_field(tray, "menu_items", |items| {
            let normalized = Self::normalize_tray_menu_item_strings(items);
            Some(normalized)
        });

        changed |= Self::sanitize_tray_string_array_field(tray, "menu_priority_items", |items| {
            let normalized = Self::normalize_tray_menu_priority_item_strings(items);
            Some(normalized)
        });

        changed |= Self::sanitize_tray_string_array_field(tray, "notification_events", |items| {
            let normalized = Self::normalize_tray_notification_event_strings(items);
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        });

        changed
    }

    fn sanitize_tray_string_field<F>(
        tray: &mut toml::map::Map<String, toml::Value>,
        key: &str,
        is_valid: F,
    ) -> bool
    where
        F: Fn(&str) -> bool,
    {
        let Some(value) = tray.get(key) else {
            return false;
        };

        match value.as_str() {
            Some(raw) if is_valid(raw) => false,
            _ => tray.remove(key).is_some(),
        }
    }

    fn sanitize_tray_string_array_field<F>(
        tray: &mut toml::map::Map<String, toml::Value>,
        key: &str,
        normalize: F,
    ) -> bool
    where
        F: Fn(&[String]) -> Option<Vec<String>>,
    {
        let Some(existing) = tray.get(key).cloned() else {
            return false;
        };

        let Some(array) = existing.as_array() else {
            return tray.remove(key).is_some();
        };

        let mut items = Vec::with_capacity(array.len());
        for value in array {
            let Some(raw) = value.as_str() else {
                return tray.remove(key).is_some();
            };
            items.push(raw.to_string());
        }

        let normalized = normalize(&items);
        match normalized {
            Some(normalized_items) => {
                if normalized_items == items {
                    false
                } else {
                    tray.insert(
                        key.to_string(),
                        toml::Value::Array(
                            normalized_items
                                .into_iter()
                                .map(toml::Value::String)
                                .collect(),
                        ),
                    );
                    true
                }
            }
            None => tray.remove(key).is_some(),
        }
    }

    fn normalize_tray_menu_item_strings(items: &[String]) -> Vec<String> {
        let mut normalized = Vec::new();

        for item in items {
            if Self::parse_tray_menu_item_str(item).is_some() && !normalized.contains(item) {
                normalized.push(item.clone());
            }
        }

        if !normalized.iter().any(|item| item == "quit") {
            normalized.push("quit".to_string());
        }

        normalized
    }

    fn normalize_tray_menu_priority_item_strings(items: &[String]) -> Vec<String> {
        let mut normalized = Vec::new();

        for item in items {
            if item == "quit" {
                continue;
            }

            if Self::parse_tray_menu_item_str(item).is_some() && !normalized.contains(item) {
                normalized.push(item.clone());
            }
        }

        normalized
    }

    fn normalize_tray_notification_event_strings(items: &[String]) -> Vec<String> {
        let mut normalized = Vec::new();

        for item in items {
            if matches!(item.as_str(), "updates" | "downloads" | "errors" | "system")
                && !normalized.contains(item)
            {
                normalized.push(item.clone());
            }
        }

        normalized
    }

    fn parse_tray_menu_item_str(item: &str) -> Option<TrayMenuItemId> {
        match item {
            "show_hide" => Some(TrayMenuItemId::ShowHide),
            "quick_nav" => Some(TrayMenuItemId::QuickNav),
            "downloads" => Some(TrayMenuItemId::Downloads),
            "settings" => Some(TrayMenuItemId::Settings),
            "check_updates" => Some(TrayMenuItemId::CheckUpdates),
            "toggle_notifications" => Some(TrayMenuItemId::ToggleNotifications),
            "open_logs" => Some(TrayMenuItemId::OpenLogs),
            "open_command_palette" => Some(TrayMenuItemId::OpenCommandPalette),
            "open_quick_search" => Some(TrayMenuItemId::OpenQuickSearch),
            "toggle_logs" => Some(TrayMenuItemId::ToggleLogs),
            "manage_plugins" => Some(TrayMenuItemId::ManagePlugins),
            "install_plugin" => Some(TrayMenuItemId::InstallPlugin),
            "create_plugin" => Some(TrayMenuItemId::CreatePlugin),
            "go_dashboard" => Some(TrayMenuItemId::GoDashboard),
            "go_toolbox" => Some(TrayMenuItemId::GoToolbox),
            "report_bug" => Some(TrayMenuItemId::ReportBug),
            "always_on_top" => Some(TrayMenuItemId::AlwaysOnTop),
            "autostart" => Some(TrayMenuItemId::Autostart),
            "quit" => Some(TrayMenuItemId::Quit),
            _ => None,
        }
    }

    fn parse_tray_menu_items(value: &str) -> CogniaResult<Vec<TrayMenuItemId>> {
        let mut items = if value.trim().starts_with('[') {
            let raw: Vec<String> = serde_json::from_str(value)
                .map_err(|_| CogniaError::Config("Invalid tray menu_items JSON array".into()))?;
            let mut parsed = Vec::with_capacity(raw.len());
            for item in raw {
                if let Some(parsed_item) = Self::parse_tray_menu_item_str(item.trim()) {
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
                    if let Some(parsed_item) = Self::parse_tray_menu_item_str(item) {
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

    fn parse_tray_menu_priority_items(value: &str) -> CogniaResult<Vec<TrayMenuItemId>> {
        let mut priority = Vec::new();
        for item in Self::parse_tray_menu_items(value)? {
            if item == TrayMenuItemId::Quit {
                continue;
            }
            if !priority.contains(&item) {
                priority.push(item);
            }
        }
        Ok(priority)
    }

    fn parse_tray_notification_events(value: &str) -> CogniaResult<Vec<TrayNotificationEvent>> {
        fn parse_item(item: &str) -> Option<TrayNotificationEvent> {
            match item {
                "updates" => Some(TrayNotificationEvent::Updates),
                "downloads" => Some(TrayNotificationEvent::Downloads),
                "errors" => Some(TrayNotificationEvent::Errors),
                "system" => Some(TrayNotificationEvent::System),
                _ => None,
            }
        }

        let mut events = if value.trim().starts_with('[') {
            let raw: Vec<String> = serde_json::from_str(value).map_err(|_| {
                CogniaError::Config("Invalid tray notification_events JSON array".into())
            })?;
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

        let mut deduped = Vec::with_capacity(events.len());
        for event in events {
            if !deduped.contains(&event) {
                deduped.push(event);
            }
        }
        events = deduped;

        if events.is_empty() {
            return Ok(TrayNotificationEvent::defaults());
        }

        Ok(events)
    }

    fn parse_tray_quick_action(value: &str) -> CogniaResult<TrayQuickAction> {
        match value {
            "open_settings" => Ok(TrayQuickAction::OpenSettings),
            "open_downloads" => Ok(TrayQuickAction::OpenDownloads),
            "check_updates" => Ok(TrayQuickAction::CheckUpdates),
            "open_logs" => Ok(TrayQuickAction::OpenLogs),
            "open_command_palette" => Ok(TrayQuickAction::OpenCommandPalette),
            "open_quick_search" => Ok(TrayQuickAction::OpenQuickSearch),
            "toggle_logs" => Ok(TrayQuickAction::ToggleLogs),
            "manage_plugins" => Ok(TrayQuickAction::ManagePlugins),
            "install_plugin" => Ok(TrayQuickAction::InstallPlugin),
            "create_plugin" => Ok(TrayQuickAction::CreatePlugin),
            "go_dashboard" => Ok(TrayQuickAction::GoDashboard),
            "go_toolbox" => Ok(TrayQuickAction::GoToolbox),
            "report_bug" => Ok(TrayQuickAction::ReportBug),
            _ => Err(CogniaError::Config(
                "Invalid tray quick_action value".into(),
            )),
        }
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

    fn parse_update_source_mode(value: &str) -> CogniaResult<UpdateSourceMode> {
        match value.trim().to_lowercase().as_str() {
            "official" => Ok(UpdateSourceMode::Official),
            "mirror" => Ok(UpdateSourceMode::Mirror),
            "custom" => Ok(UpdateSourceMode::Custom),
            _ => Err(CogniaError::Config(
                "Invalid updates source_mode value. Valid: official, mirror, custom".into(),
            )),
        }
    }

    fn validate_update_endpoint_template(endpoint: &str) -> CogniaResult<String> {
        let trimmed = endpoint.trim();
        if trimmed.is_empty() {
            return Err(CogniaError::Config(
                "Update endpoint must not be empty".into(),
            ));
        }

        // Allow updater templates while still validating URL structure.
        let normalized = trimmed
            .replace("{{current_version}}", "0.0.0")
            .replace("{{target}}", "windows-x86_64")
            .replace("{{arch}}", "x86_64")
            .replace("{{bundle_type}}", "nsis");
        let parsed = Url::parse(&normalized).map_err(|e| {
            CogniaError::Config(format!("Invalid update endpoint '{}': {}", trimmed, e))
        })?;

        if parsed.scheme() != "https" {
            return Err(CogniaError::Config(
                "Update endpoint must use https://".into(),
            ));
        }

        Ok(trimmed.to_string())
    }

    fn parse_update_custom_endpoints(value: &str) -> CogniaResult<Vec<String>> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }

        let raw_endpoints: Vec<String> = if trimmed.starts_with('[') {
            serde_json::from_str(trimmed).map_err(|_| {
                CogniaError::Config("Invalid JSON array for updates.custom_endpoints".into())
            })?
        } else {
            trimmed
                .replace('\r', "")
                .replace('\n', ",")
                .split(',')
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect()
        };

        let mut validated = Vec::with_capacity(raw_endpoints.len());
        for endpoint in raw_endpoints {
            let normalized = Self::validate_update_endpoint_template(&endpoint)?;
            if !validated.contains(&normalized) {
                validated.push(normalized);
            }
        }

        Ok(validated)
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
            ["general", "package_download_threshold_mb"] => {
                Some(self.general.package_download_threshold_mb.to_string())
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
            ["updates", "source_mode"] => Some(
                match self.updates.source_mode {
                    UpdateSourceMode::Official => "official",
                    UpdateSourceMode::Mirror => "mirror",
                    UpdateSourceMode::Custom => "custom",
                }
                .to_string(),
            ),
            ["updates", "custom_endpoints"] => Some(
                serde_json::to_string(&self.updates.custom_endpoints)
                    .unwrap_or_else(|_| "[]".into()),
            ),
            ["updates", "fallback_to_official"] => {
                Some(self.updates.fallback_to_official.to_string())
            }
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
                    TrayClickBehavior::QuickAction => "quick_action",
                    TrayClickBehavior::DoNothing => "do_nothing",
                }
                .to_string(),
            ),
            ["tray", "quick_action"] => Some(
                match self.tray.quick_action {
                    TrayQuickAction::OpenSettings => "open_settings",
                    TrayQuickAction::OpenDownloads => "open_downloads",
                    TrayQuickAction::CheckUpdates => "check_updates",
                    TrayQuickAction::OpenLogs => "open_logs",
                    TrayQuickAction::OpenCommandPalette => "open_command_palette",
                    TrayQuickAction::OpenQuickSearch => "open_quick_search",
                    TrayQuickAction::ToggleLogs => "toggle_logs",
                    TrayQuickAction::ManagePlugins => "manage_plugins",
                    TrayQuickAction::InstallPlugin => "install_plugin",
                    TrayQuickAction::CreatePlugin => "create_plugin",
                    TrayQuickAction::GoDashboard => "go_dashboard",
                    TrayQuickAction::GoToolbox => "go_toolbox",
                    TrayQuickAction::ReportBug => "report_bug",
                }
                .to_string(),
            ),
            ["tray", "notification_events"] => Some(
                serde_json::to_string(&self.tray.notification_events)
                    .unwrap_or_else(|_| "[]".into()),
            ),
            ["tray", "menu_items"] => {
                Some(serde_json::to_string(&self.tray.menu_items).unwrap_or_else(|_| "[]".into()))
            }
            ["envvar", "default_scope"] => Some(self.envvar.default_scope.clone()),
            ["envvar", "auto_snapshot"] => Some(self.envvar.auto_snapshot.to_string()),
            ["envvar", "mask_sensitive"] => Some(self.envvar.mask_sensitive.to_string()),
            ["tray", "menu_priority_items"] => Some(
                serde_json::to_string(&self.tray.menu_priority_items)
                    .unwrap_or_else(|_| "[]".into()),
            ),
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
            ["providers", _provider, "token"] => None,
            ["providers", provider, "url"] => self
                .providers
                .get(*provider)
                .and_then(|ps| ps.extra.get("url"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            ["providers", provider, "enabled"] => self
                .get_provider_enabled_effective(provider)
                .map(|enabled| enabled.to_string()),
            ["providers", provider, "priority"] => self
                .get_provider_priority_override(provider)
                .map(|priority| priority.to_string()),
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
            ["general", "package_download_threshold_mb"] => {
                self.general.package_download_threshold_mb = value.parse().map_err(|_| {
                    CogniaError::Config("Invalid value for package_download_threshold_mb".into())
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
            ["updates", "source_mode"] => {
                self.updates.source_mode = Self::parse_update_source_mode(value)?;
            }
            ["updates", "custom_endpoints"] => {
                self.updates.custom_endpoints = Self::parse_update_custom_endpoints(value)?;
            }
            ["updates", "fallback_to_official"] => {
                self.updates.fallback_to_official = value
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
                    "quick_action" => TrayClickBehavior::QuickAction,
                    "do_nothing" => TrayClickBehavior::DoNothing,
                    _ => {
                        return Err(CogniaError::Config(
                            "Invalid tray click behavior value".into(),
                        ))
                    }
                };
            }
            ["tray", "quick_action"] => {
                self.tray.quick_action = Self::parse_tray_quick_action(value)?;
            }
            ["tray", "notification_events"] => {
                self.tray.notification_events = Self::parse_tray_notification_events(value)?;
            }
            ["tray", "menu_items"] => {
                self.tray.menu_items = Self::parse_tray_menu_items(value)?;
            }
            ["tray", "menu_priority_items"] => {
                self.tray.menu_priority_items = Self::parse_tray_menu_priority_items(value)?;
            }
            ["envvar", "default_scope"] => {
                if !["all", "process", "user", "system"].contains(&value) {
                    return Err(CogniaError::Config(
                        "Invalid envvar default scope value".into(),
                    ));
                }
                self.envvar.default_scope = value.to_string();
            }
            ["envvar", "auto_snapshot"] => {
                self.envvar.auto_snapshot = value
                    .parse()
                    .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
            }
            ["envvar", "mask_sensitive"] => {
                self.envvar.mask_sensitive = value
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
            ["providers", _provider, "token"] => {
                return Err(CogniaError::Config(
                    "Provider tokens must be managed via secure secret storage".into(),
                ));
            }
            ["providers", provider, "url"] => {
                let ps = self.providers.entry(provider.to_string()).or_default();
                if value.is_empty() {
                    ps.extra.remove("url");
                    self.prune_provider_entry_if_empty(provider);
                } else {
                    ps.extra
                        .insert("url".to_string(), toml::Value::String(value.to_string()));
                }
            }
            ["providers", provider, "enabled"] => {
                if value.trim().is_empty() {
                    self.set_provider_enabled_override(provider, None);
                } else {
                    let enabled = value
                        .parse()
                        .map_err(|_| CogniaError::Config("Invalid boolean value".into()))?;
                    self.set_provider_enabled_override(provider, Some(enabled));
                }
            }
            ["providers", provider, "priority"] => {
                if value.trim().is_empty() {
                    self.set_provider_priority_override(provider, None);
                } else {
                    let priority = value
                        .parse()
                        .map_err(|_| CogniaError::Config("Invalid priority value".into()))?;
                    self.set_provider_priority_override(provider, Some(priority));
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
