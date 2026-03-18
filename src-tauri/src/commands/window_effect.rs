use tauri::{AppHandle, Manager};

use crate::commands::window_effect_support::{
    resolve_requested_effect, supported_window_effects,
};

/// Apply a window effect to the given window.
/// Called from lib.rs setup and from Tauri commands at runtime.
pub(crate) fn apply_effect_to_window(
    window: &tauri::WebviewWindow,
    effect: &str,
    dark: Option<bool>,
) -> Result<String, String> {
    let resolved = resolve_requested_effect(effect)?;

    // Clear any previously applied effect first
    clear_all_effects(window);

    if resolved == "none" {
        return Ok(resolved);
    }

    apply_platform_effect(window, &resolved, dark)?;
    Ok(resolved)
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
) -> Result<String, String> {
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
    supported_window_effects()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::window_effect_support::resolve_auto_effect;

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

    #[test]
    fn test_resolve_requested_effect_auto_and_none() {
        assert_eq!(resolve_requested_effect("none").unwrap(), "none");

        let resolved = resolve_requested_effect("auto").unwrap();
        #[cfg(target_os = "windows")]
        assert_eq!(resolved, "mica");
        #[cfg(target_os = "macos")]
        assert_eq!(resolved, "vibrancy");
        #[cfg(target_os = "linux")]
        assert_eq!(resolved, "none");
    }

    #[test]
    fn test_resolve_requested_effect_rejects_platform_unsupported_values() {
        #[cfg(target_os = "windows")]
        assert!(resolve_requested_effect("vibrancy").is_err());

        #[cfg(target_os = "macos")]
        assert!(resolve_requested_effect("mica").is_err());

        #[cfg(target_os = "linux")]
        assert!(resolve_requested_effect("mica").is_err());
    }
}
