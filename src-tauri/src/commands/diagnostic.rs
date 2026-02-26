use crate::commands::config::SharedSettings;
use crate::platform::fs as platform_fs;
use chrono::Local;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use sysinfo::System;
use tauri::{AppHandle, Manager, State};
use zip::write::FileOptions;
use zip::CompressionMethod;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticExportOptions {
    /// Where to write the .zip file. If None, uses default export path.
    pub output_path: Option<String>,
    /// Whether to include the sanitised config snapshot.
    pub include_config: Option<bool>,
    /// Optional error context to embed in the report.
    pub error_context: Option<ErrorContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticCaptureFrontendCrashOptions {
    /// Whether to include the sanitised config snapshot.
    pub include_config: Option<bool>,
    /// Error context captured from frontend runtime.
    pub error_context: ErrorContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorContext {
    pub message: Option<String>,
    pub stack: Option<String>,
    pub component: Option<String>,
    pub timestamp: Option<String>,
    pub extra: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticExportResult {
    pub path: String,
    pub size: u64,
    pub file_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashInfo {
    pub report_path: String,
    pub timestamp: String,
    pub message: Option<String>,
}

const CRASH_REPORTS_KEEP_COUNT: usize = 20;

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Export a full diagnostic ZIP bundle to disk.
#[tauri::command]
pub async fn diagnostic_export_bundle(
    app: AppHandle,
    options: DiagnosticExportOptions,
    settings: State<'_, SharedSettings>,
) -> Result<DiagnosticExportResult, String> {
    let output_path = match options.output_path {
        Some(ref p) if !p.is_empty() => PathBuf::from(p),
        _ => {
            let default = get_default_export_path();
            let ts = Local::now().format("%Y-%m-%dT%H-%M-%S");
            default.join(format!("cognia-diagnostic-{ts}.zip"))
        }
    };

    // Ensure parent directory exists
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {e}"))?;
    }

    // Collect log directory from Tauri
    let log_dir = app.path().app_log_dir().ok().filter(|p| p.exists());

    // Collect config snapshot
    let config_toml = if options.include_config.unwrap_or(true) {
        let s = settings.read().await;
        sanitize_config_toml(&s)
    } else {
        None
    };

    let result = tokio::task::spawn_blocking(move || {
        build_zip_bundle(
            &output_path,
            log_dir.as_deref(),
            config_toml.as_deref(),
            options.error_context.as_ref(),
        )
    })
    .await
    .map_err(|e| format!("Zip task panicked: {e}"))?
    .map_err(|e| format!("Failed to create diagnostic bundle: {e}"))?;

    info!(
        "Diagnostic bundle exported to {} ({} files, {} bytes)",
        result.path, result.file_count, result.size
    );

    Ok(result)
}

/// Return the default directory for diagnostic exports.
#[tauri::command]
pub fn diagnostic_get_default_export_path() -> Result<String, String> {
    Ok(get_default_export_path().to_string_lossy().to_string())
}

/// Check if there is a crash report from a previous session.
#[tauri::command]
pub fn diagnostic_check_last_crash() -> Result<Option<CrashInfo>, String> {
    let marker = get_crash_marker_path();
    if !marker.exists() {
        return Ok(None);
    }

    let content =
        fs::read_to_string(&marker).map_err(|e| format!("Failed to read crash marker: {e}"))?;

    // Format: line 1 = report path, line 2 = timestamp, line 3+ = message
    let mut lines = content.lines();
    let report_path = lines.next().unwrap_or("").to_string();
    let timestamp = lines.next().unwrap_or("").to_string();
    let message: String = lines.collect::<Vec<_>>().join("\n");
    let message = if message.is_empty() {
        None
    } else {
        Some(message)
    };

    // Only return info if the report file actually exists
    if !report_path.is_empty() && Path::new(&report_path).exists() {
        Ok(Some(CrashInfo {
            report_path,
            timestamp,
            message,
        }))
    } else {
        // Stale marker, clean it up
        let _ = fs::remove_file(&marker);
        Ok(None)
    }
}

/// Dismiss the crash notification (deletes the marker file).
#[tauri::command]
pub fn diagnostic_dismiss_crash() -> Result<(), String> {
    let marker = get_crash_marker_path();
    if marker.exists() {
        fs::remove_file(&marker).map_err(|e| format!("Failed to dismiss crash marker: {e}"))?;
    }
    Ok(())
}

/// Capture a frontend crash and persist a diagnostic ZIP under crash-reports.
#[tauri::command]
pub async fn diagnostic_capture_frontend_crash(
    app: AppHandle,
    options: DiagnosticCaptureFrontendCrashOptions,
    settings: State<'_, SharedSettings>,
) -> Result<CrashInfo, String> {
    let file_timestamp = Local::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let marker_timestamp = options
        .error_context
        .timestamp
        .clone()
        .unwrap_or_else(|| Local::now().to_rfc3339());
    let marker_message = options
        .error_context
        .message
        .clone()
        .unwrap_or_else(|| "Frontend runtime crash".to_string());

    let crash_dir = get_crash_reports_dir();
    fs::create_dir_all(&crash_dir)
        .map_err(|e| format!("Failed to create crash-reports dir: {e}"))?;
    let output_path = crash_dir.join(format!("frontend-crash-{file_timestamp}.zip"));

    let log_dir = app.path().app_log_dir().ok().filter(|p| p.exists());

    let config_toml = if options.include_config.unwrap_or(true) {
        let s = settings.read().await;
        sanitize_config_toml(&s)
    } else {
        None
    };

    let error_ctx = options.error_context;
    let output_path_for_task = output_path.clone();

    tokio::task::spawn_blocking(move || {
        build_zip_bundle(
            &output_path_for_task,
            log_dir.as_deref(),
            config_toml.as_deref(),
            Some(&error_ctx),
        )
    })
    .await
    .map_err(|e| format!("Crash zip task panicked: {e}"))?
    .map_err(|e| format!("Failed to create frontend crash bundle: {e}"))?;

    write_crash_marker(&output_path, &marker_timestamp, &marker_message)?;
    if let Err(e) = cleanup_old_crash_reports(CRASH_REPORTS_KEEP_COUNT) {
        warn!("Failed to cleanup old crash reports: {e}");
    }

    info!(
        "Frontend crash diagnostics captured at {}",
        output_path.display()
    );

    Ok(CrashInfo {
        report_path: output_path.to_string_lossy().to_string(),
        timestamp: marker_timestamp,
        message: Some(marker_message),
    })
}

// ---------------------------------------------------------------------------
// Panic hook — called from lib.rs at startup
// ---------------------------------------------------------------------------

/// Install a panic hook that generates a crash report ZIP before aborting.
/// Must be called before the Tauri app starts.
pub fn install_panic_hook() {
    let default_hook = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |info| {
        // Collect panic information
        let message = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic".to_string()
        };

        let location = info
            .location()
            .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
            .unwrap_or_else(|| "unknown location".to_string());

        let backtrace = std::backtrace::Backtrace::force_capture().to_string();

        let timestamp = Local::now().format("%Y-%m-%dT%H-%M-%S").to_string();

        eprintln!("=== CogniaLauncher PANIC ===");
        eprintln!("Message: {message}");
        eprintln!("Location: {location}");
        eprintln!("Generating crash report...");

        // Build error context for the crash report
        let error_ctx = ErrorContext {
            message: Some(format!("PANIC: {message}")),
            stack: Some(format!("Location: {location}\n\nBacktrace:\n{backtrace}")),
            component: Some("rust-runtime".to_string()),
            timestamp: Some(Local::now().to_rfc3339()),
            extra: None,
        };

        // Generate crash report synchronously (tokio may be dead)
        match generate_crash_report_sync(&error_ctx, &timestamp) {
            Ok(report_path) => {
                eprintln!("Crash report saved to: {}", report_path.display());

                // Write marker file so next launch can detect the crash
                if let Err(e) = write_crash_marker(&report_path, &timestamp, &message) {
                    eprintln!("Failed to write crash marker: {e}");
                }
            }
            Err(e) => {
                eprintln!("Failed to generate crash report: {e}");
            }
        }

        eprintln!("=== END PANIC REPORT ===");

        // Call the default hook (prints the panic message)
        default_hook(info);
    }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn get_default_export_path() -> PathBuf {
    // Try Desktop, then Downloads, then home
    if let Some(user_dirs) = directories::UserDirs::new() {
        if let Some(desktop) = user_dirs.desktop_dir() {
            return desktop.to_path_buf();
        }
        if let Some(downloads) = user_dirs.download_dir() {
            return downloads.to_path_buf();
        }
        return user_dirs.home_dir().to_path_buf();
    }
    PathBuf::from(".")
}

fn get_crash_reports_dir() -> PathBuf {
    platform_fs::get_cognia_dir()
        .unwrap_or_else(|| PathBuf::from(".CogniaLauncher"))
        .join("crash-reports")
}

fn get_crash_marker_path() -> PathBuf {
    platform_fs::get_cognia_dir()
        .unwrap_or_else(|| PathBuf::from(".CogniaLauncher"))
        .join("last-crash.txt")
}

/// Build the diagnostic ZIP bundle (runs on a blocking thread).
fn build_zip_bundle(
    output_path: &Path,
    log_dir: Option<&Path>,
    config_toml: Option<&str>,
    error_context: Option<&ErrorContext>,
) -> Result<DiagnosticExportResult, String> {
    let file =
        fs::File::create(output_path).map_err(|e| format!("Failed to create zip file: {e}"))?;

    let mut zip = zip::ZipWriter::new(file);
    let options: FileOptions<'_, ()> = FileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    let mut file_count: u32 = 0;

    // 1. system-info.json
    let sys_info = collect_system_info_json();
    zip.start_file("system-info.json", options)
        .map_err(|e| format!("zip error: {e}"))?;
    zip.write_all(sys_info.as_bytes())
        .map_err(|e| format!("zip write error: {e}"))?;
    file_count += 1;

    // 2. config.toml (sanitized)
    if let Some(config) = config_toml {
        zip.start_file("config.toml", options)
            .map_err(|e| format!("zip error: {e}"))?;
        zip.write_all(config.as_bytes())
            .map_err(|e| format!("zip write error: {e}"))?;
        file_count += 1;
    }

    // 3. error-context.json (if provided)
    if let Some(ctx) = error_context {
        let json = serde_json::to_string_pretty(ctx).unwrap_or_else(|_| "{}".to_string());
        zip.start_file("error-context.json", options)
            .map_err(|e| format!("zip error: {e}"))?;
        zip.write_all(json.as_bytes())
            .map_err(|e| format!("zip write error: {e}"))?;
        file_count += 1;
    }

    // 4. environment.json (safe subset of env vars)
    let env_json = collect_safe_environment_json();
    zip.start_file("environment.json", options)
        .map_err(|e| format!("zip error: {e}"))?;
    zip.write_all(env_json.as_bytes())
        .map_err(|e| format!("zip write error: {e}"))?;
    file_count += 1;

    // 5. logs/ directory
    if let Some(log_dir) = log_dir {
        if log_dir.exists() {
            if let Ok(entries) = fs::read_dir(log_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            let zip_path = format!("logs/{name}");
                            zip.start_file(&zip_path, options)
                                .map_err(|e| format!("zip error: {e}"))?;
                            let mut f = fs::File::open(&path)
                                .map_err(|e| format!("Failed to read log {name}: {e}"))?;
                            let mut buf = Vec::new();
                            f.read_to_end(&mut buf)
                                .map_err(|e| format!("Failed to read log {name}: {e}"))?;
                            zip.write_all(&buf)
                                .map_err(|e| format!("zip write error: {e}"))?;
                            file_count += 1;
                        }
                    }
                }
            }
        }
    }

    zip.finish().map_err(|e| format!("zip finish error: {e}"))?;

    let metadata = fs::metadata(output_path).map_err(|e| format!("Failed to stat output: {e}"))?;

    Ok(DiagnosticExportResult {
        path: output_path.to_string_lossy().to_string(),
        size: metadata.len(),
        file_count,
    })
}

