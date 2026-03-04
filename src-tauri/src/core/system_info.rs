use crate::platform::disk::format_size;
use chrono::Utc;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

const HARDWARE_SECTION_TTL: Duration = Duration::from_secs(45);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SectionState {
    Fresh,
    Cached,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSectionStatus {
    pub platform: SectionState,
    pub gpus: SectionState,
    pub components: SectionState,
    pub battery: SectionState,
    pub disks: SectionState,
    pub networks: SectionState,
}

impl SnapshotSectionStatus {
    fn fresh() -> Self {
        Self {
            platform: SectionState::Fresh,
            gpus: SectionState::Fresh,
            components: SectionState::Fresh,
            battery: SectionState::Fresh,
            disks: SectionState::Fresh,
            networks: SectionState::Fresh,
        }
    }

    fn cached() -> Self {
        Self {
            platform: SectionState::Fresh,
            gpus: SectionState::Cached,
            components: SectionState::Cached,
            battery: SectionState::Cached,
            disks: SectionState::Cached,
            networks: SectionState::Cached,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshotOptions {
    pub force: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub vram_mb: Option<u64>,
    pub driver_version: Option<String>,
    pub vendor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentInfo {
    pub label: String,
    pub temperature: Option<f32>,
    pub max: Option<f32>,
    pub critical: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareSections {
    pub components: Vec<ComponentInfo>,
    pub battery: Option<BatteryInfo>,
    pub disks: Vec<DiskInfo>,
    pub networks: Vec<NetworkInterfaceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub platform: PlatformInfo,
    #[serde(flatten)]
    pub hardware: HardwareSections,
    pub collected_at: String,
    pub section_status: SnapshotSectionStatus,
}

#[derive(Clone)]
struct CachedHardware {
    collected_at: Instant,
    gpus: Vec<GpuInfo>,
    sections: HardwareSections,
}

static HARDWARE_CACHE: Lazy<RwLock<Option<CachedHardware>>> =
    Lazy::new(|| RwLock::new(None));

pub async fn collect_platform_info(force_refresh: bool) -> PlatformInfo {
    let (gpus, _, _) = collect_hardware_sections(force_refresh).await;
    collect_platform_baseline(gpus).await
}

pub async fn collect_components(force_refresh: bool) -> Vec<ComponentInfo> {
    let (_, hw, _) = collect_hardware_sections(force_refresh).await;
    hw.components
}

pub async fn collect_battery(force_refresh: bool) -> Option<BatteryInfo> {
    let (_, hw, _) = collect_hardware_sections(force_refresh).await;
    hw.battery
}

pub async fn collect_disks(force_refresh: bool) -> Vec<DiskInfo> {
    let (_, hw, _) = collect_hardware_sections(force_refresh).await;
    hw.disks
}

pub async fn collect_networks(force_refresh: bool) -> Vec<NetworkInterfaceInfo> {
    let (_, hw, _) = collect_hardware_sections(force_refresh).await;
    hw.networks
}

pub async fn collect_system_snapshot(force_refresh: bool) -> SystemSnapshot {
    let (gpus, hw, section_status) = collect_hardware_sections(force_refresh).await;
    let platform = collect_platform_baseline(gpus).await;

    SystemSnapshot {
        platform,
        hardware: hw,
        collected_at: Utc::now().to_rfc3339(),
        section_status,
    }
}

async fn collect_hardware_sections(
    force_refresh: bool,
) -> (Vec<GpuInfo>, HardwareSections, SnapshotSectionStatus) {
    if !force_refresh {
        let cache_guard = HARDWARE_CACHE.read().await;
        if let Some(cached) = cache_guard.as_ref() {
            if cached.collected_at.elapsed() <= HARDWARE_SECTION_TTL {
                return (
                    cached.gpus.clone(),
                    cached.sections.clone(),
                    SnapshotSectionStatus::cached(),
                );
            }
        }
    }

    let mut cache_guard = HARDWARE_CACHE.write().await;
    if !force_refresh {
        if let Some(cached) = cache_guard.as_ref() {
            if cached.collected_at.elapsed() <= HARDWARE_SECTION_TTL {
                return (
                    cached.gpus.clone(),
                    cached.sections.clone(),
                    SnapshotSectionStatus::cached(),
                );
            }
        }
    }

    let mut status = SnapshotSectionStatus::fresh();
    let (gpus, components, battery, disks, networks) = tokio::join!(
        collect_gpus_safe(),
        collect_components_safe(),
        collect_battery_safe(),
        collect_disks_safe(),
        collect_networks_safe(),
    );

    let gpus = unwrap_or_mark_failed(gpus, &mut status.gpus);
    let sections = HardwareSections {
        components: unwrap_or_mark_failed(components, &mut status.components),
        battery: unwrap_or_mark_failed(battery, &mut status.battery),
        disks: unwrap_or_mark_failed(disks, &mut status.disks),
        networks: unwrap_or_mark_failed(networks, &mut status.networks),
    };

    *cache_guard = Some(CachedHardware {
        collected_at: Instant::now(),
        gpus: gpus.clone(),
        sections: sections.clone(),
    });

    (gpus, sections, status)
}

fn unwrap_or_mark_failed<T: Default>(result: Result<T, String>, status: &mut SectionState) -> T {
    match result {
        Ok(value) => value,
        Err(_) => {
            *status = SectionState::Failed;
            T::default()
        }
    }
}

async fn collect_platform_baseline(gpus: Vec<GpuInfo>) -> PlatformInfo {
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

    tokio::time::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL).await;
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

    PlatformInfo {
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
    }
}

async fn collect_components_safe() -> Result<Vec<ComponentInfo>, String> {
    use sysinfo::Components;

    let components = Components::new_with_refreshed_list();
    Ok(components
        .iter()
        .map(|c| ComponentInfo {
            label: c.label().to_string(),
            temperature: c.temperature(),
            max: c.max(),
            critical: c.critical(),
        })
        .collect())
}

async fn collect_disks_safe() -> Result<Vec<DiskInfo>, String> {
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

async fn collect_networks_safe() -> Result<Vec<NetworkInterfaceInfo>, String> {
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

async fn collect_battery_safe() -> Result<Option<BatteryInfo>, String> {
    Ok(crate::commands::config::detect_battery().await)
}

async fn collect_gpus_safe() -> Result<Vec<GpuInfo>, String> {
    Ok(detect_gpus().await)
}

/// Detect GPU information using platform-native methods.
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

    let ps_output = process::execute(
        "powershell",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
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

    if let Ok(out) = process::execute("lspci", &["-nn"], opts.clone()).await {
        if out.success {
            for line in out.stdout.lines() {
                let lower = line.to_lowercase();
                if lower.contains("vga")
                    || lower.contains("3d controller")
                    || lower.contains("display controller")
                {
                    let name = if let Some(pos) = line.find(':') {
                        let after_bus = &line[pos + 1..];
                        if let Some(pos2) = after_bus.find(':') {
                            after_bus[pos2 + 1..].trim().to_string()
                        } else {
                            after_bus.trim().to_string()
                        }
                    } else {
                        line.trim().to_string()
                    };

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
