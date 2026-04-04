use super::*;
use crate::tray::{
    TrayClickBehavior, TrayMenuItemId, TrayNotificationEvent, TrayNotificationLevel,
    TrayQuickAction,
};
use std::path::PathBuf;

// ===== Default values =====

#[test]
fn test_default_settings() {
    let s = Settings::default();
    assert_eq!(s.general.parallel_downloads, 4);
    assert_eq!(s.general.resolve_strategy, ResolveStrategy::Latest);
    assert_eq!(s.general.min_install_space_mb, 100);
    assert!(s.updates.check_on_start);
    assert!(!s.updates.auto_install);
    assert!(s.updates.notify);
    assert!(s.tray.minimize_to_tray);
    assert!(!s.tray.start_minimized);
    assert!(s.tray.show_notifications);
    assert_eq!(s.tray.click_behavior, TrayClickBehavior::ToggleWindow);
    assert!(s.tray.menu_items.contains(&TrayMenuItemId::Quit));
    assert!(s.mirrors.is_empty());
    assert!(s.providers.is_empty());
}

#[test]
fn test_default_general() {
    let g = GeneralSettings::default();
    assert_eq!(g.parallel_downloads, 4);
    assert_eq!(g.resolve_strategy, ResolveStrategy::Latest);
    assert!(g.auto_update_metadata);
    assert_eq!(g.metadata_cache_ttl, 3600);
    assert_eq!(g.cache_max_size, 5 * 1024 * 1024 * 1024);
    assert_eq!(g.cache_max_age_days, 30);
    assert!(g.auto_clean_cache);
    assert_eq!(g.min_install_space_mb, 100);
    assert_eq!(g.cache_auto_clean_threshold, 80);
    assert_eq!(g.cache_monitor_interval, 300);
    assert!(!g.cache_monitor_external);
    assert_eq!(g.download_speed_limit, 0);
}

#[test]
fn test_default_appearance() {
    let a = AppearanceSettings::default();
    assert_eq!(a.theme, "system");
    assert_eq!(a.accent_color, "blue");
    assert_eq!(a.chart_color_theme, "default");
    assert_eq!(a.interface_radius, 0.625);
    assert_eq!(a.interface_density, "comfortable");
    assert_eq!(a.language, "en");
    assert!(!a.reduced_motion);
}

#[test]
fn test_default_terminal() {
    let t = TerminalSettings::default();
    assert_eq!(t.default_shell, "auto");
    assert!(t.default_profile_id.is_none());
    assert!(t.shell_integration);
    assert_eq!(t.proxy_mode, "global");
    assert!(t.custom_proxy.is_none());
    assert!(t.no_proxy.is_none());
}

#[test]
fn test_default_network() {
    let n = NetworkSettings::default();
    assert_eq!(n.timeout, 30);
    assert_eq!(n.retries, 3);
    assert!(n.proxy.is_none());
    assert!(n.no_proxy.is_none());
}

#[test]
fn test_default_security() {
    let s = SecuritySettings::default();
    assert!(!s.allow_http);
    assert!(s.verify_certificates);
    assert!(!s.allow_self_signed);
}

#[test]
fn test_default_resolve_strategy() {
    assert_eq!(ResolveStrategy::default(), ResolveStrategy::Latest);
}

#[test]
fn test_default_provider_settings() {
    let ps = ProviderSettings::default();
    assert_eq!(ps.enabled, None);
    assert_eq!(ps.priority, None);
    assert!(ps.extra.is_empty());
}

#[test]
fn test_default_global_provider_settings() {
    let gps = GlobalProviderSettings::default();
    assert!(gps.pinned_packages.is_empty());
    assert!(gps.disabled_providers.is_empty());
}

#[test]
fn test_default_path_settings() {
    let ps = PathSettings::default();
    assert!(ps.root.is_none());
    assert!(ps.cache.is_none());
    assert!(ps.environments.is_none());
}

#[test]
fn test_default_mirror_config() {
    let mc = MirrorConfig::default();
    assert_eq!(mc.url, "");
    assert_eq!(mc.priority, 0);
    assert!(mc.enabled);
    assert!(mc.verify_ssl);
}

// ===== get_value / set_value: general section =====

#[test]
fn test_get_set_parallel_downloads() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("general.parallel_downloads"), Some("4".into()));
    s.set_value("general.parallel_downloads", "8").unwrap();
    assert_eq!(s.get_value("general.parallel_downloads"), Some("8".into()));
    assert_eq!(s.general.parallel_downloads, 8);
}

#[test]
fn test_get_set_resolve_strategy_all_variants() {
    let mut s = Settings::default();
    for (input, expected_enum, expected_str) in [
        ("latest", ResolveStrategy::Latest, "latest"),
        ("minimal", ResolveStrategy::Minimal, "minimal"),
        ("locked", ResolveStrategy::Locked, "locked"),
        (
            "prefer-locked",
            ResolveStrategy::PreferLocked,
            "prefer-locked",
        ),
    ] {
        s.set_value("general.resolve_strategy", input).unwrap();
        assert_eq!(s.general.resolve_strategy, expected_enum);
        assert_eq!(
            s.get_value("general.resolve_strategy"),
            Some(expected_str.to_string())
        );
    }
}

#[test]
fn test_get_set_auto_update_metadata() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("general.auto_update_metadata"),
        Some("true".into())
    );
    s.set_value("general.auto_update_metadata", "false")
        .unwrap();
    assert!(!s.general.auto_update_metadata);
    assert_eq!(
        s.get_value("general.auto_update_metadata"),
        Some("false".into())
    );
}

#[test]
fn test_get_set_metadata_cache_ttl() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("general.metadata_cache_ttl"),
        Some("3600".into())
    );
    s.set_value("general.metadata_cache_ttl", "7200").unwrap();
    assert_eq!(s.general.metadata_cache_ttl, 7200);
}

#[test]
fn test_get_set_cache_max_size() {
    let mut s = Settings::default();
    s.set_value("general.cache_max_size", "1073741824").unwrap();
    assert_eq!(s.general.cache_max_size, 1073741824);
    assert_eq!(
        s.get_value("general.cache_max_size"),
        Some("1073741824".into())
    );
}

#[test]
fn test_get_set_cache_max_age_days() {
    let mut s = Settings::default();
    s.set_value("general.cache_max_age_days", "60").unwrap();
    assert_eq!(s.general.cache_max_age_days, 60);
    assert_eq!(s.get_value("general.cache_max_age_days"), Some("60".into()));
}

#[test]
fn test_get_set_auto_clean_cache() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("general.auto_clean_cache"), Some("true".into()));
    s.set_value("general.auto_clean_cache", "false").unwrap();
    assert!(!s.general.auto_clean_cache);
}

#[test]
fn test_get_set_min_install_space_mb() {
    let mut s = Settings::default();
    s.set_value("general.min_install_space_mb", "250").unwrap();
    assert_eq!(
        s.get_value("general.min_install_space_mb"),
        Some("250".into())
    );
}

#[test]
fn test_get_set_cache_auto_clean_threshold() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("general.cache_auto_clean_threshold"),
        Some("80".into())
    );
    s.set_value("general.cache_auto_clean_threshold", "90")
        .unwrap();
    assert_eq!(s.general.cache_auto_clean_threshold, 90);
}

