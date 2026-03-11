use crate::provider::wsl::{
    WslCapabilities, WslDistroResources, WslPackageUpdateResult, WslProvider, WslUser,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// WSL distribution info returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslDistroStatus {
    pub name: String,
    pub state: String,
    pub wsl_version: String,
    pub is_default: bool,
}

/// WSL system-level status info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslStatus {
    pub version: String,
    pub kernel_version: Option<String>,
    pub wslg_version: Option<String>,
    pub default_distribution: Option<String>,
    pub default_version: Option<String>,
    pub status_info: String,
    pub running_distros: Vec<String>,
}

/// Parsed component versions from `wsl --version`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslVersionInfoDto {
    pub wsl_version: Option<String>,
    pub kernel_version: Option<String>,
    pub wslg_version: Option<String>,
    pub msrdc_version: Option<String>,
    pub direct3d_version: Option<String>,
    pub dxcore_version: Option<String>,
    pub windows_version: Option<String>,
}

/// Runtime WSL capability flags exposed to frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslCapabilitiesDto {
    pub manage: bool,
    #[serde(rename = "move")]
    pub r#move: bool,
    pub resize: bool,
    pub set_sparse: bool,
    pub set_default_user: bool,
    pub mount_options: bool,
    pub shutdown_force: bool,
    pub export_format: bool,
    pub import_in_place: bool,
    pub version: Option<String>,
}

/// Per-probe runtime detection result used by staged runtime snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslRuntimeProbeDto {
    pub id: String,
    pub command: String,
    pub success: bool,
    pub reason_code: String,
    pub detail: Option<String>,
}

/// Status for one non-command runtime stage (status/capability/distro probes).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslRuntimeStageDto {
    pub ready: bool,
    pub reason_code: String,
    pub detail: Option<String>,
}

/// Frontend-facing staged runtime snapshot contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslRuntimeSnapshotDto {
    pub state: String,
    pub available: bool,
    pub reason_code: String,
    pub reason: String,
    pub runtime_probes: Vec<WslRuntimeProbeDto>,
    pub status_probe: WslRuntimeStageDto,
    pub capability_probe: WslRuntimeStageDto,
    pub distro_probe: WslRuntimeStageDto,
    pub distro_count: usize,
    pub degraded_reasons: Vec<String>,
}

/// Options for WSL import operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslImportOptions {
    pub name: String,
    pub install_location: String,
    pub file_path: String,
    pub wsl_version: Option<u8>,
    pub as_vhd: bool,
}

/// Result of executing a command inside a WSL distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Disk usage information for a WSL distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslDiskUsage {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub filesystem_path: String,
}

fn get_provider() -> WslProvider {
    WslProvider::new()
}

fn map_capabilities(capabilities: WslCapabilities) -> WslCapabilitiesDto {
    WslCapabilitiesDto {
        manage: capabilities.manage,
        r#move: capabilities.r#move,
        resize: capabilities.resize,
        set_sparse: capabilities.set_sparse,
        set_default_user: capabilities.set_default_user,
        mount_options: capabilities.mount_options,
        shutdown_force: capabilities.shutdown_force,
        export_format: capabilities.export_format,
        import_in_place: capabilities.import_in_place,
        version: capabilities.version,
    }
}

fn map_runtime_probes(
    probes: Vec<crate::provider::wsl::WslRuntimeProbeResult>,
) -> Vec<WslRuntimeProbeDto> {
    probes
        .into_iter()
        .map(|probe| WslRuntimeProbeDto {
            id: probe.id,
            command: probe.command,
            success: probe.success,
            reason_code: probe.reason_code,
            detail: probe.detail,
        })
        .collect()
}

fn classify_wsl_error_category(message: &str) -> &'static str {
    let lower = message.to_lowercase();
    if lower.contains("[wsl_unsupported")
        || lower.contains("unsupported")
        || lower.contains("not supported")
        || lower.contains("未识别")
        || lower.contains("不支持")
    {
        return "unsupported";
    }
    if lower.contains("access is denied")
        || lower.contains("permission denied")
        || lower.contains("administrator")
        || lower.contains("elevation")
    {
        return "permission";
    }
    if lower.contains("[wsl_runtime:")
        || lower.contains("runtime unavailable")
        || lower.contains("wsl is unavailable")
        || lower.contains("distribution")
        || lower.contains("not running")
        || lower.contains("kernel")
        || lower.contains("timeout")
    {
        return "runtime";
    }
    "operation"
}

fn normalize_wsl_error(message: String) -> String {
    if message.starts_with("[WSL_") {
        return message;
    }
    let category = classify_wsl_error_category(&message).to_uppercase();
    format!("[WSL_{}] {}", category, message)
}