/// Synchronous crash report generator for use in the panic hook.
fn generate_crash_report_sync(
    error_ctx: &ErrorContext,
    timestamp: &str,
) -> Result<PathBuf, String> {
    let crash_dir = get_crash_reports_dir();
    fs::create_dir_all(&crash_dir)
        .map_err(|e| format!("Failed to create crash-reports dir: {e}"))?;

    let output_path = crash_dir.join(format!("crash-{timestamp}.zip"));

    // Find the log directory — use the Tauri convention under AppData
    let log_dir = find_log_dir_sync();

    // We cannot read Settings from Tauri state in a panic hook, so skip config
    build_zip_bundle(
        &output_path,
        log_dir.as_deref(),
        None, // no config in crash reports
        Some(error_ctx),
    )?;

    if let Err(e) = cleanup_old_crash_reports(CRASH_REPORTS_KEEP_COUNT) {
        eprintln!("Failed to cleanup old crash reports: {e}");
    }

    Ok(output_path)
}

/// Best-effort attempt to find the log directory without Tauri's AppHandle.
fn find_log_dir_sync() -> Option<PathBuf> {
    collect_log_dir_candidates()
        .into_iter()
        .find(|path| path.exists())
}

fn collect_log_dir_candidates() -> Vec<PathBuf> {
    let identifier = "com.cognia.launcher";
    let mut candidates = Vec::<PathBuf>::new();

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join("Library/Logs").join(identifier));
        }
        // legacy fallback
        if let Some(local_data) = dirs::data_local_dir() {
            candidates.push(local_data.join(identifier).join("logs"));
        }
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        // Tauri v2 canonical path
        if let Some(local_data) = dirs::data_local_dir() {
            candidates.push(local_data.join(identifier).join("logs"));
        }

        // legacy fallback path
        if let Some(config_dir) = dirs::config_dir() {
            candidates.push(config_dir.join(identifier).join("logs"));
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(appdata) = std::env::var("APPDATA") {
                candidates.push(PathBuf::from(appdata).join(identifier).join("logs"));
            }
        }
    }

    dedup_paths_preserve_order(candidates)
}

