use crate::cache::{DownloadCache, MetadataCache};
use crate::commands::config::collect_config_list;
use crate::config::Settings;
use crate::core::{EnvironmentManager, HealthCheckManager, Orchestrator};
use crate::platform::disk::format_size;
use crate::provider::{InstalledFilter, ProviderRegistry, SearchOptions};
use crate::SharedRegistry;
use log::info;
use serde::Serialize;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_cli::CliExt;
use tokio::sync::RwLock;

const SUBCOMMANDS: &[&str] = &[
    "search", "install", "uninstall", "list", "update",
    "info", "env", "config", "cache", "doctor", "providers",
];

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
            return Some(2);
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
            other => {
                eprintln!("Unknown subcommand: {}", other);
                2
            }
        }
    });

    Some(exit_code)
}

// ── Arg helpers ──────────────────────────────────────────────────

fn get_flag(args: &std::collections::HashMap<String, tauri_plugin_cli::ArgData>, name: &str) -> bool {
    args.get(name)
        .map(|a| a.value == serde_json::Value::Bool(true))
        .unwrap_or(false)
}

fn get_string(args: &std::collections::HashMap<String, tauri_plugin_cli::ArgData>, name: &str) -> Option<String> {
    args.get(name).and_then(|a| match &a.value {
        serde_json::Value::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    })
}

