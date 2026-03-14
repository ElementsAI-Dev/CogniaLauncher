/**
 * Cognia Plugin SDK — Host Function Declarations
 *
 * These declare the host functions provided by CogniaLauncher to WASM plugins.
 * All functions use JSON string I/O via Extism Memory API (I64 offsets).
 */

declare module "extism:host" {
  interface user {
    // --- Configuration ---
    cognia_config_get(ptr: I64): I64;
    cognia_config_set(ptr: I64): I64;

    // --- Environment ---
    cognia_env_list(ptr: I64): I64;
    cognia_provider_list(ptr: I64): I64;
    cognia_env_detect(ptr: I64): I64;
    cognia_env_get_current(ptr: I64): I64;
    cognia_env_list_versions(ptr: I64): I64;
    cognia_env_install_version(ptr: I64): I64;
    cognia_env_set_version(ptr: I64): I64;

    // --- Package Management ---
    cognia_pkg_search(ptr: I64): I64;
    cognia_pkg_info(ptr: I64): I64;
    cognia_pkg_versions(ptr: I64): I64;
    cognia_pkg_dependencies(ptr: I64): I64;
    cognia_pkg_list_installed(ptr: I64): I64;
    cognia_pkg_check_updates(ptr: I64): I64;
    cognia_pkg_install(ptr: I64): I64;
    cognia_pkg_uninstall(ptr: I64): I64;

    // --- File System (sandboxed) ---
    cognia_fs_read(ptr: I64): I64;
    cognia_fs_write(ptr: I64): I64;
    cognia_fs_list_dir(ptr: I64): I64;
    cognia_fs_exists(ptr: I64): I64;
    cognia_fs_delete(ptr: I64): I64;
    cognia_fs_mkdir(ptr: I64): I64;

    // --- HTTP ---
    cognia_http_get(ptr: I64): I64;
    cognia_http_post(ptr: I64): I64;
    cognia_http_request(ptr: I64): I64;

    // --- Clipboard ---
    cognia_clipboard_read(ptr: I64): I64;
    cognia_clipboard_write(ptr: I64): I64;

    // --- Notifications ---
    cognia_notification_send(ptr: I64): I64;

    // --- Process ---
    cognia_process_exec(ptr: I64): I64;
    cognia_process_exec_shell(ptr: I64): I64;
    cognia_process_which(ptr: I64): I64;
    cognia_process_is_available(ptr: I64): I64;

    // --- UI Host Effects ---
    cognia_ui_get_context(ptr: I64): I64;
    cognia_ui_request(ptr: I64): I64;

    // --- i18n ---
    cognia_get_locale(ptr: I64): I64;
    cognia_i18n_translate(ptr: I64): I64;
    cognia_i18n_get_all(ptr: I64): I64;

    // --- Platform ---
    cognia_platform_info(ptr: I64): I64;
    cognia_cache_info(ptr: I64): I64;

    // --- Logging ---
    cognia_log(ptr: I64): I64;

    // --- Events ---
    cognia_event_emit(ptr: I64): I64;
    cognia_get_plugin_id(ptr: I64): I64;

    // --- Download ---
    cognia_download_list(ptr: I64): I64;
    cognia_download_get(ptr: I64): I64;
    cognia_download_stats(ptr: I64): I64;
    cognia_download_history_list(ptr: I64): I64;
    cognia_download_history_search(ptr: I64): I64;
    cognia_download_history_stats(ptr: I64): I64;
    cognia_download_add(ptr: I64): I64;
    cognia_download_pause(ptr: I64): I64;
    cognia_download_resume(ptr: I64): I64;
    cognia_download_cancel(ptr: I64): I64;
    cognia_download_verify(ptr: I64): I64;

