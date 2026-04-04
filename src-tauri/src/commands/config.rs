use crate::commands::package::{invalidate_package_caches, refresh_provider_registry};
use crate::config::Settings;
use crate::core::system_info::BatteryInfo;
use crate::platform::disk::format_size;
use crate::SharedRegistry;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedSettings = Arc<RwLock<Settings>>;

fn refresh_network_clients(settings: &Settings) {
    crate::platform::proxy::rebuild_shared_client(settings);
    crate::provider::api::update_api_client_from_settings(settings);
}

fn should_refresh_network_clients_for_key(key: &str) -> bool {
    key.starts_with("network.") || key.starts_with("security.") || key.starts_with("mirrors.")
}

fn is_provider_config_key(key: &str) -> bool {
    key.starts_with("provider_settings.") || key.starts_with("providers.")
}

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
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let mut s = settings.write().await;
    s.set_value(&key, &value).map_err(|e| e.to_string())?;
    s.save().await.map_err(|e| e.to_string())?;

    if should_refresh_network_clients_for_key(&key) {
        refresh_network_clients(&s);
    }

    drop(s);

    if is_provider_config_key(&key) {
        refresh_provider_registry(settings.inner(), registry.inner()).await?;
        invalidate_package_caches(settings.inner()).await;
    }

    Ok(())
}

/// Default mirror keys that are always included in config_list
const DEFAULT_MIRROR_KEYS: &[&str] = &[
    "mirrors.npm",
    "mirrors.pypi",
    "mirrors.crates",
    "mirrors.go",
];

/// Static configuration keys included in config_list output.
const CONFIG_LIST_STATIC_KEYS: &[&str] = &[
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
    "general.download_speed_limit",
    "general.update_check_concurrency",
    "general.external_cache_excluded_providers",
    "general.custom_cache_entries",
    "network.timeout",
    "network.retries",
    "network.proxy",
    "network.no_proxy",
    "security.allow_http",
    "security.verify_certificates",
    "security.allow_self_signed",
    "appearance.theme",
    "appearance.accent_color",
    "appearance.chart_color_theme",
    "appearance.interface_radius",
    "appearance.interface_density",
    "appearance.language",
    "appearance.reduced_motion",
    "appearance.window_effect",
    "updates.check_on_start",
    "updates.auto_install",
    "updates.notify",
    "updates.source_mode",
    "updates.custom_endpoints",
    "updates.fallback_to_official",
    "tray.minimize_to_tray",
    "tray.start_minimized",
    "tray.show_notifications",
    "tray.notification_level",
    "tray.click_behavior",
    "tray.quick_action",
    "tray.notification_events",
    "tray.menu_items",
    "tray.menu_priority_items",
    "envvar.default_scope",
    "envvar.auto_snapshot",
    "envvar.mask_sensitive",
    "paths.root",
    "paths.cache",
    "paths.environments",
    "provider_settings.disabled_providers",
    "terminal.default_shell",
    "terminal.default_profile_id",
    "terminal.shell_integration",
    "terminal.proxy_mode",
    "terminal.custom_proxy",
    "terminal.no_proxy",
    "backup.auto_backup_enabled",
    "backup.auto_backup_interval_hours",
    "backup.max_backups",
    "backup.retention_days",
    "startup.scan_environments",
    "startup.scan_packages",
    "startup.max_concurrent_scans",
    "startup.startup_timeout_secs",
    "startup.integrity_check",
    "shortcuts.enabled",
    "shortcuts.toggle_window",
    "shortcuts.command_palette",
    "shortcuts.quick_search",
];

pub fn collect_config_list(settings: &Settings) -> Vec<(String, String)> {
    let mut result: Vec<(String, String)> = CONFIG_LIST_STATIC_KEYS
        .iter()
        .filter_map(|k| settings.get_value(k).map(|v| (k.to_string(), v)))
        .collect();

    // Add default mirror keys (even if empty, frontend expects them)
    for key in DEFAULT_MIRROR_KEYS {
        let provider = key.split('.').nth(1).unwrap_or_default();
        let config = settings.mirrors.get(provider).cloned().unwrap_or_default();
        result.push((key.to_string(), config.url));
        result.push((format!("{}.enabled", key), config.enabled.to_string()));
        result.push((format!("{}.priority", key), config.priority.to_string()));
        result.push((format!("{}.verify_ssl", key), config.verify_ssl.to_string()));
    }

    // Add provider URLs (GitLab etc.)
    for provider_name in &["github", "gitlab"] {
        if let Some(ps) = settings.providers.get(*provider_name) {
            if let Some(url) = ps.extra.get("url").and_then(|v| v.as_str()) {
                if !url.is_empty() {
                    result.push((format!("providers.{}.url", provider_name), url.to_string()));
                }
            }
        }
    }

    for (provider_name, provider_settings) in &settings.providers {
        if let Some(enabled) = provider_settings.enabled {
            result.push((
                format!("providers.{}.enabled", provider_name),
                enabled.to_string(),
            ));
        }

        if let Some(priority) = provider_settings.priority {
            result.push((
                format!("providers.{}.priority", provider_name),
                priority.to_string(),
            ));
        }
    }

    for provider_name in &settings.provider_settings.disabled_providers {
        let enabled_key = format!("providers.{}.enabled", provider_name);
        if !result.iter().any(|(key, _)| key == &enabled_key) {
            result.push((enabled_key, "false".to_string()));
        }
    }

    // Add any additional configured mirrors that aren't in defaults
    for (provider, config) in &settings.mirrors {
        let key = format!("mirrors.{}", provider);
        if DEFAULT_MIRROR_KEYS.contains(&key.as_str()) || config.url.is_empty() {
            continue;
        }
        result.push((key.clone(), config.url.clone()));
        result.push((format!("{}.enabled", key), config.enabled.to_string()));
        result.push((format!("{}.priority", key), config.priority.to_string()));
        result.push((format!("{}.verify_ssl", key), config.verify_ssl.to_string()));
    }

    result
}