#[test]
fn test_get_set_cache_monitor_interval() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("general.cache_monitor_interval"),
        Some("300".into())
    );
    s.set_value("general.cache_monitor_interval", "600")
        .unwrap();
    assert_eq!(s.general.cache_monitor_interval, 600);
}

#[test]
fn test_get_set_cache_monitor_external() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("general.cache_monitor_external"),
        Some("false".into())
    );
    s.set_value("general.cache_monitor_external", "true")
        .unwrap();
    assert!(s.general.cache_monitor_external);
}

#[test]
fn test_get_set_download_speed_limit() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("general.download_speed_limit"),
        Some("0".into())
    );
    s.set_value("general.download_speed_limit", "1048576")
        .unwrap();
    assert_eq!(s.general.download_speed_limit, 1048576);
    assert!(s
        .set_value("general.download_speed_limit", "not_a_number")
        .is_err());
}

// ===== get_value / set_value: network section =====

#[test]
fn test_get_set_network_timeout() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("network.timeout"), Some("30".into()));
    s.set_value("network.timeout", "60").unwrap();
    assert_eq!(s.network.timeout, 60);
}

#[test]
fn test_get_set_network_retries() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("network.retries"), Some("3".into()));
    s.set_value("network.retries", "5").unwrap();
    assert_eq!(s.network.retries, 5);
}

#[test]
fn test_get_set_network_proxy() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("network.proxy"), None);
    s.set_value("network.proxy", "http://proxy:8080").unwrap();
    assert_eq!(
        s.get_value("network.proxy"),
        Some("http://proxy:8080".into())
    );
    s.set_value("network.proxy", "").unwrap();
    assert!(s.network.proxy.is_none());
}

#[test]
fn test_get_set_network_no_proxy() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("network.no_proxy"), Some(String::new()));
    s.set_value("network.no_proxy", "localhost,127.0.0.1")
        .unwrap();
    assert_eq!(
        s.get_value("network.no_proxy"),
        Some("localhost,127.0.0.1".into())
    );
    s.set_value("network.no_proxy", "").unwrap();
    assert!(s.network.no_proxy.is_none());
}

// ===== get_value / set_value: security section =====

#[test]
fn test_get_set_security_all_keys() {
    let mut s = Settings::default();

    assert_eq!(s.get_value("security.allow_http"), Some("false".into()));
    s.set_value("security.allow_http", "true").unwrap();
    assert!(s.security.allow_http);

    assert_eq!(
        s.get_value("security.verify_certificates"),
        Some("true".into())
    );
    s.set_value("security.verify_certificates", "false")
        .unwrap();
    assert!(!s.security.verify_certificates);

    assert_eq!(
        s.get_value("security.allow_self_signed"),
        Some("false".into())
    );
    s.set_value("security.allow_self_signed", "true").unwrap();
    assert!(s.security.allow_self_signed);
}

// ===== get_value / set_value: paths section =====

#[test]
fn test_get_set_paths_all_keys() {
    let mut s = Settings::default();

    // All default to empty string
    assert_eq!(s.get_value("paths.root"), Some(String::new()));
    assert_eq!(s.get_value("paths.cache"), Some(String::new()));
    assert_eq!(s.get_value("paths.environments"), Some(String::new()));

    s.set_value("paths.root", "/custom/root").unwrap();
    assert_eq!(s.paths.root, Some(PathBuf::from("/custom/root")));

    s.set_value("paths.cache", "/custom/cache").unwrap();
    assert_eq!(s.paths.cache, Some(PathBuf::from("/custom/cache")));

    s.set_value("paths.environments", "/custom/envs").unwrap();
    assert_eq!(s.paths.environments, Some(PathBuf::from("/custom/envs")));

    // Clear
    s.set_value("paths.root", "").unwrap();
    assert!(s.paths.root.is_none());
    s.set_value("paths.cache", "").unwrap();
    assert!(s.paths.cache.is_none());
    s.set_value("paths.environments", "").unwrap();
    assert!(s.paths.environments.is_none());
}

// ===== get_value / set_value: appearance section =====

#[test]
fn test_get_set_appearance_theme() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("appearance.theme"), Some("system".into()));
    for valid in ["light", "dark", "system"] {
        s.set_value("appearance.theme", valid).unwrap();
        assert_eq!(s.get_value("appearance.theme"), Some(valid.to_string()));
    }
}

#[test]
fn test_get_set_appearance_accent_color() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("appearance.accent_color"), Some("blue".into()));
    for valid in ["zinc", "blue", "green", "purple", "orange", "rose"] {
        s.set_value("appearance.accent_color", valid).unwrap();
        assert_eq!(s.appearance.accent_color, valid);
    }
}

#[test]
fn test_get_set_appearance_chart_color_theme() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("appearance.chart_color_theme"),
        Some("default".into())
    );
    for valid in [
        "default",
        "vibrant",
        "pastel",
        "ocean",
        "sunset",
        "monochrome",
    ] {
        s.set_value("appearance.chart_color_theme", valid).unwrap();
        assert_eq!(s.appearance.chart_color_theme, valid);
    }
}

#[test]
fn test_get_set_appearance_interface_radius() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("appearance.interface_radius"),
        Some("0.625".into())
    );
    for valid in ["0", "0.3", "0.5", "0.625", "0.75", "1"] {
        s.set_value("appearance.interface_radius", valid).unwrap();
    }
    assert_eq!(s.appearance.interface_radius, 1.0);
}

#[test]
fn test_get_set_appearance_interface_density() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("appearance.interface_density"),
        Some("comfortable".into())
    );
    for valid in ["compact", "comfortable", "spacious"] {
        s.set_value("appearance.interface_density", valid).unwrap();
        assert_eq!(s.appearance.interface_density, valid);
    }
}

#[test]
fn test_get_set_appearance_language() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("appearance.language"), Some("en".into()));
    s.set_value("appearance.language", "zh").unwrap();
    assert_eq!(s.appearance.language, "zh");
}

#[test]
fn test_get_set_appearance_reduced_motion() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("appearance.reduced_motion"),
        Some("false".into())
    );
    s.set_value("appearance.reduced_motion", "true").unwrap();
    assert!(s.appearance.reduced_motion);
}

#[test]
fn test_get_set_appearance_window_effect() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("appearance.window_effect"), Some("auto".into()));
    for valid in [
        "auto",
        "none",
        "mica",
        "mica-tabbed",
        "acrylic",
        "blur",
        "vibrancy",
    ] {
        s.set_value("appearance.window_effect", valid).unwrap();
        assert_eq!(s.appearance.window_effect, valid);
    }
    assert!(s.set_value("appearance.window_effect", "invalid").is_err());
}

// ===== get_value / set_value: terminal section =====

#[test]
fn test_get_set_terminal_default_shell() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("terminal.default_shell"), Some("auto".into()));
    s.set_value("terminal.default_shell", "bash").unwrap();
    assert_eq!(s.terminal.default_shell, "bash");
}

#[test]
fn test_get_set_terminal_default_profile_id() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("terminal.default_profile_id"),
        Some(String::new())
    );
    s.set_value("terminal.default_profile_id", "my-profile")
        .unwrap();
    assert_eq!(
        s.terminal.default_profile_id,
        Some("my-profile".to_string())
    );
    s.set_value("terminal.default_profile_id", "").unwrap();
    assert!(s.terminal.default_profile_id.is_none());
}

