pub mod cache;
pub mod cli;
pub mod commands;
pub mod config;
pub mod core;
pub mod download;
pub mod error;
pub mod platform;
pub mod plugin;
pub mod provider;
pub mod resolver;
pub mod secrets;
pub mod tray;

use cache::{CleanupHistory, CleanupRecordBuilder, DownloadCache, DownloadResumer, MetadataCache};
use commands::custom_detection::SharedCustomDetectionManager;
#[cfg(not(test))]
use commands::download::{setup_download_manager, SharedDownloadManager};
#[cfg(not(test))]
use commands::plugin::SharedPluginManager;
use commands::terminal::SharedTerminalProfileManager;
use config::Settings;
#[cfg(not(test))]
use core::custom_detection::CustomDetectionManager;
#[cfg(not(test))]
use core::terminal::TerminalProfileManager;
use log::{debug, info};
use provider::ProviderRegistry;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Emitter;
#[cfg(not(test))]
use tauri::Manager;
#[cfg(not(debug_assertions))]
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tokio::sync::RwLock;
use tokio::time::Duration;
#[cfg(not(test))]
use tray::{SharedTrayState, TrayLanguage, TrayState};

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;
pub type SharedSettings = Arc<RwLock<Settings>>;
pub type SharedSecretVault = Arc<RwLock<secrets::SecretVault>>;
pub type CancellationTokens = Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>;

/// Flag to indicate if initialization is complete
pub static INITIALIZED: AtomicBool = AtomicBool::new(false);

