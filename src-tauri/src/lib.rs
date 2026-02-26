pub mod cache;
pub mod commands;
pub mod config;
pub mod core;
pub mod download;
pub mod error;
pub mod platform;
pub mod provider;
pub mod resolver;
pub mod tray;

use cache::{DownloadCache, DownloadResumer, MetadataCache};
use commands::custom_detection::SharedCustomDetectionManager;
use commands::download::init_download_manager;
use commands::terminal::SharedTerminalProfileManager;
use config::Settings;
use core::custom_detection::CustomDetectionManager;
use core::terminal::TerminalProfileManager;
use log::{debug, info};
use provider::ProviderRegistry;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tokio::sync::RwLock;
use tokio::time::Duration;
use tray::{SharedTrayState, TrayState};

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;
pub type SharedSettings = Arc<RwLock<Settings>>;
pub type CancellationTokens = Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>;

/// Flag to indicate if initialization is complete
pub static INITIALIZED: AtomicBool = AtomicBool::new(false);

/// Helper to check if the app is fully initialized
pub fn is_initialized() -> bool {
    INITIALIZED.load(Ordering::SeqCst)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install panic hook BEFORE anything else so crashes generate reports
    commands::diagnostic::install_panic_hook();

    let mut builder = tauri::Builder::default();

    // Single-instance must be the first plugin registered (Tauri docs requirement)
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .setup(|app| {
            // Setup logging with enhanced configuration
            // - Stdout: Console output for development
            // - Webview: Forward logs to frontend for log panel display
            // - LogDir: Persistent log files with rotation
            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Debug
            } else {
                log::LevelFilter::Info
            };

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .targets([
                        Target::new(TargetKind::Stdout),
                        Target::new(TargetKind::Webview),
                        Target::new(TargetKind::LogDir { file_name: None }),
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
                    .rotation_strategy(RotationStrategy::KeepSome(5))
                    .max_file_size(10_000_000) // 10MB per log file
                    .level(log_level)
                    .level_for("hyper", log::LevelFilter::Info)
                    .level_for("reqwest", log::LevelFilter::Info)
                    .level_for("tao", log::LevelFilter::Info)
                    .level_for("wry", log::LevelFilter::Info)
                    .build(),
            )?;

            // Initialize provider registry with defaults asynchronously
            let registry = app.state::<SharedRegistry>().inner().clone();
            let settings = app.state::<SharedSettings>().inner().clone();
            let custom_detection = app.state::<SharedCustomDetectionManager>().inner().clone();

            // Get config directory for custom detection rules
            let config_dir = app.path().app_config_dir().unwrap_or_default();

            // Get app handle before the async block (needed for download manager event forwarding)
            let app_handle_for_download = app.handle().clone();

            // Use block_on to ensure initialization completes before app starts accepting commands
            let download_manager = tauri::async_runtime::block_on(async move {
                // Load settings from disk
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

                // Initialize providers with settings (including mirror configuration)
                let settings_guard = settings.read().await;
                match ProviderRegistry::with_settings(&settings_guard).await {
                    Ok(initialized_registry) => {
                        drop(settings_guard); // Release read lock before acquiring write lock
                        let mut registry_guard = registry.write().await;
                        *registry_guard = initialized_registry;
                        info!("Provider registry initialized with settings");
                    }
                    Err(e) => {
                        drop(settings_guard);
                        info!("Provider registry initialization error: {}", e);
                    }
                }

                // Initialize custom detection manager
                let mut custom_detection_guard = custom_detection.write().await;
                *custom_detection_guard = CustomDetectionManager::new(&config_dir);
                if let Err(e) = custom_detection_guard.load().await {
                    info!("Custom detection rules load error (using defaults): {}", e);
                } else {
                    info!("Custom detection rules loaded");
                }
                drop(custom_detection_guard);

                // Initialize download manager
                let settings_guard = settings.read().await;
                let download_manager =
                    init_download_manager(app_handle_for_download, &settings_guard).await;
                drop(settings_guard);
                info!("Download manager initialized");

                // Initialize terminal profile manager
                let cognia_dir = settings.read().await.get_root_dir();
                let terminal_manager = match TerminalProfileManager::new(&cognia_dir).await {
                    Ok(mgr) => {
                        info!("Terminal profile manager initialized");
                        mgr
                    }
                    Err(e) => {
                        info!("Terminal profile manager init error (using empty): {}", e);
                        TerminalProfileManager::new(&std::path::PathBuf::from("."))
                            .await
                            .unwrap_or_else(|_| {
                                // This is a panic-safe fallback; we create a minimal manager
                                panic!("Cannot initialize terminal profile manager at all")
                            })
                    }
                };

                // Mark initialization as complete
                INITIALIZED.store(true, Ordering::SeqCst);
                info!("Application initialization complete");

                (download_manager, terminal_manager)
            });

            // Register download manager and terminal profile manager as Tauri managed state
            let (download_manager, terminal_manager) = download_manager;
            app.manage(download_manager);
            app.manage(Arc::new(RwLock::new(terminal_manager)) as SharedTerminalProfileManager);

            // Initialize system tray
            if let Err(e) = tray::setup_tray(app.handle()) {
                info!("Failed to setup system tray: {}", e);
            }

            // Hide window if start-minimized is enabled
            if tray::should_start_minimized(app.handle()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                    info!("Started minimized to tray");
                }
            }

            // Start background cache cleanup task
            let cleanup_settings = app.state::<SharedSettings>().inner().clone();
            tauri::async_runtime::spawn(async move {
                cache_cleanup_task(cleanup_settings).await;
            });

            Ok(())
        })
        .manage(Arc::new(core::eol::EolCache::new()) as commands::environment::SharedEolCache)
        .manage(Arc::new(RwLock::new(ProviderRegistry::new())) as SharedRegistry)
        .manage(Arc::new(RwLock::new(Settings::default())) as SharedSettings)
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
            commands::environment::env_detect_system,
            commands::environment::env_get_type_mapping,
            commands::environment::env_verify_install,
            commands::environment::env_installed_versions,
            commands::environment::env_current_version,
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
            commands::package::package_uninstall,
            commands::package::package_list,
            commands::package::provider_list,
            commands::package::provider_check,
            commands::package::provider_system_list,
            commands::package::provider_status_all,
            commands::package::package_check_installed,
            commands::package::package_versions,
            commands::package::provider_enable,
            commands::package::provider_disable,
            // Config commands
            commands::config::config_get,
            commands::config::config_set,
            commands::config::config_list,
            commands::config::config_reset,
            commands::config::config_export,
            commands::config::config_import,
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
            // Enhanced cache settings
            commands::cache::get_enhanced_cache_settings,
            commands::cache::set_enhanced_cache_settings,
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
            commands::envvar::envvar_list_all,
            commands::envvar::envvar_get,
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
            commands::envvar::envvar_export_env_file,
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
            // Diagnostic commands
            commands::diagnostic::diagnostic_export_bundle,
            commands::diagnostic::diagnostic_get_default_export_path,
            commands::diagnostic::diagnostic_check_last_crash,
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
            // Download history commands
            commands::download::download_history_list,
            commands::download::download_history_search,
            commands::download::download_history_stats,
            commands::download::download_history_clear,
            commands::download::download_history_remove,
            // Disk space commands
            commands::download::disk_space_get,
            commands::download::disk_space_check,
            // GitHub commands
            commands::github::github_parse_url,
            commands::github::github_validate_repo,
            commands::github::github_get_repo_info,
            commands::github::github_list_branches,
            commands::github::github_list_tags,
            commands::github::github_list_releases,
            commands::github::github_get_release_assets,
            commands::github::github_download_asset,
            commands::github::github_download_source,
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
            commands::gitlab::gitlab_set_instance_url,
            commands::gitlab::gitlab_get_instance_url,
            // Tray commands
            tray::tray_set_icon_state,
            tray::tray_update_tooltip,
            tray::tray_set_active_downloads,
            tray::tray_set_has_update,
            tray::tray_set_language,
            tray::tray_set_click_behavior,
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
            commands::wsl::wsl_convert_path,
            commands::wsl::wsl_get_config,
            commands::wsl::wsl_set_config,
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
            commands::wsl::wsl_set_sparse,
            commands::wsl::wsl_move_distro,
            commands::wsl::wsl_resize_distro,
            commands::wsl::wsl_install_wsl_only,
            commands::wsl::wsl_install_with_location,
            commands::wsl::wsl_debug_detection,
            commands::wsl::wsl_detect_distro_env,
            // Git commands
            commands::git::git_is_available,
            commands::git::git_get_version,
            commands::git::git_get_executable_path,
            commands::git::git_install,
            commands::git::git_update,
            commands::git::git_get_config,
            commands::git::git_set_config,
            commands::git::git_remove_config,
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
            // Filesystem utility commands
            commands::fs_utils::validate_path,
            // Terminal management commands
            commands::terminal::terminal_detect_shells,
            commands::terminal::terminal_get_shell_info,
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
            commands::terminal::terminal_append_to_config,
            commands::terminal::terminal_get_config_entries,
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

/// Background task for automatic cache cleanup
async fn cache_cleanup_task(settings: SharedSettings) {
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
        }

        if !auto_clean {
            continue;
        }

        // Clean expired metadata entries
        if let Ok(mut metadata_cache) =
            MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl).await
        {
            match metadata_cache.clean_expired().await {
                Ok(count) if count > 0 => {
                    debug!("Auto-cleanup: removed {} expired metadata entries", count);
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
            match download_cache.clean_expired(max_age).await {
                Ok(freed) if freed > 0 => {
                    debug!("Auto-cleanup: removed {} bytes of expired downloads", freed);
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
            match resumer.clean_stale(max_age).await {
                Ok(count) if count > 0 => {
                    debug!("Auto-cleanup: removed {} stale partial downloads", count);
                }
                Err(e) => {
                    info!("Auto-cleanup partial download error: {}", e);
                }
                _ => {}
            }
        }
    }
}