#[test]
fn test_get_set_terminal_shell_integration() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("terminal.shell_integration"),
        Some("true".into())
    );
    s.set_value("terminal.shell_integration", "false").unwrap();
    assert!(!s.terminal.shell_integration);
}

#[test]
fn test_get_set_terminal_proxy_mode() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("terminal.proxy_mode"), Some("global".into()));
    for valid in ["global", "none", "custom"] {
        s.set_value("terminal.proxy_mode", valid).unwrap();
        assert_eq!(s.terminal.proxy_mode, valid);
    }
}

#[test]
fn test_terminal_proxy_mode_is_canonicalized() {
    let mut s = Settings::default();
    s.set_value("terminal.proxy_mode", "  CUSTOM ").unwrap();
    assert_eq!(s.terminal.proxy_mode, "custom");
    assert_eq!(s.get_value("terminal.proxy_mode"), Some("custom".into()));
}

#[test]
fn test_get_set_terminal_custom_proxy() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("terminal.custom_proxy"), Some(String::new()));
    s.set_value("terminal.custom_proxy", "socks5://localhost:1080")
        .unwrap();
    assert_eq!(
        s.terminal.custom_proxy,
        Some("socks5://localhost:1080".into())
    );
    s.set_value("terminal.custom_proxy", "").unwrap();
    assert!(s.terminal.custom_proxy.is_none());
}

#[test]
fn test_terminal_custom_proxy_rejects_invalid_url_non_destructive() {
    let mut s = Settings::default();
    s.set_value("terminal.custom_proxy", "http://proxy.local:8080")
        .unwrap();
    let before = s.terminal.custom_proxy.clone();

    let err = s
        .set_value("terminal.custom_proxy", "ftp://proxy.local:2121")
        .unwrap_err()
        .to_string();

    assert!(err.contains("Invalid proxy URL scheme"));
    assert_eq!(s.terminal.custom_proxy, before);
}

#[test]
fn test_get_set_terminal_no_proxy() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("terminal.no_proxy"), Some(String::new()));
    s.set_value("terminal.no_proxy", "localhost").unwrap();
    assert_eq!(s.terminal.no_proxy, Some("localhost".into()));
    s.set_value("terminal.no_proxy", "").unwrap();
    assert!(s.terminal.no_proxy.is_none());
}

#[test]
fn test_terminal_no_proxy_is_canonicalized() {
    let mut s = Settings::default();
    s.set_value("terminal.no_proxy", " localhost ; 127.0.0.1, .corp.local ")
        .unwrap();
    assert_eq!(
        s.terminal.no_proxy,
        Some("localhost,127.0.0.1,.corp.local".into())
    );
}

// ===== get_value / set_value: providers section =====

#[test]
fn test_provider_token_is_not_exposed_via_generic_get_set() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("providers.github.token"), None);
    let err = s
        .set_value("providers.github.token", "ghp_abc123")
        .unwrap_err()
        .to_string();
    assert!(err.contains("secure secret storage"));
    assert_eq!(s.get_value("providers.github.token"), None);
}

#[test]
fn test_provider_legacy_token_helpers_round_trip_without_generic_access() {
    let mut s = Settings::default();

    s.set_provider_legacy_token("github", "ghp_abc123").unwrap();
    assert_eq!(
        s.get_provider_legacy_token("github"),
        Some("ghp_abc123".into())
    );
    assert_eq!(s.get_value("providers.github.token"), None);

    s.clear_provider_legacy_token("github");
    assert_eq!(s.get_provider_legacy_token("github"), None);
}

#[test]
fn test_provider_secret_saved_helpers_round_trip() {
    let mut s = Settings::default();
    assert!(!s.get_provider_secret_saved("github"));

    s.set_provider_secret_saved("github", true);
    assert!(s.get_provider_secret_saved("github"));

    s.set_provider_secret_saved("github", false);
    assert!(!s.get_provider_secret_saved("github"));
}

#[test]
fn test_get_set_provider_url() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("providers.gitlab.url"), None);
    s.set_value("providers.gitlab.url", "https://gitlab.example.com")
        .unwrap();
    assert_eq!(
        s.get_value("providers.gitlab.url"),
        Some("https://gitlab.example.com".into())
    );
    s.set_value("providers.gitlab.url", "").unwrap();
    assert_eq!(s.get_value("providers.gitlab.url"), None);
}

#[test]
fn test_get_set_provider_enabled_and_sync_legacy_disabled_list() {
    let mut s = Settings::default();

    assert_eq!(s.get_value("providers.npm.enabled"), None);

    s.set_value("providers.npm.enabled", "false").unwrap();
    assert_eq!(s.get_value("providers.npm.enabled"), Some("false".into()));
    assert!(s
        .provider_settings
        .disabled_providers
        .contains(&"npm".to_string()));

    s.set_value("providers.npm.enabled", "true").unwrap();
    assert_eq!(s.get_value("providers.npm.enabled"), Some("true".into()));
    assert!(!s
        .provider_settings
        .disabled_providers
        .contains(&"npm".to_string()));
}

#[test]
fn test_get_value_provider_enabled_uses_legacy_disabled_list_fallback() {
    let mut s = Settings::default();
    s.set_value("provider_settings.disabled_providers", "npm")
        .unwrap();

    assert_eq!(s.get_value("providers.npm.enabled"), Some("false".into()));

    s.set_value("providers.npm.enabled", "true").unwrap();
    assert_eq!(s.get_value("providers.npm.enabled"), Some("true".into()));
}

#[test]
fn test_get_set_provider_priority_and_clear_override() {
    let mut s = Settings::default();

    assert_eq!(s.get_value("providers.npm.priority"), None);

    s.set_value("providers.npm.priority", "120").unwrap();
    assert_eq!(s.get_value("providers.npm.priority"), Some("120".into()));

    s.set_value("providers.npm.priority", "").unwrap();
    assert_eq!(s.get_value("providers.npm.priority"), None);
}

// ===== get_value / set_value: disabled_providers =====

#[test]
fn test_set_disabled_providers_json_array() {
    let mut s = Settings::default();
    s.set_value(
        "provider_settings.disabled_providers",
        r#"["snap","flatpak"]"#,
    )
    .unwrap();
    assert_eq!(
        s.provider_settings.disabled_providers,
        vec!["snap", "flatpak"]
    );
    // get_value returns JSON
    let val = s.get_value("provider_settings.disabled_providers").unwrap();
    assert!(val.contains("snap"));
}

#[test]
fn test_set_disabled_providers_csv() {
    let mut s = Settings::default();
    s.set_value(
        "provider_settings.disabled_providers",
        "snap, flatpak, docker",
    )
    .unwrap();
    assert_eq!(
        s.provider_settings.disabled_providers,
        vec!["snap", "flatpak", "docker"]
    );
}

#[test]
fn test_set_disabled_providers_empty() {
    let mut s = Settings::default();
    s.set_value("provider_settings.disabled_providers", "snap")
        .unwrap();
    assert_eq!(s.provider_settings.disabled_providers.len(), 1);
    s.set_value("provider_settings.disabled_providers", "")
        .unwrap();
    assert!(s.provider_settings.disabled_providers.is_empty());
}

// ===== Validation errors =====

#[test]
fn test_set_invalid_theme() {
    let mut s = Settings::default();
    assert!(s.set_value("appearance.theme", "neon").is_err());
}

#[test]
fn test_set_invalid_accent_color() {
    let mut s = Settings::default();
    assert!(s.set_value("appearance.accent_color", "red").is_err());
}

