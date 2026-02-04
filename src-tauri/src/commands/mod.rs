pub mod batch;
pub mod cache;
pub mod config;
pub mod custom_detection;
pub mod download;
pub mod environment;
pub mod health_check;
pub mod launch;
pub mod log;
pub mod manifest;
pub mod package;
pub mod profiles;
pub mod search;
pub mod shim;
pub mod updater;

pub use batch::{
    batch_install, batch_uninstall, batch_update, check_updates, clear_install_history,
    get_install_history, get_package_history, get_pinned_packages, package_pin, package_rollback,
    package_unpin, resolve_dependencies,
};
pub use cache::{
    cache_clean, cache_info, cache_repair, cache_verify, get_cache_settings, set_cache_settings,
};
pub use config::{
    config_get, config_list, config_reset, config_set, get_cognia_dir, get_platform_info,
};
pub use download::{
    disk_space_check, disk_space_get, download_add, download_cancel, download_cancel_all,
    download_clear_finished, download_get, download_get_speed_limit, download_history_clear,
    download_history_list, download_history_remove, download_history_search, download_history_stats,
    download_list, download_pause, download_pause_all, download_remove, download_resume,
    download_resume_all, download_retry_failed, download_set_max_concurrent,
    download_set_speed_limit, download_stats, init_download_manager, SharedDownloadManager,
};
pub use environment::{
    env_available_versions, env_detect, env_detect_all, env_get, env_install, env_install_cancel,
    env_list, env_list_providers, env_load_settings, env_resolve_alias, env_save_settings,
    env_uninstall, env_use_global, env_use_local,
};
pub use launch::{
    env_activate, env_get_info, exec_shell_with_env, launch_with_env, launch_with_streaming,
    which_program,
};
pub use package::{
    package_check_installed, package_info, package_install, package_list, package_search,
    package_uninstall, package_versions, provider_check, provider_disable, provider_enable,
    provider_list, provider_status_all, provider_system_list,
};
pub use search::{advanced_search, compare_packages, search_suggestions};
pub use shim::{
    path_check, path_get_add_command, path_remove, path_setup, path_status, shim_create,
    shim_list, shim_regenerate_all, shim_remove, shim_update,
};
pub use updater::{self_check_update, self_update};
pub use log::{log_clear, log_export, log_get_dir, log_list_files, log_query};
pub use manifest::{manifest_init, manifest_read};
pub use custom_detection::{
    create_shared_custom_detection_manager, custom_rule_add, custom_rule_delete,
    custom_rule_detect, custom_rule_detect_all, custom_rule_export, custom_rule_extraction_types,
    custom_rule_get, custom_rule_import, custom_rule_import_presets, custom_rule_list,
    custom_rule_list_by_env, custom_rule_presets, custom_rule_test, custom_rule_toggle,
    custom_rule_update, custom_rule_validate_regex, SharedCustomDetectionManager,
};
pub use health_check::{health_check_all, health_check_environment};
pub use profiles::{
    profile_apply, profile_create, profile_create_from_current, profile_delete, profile_export,
    profile_get, profile_import, profile_list, profile_update,
};