fn dedup_paths_preserve_order(candidates: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::<PathBuf>::new();
    let mut deduped = Vec::new();

    for candidate in candidates {
        if seen.insert(candidate.clone()) {
            deduped.push(candidate);
        }
    }

    deduped
}

fn write_crash_marker(report_path: &Path, timestamp: &str, message: &str) -> Result<(), String> {
    let marker_path = get_crash_marker_path();
    if let Some(parent) = marker_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
    }
    let content = format!("{}\n{}\n{}", report_path.display(), timestamp, message);
    fs::write(&marker_path, content).map_err(|e| format!("write: {e}"))?;
    Ok(())
}

fn cleanup_old_crash_reports(keep_count: usize) -> Result<(), String> {
    cleanup_old_crash_reports_in_dir(&get_crash_reports_dir(), keep_count)
}

fn cleanup_old_crash_reports_in_dir(dir: &Path, keep_count: usize) -> Result<(), String> {
    if keep_count == 0 || !dir.exists() {
        return Ok(());
    }

    let mut reports: Vec<(PathBuf, SystemTime, String)> = Vec::new();
    let entries =
        fs::read_dir(dir).map_err(|e| format!("Failed to read crash-reports dir: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.ends_with(".zip") {
            continue;
        }
        if !(name.starts_with("crash-") || name.starts_with("frontend-crash-")) {
            continue;
        }
        let name = name.to_string();

        let modified = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        reports.push((path, modified, name));
    }

    if reports.len() <= keep_count {
        return Ok(());
    }

    // Newest first by modified time, then by filename for deterministic ordering.
    reports.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.2.cmp(&a.2)));

    for (path, _, _) in reports.into_iter().skip(keep_count) {
        if let Err(e) = fs::remove_file(&path) {
            return Err(format!(
                "Failed to delete old crash report {}: {e}",
                path.display()
            ));
        }
    }

    Ok(())
}

