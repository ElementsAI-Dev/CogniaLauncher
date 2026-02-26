use crate::config::Settings;
use crate::platform::disk::format_size;
use serde::Serialize;
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
    "network.timeout",
    "network.retries",
    "network.proxy",
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
];

#[tauri::command]
pub async fn config_list(
    settings: State<'_, SharedSettings>,
) -> Result<Vec<(String, String)>, String> {
    let s = settings.read().await;

    let mut result: Vec<(String, String)> = CONFIG_LIST_STATIC_KEYS
        .iter()
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

    // Add provider tokens/URLs (GitHub, GitLab)
    for provider_name in &["github", "gitlab"] {
        if let Some(ps) = s.providers.get(*provider_name) {
            if let Some(token) = ps.extra.get("token").and_then(|v| v.as_str()) {
                if !token.is_empty() {
                    // Mask token for display (show first 4 chars + asterisks)
                    let masked = if token.len() > 8 {
                        format!("{}****{}", &token[..4], &token[token.len() - 4..])
                    } else {
                        "****".to_string()
                    };
                    result.push((format!("providers.{}.token", provider_name), masked));
                }
            }
            if let Some(url) = ps.extra.get("url").and_then(|v| v.as_str()) {
                if !url.is_empty() {
                    result.push((format!("providers.{}.url", provider_name), url.to_string()));
                }
            }
        }
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
pub async fn get_platform_info() -> Result<PlatformInfo, String> {
    use sysinfo::System;

    let os = crate::platform::env::current_platform()
        .as_str()
        .to_string();
    let arch = crate::platform::env::current_arch().as_str().to_string();

    let os_version = System::os_version().unwrap_or_default();
    let os_long_version = System::long_os_version().unwrap_or_default();
    let kernel_version = System::kernel_version().unwrap_or_default();
    let hostname = System::host_name().unwrap_or_default();
    let os_name = System::name().unwrap_or_default();
    let distribution_id = System::distribution_id();
    let cpu_arch = System::cpu_arch();
    let boot_time = System::boot_time();
    let load_avg = System::load_average();

    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    // sysinfo requires two CPU refreshes with a delay for accurate usage data.
    // MINIMUM_CPU_UPDATE_INTERVAL is ~200ms.
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_usage();

    let cpu_model = sys
        .cpus()
        .first()
        .map(|cpu| cpu.brand().to_string())
        .unwrap_or_default();
    let cpu_vendor_id = sys
        .cpus()
        .first()
        .map(|cpu| cpu.vendor_id().to_string())
        .unwrap_or_default();
    let cpu_frequency = sys.cpus().first().map(|cpu| cpu.frequency()).unwrap_or(0);
    let cpu_cores = sys.cpus().len() as u32;
    let physical_core_count = sys.physical_core_count().map(|c| c as u32);
    let global_cpu_usage = sys.global_cpu_usage();

    let total_memory = sys.total_memory();
    let available_memory = sys.available_memory();
    let used_memory = sys.used_memory();
    let total_swap = sys.total_swap();
    let used_swap = sys.used_swap();
    let uptime = System::uptime();

    // GPU detection (async, platform-native)
    let gpus = detect_gpus().await;

    Ok(PlatformInfo {
        os,
        arch,
        os_version,
        os_long_version,
        kernel_version,
        hostname,
        os_name,
        distribution_id,
        cpu_arch,
        cpu_model,
        cpu_vendor_id,
        cpu_frequency,
        cpu_cores,
        physical_core_count,
        global_cpu_usage,
        total_memory,
        available_memory,
        used_memory,
        total_swap,
        used_swap,
        uptime,
        boot_time,
        load_average: [load_avg.one, load_avg.five, load_avg.fifteen],
        gpus,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::CONFIG_LIST_STATIC_KEYS;

    #[test]
    fn config_list_static_keys_include_terminal_proxy_settings() {
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"terminal.proxy_mode"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"terminal.custom_proxy"));
        assert!(CONFIG_LIST_STATIC_KEYS.contains(&"terminal.no_proxy"));
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    pub percent: u8,
    pub is_charging: bool,
    pub is_plugged_in: bool,
    pub health_percent: Option<u8>,
    pub cycle_count: Option<u32>,
    pub design_capacity_mwh: Option<u64>,
    pub full_capacity_mwh: Option<u64>,
    pub voltage_mv: Option<u64>,
    pub power_source: String,
    pub time_to_empty_mins: Option<u32>,
    pub time_to_full_mins: Option<u32>,
    pub technology: Option<String>,
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
async fn detect_battery() -> Option<BatteryInfo> {
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
                let is_charging = matches!(status, 6 | 7 | 8 | 9);
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
    s.save().await.map_err(|e| e.to_string())
}
