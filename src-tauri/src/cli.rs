use crate::cache::{download_history::DownloadHistory, DownloadCache, MetadataCache};
use crate::commands::config::collect_config_list;
use crate::commands::download::{DownloadTaskInfo, HistoryRecordInfo, HistoryStatsInfo};
use crate::commands::log::LogExportOptions;
use crate::config::Settings;
use crate::core::backup::{self, BackupContentType};
use crate::core::custom_detection::CustomDetectionManager;
use crate::core::profiles::ProfileManager;
use crate::core::terminal::TerminalProfileManager;
use crate::core::{
    EnvironmentHealthResult, EnvironmentManager, HealthCheckManager, HealthScopeState,
    HealthStatus, Orchestrator, PackageManagerHealthResult, PackageSpec, SystemHealthResult,
};
use crate::download::{DownloadConfig, DownloadManager, DownloadManagerConfig};
use crate::error::CogniaError;
use crate::platform::disk::format_size;
use crate::platform::env::{self, current_platform, EnvFileFormat, EnvVarScope};
use crate::provider::support::{
    provider_unavailable_reason, update_support_reason,
    REASON_INSTALLED_PACKAGE_ENUMERATION_FAILED, REASON_NATIVE_UPDATE_FAILED,
    REASON_NATIVE_UPDATE_FAILED_WITH_FALLBACK, REASON_NO_MATCHING_INSTALLED_PACKAGES,
    SUPPORT_STATUS_ERROR, SUPPORT_STATUS_PARTIAL, SUPPORT_STATUS_SUPPORTED,
    SUPPORT_STATUS_UNSUPPORTED,
};
use crate::provider::{
    Capability, InstallRequest, InstalledFilter, ProviderRegistry, SearchOptions, UninstallRequest,
};
use crate::resolver::Version;
use crate::SharedRegistry;
use log::info;
use serde::Serialize;
use serde_json::json;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_cli::CliExt;
use tokio::sync::RwLock;

const EXIT_OK: i32 = 0;
const EXIT_ERROR: i32 = 1;
const EXIT_USAGE_ERROR: i32 = 2;

const SUBCOMMANDS: &[&str] = &[
    "search",
    "install",
    "uninstall",
    "list",
    "update",
    "info",
    "env",
    "config",
    "cache",
    "doctor",
    "providers",
    "backup",
    "profiles",
    "envvar",
    "log",
    "download",
    "wsl",
];

const ENV_SUBCOMMANDS: &[&str] = &["list", "install", "use", "detect", "remove", "resolve"];
const CONFIG_SUBCOMMANDS: &[&str] = &["get", "set", "list", "reset", "export", "import"];
const BACKUP_SUBCOMMANDS: &[&str] = &["list", "create", "restore", "delete"];
const PROFILES_SUBCOMMANDS: &[&str] = &[
    "list",
    "get",
    "apply",
    "export",
    "import",
    "create-from-current",
];
const ENVVAR_SUBCOMMANDS: &[&str] = &[
    "list",
    "get",
    "set",
    "remove",
    "list-persistent",
    "list-persistent-typed",
    "set-persistent",
    "remove-persistent",
    "get-path",
    "add-path",
    "remove-path",
    "reorder-path",
    "deduplicate-path",
    "detect-conflicts",
    "list-shell-profiles",
    "read-shell-profile",
    "expand-path",
    "export",
    "import",
    "preview-import",
    "apply-import",
    "preview-path-repair",
    "apply-path-repair",
    "resolve-conflict",
    "shell-guidance",
    "snapshot-list",
    "snapshot-create",
    "snapshot-protection",
    "snapshot-preview",
    "snapshot-restore",
    "snapshot-delete",
];
const LOG_SUBCOMMANDS: &[&str] = &["list", "export", "clear", "size", "cleanup"];
const DOWNLOAD_SUBCOMMANDS: &[&str] = &[
    "history-list",
    "history-stats",
    "history-clear",
    "history-remove",
    "queue-list",
    "queue-stats",
    "queue-pause",
    "queue-resume",
    "queue-cancel",
];
const WSL_SUBCOMMANDS: &[&str] = &["list", "status", "launch", "terminate", "shutdown", "exec"];
#[cfg(test)]
const CLI_P0_DOMAINS: &[&str] = &["backup", "profiles", "envvar", "log", "download"];

pub fn has_cli_subcommand() -> bool {
    std::env::args()
        .skip(1)
        .any(|arg| SUBCOMMANDS.contains(&arg.as_str()))
}

struct CliContext {
    app: tauri::AppHandle,
    settings: Settings,
    registry: Arc<RwLock<ProviderRegistry>>,
}

impl CliContext {
    fn from_app(app: &tauri::AppHandle) -> Self {
        let settings = tauri::async_runtime::block_on(async {
            app.state::<crate::SharedSettings>().read().await.clone()
        });
        let registry = app.state::<SharedRegistry>().inner().clone();
        Self {
            app: app.clone(),
            settings,
            registry,
        }
    }
}

pub fn handle_cli(app: &tauri::AppHandle) -> Option<i32> {
    let matches = match app.cli().matches() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("CLI error: {}", e);
            return Some(EXIT_USAGE_ERROR);
        }
    };

    let subcmd = matches.subcommand.as_ref()?;
    let json_mode = get_flag(&matches.args, "json");
    let ctx = CliContext::from_app(app);

    let exit_code = tauri::async_runtime::block_on(async {
        match subcmd.name.as_str() {
            "search" => cmd_search(&ctx, &subcmd.matches, json_mode).await,
            "install" => cmd_install(&ctx, &subcmd.matches, json_mode).await,
            "uninstall" => cmd_uninstall(&ctx, &subcmd.matches, json_mode).await,
            "list" => cmd_list(&ctx, &subcmd.matches, json_mode).await,
            "update" => cmd_update(&ctx, &subcmd.matches, json_mode).await,
            "info" => cmd_info(&ctx, &subcmd.matches, json_mode).await,
            "env" => cmd_env(&ctx, &subcmd.matches, json_mode).await,
            "config" => cmd_config(&ctx, &subcmd.matches, json_mode).await,
            "cache" => cmd_cache(&ctx, &subcmd.matches, json_mode).await,
            "doctor" => cmd_doctor(&ctx, &subcmd.matches, json_mode).await,
            "providers" => cmd_providers(&ctx, &subcmd.matches, json_mode).await,
            "backup" => cmd_backup(&ctx, &subcmd.matches, json_mode).await,
            "profiles" => cmd_profiles(&ctx, &subcmd.matches, json_mode).await,
            "envvar" => cmd_envvar(&ctx, &subcmd.matches, json_mode).await,
            "log" => cmd_log(&ctx, &subcmd.matches, json_mode).await,
            "download" => cmd_download(&ctx, &subcmd.matches, json_mode).await,
            "wsl" => cmd_wsl(&ctx, &subcmd.matches, json_mode).await,
            other => usage_error(other, json_mode, format!("Unknown subcommand: {}", other)),
        }
    });

    Some(exit_code)
}

// ── Arg helpers ──────────────────────────────────────────────────

fn get_flag(
    args: &std::collections::HashMap<String, tauri_plugin_cli::ArgData>,
    name: &str,
) -> bool {
    args.get(name)
        .map(|a| a.value == serde_json::Value::Bool(true))
        .unwrap_or(false)
}

fn get_string(
    args: &std::collections::HashMap<String, tauri_plugin_cli::ArgData>,
    name: &str,
) -> Option<String> {
    args.get(name).and_then(|a| match &a.value {
        serde_json::Value::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    })
}

fn get_string_list(
    args: &std::collections::HashMap<String, tauri_plugin_cli::ArgData>,
    name: &str,
) -> Vec<String> {
    args.get(name)
        .map(|a| match &a.value {
            serde_json::Value::Array(arr) => arr
                .iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect(),
            serde_json::Value::String(s) if !s.is_empty() => vec![s.clone()],
            _ => vec![],
        })
        .unwrap_or_default()
}

// ── Output helpers ───────────────────────────────────────────────

fn print_json<T: Serialize>(data: &T) {
    match serde_json::to_string_pretty(data) {
        Ok(json) => println!("{}", json),
        Err(e) => eprintln!("JSON serialization error: {}", e),
    }
}

fn cli_success_envelope(command: &str, data: serde_json::Value) -> serde_json::Value {
    json!({
        "ok": true,
        "command": command,
        "data": data,
    })
}

fn cli_error_envelope(command: &str, kind: &str, message: impl Into<String>) -> serde_json::Value {
    json!({
        "ok": false,
        "command": command,
        "error": {
            "kind": kind,
            "message": message.into(),
        }
    })
}

fn batch_summary(success: usize, failed: usize) -> serde_json::Value {
    json!({
        "total": success + failed,
        "success": success,
        "failed": failed,
    })
}

fn print_command_json<T: Serialize>(command: &str, data: &T) {
    match serde_json::to_value(data) {
        Ok(value) => print_json(&cli_success_envelope(command, value)),
        Err(e) => {
            print_json(&cli_error_envelope(
                command,
                "runtime",
                format!("JSON serialization error: {}", e),
            ));
        }
    }
}

fn doctor_status_from_issues(issues: &[crate::core::HealthIssue]) -> HealthStatus {
    if issues.iter().any(|issue| {
        matches!(
            issue.severity,
            crate::core::Severity::Critical | crate::core::Severity::Error
        ) && issue.confidence != Some(crate::core::HealthEvidenceConfidence::Inferred)
    }) {
        HealthStatus::Error
    } else if issues.iter().any(|issue| {
        matches!(issue.severity, crate::core::Severity::Warning)
            && issue.confidence != Some(crate::core::HealthEvidenceConfidence::Inferred)
    }) {
        HealthStatus::Warning
    } else {
        HealthStatus::Healthy
    }
}

fn doctor_envvar_payload(issues: &[crate::core::HealthIssue]) -> serde_json::Value {
    json!({
        "status": doctor_status_from_issues(issues),
        "issues": issues,
    })
}

fn print_table(headers: &[&str], rows: &[Vec<String>]) {
    if rows.is_empty() {
        return;
    }
    let mut widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
    for row in rows {
        for (i, cell) in row.iter().enumerate() {
            if i < widths.len() {
                widths[i] = widths[i].max(cell.len());
            }
        }
    }
    let header_line: String = headers
        .iter()
        .enumerate()
        .map(|(i, h)| format!("{:<width$}", h, width = widths[i]))
        .collect::<Vec<_>>()
        .join("  ");
    println!("{}", header_line);
    println!(
        "{}",
        widths
            .iter()
            .map(|w| "-".repeat(*w))
            .collect::<Vec<_>>()
            .join("  ")
    );
    for row in rows {
        let line: String = row
            .iter()
            .enumerate()
            .map(|(i, cell)| {
                let w = widths.get(i).copied().unwrap_or(cell.len());
                format!("{:<width$}", cell, width = w)
            })
            .collect::<Vec<_>>()
            .join("  ");
        println!("{}", line);
    }
}

fn format_wsl_default_flag(is_default: bool) -> String {
    if is_default {
        "yes".to_string()
    } else {
        "no".to_string()
    }
}

fn wsl_list_rows(distros: &[crate::provider::wsl::WslDistroInfo]) -> Vec<Vec<String>> {
    distros
        .iter()
        .map(|distro| {
            vec![
                distro.name.clone(),
                distro.state.clone(),
                distro.wsl_version.clone(),
                format_wsl_default_flag(distro.is_default),
            ]
        })
        .collect()
}

fn wsl_status_payload(
    version: String,
    version_info: Option<&crate::provider::wsl::WslVersionInfo>,
    default_distribution: Option<String>,
    default_version: Option<String>,
    running_distros: Vec<String>,
    status_info: String,
) -> serde_json::Value {
    json!({
        "version": version,
        "kernel_version": version_info.and_then(|info| info.kernel_version.clone()),
        "wslg_version": version_info.and_then(|info| info.wslg_version.clone()),
        "default_distribution": default_distribution,
        "default_version": default_version,
        "running_distros": running_distros,
        "status_info": status_info,
    })
}

fn wsl_exec_payload(
    distro: String,
    command: String,
    user: Option<String>,
    stdout: String,
    stderr: String,
    exit_code: i32,
) -> serde_json::Value {
    json!({
        "distro": distro,
        "command": command,
        "user": user,
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
        "success": exit_code == 0,
    })
}

fn usage_error(command: &str, json_mode: bool, message: impl AsRef<str>) -> i32 {
    let message = message.as_ref();
    if json_mode {
        print_json(&cli_error_envelope(command, "usage", message));
    } else {
        eprintln!("Error: {}", message);
    }
    EXIT_USAGE_ERROR
}

fn runtime_error(command: &str, json_mode: bool, message: impl AsRef<str>) -> i32 {
    let message = message.as_ref();
    if json_mode {
        print_json(&cli_error_envelope(command, "runtime", message));
    } else {
        eprintln!("Error: {}", message);
    }
    EXIT_ERROR
}

fn parse_config_import_content(file_path: &str, content: &str) -> Result<Settings, String> {
    toml::from_str::<Settings>(content)
        .map_err(|e| format!("Failed to parse configuration '{}': {}", file_path, e))
}

fn parse_env_scope(raw: Option<String>, default_scope: EnvVarScope) -> Result<EnvVarScope, String> {
    match raw.unwrap_or_else(|| scope_to_string(default_scope)) {
        value if value.eq_ignore_ascii_case("process") => Ok(EnvVarScope::Process),
        value if value.eq_ignore_ascii_case("user") => Ok(EnvVarScope::User),
        value if value.eq_ignore_ascii_case("system") => Ok(EnvVarScope::System),
        value => Err(format!(
            "Invalid scope '{}'. Expected one of: process, user, system",
            value
        )),
    }
}

fn parse_env_file_format(raw: Option<String>) -> Result<EnvFileFormat, String> {
    match raw
        .unwrap_or_else(|| "dotenv".to_string())
        .to_lowercase()
        .as_str()
    {
        "dotenv" => Ok(EnvFileFormat::Dotenv),
        "shell" => Ok(EnvFileFormat::Shell),
        "fish" => Ok(EnvFileFormat::Fish),
        "powershell" | "pwsh" => Ok(EnvFileFormat::PowerShell),
        "nushell" | "nu" => Ok(EnvFileFormat::Nushell),
        other => Err(format!(
            "Invalid format '{}'. Expected one of: dotenv, shell, fish, powershell, nushell",
            other
        )),
    }
}

fn parse_envvar_snapshot_mode(
    raw: Option<String>,
) -> Result<crate::commands::envvar::EnvVarSnapshotCreationMode, String> {
    match raw
        .unwrap_or_else(|| "manual".to_string())
        .to_lowercase()
        .as_str()
    {
        "manual" => Ok(crate::commands::envvar::EnvVarSnapshotCreationMode::Manual),
        "automatic" | "auto" => Ok(crate::commands::envvar::EnvVarSnapshotCreationMode::Automatic),
        other => Err(format!(
            "Invalid snapshot mode '{}'. Expected one of: manual, automatic",
            other
        )),
    }
}

fn scope_to_string(scope: EnvVarScope) -> String {
    match scope {
        EnvVarScope::Process => "process".to_string(),
        EnvVarScope::User => "user".to_string(),
        EnvVarScope::System => "system".to_string(),
    }
}

fn read_text_file(file_path: &str) -> Result<String, String> {
    std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file '{}': {}", file_path, e))
}

fn write_text_file(file_path: &str, content: &str) -> Result<(), String> {
    std::fs::write(file_path, content)
        .map_err(|e| format!("Failed to write file '{}': {}", file_path, e))
}

fn parse_backup_contents(raw_values: Vec<String>) -> Result<Vec<BackupContentType>, String> {
    if raw_values.is_empty() {
        return Ok(BackupContentType::all());
    }

    let mut result = Vec::new();
    for value in raw_values {
        match BackupContentType::from_str(&value) {
            Some(content_type) => result.push(content_type),
            None => {
                return Err(format!(
                    "Invalid backup content '{}'. Expected one of: config, terminal_profiles, environment_profiles, cache_database, download_history, cleanup_history, custom_detection_rules, environment_settings",
                    value
                ));
            }
        }
    }
    Ok(result)
}

async fn load_profile_manager(ctx: &CliContext) -> Result<ProfileManager, String> {
    let mut manager = ProfileManager::new(
        ctx.settings.get_state_dir().join("profiles"),
        ctx.registry.clone(),
    );
    manager
        .load()
        .await
        .map_err(|e| format!("Failed to load profile manager state: {}", e))?;
    Ok(manager)
}

async fn load_backup_dependencies(
    ctx: &CliContext,
) -> Result<
    (
        TerminalProfileManager,
        ProfileManager,
        CustomDetectionManager,
    ),
    String,
> {
    let terminal_manager = TerminalProfileManager::new(&ctx.settings.get_root_dir())
        .await
        .map_err(|e| format!("Failed to initialize terminal profiles: {}", e))?;

    let profile_manager = load_profile_manager(ctx).await?;

    let config_dir = ctx.app.path().app_config_dir().unwrap_or_default();
    let mut custom_detection_manager = CustomDetectionManager::new(&config_dir);
    custom_detection_manager
        .load()
        .await
        .map_err(|e| format!("Failed to load custom detection rules: {}", e))?;

    Ok((terminal_manager, profile_manager, custom_detection_manager))
}

async fn create_cli_download_manager(settings: &Settings) -> DownloadManager {
    let config = DownloadManagerConfig {
        max_concurrent: settings.general.parallel_downloads as usize,
        speed_limit: settings.general.download_speed_limit,
        default_task_config: DownloadConfig::default(),
        partials_dir: settings.get_cache_dir().join("partials"),
        auto_start: true,
        progress_interval_ms: 100,
    };

    let client = crate::platform::proxy::build_client(settings);
    let mut manager = DownloadManager::new(config, client);
    manager.enable_persistence(&settings.get_cache_dir());
    let _ = manager.load_persisted_tasks().await;
    manager
}

// ── Subcommand: search ───────────────────────────────────────────