/// Collect system information as a pretty-printed JSON string.
fn collect_system_info_json() -> String {
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let os_version = System::os_version().unwrap_or_default();
    let os_long = System::long_os_version().unwrap_or_default();
    let kernel = System::kernel_version().unwrap_or_default();
    let hostname = System::host_name().unwrap_or_default();
    let os_name = System::name().unwrap_or_default();
    let cpu_arch = System::cpu_arch();
    let uptime = System::uptime();

    let cpu_model = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_default();
    let cpu_cores = sys.cpus().len();
    let physical_cores = sys.physical_core_count().unwrap_or(0);
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let total_swap = sys.total_swap();
    let used_swap = sys.used_swap();

    let info = serde_json::json!({
        "generated": Local::now().to_rfc3339(),
        "app_version": env!("CARGO_PKG_VERSION"),
        "os": {
            "name": os_name,
            "version": os_version,
            "long_version": os_long,
            "kernel": kernel,
            "arch": cpu_arch,
            "hostname": hostname,
        },
        "cpu": {
            "model": cpu_model,
            "logical_cores": cpu_cores,
            "physical_cores": physical_cores,
        },
        "memory": {
            "total_bytes": total_memory,
            "used_bytes": used_memory,
            "total_human": format_bytes(total_memory),
            "used_human": format_bytes(used_memory),
        },
        "swap": {
            "total_bytes": total_swap,
            "used_bytes": used_swap,
            "total_human": format_bytes(total_swap),
            "used_human": format_bytes(used_swap),
        },
        "uptime_seconds": uptime,
    });

    serde_json::to_string_pretty(&info).unwrap_or_else(|_| "{}".to_string())
}

