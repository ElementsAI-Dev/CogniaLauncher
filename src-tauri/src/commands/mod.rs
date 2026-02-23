pub mod batch;
pub mod cache;
pub mod config;
pub mod custom_detection;
pub mod download;
pub mod environment;
pub mod fs_utils;
pub mod github;
pub mod gitlab;
pub mod health_check;
pub mod launch;
pub mod log;
pub mod manifest;
pub mod package;
pub mod profiles;
pub mod search;
pub mod shim;
pub mod updater;
pub mod wsl;

pub use batch::{
    batch_install, batch_uninstall, batch_update, check_updates, clear_install_history,
    get_install_history, get_package_history, get_pinned_packages, package_pin, package_rollback,
    package_unpin, resolve_dependencies,
};
pub use cache::{
    cache_clean, cache_force_clean, cache_force_clean_external, cache_info, cache_migrate,
    cache_migration_validate, cache_repair, cache_size_monitor, cache_verify,
    clean_all_external_caches, clean_external_cache, discover_external_caches, get_cache_path_info,
    get_cache_settings, get_combined_cache_stats, get_enhanced_cache_settings,
    get_external_cache_paths, reset_cache_path, set_cache_path, set_cache_settings,
    set_enhanced_cache_settings,
};
pub use config::{
    app_check_init, config_export, config_get, config_import, config_list, config_reset,
    config_set, get_cognia_dir, get_platform_info,
};
pub use custom_detection::{
    create_shared_custom_detection_manager, custom_rule_add, custom_rule_delete,
    custom_rule_detect, custom_rule_detect_all, custom_rule_export, custom_rule_extraction_types,
    custom_rule_get, custom_rule_import, custom_rule_import_presets, custom_rule_list,
    custom_rule_list_by_env, custom_rule_presets, custom_rule_test, custom_rule_toggle,
    custom_rule_update, custom_rule_validate_regex, SharedCustomDetectionManager,
};
pub use download::{
    disk_space_check, disk_space_get, download_add, download_cancel, download_cancel_all,
    download_clear_finished, download_get, download_get_speed_limit, download_history_clear,
    download_history_list, download_history_remove, download_history_search,
    download_history_stats, download_list, download_pause, download_pause_all, download_remove,
    download_resume, download_resume_all, download_retry_failed, download_set_max_concurrent,
    download_set_speed_limit, download_stats, init_download_manager, SharedDownloadManager,
};
pub use environment::{
    env_available_versions, env_check_updates, env_check_updates_all, env_cleanup_versions,
    env_current_version, env_detect, env_detect_all, env_get, env_install, env_install_cancel,
    env_installed_versions, env_list, env_list_global_packages, env_list_providers,
    env_load_settings, env_migrate_packages, env_resolve_alias, env_save_settings, env_uninstall,
    env_use_global, env_use_local, env_verify_install, env_get_eol_info, env_get_version_eol,
    rustup_add_component, rustup_add_target, rustup_get_profile,
    rustup_list_components, rustup_list_targets, rustup_override_list, rustup_override_set,
    rustup_override_unset, rustup_remove_component, rustup_remove_target, rustup_run,
    rustup_self_update, rustup_set_profile, rustup_show, rustup_update_all, rustup_which,
    go_env_info, go_mod_tidy, go_mod_download, go_clean_cache, go_cache_info,
};
pub use github::{
    github_clear_token, github_download_asset, github_download_source, github_get_release_assets,
    github_get_repo_info, github_get_token, github_list_branches, github_list_releases,
    github_list_tags, github_parse_url, github_set_token, github_validate_repo,
    github_validate_token,
};
pub use gitlab::{
    gitlab_clear_token, gitlab_download_asset, gitlab_download_source, gitlab_get_instance_url,
    gitlab_get_project_info, gitlab_get_release_assets, gitlab_get_token, gitlab_list_branches,
    gitlab_list_releases, gitlab_list_tags, gitlab_parse_url, gitlab_set_instance_url,
    gitlab_set_token, gitlab_validate_project, gitlab_validate_token,
};
pub use health_check::{
    health_check_all, health_check_environment, health_check_package_manager,
    health_check_package_managers,
};
pub use launch::{
    env_activate, env_get_info, exec_shell_with_env, launch_with_env, launch_with_streaming,
    which_program,
};
pub use log::{log_clear, log_export, log_get_dir, log_list_files, log_query};
pub use manifest::{manifest_init, manifest_read};
pub use package::{
    package_check_installed, package_info, package_install, package_list, package_search,
    package_uninstall, package_versions, provider_check, provider_disable, provider_enable,
    provider_list, provider_status_all, provider_system_list,
};
pub use profiles::{
    profile_apply, profile_create, profile_create_from_current, profile_delete, profile_export,
    profile_get, profile_import, profile_list, profile_update,
};
pub use search::{advanced_search, compare_packages, search_suggestions};
pub use shim::{
    path_check, path_get_add_command, path_remove, path_setup, path_status, shim_create, shim_list,
    shim_regenerate_all, shim_remove, shim_update,
};
pub use updater::{self_check_update, self_update};
pub use wsl::{
    wsl_change_default_user, wsl_convert_path, wsl_disk_usage, wsl_exec, wsl_export,
    wsl_get_config, wsl_get_distro_config, wsl_get_ip, wsl_import, wsl_import_in_place,
    wsl_is_available, wsl_launch, wsl_list_distros, wsl_list_online, wsl_list_running, wsl_mount,
    wsl_set_config, wsl_set_default, wsl_set_default_version, wsl_set_distro_config,
    wsl_set_version, wsl_shutdown, wsl_status, wsl_terminate, wsl_unmount, wsl_update,
};
