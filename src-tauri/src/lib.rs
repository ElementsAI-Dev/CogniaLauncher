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
use config::Settings;
use core::custom_detection::CustomDetectionManager;
use log::info;
use provider::ProviderRegistry;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
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
    tauri::Builder::default()
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

            // Use block_on to ensure initialization completes before app starts accepting commands
            tauri::async_runtime::block_on(async move {
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

                // Mark initialization as complete
                INITIALIZED.store(true, Ordering::SeqCst);
                info!("Application initialization complete");
            });

            // Initialize system tray
            if let Err(e) = tray::setup_tray(app.handle()) {
                info!("Failed to setup system tray: {}", e);
            }

            // Start background cache cleanup task
            let cleanup_settings = app.state::<SharedSettings>().inner().clone();
            tauri::async_runtime::spawn(async move {
                cache_cleanup_task(cleanup_settings).await;
            });

            Ok(())
        })
        .manage(Arc::new(RwLock::new(ProviderRegistry::new())) as SharedRegistry)
        .manage(Arc::new(RwLock::new(Settings::default())) as SharedSettings)
        .manage(Arc::new(RwLock::new(HashMap::new())) as CancellationTokens)
        .manage(Arc::new(RwLock::new(TrayState::default())) as SharedTrayState)
        .manage(Arc::new(RwLock::new(CustomDetectionManager::new(std::path::Path::new("")))) as SharedCustomDetectionManager)
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
            commands::config::get_cognia_dir,
            commands::config::get_platform_info,
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
            // Updater commands
            commands::updater::self_check_update,
            commands::updater::self_update,
            // Log commands
            commands::log::log_list_files,
            commands::log::log_query,
            commands::log::log_clear,
            commands::log::log_get_dir,
            commands::log::log_export,
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
            commands::github::github_list_branches,
            commands::github::github_list_tags,
            commands::github::github_list_releases,
            commands::github::github_get_release_assets,
            commands::github::github_download_asset,
            commands::github::github_download_source,
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
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Background task for automatic cache cleanup
async fn cache_cleanup_task(settings: SharedSettings) {
    const CLEANUP_INTERVAL_HOURS: u64 = 1;
    let mut cleanup_interval = interval(Duration::from_secs(CLEANUP_INTERVAL_HOURS * 3600));

    loop {
        cleanup_interval.tick().await;

        let s = settings.read().await;
        if !s.general.auto_clean_cache {
            continue;
        }

        let cache_dir = s.get_cache_dir();
        let max_size = s.general.cache_max_size;
        let max_age_days = s.general.cache_max_age_days;
        let metadata_cache_ttl = s.general.metadata_cache_ttl as i64;
        drop(s);

        // Clean expired metadata entries
        if let Ok(mut metadata_cache) = MetadataCache::open_with_ttl(&cache_dir, metadata_cache_ttl).await {
            match metadata_cache.clean_expired().await {
                Ok(count) if count > 0 => {
                    info!("Auto-cleanup: removed {} expired metadata entries", count);
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
                    info!("Auto-cleanup: removed {} bytes of expired downloads", freed);
                }
                Err(e) => {
                    info!("Auto-cleanup download expiry error: {}", e);
                }
                _ => {}
            }
            match download_cache.stats().await {
                Ok(stats) => {
                    if stats.total_size > max_size {
                        match download_cache.evict_to_size(max_size).await {
                            Ok(count) if count > 0 => {
                                info!(
                                    "Auto-cleanup: evicted {} download entries to meet size limit",
                                    count
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
                    info!("Auto-cleanup: removed {} stale partial downloads", count);
                }
                Err(e) => {
                    info!("Auto-cleanup partial download error: {}", e);
                }
                _ => {}
            }
        }
    }
}