    // --- Git ---
    cognia_git_is_available(ptr: I64): I64;
    cognia_git_get_version(ptr: I64): I64;
    cognia_git_get_repo_info(ptr: I64): I64;
    cognia_git_get_status(ptr: I64): I64;
    cognia_git_get_branches(ptr: I64): I64;
    cognia_git_get_current_branch(ptr: I64): I64;
    cognia_git_get_tags(ptr: I64): I64;
    cognia_git_get_log(ptr: I64): I64;
    cognia_git_get_commit_detail(ptr: I64): I64;
    cognia_git_get_blame(ptr: I64): I64;
    cognia_git_get_diff(ptr: I64): I64;
    cognia_git_get_diff_between(ptr: I64): I64;
    cognia_git_get_remotes(ptr: I64): I64;
    cognia_git_get_stashes(ptr: I64): I64;
    cognia_git_get_contributors(ptr: I64): I64;
    cognia_git_search_commits(ptr: I64): I64;
    cognia_git_get_file_history(ptr: I64): I64;
    cognia_git_get_ahead_behind(ptr: I64): I64;
    cognia_git_stage_files(ptr: I64): I64;
    cognia_git_commit(ptr: I64): I64;

    // --- Health Check ---
    cognia_health_check_all(ptr: I64): I64;
    cognia_health_check_environment(ptr: I64): I64;
    cognia_health_check_package_managers(ptr: I64): I64;
    cognia_health_check_package_manager(ptr: I64): I64;

    // --- Profiles ---
    cognia_profile_list(ptr: I64): I64;
    cognia_profile_get(ptr: I64): I64;
    cognia_profile_create_from_current(ptr: I64): I64;
    cognia_profile_create(ptr: I64): I64;
    cognia_profile_apply(ptr: I64): I64;
    cognia_profile_export(ptr: I64): I64;
    cognia_profile_import(ptr: I64): I64;

    // --- Cache (Extended) ---
    cognia_cache_detail_info(ptr: I64): I64;
    cognia_cache_list_entries(ptr: I64): I64;
    cognia_cache_get_access_stats(ptr: I64): I64;
    cognia_cache_get_cleanup_history(ptr: I64): I64;
    cognia_cache_discover_external(ptr: I64): I64;
    cognia_cache_get_external_paths(ptr: I64): I64;
    cognia_cache_clean_preview(ptr: I64): I64;
    cognia_cache_clean(ptr: I64): I64;

    // --- Shell ---
    cognia_shell_detect_shells(ptr: I64): I64;
    cognia_shell_list_profiles(ptr: I64): I64;
    cognia_shell_get_default_profile(ptr: I64): I64;
    cognia_shell_get_profile(ptr: I64): I64;
    cognia_shell_get_info(ptr: I64): I64;
    cognia_shell_get_env_vars(ptr: I64): I64;
    cognia_shell_check_health(ptr: I64): I64;
    cognia_shell_detect_framework(ptr: I64): I64;

    // --- WSL ---
    cognia_wsl_is_available(ptr: I64): I64;
    cognia_wsl_status(ptr: I64): I64;
    cognia_wsl_get_version_info(ptr: I64): I64;
    cognia_wsl_list_distros(ptr: I64): I64;
    cognia_wsl_list_running(ptr: I64): I64;
    cognia_wsl_list_online(ptr: I64): I64;
    cognia_wsl_get_ip(ptr: I64): I64;
    cognia_wsl_disk_usage(ptr: I64): I64;
    cognia_wsl_exec(ptr: I64): I64;

    // --- Batch ---
    cognia_batch_install(ptr: I64): I64;
    cognia_batch_uninstall(ptr: I64): I64;
    cognia_batch_update(ptr: I64): I64;
    cognia_batch_check_updates(ptr: I64): I64;
    cognia_batch_get_history(ptr: I64): I64;
    cognia_batch_get_pinned(ptr: I64): I64;

    // --- Launch ---
    cognia_launch_with_env(ptr: I64): I64;
    cognia_launch_get_env_info(ptr: I64): I64;
    cognia_launch_which_program(ptr: I64): I64;
    cognia_launch_activate(ptr: I64): I64;
  }
}