async fn cmd_search(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "search";
    let query = match get_string(&matches.args, "query") {
        Some(q) => q,
        None => return usage_error(COMMAND, json_mode, "search query is required"),
    };
    let provider_filter = get_string(&matches.args, "provider");
    let limit: usize = get_string(&matches.args, "limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    let reg = ctx.registry.read().await;
    let results = if let Some(ref pid) = provider_filter {
        match reg.get(pid) {
            Some(p) => p
                .search(
                    &query,
                    SearchOptions {
                        limit: Some(limit),
                        page: None,
                    },
                )
                .await
                .unwrap_or_default(),
            None => {
                return usage_error(COMMAND, json_mode, format!("Provider not found: {}", pid));
            }
        }
    } else {
        let ids: Vec<String> = reg.list().iter().map(|s| s.to_string()).collect();
        let providers: Vec<_> = ids.iter().filter_map(|id| reg.get(id)).collect();
        drop(reg);
        let mut all = Vec::new();
        for p in &providers {
            if p.is_available().await {
                if let Ok(mut r) = p
                    .search(
                        &query,
                        SearchOptions {
                            limit: Some(5),
                            page: None,
                        },
                    )
                    .await
                {
                    all.append(&mut r);
                }
            }
        }
        all.truncate(limit);
        all
    };

    if json_mode {
        print_command_json(COMMAND, &results);
    } else if results.is_empty() {
        println!("No results found for '{}'", query);
    } else {
        println!("{} package(s) found:\n", results.len());
        let rows: Vec<Vec<String>> = results
            .iter()
            .map(|r| {
                vec![
                    r.name.clone(),
                    r.latest_version.clone().unwrap_or_default(),
                    r.provider.clone(),
                    r.description.clone().unwrap_or_default(),
                ]
            })
            .collect();
        print_table(&["NAME", "VERSION", "PROVIDER", "DESCRIPTION"], &rows);
    }
    EXIT_OK
}

// ── Subcommand: install ──────────────────────────────────────────

async fn cmd_install(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "install";
    let packages = get_string_list(&matches.args, "packages");
    if packages.is_empty() {
        return usage_error(COMMAND, json_mode, "at least one package name is required");
    }
    let provider_filter = get_string(&matches.args, "provider");
    let force = get_flag(&matches.args, "force");
    let continue_on_error = get_flag(&matches.args, "continue-on-error");

    info!("CLI: installing packages: {:?}", packages);

    if provider_filter.is_none() && !force && !continue_on_error {
        let orchestrator = Orchestrator::new(ctx.registry.clone(), ctx.settings.clone());
        return match orchestrator.install(&packages).await {
            Ok(receipts) => {
                if json_mode {
                    print_command_json(
                        COMMAND,
                        &json!({
                            "installed": receipts,
                            "failures": [],
                            "summary": batch_summary(packages.len(), 0),
                            "force": force,
                            "continue_on_error": continue_on_error,
                        }),
                    );
                } else {
                    for r in &receipts {
                        println!("Installed {}@{} (via {})", r.name, r.version, r.provider);
                    }
                }
                EXIT_OK
            }
            Err(e) => runtime_error(COMMAND, json_mode, format!("Install error: {}", e)),
        };
    }

    let requested_specs: Vec<PackageSpec> =
        packages.iter().map(|p| PackageSpec::parse(p)).collect();
    let mut installed: Vec<serde_json::Value> = Vec::new();
    let mut failures: Vec<serde_json::Value> = Vec::new();

    for spec in &requested_specs {
        let provider = if let Some(ref provider_id) = provider_filter {
            let reg = ctx.registry.read().await;
            match reg.get(provider_id) {
                Some(p) => p,
                None => {
                    return usage_error(
                        COMMAND,
                        json_mode,
                        format!("Provider not found: {}", provider_id),
                    );
                }
            }
        } else {
            let reg = ctx.registry.read().await;
            match reg.find_for_package(&spec.name).await {
                Ok(Some(p)) => p,
                Ok(None) => {
                    let message = format!("No provider available for package {}", spec.name);
                    if continue_on_error {
                        failures.push(json!({
                            "name": spec.name,
                            "provider": serde_json::Value::Null,
                            "error": message,
                        }));
                        continue;
                    }
                    return runtime_error(COMMAND, json_mode, message);
                }
                Err(e) => {
                    let message = format!("Provider resolution failed for {}: {}", spec.name, e);
                    if continue_on_error {
                        failures.push(json!({
                            "name": spec.name,
                            "provider": serde_json::Value::Null,
                            "error": message,
                        }));
                        continue;
                    }
                    return runtime_error(COMMAND, json_mode, message);
                }
            }
        };

        if !provider.is_available().await {
            let message = format!("Provider {} is not available", provider.id());
            if continue_on_error {
                failures.push(json!({
                    "name": spec.name,
                    "provider": provider.id(),
                    "error": message,
                }));
                continue;
            }
            return usage_error(COMMAND, json_mode, message);
        }
        if !provider.capabilities().contains(&Capability::Install) {
            let message = format!(
                "Provider {} does not support install operation",
                provider.id()
            );
            if continue_on_error {
                failures.push(json!({
                    "name": spec.name,
                    "provider": provider.id(),
                    "error": message,
                }));
                continue;
            }
            return runtime_error(COMMAND, json_mode, message);
        }

        match provider
            .install(InstallRequest {
                name: spec.name.clone(),
                version: spec.version.clone(),
                global: true,
                force,
            })
            .await
        {
            Ok(receipt) => installed.push(json!({
                "name": receipt.name,
                "version": receipt.version,
                "provider": receipt.provider,
                "force": force,
            })),
            Err(e) => {
                let message = format!("Install error for {}: {}", spec.name, e);
                if continue_on_error {
                    failures.push(json!({
                        "name": spec.name,
                        "provider": provider.id(),
                        "error": message,
                    }));
                    continue;
                }
                return runtime_error(COMMAND, json_mode, message);
            }
        }
    }

    let summary = batch_summary(installed.len(), failures.len());
    if json_mode {
        print_command_json(
            COMMAND,
            &json!({
                "installed": installed,
                "failures": failures,
                "summary": summary,
                "force": force,
                "continue_on_error": continue_on_error,
            }),
        );
    } else {
        for item in &installed {
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let version = item
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let provider = item
                .get("provider")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            if force {
                println!(
                    "Installed {}@{} (via {}, force mode)",
                    name, version, provider
                );
            } else {
                println!("Installed {}@{} (via {})", name, version, provider);
            }
        }
        for item in &failures {
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let provider = item
                .get("provider")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let error = item
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown error");
            eprintln!("Failed to install {} (via {}): {}", name, provider, error);
        }
    }

    if failures.is_empty() {
        EXIT_OK
    } else {
        EXIT_ERROR
    }
}

// ── Subcommand: uninstall ────────────────────────────────────────

async fn cmd_uninstall(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "uninstall";
    let packages = get_string_list(&matches.args, "packages");
    if packages.is_empty() {
        return usage_error(COMMAND, json_mode, "at least one package name is required");
    }
    let provider_filter = get_string(&matches.args, "provider");
    let force = get_flag(&matches.args, "force");
    let continue_on_error = get_flag(&matches.args, "continue-on-error");

    info!("CLI: uninstalling packages: {:?}", packages);

    if provider_filter.is_none() && !force && !continue_on_error {
        let orchestrator = Orchestrator::new(ctx.registry.clone(), ctx.settings.clone());
        return match orchestrator.uninstall(&packages).await {
            Ok(()) => {
                if json_mode {
                    print_command_json(
                        COMMAND,
                        &json!({
                            "uninstalled": packages,
                            "failures": [],
                            "summary": batch_summary(packages.len(), 0),
                            "force": force,
                            "continue_on_error": continue_on_error,
                        }),
                    );
                } else {
                    for name in &packages {
                        println!("Uninstalled {}", name);
                    }
                }
                EXIT_OK
            }
            Err(e) => runtime_error(COMMAND, json_mode, format!("Uninstall error: {}", e)),
        };
    }

    let requested_specs: Vec<PackageSpec> =
        packages.iter().map(|p| PackageSpec::parse(p)).collect();
    let mut removed: Vec<serde_json::Value> = Vec::new();
    let mut failures: Vec<serde_json::Value> = Vec::new();

    for spec in &requested_specs {
        let provider = if let Some(ref provider_id) = provider_filter {
            let reg = ctx.registry.read().await;
            match reg.get(provider_id) {
                Some(p) => p,
                None => {
                    return usage_error(
                        COMMAND,
                        json_mode,
                        format!("Provider not found: {}", provider_id),
                    );
                }
            }
        } else {
            let reg = ctx.registry.read().await;
            match reg.find_for_package(&spec.name).await {
                Ok(Some(p)) => p,
                Ok(None) => {
                    let message = format!("No provider available for package {}", spec.name);
                    if continue_on_error {
                        failures.push(json!({
                            "name": spec.name,
                            "provider": serde_json::Value::Null,
                            "error": message,
                        }));
                        continue;
                    }
                    return runtime_error(COMMAND, json_mode, message);
                }
                Err(e) => {
                    let message = format!("Provider resolution failed for {}: {}", spec.name, e);
                    if continue_on_error {
                        failures.push(json!({
                            "name": spec.name,
                            "provider": serde_json::Value::Null,
                            "error": message,
                        }));
                        continue;
                    }
                    return runtime_error(COMMAND, json_mode, message);
                }
            }
        };

        if !provider.is_available().await {
            let message = format!("Provider {} is not available", provider.id());
            if continue_on_error {
                failures.push(json!({
                    "name": spec.name,
                    "provider": provider.id(),
                    "error": message,
                }));
                continue;
            }
            return usage_error(COMMAND, json_mode, message);
        }
        if !provider.capabilities().contains(&Capability::Uninstall) {
            let message = format!(
                "Provider {} does not support uninstall operation",
                provider.id()
            );
            if continue_on_error {
                failures.push(json!({
                    "name": spec.name,
                    "provider": provider.id(),
                    "error": message,
                }));
                continue;
            }
            return runtime_error(COMMAND, json_mode, message);
        }

        match provider
            .uninstall(UninstallRequest {
                name: spec.name.clone(),
                version: spec.version.clone(),
                force,
            })
            .await
        {
            Ok(()) => removed.push(json!({
                "name": spec.name,
                "provider": provider.id(),
                "force": force,
            })),
            Err(e) => {
                let message = format!("Uninstall error for {}: {}", spec.name, e);
                if continue_on_error {
                    failures.push(json!({
                        "name": spec.name,
                        "provider": provider.id(),
                        "error": message,
                    }));
                    continue;
                }
                return runtime_error(COMMAND, json_mode, message);
            }
        }
    }

    let summary = batch_summary(removed.len(), failures.len());
    if json_mode {
        print_command_json(
            COMMAND,
            &json!({
                "uninstalled": removed,
                "failures": failures,
                "summary": summary,
                "force": force,
                "continue_on_error": continue_on_error,
            }),
        );
    } else {
        for item in &removed {
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let provider = item
                .get("provider")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            if force {
                println!("Uninstalled {} (via {}, force mode)", name, provider);
            } else {
                println!("Uninstalled {} (via {})", name, provider);
            }
        }
        for item in &failures {
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let provider = item
                .get("provider")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let error = item
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown error");
            eprintln!("Failed to uninstall {} (via {}): {}", name, provider, error);
        }
    }

    if failures.is_empty() {
        EXIT_OK
    } else {
        EXIT_ERROR
    }
}

// ── Subcommand: list ─────────────────────────────────────────────

async fn cmd_list(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "list";
    let provider_filter = get_string(&matches.args, "provider");
    let outdated_only = get_flag(&matches.args, "outdated");

    if let Some(ref provider_id) = provider_filter {
        let reg = ctx.registry.read().await;
        if reg.get(provider_id).is_none() {
            return usage_error(
                COMMAND,
                json_mode,
                format!("Provider not found: {}", provider_id),
            );
        }
    }

    let reg = ctx.registry.read().await;
    let ids: Vec<String> = if let Some(ref id) = provider_filter {
        vec![id.clone()]
    } else {
        reg.list().into_iter().map(|s| s.to_string()).collect()
    };
    let providers: Vec<_> = ids.iter().filter_map(|id| reg.get(id)).collect();
    drop(reg);

    if outdated_only {
        let mut outdated = Vec::new();
        for p in &providers {
            let caps = p.capabilities();
            if !caps.contains(&Capability::Update) && !caps.contains(&Capability::Upgrade) {
                continue;
            }
            if !p.is_available().await {
                continue;
            }
            if let Ok(mut updates) = p.check_updates(&[]).await {
                outdated.append(&mut updates);
            }
        }

        if json_mode {
            print_command_json(
                COMMAND,
                &json!({ "outdated": outdated, "count": outdated.len() }),
            );
        } else if outdated.is_empty() {
            println!("No outdated packages found");
        } else {
            println!("{} outdated package(s):\n", outdated.len());
            let rows: Vec<Vec<String>> = outdated
                .iter()
                .map(|u| {
                    vec![
                        u.name.clone(),
                        u.current_version.clone(),
                        u.latest_version.clone(),
                        u.provider.clone(),
                    ]
                })
                .collect();
            print_table(&["NAME", "CURRENT", "LATEST", "PROVIDER"], &rows);
        }
        return EXIT_OK;
    }

    let mut all = Vec::new();
    for p in &providers {
        if p.is_available().await {
            if let Ok(mut pkgs) = p
                .list_installed(InstalledFilter {
                    global_only: true,
                    ..Default::default()
                })
                .await
            {
                all.append(&mut pkgs);
            }
        }
    }

    if json_mode {
        print_command_json(COMMAND, &all);
    } else if all.is_empty() {
        println!("No installed packages found");
    } else {
        println!("{} package(s) installed:\n", all.len());
        let rows: Vec<Vec<String>> = all
            .iter()
            .map(|p| vec![p.name.clone(), p.version.clone(), p.provider.clone()])
            .collect();
        print_table(&["NAME", "VERSION", "PROVIDER"], &rows);
    }
    EXIT_OK
}

// ── Subcommand: update ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
struct CliUpdateEntry {
    name: String,
    current_version: String,
    latest_version: String,
    provider: String,
}

#[derive(Debug, Clone, Serialize)]
struct CliProviderOutcome {
    provider: String,
    status: String,
    reason: Option<String>,
    reason_code: Option<String>,
    checked: usize,
    updates: usize,
    errors: usize,
}

#[derive(Debug, Clone, Default, Serialize)]
struct CliCoverage {
    supported: usize,
    partial: usize,
    unsupported: usize,
    error: usize,
}

fn summarize_cli_coverage(outcomes: &[CliProviderOutcome]) -> CliCoverage {
    let mut coverage = CliCoverage::default();
    for outcome in outcomes {
        match outcome.status.as_str() {
            SUPPORT_STATUS_SUPPORTED => coverage.supported += 1,
            SUPPORT_STATUS_PARTIAL => coverage.partial += 1,
            SUPPORT_STATUS_UNSUPPORTED => coverage.unsupported += 1,
            SUPPORT_STATUS_ERROR => coverage.error += 1,
            _ => {}
        }
    }
    coverage
}

fn normalize_cli_updates(
    provider_id: &str,
    updates: Vec<crate::provider::UpdateInfo>,
    installed_names: &HashSet<String>,
) -> Vec<CliUpdateEntry> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for update in updates {
        let name_key = update.name.to_ascii_lowercase();
        if !installed_names.contains(&name_key) || !seen.insert(name_key) {
            continue;
        }
        normalized.push(CliUpdateEntry {
            name: update.name,
            current_version: update.current_version,
            latest_version: update.latest_version,
            provider: if update.provider.is_empty() {
                provider_id.to_string()
            } else {
                update.provider
            },
        });
    }

    normalized
}

fn cli_has_newer_version(current: &str, latest: &str) -> bool {
    match (current.parse::<Version>(), latest.parse::<Version>()) {
        (Ok(current_ver), Ok(latest_ver)) => latest_ver > current_ver,
        _ => !latest.trim().eq_ignore_ascii_case(current.trim()),
    }
}

async fn cli_fallback_updates_with_versions(
    provider: &Arc<dyn crate::provider::Provider>,
    provider_id: &str,
    installed_packages: &[crate::provider::InstalledPackage],
) -> (Vec<CliUpdateEntry>, usize) {
    let mut seen = HashSet::new();
    let mut updates = Vec::new();
    let mut errors = 0usize;

    for pkg in installed_packages {
        if !seen.insert(pkg.name.to_ascii_lowercase()) {
            continue;
        }

        match provider.get_versions(&pkg.name).await {
            Ok(versions) => {
                if let Some(latest) = versions.first() {
                    if cli_has_newer_version(&pkg.version, &latest.version) {
                        updates.push(CliUpdateEntry {
                            name: pkg.name.clone(),
                            current_version: pkg.version.clone(),
                            latest_version: latest.version.clone(),
                            provider: provider_id.to_string(),
                        });
                    }
                }
            }
            Err(_) => {
                errors += 1;
            }
        }
    }

    (updates, errors)
}

async fn cmd_update(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "update";
    let packages = get_string_list(&matches.args, "packages");
    let update_all = get_flag(&matches.args, "all");
    let provider_filter = get_string(&matches.args, "provider");
    let continue_on_error = get_flag(&matches.args, "continue-on-error");

    if packages.is_empty() && !update_all {
        return usage_error(
            COMMAND,
            json_mode,
            "specify packages to update or use --all",
        );
    }

    if let Some(ref provider_id) = provider_filter {
        let reg = ctx.registry.read().await;
        if reg.get(provider_id).is_none() {
            return usage_error(
                COMMAND,
                json_mode,
                format!("Provider not found: {}", provider_id),
            );
        }
    }

    let reg = ctx.registry.read().await;
    let ids: Vec<String> = if let Some(ref id) = provider_filter {
        vec![id.clone()]
    } else {
        reg.list().into_iter().map(|s| s.to_string()).collect()
    };
    let providers: Vec<_> = ids.iter().filter_map(|id| reg.get(id)).collect();
    drop(reg);

    let package_filter: Option<HashSet<String>> = if update_all {
        None
    } else {
        Some(
            packages
                .iter()
                .map(|name| name.to_ascii_lowercase())
                .collect(),
        )
    };

    let mut updates: Vec<CliUpdateEntry> = Vec::new();
    let mut provider_outcomes: Vec<CliProviderOutcome> = Vec::new();
    let platform = current_platform();

    for p in &providers {
        if let Some(reason) =
            update_support_reason(platform, &p.supported_platforms(), &p.capabilities())
        {
            provider_outcomes.push(CliProviderOutcome {
                provider: p.id().to_string(),
                status: SUPPORT_STATUS_UNSUPPORTED.to_string(),
                reason: Some(reason.message),
                reason_code: Some(reason.code.to_string()),
                checked: 0,
                updates: 0,
                errors: 0,
            });
            continue;
        }

        if !p.is_available().await {
            let reason = p
                .unavailable_reason()
                .await
                .unwrap_or_else(provider_unavailable_reason);
            provider_outcomes.push(CliProviderOutcome {
                provider: p.id().to_string(),
                status: SUPPORT_STATUS_UNSUPPORTED.to_string(),
                reason: Some(reason.message),
                reason_code: Some(reason.code.to_string()),
                checked: 0,
                updates: 0,
                errors: 0,
            });
            continue;
        }

        let mut installed = match p.list_installed(InstalledFilter::default()).await {
            Ok(values) => values,
            Err(e) => {
                provider_outcomes.push(CliProviderOutcome {
                    provider: p.id().to_string(),
                    status: SUPPORT_STATUS_ERROR.to_string(),
                    reason: Some("failed to enumerate installed packages".to_string()),
                    reason_code: Some(REASON_INSTALLED_PACKAGE_ENUMERATION_FAILED.to_string()),
                    checked: 0,
                    updates: 0,
                    errors: 1,
                });
                if !continue_on_error {
                    return runtime_error(
                        COMMAND,
                        json_mode,
                        format!(
                            "Failed to list installed packages for provider {}: {}",
                            p.id(),
                            e
                        ),
                    );
                }
                continue;
            }
        };

        if let Some(filter) = package_filter.as_ref() {
            installed.retain(|pkg| filter.contains(&pkg.name.to_ascii_lowercase()));
        }

        let mut seen = HashSet::new();
        installed.retain(|pkg| seen.insert(pkg.name.to_ascii_lowercase()));

        if installed.is_empty() {
            provider_outcomes.push(CliProviderOutcome {
                provider: p.id().to_string(),
                status: SUPPORT_STATUS_UNSUPPORTED.to_string(),
                reason: Some("no matching installed packages (skipped)".to_string()),
                reason_code: Some(REASON_NO_MATCHING_INSTALLED_PACKAGES.to_string()),
                checked: 0,
                updates: 0,
                errors: 0,
            });
            continue;
        }

        let checked = installed.len();
        let package_names: Vec<String> = installed.iter().map(|pkg| pkg.name.clone()).collect();
        let installed_names: HashSet<String> = installed
            .iter()
            .map(|pkg| pkg.name.to_ascii_lowercase())
            .collect();

        match p.check_updates(&package_names).await {
            Ok(native_updates) => {
                let normalized = normalize_cli_updates(p.id(), native_updates, &installed_names);
                let update_count = normalized.len();
                updates.extend(normalized);
                provider_outcomes.push(CliProviderOutcome {
                    provider: p.id().to_string(),
                    status: SUPPORT_STATUS_SUPPORTED.to_string(),
                    reason: None,
                    reason_code: None,
                    checked,
                    updates: update_count,
                    errors: 0,
                });
            }
            Err(e) => {
                let (fallback_updates, fallback_errors) =
                    cli_fallback_updates_with_versions(p, p.id(), &installed).await;
                let fallback_count = fallback_updates.len();
                let provider_error_count = 1 + fallback_errors;
                updates.extend(fallback_updates);

                let status = if fallback_count > 0 {
                    SUPPORT_STATUS_PARTIAL
                } else {
                    SUPPORT_STATUS_ERROR
                };
                let reason_code = if fallback_count > 0 {
                    REASON_NATIVE_UPDATE_FAILED_WITH_FALLBACK
                } else {
                    REASON_NATIVE_UPDATE_FAILED
                };
                let reason = if fallback_count > 0 {
                    "native update check failed; metadata fallback applied".to_string()
                } else {
                    "native update check failed".to_string()
                };

                provider_outcomes.push(CliProviderOutcome {
                    provider: p.id().to_string(),
                    status: status.to_string(),
                    reason: Some(reason),
                    reason_code: Some(reason_code.to_string()),
                    checked,
                    updates: fallback_count,
                    errors: provider_error_count,
                });

                if !continue_on_error && status == SUPPORT_STATUS_ERROR {
                    return runtime_error(
                        COMMAND,
                        json_mode,
                        format!("Update check failed for provider {}: {}", p.id(), e),
                    );
                }
            }
        }
    }

    updates.sort_by(|a, b| {
        a.provider
            .cmp(&b.provider)
            .then_with(|| a.name.cmp(&b.name))
            .then_with(|| a.latest_version.cmp(&b.latest_version))
    });
    provider_outcomes.sort_by(|a, b| a.provider.cmp(&b.provider));
    let coverage = summarize_cli_coverage(&provider_outcomes);

    let provider_successes = provider_outcomes
        .iter()
        .filter(|item| item.status != SUPPORT_STATUS_ERROR)
        .count();
    let provider_failures = provider_outcomes
        .iter()
        .filter(|item| item.status == SUPPORT_STATUS_ERROR)
        .count();

    if json_mode {
        print_command_json(
            COMMAND,
            &serde_json::json!({
                "updates": updates,
                "provider_outcomes": provider_outcomes,
                "coverage": coverage,
                "summary": batch_summary(provider_successes, provider_failures),
                "continue_on_error": continue_on_error,
            }),
        );
    } else if updates.is_empty() {
        println!("All packages are up to date");
        if coverage.unsupported > 0 {
            println!(
                "\n{} provider(s) skipped/unsupported.",
                coverage.unsupported
            );
        }
        if coverage.partial > 0 {
            println!(
                "{} provider(s) had partial update-check results (fallback applied).",
                coverage.partial
            );
        }
        if coverage.error > 0 {
            println!("{} provider(s) failed during update check.", coverage.error);
        }
    } else {
        println!("{} update(s) available:\n", updates.len());
        let rows: Vec<Vec<String>> = updates
            .iter()
            .map(|u| {
                vec![
                    u.name.clone(),
                    u.current_version.clone(),
                    u.latest_version.clone(),
                    u.provider.clone(),
                ]
            })
            .collect();
        print_table(&["NAME", "CURRENT", "LATEST", "PROVIDER"], &rows);

        if coverage.unsupported > 0 {
            println!(
                "\n{} provider(s) skipped/unsupported.",
                coverage.unsupported
            );
        }
        if coverage.partial > 0 {
            println!(
                "{} provider(s) had partial update-check results (fallback applied).",
                coverage.partial
            );
        }
        if coverage.error > 0 {
            println!("{} provider(s) failed during update check.", coverage.error);
        }
    }
    if provider_failures > 0 {
        EXIT_ERROR
    } else {
        EXIT_OK
    }
}