#[test]
fn test_set_invalid_chart_color_theme() {
    let mut s = Settings::default();
    assert!(s
        .set_value("appearance.chart_color_theme", "rainbow")
        .is_err());
}

#[test]
fn test_set_invalid_interface_radius() {
    let mut s = Settings::default();
    assert!(s.set_value("appearance.interface_radius", "0.9").is_err());
    assert!(s
        .set_value("appearance.interface_radius", "not_float")
        .is_err());
}

#[test]
fn test_set_invalid_interface_density() {
    let mut s = Settings::default();
    assert!(s.set_value("appearance.interface_density", "tiny").is_err());
}

#[test]
fn test_set_invalid_language() {
    let mut s = Settings::default();
    assert!(s.set_value("appearance.language", "fr").is_err());
}

#[test]
fn test_set_invalid_resolve_strategy() {
    let mut s = Settings::default();
    assert!(s.set_value("general.resolve_strategy", "random").is_err());
}

#[test]
fn test_set_invalid_proxy_mode() {
    let mut s = Settings::default();
    assert!(s.set_value("terminal.proxy_mode", "auto").is_err());
}

#[test]
fn test_set_cache_threshold_over_100() {
    let mut s = Settings::default();
    assert!(s
        .set_value("general.cache_auto_clean_threshold", "101")
        .is_err());
    // Edge cases: 0 and 100 are valid
    s.set_value("general.cache_auto_clean_threshold", "0")
        .unwrap();
    assert_eq!(s.general.cache_auto_clean_threshold, 0);
    s.set_value("general.cache_auto_clean_threshold", "100")
        .unwrap();
    assert_eq!(s.general.cache_auto_clean_threshold, 100);
}

#[test]
fn test_set_invalid_boolean() {
    let mut s = Settings::default();
    assert!(s.set_value("general.auto_update_metadata", "yes").is_err());
    assert!(s.set_value("security.allow_http", "1").is_err());
    assert!(s.set_value("terminal.shell_integration", "on").is_err());
}

#[test]
fn test_get_set_update_check_concurrency() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("general.update_check_concurrency"),
        Some("8".into())
    );
    s.set_value("general.update_check_concurrency", "16")
        .unwrap();
    assert_eq!(
        s.get_value("general.update_check_concurrency"),
        Some("16".into())
    );
    assert_eq!(s.general.update_check_concurrency, 16);
}

#[test]
fn test_update_check_concurrency_boundary() {
    let mut s = Settings::default();
    // Min boundary
    s.set_value("general.update_check_concurrency", "1")
        .unwrap();
    assert_eq!(s.general.update_check_concurrency, 1);
    // Max boundary
    s.set_value("general.update_check_concurrency", "32")
        .unwrap();
    assert_eq!(s.general.update_check_concurrency, 32);
    // Below min
    assert!(s
        .set_value("general.update_check_concurrency", "0")
        .is_err());
    // Above max
    assert!(s
        .set_value("general.update_check_concurrency", "33")
        .is_err());
    // Invalid string
    assert!(s
        .set_value("general.update_check_concurrency", "abc")
        .is_err());
}

#[test]
fn test_default_update_check_concurrency() {
    let g = GeneralSettings::default();
    assert_eq!(g.update_check_concurrency, 8);
}

#[test]
fn test_set_invalid_number() {
    let mut s = Settings::default();
    assert!(s.set_value("general.parallel_downloads", "abc").is_err());
    assert!(s.set_value("network.timeout", "xyz").is_err());
    assert!(s.set_value("network.retries", "-1").is_err());
}

#[test]
fn test_set_unknown_key() {
    let mut s = Settings::default();
    assert!(s.set_value("nonexistent.key", "value").is_err());
    assert!(s.set_value("general.nonexistent", "value").is_err());
}

#[test]
fn test_get_unknown_key() {
    let s = Settings::default();
    assert_eq!(s.get_value("nonexistent.key"), None);
    assert_eq!(s.get_value("general.nonexistent"), None);
}

// ===== Path helpers =====

#[test]
fn test_get_root_dir_custom() {
    let mut s = Settings::default();
    s.paths.root = Some(PathBuf::from("/custom/root"));
    assert_eq!(s.get_root_dir(), PathBuf::from("/custom/root"));
}

#[test]
fn test_get_cache_dir_custom() {
    let mut s = Settings::default();
    s.paths.cache = Some(PathBuf::from("/custom/cache"));
    assert_eq!(s.get_cache_dir(), PathBuf::from("/custom/cache"));
}

#[test]
fn test_get_cache_dir_default_fallback() {
    let mut s = Settings::default();
    s.paths.root = Some(PathBuf::from("/my/root"));
    assert_eq!(s.get_cache_dir(), PathBuf::from("/my/root/cache"));
}

#[test]
fn test_get_environments_dir_custom() {
    let mut s = Settings::default();
    s.paths.environments = Some(PathBuf::from("/custom/envs"));
    assert_eq!(s.get_environments_dir(), PathBuf::from("/custom/envs"));
}

#[test]
fn test_get_environments_dir_default_fallback() {
    let mut s = Settings::default();
    s.paths.root = Some(PathBuf::from("/my/root"));
    assert_eq!(
        s.get_environments_dir(),
        PathBuf::from("/my/root/environments")
    );
}

#[test]
fn test_get_bin_dir() {
    let mut s = Settings::default();
    s.paths.root = Some(PathBuf::from("/my/root"));
    assert_eq!(s.get_bin_dir(), PathBuf::from("/my/root/bin"));
}

#[test]
fn test_get_state_dir() {
    let mut s = Settings::default();
    s.paths.root = Some(PathBuf::from("/my/root"));
    assert_eq!(s.get_state_dir(), PathBuf::from("/my/root/state"));
}

// ===== Mirror helpers =====

#[test]
fn test_mirror_config_builder() {
    let config = MirrorConfig::new("https://pypi.tuna.tsinghua.edu.cn/simple").with_priority(5);
    assert_eq!(config.url, "https://pypi.tuna.tsinghua.edu.cn/simple");
    assert_eq!(config.priority, 5);
    assert!(config.enabled);
    assert!(config.verify_ssl);

    let disabled = MirrorConfig::new("https://example.com").disabled();
    assert!(!disabled.enabled);
}

#[test]
fn test_mirror_config_builder_chain() {
    let mc = MirrorConfig::new("https://example.com")
        .with_priority(10)
        .disabled();
    assert_eq!(mc.url, "https://example.com");
    assert_eq!(mc.priority, 10);
    assert!(!mc.enabled);
}

#[test]
fn test_mirror_get_set() {
    let mut s = Settings::default();

    s.set_value("mirrors.npm", "https://registry.npmmirror.com")
        .unwrap();
    assert_eq!(
        s.get_value("mirrors.npm"),
        Some("https://registry.npmmirror.com".into())
    );

    s.set_value("mirrors.npm.enabled", "true").unwrap();
    assert_eq!(s.get_value("mirrors.npm.enabled"), Some("true".into()));

    s.set_value("mirrors.npm.priority", "10").unwrap();
    assert_eq!(s.get_value("mirrors.npm.priority"), Some("10".into()));

    assert_eq!(
        s.get_mirror_url("npm"),
        Some("https://registry.npmmirror.com".into())
    );

    s.set_value("mirrors.npm.enabled", "false").unwrap();
    assert_eq!(s.get_mirror_url("npm"), None);
}

