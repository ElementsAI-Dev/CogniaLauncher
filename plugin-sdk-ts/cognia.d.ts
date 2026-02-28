/**
 * Cognia Plugin SDK — Host Function Declarations
 *
 * These declare the 37 host functions provided by CogniaLauncher to WASM plugins.
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

    // --- Clipboard ---
    cognia_clipboard_read(ptr: I64): I64;
    cognia_clipboard_write(ptr: I64): I64;

    // --- Notifications ---
    cognia_notification_send(ptr: I64): I64;

    // --- Process ---
    cognia_process_exec(ptr: I64): I64;

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
  }
}
