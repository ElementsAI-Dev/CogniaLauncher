use crate::cache::{DownloadCache, MetadataCache};
use crate::commands::config::collect_config_list;
use crate::config::Settings;
use crate::core::{EnvironmentManager, HealthCheckManager, Orchestrator, PackageSpec};
use crate::platform::disk::format_size;
use crate::platform::env::current_platform;
use crate::provider::{
    Capability, InstallRequest, InstalledFilter, ProviderRegistry, SearchOptions, UninstallRequest,
};
use crate::SharedRegistry;
use log::info;
use serde::Serialize;
use serde_json::json;
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
];

const ENV_SUBCOMMANDS: &[&str] = &["list", "install", "use", "detect", "remove", "resolve"];
const CONFIG_SUBCOMMANDS: &[&str] = &["get", "set", "list", "reset", "export", "import"];

pub fn has_cli_subcommand() -> bool {
    std::env::args()
        .skip(1)
        .any(|arg| SUBCOMMANDS.contains(&arg.as_str()))
}

struct CliContext {
    settings: Settings,
    registry: Arc<RwLock<ProviderRegistry>>,
}

impl CliContext {
    fn from_app(app: &tauri::AppHandle) -> Self {
        let settings = tauri::async_runtime::block_on(async {
            app.state::<crate::SharedSettings>().read().await.clone()
        });
        let registry = app.state::<SharedRegistry>().inner().clone();
        Self { settings, registry }
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

fn cli_error_envelope(
    command: &str,
    kind: &str,
    message: impl Into<String>,
) -> serde_json::Value {
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
                    return usage_error(COMMAND, json_mode, format!("Provider not found: {}", provider_id));
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
            let message = format!("Provider {} does not support install operation", provider.id());
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
        print_command_json(COMMAND, &json!({
            "installed": installed,
            "failures": failures,
            "summary": summary,
            "force": force,
            "continue_on_error": continue_on_error,
        }));
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
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or_default();
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
                    return usage_error(COMMAND, json_mode, format!("Provider not found: {}", provider_id));
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
            let message = format!("Provider {} does not support uninstall operation", provider.id());
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
        print_command_json(COMMAND, &json!({
            "uninstalled": removed,
            "failures": failures,
            "summary": summary,
            "force": force,
            "continue_on_error": continue_on_error,
        }));
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
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or_default();
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
            return usage_error(COMMAND, json_mode, format!("Provider not found: {}", provider_id));
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
            return usage_error(COMMAND, json_mode, format!("Provider not found: {}", provider_id));
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

    let mut updates = Vec::new();
    let mut provider_outcomes = Vec::new();
    let platform = current_platform();

    for p in &providers {
        if !p.supported_platforms().contains(&platform) {
            provider_outcomes.push(serde_json::json!({
                "provider": p.id(),
                "status": "unsupported",
                "reason": format!("provider not supported on {}", platform.as_str()),
                "updates": 0,
                "errors": 0,
            }));
            continue;
        }

        let caps = p.capabilities();
        if !caps.contains(&Capability::Update) && !caps.contains(&Capability::Upgrade) {
            provider_outcomes.push(serde_json::json!({
                "provider": p.id(),
                "status": "unsupported",
                "reason": "provider does not declare update capability",
                "updates": 0,
                "errors": 0,
            }));
            continue;
        }

        if !p.is_available().await {
            provider_outcomes.push(serde_json::json!({
                "provider": p.id(),
                "status": "unsupported",
                "reason": "provider executable is not available",
                "updates": 0,
                "errors": 0,
            }));
            continue;
        }

        let filter_slice: Vec<String> = if update_all { vec![] } else { packages.clone() };
        match p.check_updates(&filter_slice).await {
            Ok(outdated) => {
                let update_count = outdated.len();
                for u in outdated {
                    updates.push(serde_json::json!({
                        "name": u.name, "current_version": u.current_version,
                        "latest_version": u.latest_version, "provider": p.id(),
                    }));
                }
                provider_outcomes.push(serde_json::json!({
                    "provider": p.id(),
                    "status": "supported",
                    "reason": serde_json::Value::Null,
                    "updates": update_count,
                    "errors": 0,
                }));
            }
            Err(e) => {
                provider_outcomes.push(serde_json::json!({
                    "provider": p.id(),
                    "status": "error",
                    "reason": e.to_string(),
                    "updates": 0,
                    "errors": 1,
                }));
                if !continue_on_error {
                    return runtime_error(
                        COMMAND,
                        json_mode,
                        format!("Update check failed for provider {}: {}", p.id(), e),
                    );
                }
            }
        }
    }

    let mut coverage = serde_json::json!({
        "supported": 0,
        "partial": 0,
        "unsupported": 0,
        "error": 0,
    });
    for item in &provider_outcomes {
        if let Some(status) = item.get("status").and_then(|v| v.as_str()) {
            if let Some(v) = coverage.get_mut(status) {
                if let Some(n) = v.as_i64() {
                    *v = serde_json::json!(n + 1);
                }
            }
        }
    }

    let provider_successes = provider_outcomes
        .iter()
        .filter(|item| item.get("status").and_then(|v| v.as_str()) != Some("error"))
        .count();
    let provider_failures = provider_outcomes
        .iter()
        .filter(|item| item.get("status").and_then(|v| v.as_str()) == Some("error"))
        .count();

    if json_mode {
        print_command_json(COMMAND, &serde_json::json!({
            "updates": updates,
            "provider_outcomes": provider_outcomes,
            "coverage": coverage,
            "summary": batch_summary(provider_successes, provider_failures),
            "continue_on_error": continue_on_error,
        }));
    } else if updates.is_empty() {
        println!("All packages are up to date");
        if let Some(unsupported) = coverage.get("unsupported").and_then(|v| v.as_i64()) {
            if unsupported > 0 {
                println!("\n{} provider(s) skipped/unsupported.", unsupported);
            }
        }
        if let Some(error) = coverage.get("error").and_then(|v| v.as_i64()) {
            if error > 0 {
                println!("{} provider(s) failed during update check.", error);
            }
        }
    } else {
        println!("{} update(s) available:\n", updates.len());
        let rows: Vec<Vec<String>> = updates
            .iter()
            .map(|u| {
                vec![
                    u["name"].as_str().unwrap_or("").into(),
                    u["current_version"].as_str().unwrap_or("").into(),
                    u["latest_version"].as_str().unwrap_or("").into(),
                    u["provider"].as_str().unwrap_or("").into(),
                ]
            })
            .collect();
        print_table(&["NAME", "CURRENT", "LATEST", "PROVIDER"], &rows);

        if let Some(unsupported) = coverage.get("unsupported").and_then(|v| v.as_i64()) {
            if unsupported > 0 {
                println!("\n{} provider(s) skipped/unsupported.", unsupported);
            }
        }
        if let Some(error) = coverage.get("error").and_then(|v| v.as_i64()) {
            if error > 0 {
                println!("{} provider(s) failed during update check.", error);
            }
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
                return runtime_error(COMMAND, json_mode, format!("Package not found: {}", package));
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
        other => usage_error("env", json_mode, format!("Unknown env subcommand: {}", other)),
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
                return runtime_error(
                    COMMAND,
                    json_mode,
                    format!("Detection error: {}", e),
                );
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
                print_command_json(COMMAND, &json!({
                    "env_type": detected.env_type,
                    "version": detected.version,
                    "source": detected.source,
                    "source_path": detected.source_path,
                    "path": start_path,
                }));
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
                print_command_json(COMMAND, &json!({
                    "env_type": env_type,
                    "version": serde_json::Value::Null,
                    "source": serde_json::Value::Null,
                    "path": start_path,
                }));
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
                format!("config subcommand required ({})", CONFIG_SUBCOMMANDS.join(", ")),
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
        None => return usage_error(COMMAND, json_mode, "cache subcommand required (info, clean)"),
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
                print_command_json(command, &serde_json::json!({
                    "download_cache": { "size": dl_size, "entries": dl_count },
                    "metadata_cache": { "size": md_size, "entries": md_count },
                    "total_size": total, "total_size_human": format_size(total),
                }));
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
    let type_filter = get_string(&matches.args, "type");
    let manager = HealthCheckManager::new(ctx.registry.clone());

    if let Some(ref env_type) = type_filter {
        match manager.check_environment(env_type).await {
            Ok(result) => {
                if json_mode {
                    print_command_json(COMMAND, &result);
                } else {
                    println!("Health check for {}:", env_type);
                    let is_healthy = result.issues.is_empty();
                    println!(
                        "  Status: {}",
                        if is_healthy {
                            "Healthy"
                        } else {
                            "Issues found"
                        }
                    );
                    for issue in &result.issues {
                        println!("  - {}", issue.message);
                    }
                }
                if result.issues.is_empty() {
                    0
                } else {
                    1
                }
            }
            Err(e) => {
                runtime_error(COMMAND, json_mode, format!("Health check error: {}", e))
            }
        }
    } else {
        match manager.check_all_with_progress(|_| {}).await {
            Ok(result) => {
                let total: usize = result
                    .environments
                    .iter()
                    .map(|e| e.issues.len())
                    .sum::<usize>()
                    + result
                        .package_managers
                        .iter()
                        .map(|p| p.issues.len())
                        .sum::<usize>();
                if json_mode {
                    print_command_json(COMMAND, &result);
                } else if total == 0 {
                    println!("All health checks passed");
                } else {
                    println!("{} issue(s) found:\n", total);
                    for env in &result.environments {
                        if !env.issues.is_empty() {
                            println!(
                                "  {} ({}):",
                                env.env_type,
                                env.provider_id.as_deref().unwrap_or("unknown")
                            );
                            for issue in &env.issues {
                                println!("    - {}", issue.message);
                            }
                        }
                    }
                    for pm in &result.package_managers {
                        if !pm.issues.is_empty() {
                            println!("  {}:", pm.provider_id);
                            for issue in &pm.issues {
                                println!("    - {}", issue.message);
                            }
                        }
                    }
                }
                if total > 0 {
                    1
                } else {
                    0
                }
            }
            Err(e) => {
                runtime_error(COMMAND, json_mode, format!("Health check error: {}", e))
            }
        }
    }
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
        ];
        for cmd in &expected {
            assert!(SUBCOMMANDS.contains(cmd), "Missing subcommand: {}", cmd);
        }
    }

    #[test]
    fn test_subcommands_count() {
        assert_eq!(SUBCOMMANDS.len(), 11);
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
}