#[test]
fn test_mirror_verify_ssl_get_set() {
    let mut s = Settings::default();
    s.set_value("mirrors.npm", "https://registry.npmmirror.com")
        .unwrap();
    assert_eq!(s.get_value("mirrors.npm.verify_ssl"), Some("true".into()));
    s.set_value("mirrors.npm.verify_ssl", "false").unwrap();
    assert!(!s.mirrors.get("npm").unwrap().verify_ssl);
    assert_eq!(s.get_value("mirrors.npm.verify_ssl"), Some("false".into()));
}

#[test]
fn test_get_mirror_url_empty_url() {
    let mut s = Settings::default();
    s.mirrors.insert("npm".into(), MirrorConfig::default());
    assert_eq!(s.get_mirror_url("npm"), None); // empty url
}

#[test]
fn test_get_mirror_url_not_configured() {
    let s = Settings::default();
    assert_eq!(s.get_mirror_url("npm"), None);
}

#[test]
fn test_get_enabled_mirrors() {
    let mut s = Settings::default();

    s.set_value("mirrors.npm", "https://registry.npmmirror.com")
        .unwrap();
    s.set_value("mirrors.npm.priority", "5").unwrap();

    s.set_value("mirrors.pypi", "https://pypi.tuna.tsinghua.edu.cn/simple")
        .unwrap();
    s.set_value("mirrors.pypi.priority", "10").unwrap();

    let enabled = s.get_enabled_mirrors();
    assert_eq!(enabled.len(), 2);
    // Higher priority first
    assert_eq!(enabled[0].0, "pypi");
    assert_eq!(enabled[1].0, "npm");
}

#[test]
fn test_get_enabled_mirrors_excludes_disabled() {
    let mut s = Settings::default();
    s.set_value("mirrors.npm", "https://npm.example.com")
        .unwrap();
    s.set_value("mirrors.npm.enabled", "false").unwrap();
    s.set_value("mirrors.pypi", "https://pypi.example.com")
        .unwrap();

    let enabled = s.get_enabled_mirrors();
    assert_eq!(enabled.len(), 1);
    assert_eq!(enabled[0].0, "pypi");
}

#[test]
fn test_get_enabled_mirrors_excludes_empty_url() {
    let mut s = Settings::default();
    s.mirrors.insert("npm".into(), MirrorConfig::default()); // empty url
    let enabled = s.get_enabled_mirrors();
    assert!(enabled.is_empty());
}

// ===== SSL helpers =====

#[test]
fn test_should_verify_ssl_with_mirror_config() {
    let mut s = Settings::default();
    s.set_value("mirrors.npm", "https://npm.example.com")
        .unwrap();
    s.set_value("mirrors.npm.verify_ssl", "false").unwrap();
    assert!(!s.should_verify_ssl("npm"));
}

#[test]
fn test_should_verify_ssl_without_mirror_config() {
    let s = Settings::default();
    // Falls back to security.verify_certificates (true by default)
    assert!(s.should_verify_ssl("npm"));
}

#[test]
fn test_should_verify_ssl_fallback_to_security() {
    let mut s = Settings::default();
    s.security.verify_certificates = false;
    assert!(!s.should_verify_ssl("unconfigured_provider"));
}

// ===== Serialize / Deserialize =====

#[test]
fn test_serialize_deserialize_roundtrip() {
    let settings = Settings::default();
    let toml_str = toml::to_string(&settings).unwrap();
    let parsed: Settings = toml::from_str(&toml_str).unwrap();

    assert_eq!(
        settings.general.parallel_downloads,
        parsed.general.parallel_downloads
    );
    assert_eq!(
        settings.general.resolve_strategy,
        parsed.general.resolve_strategy
    );
    assert_eq!(settings.appearance.theme, parsed.appearance.theme);
    assert_eq!(
        settings.terminal.default_shell,
        parsed.terminal.default_shell
    );
    assert_eq!(
        settings.security.verify_certificates,
        parsed.security.verify_certificates
    );
}

#[test]
fn test_serialize_deserialize_with_custom_values() {
    let mut s = Settings::default();
    s.set_value("general.parallel_downloads", "16").unwrap();
    s.set_value("general.resolve_strategy", "prefer-locked")
        .unwrap();
    s.set_value("appearance.theme", "dark").unwrap();
    s.set_value("network.proxy", "http://proxy:8080").unwrap();
    s.set_value("mirrors.npm", "https://npm.example.com")
        .unwrap();
    s.set_provider_legacy_token("github", "ghp_test").unwrap();

    let toml_str = toml::to_string(&s).unwrap();
    let parsed: Settings = toml::from_str(&toml_str).unwrap();

    assert_eq!(parsed.general.parallel_downloads, 16);
    assert_eq!(
        parsed.general.resolve_strategy,
        ResolveStrategy::PreferLocked
    );
    assert_eq!(parsed.appearance.theme, "dark");
    assert_eq!(parsed.network.proxy, Some("http://proxy:8080".into()));
    assert_eq!(
        parsed.get_provider_legacy_token("github"),
        Some("ghp_test".into())
    );
    assert_eq!(
        parsed.mirrors.get("npm").unwrap().url,
        "https://npm.example.com"
    );
}

// ===== ResolveStrategy serde =====

#[test]
fn test_resolve_strategy_serde_all_variants() {
    for (variant, expected_str) in [
        (ResolveStrategy::Latest, "\"latest\""),
        (ResolveStrategy::Minimal, "\"minimal\""),
        (ResolveStrategy::Locked, "\"locked\""),
        (ResolveStrategy::PreferLocked, "\"preferlocked\""),
    ] {
        let json = serde_json::to_string(&variant).unwrap();
        assert_eq!(json, expected_str);
        let parsed: ResolveStrategy = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, variant);
    }
}

// ===== Mirror invalid values =====

#[test]
fn test_set_mirror_invalid_enabled() {
    let mut s = Settings::default();
    s.set_value("mirrors.npm", "https://example.com").unwrap();
    assert!(s.set_value("mirrors.npm.enabled", "yes").is_err());
}

#[test]
fn test_set_mirror_invalid_priority() {
    let mut s = Settings::default();
    s.set_value("mirrors.npm", "https://example.com").unwrap();
    assert!(s.set_value("mirrors.npm.priority", "high").is_err());
}

#[test]
fn test_set_mirror_invalid_verify_ssl() {
    let mut s = Settings::default();
    s.set_value("mirrors.npm", "https://example.com").unwrap();
    assert!(s.set_value("mirrors.npm.verify_ssl", "yes").is_err());
}

// ===== LogSettings defaults and get/set =====

#[test]
fn test_default_log_settings() {
    let l = LogSettings::default();
    assert_eq!(l.max_retention_days, 30);
    assert_eq!(l.max_total_size_mb, 100);
    assert!(l.auto_cleanup);
}

#[test]
fn test_get_set_log_max_retention_days() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("log.max_retention_days"), Some("30".into()));
    s.set_value("log.max_retention_days", "60").unwrap();
    assert_eq!(s.log.max_retention_days, 60);
    assert_eq!(s.get_value("log.max_retention_days"), Some("60".into()));
}

#[test]
fn test_get_set_log_max_total_size_mb() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("log.max_total_size_mb"), Some("100".into()));
    s.set_value("log.max_total_size_mb", "200").unwrap();
    assert_eq!(s.log.max_total_size_mb, 200);
    assert_eq!(s.get_value("log.max_total_size_mb"), Some("200".into()));
}