fn unsupported_feature_error(feature: &str, version: Option<&str>) -> String {
    let suffix = version.map(|v| format!(" (WSL {})", v)).unwrap_or_default();
    format!(
        "[WSL_UNSUPPORTED:{}] Feature is unavailable on this runtime{}.",
        feature, suffix
    )
}

fn runtime_precondition_error(feature: &str, reason: &str) -> String {
    format!("[WSL_RUNTIME:{}] {}", feature, reason)
}

fn distro_precondition_error(feature: &str, distro: &str) -> String {
    format!(
        "[WSL_RUNTIME:{}] Distribution '{}' is unavailable. Refresh distro inventory and retry.",
        feature, distro
    )
}

async fn ensure_runtime_available(provider: &WslProvider, feature: &str) -> Result<(), String> {
    let snapshot = provider.detect_runtime_snapshot().await;
    if !snapshot.available {
        let reason = if snapshot.reason.trim().is_empty() {
            "WSL runtime is unavailable on this host. Install or enable WSL and retry."
        } else {
            snapshot.reason.as_str()
        };
        return Err(runtime_precondition_error(feature, reason));
    }
    Ok(())
}

async fn ensure_distro_exists(
    provider: &WslProvider,
    feature: &str,
    distro: &str,
) -> Result<(), String> {
    let exists = provider
        .get_distro_detail(distro)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))?
        .is_some();
    if !exists {
        return Err(distro_precondition_error(feature, distro));
    }
    Ok(())
}

fn evaluate_runtime_state(
    available: bool,
    status_ready: bool,
    capability_ready: bool,
    distro_ready: bool,
    distro_count: usize,
    unavailable_reason: &str,
) -> (String, String, Vec<String>, String) {
    if !available {
        return (
            "unavailable".to_string(),
            "runtime_unavailable".to_string(),
            vec![unavailable_reason.to_string()],
            unavailable_reason.to_string(),
        );
    }

    if distro_ready && distro_count == 0 {
        return (
            "empty".to_string(),
            "runtime_empty".to_string(),
            Vec::new(),
            "Runtime is available, but no distributions are installed.".to_string(),
        );
    }

    let mut degraded_reasons = Vec::new();
    if !status_ready {
        degraded_reasons.push("Runtime status data is unavailable.".to_string());
    }
    if !capability_ready {
        degraded_reasons.push("Runtime capabilities could not be detected.".to_string());
    }
    if !distro_ready {
        degraded_reasons.push("Distribution inventory could not be detected.".to_string());
    }

    if degraded_reasons.is_empty() {
        return (
            "ready".to_string(),
            "runtime_ready".to_string(),
            Vec::new(),
            "Runtime and management probes passed.".to_string(),
        );
    }

    (
        "degraded".to_string(),
        "runtime_degraded".to_string(),
        degraded_reasons.clone(),
        degraded_reasons.join(" "),
    )
}

async fn ensure_wsl_capability<F>(
    provider: &WslProvider,
    feature: &str,
    check: F,
) -> Result<(), String>
where
    F: Fn(&WslCapabilities) -> bool,
{
    let capabilities = provider
        .get_capabilities()
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))?;
    if !check(&capabilities) {
        return Err(unsupported_feature_error(
            feature,
            capabilities.version.as_deref(),
        ));
    }
    Ok(())
}

