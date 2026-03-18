pub fn resolve_auto_effect() -> String {
    #[cfg(target_os = "windows")]
    {
        "mica".to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "vibrancy".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "none".to_string()
    }
}

pub fn supported_window_effects() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            "auto".into(),
            "none".into(),
            "mica".into(),
            "mica-tabbed".into(),
            "acrylic".into(),
            "blur".into(),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        vec!["auto".into(), "none".into(), "vibrancy".into()]
    }
    #[cfg(target_os = "linux")]
    {
        vec!["auto".into(), "none".into()]
    }
}

pub fn resolve_requested_effect(effect: &str) -> Result<String, String> {
    let supported = supported_window_effects();

    if effect == "auto" {
        return Ok(resolve_auto_effect());
    }

    if effect == "none" {
        return Ok("none".to_string());
    }

    if supported.iter().any(|candidate| candidate == effect) {
        return Ok(effect.to_string());
    }

    Err(format!("Unsupported effect for current platform: {effect}"))
}