#[test]
fn test_get_set_log_auto_cleanup() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("log.auto_cleanup"), Some("true".into()));
    s.set_value("log.auto_cleanup", "false").unwrap();
    assert!(!s.log.auto_cleanup);
    assert_eq!(s.get_value("log.auto_cleanup"), Some("false".into()));
}

#[test]
fn test_set_log_max_retention_days_zero_unlimited() {
    let mut s = Settings::default();
    s.set_value("log.max_retention_days", "0").unwrap();
    assert_eq!(s.log.max_retention_days, 0);
}

#[test]
fn test_set_log_max_total_size_mb_zero_unlimited() {
    let mut s = Settings::default();
    s.set_value("log.max_total_size_mb", "0").unwrap();
    assert_eq!(s.log.max_total_size_mb, 0);
}

#[test]
fn test_set_log_invalid_values() {
    let mut s = Settings::default();
    assert!(s.set_value("log.max_retention_days", "abc").is_err());
    assert!(s.set_value("log.max_total_size_mb", "xyz").is_err());
    assert!(s.set_value("log.auto_cleanup", "yes").is_err());
}

#[test]
fn test_log_settings_serialize_roundtrip() {
    let mut s = Settings::default();
    s.set_value("log.max_retention_days", "14").unwrap();
    s.set_value("log.max_total_size_mb", "50").unwrap();
    s.set_value("log.auto_cleanup", "false").unwrap();

    let toml_str = toml::to_string(&s).unwrap();
    let parsed: Settings = toml::from_str(&toml_str).unwrap();

    assert_eq!(parsed.log.max_retention_days, 14);
    assert_eq!(parsed.log.max_total_size_mb, 50);
    assert!(!parsed.log.auto_cleanup);
}

// ===== BackupSettings defaults and get/set =====

#[test]
fn test_default_backup_settings() {
    let b = BackupSettings::default();
    assert!(!b.auto_backup_enabled);
    assert_eq!(b.auto_backup_interval_hours, 24);
    assert_eq!(b.max_backups, 10);
    assert_eq!(b.retention_days, 30);
}

#[test]
fn test_get_set_backup_auto_backup_enabled() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("backup.auto_backup_enabled"),
        Some("false".into())
    );
    s.set_value("backup.auto_backup_enabled", "true").unwrap();
    assert!(s.backup.auto_backup_enabled);
    assert_eq!(
        s.get_value("backup.auto_backup_enabled"),
        Some("true".into())
    );
}

#[test]
fn test_get_set_backup_auto_backup_interval_hours() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("backup.auto_backup_interval_hours"),
        Some("24".into())
    );
    s.set_value("backup.auto_backup_interval_hours", "12")
        .unwrap();
    assert_eq!(s.backup.auto_backup_interval_hours, 12);
}

#[test]
fn test_get_set_backup_max_backups() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("backup.max_backups"), Some("10".into()));
    s.set_value("backup.max_backups", "5").unwrap();
    assert_eq!(s.backup.max_backups, 5);
}

#[test]
fn test_get_set_backup_retention_days() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("backup.retention_days"), Some("30".into()));
    s.set_value("backup.retention_days", "0").unwrap();
    assert_eq!(s.backup.retention_days, 0);
}

#[test]
fn test_set_backup_invalid_values() {
    let mut s = Settings::default();
    assert!(s.set_value("backup.auto_backup_enabled", "yes").is_err());
    assert!(s
        .set_value("backup.auto_backup_interval_hours", "abc")
        .is_err());
    assert!(s.set_value("backup.max_backups", "-1").is_err());
    assert!(s.set_value("backup.retention_days", "xyz").is_err());
}

#[test]
fn test_backup_settings_serialize_roundtrip() {
    let mut s = Settings::default();
    s.set_value("backup.auto_backup_enabled", "true").unwrap();
    s.set_value("backup.auto_backup_interval_hours", "6")
        .unwrap();
    s.set_value("backup.max_backups", "20").unwrap();
    s.set_value("backup.retention_days", "90").unwrap();

    let toml_str = toml::to_string(&s).unwrap();
    let parsed: Settings = toml::from_str(&toml_str).unwrap();

    assert!(parsed.backup.auto_backup_enabled);
    assert_eq!(parsed.backup.auto_backup_interval_hours, 6);
    assert_eq!(parsed.backup.max_backups, 20);
    assert_eq!(parsed.backup.retention_days, 90);
}

// ===== UpdateSettings defaults and get/set =====

#[test]
fn test_default_update_settings() {
    let u = UpdateSettings::default();
    assert!(u.check_on_start);
    assert!(!u.auto_install);
    assert!(u.notify);
    assert_eq!(u.source_mode, UpdateSourceMode::Official);
    assert!(u.custom_endpoints.is_empty());
    assert!(u.fallback_to_official);
}

#[test]
fn test_get_set_updates_values() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("updates.check_on_start"), Some("true".into()));
    assert_eq!(s.get_value("updates.auto_install"), Some("false".into()));
    assert_eq!(s.get_value("updates.notify"), Some("true".into()));
    assert_eq!(s.get_value("updates.source_mode"), Some("official".into()));
    assert_eq!(s.get_value("updates.custom_endpoints"), Some("[]".into()));
    assert_eq!(
        s.get_value("updates.fallback_to_official"),
        Some("true".into())
    );

    s.set_value("updates.check_on_start", "false").unwrap();
    s.set_value("updates.auto_install", "true").unwrap();
    s.set_value("updates.notify", "false").unwrap();
    s.set_value("updates.source_mode", "custom").unwrap();
    s.set_value(
        "updates.custom_endpoints",
        r#"["https://updates.example.com/{{target}}/{{current_version}}"]"#,
    )
    .unwrap();
    s.set_value("updates.fallback_to_official", "false")
        .unwrap();

    assert!(!s.updates.check_on_start);
    assert!(s.updates.auto_install);
    assert!(!s.updates.notify);
    assert_eq!(s.updates.source_mode, UpdateSourceMode::Custom);
    assert_eq!(
        s.updates.custom_endpoints,
        vec!["https://updates.example.com/{{target}}/{{current_version}}"]
    );
    assert!(!s.updates.fallback_to_official);
}

#[test]
fn test_parse_updates_custom_endpoints_rejects_invalid_values_non_destructive() {
    let mut s = Settings::default();
    let original = s.updates.custom_endpoints.clone();
    assert!(s
        .set_value(
            "updates.custom_endpoints",
            r#"["ftp://updates.example.com/latest.json"]"#
        )
        .is_err());
    assert_eq!(s.updates.custom_endpoints, original);
}

#[test]
fn test_parse_updates_custom_endpoints_accepts_csv_or_newline() {
    let mut s = Settings::default();
    s.set_value(
        "updates.custom_endpoints",
        "https://a.example.com/latest.json,\nhttps://b.example.com/latest.json",
    )
    .unwrap();
    assert_eq!(
        s.updates.custom_endpoints,
        vec![
            "https://a.example.com/latest.json",
            "https://b.example.com/latest.json"
        ]
    );
}