// ── Subcommand: info ─────────────────────────────────────────────

async fn cmd_info(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "info";
    let package = match get_string(&matches.args, "package") {
        Some(p) => p,
        None => return usage_error(COMMAND, json_mode, "package name is required"),
    };
    let provider_filter = get_string(&matches.args, "provider");
    let reg = ctx.registry.read().await;

    let result = if let Some(ref pid) = provider_filter {
        match reg.get(pid) {
            Some(p) => p.get_package_info(&package).await,
            None => {
                return usage_error(COMMAND, json_mode, format!("Provider not found: {}", pid));
            }
        }
    } else {
        match reg.find_for_package(&package).await {
            Ok(Some(p)) => p.get_package_info(&package).await,
            _ => {
                return runtime_error(
                    COMMAND,
                    json_mode,
                    format!("Package not found: {}", package),
                );
            }
        }
    };

    match result {
        Ok(info) => {
            if json_mode {
                print_command_json(COMMAND, &info);
            } else {
                println!("Name:        {}", info.name);
                println!(
                    "Versions:    {}",
                    info.versions
                        .first()
                        .map(|v| v.version.as_str())
                        .unwrap_or("N/A")
                );
                println!("Provider:    {}", info.provider);
                if let Some(d) = &info.description {
                    println!("Description: {}", d);
                }
                if let Some(h) = &info.homepage {
                    println!("Homepage:    {}", h);
                }
                if let Some(l) = &info.license {
                    println!("License:     {}", l);
                }
            }
            EXIT_OK
        }
        Err(e) => runtime_error(COMMAND, json_mode, e.to_string()),
    }
}

// ── Subcommand: env ──────────────────────────────────────────────

async fn cmd_env(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "env";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                format!("env subcommand required ({})", ENV_SUBCOMMANDS.join(", ")),
            );
        }
    };

    match subcmd.name.as_str() {
        "list" => cmd_env_list(ctx, &subcmd.matches, json_mode).await,
        "install" => cmd_env_install(ctx, &subcmd.matches, json_mode).await,
        "use" => cmd_env_use(ctx, &subcmd.matches, json_mode).await,
        "detect" => cmd_env_detect(ctx, &subcmd.matches, json_mode).await,
        "remove" => cmd_env_remove(ctx, &subcmd.matches, json_mode).await,
        "resolve" => cmd_env_resolve(ctx, &subcmd.matches, json_mode).await,
        other => usage_error(
            "env",
            json_mode,
            format!("Unknown env subcommand: {}", other),
        ),
    }
}

async fn cmd_env_list(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "env.list";
    let type_filter = get_string(&matches.args, "type");
    let manager = EnvironmentManager::new(ctx.registry.clone());
    match manager.list_environments_with_concurrency(4).await {
        Ok(envs) => {
            let filtered: Vec<_> = if let Some(ref t) = type_filter {
                envs.into_iter().filter(|e| e.env_type == *t).collect()
            } else {
                envs
            };

            if json_mode {
                print_command_json(COMMAND, &filtered);
            } else if filtered.is_empty() {
                println!("No environments found");
            } else {
                let rows: Vec<Vec<String>> = filtered
                    .iter()
                    .map(|e| {
                        vec![
                            e.env_type.clone(),
                            e.provider.clone(),
                            e.current_version.clone().unwrap_or_else(|| "-".into()),
                            e.version_count.to_string(),
                            if e.available { "Yes" } else { "No" }.into(),
                        ]
                    })
                    .collect();
                print_table(
                    &["TYPE", "PROVIDER", "CURRENT", "VERSIONS", "AVAILABLE"],
                    &rows,
                );
            }
            EXIT_OK
        }
        Err(e) => runtime_error(COMMAND, json_mode, e.to_string()),
    }
}

async fn cmd_env_install(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "env.install";
    let version = match get_string(&matches.args, "version") {
        Some(v) => v,
        None => return usage_error(COMMAND, json_mode, "version is required"),
    };
    let env_type = match get_string(&matches.args, "type") {
        Some(t) => t,
        None => return usage_error(COMMAND, json_mode, "--type is required (e.g. --type node)"),
    };
    let provider_id = get_string(&matches.args, "provider");

    let manager = EnvironmentManager::new(ctx.registry.clone());
    let (logical, _key, provider) = match manager
        .resolve_provider(&env_type, provider_id.as_deref(), Some(&version))
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return runtime_error(
                COMMAND,
                json_mode,
                format!("Error resolving provider: {}", e),
            );
        }
    };

    println!(
        "Installing {} {} via {}...",
        logical,
        version,
        provider.id()
    );
    let request = crate::provider::InstallRequest {
        name: logical.clone(),
        version: Some(version.clone()),
        global: true,
        force: false,
    };
    match provider.install(request).await {
        Ok(receipt) => {
            if json_mode {
                print_command_json(COMMAND, &receipt);
            } else {
                println!(
                    "Successfully installed {} {} (via {})",
                    logical, receipt.version, receipt.provider
                );
            }
            EXIT_OK
        }
        Err(e) => runtime_error(COMMAND, json_mode, format!("Install error: {}", e)),
    }
}

async fn cmd_env_use(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "env.use";
    let version = match get_string(&matches.args, "version") {
        Some(v) => v,
        None => return usage_error(COMMAND, json_mode, "version is required"),
    };
    let env_type = match get_string(&matches.args, "type") {
        Some(t) => t,
        None => return usage_error(COMMAND, json_mode, "--type is required"),
    };
    let local_path = get_string(&matches.args, "local");
    let provider_id = get_string(&matches.args, "provider");

    let manager = EnvironmentManager::new(ctx.registry.clone());
    let result = if let Some(ref path) = local_path {
        manager
            .set_local_version(
                &env_type,
                std::path::Path::new(path),
                &version,
                provider_id.as_deref(),
            )
            .await
    } else {
        manager
            .set_global_version(&env_type, &version, provider_id.as_deref())
            .await
    };

    match result {
        Ok(()) => {
            let scope = if local_path.is_some() {
                "local"
            } else {
                "global"
            };
            if json_mode {
                print_command_json(
                    COMMAND,
                    &serde_json::json!({ "env_type": env_type, "version": version, "scope": scope }),
                );
            } else {
                println!("Set {} {} as {} version", env_type, version, scope);
            }
            EXIT_OK
        }
        Err(e) => runtime_error(COMMAND, json_mode, e.to_string()),
    }
}

async fn cmd_env_detect(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "env.detect";
    let type_filter = get_string(&matches.args, "type");
    let start_path = get_string(&matches.args, "path").unwrap_or_else(|| ".".into());
    let manager = EnvironmentManager::new(ctx.registry.clone());

    if let Some(ref env_type) = type_filter {
        let sources = crate::core::project_env_detect::default_enabled_detection_sources(env_type);
        match manager
            .detect_version_with_sources(env_type, std::path::Path::new(&start_path), &sources)
            .await
        {
            Ok(Some(d)) => {
                if json_mode {
                    print_command_json(COMMAND, &d);
                } else {
                    println!("{} {} (detected via {})", d.env_type, d.version, d.source);
                }
            }
            Ok(None) => {
                if json_mode {
                    print_command_json(COMMAND, &serde_json::Value::Null);
                } else {
                    println!("No {} environment detected", env_type);
                }
            }
            Err(e) => {
                return runtime_error(COMMAND, json_mode, format!("Detection error: {}", e));
            }
        }
    } else {
        let all_types = crate::provider::SystemEnvironmentType::all();
        let mut detected = Vec::new();
        for env in &all_types {
            let et = env.env_type();
            let sources = crate::core::project_env_detect::default_enabled_detection_sources(et);
            if let Ok(Some(d)) = manager
                .detect_version_with_sources(et, std::path::Path::new(&start_path), &sources)
                .await
            {
                detected.push(d);
            }
        }
        if json_mode {
            print_command_json(COMMAND, &detected);
        } else if detected.is_empty() {
            println!("No environments detected in {}", start_path);
        } else {
            let rows: Vec<Vec<String>> = detected
                .iter()
                .map(|d| vec![d.env_type.clone(), d.version.clone(), d.source.clone()])
                .collect();
            print_table(&["TYPE", "VERSION", "SOURCE"], &rows);
        }
    }
    EXIT_OK
}

async fn cmd_env_remove(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "env.remove";
    let version = match get_string(&matches.args, "version") {
        Some(v) => v,
        None => return usage_error(COMMAND, json_mode, "version is required"),
    };
    let env_type = match get_string(&matches.args, "type") {
        Some(t) => t,
        None => return usage_error(COMMAND, json_mode, "--type is required (e.g. --type node)"),
    };
    let provider_id = get_string(&matches.args, "provider");

    let manager = EnvironmentManager::new(ctx.registry.clone());
    match manager
        .uninstall_version(&env_type, &version, provider_id.as_deref())
        .await
    {
        Ok(()) => {
            if json_mode {
                print_command_json(
                    COMMAND,
                    &json!({ "env_type": env_type, "version": version, "status": "removed" }),
                );
            } else {
                println!("Removed {} {}", env_type, version);
            }
            EXIT_OK
        }
        Err(e) => runtime_error(COMMAND, json_mode, format!("Remove error: {}", e)),
    }
}

async fn cmd_env_resolve(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "env.resolve";
    let env_type = match get_string(&matches.args, "type") {
        Some(t) => t,
        None => return usage_error(COMMAND, json_mode, "--type is required"),
    };
    let start_path = get_string(&matches.args, "path").unwrap_or_else(|| ".".into());
    let manager = EnvironmentManager::new(ctx.registry.clone());
    let sources = crate::core::project_env_detect::default_enabled_detection_sources(&env_type);

    match manager
        .detect_version_with_sources(&env_type, Path::new(&start_path), &sources)
        .await
    {
        Ok(Some(detected)) => {
            if json_mode {
                print_command_json(
                    COMMAND,
                    &json!({
                        "env_type": detected.env_type,
                        "version": detected.version,
                        "source": detected.source,
                        "source_path": detected.source_path,
                        "path": start_path,
                    }),
                );
            } else {
                println!(
                    "{} {} (source: {}, path: {})",
                    detected.env_type, detected.version, detected.source, start_path
                );
            }
            EXIT_OK
        }
        Ok(None) => {
            if json_mode {
                print_command_json(
                    COMMAND,
                    &json!({
                        "env_type": env_type,
                        "version": serde_json::Value::Null,
                        "source": serde_json::Value::Null,
                        "path": start_path,
                    }),
                );
            } else {
                println!(
                    "No effective {} version resolved in {}",
                    env_type, start_path
                );
            }
            EXIT_OK
        }
        Err(e) => runtime_error(COMMAND, json_mode, format!("Resolve error: {}", e)),
    }
}

// ── Subcommand: config ───────────────────────────────────────────

async fn cmd_config(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "config";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                format!(
                    "config subcommand required ({})",
                    CONFIG_SUBCOMMANDS.join(", ")
                ),
            );
        }
    };
    match subcmd.name.as_str() {
        "get" => {
            let command = "config.get";
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(k) => k,
                None => return usage_error(command, json_mode, "key is required"),
            };
            match ctx.settings.get_value(&key) {
                Some(v) => {
                    if json_mode {
                        print_command_json(command, &serde_json::json!({ "key": key, "value": v }));
                    } else {
                        println!("{}", v);
                    }
                    EXIT_OK
                }
                None => runtime_error(command, json_mode, format!("Unknown key: {}", key)),
            }
        }
        "set" => {
            let command = "config.set";
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(k) => k,
                None => return usage_error(command, json_mode, "key is required"),
            };
            let value = match get_string(&subcmd.matches.args, "value") {
                Some(v) => v,
                None => return usage_error(command, json_mode, "value is required"),
            };
            let mut settings = ctx.settings.clone();
            if let Err(e) = settings.set_value(&key, &value) {
                return runtime_error(command, json_mode, e.to_string());
            }
            if let Err(e) = settings.save().await {
                return runtime_error(command, json_mode, format!("Error saving: {}", e));
            }
            if json_mode {
                print_command_json(command, &serde_json::json!({ "key": key, "value": value }));
            } else {
                println!("Set {} = {}", key, value);
            }
            EXIT_OK
        }
        "list" => {
            let command = "config.list";
            let entries = collect_config_list(&ctx.settings);
            if json_mode {
                let map: serde_json::Map<String, serde_json::Value> = entries
                    .into_iter()
                    .map(|(k, v)| (k, serde_json::Value::String(v)))
                    .collect();
                print_command_json(command, &map);
            } else {
                let rows: Vec<Vec<String>> = entries
                    .iter()
                    .map(|(k, v)| vec![k.clone(), v.clone()])
                    .collect();
                print_table(&["KEY", "VALUE"], &rows);
            }
            EXIT_OK
        }
        "reset" => {
            let command = "config.reset";
            let defaults = Settings::default();
            if let Err(e) = defaults.save().await {
                return runtime_error(command, json_mode, e.to_string());
            }
            if json_mode {
                print_command_json(command, &serde_json::json!({ "status": "reset" }));
            } else {
                println!("Configuration reset to defaults");
            }
            EXIT_OK
        }
        "export" => {
            let command = "config.export";
            let file_path = match get_string(&subcmd.matches.args, "file") {
                Some(p) => p,
                None => return usage_error(command, json_mode, "file path is required"),
            };

            let toml_content = match toml::to_string_pretty(&ctx.settings) {
                Ok(content) => content,
                Err(e) => {
                    return runtime_error(
                        command,
                        json_mode,
                        format!("Failed to serialize config: {}", e),
                    )
                }
            };
            if let Err(e) =
                crate::platform::fs::write_file_atomic(&file_path, toml_content.as_bytes()).await
            {
                return runtime_error(
                    command,
                    json_mode,
                    format!("Failed to write config export '{}': {}", file_path, e),
                );
            }

            if json_mode {
                print_command_json(command, &json!({ "status": "exported", "file": file_path }));
            } else {
                println!("Configuration exported to {}", file_path);
            }
            EXIT_OK
        }
        "import" => {
            let command = "config.import";
            let file_path = match get_string(&subcmd.matches.args, "file") {
                Some(p) => p,
                None => return usage_error(command, json_mode, "file path is required"),
            };

            let content = match crate::platform::fs::read_file_string(&file_path).await {
                Ok(c) => c,
                Err(e) => {
                    return runtime_error(
                        command,
                        json_mode,
                        format!("Failed to read import file '{}': {}", file_path, e),
                    )
                }
            };
            let parsed = match parse_config_import_content(&file_path, &content) {
                Ok(settings) => settings,
                Err(e) => return runtime_error(command, json_mode, e),
            };

            if let Err(e) = parsed.save().await {
                return runtime_error(
                    command,
                    json_mode,
                    format!("Failed to persist imported config: {}", e),
                );
            }

            if json_mode {
                print_command_json(command, &json!({ "status": "imported", "file": file_path }));
            } else {
                println!("Configuration imported from {}", file_path);
            }
            EXIT_OK
        }
        other => usage_error(
            COMMAND,
            json_mode,
            format!("Unknown config subcommand: {}", other),
        ),
    }
}

// ── Subcommand: cache ────────────────────────────────────────────

async fn cmd_cache(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "cache";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                "cache subcommand required (info, clean)",
            )
        }
    };
    let cache_dir = ctx.settings.get_cache_dir();

    match subcmd.name.as_str() {
        "info" => {
            let command = "cache.info";
            let dl = DownloadCache::open(&cache_dir)
                .await
                .ok()
                .and_then(|c| tauri::async_runtime::block_on(c.stats()).ok());
            let md = MetadataCache::open_with_ttl(
                &cache_dir,
                ctx.settings.general.metadata_cache_ttl as i64,
            )
            .await
            .ok()
            .and_then(|c| tauri::async_runtime::block_on(c.stats()).ok());

            let dl_size = dl.as_ref().map(|s| s.total_size).unwrap_or(0);
            let dl_count = dl.as_ref().map(|s| s.entry_count).unwrap_or(0);
            let md_size = md.as_ref().map(|s| s.total_size).unwrap_or(0);
            let md_count = md.as_ref().map(|s| s.entry_count).unwrap_or(0);
            let total = dl_size + md_size;

            if json_mode {
                print_command_json(
                    command,
                    &serde_json::json!({
                        "download_cache": { "size": dl_size, "entries": dl_count },
                        "metadata_cache": { "size": md_size, "entries": md_count },
                        "total_size": total, "total_size_human": format_size(total),
                    }),
                );
            } else {
                println!("Cache Statistics:");
                println!(
                    "  Download cache: {} ({} entries)",
                    format_size(dl_size),
                    dl_count
                );
                println!(
                    "  Metadata cache: {} ({} entries)",
                    format_size(md_size),
                    md_count
                );
                println!("  Total:          {}", format_size(total));
            }
            EXIT_OK
        }
        "clean" => {
            let command = "cache.clean";
            let clean_all = get_flag(&subcmd.matches.args, "all");
            let clean_expired = get_flag(&subcmd.matches.args, "expired");
            let mut total_freed: u64 = 0;

            if clean_all || clean_expired {
                if let Ok(mut dl) = DownloadCache::open(&cache_dir).await {
                    let max_age = std::time::Duration::from_secs(
                        ctx.settings.general.cache_max_age_days as u64 * 86400,
                    );
                    if let Ok(freed) = dl.clean_expired(max_age).await {
                        total_freed += freed;
                    }
                }
                if let Ok(mut md) = MetadataCache::open_with_ttl(
                    &cache_dir,
                    ctx.settings.general.metadata_cache_ttl as i64,
                )
                .await
                {
                    let _ = md.clean_expired().await;
                }
            }
            if clean_all {
                if let Ok(mut dl) = DownloadCache::open(&cache_dir).await {
                    let _ = dl.evict_to_size(0).await;
                }
            }

            if json_mode {
                print_command_json(
                    command,
                    &serde_json::json!({ "freed_bytes": total_freed, "freed_human": format_size(total_freed) }),
                );
            } else {
                println!("Cache cleaned (freed {})", format_size(total_freed));
            }
            EXIT_OK
        }
        other => usage_error(
            COMMAND,
            json_mode,
            format!("Unknown cache subcommand: {}", other),
        ),
    }
}

// ── Subcommand: doctor ───────────────────────────────────────────