/// Helper to check if the app is fully initialized
pub fn is_initialized() -> bool {
    INITIALIZED.load(Ordering::SeqCst)
}

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install panic hook BEFORE anything else so crashes generate reports
    commands::diagnostic::install_panic_hook();

    #[cfg(debug_assertions)]
    let devtools_plugin = tauri_plugin_devtools::init();

    let mut builder = tauri::Builder::default();

    // Single-instance must be the FIRST plugin registered (Tauri docs requirement).
    // Skip it when a CLI subcommand is detected so headless commands run independently.
    #[cfg(desktop)]
    {
        if !cli::has_cli_subcommand() {
            builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                let payload = serde_json::json!({ "args": args, "cwd": cwd });
                let _ = app.emit("single-instance", payload);
            }));
        }
    }

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools_plugin);
    }

    let stronghold_salt_path = crate::platform::fs::get_config_dir()
        .unwrap_or_default()
        .join("secrets.salt");

    builder = builder.plugin(tauri_plugin_positioner::init());
    builder = builder.plugin(tauri_plugin_os::init());
    builder = builder
        .plugin(tauri_plugin_stronghold::Builder::with_argon2(&stronghold_salt_path).build());

    builder
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            {
                // Keep structured file/webview logging in release builds.
                // Debug builds use CrabNebula DevTools instead of tauri-plugin-log
                // because the two logger integrations conflict.
                let log_level = {
                    let settings_state = app.state::<SharedSettings>().inner().clone();
                    let guard = tauri::async_runtime::block_on(settings_state.read());
                    let configured = guard.log.log_level.clone();
                    drop(guard);
                    match configured.as_str() {
                        "trace" => log::LevelFilter::Trace,
                        "debug" => log::LevelFilter::Debug,
                        "warn" => log::LevelFilter::Warn,
                        "error" => log::LevelFilter::Error,
                        "info" => log::LevelFilter::Info,
                        _ => log::LevelFilter::Info,
                    }
                };

                let session_file_name = chrono::Local::now()
                    .format("%Y-%m-%d_%H-%M-%S")
                    .to_string();

                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .targets([
                            Target::new(TargetKind::Stdout),
                            Target::new(TargetKind::Webview),
                            Target::new(TargetKind::LogDir {
                                file_name: Some(session_file_name),
                            }),
                        ])
                        .format(|out, message, record| {
                            out.finish(format_args!(
                                "[{}][{}][{}] {}",
                                chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                                record.level(),
                                record.target(),
                                message
                            ))
                        })
                        .rotation_strategy(RotationStrategy::KeepAll)
                        .max_file_size(50_000_000)
                        .level(log_level)
                        .level_for("hyper", log::LevelFilter::Info)
                        .level_for("reqwest", log::LevelFilter::Info)
                        .level_for("tao", log::LevelFilter::Info)
                        .level_for("wry", log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Register CLI plugin for argument parsing
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_cli::init())?;

            // Register global shortcut plugin (frontend JS API handles registration)
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;

            // Initialize provider registry with defaults asynchronously
            let registry = app.state::<SharedRegistry>().inner().clone();
            let settings = app.state::<SharedSettings>().inner().clone();
            let tray_state = app.state::<SharedTrayState>().inner().clone();
            let custom_detection = app.state::<SharedCustomDetectionManager>().inner().clone();

            // Get config directory for custom detection rules
            let config_dir = app.path().app_config_dir().unwrap_or_default();

            // Get app handles before the async block
            let app_handle_for_init = app.handle().clone();
            let mut cognia_dir_for_plugins = std::path::PathBuf::new();
            let mut startup_window_effect = String::new();
            let mut startup_theme = String::new();
            let mut startup_start_minimized = false;

            // ═══════════════════════════════════════════════════════════════════
            // CRITICAL PATH (block_on) — only fast, essential operations.
            // Everything here must complete before the webview starts rendering.
            // ═══════════════════════════════════════════════════════════════════
            tauri::async_runtime::block_on(async {
                // 1. Load settings from disk
                match Settings::load().await {
                    Ok(loaded_settings) => {
                        let mut settings_guard = settings.write().await;
                        *settings_guard = loaded_settings;
                        info!("Settings loaded successfully");
                    }
                    Err(e) => {
                        info!("Using default settings: {}", e);
                    }
                }

                // Hydrate tray runtime state from persisted settings so tray behavior
                // remains consistent across restarts.
                {
                    let settings_guard = settings.read().await;
                    let mut tray_guard = tray_state.write().await;
                    tray_guard.click_behavior = settings_guard.tray.click_behavior;
                    tray_guard.quick_action = settings_guard.tray.quick_action;
                    if matches!(tray_guard.click_behavior, tray::TrayClickBehavior::CheckUpdates) {
                        tray_guard.quick_action = tray::TrayQuickAction::CheckUpdates;
                    }
                    tray_guard.minimize_to_tray = settings_guard.tray.minimize_to_tray;
                    tray_guard.start_minimized = settings_guard.tray.start_minimized;
                    tray_guard.show_notifications = settings_guard.tray.show_notifications;
                    tray_guard.notification_level = settings_guard.tray.notification_level;
                    tray_guard.notification_events = settings_guard.tray.notification_events.clone();
                    tray_guard.menu_config = tray::normalize_tray_menu_config(&tray::TrayMenuConfig {
                        items: settings_guard.tray.menu_items.clone(),
                        priority_items: settings_guard.tray.menu_priority_items.clone(),
                    });
                    tray_guard.language = if settings_guard.appearance.language == "zh" {
                        TrayLanguage::Zh
                    } else {
                        TrayLanguage::En
                    };
                    startup_start_minimized = tray_guard.start_minimized;
                    startup_window_effect = settings_guard.appearance.window_effect.clone();
                    startup_theme = settings_guard.appearance.theme.clone();
                    cognia_dir_for_plugins = settings_guard.get_root_dir();
                }
                emit_init_progress(&app_handle_for_init, "settings", 15, "splash.loadingSettings");

                // 2. Initialize the shared HTTP client with proxy/security settings
                {
                    let settings_guard = settings.read().await;
                    platform::proxy::rebuild_shared_client(&settings_guard);
                }

                // 3. Ensure critical directories exist (fast filesystem ops)
                {
                    let s = settings.read().await;
                    let dirs = [
                        s.get_root_dir(),
                        s.get_cache_dir(),
                        s.get_environments_dir(),
                        s.get_bin_dir(),
                        s.get_state_dir(),
                    ];
                    drop(s);
                    for dir in &dirs {
                        if let Err(e) = platform::fs::create_dir_all(dir).await {
                            info!("Directory ensure error {:?}: {}", dir, e);
                        }
                    }
                }

                // 4. Initialize provider registry (struct construction, no subprocess I/O)
                let settings_guard = settings.read().await;
                match ProviderRegistry::with_settings(&settings_guard).await {
                    Ok(initialized_registry) => {
                        drop(settings_guard);
                        let mut registry_guard = registry.write().await;
                        *registry_guard = initialized_registry;
                        info!("Provider registry initialized with settings");
                    }
                    Err(e) => {
                        drop(settings_guard);
                        info!("Provider registry initialization error: {}", e);
                    }
                }
                emit_init_progress(&app_handle_for_init, "providers", 40, "splash.loadingProviders");
            });

            // ═══════════════════════════════════════════════════════════════════
            // CLI HANDLER — if a subcommand was invoked, run it headless and exit.
            // Settings + ProviderRegistry are initialized at this point.
            // ═══════════════════════════════════════════════════════════════════
            if let Some(exit_code) = cli::handle_cli(app.handle()) {
                std::process::exit(exit_code);
            }

            // ═══════════════════════════════════════════════════════════════════
            // PRE-REGISTER MANAGERS as empty/default placeholders.
            // Commands will see empty state until background init completes.
            // ═══════════════════════════════════════════════════════════════════
            let download_mgr: SharedDownloadManager = Arc::new(RwLock::new(download::DownloadManager::default()));
            app.manage(download_mgr.clone());

            let terminal_mgr: SharedTerminalProfileManager = Arc::new(RwLock::new(TerminalProfileManager::empty()));
            app.manage(terminal_mgr.clone());

            // PluginManager::new() is synchronous — safe to call here
            let plugin_deps = plugin::PluginDeps {
                registry: registry.clone(),
                settings: settings.clone(),
                download_manager: Some(download_mgr.clone()),
                app_handle: Some(app.handle().clone()),
            };
            let plugin_mgr: SharedPluginManager = Arc::new(RwLock::new(
                plugin::PluginManager::new(&cognia_dir_for_plugins, plugin_deps),
            ));
            app.manage(plugin_mgr.clone());

            // ═══════════════════════════════════════════════════════════════════
            // DEFERRED INIT (background spawn) — heavy I/O, subprocess calls,
            // database checks. Runs while the webview is already rendering.
            // ═══════════════════════════════════════════════════════════════════
            let bg_app = app.handle().clone();
            let bg_settings = settings.clone();
            let bg_custom_detection = custom_detection.clone();
            let bg_download = download_mgr.clone();
            let bg_terminal = terminal_mgr.clone();
            let bg_plugin = plugin_mgr.clone();
            let bg_config_dir = config_dir.clone();

            tauri::async_runtime::spawn(async move {
                // Read startup settings once for the entire deferred init
                let startup_cfg = bg_settings.read().await.startup.clone();

                // ── Resource integrity check (config parsability, cache DB) ──
                emit_init_progress(&bg_app, "resources", 50, "splash.checkingResources");
                {
                    let s = bg_settings.read().await;
                    let cache_dir = s.get_cache_dir();
                    drop(s);

                    // Config file parsability check (always runs — fast and critical)
                    if let Some(config_path) = Settings::config_path() {
                        if platform::fs::exists(&config_path).await {
                            match platform::fs::read_file_string(&config_path).await {
                                Ok(content) => {
                                    if toml::from_str::<Settings>(&content).is_err() {
                                        info!("Config file corrupted, backing up and resetting to defaults");
                                        let backup = config_path.with_extension("toml.bak");
                                        let _ = platform::fs::copy_file(&config_path, &backup).await;
                                        let _ = Settings::default().save().await;
                                    }
                                }
                                Err(e) => info!("Cannot read config file: {}", e),
                            }
                        }
                    }

                    // Cache DB integrity check (can be slow on large databases)
                    if startup_cfg.integrity_check {
                        if let Ok(dl_cache) = DownloadCache::open(&cache_dir).await {
                            match dl_cache.integrity_check().await {
                                Ok(result) if !result.ok => {
                                    info!("Cache DB integrity issues: {:?}", result.errors);
                                }
                                Err(e) => info!("Cache DB integrity check failed: {}", e),
                                _ => info!("Cache DB integrity OK"),
                            }
                        }
                    } else {
                        info!("Cache DB integrity check skipped (disabled in startup settings)");
                    }

                    info!("Resource integrity check complete");
                }

                // ── Custom detection manager ──
                emit_init_progress(&bg_app, "detection", 60, "splash.loadingDetection");
                {
                    let mut custom_detection_guard = bg_custom_detection.write().await;
                    *custom_detection_guard = CustomDetectionManager::new(&bg_config_dir);
                    if let Err(e) = custom_detection_guard.load().await {
                        info!("Custom detection rules load error (using defaults): {}", e);
                    } else {
                        info!("Custom detection rules loaded");
                    }
                }

                // ── Download manager (replaces pre-registered default) ──
                emit_init_progress(&bg_app, "downloads", 70, "splash.loadingDownloads");
                {
                    let settings_guard = bg_settings.read().await;
                    setup_download_manager(bg_download, bg_app.clone(), &settings_guard).await;
                    drop(settings_guard);
                    info!("Download manager initialized");
                }

                // ── Terminal profile manager (replaces pre-registered empty) ──
                emit_init_progress(&bg_app, "terminal", 80, "splash.loadingTerminal");
                {
                    let cognia_dir = bg_settings.read().await.get_root_dir();
                    match TerminalProfileManager::new(&cognia_dir).await {
                        Ok(mgr) => {
                            *bg_terminal.write().await = mgr;
                            info!("Terminal profile manager initialized");
                        }
                        Err(e) => {
                            info!("Terminal profile manager init error (using empty): {}", e);
                            // Keep the empty placeholder — commands will return empty lists
                        }
                    }
                }

                // ── Plugin manager (init discovers & loads plugins) ──
                emit_init_progress(&bg_app, "plugins", 90, "splash.loadingPlugins");
                {
                    let mut plugin_guard = bg_plugin.write().await;
                    if let Err(e) = plugin_guard.init().await {
                        info!("Plugin manager init error: {}", e);
                    } else {
                        info!("Plugin manager initialized");
                    }
                }

                // Mark initialization as complete
                INITIALIZED.store(true, Ordering::SeqCst);
                emit_init_progress(&bg_app, "ready", 100, "splash.ready");
                info!("Application initialization complete");
            });

            // Apply window effect from persisted settings
            {
                if let Some(window) = app.get_webview_window("main") {
                    let dark = match startup_theme.as_str() {
                        "dark" => Some(true),
                        "light" => Some(false),
                        _ => None,
                    };
                    if let Err(e) =
                        commands::window_effect::apply_effect_to_window(
                            &window,
                            &startup_window_effect,
                            dark,
                        )
                    {
                        info!("Window effect apply failed: {}", e);
                    }
                }
            }

            // Initialize system tray
            if let Err(e) = tray::setup_tray(app.handle()) {
                info!("Failed to setup system tray: {}", e);
            }

            // Hide window if start-minimized is enabled
            if startup_start_minimized || tray::should_start_minimized(app.handle()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                    info!("Started minimized to tray");
                }
            }

            // Run log cleanup on startup if auto_cleanup is enabled
            {
                let log_settings = app.state::<SharedSettings>().inner().clone();
                let log_app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let settings_guard = log_settings.read().await;
                    if settings_guard.log.auto_cleanup {
                        let max_retention_days = settings_guard.log.max_retention_days;
                        let max_total_size_mb = settings_guard.log.max_total_size_mb;
                        drop(settings_guard);
                        match commands::log::cleanup_logs_with_policy(
                            &log_app_handle,
                            max_retention_days,
                            max_total_size_mb,
                        )
                        .await
                        {
                            Ok(result) if result.deleted_count > 0 => {
                                info!(
                                    "Log auto-cleanup: deleted {} files, freed {} bytes",
                                    result.deleted_count, result.freed_bytes
                                );
                            }
                            Err(e) => {
                                info!("Log auto-cleanup error: {}", e);
                            }
                            _ => {}
                        }
                    }
                });
            }

            // Start background cache cleanup task
            let cleanup_settings = app.state::<SharedSettings>().inner().clone();
            let cleanup_app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                cache_cleanup_task(cleanup_settings, cleanup_app_handle).await;
            });

            // Start background auto-backup task
            {
                let backup_settings = app.state::<SharedSettings>().inner().clone();
                let backup_tm = app.state::<SharedTerminalProfileManager>().inner().clone();
                let backup_pm = app.state::<core::profiles::SharedProfileManager>().inner().clone();
                let backup_cdm = app.state::<SharedCustomDetectionManager>().inner().clone();
                tauri::async_runtime::spawn(async move {
                    auto_backup_task(backup_settings, backup_tm, backup_pm, backup_cdm).await;
                });
            }

            Ok(())
        })
        .manage(Arc::new(core::VersionCache::new(core::VERSION_CACHE_TTL)) as core::SharedVersionCache)
        .manage(Arc::new(core::eol::EolCache::new()) as commands::environment::SharedEolCache)
        .manage(Arc::new(RwLock::new(ProviderRegistry::new())) as SharedRegistry)
        .manage(Arc::new(RwLock::new(Settings::default())) as SharedSettings)
        .manage(Arc::new(RwLock::new(secrets::SecretVault::default())) as SharedSecretVault)
        .manage(Arc::new(RwLock::new(HashMap::new())) as CancellationTokens)
        .manage(Arc::new(RwLock::new(TrayState::default())) as SharedTrayState)
        .manage(Arc::new(RwLock::new(CustomDetectionManager::new(
            std::path::Path::new(""),
        ))) as SharedCustomDetectionManager)
        .manage(core::create_shared_profile_manager(
            std::path::PathBuf::from(""),
            Arc::new(RwLock::new(ProviderRegistry::new())),
        ))
        .invoke_handler(tauri::generate_handler![
            // Environment commands
            commands::environment::env_list,
            commands::environment::env_get,
            commands::environment::env_install,
            commands::environment::env_uninstall,
            commands::environment::env_use_global,
            commands::environment::env_use_local,
            commands::environment::env_detect,
            commands::environment::env_detect_all,
            commands::environment::env_available_versions,
            commands::environment::env_list_providers,
            commands::environment::env_resolve_alias,
            commands::environment::env_install_cancel,
            commands::environment::env_save_settings,
            commands::environment::env_load_settings,
            commands::environment::env_detect_system_all,
            commands::environment::env_detect_providers_all,
            commands::environment::env_detect_system,
            commands::environment::env_get_type_mapping,
            commands::environment::env_verify_install,
            commands::environment::env_installed_versions,
            commands::environment::env_current_version,
            // Detection source commands
            commands::environment::env_get_detection_sources,
            commands::environment::env_get_default_detection_sources,
            commands::environment::env_get_all_detection_sources,
            // EOL commands
            commands::environment::env_get_eol_info,
            commands::environment::env_get_version_eol,
            // Environment update checking & cleanup commands
            commands::environment::env_check_updates,
            commands::environment::env_check_updates_all,
            commands::environment::env_cleanup_versions,
            commands::environment::env_list_global_packages,
            commands::environment::env_migrate_packages,
            // Rustup-specific commands
            commands::environment::rustup_list_components,
            commands::environment::rustup_add_component,
            commands::environment::rustup_remove_component,
            commands::environment::rustup_list_targets,
            commands::environment::rustup_add_target,
            commands::environment::rustup_remove_target,
            commands::environment::rustup_show,
            commands::environment::rustup_self_update,
            commands::environment::rustup_update_all,
            commands::environment::rustup_override_set,
            commands::environment::rustup_override_unset,
            commands::environment::rustup_override_list,
            commands::environment::rustup_run,
            commands::environment::rustup_which,
            commands::environment::rustup_get_profile,
            commands::environment::rustup_set_profile,
            // Go-specific commands
            commands::environment::go_env_info,
            commands::environment::go_mod_tidy,
            commands::environment::go_mod_download,
            commands::environment::go_clean_cache,
            commands::environment::go_cache_info,
            // Package commands
            commands::package::package_search,
            commands::package::package_info,
            commands::package::package_install,
            commands::package::pre_install_validate,
            commands::package::package_uninstall,
            commands::package::package_list,
            commands::package::provider_list,
            commands::package::provider_check,
            commands::package::provider_status,
            commands::package::provider_system_list,
            commands::package::provider_status_all,
            commands::package::package_check_installed,
            commands::package::package_versions,
            commands::package::provider_enable,
            commands::package::provider_disable,
            commands::package::provider_set_priority,
            commands::package::resolve_dependency_conflict,
            // Config commands
            commands::config::config_get,
            commands::config::config_set,
            commands::config::config_list,
            commands::config::config_list_defaults,
            commands::config::config_reset,
            commands::config::config_export,
            commands::config::config_import,
            commands::secrets::secret_vault_status,
            commands::secrets::secret_vault_setup,
            commands::secrets::secret_vault_unlock,
            commands::secrets::secret_vault_lock,
            commands::secrets::secret_vault_reset,
            commands::config::detect_system_proxy,
            commands::config::test_proxy_connection,
            commands::config::get_cognia_dir,
            commands::config::get_platform_info,
            commands::config::get_disk_info,
            commands::config::get_network_interfaces,
            commands::config::get_components_info,
            commands::config::get_battery_info,
            commands::config::app_check_init,
            // Cache commands
            commands::cache::cache_info,
            commands::cache::cache_clean,
            commands::cache::cache_clean_preview,
            commands::cache::cache_clean_enhanced,
            commands::cache::cache_verify,
            commands::cache::cache_repair,
            commands::cache::get_cache_settings,
            commands::cache::set_cache_settings,
            commands::cache::get_cleanup_history,
            commands::cache::clear_cleanup_history,
            commands::cache::get_cleanup_summary,
            // Cache access stats
            commands::cache::get_cache_access_stats,
            commands::cache::reset_cache_access_stats,
            // Cache entry browser
            commands::cache::list_cache_entries,
            commands::cache::delete_cache_entry,
            commands::cache::delete_cache_entries,
            // Hot files
            commands::cache::get_top_accessed_entries,
            // External cache management
            commands::cache::discover_external_caches,
            commands::cache::discover_external_caches_fast,
            commands::cache::discover_external_cache_candidates,
            commands::cache::probe_external_cache_provider,
            commands::cache::calculate_external_cache_size,
            commands::cache::clean_external_cache,
            commands::cache::clean_all_external_caches,
            commands::cache::get_combined_cache_stats,
            // Cache size monitoring
            commands::cache::cache_size_monitor,
            // Cache path management
            commands::cache::get_cache_path_info,
            commands::cache::set_cache_path,
            commands::cache::reset_cache_path,
            // Cache migration
            commands::cache::cache_migration_validate,
            commands::cache::cache_migrate,
            // Force clean
            commands::cache::cache_force_clean,
            commands::cache::cache_force_clean_external,
            // External cache paths
            commands::cache::get_external_cache_paths,
            // Database optimization & size history
            commands::cache::cache_optimize,
            commands::cache::get_cache_size_history,
            // Backup & database maintenance
            commands::backup::backup_create,
            commands::backup::backup_restore,
            commands::backup::backup_list,
            commands::backup::backup_delete,
            commands::backup::backup_validate,
            commands::backup::backup_export,
            commands::backup::backup_import,
            commands::backup::backup_cleanup,
            commands::backup::db_integrity_check,
            commands::backup::db_get_info,
            // Batch operations
            commands::batch::batch_install,
            commands::batch::batch_uninstall,
            commands::batch::batch_update,
            commands::batch::resolve_dependencies,
            commands::batch::check_updates,
            commands::batch::package_pin,
            commands::batch::package_unpin,
            commands::batch::get_pinned_packages,
            commands::batch::package_rollback,
            commands::batch::get_install_history,
            commands::batch::get_package_history,
            commands::batch::clear_install_history,
            // Health check commands
            commands::health_check::health_check_all,
            commands::health_check::health_check_environment,
            commands::health_check::health_check_fix,
            commands::health_check::health_check_package_manager,
            commands::health_check::health_check_package_managers,
            // Profile commands
            commands::profiles::profile_list,
            commands::profiles::profile_get,
            commands::profiles::profile_create,
            commands::profiles::profile_update,
            commands::profiles::profile_delete,
            commands::profiles::profile_apply,
            commands::profiles::profile_export,
            commands::profiles::profile_import,
            commands::profiles::profile_create_from_current,
            commands::profiles::profile_capture_wsl_snapshot,
            commands::profiles::profile_apply_wsl_snapshot,
            // Search commands
            commands::search::advanced_search,
            commands::search::search_suggestions,
            commands::search::compare_packages,
            // Launch commands
            commands::launch::launch_with_env,
            commands::launch::launch_with_streaming,
            commands::launch::env_activate,
            commands::launch::env_get_info,
            commands::launch::exec_shell_with_env,
            commands::launch::which_program,
            // Shim commands
            commands::shim::shim_create,
            commands::shim::shim_remove,
            commands::shim::shim_list,
            commands::shim::shim_update,
            commands::shim::shim_regenerate_all,
            // PATH commands
            commands::shim::path_status,
            commands::shim::path_setup,
            commands::shim::path_remove,
            commands::shim::path_check,
            commands::shim::path_get_add_command,
            // Environment variable management commands
            commands::envvar::envvar_get_support_snapshot,
            commands::envvar::envvar_list_snapshots,
            commands::envvar::envvar_create_snapshot,
            commands::envvar::envvar_get_backup_protection,
            commands::envvar::envvar_preview_snapshot_restore,
            commands::envvar::envvar_restore_snapshot,
            commands::envvar::envvar_delete_snapshot,
            commands::envvar::envvar_list_all,
            commands::envvar::envvar_get_overview,
            commands::envvar::envvar_list_process_summaries,
            commands::envvar::envvar_get,
            commands::envvar::envvar_reveal_value,
            commands::envvar::envvar_set_process,
            commands::envvar::envvar_remove_process,
            commands::envvar::envvar_get_persistent,
            commands::envvar::envvar_set_persistent,
            commands::envvar::envvar_remove_persistent,
            commands::envvar::envvar_get_path,
            commands::envvar::envvar_add_path_entry,
            commands::envvar::envvar_remove_path_entry,
            commands::envvar::envvar_reorder_path,
            commands::envvar::envvar_list_shell_profiles,
            commands::envvar::envvar_read_shell_profile,
            commands::envvar::envvar_import_env_file,
            commands::envvar::envvar_preview_import_env_file,
            commands::envvar::envvar_apply_import_preview,
            commands::envvar::envvar_export_env_file,
            commands::envvar::envvar_list_persistent,
            commands::envvar::envvar_expand,
            commands::envvar::envvar_deduplicate_path,
            commands::envvar::envvar_preview_path_repair,
            commands::envvar::envvar_apply_path_repair,
            commands::envvar::envvar_list_persistent_typed,
            commands::envvar::envvar_list_persistent_typed_summaries,
            commands::envvar::envvar_detect_conflicts,
            commands::envvar::envvar_resolve_conflict,
            commands::envvar::envvar_generate_shell_guidance,
            // Updater commands
            commands::updater::self_check_update,
            commands::updater::self_update,
            // Log commands
            commands::log::log_list_files,
            commands::log::log_query,
            commands::log::log_clear,
            commands::log::log_get_dir,
            commands::log::log_export,
            commands::log::log_get_total_size,
            commands::log::log_cleanup,
            commands::log::log_cleanup_preview,
            commands::log::log_delete_file,
            commands::log::log_delete_batch,
            // Diagnostic commands
            commands::diagnostic::diagnostic_export_bundle,
            commands::diagnostic::diagnostic_get_default_export_path,
            commands::diagnostic::diagnostic_check_last_crash,
            commands::diagnostic::diagnostic_list_crash_reports,
            commands::diagnostic::diagnostic_dismiss_crash,
            commands::diagnostic::diagnostic_capture_frontend_crash,
            // Manifest commands
            commands::manifest::manifest_read,
            commands::manifest::manifest_init,
            // Download commands
            commands::download::download_add,
            commands::download::download_get,
            commands::download::download_list,
            commands::download::download_stats,
            commands::download::download_pause,
            commands::download::download_resume,
            commands::download::download_cancel,
            commands::download::download_remove,
            commands::download::download_pause_all,
            commands::download::download_resume_all,
            commands::download::download_cancel_all,
            commands::download::download_clear_finished,
            commands::download::download_retry_failed,
            commands::download::download_set_speed_limit,
            commands::download::download_get_speed_limit,
            commands::download::download_set_max_concurrent,
            commands::download::download_get_max_concurrent,
            commands::download::download_verify_file,
            commands::download::download_open_file,
            commands::download::download_reveal_file,
            commands::download::download_batch_pause,
            commands::download::download_batch_resume,
            commands::download::download_batch_cancel,
            commands::download::download_batch_remove,
            commands::download::download_shutdown,
            commands::download::download_set_priority,
            commands::download::download_set_task_speed_limit,
            commands::download::download_retry,
            commands::download::download_calculate_checksum,
            // Download history commands
            commands::download::download_history_list,
            commands::download::download_history_search,
            commands::download::download_history_stats,
            commands::download::download_history_clear,
            commands::download::download_history_remove,
            // Disk space commands
            commands::download::disk_space_get,
            commands::download::disk_space_check,
            commands::download::download_extract,
            // GitHub commands
            commands::github::github_parse_url,
            commands::github::github_validate_repo,
            commands::github::github_get_repo_info,
            commands::github::github_list_branches,
            commands::github::github_list_tags,
            commands::github::github_list_releases,
            commands::github::github_list_workflow_artifacts,
            commands::github::github_get_release_assets,
            commands::github::github_download_asset,
            commands::github::github_download_source,
            commands::github::github_download_workflow_artifact,
            commands::github::github_set_token,
            commands::github::github_get_token,
            commands::github::github_clear_token,
            commands::github::github_validate_token,
            // GitLab commands
            commands::gitlab::gitlab_parse_url,
            commands::gitlab::gitlab_validate_project,
            commands::gitlab::gitlab_get_project_info,
            commands::gitlab::gitlab_list_branches,
            commands::gitlab::gitlab_list_tags,
            commands::gitlab::gitlab_list_releases,
            commands::gitlab::gitlab_get_release_assets,
            commands::gitlab::gitlab_download_asset,
            commands::gitlab::gitlab_download_source,
            commands::gitlab::gitlab_set_token,
            commands::gitlab::gitlab_get_token,
            commands::gitlab::gitlab_clear_token,
            commands::gitlab::gitlab_validate_token,
            commands::gitlab::gitlab_search_projects,
            commands::gitlab::gitlab_list_pipelines,
            commands::gitlab::gitlab_list_pipeline_jobs,
            commands::gitlab::gitlab_download_job_artifacts,
            commands::gitlab::gitlab_list_packages,
            commands::gitlab::gitlab_list_package_files,
            commands::gitlab::gitlab_download_package_file,
            commands::gitlab::gitlab_set_instance_url,
            commands::gitlab::gitlab_get_instance_url,
            // Window effect commands
            commands::window_effect::window_effect_apply,
            commands::window_effect::window_effect_clear,
            commands::window_effect::window_effect_get_supported,
            // Tray commands
            tray::tray_set_icon_state,
            tray::tray_update_tooltip,
            tray::tray_set_active_downloads,
            tray::tray_set_wsl_state,
            tray::tray_set_terminal_profiles,
            tray::tray_set_has_update,
            tray::tray_set_has_error,
            tray::tray_set_language,
            tray::tray_set_click_behavior,
            tray::tray_set_quick_action,
            tray::tray_get_available_quick_actions,
            tray::tray_set_show_notifications,
            tray::tray_set_notification_level,
            tray::tray_set_notification_events,
            tray::tray_get_available_notification_events,
            tray::tray_get_state,
            tray::tray_is_autostart_enabled,
            tray::tray_enable_autostart,
            tray::tray_disable_autostart,
            tray::tray_send_notification,
            tray::tray_rebuild,
            tray::tray_set_minimize_to_tray,
            tray::tray_set_start_minimized,
            tray::tray_set_always_on_top,
            tray::tray_get_menu_config,
            tray::tray_set_menu_config,
            tray::tray_get_available_menu_items,
            tray::tray_reset_menu_config,
            // Feedback commands
            commands::feedback::feedback_save,
            commands::feedback::feedback_list,
            commands::feedback::feedback_get,
            commands::feedback::feedback_delete,
            commands::feedback::feedback_export,
            commands::feedback::feedback_count,
            // Custom detection commands
            commands::custom_detection::custom_rule_list,
            commands::custom_detection::custom_rule_get,
            commands::custom_detection::custom_rule_add,
            commands::custom_detection::custom_rule_update,
            commands::custom_detection::custom_rule_delete,
            commands::custom_detection::custom_rule_toggle,
            commands::custom_detection::custom_rule_presets,
            commands::custom_detection::custom_rule_import_presets,
            commands::custom_detection::custom_rule_detect,
            commands::custom_detection::custom_rule_detect_all,
            commands::custom_detection::custom_rule_test,
            commands::custom_detection::custom_rule_validate_regex,
            commands::custom_detection::custom_rule_export,
            commands::custom_detection::custom_rule_import,
            commands::custom_detection::custom_rule_list_by_env,
            commands::custom_detection::custom_rule_extraction_types,
            // WSL commands
            commands::wsl::wsl_list_distros,
            commands::wsl::wsl_list_online,
            commands::wsl::wsl_status,
            commands::wsl::wsl_terminate,
            commands::wsl::wsl_shutdown,
            commands::wsl::wsl_set_default,
            commands::wsl::wsl_set_version,
            commands::wsl::wsl_set_default_version,
            commands::wsl::wsl_export,
            commands::wsl::wsl_import,
            commands::wsl::wsl_update,
            commands::wsl::wsl_launch,
            commands::wsl::wsl_list_running,
            commands::wsl::wsl_is_available,
            commands::wsl::wsl_exec,
            commands::wsl::wsl_export_windows_env,
            commands::wsl::wsl_read_distro_env,
            commands::wsl::wsl_get_wslenv,
            commands::wsl::wsl_set_wslenv,
            commands::wsl::wsl_convert_path,
            commands::wsl::wsl_get_config,
            commands::wsl::wsl_set_config,
            commands::wsl::wsl_set_networking_mode,
            commands::wsl::wsl_disk_usage,
            commands::wsl::wsl_import_in_place,
            commands::wsl::wsl_mount,
            commands::wsl::wsl_unmount,
            commands::wsl::wsl_get_ip,
            commands::wsl::wsl_change_default_user,
            commands::wsl::wsl_get_distro_config,
            commands::wsl::wsl_set_distro_config,
            commands::wsl::wsl_get_version_info,
            commands::wsl::wsl_get_capabilities,
            commands::wsl::wsl_get_runtime_snapshot,
            commands::wsl::wsl_set_sparse,
            commands::wsl::wsl_move_distro,
            commands::wsl::wsl_resize_distro,
            commands::wsl::wsl_install_wsl_only,
            commands::wsl::wsl_install_with_location,
            commands::wsl::wsl_debug_detection,
            commands::wsl::wsl_detect_distro_env,
            // uv project management commands
            commands::uv::uv_init,
            commands::uv::uv_add,
            commands::uv::uv_remove,
            commands::uv::uv_sync,
            commands::uv::uv_lock,
            commands::uv::uv_run,
            commands::uv::uv_tree,
            commands::uv::uv_venv_create,
            commands::uv::uv_python_install,
            commands::uv::uv_python_uninstall,
            commands::uv::uv_python_list,
            commands::uv::uv_python_pin,
            commands::uv::uv_pip_compile,
            commands::uv::uv_self_update,
            commands::uv::uv_version,
            commands::uv::uv_cache_clean,
            commands::uv::uv_cache_dir,
            commands::uv::uv_tool_install,
            commands::uv::uv_tool_uninstall,
            commands::uv::uv_tool_list,
            commands::uv::uv_tool_run,
            // Conda environment management commands
            commands::conda::conda_env_list,
            commands::conda::conda_env_create,
            commands::conda::conda_env_remove,
            commands::conda::conda_env_clone,
            commands::conda::conda_env_export,
            commands::conda::conda_env_import,
            commands::conda::conda_env_rename,
            commands::conda::conda_info,
            commands::conda::conda_clean,
            commands::conda::conda_config_show,
            commands::conda::conda_config_set,
            commands::conda::conda_channel_add,
            commands::conda::conda_channel_remove,
            // Poetry project management commands
            commands::poetry::poetry_lock,
            commands::poetry::poetry_update,
            commands::poetry::poetry_run,
            commands::poetry::poetry_env_list,
            commands::poetry::poetry_env_remove,
            commands::poetry::poetry_env_use,
            commands::poetry::poetry_export,
            commands::poetry::poetry_check,
            commands::poetry::poetry_version,
            // pipx commands
            commands::pipx::pipx_inject,
            commands::pipx::pipx_run,
            commands::pipx::pipx_upgrade,
            commands::pipx::pipx_upgrade_all,
            commands::pipx::pipx_ensurepath,
            commands::pipx::pipx_reinstall_all,
            commands::pipx::pipx_list_json,
            // Xmake/Xrepo commands
            commands::xmake::xmake_list_repos,
            commands::xmake::xmake_add_repo,
            commands::xmake::xmake_remove_repo,
            commands::xmake::xmake_update_repos,
            commands::xmake::xmake_clean_cache,
            commands::xmake::xmake_env_show,
            commands::xmake::xmake_env_list,
            commands::xmake::xmake_env_bind,
            commands::xmake::xmake_export_package,
            commands::xmake::xmake_import_package,
            commands::xmake::xmake_download_source,
            // Homebrew commands
            commands::brew::brew_list_taps,
            commands::brew::brew_add_tap,
            commands::brew::brew_remove_tap,
            commands::brew::brew_list_services,
            commands::brew::brew_service_start,
            commands::brew::brew_service_stop,
            commands::brew::brew_service_restart,
            commands::brew::brew_cleanup,
            commands::brew::brew_doctor,
            commands::brew::brew_autoremove,
            commands::brew::brew_list_pinned,
            commands::brew::brew_pin,
            commands::brew::brew_unpin,
            commands::brew::brew_get_config,
            commands::brew::brew_analytics_status,
            commands::brew::brew_analytics_toggle,
            // MacPorts commands
            commands::macports::macports_list_variants,
            commands::macports::macports_port_contents,
            commands::macports::macports_port_dependents,
            commands::macports::macports_port_clean,
            commands::macports::macports_clean_all,
            commands::macports::macports_selfupdate,
            commands::macports::macports_list_select_groups,
            commands::macports::macports_select_options,
            commands::macports::macports_select_set,
            commands::macports::macports_reclaim,
            commands::wsl::wsl_get_distro_resources,
            commands::wsl::wsl_list_users,
            commands::wsl::wsl_update_distro_packages,
            commands::wsl::wsl_open_in_explorer,
            commands::wsl::wsl_open_in_terminal,
            commands::wsl::wsl_clone_distro,
            commands::wsl::wsl_total_disk_usage,
            commands::wsl::wsl_batch_launch,
            commands::wsl::wsl_batch_terminate,
            commands::wsl::wsl_list_port_forwards,
            commands::wsl::wsl_add_port_forward,
            commands::wsl::wsl_remove_port_forward,
            commands::wsl::wsl_distro_health_check,
            commands::wsl::wsl_backup_distro,
            commands::wsl::wsl_list_backups,
            commands::wsl::wsl_restore_backup,
            commands::wsl::wsl_delete_backup,
            // Git commands
            commands::git::git_is_available,
            commands::git::git_get_version,
            commands::git::git_get_executable_path,
            commands::git::git_get_support_snapshot,
            commands::git::git_install,
            commands::git::git_update,
            commands::git::git_get_config,
            commands::git::git_set_config,
            commands::git::git_remove_config,
            commands::git::git_get_config_value,
            commands::git::git_get_config_file_path,
            commands::git::git_list_aliases,
            commands::git::git_set_config_if_unset,
            commands::git::git_probe_editor_capability,
            commands::git::git_open_config_in_editor,
            commands::git::git_get_repo_info,
            commands::git::git_get_log,
            commands::git::git_get_branches,
            commands::git::git_get_remotes,
            commands::git::git_get_tags,
            commands::git::git_get_stashes,
            commands::git::git_get_contributors,
            commands::git::git_get_file_history,
            commands::git::git_get_blame,
            commands::git::git_get_commit_detail,
            commands::git::git_get_status,
            commands::git::git_get_graph_log,
            commands::git::git_get_ahead_behind,
            commands::git::git_checkout_branch,
            commands::git::git_create_branch,
            commands::git::git_delete_branch,
            commands::git::git_stash_apply,
            commands::git::git_stash_pop,
            commands::git::git_stash_drop,
            commands::git::git_stash_save,
            commands::git::git_create_tag,
            commands::git::git_delete_tag,
            commands::git::git_get_activity,
            commands::git::git_get_file_stats,
            commands::git::git_search_commits,
            // Git write operations
            commands::git::git_stage_files,
            commands::git::git_stage_all,
            commands::git::git_unstage_files,
            commands::git::git_discard_changes,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_fetch,
            commands::git::git_clone,
            commands::git::git_cancel_clone,
            commands::git::git_extract_repo_name,
            commands::git::git_validate_url,
            commands::git::git_init,
            commands::git::git_get_diff,
            commands::git::git_get_diff_between,
            commands::git::git_get_commit_diff,
            commands::git::git_merge,
            commands::git::git_revert,
            commands::git::git_cherry_pick,
            commands::git::git_reset,
            // Git remote & branch management
            commands::git::git_remote_add,
            commands::git::git_remote_remove,
            commands::git::git_remote_rename,
            commands::git::git_remote_set_url,
            commands::git::git_branch_rename,
            commands::git::git_branch_set_upstream,
            commands::git::git_push_tags,
            commands::git::git_delete_remote_branch,
            commands::git::git_stash_show,
            commands::git::git_get_reflog,
            commands::git::git_clean,
            commands::git::git_clean_dry_run,
            commands::git::git_stash_push_files,
            // Git submodule commands
            commands::git::git_list_submodules,
            commands::git::git_add_submodule,
            commands::git::git_update_submodules,
            commands::git::git_remove_submodule,
            commands::git::git_sync_submodules,
            // Git worktree commands
            commands::git::git_list_worktrees,
            commands::git::git_add_worktree,
            commands::git::git_remove_worktree,
            commands::git::git_prune_worktrees,
            // Git .gitignore commands
            commands::git::git_get_gitignore,
            commands::git::git_set_gitignore,
            commands::git::git_check_ignore,
            commands::git::git_add_to_gitignore,
            // Git hooks commands
            commands::git::git_list_hooks,
            commands::git::git_get_hook_content,
            commands::git::git_set_hook_content,
            commands::git::git_toggle_hook,
            // Git LFS commands
            commands::git::git_lfs_is_available,
            commands::git::git_lfs_get_version,
            commands::git::git_lfs_tracked_patterns,
            commands::git::git_lfs_ls_files,
            commands::git::git_lfs_track,
            commands::git::git_lfs_untrack,
            commands::git::git_lfs_install,
            // Git rebase & squash commands
            commands::git::git_rebase,
            commands::git::git_rebase_abort,
            commands::git::git_rebase_continue,
            commands::git::git_rebase_skip,
            commands::git::git_squash,
            // Git merge/rebase state & conflict resolution
            commands::git::git_get_merge_rebase_state,
            commands::git::git_get_conflicted_files,
            commands::git::git_resolve_file_ours,
            commands::git::git_resolve_file_theirs,
            commands::git::git_resolve_file_mark,
            commands::git::git_merge_abort,
            commands::git::git_merge_continue,
            // Git cherry-pick abort/continue & revert abort
            commands::git::git_cherry_pick_abort,
            commands::git::git_cherry_pick_continue,
            commands::git::git_revert_abort,
            // Git stash branch
            commands::git::git_stash_branch,
            // Git local config
            commands::git::git_get_local_config,
            commands::git::git_set_local_config,
            commands::git::git_remove_local_config,
            commands::git::git_get_local_config_value,
            // Git shallow clone management
            commands::git::git_is_shallow,
            commands::git::git_deepen,
            commands::git::git_unshallow,
            // Git repo statistics & health
            commands::git::git_get_repo_stats,
            commands::git::git_fsck,
            commands::git::git_describe,
            commands::git::git_remote_prune,
            // Git signature verification
            commands::git::git_verify_commit,
            commands::git::git_verify_tag,
            // Git interactive rebase
            commands::git::git_get_rebase_todo_preview,
            commands::git::git_start_interactive_rebase,
            // Git bisect
            commands::git::git_bisect_start,
            commands::git::git_bisect_good,
            commands::git::git_bisect_bad,
            commands::git::git_bisect_skip,
            commands::git::git_bisect_reset,
            commands::git::git_bisect_log,
            commands::git::git_get_bisect_state,
            // Git sparse-checkout
            commands::git::git_is_sparse_checkout,
            commands::git::git_sparse_checkout_init,
            commands::git::git_sparse_checkout_set,
            commands::git::git_sparse_checkout_add,
            commands::git::git_sparse_checkout_list,
            commands::git::git_sparse_checkout_disable,
            // Git archive
            commands::git::git_archive,
            // Git patch
            commands::git::git_format_patch,
            commands::git::git_apply_patch,
            commands::git::git_apply_mailbox,
            // Filesystem utility commands
            commands::fs_utils::validate_path,
            // Terminal management commands
            commands::terminal::terminal_detect_shells,
            commands::terminal::terminal_get_shell_info,
            commands::terminal::terminal_measure_startup,
            commands::terminal::terminal_check_shell_health,
            commands::terminal::terminal_list_profiles,
            commands::terminal::terminal_get_profile,
            commands::terminal::terminal_create_profile,
            commands::terminal::terminal_update_profile,
            commands::terminal::terminal_delete_profile,
            commands::terminal::terminal_get_default_profile,
            commands::terminal::terminal_set_default_profile,
            commands::terminal::terminal_launch_profile,
            commands::terminal::terminal_launch_profile_detailed,
            commands::terminal::terminal_get_proxy_env_vars,
            commands::terminal::terminal_read_config,
            commands::terminal::terminal_backup_config,
            commands::terminal::terminal_backup_config_verified,
            commands::terminal::terminal_append_to_config,
            commands::terminal::terminal_append_to_config_verified,
            commands::terminal::terminal_get_config_entries,
            commands::terminal::terminal_parse_config_content,
            commands::terminal::terminal_validate_config_content,
            commands::terminal::terminal_get_config_editor_metadata,
            commands::terminal::terminal_restore_config_snapshot,
            commands::terminal::terminal_ps_list_profiles,
            commands::terminal::terminal_ps_read_profile,
            commands::terminal::terminal_ps_write_profile,
            commands::terminal::terminal_ps_get_execution_policy,
            commands::terminal::terminal_ps_set_execution_policy,
            commands::terminal::terminal_ps_list_all_modules,
            commands::terminal::terminal_ps_get_module_detail,
            commands::terminal::terminal_ps_list_installed_scripts,
            commands::terminal::terminal_detect_framework,
            commands::terminal::terminal_list_plugins,
            commands::terminal::terminal_get_shell_env_vars,
            commands::terminal::terminal_reveal_shell_env_var,
            commands::terminal::terminal_duplicate_profile,
            commands::terminal::terminal_export_profiles,
            commands::terminal::terminal_import_profiles,
            commands::terminal::terminal_write_config,
            commands::terminal::terminal_write_config_verified,
            commands::terminal::terminal_ps_install_module,
            commands::terminal::terminal_ps_uninstall_module,
            commands::terminal::terminal_ps_update_module,
            commands::terminal::terminal_ps_find_module,
            commands::terminal::terminal_list_templates,
            commands::terminal::terminal_create_custom_template,
            commands::terminal::terminal_delete_custom_template,
            commands::terminal::terminal_save_profile_as_template,
            commands::terminal::terminal_create_profile_from_template,
            commands::terminal::terminal_get_framework_cache_stats,
            commands::terminal::terminal_get_single_framework_cache_info,
            commands::terminal::terminal_clean_framework_cache,
            // Plugin system commands
            commands::plugin::plugin_list,
            commands::plugin::plugin_get_info,
            commands::plugin::plugin_list_all_tools,
            commands::plugin::plugin_get_tools,
            commands::plugin::plugin_import_local,
            commands::plugin::plugin_install,
            commands::plugin::plugin_install_marketplace,
            commands::plugin::plugin_install_marketplace_with_result,
            commands::plugin::plugin_uninstall,
            commands::plugin::plugin_enable,
            commands::plugin::plugin_disable,
            commands::plugin::plugin_reload,
            commands::plugin::plugin_call_tool,
            commands::plugin::plugin_get_permissions,
            commands::plugin::plugin_get_permission_mode,
            commands::plugin::plugin_grant_permission,
            commands::plugin::plugin_revoke_permission,
            commands::plugin::plugin_get_data_dir,
            commands::plugin::plugin_get_locales,
            commands::plugin::plugin_scaffold,
            commands::plugin::plugin_open_scaffold_folder,
            commands::plugin::plugin_open_scaffold_in_vscode,
            commands::plugin::plugin_validate,
            commands::plugin::plugin_check_update,
            commands::plugin::plugin_update,
            commands::plugin::plugin_update_with_result,
            commands::plugin::plugin_get_ui_entry,
            commands::plugin::plugin_get_ui_asset,
            commands::plugin::plugin_get_health,
            commands::plugin::plugin_get_all_health,
            commands::plugin::plugin_get_capability_audit,
            commands::plugin::plugin_reset_health,
            commands::plugin::plugin_dispatch_event,
            commands::plugin::plugin_export_data,
            commands::plugin::plugin_get_settings_schema,
            commands::plugin::plugin_get_settings_values,
            commands::plugin::plugin_set_setting,
            commands::plugin::plugin_check_all_updates,
            commands::plugin::plugin_update_all,
            commands::plugin::toolbox_cancel_tool,
            // Built-in toolbox backend bridge commands
            commands::toolbox::toolbox_hash_file,
            commands::toolbox::toolbox_read_file_for_tool,
            commands::toolbox::toolbox_write_tool_output,
            commands::toolbox::toolbox_resolve_path,
            // Winget-specific commands
            commands::winget::winget_pin_list,
            commands::winget::winget_pin_add,
            commands::winget::winget_pin_remove,
            commands::winget::winget_pin_reset,
            commands::winget::winget_source_list,
            commands::winget::winget_source_add,
            commands::winget::winget_source_remove,
            commands::winget::winget_source_reset,
            commands::winget::winget_export,
            commands::winget::winget_import,
            commands::winget::winget_repair,
            commands::winget::winget_download,
            commands::winget::winget_get_info,
            commands::winget::winget_install_advanced,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED
                        | tauri_plugin_window_state::StateFlags::VISIBLE
                        | tauri_plugin_window_state::StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                if tray::handle_close_to_tray(app) {
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
pub fn run() {}

#[cfg_attr(test, allow(dead_code))]
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct InitProgressEvent {
    phase: &'static str,
    progress: u8,
    message: &'static str,
}

#[cfg_attr(test, allow(dead_code))]
fn emit_init_progress(
    app: &tauri::AppHandle,
    phase: &'static str,
    progress: u8,
    message: &'static str,
) {
    let _ = app.emit(
        "init-progress",
        InitProgressEvent {
            phase,
            progress,
            message,
        },
    );
}

#[cfg_attr(test, allow(dead_code))]
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CacheAutoCleanedEvent {
    action: String,
    scope: String,
    domains: Vec<String>,
    expired_metadata_removed: usize,
    expired_downloads_freed: u64,
    evicted_count: usize,
    stale_partials_removed: usize,
    total_freed_human: String,
}

/// Background task for automatic cache cleanup
#[cfg_attr(test, allow(dead_code))]
async fn cache_cleanup_task(settings: SharedSettings, app: tauri::AppHandle) {
    // Default fallback interval: 1 hour
    const DEFAULT_INTERVAL_SECS: u64 = 3600;
    // Minimum interval to prevent tight loops: 60 seconds
    const MIN_INTERVAL_SECS: u64 = 60;

    loop {
        // Read the interval from settings each cycle so changes take effect immediately
        let sleep_secs = {
            let s = settings.read().await;
            let configured = s.general.cache_monitor_interval;
            if configured >= MIN_INTERVAL_SECS {
                configured
            } else if configured == 0 {
                DEFAULT_INTERVAL_SECS
            } else {
                MIN_INTERVAL_SECS
            }
        };
        tokio::time::sleep(Duration::from_secs(sleep_secs)).await;

        let s = settings.read().await;
        let cache_dir = s.get_cache_dir();
        let auto_clean = s.general.auto_clean_cache;
        let max_size = s.general.cache_max_size;
        let max_age_days = s.general.cache_max_age_days;
        let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;
        let threshold = s.general.cache_auto_clean_threshold;
        drop(s);

        // Persist cache access stats every cycle (even when auto_clean is off)
        if let Ok(download_cache) = DownloadCache::open(&cache_dir).await {
            if let Err(e) = download_cache.persist_access_stats().await {
                debug!("Failed to persist cache access stats: {}", e);
            }

            // Record size snapshot for trend tracking
            if let Ok(stats) = download_cache.stats().await {
                let md_count = if let Ok(mc) =
                    MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl).await
                {
                    mc.stats().await.map(|s| s.entry_count).unwrap_or(0)
                } else {
                    0
                };
                if let Err(e) = download_cache
                    .record_size_snapshot(stats.total_size, stats.entry_count, md_count)
                    .await
                {
                    debug!("Failed to record size snapshot: {}", e);
                }
                // Prune old snapshots (keep 90 days)
                let _ = download_cache.prune_old_snapshots(90).await;
            }
        }

        // Log cleanup runs independently of cache auto_clean setting
        {
            let s = settings.read().await;
            if s.log.auto_cleanup {
                let max_ret = s.log.max_retention_days;
                let max_size = s.log.max_total_size_mb;
                drop(s);
                match commands::log::cleanup_logs_with_policy(&app, max_ret, max_size).await {
                    Ok(result) if result.deleted_count > 0 => {
                        debug!(
                            "Periodic log cleanup: deleted {} files, freed {} bytes",
                            result.deleted_count, result.freed_bytes
                        );
                    }
                    Err(e) => {
                        debug!("Periodic log cleanup error: {}", e);
                    }
                    _ => {}
                }
            } else {
                drop(s);
            }
        }

        if !auto_clean {
            continue;
        }

        // Track cleanup metrics for event emission
        let mut expired_metadata_removed: usize = 0;
        let mut expired_metadata_freed: u64 = 0;
        let mut expired_downloads_freed: u64 = 0;
        let mut evicted_count: usize = 0;
        let mut stale_partials_removed: usize = 0;
        let mut cleanup_record = CleanupRecordBuilder::new("auto_clean", false);

        // Clean expired metadata entries
        if let Ok(mut metadata_cache) =
            MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl).await
        {
            let expired_entries = metadata_cache.preview_expired().await.unwrap_or_default();
            let expired_size: u64 = expired_entries.iter().map(|e| e.size).sum();
            for entry in &expired_entries {
                cleanup_record.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "metadata",
                );
            }

            match metadata_cache.clean_expired().await {
                Ok(count) if count > 0 => {
                    debug!(
                        "Auto-cleanup: removed {} expired metadata entries ({} bytes)",
                        count, expired_size
                    );
                    expired_metadata_removed = count;
                    expired_metadata_freed = expired_size;
                }
                Err(e) => {
                    info!("Auto-cleanup metadata error: {}", e);
                }
                _ => {}
            }
        }

        // Clean download cache if over size limit
        if let Ok(mut download_cache) = DownloadCache::open(&cache_dir).await {
            let max_age = Duration::from_secs(max_age_days as u64 * 86400);
            let expired_download_entries = download_cache
                .preview_expired(max_age)
                .await
                .unwrap_or_default();
            for entry in &expired_download_entries {
                cleanup_record.add_file(
                    entry.file_path.display().to_string(),
                    entry.size,
                    "download",
                );
            }
            match download_cache.clean_expired(max_age).await {
                Ok(freed) if freed > 0 => {
                    debug!("Auto-cleanup: removed {} bytes of expired downloads", freed);
                    expired_downloads_freed = freed;
                }
                Err(e) => {
                    info!("Auto-cleanup download expiry error: {}", e);
                }
                _ => {}
            }
            match download_cache.stats().await {
                Ok(stats) => {
                    // Threshold-based cleanup: if usage exceeds threshold %, evict to threshold level
                    let threshold_size = if threshold > 0 && threshold < 100 {
                        (max_size as f64 * threshold as f64 / 100.0) as u64
                    } else {
                        max_size
                    };

                    let evict_target = if stats.total_size > max_size {
                        // Over hard limit, evict to max_size
                        max_size
                    } else if threshold > 0 && stats.total_size > threshold_size {
                        // Over threshold, evict to 90% of threshold to avoid frequent triggers
                        (threshold_size as f64 * 0.9) as u64
                    } else {
                        0 // No eviction needed
                    };

                    if evict_target > 0 {
                        match download_cache.evict_to_size(evict_target).await {
                            Ok(count) if count > 0 => {
                                debug!(
                                    "Auto-cleanup: evicted {} download entries (usage: {}, target: {})",
                                    count, stats.total_size, evict_target
                                );
                                evicted_count = count;
                                cleanup_record.add_file(
                                    format!("cache://download-eviction/{}", count),
                                    stats.total_size.saturating_sub(evict_target),
                                    "download",
                                );
                            }
                            Err(e) => {
                                info!("Auto-cleanup download error: {}", e);
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    info!("Auto-cleanup download stats error: {}", e);
                }
            }
        }

        if let Ok(mut resumer) = DownloadResumer::new(&cache_dir.join("downloads")).await {
            let max_age = Duration::from_secs(max_age_days as u64 * 86400);
            let stale_partials: Vec<_> = resumer.get_stale(max_age).into_iter().cloned().collect();
            for partial in &stale_partials {
                let size = if platform::fs::exists(&partial.file_path).await {
                    platform::fs::file_size(&partial.file_path)
                        .await
                        .unwrap_or(partial.downloaded_size)
                } else {
                    0
                };
                cleanup_record.add_file(partial.file_path.display().to_string(), size, "partial");
            }
            match resumer.clean_stale(max_age).await {
                Ok(count) if count > 0 => {
                    debug!("Auto-cleanup: removed {} stale partial downloads", count);
                    stale_partials_removed = count;
                }
                Err(e) => {
                    info!("Auto-cleanup partial download error: {}", e);
                }
                _ => {}
            }
        }

        // Emit event if any cleanup work was done
        if expired_metadata_removed > 0
            || expired_downloads_freed > 0
            || evicted_count > 0
            || stale_partials_removed > 0
        {
            let total_freed = expired_downloads_freed + expired_metadata_freed;
            let record = cleanup_record.build();
            if record.file_count > 0 {
                if let Ok(mut history) = CleanupHistory::open(&cache_dir).await {
                    let _ = history.add(record).await;
                }
            }
            if let Err(e) =
                commands::cache::record_cache_snapshot(&cache_dir, metadata_cache_ttl).await
            {
                debug!("Failed to record auto-clean cache snapshot: {}", e);
            }
            let _ = app.emit(
                "cache-auto-cleaned",
                CacheAutoCleanedEvent {
                    action: "auto_clean".to_string(),
                    scope: "all".to_string(),
                    domains: vec![
                        "cache_overview".to_string(),
                        "cache_entries".to_string(),
                        "about_cache_stats".to_string(),
                    ],
                    expired_metadata_removed,
                    expired_downloads_freed,
                    evicted_count,
                    stale_partials_removed,
                    total_freed_human: platform::disk::format_size(total_freed),
                },
            );
        }
    }
}

/// Background task for automatic backups based on backup settings.
#[cfg_attr(test, allow(dead_code))]
async fn auto_backup_task(
    settings: SharedSettings,
    terminal_manager: SharedTerminalProfileManager,
    profile_manager: core::profiles::SharedProfileManager,
    custom_detection_manager: SharedCustomDetectionManager,
) {
    // Wait 60 seconds after startup before first check
    tokio::time::sleep(Duration::from_secs(60)).await;

    loop {
        // Read settings each cycle so changes take effect
        let (enabled, interval_hours, max_backups, retention_days) = {
            let s = settings.read().await;
            (
                s.backup.auto_backup_enabled,
                s.backup.auto_backup_interval_hours,
                s.backup.max_backups,
                s.backup.retention_days,
            )
        };

        if !enabled || interval_hours == 0 {
            // Check again in 5 minutes if disabled
            tokio::time::sleep(Duration::from_secs(300)).await;
            continue;
        }

        let effective_interval_hours = if interval_hours > 720 {
            info!(
                "Auto-backup interval {}h exceeds supported limit; clamping to 720h",
                interval_hours
            );
            720
        } else {
            interval_hours
        };

        // Perform auto backup
        {
            let s = settings.read().await;
            let tm = terminal_manager.read().await;
            let pm = profile_manager.read().await;
            let cdm = custom_detection_manager.read().await;

            match core::backup::create_auto_backup(&s, "scheduled-auto-backup", &tm, &pm, &cdm)
                .await
            {
                Ok(result) => {
                    info!(
                        "Auto-backup created: {} ({}ms)",
                        result.path, result.duration_ms
                    );
                }
                Err(e) => {
                    info!("Auto-backup failed: {}", e);
                }
            }

            // Run cleanup after backup
            if max_backups > 0 || retention_days > 0 {
                match core::backup::cleanup_old_backups(&s, max_backups, retention_days).await {
                    Ok(deleted) if deleted > 0 => {
                        info!("Auto-backup cleanup: removed {} old backups", deleted);
                    }
                    Err(e) => {
                        info!("Auto-backup cleanup error: {}", e);
                    }
                    _ => {}
                }
            }
        }

        // Sleep for the configured interval
        let sleep_secs = (effective_interval_hours as u64).max(1) * 3600;
        tokio::time::sleep(Duration::from_secs(sleep_secs)).await;
    }
}