#[test]
fn test_old_update_settings_toml_uses_new_defaults() {
    let old_toml = r#"
[updates]
check_on_start = false
auto_install = true
notify = false
"#;
    let parsed: Settings = toml::from_str(old_toml).unwrap();
    assert!(!parsed.updates.check_on_start);
    assert!(parsed.updates.auto_install);
    assert!(!parsed.updates.notify);
    assert_eq!(parsed.updates.source_mode, UpdateSourceMode::Official);
    assert!(parsed.updates.custom_endpoints.is_empty());
    assert!(parsed.updates.fallback_to_official);
}

#[test]
fn test_load_from_toml_with_invalid_tray_expanded_values_keeps_other_settings() {
    let raw = r#"
[updates]
check_on_start = false

[tray]
click_behavior = "quick_action"
quick_action = "not_real"
menu_items = ["settings", "open_command_palette", "bogus", "quit"]
menu_priority_items = ["open_command_palette", "quit", "ghost"]
"#;

    let parsed = Settings::load_from_toml_with_tray_fallback(raw).unwrap();

    assert!(!parsed.updates.check_on_start);
    assert_eq!(parsed.tray.click_behavior, TrayClickBehavior::QuickAction);
    assert_eq!(parsed.tray.quick_action, TrayQuickAction::CheckUpdates);
    assert_eq!(
        parsed.tray.menu_items,
        vec![
            TrayMenuItemId::Settings,
            TrayMenuItemId::OpenCommandPalette,
            TrayMenuItemId::Quit,
        ]
    );
    assert_eq!(
        parsed.tray.menu_priority_items,
        vec![TrayMenuItemId::OpenCommandPalette]
    );
}

#[test]
fn test_load_from_toml_with_invalid_tray_field_type_drops_only_that_field() {
    let raw = r#"
[tray]
click_behavior = "invalid"
quick_action = "open_downloads"
menu_items = "not-an-array"
"#;

    let parsed = Settings::load_from_toml_with_tray_fallback(raw).unwrap();

    assert_eq!(parsed.tray.click_behavior, TrayClickBehavior::ToggleWindow);
    assert_eq!(parsed.tray.quick_action, TrayQuickAction::OpenDownloads);
    assert_eq!(parsed.tray.menu_items, TraySettings::default().menu_items);
}

// ===== TraySettings defaults and get/set =====

#[test]
fn test_default_tray_settings() {
    let t = TraySettings::default();
    assert!(t.minimize_to_tray);
    assert!(!t.start_minimized);
    assert!(t.show_notifications);
    assert_eq!(t.notification_level, TrayNotificationLevel::All);
    assert_eq!(t.click_behavior, TrayClickBehavior::ToggleWindow);
    assert_eq!(t.quick_action, TrayQuickAction::CheckUpdates);
    assert!(t
        .notification_events
        .contains(&TrayNotificationEvent::Updates));
    assert!(t.menu_items.contains(&TrayMenuItemId::ToggleNotifications));
    assert!(t.menu_items.contains(&TrayMenuItemId::Quit));
    assert!(t.menu_priority_items.is_empty());
}

#[test]
fn test_get_set_tray_values() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("tray.minimize_to_tray"), Some("true".into()));
    assert_eq!(s.get_value("tray.start_minimized"), Some("false".into()));
    assert_eq!(s.get_value("tray.show_notifications"), Some("true".into()));
    assert_eq!(s.get_value("tray.notification_level"), Some("all".into()));
    assert_eq!(
        s.get_value("tray.click_behavior"),
        Some("toggle_window".into())
    );
    assert_eq!(
        s.get_value("tray.quick_action"),
        Some("check_updates".into())
    );
    assert_eq!(
        s.get_value("tray.notification_events"),
        Some(r#"["updates","downloads","errors","system"]"#.into())
    );

    s.set_value("tray.minimize_to_tray", "false").unwrap();
    s.set_value("tray.start_minimized", "true").unwrap();
    s.set_value("tray.show_notifications", "false").unwrap();
    s.set_value("tray.notification_level", "important_only")
        .unwrap();
    s.set_value("tray.click_behavior", "check_updates").unwrap();
    s.set_value("tray.quick_action", "open_settings").unwrap();
    s.set_value("tray.notification_events", r#"["errors","updates"]"#)
        .unwrap();

    assert!(!s.tray.minimize_to_tray);
    assert!(s.tray.start_minimized);
    assert!(!s.tray.show_notifications);
    assert_eq!(
        s.tray.notification_level,
        TrayNotificationLevel::ImportantOnly
    );
    assert_eq!(s.tray.click_behavior, TrayClickBehavior::CheckUpdates);
    assert_eq!(s.tray.quick_action, TrayQuickAction::OpenSettings);
    assert_eq!(
        s.tray.notification_events,
        vec![
            TrayNotificationEvent::Errors,
            TrayNotificationEvent::Updates
        ]
    );
}

#[test]
fn test_set_tray_menu_items_json() {
    let mut s = Settings::default();
    s.set_value(
        "tray.menu_items",
        r#"["show_hide","downloads","toggle_notifications","settings","quit"]"#,
    )
    .unwrap();
    assert_eq!(
        s.tray.menu_items,
        vec![
            TrayMenuItemId::ShowHide,
            TrayMenuItemId::Downloads,
            TrayMenuItemId::ToggleNotifications,
            TrayMenuItemId::Settings,
            TrayMenuItemId::Quit,
        ]
    );
}

#[test]
fn test_set_tray_menu_items_keeps_quit() {
    let mut s = Settings::default();
    s.set_value("tray.menu_items", "show_hide,downloads")
        .unwrap();
    assert!(s.tray.menu_items.contains(&TrayMenuItemId::Quit));
}

#[test]
fn test_set_tray_menu_items_ignores_unknown_and_dedupes() {
    let mut s = Settings::default();
    s.set_value(
        "tray.menu_items",
        r#"["show_hide","unknown","show_hide","quit"]"#,
    )
    .unwrap();
    assert_eq!(
        s.tray.menu_items,
        vec![TrayMenuItemId::ShowHide, TrayMenuItemId::Quit]
    );
}

#[test]
fn test_set_tray_menu_priority_items_filters_and_dedupes() {
    let mut s = Settings::default();
    s.set_value(
        "tray.menu_priority_items",
        r#"["downloads","quit","downloads","unknown","settings"]"#,
    )
    .unwrap();
    assert_eq!(
        s.tray.menu_priority_items,
        vec![TrayMenuItemId::Downloads, TrayMenuItemId::Settings]
    );
}

#[test]
fn test_set_tray_expanded_action_values() {
    let mut s = Settings::default();

    s.set_value("tray.quick_action", "open_downloads").unwrap();
    s.set_value("tray.menu_items", r#"["show_hide","downloads","quit"]"#)
        .unwrap();
    s.set_value("tray.menu_priority_items", r#"["downloads","quit"]"#)
        .unwrap();

    assert_eq!(s.tray.quick_action, TrayQuickAction::OpenDownloads);
    assert_eq!(
        s.tray.menu_items,
        vec![
            TrayMenuItemId::ShowHide,
            TrayMenuItemId::Downloads,
            TrayMenuItemId::Quit,
        ]
    );
    assert_eq!(s.tray.menu_priority_items, vec![TrayMenuItemId::Downloads]);
}

#[test]
fn test_set_tray_notification_events_fallbacks_to_defaults_when_invalid() {
    let mut s = Settings::default();
    s.set_value("tray.notification_events", r#"["unknown"]"#)
        .unwrap();
    assert_eq!(
        s.tray.notification_events,
        TrayNotificationEvent::defaults()
    );
}

#[test]
fn test_set_invalid_updates_or_tray_values() {
    let mut s = Settings::default();
    assert!(s.set_value("updates.check_on_start", "yes").is_err());
    assert!(s.set_value("updates.source_mode", "edge").is_err());
    assert!(s
        .set_value(
            "updates.custom_endpoints",
            r#"["http://insecure.example.com"]"#
        )
        .is_err());
    assert!(s
        .set_value("updates.fallback_to_official", "sometimes")
        .is_err());
    assert!(s.set_value("tray.click_behavior", "invalid").is_err());
    assert!(s.set_value("tray.notification_level", "sometimes").is_err());
    assert!(s.set_value("tray.quick_action", "invalid").is_err());
    // unknown items are ignored and default mandatory items are restored
    assert!(s.set_value("tray.menu_items", r#"["unknown"]"#).is_ok());
    assert_eq!(s.tray.menu_items, vec![TrayMenuItemId::Quit]);
}

// ===== PluginSettings =====

#[test]
fn test_default_plugin_settings() {
    let p = PluginSettings::default();
    assert!(p.auto_load_on_startup);
    assert_eq!(p.max_execution_timeout_secs, 30);
    assert!(p.sandbox_fs);
    assert_eq!(p.permission_enforcement_mode, "compat");
}

#[test]
fn test_get_set_plugin_auto_load() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("plugin.auto_load_on_startup"),
        Some("true".into())
    );
    s.set_value("plugin.auto_load_on_startup", "false").unwrap();
    assert!(!s.plugin.auto_load_on_startup);
    assert_eq!(
        s.get_value("plugin.auto_load_on_startup"),
        Some("false".into())
    );
}

#[test]
fn test_get_set_plugin_timeout() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("plugin.max_execution_timeout_secs"),
        Some("30".into())
    );
    s.set_value("plugin.max_execution_timeout_secs", "60")
        .unwrap();
    assert_eq!(s.plugin.max_execution_timeout_secs, 60);
}

#[test]
fn test_get_set_plugin_sandbox() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("plugin.sandbox_fs"), Some("true".into()));
    s.set_value("plugin.sandbox_fs", "false").unwrap();
    assert!(!s.plugin.sandbox_fs);
}