async fn cmd_doctor(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "doctor";
    let fix_id = get_string(&matches.args, "fix");
    let preview = get_flag(&matches.args, "preview");
    let type_filter = get_string(&matches.args, "type");
    let manager = HealthCheckManager::new(ctx.registry.clone());

    if preview && fix_id.is_none() {
        return usage_error(
            COMMAND,
            json_mode,
            "--preview requires --fix <remediation-id>",
        );
    }

    if let Some(remediation_id) = fix_id {
        match manager.apply_remediation(&remediation_id, preview).await {
            Ok(result) => {
                if json_mode {
                    print_command_json(COMMAND, &result);
                } else {
                    println!("Remediation: {}", result.remediation_id);
                    println!("  Message: {}", result.message);
                    if let Some(command) = &result.command {
                        println!("  Command: {}", command);
                    }
                    if let Some(stdout) = &result.stdout {
                        if !stdout.trim().is_empty() {
                            println!("  Stdout:\n{}", stdout.trim());
                        }
                    }
                    if let Some(stderr) = &result.stderr {
                        if !stderr.trim().is_empty() {
                            println!("  Stderr:\n{}", stderr.trim());
                        }
                    }
                }
                return if result.supported && (result.success || result.manual_only) {
                    EXIT_OK
                } else {
                    EXIT_ERROR
                };
            }
            Err(e) => {
                return runtime_error(
                    COMMAND,
                    json_mode,
                    format!("Health remediation error: {}", e),
                )
            }
        }
    }

    if let Some(ref env_type) = type_filter {
        if env_type.eq_ignore_ascii_case("envvar") {
            match manager.check_envvar_health().await {
                Ok(issues) => {
                    let status = doctor_status_from_issues(&issues);
                    let payload = doctor_envvar_payload(&issues);
                    if json_mode {
                        print_command_json(COMMAND, &payload);
                    } else {
                        print_envvar_health(&issues);
                    }
                    return doctor_exit_code(status);
                }
                Err(e) => {
                    return runtime_error(COMMAND, json_mode, format!("Health check error: {}", e));
                }
            }
        }
        match manager.check_environment(env_type).await {
            Ok(result) => {
                if json_mode {
                    print_command_json(COMMAND, &result);
                } else {
                    print_environment_health(env_type, &result);
                }
                doctor_exit_code(result.status)
            }
            Err(e) => runtime_error(COMMAND, json_mode, format!("Health check error: {}", e)),
        }
    } else {
        match manager.check_all_with_progress(|_| {}).await {
            Ok(result) => {
                if json_mode {
                    print_command_json(COMMAND, &result);
                } else {
                    print_system_health(&result);
                }
                doctor_exit_code(result.overall_status)
            }
            Err(e) => runtime_error(COMMAND, json_mode, format!("Health check error: {}", e)),
        }
    }
}

fn format_envvar_health(issues: &[crate::core::HealthIssue]) -> String {
    let mut lines = vec!["Environment Variables:".to_string()];
    if issues.is_empty() {
        lines.push("  No envvar diagnostics findings".to_string());
        return lines.join("\n");
    }

    for issue in issues {
        lines.push(format!("  - [{:?}] {}", issue.severity, issue.message));
        if let Some(check_id) = &issue.check_id {
            lines.push(format!("      check: {}", check_id));
        }
        if let Some(remediation_id) = &issue.remediation_id {
            lines.push(format!("      remediation: {}", remediation_id));
        }
        if let Some(command) = &issue.fix_command {
            lines.push(format!("      fix: {}", command));
        }
    }

    lines.join("\n")
}

fn doctor_exit_code(status: HealthStatus) -> i32 {
    match status {
        HealthStatus::Warning | HealthStatus::Error => EXIT_ERROR,
        HealthStatus::Healthy | HealthStatus::Unknown => EXIT_OK,
    }
}

fn scope_state_label(scope_state: Option<&HealthScopeState>) -> &'static str {
    match scope_state {
        Some(HealthScopeState::Available) | None => "available",
        Some(HealthScopeState::Unavailable) => "unavailable",
        Some(HealthScopeState::Timeout) => "timeout",
        Some(HealthScopeState::Unsupported) => "unsupported",
    }
}

fn print_environment_health(env_type: &str, result: &EnvironmentHealthResult) {
    println!("Health check for {}:", env_type);
    println!(
        "  Status: {:?} ({})",
        result.status,
        scope_state_label(Some(&result.scope_state))
    );
    if let Some(provider_id) = &result.provider_id {
        println!("  Provider: {}", provider_id);
    }
    for issue in &result.issues {
        println!("  - [{:?}] {}", issue.severity, issue.message);
        if let Some(remediation_id) = &issue.remediation_id {
            println!("      remediation: {}", remediation_id);
        }
        if let Some(command) = &issue.fix_command {
            println!("      fix: {}", command);
        }
    }
}

fn print_package_manager_health(result: &PackageManagerHealthResult) {
    println!(
        "  {} [{:?} / {}]:",
        result.display_name,
        result.status,
        scope_state_label(Some(&result.scope_state))
    );
    for issue in &result.issues {
        println!("    - [{:?}] {}", issue.severity, issue.message);
        if let Some(remediation_id) = &issue.remediation_id {
            println!("        remediation: {}", remediation_id);
        }
        if let Some(command) = &issue.fix_command {
            println!("        fix: {}", command);
        }
    }
}

fn print_system_health(result: &SystemHealthResult) {
    let has_findings = !result.system_issues.is_empty()
        || !result.envvar_issues.is_empty()
        || result.environments.iter().any(|env| !env.issues.is_empty())
        || result
            .package_managers
            .iter()
            .any(|provider| !provider.issues.is_empty());

    if !has_findings {
        println!("All health checks passed");
        return;
    }

    println!("Health diagnostics complete:\n");

    if !result.envvar_issues.is_empty() {
        print_envvar_health(&result.envvar_issues);
        println!();
    }

    if !result.system_issues.is_empty() {
        println!("System:");
        for issue in &result.system_issues {
            println!("  - [{:?}] {}", issue.severity, issue.message);
            if let Some(remediation_id) = &issue.remediation_id {
                println!("      remediation: {}", remediation_id);
            }
            if let Some(command) = &issue.fix_command {
                println!("      fix: {}", command);
            }
        }
        println!();
    }

    for env in &result.environments {
        if env.issues.is_empty() {
            continue;
        }
        print_environment_health(&env.env_type, env);
        println!();
    }

    let package_results: Vec<&PackageManagerHealthResult> = result
        .package_managers
        .iter()
        .filter(|provider| !provider.issues.is_empty())
        .collect();
    if !package_results.is_empty() {
        println!("Package Managers:");
        for provider in package_results {
            print_package_manager_health(provider);
        }
    }
}

fn print_envvar_health(issues: &[crate::core::HealthIssue]) {
    println!("{}", format_envvar_health(issues));
}

// ── Subcommand: providers ────────────────────────────────────────

async fn cmd_providers(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "providers";
    let system_only = get_flag(&matches.args, "system");
    let reg = ctx.registry.read().await;

    if system_only {
        let ids = reg.get_system_provider_ids();
        if json_mode {
            print_command_json(COMMAND, &ids);
        } else {
            println!("System providers:\n");
            for id in &ids {
                println!("  {}", id);
            }
        }
    } else {
        let providers = reg.list_all_info();
        if json_mode {
            print_command_json(COMMAND, &providers);
        } else {
            println!("{} provider(s) available:\n", providers.len());
            let rows: Vec<Vec<String>> = providers
                .iter()
                .map(|p| {
                    vec![
                        p.id.clone(),
                        p.display_name.clone(),
                        p.platforms
                            .iter()
                            .map(|pl| format!("{:?}", pl))
                            .collect::<Vec<_>>()
                            .join(", "),
                    ]
                })
                .collect();
            print_table(&["ID", "NAME", "PLATFORMS"], &rows);
        }
    }
    EXIT_OK
}

// ── Subcommand: backup ───────────────────────────────────────────

async fn cmd_backup(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "backup";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                format!(
                    "backup subcommand required ({})",
                    BACKUP_SUBCOMMANDS.join(", ")
                ),
            );
        }
    };

    match subcmd.name.as_str() {
        "list" => {
            let command = "backup.list";
            match backup::list_backups(&ctx.settings).await {
                Ok(items) => {
                    if json_mode {
                        print_command_json(command, &items);
                    } else if items.is_empty() {
                        println!("No backups found");
                    } else {
                        println!("{} backup(s):\n", items.len());
                        let rows: Vec<Vec<String>> = items
                            .iter()
                            .map(|item| {
                                vec![
                                    item.name.clone(),
                                    item.size_human.clone(),
                                    item.manifest.created_at.clone(),
                                    item.path.clone(),
                                ]
                            })
                            .collect();
                        print_table(&["NAME", "SIZE", "CREATED_AT", "PATH"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Backup list error: {}", e)),
            }
        }
        "create" => {
            let command = "backup.create";
            let contents =
                match parse_backup_contents(get_string_list(&subcmd.matches.args, "contents")) {
                    Ok(values) => values,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            let note = get_string(&subcmd.matches.args, "note");

            let (terminal_manager, profile_manager, custom_detection_manager) =
                match load_backup_dependencies(ctx).await {
                    Ok(values) => values,
                    Err(msg) => return runtime_error(command, json_mode, msg),
                };

            let result = backup::create_backup_with_result(
                &ctx.settings,
                &contents,
                note.as_deref(),
                &terminal_manager,
                &profile_manager,
                &custom_detection_manager,
            )
            .await;

            if json_mode {
                print_command_json(command, &result);
            } else {
                if !result.path.is_empty() {
                    println!("Backup created at: {}", result.path);
                }
                println!("Duration: {} ms", result.duration_ms);
                println!("Status: {:?}", result.status);
                if let Some(code) = &result.reason_code {
                    println!("Reason: {}", code);
                }
                if !result.issues.is_empty() {
                    for item in &result.issues {
                        if let Some(content_type) = &item.content_type {
                            eprintln!("Issue [{}] ({}): {}", item.code, content_type, item.message);
                        } else {
                            eprintln!("Issue [{}]: {}", item.code, item.message);
                        }
                    }
                }
                if let Some(err) = &result.error {
                    eprintln!("Error: {}", err);
                }
            }
            backup_status_exit_code(result.status)
        }
        "restore" => {
            let command = "backup.restore";
            let backup_path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "backup path is required"),
            };
            let contents =
                match parse_backup_contents(get_string_list(&subcmd.matches.args, "contents")) {
                    Ok(values) => values,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };

            let (mut terminal_manager, mut profile_manager, mut custom_detection_manager) =
                match load_backup_dependencies(ctx).await {
                    Ok(values) => values,
                    Err(msg) => return runtime_error(command, json_mode, msg),
                };
            let mut settings = ctx.settings.clone();

            let result = backup::restore_backup_with_result(
                Path::new(&backup_path),
                &contents,
                &mut settings,
                &mut terminal_manager,
                &mut profile_manager,
                &mut custom_detection_manager,
            )
            .await;

            if json_mode {
                print_command_json(command, &result);
            } else {
                println!("Restore success: {}", result.success);
                println!("Status: {:?}", result.status);
                if let Some(code) = &result.reason_code {
                    println!("Reason: {}", code);
                }
                if !result.restored.is_empty() {
                    println!("Restored: {}", result.restored.join(", "));
                }
                if !result.skipped.is_empty() {
                    for item in &result.skipped {
                        eprintln!("Skipped {}: {}", item.content_type, item.reason);
                    }
                }
                if !result.issues.is_empty() {
                    for item in &result.issues {
                        if let Some(content_type) = &item.content_type {
                            eprintln!("Issue [{}] ({}): {}", item.code, content_type, item.message);
                        } else {
                            eprintln!("Issue [{}]: {}", item.code, item.message);
                        }
                    }
                }
                if let Some(err) = &result.error {
                    eprintln!("Error: {}", err);
                }
            }
            backup_status_exit_code(result.status)
        }
        "delete" => {
            let command = "backup.delete";
            let backup_path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "backup path is required"),
            };

            let result = backup::delete_backup_with_result(Path::new(&backup_path)).await;
            if json_mode {
                print_command_json(command, &result);
            } else {
                println!("Delete success: {}", result.success);
                println!("Status: {:?}", result.status);
                if let Some(code) = &result.reason_code {
                    println!("Reason: {}", code);
                }
                if result.deleted {
                    println!("Deleted backup: {}", result.path);
                } else {
                    println!("Backup not deleted: {}", result.path);
                }
                if !result.issues.is_empty() {
                    for item in &result.issues {
                        eprintln!("Issue [{}]: {}", item.code, item.message);
                    }
                }
                if let Some(err) = &result.error {
                    eprintln!("Error: {}", err);
                }
            }
            backup_status_exit_code(result.status)
        }
        other => usage_error(
            COMMAND,
            json_mode,
            format!("Unknown backup subcommand: {}", other),
        ),
    }
}

fn backup_status_exit_code(status: backup::BackupOperationStatus) -> i32 {
    if matches!(status, backup::BackupOperationStatus::Success) {
        EXIT_OK
    } else {
        EXIT_ERROR
    }
}

// ── Subcommand: profiles ────────────────────────────────────────

async fn cmd_profiles(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "profiles";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                format!(
                    "profiles subcommand required ({})",
                    PROFILES_SUBCOMMANDS.join(", ")
                ),
            );
        }
    };

    match subcmd.name.as_str() {
        "list" => {
            let command = "profiles.list";
            let manager = match load_profile_manager(ctx).await {
                Ok(mgr) => mgr,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };
            let profiles = manager.list();
            if json_mode {
                print_command_json(command, &profiles);
            } else if profiles.is_empty() {
                println!("No profiles found");
            } else {
                println!("{} profile(s):\n", profiles.len());
                let rows: Vec<Vec<String>> = profiles
                    .iter()
                    .map(|p| {
                        vec![
                            p.id.clone(),
                            p.name.clone(),
                            p.environments.len().to_string(),
                            p.updated_at.clone(),
                        ]
                    })
                    .collect();
                print_table(&["ID", "NAME", "ENVS", "UPDATED_AT"], &rows);
            }
            EXIT_OK
        }
        "get" => {
            let command = "profiles.get";
            let id = match get_string(&subcmd.matches.args, "id") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "profile id is required"),
            };
            let manager = match load_profile_manager(ctx).await {
                Ok(mgr) => mgr,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };
            match manager.get(&id) {
                Some(profile) => {
                    if json_mode {
                        print_command_json(command, &profile);
                    } else {
                        println!("Profile: {} ({})", profile.name, profile.id);
                        println!("Environments: {}", profile.environments.len());
                    }
                    EXIT_OK
                }
                None => runtime_error(command, json_mode, format!("Profile not found: {}", id)),
            }
        }
        "apply" => {
            let command = "profiles.apply";
            let id = match get_string(&subcmd.matches.args, "id") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "profile id is required"),
            };
            let manager = match load_profile_manager(ctx).await {
                Ok(mgr) => mgr,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };
            match manager.apply(&id).await {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else {
                        println!("Applied profile: {}", result.profile_name);
                        println!(
                            "Successful: {}, Failed: {}, Skipped: {}",
                            result.successful.len(),
                            result.failed.len(),
                            result.skipped.len()
                        );
                    }
                    if result.failed.is_empty() {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(command, json_mode, format!("Profile apply error: {}", e)),
            }
        }
        "export" => {
            let command = "profiles.export";
            let id = match get_string(&subcmd.matches.args, "id") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "profile id is required"),
            };
            let out_path = get_string(&subcmd.matches.args, "out");
            let manager = match load_profile_manager(ctx).await {
                Ok(mgr) => mgr,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };
            match manager.export(&id) {
                Ok(payload) => {
                    if let Some(ref file_path) = out_path {
                        if let Err(msg) = write_text_file(file_path, &payload) {
                            return runtime_error(command, json_mode, msg);
                        }
                    }

                    if json_mode {
                        match serde_json::from_str::<serde_json::Value>(&payload) {
                            Ok(profile_json) => {
                                print_command_json(
                                    command,
                                    &json!({
                                        "profile": profile_json,
                                        "out": out_path,
                                    }),
                                );
                            }
                            Err(e) => {
                                return runtime_error(
                                    command,
                                    json_mode,
                                    format!("Failed to parse exported profile JSON: {}", e),
                                );
                            }
                        }
                    } else if let Some(file_path) = out_path {
                        println!("Profile exported to {}", file_path);
                    } else {
                        println!("{}", payload);
                    }

                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Profile export error: {}", e)),
            }
        }
        "import" => {
            let command = "profiles.import";
            let file_path = match get_string(&subcmd.matches.args, "file") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "input file path is required"),
            };
            let payload = match read_text_file(&file_path) {
                Ok(content) => content,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };
            let mut manager = match load_profile_manager(ctx).await {
                Ok(mgr) => mgr,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };
            match manager.import(&payload).await {
                Ok(profile) => {
                    if json_mode {
                        print_command_json(command, &profile);
                    } else {
                        println!("Imported profile: {} ({})", profile.name, profile.id);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Profile import error: {}", e)),
            }
        }
        "create-from-current" => {
            let command = "profiles.create-from-current";
            let name = match get_string(&subcmd.matches.args, "name") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "profile name is required"),
            };
            let mut manager = match load_profile_manager(ctx).await {
                Ok(mgr) => mgr,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };
            match manager.create_from_current(&name, false, false).await {
                Ok(profile) => {
                    if json_mode {
                        print_command_json(command, &profile);
                    } else {
                        println!(
                            "Created profile from current env: {} ({})",
                            profile.name, profile.id
                        );
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("Create profile from current error: {}", e),
                ),
            }
        }
        other => usage_error(
            COMMAND,
            json_mode,
            format!("Unknown profiles subcommand: {}", other),
        ),
    }
}

// ── Subcommand: envvar ──────────────────────────────────────────