#[tauri::command]
pub async fn config_list(
    settings: State<'_, SharedSettings>,
) -> Result<Vec<(String, String)>, String> {
    let s = settings.read().await;
    Ok(collect_config_list(&s))
}

#[tauri::command]
pub fn config_list_defaults() -> Result<Vec<(String, String)>, String> {
    Ok(collect_config_list(&Settings::default()))
}

#[tauri::command]
pub async fn config_reset(settings: State<'_, SharedSettings>) -> Result<(), String> {
    let mut s = settings.write().await;
    *s = Settings::default();
    s.save().await.map_err(|e| e.to_string())?;
    refresh_network_clients(&s);
    Ok(())
}

#[tauri::command]
pub fn get_cognia_dir() -> Result<String, String> {
    crate::platform::fs::get_cognia_dir()
        .map(|p| p.display().to_string())
        .ok_or_else(|| "Could not determine CogniaLauncher directory".to_string())
}

#[tauri::command]
pub async fn get_platform_info() -> Result<PlatformInfo, String> {
    Ok(crate::core::system_info::collect_platform_info(false)
        .await
        .into())
}

#[cfg(test)]
mod tests {
    use super::config_list_defaults;
    use super::should_refresh_network_clients_for_key;
    use super::PlatformInfo;
    use super::CONFIG_LIST_STATIC_KEYS;

    #[test]
    fn network_client_refresh_key_filter_covers_proxy_security_and_mirrors() {
        assert!(should_refresh_network_clients_for_key("network.proxy"));
        assert!(should_refresh_network_clients_for_key("network.no_proxy"));
        assert!(should_refresh_network_clients_for_key(
            "security.allow_self_signed"
        ));
        assert!(should_refresh_network_clients_for_key("mirrors.npm"));
        assert!(should_refresh_network_clients_for_key("mirrors.crates"));
    }

    #[test]
    fn network_client_refresh_key_filter_ignores_unrelated_keys() {
        assert!(!should_refresh_network_clients_for_key("appearance.theme"));
        assert!(!should_refresh_network_clients_for_key(
            "terminal.proxy_mode"
        ));
        assert!(!should_refresh_network_clients_for_key(
            "general.parallel_downloads"
        ));
    }

