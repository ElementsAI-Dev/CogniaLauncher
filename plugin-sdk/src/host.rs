use extism_pdk::*;

#[host_fn]
extern "ExtismHost" {
    pub fn cognia_config_get(input: String) -> String;
    pub fn cognia_config_set(input: String) -> String;
    pub fn cognia_env_list(input: String) -> String;
    pub fn cognia_provider_list(input: String) -> String;
    pub fn cognia_env_detect(input: String) -> String;
    pub fn cognia_env_get_current(input: String) -> String;
    pub fn cognia_env_list_versions(input: String) -> String;
    pub fn cognia_env_install_version(input: String) -> String;
    pub fn cognia_env_set_version(input: String) -> String;
    pub fn cognia_pkg_search(input: String) -> String;
    pub fn cognia_pkg_info(input: String) -> String;
    pub fn cognia_pkg_versions(input: String) -> String;
    pub fn cognia_pkg_dependencies(input: String) -> String;
    pub fn cognia_pkg_list_installed(input: String) -> String;
    pub fn cognia_pkg_check_updates(input: String) -> String;
    pub fn cognia_pkg_install(input: String) -> String;
    pub fn cognia_pkg_uninstall(input: String) -> String;
    pub fn cognia_fs_read(input: String) -> String;
    pub fn cognia_fs_write(input: String) -> String;
    pub fn cognia_fs_list_dir(input: String) -> String;
    pub fn cognia_fs_exists(input: String) -> String;
    pub fn cognia_fs_delete(input: String) -> String;
    pub fn cognia_fs_mkdir(input: String) -> String;
    pub fn cognia_http_get(input: String) -> String;
    pub fn cognia_http_post(input: String) -> String;
    pub fn cognia_clipboard_read(input: String) -> String;
    pub fn cognia_clipboard_write(input: String) -> String;
    pub fn cognia_notification_send(input: String) -> String;
    pub fn cognia_process_exec(input: String) -> String;
    pub fn cognia_get_locale(input: String) -> String;
    pub fn cognia_i18n_translate(input: String) -> String;
    pub fn cognia_i18n_get_all(input: String) -> String;
    pub fn cognia_platform_info(input: String) -> String;
    pub fn cognia_cache_info(input: String) -> String;
    pub fn cognia_log(input: String) -> String;
    pub fn cognia_event_emit(input: String) -> String;
    pub fn cognia_get_plugin_id(input: String) -> String;
}