fn get_string_list(args: &std::collections::HashMap<String, tauri_plugin_cli::ArgData>, name: &str) -> Vec<String> {
    args.get(name)
        .map(|a| match &a.value {
            serde_json::Value::Array(arr) => arr.iter().filter_map(|v| v.as_str().map(String::from)).collect(),
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
    println!("{}", widths.iter().map(|w| "-".repeat(*w)).collect::<Vec<_>>().join("  "));
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

// ── Subcommand: search ───────────────────────────────────────────

async fn cmd_search(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let query = match get_string(&matches.args, "query") {
        Some(q) => q,
        None => { eprintln!("Error: search query is required"); return 2; }
    };
    let provider_filter = get_string(&matches.args, "provider");
    let limit: usize = get_string(&matches.args, "limit").and_then(|s| s.parse().ok()).unwrap_or(20);

    let reg = ctx.registry.read().await;
    let results = if let Some(ref pid) = provider_filter {
        match reg.get(pid) {
            Some(p) => p.search(&query, SearchOptions { limit: Some(limit), page: None }).await.unwrap_or_default(),
            None => { eprintln!("Provider not found: {}", pid); return 1; }
        }
    } else {
        let ids: Vec<String> = reg.list().iter().map(|s| s.to_string()).collect();
        let providers: Vec<_> = ids.iter().filter_map(|id| reg.get(id)).collect();
        drop(reg);
        let mut all = Vec::new();
        for p in &providers {
            if p.is_available().await {
                if let Ok(mut r) = p.search(&query, SearchOptions { limit: Some(5), page: None }).await {
                    all.append(&mut r);
                }
            }
        }
        all.truncate(limit);
        all
    };

    if json_mode {
        print_json(&results);
    } else if results.is_empty() {
        println!("No results found for '{}'", query);
    } else {
        println!("{} package(s) found:\n", results.len());
        let rows: Vec<Vec<String>> = results.iter().map(|r| vec![
            r.name.clone(), r.latest_version.clone().unwrap_or_default(),
            r.provider.clone(), r.description.clone().unwrap_or_default(),
        ]).collect();
        print_table(&["NAME", "VERSION", "PROVIDER", "DESCRIPTION"], &rows);
    }
    0
}

// ── Subcommand: install ──────────────────────────────────────────

async fn cmd_install(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let packages = get_string_list(&matches.args, "packages");
    if packages.is_empty() { eprintln!("Error: at least one package name is required"); return 2; }
    info!("CLI: installing packages: {:?}", packages);
    let orchestrator = Orchestrator::new(ctx.registry.clone(), ctx.settings.clone());
    match orchestrator.install(&packages).await {
        Ok(receipts) => {
            if json_mode { print_json(&receipts); }
            else { for r in &receipts { println!("Installed {}@{} (via {})", r.name, r.version, r.provider); } }
            0
        }
        Err(e) => { eprintln!("Install error: {}", e); 1 }
    }
}

// ── Subcommand: uninstall ────────────────────────────────────────

async fn cmd_uninstall(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let packages = get_string_list(&matches.args, "packages");
    if packages.is_empty() { eprintln!("Error: at least one package name is required"); return 2; }
    info!("CLI: uninstalling packages: {:?}", packages);
    let orchestrator = Orchestrator::new(ctx.registry.clone(), ctx.settings.clone());
    match orchestrator.uninstall(&packages).await {
        Ok(()) => {
            if json_mode { print_json(&serde_json::json!({ "uninstalled": packages })); }
            else { for name in &packages { println!("Uninstalled {}", name); } }
            0
        }
        Err(e) => { eprintln!("Uninstall error: {}", e); 1 }
    }
}

// ── Subcommand: list ─────────────────────────────────────────────

async fn cmd_list(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let provider_filter = get_string(&matches.args, "provider");
    let reg = ctx.registry.read().await;
    let ids: Vec<String> = if let Some(ref id) = provider_filter { vec![id.clone()] }
    else { reg.list().into_iter().map(|s| s.to_string()).collect() };
    let providers: Vec<_> = ids.iter().filter_map(|id| reg.get(id)).collect();
    drop(reg);

    let mut all = Vec::new();
    for p in &providers {
        if p.is_available().await {
            if let Ok(mut pkgs) = p.list_installed(InstalledFilter { global_only: true, ..Default::default() }).await {
                all.append(&mut pkgs);
            }
        }
    }

    if json_mode { print_json(&all); }
    else if all.is_empty() { println!("No installed packages found"); }
    else {
        println!("{} package(s) installed:\n", all.len());
        let rows: Vec<Vec<String>> = all.iter().map(|p| vec![p.name.clone(), p.version.clone(), p.provider.clone()]).collect();
        print_table(&["NAME", "VERSION", "PROVIDER"], &rows);
    }
    0
}

// ── Subcommand: update ───────────────────────────────────────────

async fn cmd_update(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let packages = get_string_list(&matches.args, "packages");
    let update_all = get_flag(&matches.args, "all");
    let provider_filter = get_string(&matches.args, "provider");

    if packages.is_empty() && !update_all {
        eprintln!("Error: specify packages to update or use --all");
        return 2;
    }

    let reg = ctx.registry.read().await;
    let ids: Vec<String> = if let Some(ref id) = provider_filter { vec![id.clone()] }
    else { reg.list().into_iter().map(|s| s.to_string()).collect() };
    let providers: Vec<_> = ids.iter().filter_map(|id| reg.get(id)).collect();
    drop(reg);

    let mut updates = Vec::new();
    for p in &providers {
        if !p.is_available().await { continue; }
        let filter_slice: Vec<String> = if update_all { vec![] } else { packages.clone() };
        if let Ok(outdated) = p.check_updates(&filter_slice).await {
            for u in outdated {
                updates.push(serde_json::json!({
                    "name": u.name, "current_version": u.current_version,
                    "latest_version": u.latest_version, "provider": p.id(),
                }));
            }
        }
    }

    if json_mode { print_json(&updates); }
    else if updates.is_empty() { println!("All packages are up to date"); }
    else {
        println!("{} update(s) available:\n", updates.len());
        let rows: Vec<Vec<String>> = updates.iter().map(|u| vec![
            u["name"].as_str().unwrap_or("").into(), u["current_version"].as_str().unwrap_or("").into(),
            u["latest_version"].as_str().unwrap_or("").into(), u["provider"].as_str().unwrap_or("").into(),
        ]).collect();
        print_table(&["NAME", "CURRENT", "LATEST", "PROVIDER"], &rows);
    }
    0
}

// ── Subcommand: info ─────────────────────────────────────────────

async fn cmd_info(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let package = match get_string(&matches.args, "package") {
        Some(p) => p,
        None => { eprintln!("Error: package name is required"); return 2; }
    };
    let provider_filter = get_string(&matches.args, "provider");
    let reg = ctx.registry.read().await;

    let result = if let Some(ref pid) = provider_filter {
        match reg.get(pid) {
            Some(p) => p.get_package_info(&package).await,
            None => { eprintln!("Provider not found: {}", pid); return 1; }
        }
    } else {
        match reg.find_for_package(&package).await {
            Ok(Some(p)) => p.get_package_info(&package).await,
            _ => { eprintln!("Package not found: {}", package); return 1; }
        }
    };

    match result {
        Ok(info) => {
            if json_mode { print_json(&info); }
            else {
                println!("Name:        {}", info.name);
                println!("Versions:    {}", info.versions.first().map(|v| v.version.as_str()).unwrap_or("N/A"));
                println!("Provider:    {}", info.provider);
                if let Some(d) = &info.description { println!("Description: {}", d); }
                if let Some(h) = &info.homepage { println!("Homepage:    {}", h); }
                if let Some(l) = &info.license { println!("License:     {}", l); }
            }
            0
        }
        Err(e) => { eprintln!("Error: {}", e); 1 }
    }
}

// ── Subcommand: env ──────────────────────────────────────────────

async fn cmd_env(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => { eprintln!("Error: env subcommand required (list, install, use, detect)"); return 2; }
    };

    match subcmd.name.as_str() {
        "list" => cmd_env_list(ctx, &subcmd.matches, json_mode).await,
        "install" => cmd_env_install(ctx, &subcmd.matches, json_mode).await,
        "use" => cmd_env_use(ctx, &subcmd.matches, json_mode).await,
        "detect" => cmd_env_detect(ctx, &subcmd.matches, json_mode).await,
        other => { eprintln!("Unknown env subcommand: {}", other); 2 }
    }
}

async fn cmd_env_list(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let type_filter = get_string(&matches.args, "type");
    let manager = EnvironmentManager::new(ctx.registry.clone());
    match manager.list_environments_with_concurrency(4).await {
        Ok(envs) => {
            let filtered: Vec<_> = if let Some(ref t) = type_filter {
                envs.into_iter().filter(|e| e.env_type == *t).collect()
            } else { envs };

            if json_mode { print_json(&filtered); }
            else if filtered.is_empty() { println!("No environments found"); }
            else {
                let rows: Vec<Vec<String>> = filtered.iter().map(|e| vec![
                    e.env_type.clone(), e.provider.clone(),
                    e.current_version.clone().unwrap_or_else(|| "-".into()),
                    e.version_count.to_string(),
                    if e.available { "Yes" } else { "No" }.into(),
                ]).collect();
                print_table(&["TYPE", "PROVIDER", "CURRENT", "VERSIONS", "AVAILABLE"], &rows);
            }
            0
        }
        Err(e) => { eprintln!("Error: {}", e); 1 }
    }
}

async fn cmd_env_install(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let version = match get_string(&matches.args, "version") {
        Some(v) => v,
        None => { eprintln!("Error: version is required"); return 2; }
    };
    let env_type = match get_string(&matches.args, "type") {
        Some(t) => t,
        None => { eprintln!("Error: --type is required (e.g. --type node)"); return 2; }
    };
    let provider_id = get_string(&matches.args, "provider");

    let manager = EnvironmentManager::new(ctx.registry.clone());
    let (logical, _key, provider) = match manager.resolve_provider(&env_type, provider_id.as_deref(), Some(&version)).await {
        Ok(r) => r,
        Err(e) => { eprintln!("Error resolving provider: {}", e); return 1; }
    };

    println!("Installing {} {} via {}...", logical, version, provider.id());
    let request = crate::provider::InstallRequest {
        name: logical.clone(), version: Some(version.clone()), global: true, force: false,
    };
    match provider.install(request).await {
        Ok(receipt) => {
            if json_mode { print_json(&receipt); }
            else { println!("Successfully installed {} {} (via {})", logical, receipt.version, receipt.provider); }
            0
        }
        Err(e) => { eprintln!("Install error: {}", e); 1 }
    }
}

async fn cmd_env_use(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let version = match get_string(&matches.args, "version") {
        Some(v) => v,
        None => { eprintln!("Error: version is required"); return 2; }
    };
    let env_type = match get_string(&matches.args, "type") {
        Some(t) => t,
        None => { eprintln!("Error: --type is required"); return 2; }
    };
    let local_path = get_string(&matches.args, "local");
    let provider_id = get_string(&matches.args, "provider");

    let manager = EnvironmentManager::new(ctx.registry.clone());
    let result = if let Some(ref path) = local_path {
        manager.set_local_version(&env_type, std::path::Path::new(path), &version, provider_id.as_deref()).await
    } else {
        manager.set_global_version(&env_type, &version, provider_id.as_deref()).await
    };

    match result {
        Ok(()) => {
            let scope = if local_path.is_some() { "local" } else { "global" };
            if json_mode {
                print_json(&serde_json::json!({ "env_type": env_type, "version": version, "scope": scope }));
            } else {
                println!("Set {} {} as {} version", env_type, version, scope);
            }
            0
        }
        Err(e) => { eprintln!("Error: {}", e); 1 }
    }
}

async fn cmd_env_detect(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let type_filter = get_string(&matches.args, "type");
    let start_path = get_string(&matches.args, "path").unwrap_or_else(|| ".".into());
    let manager = EnvironmentManager::new(ctx.registry.clone());

    if let Some(ref env_type) = type_filter {
        let sources = crate::core::project_env_detect::default_enabled_detection_sources(env_type);
        match manager.detect_version_with_sources(env_type, std::path::Path::new(&start_path), &sources).await {
            Ok(Some(d)) => {
                if json_mode { print_json(&d); }
                else { println!("{} {} (detected via {})", d.env_type, d.version, d.source); }
            }
            Ok(None) => {
                if json_mode { print_json(&serde_json::Value::Null); }
                else { println!("No {} environment detected", env_type); }
            }
            Err(e) => { eprintln!("Detection error: {}", e); return 1; }
        }
    } else {
        let all_types = crate::provider::SystemEnvironmentType::all();
        let mut detected = Vec::new();
        for env in &all_types {
            let et = env.env_type();
            let sources = crate::core::project_env_detect::default_enabled_detection_sources(et);
            if let Ok(Some(d)) = manager.detect_version_with_sources(et, std::path::Path::new(&start_path), &sources).await {
                detected.push(d);
            }
        }
        if json_mode { print_json(&detected); }
        else if detected.is_empty() { println!("No environments detected in {}", start_path); }
        else {
            let rows: Vec<Vec<String>> = detected.iter().map(|d| vec![d.env_type.clone(), d.version.clone(), d.source.clone()]).collect();
            print_table(&["TYPE", "VERSION", "SOURCE"], &rows);
        }
    }
    0
}

// ── Subcommand: config ───────────────────────────────────────────

async fn cmd_config(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => { eprintln!("Error: config subcommand required (get, set, list, reset)"); return 2; }
    };
    match subcmd.name.as_str() {
        "get" => {
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(k) => k, None => { eprintln!("Error: key is required"); return 2; }
            };
            match ctx.settings.get_value(&key) {
                Some(v) => { if json_mode { print_json(&serde_json::json!({ "key": key, "value": v })); } else { println!("{}", v); } 0 }
                None => { eprintln!("Unknown key: {}", key); 1 }
            }
        }
        "set" => {
            let key = match get_string(&subcmd.matches.args, "key") {
                Some(k) => k, None => { eprintln!("Error: key is required"); return 2; }
            };
            let value = match get_string(&subcmd.matches.args, "value") {
                Some(v) => v, None => { eprintln!("Error: value is required"); return 2; }
            };
            let mut settings = ctx.settings.clone();
            if let Err(e) = settings.set_value(&key, &value) { eprintln!("Error: {}", e); return 1; }
            if let Err(e) = settings.save().await { eprintln!("Error saving: {}", e); return 1; }
            if json_mode { print_json(&serde_json::json!({ "key": key, "value": value })); }
            else { println!("Set {} = {}", key, value); }
            0
        }
        "list" => {
            let entries = collect_config_list(&ctx.settings);
            if json_mode {
                let map: serde_json::Map<String, serde_json::Value> = entries.into_iter().map(|(k, v)| (k, serde_json::Value::String(v))).collect();
                print_json(&map);
            } else {
                let rows: Vec<Vec<String>> = entries.iter().map(|(k, v)| vec![k.clone(), v.clone()]).collect();
                print_table(&["KEY", "VALUE"], &rows);
            }
            0
        }
        "reset" => {
            let defaults = Settings::default();
            if let Err(e) = defaults.save().await { eprintln!("Error: {}", e); return 1; }
            if json_mode { print_json(&serde_json::json!({ "status": "reset" })); }
            else { println!("Configuration reset to defaults"); }
            0
        }
        other => { eprintln!("Unknown config subcommand: {}", other); 2 }
    }
}