    #[test]
    fn config_list_static_keys_include_terminal_proxy_settings() {
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"terminal.proxy_mode"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"terminal.custom_proxy"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"terminal.no_proxy"));
    }

    #[test]
    fn config_list_static_keys_include_network_no_proxy() {
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"network.proxy"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"network.no_proxy"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"network.timeout"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"network.retries"));
    }

    #[test]
    fn config_list_static_keys_include_updates_and_tray_settings() {
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"updates.check_on_start"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"updates.auto_install"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"updates.notify"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"updates.source_mode"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"updates.custom_endpoints"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"updates.fallback_to_official"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.minimize_to_tray"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.start_minimized"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.show_notifications"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.notification_level"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.click_behavior"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.quick_action"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.notification_events"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.menu_items"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"tray.menu_priority_items"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"envvar.default_scope"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"envvar.auto_snapshot"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"envvar.mask_sensitive"));
    }

    #[test]
    fn config_list_static_keys_include_appearance_window_effect() {
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"appearance.window_effect"));
    }

    #[test]
    fn config_list_static_keys_include_shortcuts_settings() {
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"shortcuts.enabled"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"shortcuts.toggle_window"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"shortcuts.command_palette"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"shortcuts.quick_search"));
    }

    #[test]
    fn config_list_defaults_includes_shortcut_defaults() {
        let defaults = config_list_defaults().unwrap();
        let map: std::collections::HashMap<_, _> = defaults.into_iter().collect();

        assert_eq!(
            map.get("shortcuts.enabled")
                .map(std::string::String::as_str),
            Some("true")
        );
        assert_eq!(
            map.get("shortcuts.toggle_window")
                .map(std::string::String::as_str),
            Some("CmdOrCtrl+Shift+Space")
        );
        assert_eq!(
            map.get("shortcuts.command_palette")
                .map(std::string::String::as_str),
            Some("CmdOrCtrl+Shift+K")
        );
        assert_eq!(
            map.get("shortcuts.quick_search")
                .map(std::string::String::as_str),
            Some("CmdOrCtrl+Shift+F")
        );
    }

    #[test]
    fn collect_config_list_returns_nonempty_for_defaults() {
        use super::collect_config_list;
        let settings = crate::config::Settings::default();
        let entries = collect_config_list(&settings);
        assert!(
            !entries.is_empty(),
            "collect_config_list should return entries"
        );
        let keys: Vec<&str> = entries.iter().map(|(k, _)| k.as_str()).collect();
        assert!(
            keys.contains(&"appearance.theme"),
            "Should contain appearance.theme"
        );
        assert!(
            keys.contains(&"general.parallel_downloads"),
            "Should contain general.parallel_downloads"
        );
    }

    #[test]
    fn collect_config_list_includes_mirror_keys() {
        use super::collect_config_list;
        let settings = crate::config::Settings::default();
        let entries = collect_config_list(&settings);
        let keys: Vec<&str> = entries.iter().map(|(k, _)| k.as_str()).collect();
        assert!(keys.contains(&"mirrors.npm"), "Should contain mirrors.npm");
        assert!(
            keys.contains(&"mirrors.pypi"),
            "Should contain mirrors.pypi"
        );
    }

    #[test]
    fn collect_config_list_omits_provider_token_entries() {
        use super::collect_config_list;

        let mut settings = crate::config::Settings::default();
        settings
            .set_provider_legacy_token("github", "ghp_legacy_secret")
            .unwrap();
        settings
            .set_value("providers.gitlab.url", "https://gitlab.example.com")
            .unwrap();

        let entries = collect_config_list(&settings);
        let map: std::collections::HashMap<_, _> = entries.into_iter().collect();

        assert!(!map.contains_key("providers.github.token"));
        assert_eq!(
            map.get("providers.gitlab.url")
                .map(std::string::String::as_str),
            Some("https://gitlab.example.com")
        );
    }

    #[test]
    fn config_list_defaults_returns_known_default_keys() {
        let defaults = config_list_defaults().unwrap();
        let map: std::collections::HashMap<_, _> = defaults.into_iter().collect();

        assert_eq!(
            map.get("updates.check_on_start")
                .map(std::string::String::as_str),
            Some("true")
        );
        assert_eq!(
            map.get("tray.click_behavior")
                .map(std::string::String::as_str),
            Some("toggle_window")
        );
    }

    #[test]
    fn platform_info_from_core_snapshot_preserves_fields() {
        let core = crate::core::system_info::PlatformInfo {
            os: "windows".to_string(),
            arch: "x86_64".to_string(),
            os_version: "11".to_string(),
            os_long_version: "Windows 11".to_string(),
            kernel_version: "10.0".to_string(),
            hostname: "devbox".to_string(),
            os_name: "Windows".to_string(),
            distribution_id: "windows".to_string(),
            cpu_arch: "x86_64".to_string(),
            cpu_model: "CPU".to_string(),
            cpu_vendor_id: "GenuineIntel".to_string(),
            cpu_frequency: 3200,
            cpu_cores: 16,
            physical_core_count: Some(8),
            global_cpu_usage: 12.5,
            total_memory: 64,
            available_memory: 32,
            used_memory: 32,
            total_swap: 8,
            used_swap: 1,
            uptime: 120,
            boot_time: 42,
            load_average: [0.1, 0.2, 0.3],
            gpus: vec![crate::core::system_info::GpuInfo {
                name: "GPU".to_string(),
                vram_mb: Some(8192),
                driver_version: Some("1.0".to_string()),
                vendor: Some("Vendor".to_string()),
            }],
            app_version: "0.1.0".to_string(),
        };

        let platform = PlatformInfo::from(core);
        assert_eq!(platform.os, "windows");
        assert_eq!(platform.cpu_model, "CPU");
        assert_eq!(platform.physical_core_count, Some(8));
        assert_eq!(platform.gpus.len(), 1);
        assert_eq!(platform.app_version, "0.1.0");
    }

    #[test]
    fn app_check_init_reports_structured_startup_defaults() {
        crate::reset_startup_status();
        let status = super::app_check_init();
        let json = serde_json::to_value(&status).unwrap();

        assert_eq!(json["initialized"], false);
        assert_eq!(json["interactive"], false);
        assert_eq!(json["degraded"], false);
        assert_eq!(json["phase"], "checking");
        assert_eq!(json["progress"], 0);
        assert_eq!(json["message"], "splash.starting");
        assert_eq!(json["startupTimeoutMs"], 30_000);
        assert_eq!(json["timedOutPhases"], serde_json::json!([]));
        assert_eq!(json["skippedPhases"], serde_json::json!([]));
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub vram_mb: Option<u64>,
    pub driver_version: Option<String>,
    pub vendor: Option<String>,
}