/// Diagnostic command: returns step-by-step WSL detection info for debugging.
/// This helps identify exactly where detection fails on a given system.
#[tauri::command]
pub async fn wsl_debug_detection() -> Result<serde_json::Value, String> {
    use serde_json::json;

    let mut steps = Vec::new();

    // Helper to run wsl.exe and capture raw + decoded output
    async fn try_wsl(args: &[&str]) -> serde_json::Value {
        use serde_json::json;
        use std::process::Stdio;
        use tokio::process::Command as TokioCommand;

        let mut cmd = TokioCommand::new("wsl.exe");
        cmd.args(args);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000);
        }

        match cmd.output().await {
            Ok(output) => {
                let raw_stdout_len = output.stdout.len();
                let raw_stderr_len = output.stderr.len();
                let raw_stdout_hex: String = output
                    .stdout
                    .iter()
                    .take(40)
                    .map(|b| format!("{:02x}", b))
                    .collect::<Vec<_>>()
                    .join(" ");

                // Try to decode
                let stdout_decoded = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr_decoded = String::from_utf8_lossy(&output.stderr).to_string();

                json!({
                    "success": true,
                    "exit_code": output.status.code(),
                    "raw_stdout_len": raw_stdout_len,
                    "raw_stderr_len": raw_stderr_len,
                    "raw_stdout_hex_first_40": raw_stdout_hex,
                    "stdout_lossy_first_200": stdout_decoded.chars().take(200).collect::<String>(),
                    "stderr_lossy_first_200": stderr_decoded.chars().take(200).collect::<String>(),
                })
            }
            Err(e) => {
                json!({
                    "success": false,
                    "error": format!("{}", e),
                    "error_kind": format!("{:?}", e.kind()),
                })
            }
        }
    }

    // Step 1: wsl --version
    steps.push(json!({
        "step": "wsl --version",
        "result": try_wsl(&["--version"]).await,
    }));

    // Step 2: wsl --status
    steps.push(json!({
        "step": "wsl --status",
        "result": try_wsl(&["--status"]).await,
    }));

    // Step 3: wsl --help
    steps.push(json!({
        "step": "wsl --help",
        "result": try_wsl(&["--help"]).await,
    }));

    // Step 4: Check absolute path
    #[cfg(windows)]
    {
        let abs_path = "C:\\Windows\\System32\\wsl.exe";
        let exists = std::path::Path::new(abs_path).exists();
        steps.push(json!({
            "step": "absolute_path_check",
            "path": abs_path,
            "exists": exists,
        }));
    }

    // Step 5: Run is_available() and report result
    let provider = get_provider();
    use crate::provider::traits::Provider;
    let is_avail = provider.is_available().await;

    // Step 6: Check platform
    let platform = format!("{:?}", crate::platform::env::current_platform());

    Ok(json!({
        "platform": platform,
        "is_available_result": is_avail,
        "steps": steps,
    }))
}

/// List all installed WSL distributions with verbose info (state, version, default)
#[tauri::command]
pub async fn wsl_list_distros() -> Result<Vec<WslDistroStatus>, String> {
    let provider = get_provider();
    let out = provider
        .run_wsl_lenient(&["--list", "--verbose"])
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))?;

    let distros = WslProvider::parse_list_verbose(&out);

    Ok(distros
        .into_iter()
        .map(|d| WslDistroStatus {
            name: d.name,
            state: d.state,
            wsl_version: d.wsl_version,
            is_default: d.is_default,
        })
        .collect())
}

/// List available WSL distributions from the online store
#[tauri::command]
pub async fn wsl_list_online() -> Result<Vec<(String, String)>, String> {
    let provider = get_provider();
    let out = provider
        .run_wsl_lenient(&["--list", "--online"])
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))?;

    Ok(WslProvider::parse_list_online(&out))
}

/// Get WSL system status (version, kernel, running distros)
#[tauri::command]
pub async fn wsl_status() -> Result<WslStatus, String> {
    let provider = get_provider();

    let version = provider
        .get_wsl_version_string()
        .await
        .unwrap_or_else(|_| "Unknown".into());

    // Get full version info for kernel/WSLg versions
    let version_info = provider.get_full_version_info().await.ok();

    let status_info = provider
        .get_wsl_status()
        .await
        .unwrap_or_else(|_| "WSL status unavailable".into());

    // Parse status output for default distribution and version
    let (default_distribution, default_version) = WslProvider::parse_status_output(&status_info);

    let running = provider.list_running().await.unwrap_or_default();

    Ok(WslStatus {
        version,
        kernel_version: version_info.as_ref().and_then(|v| v.kernel_version.clone()),
        wslg_version: version_info.as_ref().and_then(|v| v.wslg_version.clone()),
        default_distribution,
        default_version,
        status_info,
        running_distros: running,
    })
}

/// Get full WSL version info (all component versions)
#[tauri::command]
pub async fn wsl_get_version_info() -> Result<WslVersionInfoDto, String> {
    let provider = get_provider();
    let info = provider
        .get_full_version_info()
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))?;
    Ok(WslVersionInfoDto {
        wsl_version: info.wsl_version,
        kernel_version: info.kernel_version,
        wslg_version: info.wslg_version,
        msrdc_version: info.msrdc_version,
        direct3d_version: info.direct3d_version,
        dxcore_version: info.dxcore_version,
        windows_version: info.windows_version,
    })
}

/// Get runtime WSL capability flags detected from the current machine.
#[tauri::command]
pub async fn wsl_get_capabilities() -> Result<WslCapabilitiesDto, String> {
    let provider = get_provider();
    let capabilities = provider
        .get_capabilities()
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))?;
    Ok(map_capabilities(capabilities))
}