// ── Subcommand: cache ────────────────────────────────────────────

async fn cmd_cache(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let subcmd = match matches.subcommand.as_ref() {
        Some(s) => s,
        None => { eprintln!("Error: cache subcommand required (info, clean)"); return 2; }
    };
    let cache_dir = ctx.settings.get_cache_dir();

    match subcmd.name.as_str() {
        "info" => {
            let dl = DownloadCache::open(&cache_dir).await.ok().and_then(|c| {
                tauri::async_runtime::block_on(c.stats()).ok()
            });
            let md = MetadataCache::open_with_ttl(&cache_dir, ctx.settings.general.metadata_cache_ttl as i64)
                .await.ok().and_then(|c| tauri::async_runtime::block_on(c.stats()).ok());

            let dl_size = dl.as_ref().map(|s| s.total_size).unwrap_or(0);
            let dl_count = dl.as_ref().map(|s| s.entry_count).unwrap_or(0);
            let md_size = md.as_ref().map(|s| s.total_size).unwrap_or(0);
            let md_count = md.as_ref().map(|s| s.entry_count).unwrap_or(0);
            let total = dl_size + md_size;

            if json_mode {
                print_json(&serde_json::json!({
                    "download_cache": { "size": dl_size, "entries": dl_count },
                    "metadata_cache": { "size": md_size, "entries": md_count },
                    "total_size": total, "total_size_human": format_size(total),
                }));
            } else {
                println!("Cache Statistics:");
                println!("  Download cache: {} ({} entries)", format_size(dl_size), dl_count);
                println!("  Metadata cache: {} ({} entries)", format_size(md_size), md_count);
                println!("  Total:          {}", format_size(total));
            }
            0
        }
        "clean" => {
            let clean_all = get_flag(&subcmd.matches.args, "all");
            let clean_expired = get_flag(&subcmd.matches.args, "expired");
            let mut total_freed: u64 = 0;

            if clean_all || clean_expired {
                if let Ok(mut dl) = DownloadCache::open(&cache_dir).await {
                    let max_age = std::time::Duration::from_secs(ctx.settings.general.cache_max_age_days as u64 * 86400);
                    if let Ok(freed) = dl.clean_expired(max_age).await { total_freed += freed; }
                }
                if let Ok(mut md) = MetadataCache::open_with_ttl(&cache_dir, ctx.settings.general.metadata_cache_ttl as i64).await {
                    let _ = md.clean_expired().await;
                }
            }
            if clean_all {
                if let Ok(mut dl) = DownloadCache::open(&cache_dir).await {
                    let _ = dl.evict_to_size(0).await;
                }
            }

            if json_mode { print_json(&serde_json::json!({ "freed_bytes": total_freed, "freed_human": format_size(total_freed) })); }
            else { println!("Cache cleaned (freed {})", format_size(total_freed)); }
            0
        }
        other => { eprintln!("Unknown cache subcommand: {}", other); 2 }
    }
}