impl From<crate::core::system_info::GpuInfo> for GpuInfo {
    fn from(value: crate::core::system_info::GpuInfo) -> Self {
        Self {
            name: value.name,
            vram_mb: value.vram_mb,
            driver_version: value.driver_version,
            vendor: value.vendor,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
    pub os_version: String,
    pub os_long_version: String,
    pub kernel_version: String,
    pub hostname: String,
    pub os_name: String,
    pub distribution_id: String,
    pub cpu_arch: String,
    pub cpu_model: String,
    pub cpu_vendor_id: String,
    pub cpu_frequency: u64,
    pub cpu_cores: u32,
    pub physical_core_count: Option<u32>,
    pub global_cpu_usage: f32,
    pub total_memory: u64,
    pub available_memory: u64,
    pub used_memory: u64,
    pub total_swap: u64,
    pub used_swap: u64,
    pub uptime: u64,
    pub boot_time: u64,
    pub load_average: [f64; 3],
    pub gpus: Vec<GpuInfo>,
    pub app_version: String,
}

impl From<crate::core::system_info::PlatformInfo> for PlatformInfo {
    fn from(value: crate::core::system_info::PlatformInfo) -> Self {
        Self {
            os: value.os,
            arch: value.arch,
            os_version: value.os_version,
            os_long_version: value.os_long_version,
            kernel_version: value.kernel_version,
            hostname: value.hostname,
            os_name: value.os_name,
            distribution_id: value.distribution_id,
            cpu_arch: value.cpu_arch,
            cpu_model: value.cpu_model,
            cpu_vendor_id: value.cpu_vendor_id,
            cpu_frequency: value.cpu_frequency,
            cpu_cores: value.cpu_cores,
            physical_core_count: value.physical_core_count,
            global_cpu_usage: value.global_cpu_usage,
            total_memory: value.total_memory,
            available_memory: value.available_memory,
            used_memory: value.used_memory,
            total_swap: value.total_swap,
            used_swap: value.used_swap,
            uptime: value.uptime,
            boot_time: value.boot_time,
            load_average: value.load_average,
            gpus: value.gpus.into_iter().map(GpuInfo::from).collect(),
            app_version: value.app_version,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub available_space: u64,
    pub used_space: u64,
    pub usage_percent: f32,
    pub file_system: String,
    pub disk_type: String,
    pub is_removable: bool,
    pub is_read_only: bool,
    pub read_bytes: u64,
    pub written_bytes: u64,
    pub total_space_human: String,
    pub available_space_human: String,
    pub used_space_human: String,
    pub read_bytes_human: String,
    pub written_bytes_human: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterfaceInfo {
    pub name: String,
    pub mac_address: String,
    pub ip_addresses: Vec<String>,
    pub total_received: u64,
    pub total_transmitted: u64,
    pub total_received_human: String,
    pub total_transmitted_human: String,
    pub mtu: u64,
    pub total_packets_received: u64,
    pub total_packets_transmitted: u64,
    pub total_errors_on_received: u64,
    pub total_errors_on_transmitted: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentInfo {
    pub label: String,
    pub temperature: Option<f32>,
    pub max: Option<f32>,
    pub critical: Option<f32>,
}

#[tauri::command]
pub fn get_components_info() -> Result<Vec<ComponentInfo>, String> {
    use sysinfo::Components;

    let components = Components::new_with_refreshed_list();
    let result: Vec<ComponentInfo> = components
        .iter()
        .map(|c| ComponentInfo {
            label: c.label().to_string(),
            temperature: c.temperature(),
            max: c.max(),
            critical: c.critical(),
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn get_battery_info() -> Result<Option<BatteryInfo>, String> {
    Ok(detect_battery().await)
}

#[tauri::command]
pub fn get_disk_info() -> Result<Vec<DiskInfo>, String> {
    use sysinfo::Disks;

    let disks = Disks::new_with_refreshed_list();
    let mut result = Vec::new();

    for disk in disks.list() {
        let total = disk.total_space();
        let available = disk.available_space();
        let used = total.saturating_sub(available);
        let usage_percent = if total > 0 {
            (used as f64 / total as f64 * 100.0) as f32
        } else {
            0.0
        };

        let disk_type = match disk.kind() {
            sysinfo::DiskKind::SSD => "SSD".to_string(),
            sysinfo::DiskKind::HDD => "HDD".to_string(),
            _ => "Unknown".to_string(),
        };

        let usage = disk.usage();

        result.push(DiskInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            total_space: total,
            available_space: available,
            used_space: used,
            usage_percent,
            file_system: disk.file_system().to_string_lossy().to_string(),
            disk_type,
            is_removable: disk.is_removable(),
            is_read_only: disk.is_read_only(),
            read_bytes: usage.read_bytes,
            written_bytes: usage.written_bytes,
            total_space_human: format_size(total),
            available_space_human: format_size(available),
            used_space_human: format_size(used),
            read_bytes_human: format_size(usage.read_bytes),
            written_bytes_human: format_size(usage.written_bytes),
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_network_interfaces() -> Result<Vec<NetworkInterfaceInfo>, String> {
    use sysinfo::Networks;

    let networks = Networks::new_with_refreshed_list();
    let mut result = Vec::new();

    for (name, data) in networks.list() {
        let ip_addresses: Vec<String> = data
            .ip_networks()
            .iter()
            .map(|ip| ip.addr.to_string())
            .collect();

        let total_received = data.total_received();
        let total_transmitted = data.total_transmitted();

        result.push(NetworkInterfaceInfo {
            name: name.clone(),
            mac_address: data.mac_address().to_string(),
            ip_addresses,
            total_received,
            total_transmitted,
            total_received_human: format_size(total_received),
            total_transmitted_human: format_size(total_transmitted),
            mtu: data.mtu(),
            total_packets_received: data.total_packets_received(),
            total_packets_transmitted: data.total_packets_transmitted(),
            total_errors_on_received: data.total_errors_on_received(),
            total_errors_on_transmitted: data.total_errors_on_transmitted(),
        });
    }

    Ok(result)
}

/// Detect GPU information using platform-native methods
#[allow(dead_code)]
async fn detect_gpus() -> Vec<GpuInfo> {
    #[cfg(target_os = "windows")]
    {
        return detect_gpus_windows().await;
    }

    #[cfg(target_os = "macos")]
    {
        return detect_gpus_macos().await;
    }

    #[cfg(target_os = "linux")]
    {
        return detect_gpus_linux().await;
    }

    #[allow(unreachable_code)]
    Vec::new()
}

#[cfg(target_os = "windows")]
#[allow(dead_code)]
async fn detect_gpus_windows() -> Vec<GpuInfo> {
    use crate::platform::process;

    let opts =
        Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(10)));

    // Prefer PowerShell Get-CimInstance (wmic is deprecated since Windows 10 21H1)
    let ps_output = process::execute(
        "powershell",
        &[
            "-NoProfile", "-NonInteractive", "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,AdapterCompatibility | ConvertTo-Json -Compress",
        ],
        opts.clone(),
    )
    .await;

    if let Ok(out) = ps_output {
        if out.success {
            if let Some(gpus) = parse_powershell_gpu_json(&out.stdout) {
                if !gpus.is_empty() {
                    return gpus;
                }
            }
        }
    }

    // Fallback to wmic for older Windows versions without PowerShell 5+
    let wmic_output = process::execute(
        "wmic",
        &[
            "path",
            "Win32_VideoController",
            "get",
            "Name,AdapterRAM,DriverVersion,AdapterCompatibility",
            "/format:csv",
        ],
        opts,
    )
    .await;

    let mut gpus = Vec::new();
    if let Ok(out) = wmic_output {
        if out.success {
            for line in out.stdout.lines().skip(1) {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                // CSV format: Node,AdapterCompatibility,AdapterRAM,DriverVersion,Name
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 5 {
                    let vendor = parts[1].trim();
                    let adapter_ram_str = parts[2].trim();
                    let driver_version = parts[3].trim();
                    let name = parts[4].trim();

                    if name.is_empty() {
                        continue;
                    }

                    let vram_mb = adapter_ram_str
                        .parse::<u64>()
                        .ok()
                        .map(|b| b / (1024 * 1024));

                    gpus.push(GpuInfo {
                        name: name.to_string(),
                        vram_mb,
                        driver_version: if driver_version.is_empty() {
                            None
                        } else {
                            Some(driver_version.to_string())
                        },
                        vendor: if vendor.is_empty() {
                            None
                        } else {
                            Some(vendor.to_string())
                        },
                    });
                }
            }
        }
    }
    gpus
}

/// Parse PowerShell Get-CimInstance JSON output for GPU info.
/// Output can be a single object or an array of objects.
#[cfg(target_os = "windows")]
#[allow(dead_code)]
fn parse_powershell_gpu_json(json_str: &str) -> Option<Vec<GpuInfo>> {
    let json_str = json_str.trim();
    if json_str.is_empty() {
        return None;
    }

    let value: serde_json::Value = serde_json::from_str(json_str).ok()?;
    let items = match &value {
        serde_json::Value::Array(arr) => arr.clone(),
        serde_json::Value::Object(_) => vec![value],
        _ => return None,
    };

    let mut gpus = Vec::new();
    for item in &items {
        let name = item
            .get("Name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if name.is_empty() {
            continue;
        }
        let adapter_ram = item.get("AdapterRAM").and_then(|v| v.as_u64());
        let vram_mb = adapter_ram.map(|b| b / (1024 * 1024));
        let driver_version = item
            .get("DriverVersion")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
        let vendor = item
            .get("AdapterCompatibility")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        gpus.push(GpuInfo {
            name: name.to_string(),
            vram_mb,
            driver_version,
            vendor,
        });
    }
    Some(gpus)
}

#[cfg(target_os = "macos")]
async fn detect_gpus_macos() -> Vec<GpuInfo> {
    use crate::platform::process;

    let opts =
        Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(10)));
    let output = process::execute("system_profiler", &["SPDisplaysDataType", "-json"], opts).await;

    let mut gpus = Vec::new();
    if let Ok(out) = output {
        if out.success {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out.stdout) {
                if let Some(displays) = json.get("SPDisplaysDataType").and_then(|v| v.as_array()) {
                    for display in displays {
                        let name = display
                            .get("sppci_model")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown GPU")
                            .to_string();

                        let vram_str = display
                            .get("spdisplays_vram")
                            .or_else(|| display.get("spdisplays_vram_shared"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");

                        // Parse VRAM like "1536 MB" or "8 GB"
                        let vram_mb = parse_vram_string(vram_str);

                        let vendor = display
                            .get("sppci_vendor")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());

                        gpus.push(GpuInfo {
                            name,
                            vram_mb,
                            driver_version: None,
                            vendor,
                        });
                    }
                }
            }
        }
    }
    gpus
}

#[cfg(target_os = "linux")]
async fn detect_gpus_linux() -> Vec<GpuInfo> {
    use crate::platform::process;

    let opts =
        Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(10)));
    let mut gpus = Vec::new();

    // Try lspci first
    if let Ok(out) = process::execute("lspci", &["-nn"], opts.clone()).await {
        if out.success {
            for line in out.stdout.lines() {
                let lower = line.to_lowercase();
                if lower.contains("vga")
                    || lower.contains("3d controller")
                    || lower.contains("display controller")
                {
                    // Extract GPU name: everything after the category description
                    let name = if let Some(pos) = line.find(":") {
                        let after_bus = &line[pos + 1..];
                        if let Some(pos2) = after_bus.find(":") {
                            after_bus[pos2 + 1..].trim().to_string()
                        } else {
                            after_bus.trim().to_string()
                        }
                    } else {
                        line.trim().to_string()
                    };

                    // Determine vendor from name
                    let vendor = if lower.contains("nvidia") {
                        Some("NVIDIA".to_string())
                    } else if lower.contains("amd") || lower.contains("ati") {
                        Some("AMD".to_string())
                    } else if lower.contains("intel") {
                        Some("Intel".to_string())
                    } else {
                        None
                    };

                    gpus.push(GpuInfo {
                        name,
                        vram_mb: None,
                        driver_version: None,
                        vendor,
                    });
                }
            }
        }
    }

    // Try nvidia-smi for NVIDIA GPUs (enriches info)
    if let Ok(out) = process::execute(
        "nvidia-smi",
        &[
            "--query-gpu=name,memory.total,driver_version",
            "--format=csv,noheader,nounits",
        ],
        opts,
    )
    .await
    {
        if out.success {
            // If nvidia-smi works, replace/enrich NVIDIA entries
            let nvidia_gpus: Vec<GpuInfo> = out
                .stdout
                .lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 3 {
                        Some(GpuInfo {
                            name: parts[0].to_string(),
                            vram_mb: parts[1].parse::<u64>().ok(),
                            driver_version: Some(parts[2].to_string()),
                            vendor: Some("NVIDIA".to_string()),
                        })
                    } else {
                        None
                    }
                })
                .collect();

            if !nvidia_gpus.is_empty() {
                // Remove existing NVIDIA entries from lspci and add nvidia-smi ones
                gpus.retain(|g| g.vendor.as_deref() != Some("NVIDIA"));
                gpus.extend(nvidia_gpus);
            }
        }
    }

    gpus
}

#[cfg(target_os = "macos")]
fn parse_vram_string(s: &str) -> Option<u64> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    let upper = s.to_uppercase();
    if upper.ends_with("GB") {
        let num = upper.trim_end_matches("GB").trim();
        num.parse::<f64>().ok().map(|v| (v * 1024.0) as u64)
    } else if upper.ends_with("MB") {
        let num = upper.trim_end_matches("MB").trim();
        num.parse::<u64>().ok()
    } else {
        s.parse::<u64>().ok()
    }
}

/// Detect battery information using platform-native methods
pub(crate) async fn detect_battery() -> Option<BatteryInfo> {
    #[cfg(target_os = "windows")]
    {
        return detect_battery_windows().await;
    }

    #[cfg(target_os = "macos")]
    {
        return detect_battery_macos().await;
    }

    #[cfg(target_os = "linux")]
    {
        return detect_battery_linux().await;
    }

    #[allow(unreachable_code)]
    None
}

#[cfg(target_os = "windows")]
async fn detect_battery_windows() -> Option<BatteryInfo> {
    use crate::platform::process;

    let opts =
        Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(10)));
    let output = process::execute(
        "powershell",
        &[
            "-NoProfile", "-NonInteractive", "-Command",
            "Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus,DesignCapacity,FullChargeCapacity,DesignVoltage,EstimatedRunTime,Chemistry | ConvertTo-Json -Compress",
        ],
        opts,
    )
    .await;

    if let Ok(out) = output {
        if out.success {
            let json_str = out.stdout.trim();
            if json_str.is_empty() || json_str == "null" {
                return None;
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
                // Handle both single object and array
                let item = match &value {
                    serde_json::Value::Array(arr) => arr.first()?.clone(),
                    serde_json::Value::Object(_) => value,
                    _ => return None,
                };

                let percent = item
                    .get("EstimatedChargeRemaining")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as u8;

                // BatteryStatus: 1=Discharging, 2=AC, 3=Fully Charged, 4=Low, 5=Critical,
                // 6=Charging, 7=Charging+High, 8=Charging+Low, 9=Charging+Critical, 10=Undefined, 11=Partially Charged
                let status = item
                    .get("BatteryStatus")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let is_charging = matches!(status, 6..=9);
                let is_plugged_in = matches!(status, 2 | 3 | 6 | 7 | 8 | 9 | 11);

                let design_cap = item.get("DesignCapacity").and_then(|v| v.as_u64());
                let full_cap = item.get("FullChargeCapacity").and_then(|v| v.as_u64());
                let health_percent = match (design_cap, full_cap) {
                    (Some(d), Some(f)) if d > 0 => {
                        Some(((f as f64 / d as f64) * 100.0).min(100.0) as u8)
                    }
                    _ => None,
                };

                let voltage_mv = item.get("DesignVoltage").and_then(|v| v.as_u64());

                let estimated_run_time = item.get("EstimatedRunTime").and_then(|v| v.as_u64());
                let time_to_empty_mins = if !is_charging && !is_plugged_in {
                    // 0x1FFFFFFF = unknown/plugged in
                    estimated_run_time
                        .filter(|&v| v < 0x1FFFFFFF)
                        .map(|v| v as u32)
                } else {
                    None
                };

                // Chemistry: 1=Other, 2=Unknown, 3=Lead Acid, 4=Nickel Cadmium, 5=Nickel Metal Hydride,
                // 6=Lithium-ion, 7=Zinc air, 8=Lithium Polymer
                let technology =
                    item.get("Chemistry")
                        .and_then(|v| v.as_u64())
                        .and_then(|c| match c {
                            3 => Some("Lead Acid".to_string()),
                            4 => Some("NiCd".to_string()),
                            5 => Some("NiMH".to_string()),
                            6 => Some("Li-ion".to_string()),
                            7 => Some("Zinc Air".to_string()),
                            8 => Some("Li-poly".to_string()),
                            _ => None,
                        });

                let power_source = if is_plugged_in { "ac" } else { "battery" };

                return Some(BatteryInfo {
                    percent,
                    is_charging,
                    is_plugged_in,
                    health_percent,
                    cycle_count: None, // Win32_Battery doesn't expose cycle count
                    design_capacity_mwh: design_cap,
                    full_capacity_mwh: full_cap,
                    voltage_mv,
                    power_source: power_source.to_string(),
                    time_to_empty_mins,
                    time_to_full_mins: None,
                    technology,
                });
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
async fn detect_battery_macos() -> Option<BatteryInfo> {
    use crate::platform::process;

    let opts = Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(5)));
    let output = process::execute("pmset", &["-g", "batt"], opts).await;

    if let Ok(out) = output {
        if out.success {
            let stdout = &out.stdout;
            // Example: " -InternalBattery-0 (id=...)	85%; charging; 0:45 remaining"
            // or: " -InternalBattery-0 (id=...)	100%; charged; 0:00 remaining"
            // or: " -InternalBattery-0 (id=...)	72%; discharging; 3:21 remaining"
            for line in stdout.lines() {
                if !line.contains("InternalBattery") {
                    continue;
                }
                // Parse percentage
                let percent = line
                    .split('%')
                    .next()
                    .and_then(|s| s.split_whitespace().last())
                    .and_then(|s| s.parse::<u8>().ok())
                    .unwrap_or(0);

                let lower = line.to_lowercase();
                let is_charging = lower.contains("charging")
                    && !lower.contains("discharging")
                    && !lower.contains("not charging");
                let is_plugged_in = lower.contains("ac power")
                    || lower.contains("charging")
                    || lower.contains("charged");

                // Parse time remaining: "X:YY remaining"
                let time_mins = line
                    .split(';')
                    .find(|s| s.contains("remaining"))
                    .and_then(|s| {
                        let parts: Vec<&str> =
                            s.trim().split_whitespace().next()?.split(':').collect();
                        if parts.len() == 2 {
                            let hours = parts[0].parse::<u32>().ok()?;
                            let mins = parts[1].parse::<u32>().ok()?;
                            Some(hours * 60 + mins)
                        } else {
                            None
                        }
                    });

                let power_source = if is_plugged_in { "ac" } else { "battery" };

                return Some(BatteryInfo {
                    percent,
                    is_charging,
                    is_plugged_in,
                    health_percent: None,
                    cycle_count: None,
                    design_capacity_mwh: None,
                    full_capacity_mwh: None,
                    voltage_mv: None,
                    power_source: power_source.to_string(),
                    time_to_empty_mins: if !is_charging { time_mins } else { None },
                    time_to_full_mins: if is_charging { time_mins } else { None },
                    technology: None,
                });
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
async fn detect_battery_linux() -> Option<BatteryInfo> {
    use std::path::Path;

    let power_supply = Path::new("/sys/class/power_supply");
    if !power_supply.exists() {
        return None;
    }

    // Find first BAT* directory
    let bat_dir = std::fs::read_dir(power_supply).ok()?.find_map(|entry| {
        let entry = entry.ok()?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with("BAT") {
            Some(entry.path())
        } else {
            None
        }
    })?;

    let read_file = |filename: &str| -> Option<String> {
        std::fs::read_to_string(bat_dir.join(filename))
            .ok()
            .map(|s| s.trim().to_string())
    };

    let percent = read_file("capacity")?.parse::<u8>().ok()?;
    let status = read_file("status").unwrap_or_default();

    let is_charging = status.eq_ignore_ascii_case("Charging");
    let is_plugged_in = !status.eq_ignore_ascii_case("Discharging");

    let cycle_count = read_file("cycle_count").and_then(|s| s.parse::<u32>().ok());
    let energy_full_design = read_file("energy_full_design").and_then(|s| s.parse::<u64>().ok());
    let energy_full = read_file("energy_full").and_then(|s| s.parse::<u64>().ok());
    let voltage_now = read_file("voltage_now").and_then(|s| s.parse::<u64>().ok());
    let technology = read_file("technology");

    // energy values are in µWh, convert to mWh
    let design_capacity_mwh = energy_full_design.map(|v| v / 1000);
    let full_capacity_mwh = energy_full.map(|v| v / 1000);
    let voltage_mv = voltage_now.map(|v| v / 1000);

    let health_percent = match (energy_full_design, energy_full) {
        (Some(d), Some(f)) if d > 0 => Some(((f as f64 / d as f64) * 100.0).min(100.0) as u8),
        _ => None,
    };

    let power_source = if is_plugged_in { "ac" } else { "battery" };

    Some(BatteryInfo {
        percent,
        is_charging,
        is_plugged_in,
        health_percent,
        cycle_count,
        design_capacity_mwh,
        full_capacity_mwh,
        voltage_mv,
        power_source: power_source.to_string(),
        time_to_empty_mins: None,
        time_to_full_mins: None,
        technology,
    })
}

#[tauri::command]
pub fn app_check_init() -> crate::StartupStatus {
    crate::get_startup_status()
}

/// Export the full backend config as a TOML string
#[tauri::command]
pub async fn config_export(settings: State<'_, SharedSettings>) -> Result<String, String> {
    let s = settings.read().await;
    toml::to_string_pretty(&*s).map_err(|e| format!("Failed to serialize config: {}", e))
}

/// Import a full backend config from a TOML string, replacing all settings
#[tauri::command]
pub async fn config_import(
    toml_content: String,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let parsed: crate::config::Settings =
        toml::from_str(&toml_content).map_err(|e| format!("Failed to parse config: {}", e))?;
    let mut s = settings.write().await;
    *s = parsed;
    s.save().await.map_err(|e| e.to_string())?;
    refresh_network_clients(&s);
    Ok(())
}

// ---------------------------------------------------------------------------
// Proxy detection & testing
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProxyInfo {
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub no_proxy: Option<String>,
    pub source: String,
}

/// Detect system proxy settings from environment variables and OS-level config.
#[tauri::command]
pub fn detect_system_proxy() -> Result<SystemProxyInfo, String> {
    // 1. Check environment variables first
    let http_proxy = std::env::var("HTTP_PROXY")
        .or_else(|_| std::env::var("http_proxy"))
        .or_else(|_| std::env::var("ALL_PROXY"))
        .or_else(|_| std::env::var("all_proxy"))
        .ok()
        .filter(|s| !s.is_empty());

    let https_proxy = std::env::var("HTTPS_PROXY")
        .or_else(|_| std::env::var("https_proxy"))
        .or_else(|_| std::env::var("ALL_PROXY"))
        .or_else(|_| std::env::var("all_proxy"))
        .ok()
        .filter(|s| !s.is_empty());

    let no_proxy = std::env::var("NO_PROXY")
        .or_else(|_| std::env::var("no_proxy"))
        .ok()
        .filter(|s| !s.is_empty());

    if http_proxy.is_some() || https_proxy.is_some() {
        return Ok(SystemProxyInfo {
            http_proxy,
            https_proxy,
            no_proxy,
            source: "environment".to_string(),
        });
    }

    // 2. Windows: read from registry
    #[cfg(windows)]
    {
        if let Some(info) = detect_windows_registry_proxy() {
            return Ok(info);
        }
    }

    Ok(SystemProxyInfo {
        http_proxy: None,
        https_proxy: None,
        no_proxy: None,
        source: "none".to_string(),
    })
}

#[cfg(windows)]
fn detect_windows_registry_proxy() -> Option<SystemProxyInfo> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let inet = hkcu
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
        .ok()?;

    let enabled: u32 = inet.get_value("ProxyEnable").unwrap_or(0);
    if enabled == 0 {
        return None;
    }

    let server: String = inet.get_value("ProxyServer").unwrap_or_default();
    if server.is_empty() {
        return None;
    }

    let override_list: String = inet.get_value("ProxyOverride").unwrap_or_default();
    let no_proxy = if override_list.is_empty() {
        None
    } else {
        Some(override_list.replace(';', ","))
    };

    // Windows proxy server can be "host:port" or "http=host:port;https=host:port"
    let proxy_url = if server.contains('=') {
        // Protocol-specific: extract http proxy
        server
            .split(';')
            .find(|s| s.starts_with("http="))
            .map(|s| s.trim_start_matches("http=").to_string())
            .map(|s| {
                if s.starts_with("http://") || s.starts_with("https://") || s.starts_with("socks") {
                    s
                } else {
                    format!("http://{}", s)
                }
            })
    } else {
        // Single proxy for all protocols
        let s = if server.starts_with("http://")
            || server.starts_with("https://")
            || server.starts_with("socks")
        {
            server.clone()
        } else {
            format!("http://{}", server)
        };
        Some(s)
    };

    Some(SystemProxyInfo {
        http_proxy: proxy_url.clone(),
        https_proxy: proxy_url,
        no_proxy,
        source: "windows_registry".to_string(),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyTestResult {
    pub success: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
}

/// Test proxy connectivity by making a HEAD request through the given proxy.
#[tauri::command]
pub async fn test_proxy_connection(
    proxy_url: String,
    test_url: Option<String>,
) -> Result<ProxyTestResult, String> {
    let target = test_url.unwrap_or_else(|| "https://www.google.com".to_string());

    let proxy = match reqwest::Proxy::all(&proxy_url) {
        Ok(p) => p,
        Err(e) => {
            return Ok(ProxyTestResult {
                success: false,
                latency_ms: 0,
                error: Some(format!("Invalid proxy URL: {}", e)),
            });
        }
    };

    let client = match reqwest::Client::builder()
        .proxy(proxy)
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return Ok(ProxyTestResult {
                success: false,
                latency_ms: 0,
                error: Some(format!("Failed to create test client: {}", e)),
            });
        }
    };

    let start = std::time::Instant::now();
    match client.head(&target).send().await {
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as u64;
            if resp.status().is_success() || resp.status().is_redirection() {
                Ok(ProxyTestResult {
                    success: true,
                    latency_ms: latency,
                    error: None,
                })
            } else {
                Ok(ProxyTestResult {
                    success: false,
                    latency_ms: latency,
                    error: Some(format!("HTTP {}", resp.status())),
                })
            }
        }
        Err(e) => {
            let latency = start.elapsed().as_millis() as u64;
            Ok(ProxyTestResult {
                success: false,
                latency_ms: latency,
                error: Some(e.to_string()),
            })
        }
    }
}