/// Get staged runtime detection snapshot for frontend readiness decisions.
#[tauri::command]
pub async fn wsl_get_runtime_snapshot() -> Result<WslRuntimeSnapshotDto, String> {
    let provider = get_provider();
    let runtime = provider.detect_runtime_snapshot().await;
    let runtime_probes = map_runtime_probes(runtime.probes);

    if !runtime.available {
        return Ok(WslRuntimeSnapshotDto {
            state: "unavailable".to_string(),
            available: false,
            reason_code: runtime.reason_code,
            reason: runtime.reason.clone(),
            runtime_probes,
            status_probe: WslRuntimeStageDto {
                ready: false,
                reason_code: "runtime_unavailable".to_string(),
                detail: Some("Runtime status probe skipped because runtime is unavailable.".to_string()),
            },
            capability_probe: WslRuntimeStageDto {
                ready: false,
                reason_code: "runtime_unavailable".to_string(),
                detail: Some(
                    "Capability probe skipped because runtime is unavailable.".to_string(),
                ),
            },
            distro_probe: WslRuntimeStageDto {
                ready: false,
                reason_code: "runtime_unavailable".to_string(),
                detail: Some("Distro probe skipped because runtime is unavailable.".to_string()),
            },
            distro_count: 0,
            degraded_reasons: vec![runtime.reason],
        });
    }

    let (status_probe, status_ready) = match provider.get_wsl_status().await {
        Ok(_) => {
            let running = provider.list_running().await.unwrap_or_default();
            (
            WslRuntimeStageDto {
                ready: true,
                reason_code: "ok".to_string(),
                detail: Some(format!(
                    "Runtime status available; running distros={}.",
                    running.len()
                )),
            },
            true,
        )
        }
        Err(err) => (
            WslRuntimeStageDto {
                ready: false,
                reason_code: "status_probe_failed".to_string(),
                detail: Some(normalize_wsl_error(err.to_string())),
            },
            false,
        ),
    };

    let (capability_probe, capability_ready) = match provider.get_capabilities().await {
        Ok(capabilities) => (
            WslRuntimeStageDto {
                ready: true,
                reason_code: "ok".to_string(),
                detail: capabilities
                    .version
                    .map(|v| format!("Capabilities detected (WSL {}).", v))
                    .or(Some("Capabilities detected.".to_string())),
            },
            true,
        ),
        Err(err) => (
            WslRuntimeStageDto {
                ready: false,
                reason_code: "capability_probe_failed".to_string(),
                detail: Some(normalize_wsl_error(err.to_string())),
            },
            false,
        ),
    };

    let (distro_probe, distro_ready, distro_count) =
        match provider.run_wsl_lenient(&["--list", "--verbose"]).await {
            Ok(raw) => {
                let count = WslProvider::parse_list_verbose(&raw).len();
                (
                    WslRuntimeStageDto {
                        ready: true,
                        reason_code: "ok".to_string(),
                        detail: Some(format!("Detected {} installed distribution(s).", count)),
                    },
                    true,
                    count,
                )
            }
            Err(err) => (
                WslRuntimeStageDto {
                    ready: false,
                    reason_code: "distro_probe_failed".to_string(),
                    detail: Some(normalize_wsl_error(err.to_string())),
                },
                false,
                0,
            ),
        };

    let (state, reason_code, degraded_reasons, reason) = evaluate_runtime_state(
        true,
        status_ready,
        capability_ready,
        distro_ready,
        distro_count,
        &runtime.reason,
    );

    Ok(WslRuntimeSnapshotDto {
        state,
        available: true,
        reason_code,
        reason,
        runtime_probes,
        status_probe,
        capability_probe,
        distro_probe,
        distro_count,
        degraded_reasons,
    })
}

/// Terminate a specific WSL distribution
#[tauri::command]
pub async fn wsl_terminate(name: String) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.terminate").await?;
    ensure_distro_exists(&provider, "distro.terminate", &name).await?;
    provider
        .terminate_distro(&name)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Shutdown all running WSL instances
#[tauri::command]
pub async fn wsl_shutdown() -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "runtime.shutdown").await?;
    provider
        .shutdown_all()
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Set the default WSL distribution
#[tauri::command]
pub async fn wsl_set_default(name: String) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.setDefault").await?;
    ensure_distro_exists(&provider, "distro.setDefault", &name).await?;
    provider
        .set_default_distro(&name)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Set WSL version (1 or 2) for a distribution