// ── Subcommand: doctor ───────────────────────────────────────────

async fn cmd_doctor(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let type_filter = get_string(&matches.args, "type");
    let manager = HealthCheckManager::new(ctx.registry.clone());

    if let Some(ref env_type) = type_filter {
        match manager.check_environment(env_type).await {
            Ok(result) => {
                if json_mode { print_json(&result); }
                else {
                    println!("Health check for {}:", env_type);
                    let is_healthy = result.issues.is_empty();
                    println!("  Status: {}", if is_healthy { "Healthy" } else { "Issues found" });
                    for issue in &result.issues { println!("  - {}", issue.message); }
                }
                if result.issues.is_empty() { 0 } else { 1 }
            }
            Err(e) => { eprintln!("Health check error: {}", e); 1 }
        }
    } else {
        match manager.check_all_with_progress(|_| {}).await {
            Ok(result) => {
                let total: usize = result.environments.iter().map(|e| e.issues.len()).sum::<usize>()
                    + result.package_managers.iter().map(|p| p.issues.len()).sum::<usize>();
                if json_mode { print_json(&result); }
                else if total == 0 { println!("All health checks passed"); }
                else {
                    println!("{} issue(s) found:\n", total);
                    for env in &result.environments {
                        if !env.issues.is_empty() {
                            println!("  {} ({}):", env.env_type, env.provider_id.as_deref().unwrap_or("unknown"));
                            for issue in &env.issues { println!("    - {}", issue.message); }
                        }
                    }
                    for pm in &result.package_managers {
                        if !pm.issues.is_empty() {
                            println!("  {}:", pm.provider_id);
                            for issue in &pm.issues { println!("    - {}", issue.message); }
                        }
                    }
                }
                if total > 0 { 1 } else { 0 }
            }
            Err(e) => { eprintln!("Health check error: {}", e); 1 }
        }
    }
}