#[test]
fn test_set_plugin_invalid_values() {
    let mut s = Settings::default();
    assert!(s.set_value("plugin.auto_load_on_startup", "yes").is_err());
    assert!(s
        .set_value("plugin.max_execution_timeout_secs", "abc")
        .is_err());
    assert!(s.set_value("plugin.sandbox_fs", "maybe").is_err());
    assert!(s
        .set_value("plugin.permission_enforcement_mode", "invalid")
        .is_err());
}

#[test]
fn test_get_set_plugin_permission_enforcement_mode() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("plugin.permission_enforcement_mode"),
        Some("compat".into())
    );
    s.set_value("plugin.permission_enforcement_mode", "strict")
        .unwrap();
    assert_eq!(s.plugin.permission_enforcement_mode, "strict");
}

#[test]
fn test_plugin_settings_serialize_roundtrip() {
    let mut s = Settings::default();
    s.set_value("plugin.auto_load_on_startup", "false").unwrap();
    s.set_value("plugin.max_execution_timeout_secs", "120")
        .unwrap();
    s.set_value("plugin.sandbox_fs", "false").unwrap();
    s.set_value("plugin.permission_enforcement_mode", "strict")
        .unwrap();

    let toml_str = toml::to_string(&s).unwrap();
    let parsed: Settings = toml::from_str(&toml_str).unwrap();

    assert!(!parsed.plugin.auto_load_on_startup);
    assert_eq!(parsed.plugin.max_execution_timeout_secs, 120);
    assert!(!parsed.plugin.sandbox_fs);
    assert_eq!(parsed.plugin.permission_enforcement_mode, "strict");
}

// ===== ShortcutSettings defaults and get/set =====

#[test]
fn test_default_shortcut_settings() {
    let sc = ShortcutSettings::default();
    assert!(sc.enabled);
    assert_eq!(sc.toggle_window, "CmdOrCtrl+Shift+Space");
    assert_eq!(sc.command_palette, "CmdOrCtrl+Shift+K");
    assert_eq!(sc.quick_search, "CmdOrCtrl+Shift+F");
}

#[test]
fn test_get_set_shortcuts_enabled() {
    let mut s = Settings::default();
    assert_eq!(s.get_value("shortcuts.enabled"), Some("true".into()));
    s.set_value("shortcuts.enabled", "false").unwrap();
    assert!(!s.shortcuts.enabled);
    assert_eq!(s.get_value("shortcuts.enabled"), Some("false".into()));
}

#[test]
fn test_set_shortcuts_enabled_invalid() {
    let mut s = Settings::default();
    assert!(s.set_value("shortcuts.enabled", "yes").is_err());
}

#[test]
fn test_get_set_shortcuts_toggle_window() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("shortcuts.toggle_window"),
        Some("CmdOrCtrl+Shift+Space".into())
    );
    s.set_value("shortcuts.toggle_window", "Alt+Space").unwrap();
    assert_eq!(s.shortcuts.toggle_window, "Alt+Space");
    assert_eq!(
        s.get_value("shortcuts.toggle_window"),
        Some("Alt+Space".into())
    );
}

#[test]
fn test_get_set_shortcuts_command_palette() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("shortcuts.command_palette"),
        Some("CmdOrCtrl+Shift+K".into())
    );
    s.set_value("shortcuts.command_palette", "CmdOrCtrl+Shift+P")
        .unwrap();
    assert_eq!(s.shortcuts.command_palette, "CmdOrCtrl+Shift+P");
}

#[test]
fn test_get_set_shortcuts_quick_search() {
    let mut s = Settings::default();
    assert_eq!(
        s.get_value("shortcuts.quick_search"),
        Some("CmdOrCtrl+Shift+F".into())
    );
    s.set_value("shortcuts.quick_search", "CmdOrCtrl+Alt+S")
        .unwrap();
    assert_eq!(s.shortcuts.quick_search, "CmdOrCtrl+Alt+S");
}

#[test]
fn test_shortcuts_serialize_roundtrip() {
    let mut s = Settings::default();
    s.set_value("shortcuts.enabled", "false").unwrap();
    s.set_value("shortcuts.toggle_window", "Alt+Space").unwrap();
    s.set_value("shortcuts.command_palette", "CmdOrCtrl+Shift+P")
        .unwrap();
    s.set_value("shortcuts.quick_search", "CmdOrCtrl+Alt+S")
        .unwrap();

    let toml_str = toml::to_string(&s).unwrap();
    let parsed: Settings = toml::from_str(&toml_str).unwrap();

    assert!(!parsed.shortcuts.enabled);
    assert_eq!(parsed.shortcuts.toggle_window, "Alt+Space");
    assert_eq!(parsed.shortcuts.command_palette, "CmdOrCtrl+Shift+P");
    assert_eq!(parsed.shortcuts.quick_search, "CmdOrCtrl+Alt+S");
}

#[test]
fn test_shortcuts_empty_string_allowed() {
    let mut s = Settings::default();
    s.set_value("shortcuts.toggle_window", "").unwrap();
    assert_eq!(s.shortcuts.toggle_window, "");
    assert_eq!(s.get_value("shortcuts.toggle_window"), Some("".into()));
}