#[tauri::command]
pub async fn wsl_set_version(name: String, version: u8) -> Result<(), String> {
    if version != 1 && version != 2 {
        return Err("WSL version must be 1 or 2".into());
    }
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.setVersion").await?;
    ensure_distro_exists(&provider, "distro.setVersion", &name).await?;
    provider
        .set_distro_version(&name, version)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Set the default WSL version for new installations
#[tauri::command]
pub async fn wsl_set_default_version(version: u8) -> Result<(), String> {
    if version != 1 && version != 2 {
        return Err("WSL version must be 1 or 2".into());
    }
    let provider = get_provider();
    ensure_runtime_available(&provider, "runtime.setDefaultVersion").await?;
    provider
        .set_default_version(version)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Move a WSL distribution's disk to a new location.
#[tauri::command]
pub async fn wsl_move_distro(name: String, location: String) -> Result<String, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.move").await?;
    ensure_distro_exists(&provider, "distro.move", &name).await?;
    provider
        .move_distro(&name, &location)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Resize a WSL distribution's disk.
#[tauri::command]
pub async fn wsl_resize_distro(name: String, size: String) -> Result<String, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.resize").await?;
    ensure_distro_exists(&provider, "distro.resize", &name).await?;
    provider
        .resize_distro(&name, &size)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Export a WSL distribution to a file (tar or vhdx)
#[tauri::command]
pub async fn wsl_export(
    name: String,
    file_path: String,
    as_vhd: Option<bool>,
) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.export").await?;
    ensure_distro_exists(&provider, "distro.export", &name).await?;
    provider
        .export_distro(&name, &file_path, as_vhd.unwrap_or(false))
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Import a WSL distribution from a file
#[tauri::command]
pub async fn wsl_import(options: WslImportOptions) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.import").await?;
    provider
        .import_distro(
            &options.name,
            &options.install_location,
            &options.file_path,
            options.wsl_version,
            options.as_vhd,
        )
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Update the WSL kernel
#[tauri::command]
pub async fn wsl_update() -> Result<String, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "runtime.update").await?;
    provider
        .update_wsl()
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Launch/start a WSL distribution
#[tauri::command]
pub async fn wsl_launch(name: String, user: Option<String>) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.launch").await?;
    ensure_distro_exists(&provider, "distro.launch", &name).await?;
    provider
        .launch_distro(&name, user.as_deref())
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// List currently running WSL distributions
#[tauri::command]
pub async fn wsl_list_running() -> Result<Vec<String>, String> {
    let provider = get_provider();
    provider
        .list_running()
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Check if WSL is available on this system
#[tauri::command]
pub async fn wsl_is_available() -> Result<bool, String> {
    use crate::provider::traits::Provider;
    let provider = get_provider();
    Ok(provider.is_available().await)
}

/// Execute a command inside a WSL distribution
#[tauri::command]
pub async fn wsl_exec(
    distro: String,
    command: String,
    user: Option<String>,
) -> Result<WslExecResult, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.exec").await?;
    ensure_distro_exists(&provider, "distro.exec", &distro).await?;
    let (stdout, stderr, exit_code) = provider
        .exec_command(&distro, &command, user.as_deref())
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))?;
    Ok(WslExecResult {
        stdout,
        stderr,
        exit_code,
    })
}

/// Convert a path between Windows and WSL formats
#[tauri::command]
pub async fn wsl_convert_path(
    path: String,
    distro: Option<String>,
    to_windows: bool,
) -> Result<String, String> {
    let provider = get_provider();
    provider
        .convert_path(&path, distro.as_deref(), to_windows)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Read the global .wslconfig file
#[tauri::command]
pub async fn wsl_get_config() -> Result<HashMap<String, HashMap<String, String>>, String> {
    WslProvider::read_wslconfig().map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Write a setting to the global .wslconfig file
#[tauri::command]
pub async fn wsl_set_config(
    section: String,
    key: String,
    value: Option<String>,
) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "runtime.setConfig").await?;
    if let Some(val) = value {
        WslProvider::write_wslconfig(&section, &key, &val)
            .map_err(|e| normalize_wsl_error(e.to_string()))
    } else {
        WslProvider::remove_wslconfig_key(&section, &key)
            .map(|_| ())
            .map_err(|e| normalize_wsl_error(e.to_string()))
    }
}

/// Get disk usage for a WSL distribution
#[tauri::command]
pub async fn wsl_disk_usage(name: String) -> Result<WslDiskUsage, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.diskUsage").await?;
    ensure_distro_exists(&provider, "distro.diskUsage", &name).await?;
    let (total_bytes, used_bytes) = provider
        .get_disk_usage(&name)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))?;
    Ok(WslDiskUsage {
        total_bytes,
        used_bytes,
        filesystem_path: WslProvider::get_distro_filesystem_path(&name),
    })
}