// ── Subcommand: providers ────────────────────────────────────────

async fn cmd_providers(ctx: &CliContext, matches: &tauri_plugin_cli::Matches, json_mode: bool) -> i32 {
    let system_only = get_flag(&matches.args, "system");
    let reg = ctx.registry.read().await;

    if system_only {
        let ids = reg.get_system_provider_ids();
        if json_mode { print_json(&ids); }
        else { println!("System providers:\n"); for id in &ids { println!("  {}", id); } }
    } else {
        let providers = reg.list_all_info();
        if json_mode { print_json(&providers); }
        else {
            println!("{} provider(s) available:\n", providers.len());
            let rows: Vec<Vec<String>> = providers.iter().map(|p| vec![
                p.id.clone(), p.display_name.clone(),
                p.platforms.iter().map(|pl| format!("{:?}", pl)).collect::<Vec<_>>().join(", "),
            ]).collect();
            print_table(&["ID", "NAME", "PLATFORMS"], &rows);
        }
    }
    0
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
            "search", "install", "uninstall", "list", "update",
            "info", "env", "config", "cache", "doctor", "providers",
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
        print_table(
            &["名称", "版本"],
            &[vec!["软件包".into(), "1.0.0".into()]],
        );
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

    // ── Combined arg scenarios ───────────────────────────────────

    #[test]
    fn test_mixed_args_extraction() {
        let args = make_args(&[
            ("json", serde_json::Value::Bool(true), 1),
            ("provider", serde_json::Value::String("npm".into()), 1),
            ("packages", serde_json::Value::Array(vec![
                serde_json::Value::String("a".into()),
                serde_json::Value::String("b".into()),
            ]), 2),
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
