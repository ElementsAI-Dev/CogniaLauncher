pub mod cache;
pub mod commands;
pub mod config;
pub mod core;
pub mod error;
pub mod platform;
pub mod provider;
pub mod resolver;

use config::Settings;
use log::info;
use provider::ProviderRegistry;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tokio::sync::RwLock;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;
pub type SharedSettings = Arc<RwLock<Settings>>;

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
            // Setup logging
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            } else {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize provider registry with defaults asynchronously
            let registry = app.state::<SharedRegistry>().inner().clone();
            let settings = app.state::<SharedSettings>().inner().clone();

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

                // Initialize providers with defaults
                match ProviderRegistry::with_defaults().await {
                    Ok(initialized_registry) => {
                        let mut registry_guard = registry.write().await;
                        *registry_guard = initialized_registry;
                        info!("Provider registry initialized with defaults");
                    }
                    Err(e) => {
                        info!("Provider registry initialization error: {}", e);
                    }
                }

                // Mark initialization as complete
                INITIALIZED.store(true, Ordering::SeqCst);
                info!("Application initialization complete");
            });

            Ok(())
        })
        .manage(Arc::new(RwLock::new(ProviderRegistry::new())) as SharedRegistry)
        .manage(Arc::new(RwLock::new(Settings::default())) as SharedSettings)
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
            commands::cache::cache_verify,
            commands::cache::cache_repair,
            commands::cache::get_cache_settings,
            commands::cache::set_cache_settings,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