/// Options for WSL mount operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslMountOptions {
    pub disk_path: String,
    pub is_vhd: bool,
    pub fs_type: Option<String>,
    pub partition: Option<u32>,
    pub mount_name: Option<String>,
    pub mount_options: Option<String>,
    pub bare: bool,
}

/// Import a distribution in-place from an existing .vhdx file
#[tauri::command]
pub async fn wsl_import_in_place(name: String, vhdx_path: String) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "runtime.importInPlace").await?;
    ensure_wsl_capability(&provider, "runtime.importInPlace", |caps| {
        caps.import_in_place
    })
    .await?;
    provider
        .import_distro_in_place(&name, &vhdx_path)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Mount a physical or virtual disk in WSL2
#[tauri::command]
pub async fn wsl_mount(options: WslMountOptions) -> Result<String, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "runtime.mount").await?;
    if options.mount_options.is_some() {
        ensure_wsl_capability(&provider, "runtime.mountWithOptions", |caps| {
            caps.mount_options
        })
        .await?;
    }
    provider
        .mount_disk(
            &options.disk_path,
            options.is_vhd,
            options.fs_type.as_deref(),
            options.partition,
            options.mount_name.as_deref(),
            options.mount_options.as_deref(),
            options.bare,
        )
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Unmount a previously mounted disk (or all if no path given)
#[tauri::command]
pub async fn wsl_unmount(disk_path: Option<String>) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "runtime.unmount").await?;
    provider
        .unmount_disk(disk_path.as_deref())
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Get the IP address of a WSL distribution
#[tauri::command]
pub async fn wsl_get_ip(distro: Option<String>) -> Result<String, String> {
    let provider = get_provider();
    provider
        .get_ip_address(distro.as_deref())
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Change the default user for a distribution
#[tauri::command]
pub async fn wsl_change_default_user(distro: String, username: String) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.changeDefaultUser").await?;
    ensure_distro_exists(&provider, "distro.changeDefaultUser", &distro).await?;
    provider
        .change_default_user(&distro, &username)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Read the per-distro /etc/wsl.conf file
#[tauri::command]
pub async fn wsl_get_distro_config(
    distro: String,
) -> Result<HashMap<String, HashMap<String, String>>, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.getConfig").await?;
    ensure_distro_exists(&provider, "distro.getConfig", &distro).await?;
    provider
        .read_distro_config(&distro)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Set sparse VHD mode for a WSL distribution
#[tauri::command]
pub async fn wsl_set_sparse(distro: String, enabled: bool) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.setSparse").await?;
    ensure_wsl_capability(&provider, "distro.setSparse", |caps| caps.set_sparse).await?;
    provider
        .set_sparse_vhd(&distro, enabled)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Install WSL engine only, without a default distribution
#[tauri::command]
pub async fn wsl_install_wsl_only() -> Result<String, String> {
    let provider = get_provider();
    provider
        .install_wsl_only()
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Install a distribution to a custom location
#[tauri::command]
pub async fn wsl_install_with_location(name: String, location: String) -> Result<String, String> {
    let provider = get_provider();
    provider
        .install_with_location(&name, &location)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Write a setting to the per-distro /etc/wsl.conf file
#[tauri::command]
pub async fn wsl_set_distro_config(
    distro: String,
    section: String,
    key: String,
    value: Option<String>,
) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.setConfig").await?;
    ensure_distro_exists(&provider, "distro.setConfig", &distro).await?;
    if let Some(val) = value {
        provider
            .write_distro_config(&distro, &section, &key, &val)
            .await
            .map_err(|e| normalize_wsl_error(e.to_string()))
    } else {
        provider
            .remove_distro_config_key(&distro, &section, &key)
            .await
            .map(|_| ())
            .map_err(|e| normalize_wsl_error(e.to_string()))
    }
}

/// Detect the environment inside a WSL distribution.
///
/// Parses `/etc/os-release`, detects the package manager, architecture,
/// kernel version, init system, default shell/user, hostname, uptime,
/// and installed package count.
///
/// The distro must be running or startable (will be launched if stopped).
#[tauri::command]
pub async fn wsl_detect_distro_env(
    distro: String,
) -> Result<crate::provider::wsl::WslDistroEnvironment, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.detectEnvironment").await?;
    ensure_distro_exists(&provider, "distro.detectEnvironment", &distro).await?;
    provider
        .detect_distro_environment(&distro)
        .await
        .map_err(|e| {
            runtime_precondition_error(
                "distro.detectEnvironment",
                &format!(
                    "{} Retry by launching the target distribution and running detection again.",
                    normalize_wsl_error(e.to_string())
                ),
            )
        })
}

/// Get live resource usage (memory, swap, CPU, load) from a running WSL distribution.
#[tauri::command]
pub async fn wsl_get_distro_resources(distro: String) -> Result<WslDistroResources, String> {
    let provider = get_provider();
    provider
        .get_distro_resources(&distro)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// List non-system users in a WSL distribution.
#[tauri::command]
pub async fn wsl_list_users(distro: String) -> Result<Vec<WslUser>, String> {
    let provider = get_provider();
    provider
        .list_users(&distro)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Update or upgrade packages in a WSL distribution.
///
/// `mode` should be `"update"` (refresh package index) or `"upgrade"` (install upgrades).
/// Automatically detects the distribution's package manager.
#[tauri::command]
pub async fn wsl_update_distro_packages(
    distro: String,
    mode: String,
) -> Result<WslPackageUpdateResult, String> {
    let provider = get_provider();
    provider
        .update_distro_packages(&distro, &mode)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Open a WSL distribution's filesystem in Windows Explorer.
/// Uses the \\wsl.localhost\<distro> UNC path.
#[tauri::command]
pub async fn wsl_open_in_explorer(name: String) -> Result<(), String> {
    let path = WslProvider::get_distro_filesystem_path(&name);
    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|e| format!("Failed to open in Explorer: {}", e))
}

/// Open a WSL distribution in Windows Terminal or fall back to cmd.
/// Tries `wt.exe -d <path>` first, then `cmd /c start wsl -d <name>`.
#[tauri::command]
pub async fn wsl_open_in_terminal(name: String) -> Result<(), String> {
    use crate::platform::process;

    let wsl_path = WslProvider::get_distro_filesystem_path(&name);

    // Try Windows Terminal first
    if process::which("wt.exe").await.is_some() {
        let result = process::execute(
            "wt.exe",
            &["-d", &wsl_path],
            Some(
                crate::platform::process::ProcessOptions::new()
                    .with_timeout(std::time::Duration::from_secs(10)),
            ),
        )
        .await;
        if result.is_ok() {
            return Ok(());
        }
    }

    // Fallback: launch wsl.exe -d <name> directly via opener
    tauri_plugin_opener::open_path(&format!("wsl.exe -d {}", name), None::<&str>)
        .map_err(|_| {
            // Last resort: use cmd /c start
            std::process::Command::new("cmd")
                .args(["/c", "start", "wsl.exe", "-d", &name])
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Failed to open terminal: {}", e))
        })
        .or_else(|r| r)
}

/// Get total disk usage across all WSL distributions.
/// Returns (total_bytes, per-distro breakdown).
#[tauri::command]
pub async fn wsl_total_disk_usage() -> Result<(u64, Vec<(String, u64)>), String> {
    WslProvider::get_total_disk_usage().map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Clone a WSL distribution by exporting to a temp tar and re-importing under a new name.
#[tauri::command]
pub async fn wsl_clone_distro(
    name: String,
    new_name: String,
    location: String,
) -> Result<String, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.clone").await?;
    ensure_distro_exists(&provider, "distro.clone", &name).await?;
    provider
        .clone_distro(&name, &new_name, &location)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Launch multiple WSL distributions in parallel.
#[tauri::command]
pub async fn wsl_batch_launch(names: Vec<String>) -> Result<Vec<(String, bool, String)>, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.batchLaunch").await?;
    Ok(provider.batch_launch(&names).await)
}

/// Terminate multiple WSL distributions in parallel.
#[tauri::command]
pub async fn wsl_batch_terminate(
    names: Vec<String>,
) -> Result<Vec<(String, bool, String)>, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.batchTerminate").await?;
    Ok(provider.batch_terminate(&names).await)
}

/// Backup a WSL distribution to a timestamped tar file.
#[tauri::command]
pub async fn wsl_backup_distro(
    name: String,
    dest_dir: String,
) -> Result<crate::provider::wsl::WslBackupEntry, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.backup").await?;
    ensure_distro_exists(&provider, "distro.backup", &name).await?;
    provider
        .backup_distro(&name, &dest_dir)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// List WSL backup files in a directory.
#[tauri::command]
pub async fn wsl_list_backups(
    backup_dir: String,
) -> Result<Vec<crate::provider::wsl::WslBackupEntry>, String> {
    Ok(crate::provider::wsl::WslProvider::list_backups(&backup_dir))
}

/// Restore a WSL distribution from a backup file.
#[tauri::command]
pub async fn wsl_restore_backup(
    backup_path: String,
    name: String,
    install_location: String,
) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.restoreBackup").await?;
    provider
        .restore_backup(&backup_path, &name, &install_location)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Delete a WSL backup file.
#[tauri::command]
pub async fn wsl_delete_backup(backup_path: String) -> Result<(), String> {
    crate::provider::wsl::WslProvider::delete_backup(&backup_path)
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Run a health check on a WSL distribution.
#[tauri::command]
pub async fn wsl_distro_health_check(
    distro: String,
) -> Result<crate::provider::wsl::WslDistroHealthResult, String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "distro.healthCheck").await?;
    provider
        .distro_health_check(&distro)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// List all Windows port forwarding rules (netsh interface portproxy).
#[tauri::command]
pub async fn wsl_list_port_forwards() -> Result<Vec<crate::provider::wsl::PortForwardRule>, String>
{
    let provider = get_provider();
    ensure_runtime_available(&provider, "network.portForward").await?;
    provider
        .list_port_forwards()
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Add a port forwarding rule (netsh interface portproxy add v4tov4).
/// Requires administrator privileges.
#[tauri::command]
pub async fn wsl_add_port_forward(
    listen_port: u16,
    connect_port: u16,
    connect_address: String,
) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "network.portForward").await?;
    provider
        .add_port_forward(listen_port, connect_port, &connect_address)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

/// Remove a port forwarding rule (netsh interface portproxy delete v4tov4).
/// Requires administrator privileges.
#[tauri::command]
pub async fn wsl_remove_port_forward(listen_port: u16) -> Result<(), String> {
    let provider = get_provider();
    ensure_runtime_available(&provider, "network.portForward").await?;
    provider
        .remove_port_forward(listen_port)
        .await
        .map_err(|e| normalize_wsl_error(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::{
        classify_wsl_error_category, evaluate_runtime_state, normalize_wsl_error,
        runtime_precondition_error, unsupported_feature_error,
    };

    #[test]
    fn classify_error_category_detects_unsupported() {
        assert_eq!(
            classify_wsl_error_category("[WSL_UNSUPPORTED:runtime.mount] not supported"),
            "unsupported"
        );
    }

    #[test]
    fn classify_error_category_detects_permission() {
        assert_eq!(
            classify_wsl_error_category("Access is denied"),
            "permission"
        );
    }

    #[test]
    fn classify_error_category_detects_runtime_precondition() {
        assert_eq!(
            classify_wsl_error_category("[WSL_RUNTIME:distro.launch] runtime unavailable"),
            "runtime"
        );
    }

    #[test]
    fn normalize_wsl_error_prefixes_category() {
        let normalized = normalize_wsl_error("Some runtime timeout".to_string());
        assert!(normalized.starts_with("[WSL_RUNTIME]"));
    }

    #[test]
    fn unsupported_feature_error_contains_feature_id() {
        let message = unsupported_feature_error("runtime.importInPlace", Some("2.4.0"));
        assert!(message.contains("[WSL_UNSUPPORTED:runtime.importInPlace]"));
        assert!(message.contains("WSL 2.4.0"));
    }

    #[test]
    fn runtime_precondition_error_contains_feature_id() {
        let message = runtime_precondition_error(
            "distro.detectEnvironment",
            "Distribution is unavailable.",
        );
        assert!(message.contains("[WSL_RUNTIME:distro.detectEnvironment]"));
    }

    #[test]
    fn evaluate_runtime_state_reports_unavailable() {
        let (state, reason_code, degraded_reasons, _) = evaluate_runtime_state(
            false,
            false,
            false,
            false,
            0,
            "runtime unavailable",
        );
        assert_eq!(state, "unavailable");
        assert_eq!(reason_code, "runtime_unavailable");
        assert_eq!(degraded_reasons.len(), 1);
    }

    #[test]
    fn evaluate_runtime_state_reports_empty() {
        let (state, reason_code, degraded_reasons, _) =
            evaluate_runtime_state(true, true, true, true, 0, "");
        assert_eq!(state, "empty");
        assert_eq!(reason_code, "runtime_empty");
        assert!(degraded_reasons.is_empty());
    }

    #[test]
    fn evaluate_runtime_state_reports_degraded() {
        let (state, reason_code, degraded_reasons, reason) =
            evaluate_runtime_state(true, false, true, true, 1, "");
        assert_eq!(state, "degraded");
        assert_eq!(reason_code, "runtime_degraded");
        assert!(degraded_reasons.iter().any(|r| r.contains("status data")));
        assert!(reason.contains("status data"));
    }

    #[test]
    fn evaluate_runtime_state_reports_ready() {
        let (state, reason_code, degraded_reasons, _) =
            evaluate_runtime_state(true, true, true, true, 1, "");
        assert_eq!(state, "ready");
        assert_eq!(reason_code, "runtime_ready");
        assert!(degraded_reasons.is_empty());
    }
}