/// Collect a safe subset of environment variables.
fn collect_safe_environment_json() -> String {
    let safe_keys = [
        "PATH",
        "SHELL",
        "TERM",
        "LANG",
        "LC_ALL",
        "HOME",
        "USERPROFILE",
        "COMPUTERNAME",
        "USERNAME",
        "LOGNAME",
        "XDG_DATA_HOME",
        "XDG_CONFIG_HOME",
        "XDG_CACHE_HOME",
        "RUST_BACKTRACE",
        "RUST_LOG",
        "NODE_ENV",
        "JAVA_HOME",
        "GOPATH",
        "GOROOT",
        "CARGO_HOME",
        "RUSTUP_HOME",
        "CONDA_PREFIX",
        "VIRTUAL_ENV",
        "SDKMAN_DIR",
        "NVM_DIR",
        "VCPKG_ROOT",
        "TAURI_ENV_DEBUG",
    ];

    let mut map = serde_json::Map::new();
    for key in &safe_keys {
        if let Ok(val) = std::env::var(key) {
            map.insert(key.to_string(), serde_json::Value::String(val));
        }
    }

    serde_json::to_string_pretty(&serde_json::Value::Object(map))
        .unwrap_or_else(|_| "{}".to_string())
}

/// Sanitize a Settings snapshot for export — redact tokens and secrets.
fn sanitize_config_toml(settings: &crate::config::Settings) -> Option<String> {
    // Clone + redact
    let mut s = settings.clone();

    // Redact provider tokens
    for (_name, ps) in s.providers.iter_mut() {
        if let Some(token) = ps.extra.get_mut("token") {
            if let Some(t) = token.as_str() {
                if !t.is_empty() {
                    *token = toml::Value::String("***REDACTED***".into());
                }
            }
        }
    }

    // Redact proxy (may contain credentials)
    if let Some(ref proxy) = s.network.proxy {
        if proxy.contains('@') {
            s.network.proxy = Some("***REDACTED***".into());
        }
    }

    toml::to_string_pretty(&s).ok()
}

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes >= TB {
        format!("{:.1} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{bytes} B")
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use tempfile::tempdir;

    #[test]
    fn test_collect_system_info_json() {
        let json = collect_system_info_json();
        assert!(json.contains("app_version"));
        assert!(json.contains("os"));
        assert!(json.contains("cpu"));
        assert!(json.contains("memory"));
    }

    #[test]
    fn test_collect_safe_environment_json() {
        let json = collect_safe_environment_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.is_object());
    }

    #[test]
    fn test_build_zip_bundle_minimal() {
        let dir = tempdir().unwrap();
        let output = dir.path().join("test-diag.zip");

        let result = build_zip_bundle(&output, None, None, None).unwrap();
        assert_eq!(result.file_count, 2); // system-info.json + environment.json
        assert!(result.size > 0);
        assert!(Path::new(&result.path).exists());
    }

    #[test]
    fn test_build_zip_bundle_with_logs_and_config() {
        let dir = tempdir().unwrap();
        let output = dir.path().join("test-full.zip");

        // Create a fake log directory
        let log_dir = dir.path().join("logs");
        fs::create_dir_all(&log_dir).unwrap();
        fs::write(log_dir.join("app.log"), "test log content").unwrap();
        fs::write(log_dir.join("app.log.1"), "old log").unwrap();

        let config = "[general]\nparallel_downloads = 4\n";
        let ctx = ErrorContext {
            message: Some("test error".into()),
            stack: Some("at main.rs:1".into()),
            component: Some("test".into()),
            timestamp: Some("2026-02-25T00:00:00Z".into()),
            extra: None,
        };

        let result = build_zip_bundle(&output, Some(&log_dir), Some(config), Some(&ctx)).unwrap();

        // system-info + config + error-context + environment + 2 logs = 6
        assert_eq!(result.file_count, 6);
        assert!(result.size > 0);
    }

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(1023), "1023 B");
        assert_eq!(format_bytes(1024), "1.0 KB");
        assert_eq!(format_bytes(1024 * 1024), "1.0 MB");
        assert_eq!(format_bytes(1024 * 1024 * 1024), "1.0 GB");
    }

    #[test]
    fn test_crash_marker_roundtrip() {
        let dir = tempdir().unwrap();
        let marker = dir.path().join("test-marker.txt");
        let report = dir.path().join("crash-report.zip");

        // Write marker manually
        let content = format!("{}\n2026-02-25\ntest panic", report.display());
        fs::write(&marker, content).unwrap();

        // Read it back
        let raw = fs::read_to_string(&marker).unwrap();
        let mut lines = raw.lines();
        assert_eq!(lines.next().unwrap(), report.to_string_lossy());
        assert_eq!(lines.next().unwrap(), "2026-02-25");
        assert_eq!(lines.next().unwrap(), "test panic");
    }

    #[test]
    fn test_sanitize_config_toml() {
        let mut settings = crate::config::Settings::default();
        // Add a fake provider with a token
        let mut ps = crate::config::ProviderSettings::default();
        ps.extra
            .insert("token".into(), toml::Value::String("ghp_secret123".into()));
        settings.providers.insert("github".into(), ps);
        settings.network.proxy = Some("http://user:pass@proxy.example.com".into());

        let result = sanitize_config_toml(&settings).unwrap();
        assert!(result.contains("REDACTED"));
        assert!(!result.contains("ghp_secret123"));
        assert!(!result.contains("user:pass"));
    }

    #[test]
    fn test_cleanup_old_crash_reports_keeps_latest_20() {
        let dir = tempdir().unwrap();

        for i in 0..25 {
            let name = format!("crash-2026-02-25T00-00-{i:02}.zip");
            fs::write(dir.path().join(name), "report").unwrap();
        }
        fs::write(dir.path().join("note.txt"), "keep me").unwrap();

        cleanup_old_crash_reports_in_dir(dir.path(), 20).unwrap();

        let mut zip_names: Vec<String> = fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| {
                path.is_file() && path.extension().and_then(|v| v.to_str()) == Some("zip")
            })
            .filter_map(|path| {
                path.file_name()
                    .and_then(|v| v.to_str())
                    .map(|v| v.to_string())
            })
            .collect();
        zip_names.sort();

        assert_eq!(zip_names.len(), 20);
        assert!(zip_names.contains(&"crash-2026-02-25T00-00-24.zip".to_string()));
        assert!(!zip_names.contains(&"crash-2026-02-25T00-00-00.zip".to_string()));
        assert!(dir.path().join("note.txt").exists());
    }

    #[test]
    fn test_dedup_paths_preserve_order() {
        let candidates = vec![
            PathBuf::from("A"),
            PathBuf::from("B"),
            PathBuf::from("A"),
            PathBuf::from("C"),
            PathBuf::from("B"),
        ];

        let deduped = dedup_paths_preserve_order(candidates);
        assert_eq!(
            deduped,
            vec![PathBuf::from("A"), PathBuf::from("B"), PathBuf::from("C")]
        );
    }

    #[test]
    fn test_collect_log_dir_candidates_no_duplicates() {
        let candidates = collect_log_dir_candidates();
        let mut unique = HashSet::<PathBuf>::new();

        for candidate in &candidates {
            assert!(
                unique.insert(candidate.clone()),
                "duplicate candidate found: {}",
                candidate.display()
            );
        }
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    #[test]
    fn test_collect_log_dir_candidates_prioritize_local_data_dir() {
        let Some(local_data) = dirs::data_local_dir() else {
            return;
        };

        let candidates = collect_log_dir_candidates();
        assert!(!candidates.is_empty());

        let expected = local_data.join("com.cognia.launcher").join("logs");
        assert_eq!(candidates[0], expected);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_collect_log_dir_candidates_prioritize_library_logs() {
        let Some(home) = dirs::home_dir() else {
            return;
        };

        let candidates = collect_log_dir_candidates();
        assert!(!candidates.is_empty());

        let expected = home.join("Library/Logs").join("com.cognia.launcher");
        assert_eq!(candidates[0], expected);
    }
}
