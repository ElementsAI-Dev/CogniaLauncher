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
        "general.cache_auto_clean_threshold",
        "general.cache_monitor_interval",
        "general.cache_monitor_external",
        "network.timeout",
        "network.retries",
        "network.proxy",
        "security.allow_http",
        "security.verify_certificates",
        "security.allow_self_signed",
        "appearance.theme",
        "appearance.accent_color",
        "appearance.chart_color_theme",
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
    use sysinfo::System;

    let os_name = crate::platform::env::current_platform()
        .as_str()
        .to_string();
    let arch = crate::platform::env::current_arch().as_str().to_string();

    let os_version = System::os_version().unwrap_or_default();
    let os_long_version = System::long_os_version().unwrap_or_default();
    let kernel_version = System::kernel_version().unwrap_or_default();
    let hostname = System::host_name().unwrap_or_default();

    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu_model = sys
        .cpus()
        .first()
        .map(|cpu| cpu.brand().to_string())
        .unwrap_or_default();
    let cpu_cores = sys.cpus().len() as u32;
    let total_memory = sys.total_memory();
    let available_memory = sys.available_memory();
    let uptime = System::uptime();

    Ok(PlatformInfo {
        os: os_name,
        arch,
        os_version,
        os_long_version,
        kernel_version,
        hostname,
        cpu_model,
        cpu_cores,
        total_memory,
        available_memory,
        uptime,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[derive(serde::Serialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
    pub os_version: String,
    pub os_long_version: String,
    pub kernel_version: String,
    pub hostname: String,
    pub cpu_model: String,
    pub cpu_cores: u32,
    pub total_memory: u64,
    pub available_memory: u64,
    pub uptime: u64,
    pub app_version: String,
}

#[derive(serde::Serialize)]
pub struct AppInitStatus {
    pub initialized: bool,
    pub version: String,
}

#[tauri::command]
pub fn app_check_init() -> AppInitStatus {
    AppInitStatus {
        initialized: crate::is_initialized(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}
