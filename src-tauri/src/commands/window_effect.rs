use tauri::{AppHandle, Manager};

/// Apply a window effect to the given window.
/// Called from lib.rs setup and from Tauri commands at runtime.
pub(crate) fn apply_effect_to_window(
    window: &tauri::WebviewWindow,
    effect: &str,
    dark: Option<bool>,
) -> Result<(), String> {
    // Resolve "auto" to the best effect for the current platform
    let resolved = if effect == "auto" {
        resolve_auto_effect()
    } else {
        effect.to_string()
    };

    // Clear any previously applied effect first
    clear_all_effects(window);

    if resolved == "none" {
        return Ok(());
    }

    apply_platform_effect(window, &resolved, dark)
}

/// Resolve "auto" to the best native effect for the current OS.
fn resolve_auto_effect() -> String {
    #[cfg(target_os = "windows")]
    {
        // Prefer Mica on Windows 11, fall back to none on older versions
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

/// Clear all vibrancy/blur effects from the window.
fn clear_all_effects(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        let _ = window_vibrancy::clear_mica(window);
        let _ = window_vibrancy::clear_acrylic(window);
        let _ = window_vibrancy::clear_blur(window);
        let _ = window_vibrancy::clear_tabbed(window);
    }
    #[cfg(target_os = "macos")]
    {
        let _ = window_vibrancy::clear_vibrancy(window);
    }
    #[cfg(target_os = "linux")]
    {
        // No native effects on Linux
    }
}

/// Apply a specific effect using platform APIs.
fn apply_platform_effect(
    window: &tauri::WebviewWindow,
    effect: &str,
    dark: Option<bool>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        match effect {
            "mica" => window_vibrancy::apply_mica(window, dark)
                .map_err(|e| format!("Failed to apply mica: {e}"))?,
            "mica-tabbed" => window_vibrancy::apply_tabbed(window, dark)
                .map_err(|e| format!("Failed to apply mica tabbed: {e}"))?,
            "acrylic" => window_vibrancy::apply_acrylic(window, Some((0, 0, 0, 0)))
                .map_err(|e| format!("Failed to apply acrylic: {e}"))?,
            "blur" => window_vibrancy::apply_blur(window, Some((0, 0, 0, 0)))
                .map_err(|e| format!("Failed to apply blur: {e}"))?,
            _ => {
                return Err(format!("Unsupported effect on Windows: {effect}"));
            }
        }
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        match effect {
            "vibrancy" => {
                window_vibrancy::apply_vibrancy(
                    window,
                    window_vibrancy::NSVisualEffectMaterial::HudWindow,
                    None,
                    None,
                )
                .map_err(|e| format!("Failed to apply vibrancy: {e}"))?;
            }
            _ => {
                return Err(format!("Unsupported effect on macOS: {effect}"));
            }
        }
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        let _ = (window, effect, dark);
        Err("Native window effects are not supported on Linux".into())
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn window_effect_apply(
    app: AppHandle,
    effect: String,
    dark: Option<bool>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("No main window found")?;
    apply_effect_to_window(&window, &effect, dark)
}

#[tauri::command]
pub async fn window_effect_clear(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("No main window found")?;
    clear_all_effects(&window);
    Ok(())
}

#[tauri::command]
pub fn window_effect_get_supported() -> Vec<String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_auto_effect() {
        let effect = resolve_auto_effect();
        #[cfg(target_os = "windows")]
        assert_eq!(effect, "mica");
        #[cfg(target_os = "macos")]
        assert_eq!(effect, "vibrancy");
        #[cfg(target_os = "linux")]
        assert_eq!(effect, "none");
    }

    #[test]
    fn test_get_supported_contains_auto_and_none() {
        let supported = window_effect_get_supported();
        assert!(supported.contains(&"auto".to_string()));
        assert!(supported.contains(&"none".to_string()));
    }

    #[test]
    fn test_get_supported_platform_specific() {
        let supported = window_effect_get_supported();
        #[cfg(target_os = "windows")]
        {
            assert!(supported.contains(&"mica".to_string()));
            assert!(supported.contains(&"acrylic".to_string()));
            assert!(supported.contains(&"blur".to_string()));
        }
        #[cfg(target_os = "macos")]
        assert!(supported.contains(&"vibrancy".to_string()));
    }
}
