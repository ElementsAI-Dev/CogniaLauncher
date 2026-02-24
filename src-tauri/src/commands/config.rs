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

    // Add provider tokens/URLs (GitHub, GitLab)
    for provider_name in &["github", "gitlab"] {
        if let Some(ps) = s.providers.get(*provider_name) {
            if let Some(token) = ps.extra.get("token").and_then(|v| v.as_str()) {
                if !token.is_empty() {
                    // Mask token for display (show first 4 chars + asterisks)
                    let masked = if token.len() > 8 {
                        format!("{}****{}", &token[..4], &token[token.len()-4..])
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
    let cpu_frequency = sys
        .cpus()
        .first()
        .map(|cpu| cpu.frequency())
        .unwrap_or(0);
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
    pub total_space_human: String,
    pub available_space_human: String,
    pub used_space_human: String,
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
            total_space_human: format_size(total),
            available_space_human: format_size(available),
            used_space_human: format_size(used),
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

    let opts = Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(10)));

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
        &["path", "Win32_VideoController", "get", "Name,AdapterRAM,DriverVersion,AdapterCompatibility", "/format:csv"],
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
        let name = item.get("Name").and_then(|v| v.as_str()).unwrap_or("").trim();
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

    let opts = Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(10)));
    let output = process::execute(
        "system_profiler",
        &["SPDisplaysDataType", "-json"],
        opts,
    )
    .await;

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

    let opts = Some(process::ProcessOptions::new().with_timeout(std::time::Duration::from_secs(10)));
    let mut gpus = Vec::new();

    // Try lspci first
    if let Ok(out) = process::execute("lspci", &["-nn"], opts.clone()).await {
        if out.success {
            for line in out.stdout.lines() {
                let lower = line.to_lowercase();
                if lower.contains("vga") || lower.contains("3d controller") || lower.contains("display controller") {
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
        &["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"],
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
                gpus.retain(|g| {
                    g.vendor.as_deref() != Some("NVIDIA")
                });
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
pub async fn config_export(
    settings: State<'_, SharedSettings>,
) -> Result<String, String> {
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
