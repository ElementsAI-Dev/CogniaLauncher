use extism_pdk::*;

#[host_fn]
extern "ExtismHost" {
    // --- Config ---
    pub fn cognia_config_get(input: String) -> String;
    pub fn cognia_config_set(input: String) -> String;

    // --- Environment ---
    pub fn cognia_env_list(input: String) -> String;
    pub fn cognia_provider_list(input: String) -> String;
    pub fn cognia_env_detect(input: String) -> String;
    pub fn cognia_env_get_current(input: String) -> String;
    pub fn cognia_env_list_versions(input: String) -> String;
    pub fn cognia_env_install_version(input: String) -> String;
    pub fn cognia_env_set_version(input: String) -> String;

    // --- Packages ---
    pub fn cognia_pkg_search(input: String) -> String;
    pub fn cognia_pkg_info(input: String) -> String;
    pub fn cognia_pkg_versions(input: String) -> String;
    pub fn cognia_pkg_dependencies(input: String) -> String;
    pub fn cognia_pkg_list_installed(input: String) -> String;
    pub fn cognia_pkg_check_updates(input: String) -> String;
    pub fn cognia_pkg_install(input: String) -> String;
    pub fn cognia_pkg_uninstall(input: String) -> String;

    // --- Filesystem ---
    pub fn cognia_fs_read(input: String) -> String;
    pub fn cognia_fs_write(input: String) -> String;
    pub fn cognia_fs_list_dir(input: String) -> String;
    pub fn cognia_fs_exists(input: String) -> String;
    pub fn cognia_fs_delete(input: String) -> String;
    pub fn cognia_fs_mkdir(input: String) -> String;

    // --- HTTP ---
    pub fn cognia_http_get(input: String) -> String;
    pub fn cognia_http_post(input: String) -> String;
    pub fn cognia_http_request(input: String) -> String;

    // --- Clipboard ---
    pub fn cognia_clipboard_read(input: String) -> String;
    pub fn cognia_clipboard_write(input: String) -> String;

    // --- Notifications ---
    pub fn cognia_notification_send(input: String) -> String;

    // --- Process ---
    pub fn cognia_process_exec(input: String) -> String;
    pub fn cognia_process_exec_shell(input: String) -> String;
    pub fn cognia_process_which(input: String) -> String;
    pub fn cognia_process_is_available(input: String) -> String;

    // --- UI ---
    pub fn cognia_ui_get_context(input: String) -> String;
    pub fn cognia_ui_request(input: String) -> String;

    // --- i18n ---
    pub fn cognia_get_locale(input: String) -> String;
    pub fn cognia_i18n_translate(input: String) -> String;
    pub fn cognia_i18n_get_all(input: String) -> String;

    // --- Platform & Meta ---
    pub fn cognia_platform_info(input: String) -> String;
    pub fn cognia_cache_info(input: String) -> String;
    pub fn cognia_log(input: String) -> String;
    pub fn cognia_event_emit(input: String) -> String;
    pub fn cognia_get_plugin_id(input: String) -> String;

    // =========================================================================
    // Extended SDK v1.1 — New Host Functions
    // =========================================================================

    // --- Download ---
    pub fn cognia_download_list(input: String) -> String;
    pub fn cognia_download_get(input: String) -> String;
    pub fn cognia_download_stats(input: String) -> String;
    pub fn cognia_download_history_list(input: String) -> String;
    pub fn cognia_download_history_search(input: String) -> String;
    pub fn cognia_download_history_stats(input: String) -> String;
    pub fn cognia_download_add(input: String) -> String;
    pub fn cognia_download_pause(input: String) -> String;
    pub fn cognia_download_resume(input: String) -> String;
    pub fn cognia_download_cancel(input: String) -> String;
    pub fn cognia_download_verify(input: String) -> String;

    // --- Git ---
    pub fn cognia_git_is_available(input: String) -> String;
    pub fn cognia_git_get_version(input: String) -> String;
    pub fn cognia_git_get_repo_info(input: String) -> String;
    pub fn cognia_git_get_status(input: String) -> String;
    pub fn cognia_git_get_branches(input: String) -> String;
    pub fn cognia_git_get_current_branch(input: String) -> String;
    pub fn cognia_git_get_tags(input: String) -> String;
    pub fn cognia_git_get_log(input: String) -> String;
    pub fn cognia_git_get_commit_detail(input: String) -> String;
    pub fn cognia_git_get_blame(input: String) -> String;
    pub fn cognia_git_get_diff(input: String) -> String;
    pub fn cognia_git_get_diff_between(input: String) -> String;
    pub fn cognia_git_get_remotes(input: String) -> String;
    pub fn cognia_git_get_stashes(input: String) -> String;
    pub fn cognia_git_get_contributors(input: String) -> String;
    pub fn cognia_git_search_commits(input: String) -> String;
    pub fn cognia_git_get_file_history(input: String) -> String;
    pub fn cognia_git_get_ahead_behind(input: String) -> String;
    pub fn cognia_git_stage_files(input: String) -> String;
    pub fn cognia_git_commit(input: String) -> String;

    // --- Health Check ---
    pub fn cognia_health_check_all(input: String) -> String;
    pub fn cognia_health_check_environment(input: String) -> String;
    pub fn cognia_health_check_package_managers(input: String) -> String;
    pub fn cognia_health_check_package_manager(input: String) -> String;

    // --- Profiles ---
    pub fn cognia_profile_list(input: String) -> String;
    pub fn cognia_profile_get(input: String) -> String;
    pub fn cognia_profile_create_from_current(input: String) -> String;
    pub fn cognia_profile_create(input: String) -> String;
    pub fn cognia_profile_apply(input: String) -> String;
    pub fn cognia_profile_export(input: String) -> String;
    pub fn cognia_profile_import(input: String) -> String;

    // --- Cache (Extended) ---
    pub fn cognia_cache_detail_info(input: String) -> String;
    pub fn cognia_cache_list_entries(input: String) -> String;
    pub fn cognia_cache_get_access_stats(input: String) -> String;
    pub fn cognia_cache_get_cleanup_history(input: String) -> String;
    pub fn cognia_cache_discover_external(input: String) -> String;
    pub fn cognia_cache_get_external_paths(input: String) -> String;
    pub fn cognia_cache_clean_preview(input: String) -> String;
    pub fn cognia_cache_clean(input: String) -> String;

    // --- Shell ---
    pub fn cognia_shell_detect_shells(input: String) -> String;
    pub fn cognia_shell_list_profiles(input: String) -> String;
    pub fn cognia_shell_get_default_profile(input: String) -> String;
    pub fn cognia_shell_get_profile(input: String) -> String;
    pub fn cognia_shell_get_info(input: String) -> String;
    pub fn cognia_shell_get_env_vars(input: String) -> String;
    pub fn cognia_shell_check_health(input: String) -> String;
    pub fn cognia_shell_detect_framework(input: String) -> String;

    // --- WSL ---
    pub fn cognia_wsl_is_available(input: String) -> String;
    pub fn cognia_wsl_status(input: String) -> String;
    pub fn cognia_wsl_get_version_info(input: String) -> String;
    pub fn cognia_wsl_list_distros(input: String) -> String;
    pub fn cognia_wsl_list_running(input: String) -> String;
    pub fn cognia_wsl_list_online(input: String) -> String;
    pub fn cognia_wsl_get_ip(input: String) -> String;
    pub fn cognia_wsl_disk_usage(input: String) -> String;
    pub fn cognia_wsl_exec(input: String) -> String;

    // --- Batch ---
    pub fn cognia_batch_install(input: String) -> String;
    pub fn cognia_batch_uninstall(input: String) -> String;
    pub fn cognia_batch_update(input: String) -> String;
    pub fn cognia_batch_check_updates(input: String) -> String;
    pub fn cognia_batch_get_history(input: String) -> String;
    pub fn cognia_batch_get_pinned(input: String) -> String;

    // --- Launch ---
    pub fn cognia_launch_with_env(input: String) -> String;
    pub fn cognia_launch_get_env_info(input: String) -> String;
    pub fn cognia_launch_which_program(input: String) -> String;
    pub fn cognia_launch_activate(input: String) -> String;
}
