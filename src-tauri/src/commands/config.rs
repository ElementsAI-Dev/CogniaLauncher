use crate::config::Settings;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedSettings = Arc<RwLock<Settings>>;

#[tauri::command]
pub async fn config_get(
    key: String,
    settings: State<'_, SharedSettings>,
) -> Result<Option<String>, String> {
    let s = settings.read().await;
    Ok(s.get_value(&key))
}

#[tauri::command]
pub async fn config_set(
    key: String,
    value: String,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let mut s = settings.write().await;
    s.set_value(&key, &value).map_err(|e| e.to_string())?;
    s.save().await.map_err(|e| e.to_string())
}

/// Default mirror keys that are always included in config_list
const DEFAULT_MIRROR_KEYS: &[&str] = &[
    "mirrors.npm",
    "mirrors.pypi",
    "mirrors.crates",
    "mirrors.go",
];

#[tauri::command]
pub async fn config_list(
    settings: State<'_, SharedSettings>,
) -> Result<Vec<(String, String)>, String> {
    let s = settings.read().await;
    
    // Static configuration keys
    let static_keys = vec![
        "general.parallel_downloads",
        "general.resolve_strategy",
        "general.auto_update_metadata",
        "general.metadata_cache_ttl",
        "general.cache_max_size",
        "general.cache_max_age_days",
        "general.auto_clean_cache",
        "general.min_install_space_mb",
        "network.timeout",
        "network.retries",
        "network.proxy",
        "security.allow_http",
        "security.verify_certificates",
        "security.allow_self_signed",
        "appearance.theme",
        "appearance.accent_color",
        "appearance.language",
        "appearance.reduced_motion",
        "paths.root",
        "paths.cache",
        "paths.environments",
        "provider_settings.disabled_providers",
    ];

    let mut result: Vec<(String, String)> = static_keys
        .into_iter()
        .filter_map(|k| s.get_value(k).map(|v| (k.to_string(), v)))
        .collect();

    // Add default mirror keys (even if empty, frontend expects them)
    for key in DEFAULT_MIRROR_KEYS {
        let provider = key.split('.').nth(1).unwrap_or_default();
        let config = s.mirrors.get(provider).cloned().unwrap_or_default();
        result.push((key.to_string(), config.url));
        result.push((format!("{}.enabled", key), config.enabled.to_string()));
        result.push((format!("{}.priority", key), config.priority.to_string()));
        result.push((format!("{}.verify_ssl", key), config.verify_ssl.to_string()));
    }

    // Add any additional configured mirrors that aren't in defaults
    for (provider, config) in &s.mirrors {
        let key = format!("mirrors.{}", provider);
        if DEFAULT_MIRROR_KEYS.contains(&key.as_str()) || config.url.is_empty() {
            continue;
        }
        result.push((key.clone(), config.url.clone()));
        result.push((format!("{}.enabled", key), config.enabled.to_string()));
        result.push((format!("{}.priority", key), config.priority.to_string()));
        result.push((format!("{}.verify_ssl", key), config.verify_ssl.to_string()));
    }

    Ok(result)
}

#[tauri::command]
pub async fn config_reset(settings: State<'_, SharedSettings>) -> Result<(), String> {
    let mut s = settings.write().await;
    *s = Settings::default();
    s.save().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cognia_dir() -> Result<String, String> {
    crate::platform::fs::get_cognia_dir()
        .map(|p| p.display().to_string())
        .ok_or_else(|| "Could not determine CogniaLauncher directory".to_string())
}

#[tauri::command]
pub fn get_platform_info() -> Result<PlatformInfo, String> {
    Ok(PlatformInfo {
        os: crate::platform::env::current_platform()
            .as_str()
            .to_string(),
        arch: crate::platform::env::current_arch().as_str().to_string(),
    })
}

#[derive(serde::Serialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
}