async fn cmd_envvar(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "envvar";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                format!(
                    "envvar subcommand required ({})",
                    ENVVAR_SUBCOMMANDS.join(", ")
                ),
            );
        }
    };

    match subcmd.name.as_str() {
        "list" => {
            let command = "envvar.list";
            let vars = env::get_all_vars();
            if json_mode {
                print_command_json(command, &vars);
            } else if vars.is_empty() {
                println!("No process environment variables found");
            } else {
                let mut rows: Vec<Vec<String>> =
                    vars.into_iter().map(|(k, v)| vec![k, v]).collect();
                rows.sort_by(|a, b| a[0].cmp(&b[0]));
                print_table(&["KEY", "VALUE"], &rows);
            }
            EXIT_OK
        }
        "get" => {
            let command = "envvar.get";
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(value) => value,
                None => {
                    return usage_error(command, json_mode, "environment variable key is required")
                }
            };
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            let value_result = env::get_persistent_var(&key, scope)
                .await
                .map_err(|e| e.to_string());
            match value_result {
                Ok(value) => {
                    if json_mode {
                        print_command_json(
                            command,
                            &json!({ "key": key, "scope": scope_to_string(scope), "value": value }),
                        );
                    } else if let Some(val) = value {
                        println!("{}={}", key, val);
                    } else {
                        println!("{} is not set", key);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Get env var error: {}", e)),
            }
        }
        "set" => {
            let command = "envvar.set";
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(value) => value,
                None => {
                    return usage_error(command, json_mode, "environment variable key is required")
                }
            };
            let value = match get_string(&subcmd.matches.args, "value") {
                Some(v) => v,
                None => {
                    return usage_error(
                        command,
                        json_mode,
                        "environment variable value is required",
                    )
                }
            };
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            let set_result = match scope {
                EnvVarScope::Process => {
                    crate::commands::envvar::envvar_set_process(key.clone(), value.clone()).await
                }
                _ => {
                    crate::commands::envvar::envvar_set_persistent(
                        key.clone(),
                        value.clone(),
                        scope,
                    )
                    .await
                }
            };
            match set_result {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if result.success {
                        println!(
                            "Set {} ({}) [{}]",
                            key,
                            scope_to_string(scope),
                            result.status
                        );
                        if let Some(message) = result.message {
                            println!("{}", message);
                        }
                    } else {
                        eprintln!(
                            "Set {} ({}) blocked: {}",
                            key,
                            scope_to_string(scope),
                            result
                                .message
                                .unwrap_or_else(|| "unknown error".to_string())
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(command, json_mode, format!("Set env var error: {}", e)),
            }
        }
        "remove" => {
            let command = "envvar.remove";
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(value) => value,
                None => {
                    return usage_error(command, json_mode, "environment variable key is required")
                }
            };
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            let remove_result = match scope {
                EnvVarScope::Process => {
                    crate::commands::envvar::envvar_remove_process(key.clone()).await
                }
                _ => crate::commands::envvar::envvar_remove_persistent(key.clone(), scope).await,
            };
            match remove_result {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if result.success {
                        println!(
                            "Removed {} ({}) [{}]",
                            key,
                            scope_to_string(scope),
                            result.status
                        );
                        if let Some(message) = result.message {
                            println!("{}", message);
                        }
                    } else {
                        eprintln!(
                            "Remove {} ({}) blocked: {}",
                            key,
                            scope_to_string(scope),
                            result
                                .message
                                .unwrap_or_else(|| "unknown error".to_string())
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(command, json_mode, format!("Remove env var error: {}", e)),
            }
        }
        "list-persistent" => {
            let command = "envvar.list-persistent";
            let scope =
                match parse_env_scope(get_string(&subcmd.matches.args, "scope"), EnvVarScope::User)
                {
                    Ok(value) => value,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            match env::list_persistent_vars(scope).await {
                Ok(items) => {
                    if json_mode {
                        print_command_json(
                            command,
                            &json!({ "scope": scope_to_string(scope), "items": items }),
                        );
                    } else if items.is_empty() {
                        println!(
                            "No persistent variables found for {}",
                            scope_to_string(scope)
                        );
                    } else {
                        let rows: Vec<Vec<String>> = items
                            .iter()
                            .map(|(k, v)| vec![k.clone(), v.clone()])
                            .collect();
                        print_table(&["KEY", "VALUE"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("List persistent vars error: {}", e),
                ),
            }
        }
        "list-persistent-typed" => {
            let command = "envvar.list-persistent-typed";
            let scope =
                match parse_env_scope(get_string(&subcmd.matches.args, "scope"), EnvVarScope::User)
                {
                    Ok(value) => value,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            #[cfg(windows)]
            let typed_result = env::list_persistent_vars_with_type(scope)
                .await
                .map(|items| {
                    items
                        .into_iter()
                        .map(|(key, value, reg_type)| json!({
                            "key": key,
                            "value": value,
                            "regType": if reg_type.is_empty() { serde_json::Value::Null } else { json!(reg_type) },
                        }))
                        .collect::<Vec<serde_json::Value>>()
                });
            #[cfg(not(windows))]
            let typed_result = env::list_persistent_vars(scope).await.map(|items| {
                items
                    .into_iter()
                    .map(|(key, value)| {
                        json!({
                            "key": key,
                            "value": value,
                            "regType": serde_json::Value::Null,
                        })
                    })
                    .collect::<Vec<serde_json::Value>>()
            });

            match typed_result {
                Ok(items) => {
                    if json_mode {
                        print_command_json(
                            command,
                            &json!({ "scope": scope_to_string(scope), "items": items }),
                        );
                    } else if items.is_empty() {
                        println!(
                            "No persistent variables found for {}",
                            scope_to_string(scope)
                        );
                    } else {
                        let rows: Vec<Vec<String>> = items
                            .iter()
                            .map(|item| {
                                vec![
                                    item["key"].as_str().unwrap_or_default().to_string(),
                                    item["value"].as_str().unwrap_or_default().to_string(),
                                    item["regType"].as_str().unwrap_or("-").to_string(),
                                ]
                            })
                            .collect();
                        print_table(&["KEY", "VALUE", "REG_TYPE"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("List typed persistent vars error: {}", e),
                ),
            }
        }
        "set-persistent" => {
            let command = "envvar.set-persistent";
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(value) => value,
                None => {
                    return usage_error(command, json_mode, "environment variable key is required")
                }
            };
            let value = match get_string(&subcmd.matches.args, "value") {
                Some(v) => v,
                None => {
                    return usage_error(
                        command,
                        json_mode,
                        "environment variable value is required",
                    )
                }
            };
            let scope =
                match parse_env_scope(get_string(&subcmd.matches.args, "scope"), EnvVarScope::User)
                {
                    Ok(value) => value,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            match crate::commands::envvar::envvar_set_persistent(key.clone(), value.clone(), scope)
                .await
            {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if result.success {
                        println!(
                            "Set persistent {} ({}) [{}]",
                            key,
                            scope_to_string(scope),
                            result.status
                        );
                    } else {
                        eprintln!(
                            "Set persistent {} ({}) blocked: {}",
                            key,
                            scope_to_string(scope),
                            result
                                .message
                                .unwrap_or_else(|| "unknown error".to_string())
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("Set persistent env var error: {}", e),
                ),
            }
        }
        "remove-persistent" => {
            let command = "envvar.remove-persistent";
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(value) => value,
                None => {
                    return usage_error(command, json_mode, "environment variable key is required")
                }
            };
            let scope =
                match parse_env_scope(get_string(&subcmd.matches.args, "scope"), EnvVarScope::User)
                {
                    Ok(value) => value,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            match crate::commands::envvar::envvar_remove_persistent(key.clone(), scope).await {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if result.success {
                        println!(
                            "Removed persistent {} ({}) [{}]",
                            key,
                            scope_to_string(scope),
                            result.status
                        );
                    } else {
                        eprintln!(
                            "Remove persistent {} ({}) blocked: {}",
                            key,
                            scope_to_string(scope),
                            result
                                .message
                                .unwrap_or_else(|| "unknown error".to_string())
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("Remove persistent env var error: {}", e),
                ),
            }
        }
        "get-path" => {
            let command = "envvar.get-path";
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            match env::get_persistent_path(scope).await {
                Ok(entries) => {
                    if json_mode {
                        print_command_json(
                            command,
                            &json!({ "scope": scope_to_string(scope), "entries": entries }),
                        );
                    } else if entries.is_empty() {
                        println!("No PATH entries found for {}", scope_to_string(scope));
                    } else {
                        let rows: Vec<Vec<String>> = entries
                            .iter()
                            .enumerate()
                            .map(|(index, value)| vec![(index + 1).to_string(), value.clone()])
                            .collect();
                        print_table(&["#", "PATH_ENTRY"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Get PATH error: {}", e)),
            }
        }
        "add-path" => {
            let command = "envvar.add-path";
            let path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "path value is required"),
            };
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            let position = get_string(&subcmd.matches.args, "position")
                .map(|value| {
                    value
                        .parse::<usize>()
                        .map_err(|_| "position must be a non-negative integer".to_string())
                })
                .transpose();
            let position = match position {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };

            match crate::commands::envvar::envvar_add_path_entry(path.clone(), scope, position)
                .await
            {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if result.success {
                        println!(
                            "Added PATH entry ({}) [{}]",
                            scope_to_string(scope),
                            result.status
                        );
                    } else {
                        eprintln!(
                            "Add PATH entry blocked ({}) : {}",
                            scope_to_string(scope),
                            result
                                .message
                                .unwrap_or_else(|| "unknown error".to_string())
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(command, json_mode, format!("Add PATH error: {}", e)),
            }
        }
        "remove-path" => {
            let command = "envvar.remove-path";
            let path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "path value is required"),
            };
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            match crate::commands::envvar::envvar_remove_path_entry(path.clone(), scope).await {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if result.success {
                        println!(
                            "Removed PATH entry ({}) [{}]",
                            scope_to_string(scope),
                            result.status
                        );
                    } else {
                        eprintln!(
                            "Remove PATH entry blocked ({}) : {}",
                            scope_to_string(scope),
                            result
                                .message
                                .unwrap_or_else(|| "unknown error".to_string())
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(command, json_mode, format!("Remove PATH error: {}", e)),
            }
        }
        "reorder-path" => {
            let command = "envvar.reorder-path";
            let entries = get_string_list(&subcmd.matches.args, "entries");
            if entries.is_empty() {
                return usage_error(command, json_mode, "at least one path entry is required");
            }
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            match crate::commands::envvar::envvar_reorder_path(entries.clone(), scope).await {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if result.success {
                        println!(
                            "Reordered {} PATH entries ({}) [{}]",
                            entries.len(),
                            scope_to_string(scope),
                            result.status
                        );
                    } else {
                        eprintln!(
                            "Reorder PATH blocked ({}) : {}",
                            scope_to_string(scope),
                            result
                                .message
                                .unwrap_or_else(|| "unknown error".to_string())
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(command, json_mode, format!("Reorder PATH error: {}", e)),
            }
        }
        "deduplicate-path" => {
            let command = "envvar.deduplicate-path";
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            match crate::commands::envvar::envvar_deduplicate_path(scope).await {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else {
                        println!(
                            "Removed {} duplicate PATH entries ({}) [{}]",
                            result.removed_count,
                            scope_to_string(scope),
                            result.status
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => {
                    runtime_error(command, json_mode, format!("Deduplicate PATH error: {}", e))
                }
            }
        }
        "detect-conflicts" => {
            let command = "envvar.detect-conflicts";
            let result = async {
                let user_vars = env::list_persistent_vars(EnvVarScope::User).await?;
                let system_vars = env::list_persistent_vars(EnvVarScope::System).await?;
                let system_map: std::collections::HashMap<String, String> =
                    system_vars.into_iter().collect();
                let mut conflicts = Vec::new();

                for (key, user_value) in &user_vars {
                    let lookup_key = if cfg!(windows) {
                        system_map
                            .iter()
                            .find(|(k, _)| k.eq_ignore_ascii_case(key))
                            .map(|(k, v)| (k.clone(), v.clone()))
                    } else {
                        system_map.get(key).map(|v| (key.clone(), v.clone()))
                    };

                    if let Some((sys_key, system_value)) = lookup_key {
                        if *user_value != system_value {
                            let effective = env::get_var(key)
                                .or_else(|| env::get_var(&sys_key))
                                .unwrap_or_default();
                            conflicts.push(json!({
                                "key": key,
                                "userValue": user_value,
                                "systemValue": system_value,
                                "effectiveValue": effective,
                            }));
                        }
                    }
                }

                Ok::<Vec<serde_json::Value>, CogniaError>(conflicts)
            }
            .await;

            match result {
                Ok(conflicts) => {
                    if json_mode {
                        print_command_json(command, &conflicts);
                    } else if conflicts.is_empty() {
                        println!("No user/system environment conflicts detected");
                    } else {
                        let rows: Vec<Vec<String>> = conflicts
                            .iter()
                            .map(|conflict| {
                                vec![
                                    conflict["key"].as_str().unwrap_or_default().to_string(),
                                    conflict["userValue"]
                                        .as_str()
                                        .unwrap_or_default()
                                        .to_string(),
                                    conflict["systemValue"]
                                        .as_str()
                                        .unwrap_or_default()
                                        .to_string(),
                                    conflict["effectiveValue"]
                                        .as_str()
                                        .unwrap_or_default()
                                        .to_string(),
                                ]
                            })
                            .collect();
                        print_table(
                            &["KEY", "USER_VALUE", "SYSTEM_VALUE", "EFFECTIVE_VALUE"],
                            &rows,
                        );
                    }
                    EXIT_OK
                }
                Err(e) => {
                    runtime_error(command, json_mode, format!("Detect conflict error: {}", e))
                }
            }
        }
        "list-shell-profiles" => {
            let command = "envvar.list-shell-profiles";
            let profiles = env::list_shell_profiles();
            if json_mode {
                print_command_json(command, &profiles);
            } else if profiles.is_empty() {
                println!("No shell profiles detected");
            } else {
                let rows: Vec<Vec<String>> = profiles
                    .iter()
                    .map(|profile| {
                        vec![
                            profile.shell.clone(),
                            profile.config_path.clone(),
                            profile.exists.to_string(),
                            profile.is_current.to_string(),
                        ]
                    })
                    .collect();
                print_table(&["SHELL", "CONFIG_PATH", "EXISTS", "CURRENT"], &rows);
            }
            EXIT_OK
        }
        "read-shell-profile" => {
            let command = "envvar.read-shell-profile";
            let path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "profile path is required"),
            };
            match env::read_shell_profile(&path) {
                Ok(content) => {
                    if json_mode {
                        print_command_json(command, &json!({ "path": path, "content": content }));
                    } else {
                        println!("{}", content);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("Read shell profile error: {}", e),
                ),
            }
        }
        "expand-path" => {
            let command = "envvar.expand-path";
            let path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "path value is required"),
            };
            let expanded = env::expand_path(&path);
            if json_mode {
                print_command_json(command, &json!({ "input": path, "expanded": expanded }));
            } else {
                println!("{}", expanded);
            }
            EXIT_OK
        }
        "export" => {
            let command = "envvar.export";
            let file_path = match get_string(&subcmd.matches.args, "file") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "output file path is required"),
            };
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            let format = match parse_env_file_format(get_string(&subcmd.matches.args, "format")) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };

            let vars: Result<Vec<(String, String)>, String> = match scope {
                EnvVarScope::Process => {
                    let mut values: Vec<(String, String)> =
                        env::get_all_vars().into_iter().collect();
                    values.sort_by(|a, b| a.0.cmp(&b.0));
                    Ok(values)
                }
                _ => env::list_persistent_vars(scope)
                    .await
                    .map_err(|e| e.to_string()),
            };

            match vars {
                Ok(values) => {
                    let content = env::generate_env_file(&values, format);
                    if let Err(msg) = write_text_file(&file_path, &content) {
                        return runtime_error(command, json_mode, msg);
                    }
                    if json_mode {
                        print_command_json(
                            command,
                            &json!({ "file": file_path, "scope": scope_to_string(scope), "count": values.len() }),
                        );
                    } else {
                        println!("Exported {} variables to {}", values.len(), file_path);
                    }
                    EXIT_OK
                }
                Err(e) => {
                    runtime_error(command, json_mode, format!("Export env vars error: {}", e))
                }
            }
        }
        "import" => {
            let command = "envvar.import";
            let file_path = match get_string(&subcmd.matches.args, "file") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "input file path is required"),
            };
            let scope =
                match parse_env_scope(get_string(&subcmd.matches.args, "scope"), EnvVarScope::User)
                {
                    Ok(value) => value,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            let content = match read_text_file(&file_path) {
                Ok(text) => text,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };
            match crate::commands::envvar::envvar_import_env_file(content, scope).await {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else {
                        println!(
                            "Imported {} variable(s), skipped {} [{}]",
                            result.imported, result.skipped, result.status
                        );
                        for err in &result.errors {
                            eprintln!("Failed: {}", err);
                        }
                        if let Some(message) = &result.message {
                            println!("{}", message);
                        }
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => {
                    runtime_error(command, json_mode, format!("Import env vars error: {}", e))
                }
            }
        }
        "preview-import" => {
            let command = "envvar.preview-import";
            let file_path = match get_string(&subcmd.matches.args, "file") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "input file path is required"),
            };
            let scope =
                match parse_env_scope(get_string(&subcmd.matches.args, "scope"), EnvVarScope::User)
                {
                    Ok(value) => value,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            let content = match read_text_file(&file_path) {
                Ok(text) => text,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };

            match crate::commands::envvar::envvar_preview_import_env_file(content, scope).await {
                Ok(preview) => {
                    if json_mode {
                        print_command_json(command, &preview);
                    } else {
                        println!(
                            "Preview ready: {} add, {} update, {} noop, {} invalid, {} skipped",
                            preview.additions,
                            preview.updates,
                            preview.noops,
                            preview.invalid,
                            preview.skipped
                        );
                        println!("Fingerprint: {}", preview.fingerprint);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Preview import error: {}", e)),
            }
        }
        "apply-import" => {
            let command = "envvar.apply-import";
            let file_path = match get_string(&subcmd.matches.args, "file") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "input file path is required"),
            };
            let fingerprint = match get_string(&subcmd.matches.args, "fingerprint") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "preview fingerprint is required"),
            };
            let scope =
                match parse_env_scope(get_string(&subcmd.matches.args, "scope"), EnvVarScope::User)
                {
                    Ok(value) => value,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            let content = match read_text_file(&file_path) {
                Ok(text) => text,
                Err(msg) => return runtime_error(command, json_mode, msg),
            };

            match crate::commands::envvar::envvar_apply_import_preview(content, scope, fingerprint)
                .await
            {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else {
                        println!(
                            "Imported {} variable(s), skipped {} [{}]",
                            result.imported, result.skipped, result.status
                        );
                        if let Some(message) = &result.message {
                            println!("{}", message);
                        }
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(command, json_mode, format!("Apply import error: {}", e)),
            }
        }
        "preview-path-repair" => {
            let command = "envvar.preview-path-repair";
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };

            match crate::commands::envvar::envvar_preview_path_repair(scope).await {
                Ok(preview) => {
                    if json_mode {
                        print_command_json(command, &preview);
                    } else {
                        println!(
                            "PATH repair preview: {} duplicate, {} missing, {} removed",
                            preview.duplicate_count, preview.missing_count, preview.removed_count
                        );
                        println!("Fingerprint: {}", preview.fingerprint);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("Preview PATH repair error: {}", e),
                ),
            }
        }
        "apply-path-repair" => {
            let command = "envvar.apply-path-repair";
            let fingerprint = match get_string(&subcmd.matches.args, "fingerprint") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "preview fingerprint is required"),
            };
            let scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "scope"),
                EnvVarScope::Process,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };

            match crate::commands::envvar::envvar_apply_path_repair(scope, fingerprint).await {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else {
                        println!(
                            "Applied {}: removed {} PATH entrie(s) [{}]",
                            result.operation, result.removed_count, result.status
                        );
                        if let Some(message) = &result.message {
                            println!("{}", message);
                        }
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("Apply PATH repair error: {}", e),
                ),
            }
        }
        "resolve-conflict" => {
            let command = "envvar.resolve-conflict";
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(value) => value,
                None => {
                    return usage_error(command, json_mode, "environment variable key is required")
                }
            };
            let source_scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "source-scope"),
                EnvVarScope::User,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            let target_scope = match parse_env_scope(
                get_string(&subcmd.matches.args, "target-scope"),
                EnvVarScope::System,
            ) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };

            match crate::commands::envvar::envvar_resolve_conflict(key, source_scope, target_scope)
                .await
            {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if result.success {
                        println!(
                            "Applied conflict_resolve to {} using {} scope value [{}]",
                            scope_to_string(result.target_scope),
                            scope_to_string(result.source_scope),
                            result.status
                        );
                        if let Some(message) = &result.message {
                            println!("{}", message);
                        }
                    } else {
                        eprintln!(
                            "Resolve conflict blocked: {}",
                            result
                                .message
                                .unwrap_or_else(|| "unknown error".to_string())
                        );
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => {
                    runtime_error(command, json_mode, format!("Resolve conflict error: {}", e))
                }
            }
        }
        "shell-guidance" => {
            let command = "envvar.shell-guidance";
            let key = get_string(&subcmd.matches.args, "key");
            let value = get_string(&subcmd.matches.args, "value");
            let entries = get_string_list(&subcmd.matches.args, "entries");
            let auto_applied_shell = get_string(&subcmd.matches.args, "auto-applied-shell");

            let path_entries = if entries.is_empty() {
                None
            } else {
                Some(entries)
            };

            match crate::commands::envvar::envvar_generate_shell_guidance(
                key,
                value,
                path_entries,
                auto_applied_shell,
                None,
            ) {
                Ok(guidance) => {
                    if json_mode {
                        print_command_json(command, &guidance);
                    } else if guidance.is_empty() {
                        println!("No shell guidance generated");
                    } else {
                        let rows: Vec<Vec<String>> = guidance
                            .iter()
                            .map(|entry| {
                                vec![
                                    entry.shell.clone(),
                                    entry.config_path.clone(),
                                    if entry.auto_applied {
                                        "yes".into()
                                    } else {
                                        "no".into()
                                    },
                                ]
                            })
                            .collect();
                        print_table(&["SHELL", "CONFIG", "AUTO_APPLIED"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Shell guidance error: {}", e)),
            }
        }
        "snapshot-list" => {
            let command = "envvar.snapshot-list";
            match crate::commands::envvar::list_envvar_snapshot_bundles(&ctx.settings).await {
                Ok(snapshots) => {
                    if json_mode {
                        print_command_json(command, &snapshots);
                    } else if snapshots.is_empty() {
                        println!("No envvar snapshots found");
                    } else {
                        let rows: Vec<Vec<String>> = snapshots
                            .iter()
                            .map(|item| {
                                vec![
                                    item.name.clone(),
                                    item.creation_mode.as_str().to_string(),
                                    item.source_action
                                        .clone()
                                        .unwrap_or_else(|| "-".to_string()),
                                    item.scopes
                                        .iter()
                                        .map(|scope| scope_to_string(*scope))
                                        .collect::<Vec<_>>()
                                        .join(","),
                                    item.integrity_state.clone(),
                                ]
                            })
                            .collect();
                        print_table(&["NAME", "MODE", "SOURCE", "SCOPES", "INTEGRITY"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Snapshot list error: {}", e)),
            }
        }
        "snapshot-create" => {
            let command = "envvar.snapshot-create";
            let mode = match parse_envvar_snapshot_mode(get_string(&subcmd.matches.args, "mode")) {
                Ok(value) => value,
                Err(msg) => return usage_error(command, json_mode, msg),
            };
            let scope_values = get_string_list(&subcmd.matches.args, "scopes");
            let scopes = if scope_values.is_empty() {
                vec![EnvVarScope::User, EnvVarScope::System]
            } else {
                let mut parsed = Vec::new();
                for raw_scope in scope_values {
                    match parse_env_scope(Some(raw_scope), EnvVarScope::User) {
                        Ok(scope) => parsed.push(scope),
                        Err(msg) => return usage_error(command, json_mode, msg),
                    }
                }
                parsed
            };
            let source_action = get_string(&subcmd.matches.args, "source-action");
            let note = get_string(&subcmd.matches.args, "note");

            let payload =
                match crate::commands::envvar::capture_envvar_snapshot_payload(&scopes).await {
                    Ok(value) => value,
                    Err(e) => {
                        return runtime_error(
                            command,
                            json_mode,
                            format!("Snapshot capture error: {}", e),
                        )
                    }
                };
            match crate::commands::envvar::write_envvar_snapshot_bundle(
                &ctx.settings,
                &payload,
                mode,
                source_action.as_deref(),
                note.as_deref(),
                None,
            )
            .await
            {
                Ok(snapshot) => {
                    if json_mode {
                        print_command_json(command, &snapshot);
                    } else {
                        println!("Created envvar snapshot: {}", snapshot.path);
                    }
                    EXIT_OK
                }
                Err(e) => {
                    runtime_error(command, json_mode, format!("Snapshot create error: {}", e))
                }
            }
        }
        "snapshot-protection" => {
            let command = "envvar.snapshot-protection";
            let action = match get_string(&subcmd.matches.args, "action") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "action is required"),
            };
            let scope =
                match parse_env_scope(get_string(&subcmd.matches.args, "scope"), EnvVarScope::User)
                {
                    Ok(value) => value,
                    Err(msg) => return usage_error(command, json_mode, msg),
                };
            match crate::commands::envvar::get_envvar_backup_protection_for_settings(
                &ctx.settings,
                &action,
                scope,
            )
            .await
            {
                Ok(state) => {
                    if json_mode {
                        print_command_json(command, &state);
                    } else {
                        println!(
                            "Protection state for {}: {} [{}]",
                            state.action, state.state, state.reason_code
                        );
                        println!("{}", state.reason);
                    }
                    if matches!(state.state.as_str(), "will_create" | "will_reuse") {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => runtime_error(
                    command,
                    json_mode,
                    format!("Snapshot protection error: {}", e),
                ),
            }
        }
        "snapshot-preview" => {
            let command = "envvar.snapshot-preview";
            let path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "snapshot path is required"),
            };
            let scope_values = get_string_list(&subcmd.matches.args, "scopes");
            let mut scopes = Vec::new();
            for raw_scope in scope_values {
                match parse_env_scope(Some(raw_scope), EnvVarScope::User) {
                    Ok(scope) => scopes.push(scope),
                    Err(msg) => return usage_error(command, json_mode, msg),
                }
            }
            match crate::commands::envvar::preview_envvar_snapshot_for_settings(
                &ctx.settings,
                &path,
                &scopes,
            )
            .await
            {
                Ok(preview) => {
                    if json_mode {
                        print_command_json(command, &preview);
                    } else {
                        println!("Snapshot preview for {}", preview.created_at);
                        println!("Fingerprint: {}", preview.fingerprint);
                        let rows: Vec<Vec<String>> = preview
                            .segments
                            .iter()
                            .map(|segment| {
                                vec![
                                    scope_to_string(segment.scope),
                                    segment.added_variables.to_string(),
                                    segment.changed_variables.to_string(),
                                    segment.removed_variables.to_string(),
                                    if segment.skipped {
                                        "yes".into()
                                    } else {
                                        "no".into()
                                    },
                                ]
                            })
                            .collect();
                        print_table(&["SCOPE", "ADD", "CHANGE", "REMOVE", "SKIPPED"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => {
                    runtime_error(command, json_mode, format!("Snapshot preview error: {}", e))
                }
            }
        }
        "snapshot-restore" => {
            let command = "envvar.snapshot-restore";
            let path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "snapshot path is required"),
            };
            let fingerprint = match get_string(&subcmd.matches.args, "fingerprint") {
                Some(value) => value,
                None => {
                    return usage_error(command, json_mode, "preview fingerprint is required")
                }
            };
            let scope_values = get_string_list(&subcmd.matches.args, "scopes");
            let mut scopes = Vec::new();
            for raw_scope in scope_values {
                match parse_env_scope(Some(raw_scope), EnvVarScope::User) {
                    Ok(scope) => scopes.push(scope),
                    Err(msg) => return usage_error(command, json_mode, msg),
                }
            }
            match crate::commands::envvar::restore_envvar_snapshot_for_settings(
                &ctx.settings,
                &path,
                &scopes,
                Some(&fingerprint),
            )
            .await
            {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else {
                        println!(
                            "Restored scopes: {} [{}]",
                            result
                                .restored_scopes
                                .iter()
                                .map(|scope| scope_to_string(*scope))
                                .collect::<Vec<_>>()
                                .join(","),
                            result.status
                        );
                        if let Some(message) = &result.message {
                            println!("{}", message);
                        }
                    }
                    if result.success {
                        EXIT_OK
                    } else {
                        EXIT_ERROR
                    }
                }
                Err(e) => {
                    runtime_error(command, json_mode, format!("Snapshot restore error: {}", e))
                }
            }
        }
        "snapshot-delete" => {
            let command = "envvar.snapshot-delete";
            let path = match get_string(&subcmd.matches.args, "path") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "snapshot path is required"),
            };
            let result =
                crate::core::backup::delete_backup_with_result(std::path::Path::new(&path)).await;
            if json_mode {
                print_command_json(command, &result);
            } else if result.success {
                println!("Deleted envvar snapshot: {}", path);
            } else {
                eprintln!(
                    "Delete snapshot failed: {}",
                    result.error.unwrap_or_else(|| "unknown error".to_string())
                );
            }
            if result.success {
                EXIT_OK
            } else {
                EXIT_ERROR
            }
        }
        other => usage_error(
            COMMAND,
            json_mode,
            format!("Unknown envvar subcommand: {}", other),
        ),
    }
}

// ── Subcommand: log ─────────────────────────────────────────────

async fn cmd_log(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "log";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                format!("log subcommand required ({})", LOG_SUBCOMMANDS.join(", ")),
            );
        }
    };

    match subcmd.name.as_str() {
        "list" => {
            let command = "log.list";
            match crate::commands::log::log_list_files(ctx.app.clone()).await {
                Ok(files) => {
                    if json_mode {
                        print_command_json(command, &files);
                    } else if files.is_empty() {
                        println!("No log files found");
                    } else {
                        let rows: Vec<Vec<String>> = files
                            .iter()
                            .map(|item| {
                                vec![
                                    item.name.clone(),
                                    format_size(item.size),
                                    item.modified.to_string(),
                                    item.path.clone(),
                                ]
                            })
                            .collect();
                        print_table(&["NAME", "SIZE", "MODIFIED", "PATH"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Log list error: {}", e)),
            }
        }
        "export" => {
            let command = "log.export";
            let start_time =
                get_string(&subcmd.matches.args, "start-time").and_then(|v| v.parse::<i64>().ok());
            let end_time =
                get_string(&subcmd.matches.args, "end-time").and_then(|v| v.parse::<i64>().ok());
            let options = LogExportOptions {
                file_name: get_string(&subcmd.matches.args, "file"),
                level_filter: None,
                target: None,
                search: get_string(&subcmd.matches.args, "search"),
                use_regex: Some(get_flag(&subcmd.matches.args, "regex")),
                start_time,
                end_time,
                format: get_string(&subcmd.matches.args, "format"),
                diagnostic_mode: Some(false),
                sanitize_sensitive: Some(false),
            };
            let out_path = get_string(&subcmd.matches.args, "out");

            match crate::commands::log::log_export(ctx.app.clone(), options).await {
                Ok(result) => {
                    if let Some(ref file_path) = out_path {
                        if let Err(msg) = write_text_file(file_path, &result.content) {
                            return runtime_error(command, json_mode, msg);
                        }
                    }

                    if json_mode {
                        print_command_json(
                            command,
                            &json!({
                                "file_name": result.file_name,
                                "out": out_path,
                                "bytes": result.content.len(),
                            }),
                        );
                    } else if let Some(file_path) = out_path {
                        println!("Exported logs to {}", file_path);
                    } else {
                        println!("{}", result.content);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Log export error: {}", e)),
            }
        }
        "clear" => {
            let command = "log.clear";
            let file_name = get_string(&subcmd.matches.args, "file");
            match crate::commands::log::log_clear(ctx.app.clone(), file_name.clone()).await {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else if let Some(file) = file_name {
                        println!(
                            "Cleared log file {} (deleted {}, freed {})",
                            file,
                            result.deleted_count,
                            format_size(result.freed_bytes)
                        );
                    } else {
                        println!(
                            "Cleared log files (deleted {}, freed {})",
                            result.deleted_count,
                            format_size(result.freed_bytes)
                        );
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Log clear error: {}", e)),
            }
        }
        "size" => {
            let command = "log.size";
            match crate::commands::log::log_get_total_size(ctx.app.clone()).await {
                Ok(total) => {
                    if json_mode {
                        print_command_json(
                            command,
                            &json!({ "total_bytes": total, "total_human": format_size(total) }),
                        );
                    } else {
                        println!("Total log size: {}", format_size(total));
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Log size error: {}", e)),
            }
        }
        "cleanup" => {
            let command = "log.cleanup";
            match crate::commands::log::cleanup_logs_with_policy(
                &ctx.app,
                ctx.settings.log.max_retention_days,
                ctx.settings.log.max_total_size_mb,
            )
            .await
            {
                Ok(result) => {
                    if json_mode {
                        print_command_json(command, &result);
                    } else {
                        println!(
                            "Deleted {} file(s), freed {}",
                            result.deleted_count,
                            format_size(result.freed_bytes)
                        );
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Log cleanup error: {}", e)),
            }
        }
        other => usage_error(
            COMMAND,
            json_mode,
            format!("Unknown log subcommand: {}", other),
        ),
    }
}

// ── Subcommand: download ────────────────────────────────────────

async fn cmd_download(
    ctx: &CliContext,
    matches: &tauri_plugin_cli::Matches,
    json_mode: bool,
) -> i32 {
    const COMMAND: &str = "download";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                format!(
                    "download subcommand required ({})",
                    DOWNLOAD_SUBCOMMANDS.join(", ")
                ),
            );
        }
    };

    match subcmd.name.as_str() {
        "history-list" => {
            let command = "download.history-list";
            let limit =
                get_string(&subcmd.matches.args, "limit").and_then(|v| v.parse::<usize>().ok());
            match DownloadHistory::open(&ctx.settings.get_cache_dir()).await {
                Ok(history) => {
                    let records: Vec<HistoryRecordInfo> = history
                        .list()
                        .into_iter()
                        .take(limit.unwrap_or(100))
                        .map(HistoryRecordInfo::from)
                        .collect();
                    if json_mode {
                        print_command_json(command, &records);
                    } else if records.is_empty() {
                        println!("No download history records found");
                    } else {
                        let rows: Vec<Vec<String>> = records
                            .iter()
                            .map(|item| {
                                vec![
                                    item.id.clone(),
                                    item.filename.clone(),
                                    item.status.clone(),
                                    item.size_human.clone(),
                                    item.completed_at.clone(),
                                ]
                            })
                            .collect();
                        print_table(&["ID", "FILE", "STATUS", "SIZE", "COMPLETED_AT"], &rows);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("History list error: {}", e)),
            }
        }
        "history-stats" => {
            let command = "download.history-stats";
            match DownloadHistory::open(&ctx.settings.get_cache_dir()).await {
                Ok(history) => {
                    let stats = HistoryStatsInfo::from(history.stats());
                    if json_mode {
                        print_command_json(command, &stats);
                    } else {
                        println!("Total: {}", stats.total_count);
                        println!("Completed: {}", stats.completed_count);
                        println!("Failed: {}", stats.failed_count);
                        println!("Cancelled: {}", stats.cancelled_count);
                        println!("Transferred: {}", stats.total_bytes_human);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("History stats error: {}", e)),
            }
        }
        "history-clear" => {
            let command = "download.history-clear";
            let days = get_string(&subcmd.matches.args, "days").and_then(|v| v.parse::<i64>().ok());
            match DownloadHistory::open(&ctx.settings.get_cache_dir()).await {
                Ok(mut history) => {
                    let clear_result = if let Some(days) = days {
                        history.clear_older_than(days).await
                    } else {
                        history.clear().await
                    };
                    match clear_result {
                        Ok(removed) => {
                            if json_mode {
                                print_command_json(
                                    command,
                                    &json!({ "removed": removed, "days": days }),
                                );
                            } else {
                                println!("Removed {} history record(s)", removed);
                            }
                            EXIT_OK
                        }
                        Err(e) => {
                            runtime_error(command, json_mode, format!("History clear error: {}", e))
                        }
                    }
                }
                Err(e) => runtime_error(command, json_mode, format!("History clear error: {}", e)),
            }
        }
        "history-remove" => {
            let command = "download.history-remove";
            let id = match get_string(&subcmd.matches.args, "id") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "history record id is required"),
            };
            match DownloadHistory::open(&ctx.settings.get_cache_dir()).await {
                Ok(mut history) => match history.remove(&id).await {
                    Ok(removed) => {
                        if json_mode {
                            print_command_json(command, &json!({ "id": id, "removed": removed }));
                        } else if removed {
                            println!("Removed history record {}", id);
                        } else {
                            println!("History record not found: {}", id);
                        }
                        if removed {
                            EXIT_OK
                        } else {
                            EXIT_ERROR
                        }
                    }
                    Err(e) => {
                        runtime_error(command, json_mode, format!("History remove error: {}", e))
                    }
                },
                Err(e) => runtime_error(command, json_mode, format!("History remove error: {}", e)),
            }
        }
        "queue-list" => {
            let command = "download.queue-list";
            let manager = create_cli_download_manager(&ctx.settings).await;
            let tasks = manager.list_tasks().await;
            let payload: Vec<DownloadTaskInfo> = tasks.iter().map(DownloadTaskInfo::from).collect();
            if json_mode {
                print_command_json(command, &payload);
            } else if payload.is_empty() {
                println!("No queued download tasks found");
            } else {
                let rows: Vec<Vec<String>> = payload
                    .iter()
                    .map(|item| {
                        vec![
                            item.id.clone(),
                            item.name.clone(),
                            item.state.clone(),
                            item.progress.percent.to_string(),
                        ]
                    })
                    .collect();
                print_table(&["ID", "NAME", "STATE", "PERCENT"], &rows);
            }
            EXIT_OK
        }
        "queue-stats" => {
            let command = "download.queue-stats";
            let manager = create_cli_download_manager(&ctx.settings).await;
            let stats = manager.stats().await;
            if json_mode {
                print_command_json(command, &stats);
            } else {
                println!("Total tasks: {}", stats.total_tasks);
                println!("Queued: {}", stats.queued);
                println!("Downloading: {}", stats.downloading);
                println!("Paused: {}", stats.paused);
                println!("Completed: {}", stats.completed);
                println!("Failed: {}", stats.failed);
                println!("Cancelled: {}", stats.cancelled);
            }
            EXIT_OK
        }
        "queue-pause" => {
            let command = "download.queue-pause";
            let id = match get_string(&subcmd.matches.args, "id") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "task id is required"),
            };
            let manager = create_cli_download_manager(&ctx.settings).await;
            match manager.pause(&id).await {
                Ok(()) => {
                    if json_mode {
                        print_command_json(command, &json!({ "id": id, "status": "paused" }));
                    } else {
                        println!("Paused task {}", id);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Pause task error: {}", e)),
            }
        }
        "queue-resume" => {
            let command = "download.queue-resume";
            let id = match get_string(&subcmd.matches.args, "id") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "task id is required"),
            };
            let manager = create_cli_download_manager(&ctx.settings).await;
            match manager.resume(&id).await {
                Ok(()) => {
                    if json_mode {
                        print_command_json(command, &json!({ "id": id, "status": "resumed" }));
                    } else {
                        println!("Resumed task {}", id);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Resume task error: {}", e)),
            }
        }
        "queue-cancel" => {
            let command = "download.queue-cancel";
            let id = match get_string(&subcmd.matches.args, "id") {
                Some(value) => value,
                None => return usage_error(command, json_mode, "task id is required"),
            };
            let manager = create_cli_download_manager(&ctx.settings).await;
            match manager.cancel(&id).await {
                Ok(()) => {
                    if json_mode {
                        print_command_json(command, &json!({ "id": id, "status": "cancelled" }));
                    } else {
                        println!("Cancelled task {}", id);
                    }
                    EXIT_OK
                }
                Err(e) => runtime_error(command, json_mode, format!("Cancel task error: {}", e)),
            }
        }
        other => usage_error(
            COMMAND,
            json_mode,
            format!("Unknown download subcommand: {}", other),
        ),
    }
}

// ── Subcommand: wsl ─────────────────────────────────────────────

async fn cmd_wsl(_ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    const COMMAND: &str = "wsl";
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => {
            return usage_error(
                COMMAND,
                json_mode,
                format!("wsl subcommand required ({})", WSL_SUBCOMMANDS.join(", ")),
            );
        }
    };

    #[cfg(not(target_os = "windows"))]
    {
        return runtime_error(
            &format!("wsl.{}", subcmd.name),
            json_mode,
            "WSL only available on Windows",
        );
    }

    #[cfg(target_os = "windows")]
    {
        let provider = crate::provider::wsl::WslProvider::new();

        match subcmd.name.as_str() {
            "list" => {
                let command = "wsl.list";
                match provider.run_wsl_lenient(&["--list", "--verbose"]).await {
                    Ok(output) => {
                        let distros =
                            crate::provider::wsl::WslProvider::parse_list_verbose(&output);
                        if json_mode {
                            let payload: Vec<serde_json::Value> = distros
                                .iter()
                                .map(|distro| {
                                    json!({
                                        "name": distro.name,
                                        "state": distro.state,
                                        "wsl_version": distro.wsl_version,
                                        "is_default": distro.is_default,
                                    })
                                })
                                .collect();
                            print_command_json(command, &payload);
                        } else if distros.is_empty() {
                            println!("No WSL distributions found");
                        } else {
                            let rows = wsl_list_rows(&distros);
                            print_table(&["NAME", "STATE", "VERSION", "DEFAULT"], &rows);
                        }
                        EXIT_OK
                    }
                    Err(err) => {
                        runtime_error(command, json_mode, format!("WSL list error: {}", err))
                    }
                }
            }
            "status" => {
                let command = "wsl.status";
                let version = provider
                    .get_wsl_version_string()
                    .await
                    .unwrap_or_else(|_| "Unknown".to_string());
                let version_info = provider.get_full_version_info().await.ok();
                let status_output = provider
                    .get_wsl_status()
                    .await
                    .unwrap_or_else(|_| "WSL status unavailable".to_string());
                let running = provider.list_running().await.unwrap_or_default();
                let (default_distro, default_version) =
                    crate::provider::wsl::WslProvider::parse_status_output(&status_output);

                let payload = wsl_status_payload(
                    version,
                    version_info.as_ref(),
                    default_distro,
                    default_version,
                    running,
                    status_output,
                );

                if json_mode {
                    print_command_json(command, &payload);
                } else {
                    println!(
                        "WSL Version: {}",
                        payload["version"].as_str().unwrap_or("Unknown")
                    );
                    if let Some(kernel_version) = payload["kernel_version"].as_str() {
                        println!("Kernel Version: {}", kernel_version);
                    }
                    if let Some(default_distribution) = payload["default_distribution"].as_str() {
                        println!("Default Distribution: {}", default_distribution);
                    }
                    if let Some(default_version) = payload["default_version"].as_str() {
                        println!("Default WSL Version: {}", default_version);
                    }
                    let running_distros = payload["running_distros"]
                        .as_array()
                        .map(|items| {
                            items
                                .iter()
                                .filter_map(|item| item.as_str())
                                .collect::<Vec<_>>()
                                .join(", ")
                        })
                        .unwrap_or_default();
                    println!(
                        "Running Distros: {}",
                        if running_distros.is_empty() {
                            "none".to_string()
                        } else {
                            running_distros
                        }
                    );
                }
                EXIT_OK
            }
            "launch" => {
                let command = "wsl.launch";
                let distro = match get_string(&subcmd.matches.args, "distro") {
                    Some(value) => value,
                    None => return usage_error(command, json_mode, "distro name is required"),
                };
                let user = get_string(&subcmd.matches.args, "user");
                match provider.launch_distro(&distro, user.as_deref()).await {
                    Ok(()) => {
                        if json_mode {
                            print_command_json(
                                command,
                                &json!({
                                    "distro": distro,
                                    "user": user,
                                    "status": "launched",
                                }),
                            );
                        } else {
                            println!("Launched WSL distribution: {}", distro);
                        }
                        EXIT_OK
                    }
                    Err(err) => {
                        runtime_error(command, json_mode, format!("WSL launch error: {}", err))
                    }
                }
            }
            "terminate" => {
                let command = "wsl.terminate";
                let distro = match get_string(&subcmd.matches.args, "distro") {
                    Some(value) => value,
                    None => return usage_error(command, json_mode, "distro name is required"),
                };
                match provider.terminate_distro(&distro).await {
                    Ok(()) => {
                        if json_mode {
                            print_command_json(
                                command,
                                &json!({
                                    "distro": distro,
                                    "status": "terminated",
                                }),
                            );
                        } else {
                            println!("Terminated WSL distribution: {}", distro);
                        }
                        EXIT_OK
                    }
                    Err(err) => {
                        runtime_error(command, json_mode, format!("WSL terminate error: {}", err))
                    }
                }
            }
            "shutdown" => {
                let command = "wsl.shutdown";
                match provider.shutdown_all().await {
                    Ok(()) => {
                        if json_mode {
                            print_command_json(command, &json!({ "status": "shutdown" }));
                        } else {
                            println!("Shut down all WSL distributions");
                        }
                        EXIT_OK
                    }
                    Err(err) => {
                        runtime_error(command, json_mode, format!("WSL shutdown error: {}", err))
                    }
                }
            }
            "exec" => {
                let command = "wsl.exec";
                let distro = match get_string(&subcmd.matches.args, "distro") {
                    Some(value) => value,
                    None => return usage_error(command, json_mode, "distro name is required"),
                };
                let shell_command = match get_string(&subcmd.matches.args, "command") {
                    Some(value) => value,
                    None => return usage_error(command, json_mode, "command is required"),
                };
                let user = get_string(&subcmd.matches.args, "user");
                match provider
                    .exec_command(&distro, &shell_command, user.as_deref())
                    .await
                {
                    Ok((stdout, stderr, exit_code)) => {
                        let success = exit_code == 0;
                        let payload = wsl_exec_payload(
                            distro,
                            shell_command,
                            user,
                            stdout,
                            stderr,
                            exit_code,
                        );
                        if json_mode {
                            print_command_json(command, &payload);
                        } else {
                            if !payload["stdout"].as_str().unwrap_or_default().is_empty() {
                                println!("{}", payload["stdout"].as_str().unwrap_or_default());
                            }
                            if !payload["stderr"].as_str().unwrap_or_default().is_empty() {
                                eprintln!("{}", payload["stderr"].as_str().unwrap_or_default());
                            }
                            println!("Exit Code: {}", exit_code);
                        }
                        if success {
                            EXIT_OK
                        } else {
                            EXIT_ERROR
                        }
                    }
                    Err(err) => {
                        runtime_error(command, json_mode, format!("WSL exec error: {}", err))
                    }
                }
            }
            other => usage_error(
                COMMAND,
                json_mode,
                format!("Unknown wsl subcommand: {}", other),
            ),
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_arg(value: serde_json::Value, occurrences: u8) -> tauri_plugin_cli::ArgData {
        let mut arg = tauri_plugin_cli::ArgData::default();
        arg.value = value;
        arg.occurrences = occurrences;
        arg
    }

    fn make_args(
        entries: &[(&str, serde_json::Value, u8)],
    ) -> std::collections::HashMap<String, tauri_plugin_cli::ArgData> {
        entries
            .iter()
            .map(|(k, v, o)| (k.to_string(), make_arg(v.clone(), *o)))
            .collect()
    }

    // ── SUBCOMMANDS constant ─────────────────────────────────────

    #[test]
    fn test_subcommands_contains_all_expected() {
        let expected = [
            "search",
            "install",
            "uninstall",
            "list",
            "update",
            "info",
            "env",
            "config",
            "cache",
            "doctor",
            "providers",
            "backup",
            "profiles",
            "envvar",
            "log",
            "download",
            "wsl",
        ];
        for cmd in &expected {
            assert!(SUBCOMMANDS.contains(cmd), "Missing subcommand: {}", cmd);
        }
    }

    #[test]
    fn test_subcommands_count() {
        assert_eq!(SUBCOMMANDS.len(), 17);
    }

    #[test]
    fn test_wsl_list_rows_formats_default_flag() {
        let rows = wsl_list_rows(&[
            crate::provider::wsl::WslDistroInfo {
                name: "Ubuntu".to_string(),
                state: "Running".to_string(),
                wsl_version: "2".to_string(),
                is_default: true,
            },
            crate::provider::wsl::WslDistroInfo {
                name: "Debian".to_string(),
                state: "Stopped".to_string(),
                wsl_version: "1".to_string(),
                is_default: false,
            },
        ]);

        assert_eq!(
            rows,
            vec![
                vec![
                    "Ubuntu".to_string(),
                    "Running".to_string(),
                    "2".to_string(),
                    "yes".to_string(),
                ],
                vec![
                    "Debian".to_string(),
                    "Stopped".to_string(),
                    "1".to_string(),
                    "no".to_string(),
                ],
            ]
        );
    }

    #[test]
    fn test_wsl_status_payload_includes_runtime_summary_fields() {
        let payload = wsl_status_payload(
            "2.4.0".to_string(),
            Some(&crate::provider::wsl::WslVersionInfo {
                kernel_version: Some("6.6.87.2-1".to_string()),
                wslg_version: Some("1.0.66".to_string()),
                ..Default::default()
            }),
            Some("Ubuntu".to_string()),
            Some("2".to_string()),
            vec!["Ubuntu".to_string()],
            "Ready".to_string(),
        );

        assert_eq!(payload["version"], json!("2.4.0"));
        assert_eq!(payload["kernel_version"], json!("6.6.87.2-1"));
        assert_eq!(payload["wslg_version"], json!("1.0.66"));
        assert_eq!(payload["default_distribution"], json!("Ubuntu"));
        assert_eq!(payload["default_version"], json!("2"));
        assert_eq!(payload["running_distros"], json!(["Ubuntu"]));
        assert_eq!(payload["status_info"], json!("Ready"));
    }

    #[test]
    fn test_wsl_exec_payload_reports_success_from_exit_code() {
        let success_payload = wsl_exec_payload(
            "Ubuntu".to_string(),
            "echo ok".to_string(),
            Some("root".to_string()),
            "ok".to_string(),
            String::new(),
            0,
        );
        let failed_payload = wsl_exec_payload(
            "Ubuntu".to_string(),
            "false".to_string(),
            None,
            String::new(),
            "boom".to_string(),
            1,
        );

        assert_eq!(success_payload["success"], json!(true));
        assert_eq!(success_payload["user"], json!("root"));
        assert_eq!(failed_payload["success"], json!(false));
        assert_eq!(failed_payload["stderr"], json!("boom"));
    }

    #[test]
    fn test_subcommands_no_duplicates() {
        let set: std::collections::HashSet<&&str> = SUBCOMMANDS.iter().collect();
        assert_eq!(set.len(), SUBCOMMANDS.len(), "Duplicate subcommands found");
    }

    #[test]
    fn test_env_subcommands_contains_expected() {
        let expected = ["list", "install", "use", "detect", "remove", "resolve"];
        for cmd in &expected {
            assert!(
                ENV_SUBCOMMANDS.contains(cmd),
                "Missing env subcommand: {}",
                cmd
            );
        }
        let set: std::collections::HashSet<&&str> = ENV_SUBCOMMANDS.iter().collect();
        assert_eq!(set.len(), ENV_SUBCOMMANDS.len());
    }

    #[test]
    fn test_config_subcommands_contains_expected() {
        let expected = ["get", "set", "list", "reset", "export", "import"];
        for cmd in &expected {
            assert!(
                CONFIG_SUBCOMMANDS.contains(cmd),
                "Missing config subcommand: {}",
                cmd
            );
        }
        let set: std::collections::HashSet<&&str> = CONFIG_SUBCOMMANDS.iter().collect();
        assert_eq!(set.len(), CONFIG_SUBCOMMANDS.len());
    }

    #[test]
    fn test_p0_domain_subcommands_contains_expected() {
        let backup_expected = ["list", "create", "restore", "delete"];
        for cmd in &backup_expected {
            assert!(
                BACKUP_SUBCOMMANDS.contains(cmd),
                "Missing backup subcommand: {}",
                cmd
            );
        }

        let profiles_expected = [
            "list",
            "get",
            "apply",
            "export",
            "import",
            "create-from-current",
        ];
        for cmd in &profiles_expected {
            assert!(
                PROFILES_SUBCOMMANDS.contains(cmd),
                "Missing profiles subcommand: {}",
                cmd
            );
        }

        let envvar_expected = [
            "list",
            "get",
            "set",
            "remove",
            "list-persistent",
            "list-persistent-typed",
            "set-persistent",
            "remove-persistent",
            "get-path",
            "add-path",
            "remove-path",
            "reorder-path",
            "deduplicate-path",
            "detect-conflicts",
            "list-shell-profiles",
            "read-shell-profile",
            "expand-path",
            "export",
            "import",
            "preview-import",
            "apply-import",
            "preview-path-repair",
            "apply-path-repair",
            "resolve-conflict",
            "shell-guidance",
        ];
        for cmd in &envvar_expected {
            assert!(
                ENVVAR_SUBCOMMANDS.contains(cmd),
                "Missing envvar subcommand: {}",
                cmd
            );
        }

        let log_expected = ["list", "export", "clear", "size", "cleanup"];
        for cmd in &log_expected {
            assert!(
                LOG_SUBCOMMANDS.contains(cmd),
                "Missing log subcommand: {}",
                cmd
            );
        }

        let download_expected = [
            "history-list",
            "history-stats",
            "history-clear",
            "history-remove",
            "queue-list",
            "queue-stats",
            "queue-pause",
            "queue-resume",
            "queue-cancel",
        ];
        for cmd in &download_expected {
            assert!(
                DOWNLOAD_SUBCOMMANDS.contains(cmd),
                "Missing download subcommand: {}",
                cmd
            );
        }

        let wsl_expected = ["list", "status", "launch", "terminate", "shutdown", "exec"];
        for cmd in &wsl_expected {
            assert!(
                WSL_SUBCOMMANDS.contains(cmd),
                "Missing wsl subcommand: {}",
                cmd
            );
        }
    }

    #[test]
    fn test_backup_status_exit_code_alignment() {
        assert_eq!(
            backup_status_exit_code(backup::BackupOperationStatus::Success),
            EXIT_OK
        );
        assert_eq!(
            backup_status_exit_code(backup::BackupOperationStatus::Partial),
            EXIT_ERROR
        );
        assert_eq!(
            backup_status_exit_code(backup::BackupOperationStatus::Skipped),
            EXIT_ERROR
        );
        assert_eq!(
            backup_status_exit_code(backup::BackupOperationStatus::Failed),
            EXIT_ERROR
        );
    }

    #[test]
    fn test_backup_status_exit_code_non_success_are_failures() {
        let non_success = [
            backup::BackupOperationStatus::Partial,
            backup::BackupOperationStatus::Skipped,
            backup::BackupOperationStatus::Failed,
        ];
        for status in non_success {
            assert_eq!(backup_status_exit_code(status), EXIT_ERROR);
        }
    }

    #[test]
    fn test_cli_p0_domains_constant_contains_expected() {
        let expected = ["backup", "profiles", "envvar", "log", "download"];
        for domain in &expected {
            assert!(
                CLI_P0_DOMAINS.contains(domain),
                "Missing P0 domain: {}",
                domain
            );
        }
    }

    #[test]
    fn test_cli_schema_alignment_with_tauri_conf() {
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json");
        let subcommands_obj = conf["plugins"]["cli"]["subcommands"]
            .as_object()
            .expect("cli.subcommands object");

        let mut declared_top: Vec<String> = subcommands_obj.keys().cloned().collect();
        declared_top.sort();
        let mut runtime_top: Vec<String> = SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_top.sort();
        assert_eq!(declared_top, runtime_top, "top-level CLI commands drift");

        let env_subcommands = subcommands_obj["env"]["subcommands"]
            .as_object()
            .expect("env.subcommands object");
        let mut declared_env: Vec<String> = env_subcommands.keys().cloned().collect();
        declared_env.sort();
        let mut runtime_env: Vec<String> = ENV_SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_env.sort();
        assert_eq!(declared_env, runtime_env, "env subcommands drift");

        let config_subcommands = subcommands_obj["config"]["subcommands"]
            .as_object()
            .expect("config.subcommands object");
        let mut declared_config: Vec<String> = config_subcommands.keys().cloned().collect();
        declared_config.sort();
        let mut runtime_config: Vec<String> =
            CONFIG_SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_config.sort();
        assert_eq!(declared_config, runtime_config, "config subcommands drift");

        let backup_subcommands = subcommands_obj["backup"]["subcommands"]
            .as_object()
            .expect("backup.subcommands object");
        let mut declared_backup: Vec<String> = backup_subcommands.keys().cloned().collect();
        declared_backup.sort();
        let mut runtime_backup: Vec<String> =
            BACKUP_SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_backup.sort();
        assert_eq!(declared_backup, runtime_backup, "backup subcommands drift");

        let profiles_subcommands = subcommands_obj["profiles"]["subcommands"]
            .as_object()
            .expect("profiles.subcommands object");
        let mut declared_profiles: Vec<String> = profiles_subcommands.keys().cloned().collect();
        declared_profiles.sort();
        let mut runtime_profiles: Vec<String> =
            PROFILES_SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_profiles.sort();
        assert_eq!(
            declared_profiles, runtime_profiles,
            "profiles subcommands drift"
        );

        let envvar_subcommands = subcommands_obj["envvar"]["subcommands"]
            .as_object()
            .expect("envvar.subcommands object");
        let mut declared_envvar: Vec<String> = envvar_subcommands.keys().cloned().collect();
        declared_envvar.sort();
        let mut runtime_envvar: Vec<String> =
            ENVVAR_SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_envvar.sort();
        assert_eq!(declared_envvar, runtime_envvar, "envvar subcommands drift");

        let log_subcommands = subcommands_obj["log"]["subcommands"]
            .as_object()
            .expect("log.subcommands object");
        let mut declared_log: Vec<String> = log_subcommands.keys().cloned().collect();
        declared_log.sort();
        let mut runtime_log: Vec<String> = LOG_SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_log.sort();
        assert_eq!(declared_log, runtime_log, "log subcommands drift");

        let download_subcommands = subcommands_obj["download"]["subcommands"]
            .as_object()
            .expect("download.subcommands object");
        let mut declared_download: Vec<String> = download_subcommands.keys().cloned().collect();
        declared_download.sort();
        let mut runtime_download: Vec<String> =
            DOWNLOAD_SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_download.sort();
        assert_eq!(
            declared_download, runtime_download,
            "download subcommands drift"
        );

        let wsl_subcommands = subcommands_obj["wsl"]["subcommands"]
            .as_object()
            .expect("wsl.subcommands object");
        let mut declared_wsl: Vec<String> = wsl_subcommands.keys().cloned().collect();
        declared_wsl.sort();
        let mut runtime_wsl: Vec<String> = WSL_SUBCOMMANDS.iter().map(|s| s.to_string()).collect();
        runtime_wsl.sort();
        assert_eq!(declared_wsl, runtime_wsl, "wsl subcommands drift");
    }

    #[test]
    fn test_cli_flag_matrix_alignment_for_changed_commands() {
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json");
        let subcommands_obj = conf["plugins"]["cli"]["subcommands"]
            .as_object()
            .expect("cli.subcommands object");

        let install_args = subcommands_obj["install"]["args"]
            .as_array()
            .expect("install args");
        let install_names: Vec<&str> = install_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(install_names.contains(&"packages"));
        assert!(install_names.contains(&"provider"));
        assert!(install_names.contains(&"force"));
        assert!(install_names.contains(&"continue-on-error"));

        let uninstall_args = subcommands_obj["uninstall"]["args"]
            .as_array()
            .expect("uninstall args");
        let uninstall_names: Vec<&str> = uninstall_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(uninstall_names.contains(&"packages"));
        assert!(uninstall_names.contains(&"provider"));
        assert!(uninstall_names.contains(&"force"));
        assert!(uninstall_names.contains(&"continue-on-error"));

        let update_args = subcommands_obj["update"]["args"]
            .as_array()
            .expect("update args");
        let update_names: Vec<&str> = update_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(update_names.contains(&"packages"));
        assert!(update_names.contains(&"provider"));
        assert!(update_names.contains(&"all"));
        assert!(update_names.contains(&"continue-on-error"));

        let list_args = subcommands_obj["list"]["args"]
            .as_array()
            .expect("list args");
        let list_names: Vec<&str> = list_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(list_names.contains(&"provider"));
        assert!(list_names.contains(&"outdated"));

        let backup_create_args = subcommands_obj["backup"]["subcommands"]["create"]["args"]
            .as_array()
            .expect("backup.create args");
        let backup_create_names: Vec<&str> = backup_create_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(backup_create_names.contains(&"contents"));
        assert!(backup_create_names.contains(&"note"));

        let profiles_get_args = subcommands_obj["profiles"]["subcommands"]["get"]["args"]
            .as_array()
            .expect("profiles.get args");
        let profiles_get_names: Vec<&str> = profiles_get_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(profiles_get_names.contains(&"id"));

        let envvar_set_args = subcommands_obj["envvar"]["subcommands"]["set"]["args"]
            .as_array()
            .expect("envvar.set args");
        let envvar_set_names: Vec<&str> = envvar_set_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_set_names.contains(&"key"));
        assert!(envvar_set_names.contains(&"value"));
        assert!(envvar_set_names.contains(&"scope"));

        let envvar_add_path_args = subcommands_obj["envvar"]["subcommands"]["add-path"]["args"]
            .as_array()
            .expect("envvar.add-path args");
        let envvar_add_path_names: Vec<&str> = envvar_add_path_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_add_path_names.contains(&"path"));
        assert!(envvar_add_path_names.contains(&"scope"));
        assert!(envvar_add_path_names.contains(&"position"));

        let envvar_reorder_path_args = subcommands_obj["envvar"]["subcommands"]["reorder-path"]
            ["args"]
            .as_array()
            .expect("envvar.reorder-path args");
        let envvar_reorder_path_names: Vec<&str> = envvar_reorder_path_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_reorder_path_names.contains(&"entries"));
        assert!(envvar_reorder_path_names.contains(&"scope"));

        let envvar_read_profile_args = subcommands_obj["envvar"]["subcommands"]
            ["read-shell-profile"]["args"]
            .as_array()
            .expect("envvar.read-shell-profile args");
        let envvar_read_profile_names: Vec<&str> = envvar_read_profile_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_read_profile_names.contains(&"path"));

        let envvar_expand_path_args = subcommands_obj["envvar"]["subcommands"]["expand-path"]
            ["args"]
            .as_array()
            .expect("envvar.expand-path args");
        let envvar_expand_path_names: Vec<&str> = envvar_expand_path_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_expand_path_names.contains(&"path"));

        let envvar_preview_import_args = subcommands_obj["envvar"]["subcommands"]["preview-import"]
            ["args"]
            .as_array()
            .expect("envvar.preview-import args");
        let envvar_preview_import_names: Vec<&str> = envvar_preview_import_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_preview_import_names.contains(&"file"));
        assert!(envvar_preview_import_names.contains(&"scope"));

        let envvar_apply_import_args = subcommands_obj["envvar"]["subcommands"]["apply-import"]
            ["args"]
            .as_array()
            .expect("envvar.apply-import args");
        let envvar_apply_import_names: Vec<&str> = envvar_apply_import_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_apply_import_names.contains(&"file"));
        assert!(envvar_apply_import_names.contains(&"scope"));
        assert!(envvar_apply_import_names.contains(&"fingerprint"));

        let envvar_preview_path_repair_args = subcommands_obj["envvar"]["subcommands"]
            ["preview-path-repair"]["args"]
            .as_array()
            .expect("envvar.preview-path-repair args");
        let envvar_preview_path_repair_names: Vec<&str> = envvar_preview_path_repair_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_preview_path_repair_names.contains(&"scope"));

        let envvar_apply_path_repair_args = subcommands_obj["envvar"]["subcommands"]
            ["apply-path-repair"]["args"]
            .as_array()
            .expect("envvar.apply-path-repair args");
        let envvar_apply_path_repair_names: Vec<&str> = envvar_apply_path_repair_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_apply_path_repair_names.contains(&"scope"));
        assert!(envvar_apply_path_repair_names.contains(&"fingerprint"));

        let envvar_resolve_conflict_args = subcommands_obj["envvar"]["subcommands"]
            ["resolve-conflict"]["args"]
            .as_array()
            .expect("envvar.resolve-conflict args");
        let envvar_resolve_conflict_names: Vec<&str> = envvar_resolve_conflict_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_resolve_conflict_names.contains(&"key"));
        assert!(envvar_resolve_conflict_names.contains(&"source-scope"));
        assert!(envvar_resolve_conflict_names.contains(&"target-scope"));

        let envvar_shell_guidance_args = subcommands_obj["envvar"]["subcommands"]["shell-guidance"]
            ["args"]
            .as_array()
            .expect("envvar.shell-guidance args");
        let envvar_shell_guidance_names: Vec<&str> = envvar_shell_guidance_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(envvar_shell_guidance_names.contains(&"key"));
        assert!(envvar_shell_guidance_names.contains(&"value"));
        assert!(envvar_shell_guidance_names.contains(&"entries"));
        assert!(envvar_shell_guidance_names.contains(&"auto-applied-shell"));

        let log_export_args = subcommands_obj["log"]["subcommands"]["export"]["args"]
            .as_array()
            .expect("log.export args");
        let log_export_names: Vec<&str> = log_export_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(log_export_names.contains(&"file"));
        assert!(log_export_names.contains(&"out"));
        assert!(log_export_names.contains(&"format"));

        let download_queue_pause_args = subcommands_obj["download"]["subcommands"]["queue-pause"]
            ["args"]
            .as_array()
            .expect("download.queue-pause args");
        let download_queue_pause_names: Vec<&str> = download_queue_pause_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(download_queue_pause_names.contains(&"id"));

        let doctor_args = subcommands_obj["doctor"]["args"]
            .as_array()
            .expect("doctor args");
        let doctor_names: Vec<&str> = doctor_args
            .iter()
            .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
            .collect();
        assert!(doctor_names.contains(&"type"));
        assert!(doctor_names.contains(&"fix"));
        assert!(doctor_names.contains(&"preview"));
    }

    // ── get_flag ─────────────────────────────────────────────────

    #[test]
    fn test_get_flag_true() {
        let args = make_args(&[("json", serde_json::Value::Bool(true), 1)]);
        assert!(get_flag(&args, "json"));
    }

    #[test]
    fn test_get_flag_false_explicit() {
        let args = make_args(&[("json", serde_json::Value::Bool(false), 0)]);
        assert!(!get_flag(&args, "json"));
    }

    #[test]
    fn test_get_flag_missing_key() {
        let args = std::collections::HashMap::new();
        assert!(!get_flag(&args, "json"));
    }

    #[test]
    fn test_get_flag_wrong_type_string() {
        let args = make_args(&[("json", serde_json::Value::String("true".into()), 1)]);
        assert!(!get_flag(&args, "json"));
    }

    #[test]
    fn test_get_flag_wrong_type_number() {
        let args = make_args(&[("json", serde_json::json!(1), 1)]);
        assert!(!get_flag(&args, "json"));
    }

    #[test]
    fn test_get_flag_wrong_type_null() {
        let args = make_args(&[("json", serde_json::Value::Null, 0)]);
        assert!(!get_flag(&args, "json"));
    }

    #[test]
    fn test_get_flag_multiple_occurrences() {
        let args = make_args(&[("verbose", serde_json::Value::Bool(true), 3)]);
        assert!(get_flag(&args, "verbose"));
    }

    // ── get_string ───────────────────────────────────────────────

    #[test]
    fn test_get_string_valid() {
        let args = make_args(&[("provider", serde_json::Value::String("npm".into()), 1)]);
        assert_eq!(get_string(&args, "provider"), Some("npm".into()));
    }

    #[test]
    fn test_get_string_empty_returns_none() {
        let args = make_args(&[("provider", serde_json::Value::String("".into()), 0)]);
        assert_eq!(get_string(&args, "provider"), None);
    }

    #[test]
    fn test_get_string_missing_key() {
        let args = std::collections::HashMap::new();
        assert_eq!(get_string(&args, "provider"), None);
    }

    #[test]
    fn test_get_string_wrong_type_bool() {
        let args = make_args(&[("provider", serde_json::Value::Bool(true), 1)]);
        assert_eq!(get_string(&args, "provider"), None);
    }

    #[test]
    fn test_get_string_wrong_type_null() {
        let args = make_args(&[("provider", serde_json::Value::Null, 0)]);
        assert_eq!(get_string(&args, "provider"), None);
    }

    #[test]
    fn test_get_string_wrong_type_number() {
        let args = make_args(&[("limit", serde_json::json!(42), 1)]);
        assert_eq!(get_string(&args, "limit"), None);
    }

    #[test]
    fn test_get_string_with_whitespace() {
        let args = make_args(&[("query", serde_json::Value::String("hello world".into()), 1)]);
        assert_eq!(get_string(&args, "query"), Some("hello world".into()));
    }

    #[test]
    fn test_get_string_with_special_chars() {
        let args = make_args(&[("query", serde_json::Value::String("@scope/pkg".into()), 1)]);
        assert_eq!(get_string(&args, "query"), Some("@scope/pkg".into()));
    }

    // ── get_string_list ──────────────────────────────────────────

    #[test]
    fn test_get_string_list_array() {
        let args = make_args(&[(
            "packages",
            serde_json::Value::Array(vec![
                serde_json::Value::String("a".into()),
                serde_json::Value::String("b".into()),
            ]),
            2,
        )]);
        assert_eq!(get_string_list(&args, "packages"), vec!["a", "b"]);
    }

    #[test]
    fn test_get_string_list_single_string() {
        let args = make_args(&[("packages", serde_json::Value::String("lodash".into()), 1)]);
        assert_eq!(get_string_list(&args, "packages"), vec!["lodash"]);
    }

    #[test]
    fn test_get_string_list_empty_string() {
        let args = make_args(&[("packages", serde_json::Value::String("".into()), 0)]);
        assert!(get_string_list(&args, "packages").is_empty());
    }

    #[test]
    fn test_get_string_list_empty_array() {
        let args = make_args(&[("packages", serde_json::Value::Array(vec![]), 0)]);
        assert!(get_string_list(&args, "packages").is_empty());
    }

    #[test]
    fn test_get_string_list_missing_key() {
        let args = std::collections::HashMap::new();
        assert!(get_string_list(&args, "packages").is_empty());
    }

    #[test]
    fn test_get_string_list_null() {
        let args = make_args(&[("packages", serde_json::Value::Null, 0)]);
        assert!(get_string_list(&args, "packages").is_empty());
    }

    #[test]
    fn test_get_string_list_bool() {
        let args = make_args(&[("packages", serde_json::Value::Bool(true), 1)]);
        assert!(get_string_list(&args, "packages").is_empty());
    }

    #[test]
    fn test_get_string_list_array_skips_non_strings() {
        let args = make_args(&[(
            "packages",
            serde_json::Value::Array(vec![
                serde_json::Value::String("a".into()),
                serde_json::json!(42),
                serde_json::Value::String("b".into()),
                serde_json::Value::Null,
            ]),
            4,
        )]);
        assert_eq!(get_string_list(&args, "packages"), vec!["a", "b"]);
    }

    #[test]
    fn test_get_string_list_preserves_order() {
        let args = make_args(&[(
            "packages",
            serde_json::Value::Array(vec![
                serde_json::Value::String("c".into()),
                serde_json::Value::String("a".into()),
                serde_json::Value::String("b".into()),
            ]),
            3,
        )]);
        assert_eq!(get_string_list(&args, "packages"), vec!["c", "a", "b"]);
    }

    // ── print_table ──────────────────────────────────────────────

    #[test]
    fn test_print_table_empty_rows_no_panic() {
        print_table(&["A", "B"], &[]);
    }

    #[test]
    fn test_print_table_single_row_no_panic() {
        print_table(
            &["NAME", "VERSION"],
            &[vec!["lodash".into(), "4.17.21".into()]],
        );
    }

    #[test]
    fn test_print_table_variable_width_no_panic() {
        print_table(
            &["ID", "LONG DISPLAY NAME"],
            &[
                vec!["a".into(), "short".into()],
                vec!["very-long-id".into(), "x".into()],
            ],
        );
    }

    #[test]
    fn test_print_table_unicode_no_panic() {
        print_table(&["名称", "版本"], &[vec!["软件包".into(), "1.0.0".into()]]);
    }

    // ── print_json ───────────────────────────────────────────────

    #[test]
    fn test_print_json_object_no_panic() {
        print_json(&serde_json::json!({"key": "value"}));
    }

    #[test]
    fn test_print_json_array_no_panic() {
        print_json(&serde_json::json!([1, 2, 3]));
    }

    #[test]
    fn test_print_json_null_no_panic() {
        print_json(&serde_json::Value::Null);
    }

    #[test]
    fn test_print_json_string_no_panic() {
        print_json(&"hello");
    }

    #[test]
    fn test_doctor_exit_code_for_warning_and_error() {
        assert_eq!(doctor_exit_code(HealthStatus::Warning), EXIT_ERROR);
        assert_eq!(doctor_exit_code(HealthStatus::Error), EXIT_ERROR);
        assert_eq!(doctor_exit_code(HealthStatus::Healthy), EXIT_OK);
        assert_eq!(doctor_exit_code(HealthStatus::Unknown), EXIT_OK);
    }

    #[test]
    fn test_print_json_nested_no_panic() {
        print_json(&serde_json::json!({
            "cache": { "size": 1024, "entries": 5 },
            "total": 1024,
        }));
    }

    #[test]
    fn test_cli_success_envelope_contains_command_and_data() {
        let data = serde_json::json!({ "count": 2, "items": ["a", "b"] });
        let payload = cli_success_envelope("install", data.clone());
        assert_eq!(payload["ok"], serde_json::json!(true));
        assert_eq!(payload["command"], serde_json::json!("install"));
        assert_eq!(payload["data"], data);
    }

    #[test]
    fn test_cli_error_envelope_contains_kind_and_message() {
        let payload = cli_error_envelope("config.import", "usage", "file path is required");
        assert_eq!(payload["ok"], serde_json::json!(false));
        assert_eq!(payload["command"], serde_json::json!("config.import"));
        assert_eq!(payload["error"]["kind"], serde_json::json!("usage"));
        assert_eq!(
            payload["error"]["message"],
            serde_json::json!("file path is required")
        );
    }

    #[test]
    fn test_batch_summary_counts() {
        let summary = batch_summary(3, 2);
        assert_eq!(summary["total"], serde_json::json!(5));
        assert_eq!(summary["success"], serde_json::json!(3));
        assert_eq!(summary["failed"], serde_json::json!(2));
    }

    #[test]
    fn test_usage_error_returns_usage_exit_code() {
        let exit_code = usage_error("backup.restore", true, "backup path is required");
        assert_eq!(exit_code, EXIT_USAGE_ERROR);
    }

    #[test]
    fn test_runtime_error_returns_runtime_exit_code() {
        let exit_code = runtime_error("download.queue-pause", true, "pause failed");
        assert_eq!(exit_code, EXIT_ERROR);
    }

    #[test]
    fn test_p0_json_success_envelope_contract_shape() {
        let payload = cli_success_envelope(
            "download.history-stats",
            serde_json::json!({ "total_count": 0 }),
        );
        assert_eq!(payload["ok"], serde_json::json!(true));
        assert_eq!(
            payload["command"],
            serde_json::json!("download.history-stats")
        );
        assert!(payload.get("data").is_some());
    }

    #[test]
    fn test_doctor_status_from_issues_treats_inferred_warning_as_advisory() {
        let issues = vec![crate::core::HealthIssue::new(
            crate::core::Severity::Warning,
            crate::core::IssueCategory::PathConflict,
            "Duplicate PATH entries",
        )
        .with_evidence(
            crate::core::HealthSignalSource::PathHeuristic,
            crate::core::HealthEvidenceConfidence::Inferred,
            "envvar_path_duplicates:user",
        )];

        assert_eq!(doctor_status_from_issues(&issues), HealthStatus::Healthy);
    }

    #[test]
    fn test_doctor_envvar_payload_includes_structured_issue_data() {
        let issues = vec![crate::core::HealthIssue::new(
            crate::core::Severity::Error,
            crate::core::IssueCategory::ConfigError,
            "Required environment variables are missing",
        )
        .with_evidence(
            crate::core::HealthSignalSource::SystemProbe,
            crate::core::HealthEvidenceConfidence::Verified,
            "envvar_required_vars",
        )
        .with_details("Missing variables: TEMP")];

        let payload = doctor_envvar_payload(&issues);

        assert_eq!(payload["status"], serde_json::json!("error"));
        assert_eq!(
            payload["issues"][0]["check_id"],
            serde_json::json!("envvar_required_vars")
        );
        assert_eq!(
            payload["issues"][0]["details"],
            serde_json::json!("Missing variables: TEMP")
        );
    }

    #[test]
    fn test_format_envvar_health_includes_heading_and_check_id() {
        let issues = vec![crate::core::HealthIssue::new(
            crate::core::Severity::Warning,
            crate::core::IssueCategory::PathConflict,
            "User PATH contains invalid entries",
        )
        .with_evidence(
            crate::core::HealthSignalSource::SystemProbe,
            crate::core::HealthEvidenceConfidence::Verified,
            "envvar_path_validity:user",
        )
        .with_fix(
            "cognia envvar apply-path-repair --scope user",
            "Repair invalid entries",
        )];

        let output = format_envvar_health(&issues);

        assert!(output.contains("Environment Variables:"));
        assert!(output.contains("User PATH contains invalid entries"));
        assert!(output.contains("check: envvar_path_validity:user"));
        assert!(output.contains("fix: cognia envvar apply-path-repair --scope user"));
    }

    #[test]
    fn test_parse_config_import_content_valid() {
        let defaults = Settings::default();
        let toml_content = toml::to_string_pretty(&defaults).expect("serialize settings");
        let parsed = parse_config_import_content("test.toml", &toml_content).expect("parse");
        assert_eq!(parsed.appearance.theme, defaults.appearance.theme);
    }

    #[test]
    fn test_parse_config_import_content_invalid() {
        let err = parse_config_import_content("broken.toml", "this = [not valid toml")
            .expect_err("should fail");
        assert!(err.contains("Failed to parse configuration 'broken.toml'"));
    }

    #[test]
    fn test_parse_env_scope_valid_values() {
        assert_eq!(
            parse_env_scope(Some("process".to_string()), EnvVarScope::User).unwrap(),
            EnvVarScope::Process
        );
        assert_eq!(
            parse_env_scope(Some("USER".to_string()), EnvVarScope::Process).unwrap(),
            EnvVarScope::User
        );
        assert_eq!(
            parse_env_scope(Some("system".to_string()), EnvVarScope::Process).unwrap(),
            EnvVarScope::System
        );
    }

    #[test]
    fn test_parse_env_scope_invalid_value() {
        let err = parse_env_scope(Some("bad-scope".to_string()), EnvVarScope::Process)
            .expect_err("invalid scope should fail");
        assert!(err.contains("Invalid scope"));
    }

    #[test]
    fn test_parse_env_file_format_valid_values() {
        assert_eq!(
            parse_env_file_format(Some("dotenv".to_string())).unwrap(),
            EnvFileFormat::Dotenv
        );
        assert_eq!(
            parse_env_file_format(Some("shell".to_string())).unwrap(),
            EnvFileFormat::Shell
        );
        assert_eq!(
            parse_env_file_format(Some("pwsh".to_string())).unwrap(),
            EnvFileFormat::PowerShell
        );
        assert_eq!(
            parse_env_file_format(Some("nu".to_string())).unwrap(),
            EnvFileFormat::Nushell
        );
    }

    #[test]
    fn test_parse_env_file_format_invalid_value() {
        let err =
            parse_env_file_format(Some("ini".to_string())).expect_err("invalid format should fail");
        assert!(err.contains("Invalid format"));
    }

    #[test]
    fn test_parse_backup_contents_empty_defaults_to_all() {
        let parsed = parse_backup_contents(Vec::new()).expect("parse backup contents");
        assert!(!parsed.is_empty());
    }

    #[test]
    fn test_parse_backup_contents_invalid_value() {
        let err = parse_backup_contents(vec!["bad-content".to_string()])
            .expect_err("invalid content should fail");
        assert!(err.contains("Invalid backup content"));
    }

    // ── Combined arg scenarios ───────────────────────────────────

    #[test]
    fn test_mixed_args_extraction() {
        let args = make_args(&[
            ("json", serde_json::Value::Bool(true), 1),
            ("provider", serde_json::Value::String("npm".into()), 1),
            (
                "packages",
                serde_json::Value::Array(vec![
                    serde_json::Value::String("a".into()),
                    serde_json::Value::String("b".into()),
                ]),
                2,
            ),
            ("force", serde_json::Value::Bool(false), 0),
            ("limit", serde_json::Value::String("10".into()), 1),
        ]);

        assert!(get_flag(&args, "json"));
        assert!(!get_flag(&args, "force"));
        assert!(!get_flag(&args, "nonexistent"));
        assert_eq!(get_string(&args, "provider"), Some("npm".into()));
        assert_eq!(get_string(&args, "limit"), Some("10".into()));
        assert_eq!(get_string(&args, "missing"), None);
        assert_eq!(get_string_list(&args, "packages"), vec!["a", "b"]);
        assert!(get_string_list(&args, "missing").is_empty());
    }

    #[test]
    fn test_summarize_cli_coverage_counts_all_statuses() {
        let outcomes = vec![
            CliProviderOutcome {
                provider: "npm".into(),
                status: SUPPORT_STATUS_SUPPORTED.into(),
                reason: None,
                reason_code: None,
                checked: 1,
                updates: 1,
                errors: 0,
            },
            CliProviderOutcome {
                provider: "pip".into(),
                status: SUPPORT_STATUS_PARTIAL.into(),
                reason: Some("native update check failed; metadata fallback applied".into()),
                reason_code: Some(REASON_NATIVE_UPDATE_FAILED_WITH_FALLBACK.into()),
                checked: 1,
                updates: 1,
                errors: 1,
            },
            CliProviderOutcome {
                provider: "cargo".into(),
                status: SUPPORT_STATUS_UNSUPPORTED.into(),
                reason: Some("provider executable is not available".into()),
                reason_code: Some("provider_executable_unavailable".into()),
                checked: 0,
                updates: 0,
                errors: 0,
            },
            CliProviderOutcome {
                provider: "go".into(),
                status: SUPPORT_STATUS_ERROR.into(),
                reason: Some("native update check failed".into()),
                reason_code: Some(REASON_NATIVE_UPDATE_FAILED.into()),
                checked: 2,
                updates: 0,
                errors: 1,
            },
        ];

        let coverage = summarize_cli_coverage(&outcomes);
        assert_eq!(coverage.supported, 1);
        assert_eq!(coverage.partial, 1);
        assert_eq!(coverage.unsupported, 1);
        assert_eq!(coverage.error, 1);
    }

    #[test]
    fn test_normalize_cli_updates_filters_duplicates_and_unknown_packages() {
        let installed = ["typescript", "eslint"]
            .into_iter()
            .map(|name| name.to_string())
            .collect::<HashSet<_>>();
        let updates = vec![
            crate::provider::UpdateInfo {
                name: "typescript".into(),
                current_version: "5.0.0".into(),
                latest_version: "5.1.0".into(),
                provider: "npm".into(),
            },
            crate::provider::UpdateInfo {
                name: "TypeScript".into(),
                current_version: "5.0.0".into(),
                latest_version: "5.1.0".into(),
                provider: "npm".into(),
            },
            crate::provider::UpdateInfo {
                name: "unknown".into(),
                current_version: "1.0.0".into(),
                latest_version: "2.0.0".into(),
                provider: "npm".into(),
            },
        ];

        let normalized = normalize_cli_updates("npm", updates, &installed);
        assert_eq!(normalized.len(), 1);
        assert_eq!(normalized[0].name.to_ascii_lowercase(), "typescript");
        assert_eq!(normalized[0].provider, "npm");
    }

    #[test]
    fn test_cli_has_newer_version_handles_semver_and_non_semver() {
        assert!(cli_has_newer_version("1.0.0", "1.2.0"));
        assert!(!cli_has_newer_version("1.2.0", "1.0.0"));
        assert!(cli_has_newer_version("stable", "nightly"));
        assert!(!cli_has_newer_version("stable", "stable"));
    }
}
