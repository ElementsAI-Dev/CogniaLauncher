pub mod batch;
pub mod cache;
pub mod config;
pub mod environment;
pub mod launch;
pub mod package;
pub mod search;
pub mod shim;

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
pub use environment::{
    env_detect, env_detect_all, env_get, env_install, env_list, env_uninstall, env_use_global,
    env_use_local,
};
pub use launch::{
    env_activate, env_get_info, exec_shell_with_env, launch_with_env, launch_with_streaming,
    which_program,
};
pub use package::{
    package_check_installed, package_info, package_install, package_list, package_search,
    package_uninstall, package_versions, provider_check, provider_list, provider_status_all,
    provider_system_list,
};
pub use search::{advanced_search, compare_packages, search_suggestions};
pub use shim::{
    path_check, path_get_add_command, path_remove, path_setup, path_status, shim_create,
    shim_list, shim_regenerate_all, shim_remove, shim_update,
};
