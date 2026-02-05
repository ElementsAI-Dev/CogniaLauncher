//! System Tray Module
//!
//! Provides comprehensive system tray functionality including:
//! - Dynamic tray icon based on application state
//! - Multi-language menu support
//! - Quick actions (settings, updates, logs)
//! - Window state synchronization
//! - System notifications
//! - Autostart management

use log::info;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{
    image::Image,
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, State, Wry,
};
use tokio::sync::RwLock;

pub const TRAY_ICON_ID: &str = "cognia-tray";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Tray icon state representation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TrayIconState {
    #[default]
    Normal,
    Downloading,
    Update,
    Error,
}

/// Tray menu language
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TrayLanguage {
    #[default]
    En,
    Zh,
}

/// Tray left-click behavior
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum TrayClickBehavior {
    #[default]
    ToggleWindow,
    ShowMenu,
    DoNothing,
}

/// Tray state managed by the application
#[derive(Debug, Default)]
pub struct TrayState {
    pub icon_state: TrayIconState,
    pub language: TrayLanguage,
    pub active_downloads: AtomicUsize,
    pub has_update: bool,
    pub click_behavior: TrayClickBehavior,
}

pub type SharedTrayState = Arc<RwLock<TrayState>>;

/// Menu labels for different languages
struct MenuLabels {
    show_window: &'static str,
    hide_window: &'static str,
    open_settings: &'static str,
    check_updates: &'static str,
    open_logs: &'static str,
    autostart_enable: &'static str,
    autostart_disable: &'static str,
    quit: &'static str,
}

impl MenuLabels {
    fn for_language(lang: TrayLanguage) -> Self {
        match lang {
            TrayLanguage::En => Self {
                show_window: "Show Window",
                hide_window: "Hide Window",
                open_settings: "Open Settings",
                check_updates: "Check for Updates",
                open_logs: "Open Log Directory",
                autostart_enable: "Enable Autostart",
                autostart_disable: "Disable Autostart",
                quit: "Quit",
            },
            TrayLanguage::Zh => Self {
                show_window: "显示窗口",
                hide_window: "隐藏窗口",
                open_settings: "打开设置",
                check_updates: "检查更新",
                open_logs: "打开日志目录",
                autostart_enable: "启用开机启动",
                autostart_disable: "禁用开机启动",
                quit: "退出",
            },
        }
    }
}

/// Get tooltip text based on state
fn get_tooltip(state: &TrayState) -> String {
    let active_downloads = state.active_downloads.load(Ordering::SeqCst);
    let base = format!("CogniaLauncher v{}", APP_VERSION);

    match state.language {
        TrayLanguage::En => {
            if state.has_update {
                format!("{} | Update available", base)
            } else if active_downloads > 0 {
                format!("{} | {} active download(s)", base, active_downloads)
            } else {
                base
            }
        }
        TrayLanguage::Zh => {
            if state.has_update {
                format!("{} | 有可用更新", base)
            } else if active_downloads > 0 {
                format!("{} | {} 个活动下载", base, active_downloads)
            } else {
                base
            }
        }
    }
}

/// Get the appropriate icon bytes based on state
fn get_icon_for_state(state: TrayIconState) -> &'static [u8] {
    match state {
        TrayIconState::Normal => include_bytes!("../icons/32x32.png"),
        TrayIconState::Downloading => include_bytes!("../icons/32x32.png"), // TODO: Add downloading icon
        TrayIconState::Update => include_bytes!("../icons/32x32.png"),      // TODO: Add update icon
        TrayIconState::Error => include_bytes!("../icons/32x32.png"),       // TODO: Add error icon
    }
}

/// Check if autostart is enabled
fn is_autostart_enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch().is_enabled().unwrap_or(false)
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        false
    }
}

/// Build the tray menu
fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    is_visible: bool,
    lang: TrayLanguage,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let labels = MenuLabels::for_language(lang);
    let autostart_enabled = is_autostart_enabled(app);

    let show_item = MenuItem::with_id(app, "show", labels.show_window, !is_visible, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", labels.hide_window, is_visible, None::<&str>)?;

    let sep1 = PredefinedMenuItem::separator(app)?;

    let settings_item =
        MenuItem::with_id(app, "settings", labels.open_settings, true, None::<&str>)?;
    let updates_item =
        MenuItem::with_id(app, "check_updates", labels.check_updates, true, None::<&str>)?;
    let logs_item = MenuItem::with_id(app, "open_logs", labels.open_logs, true, None::<&str>)?;

    let sep2 = PredefinedMenuItem::separator(app)?;

    let autostart_label = if autostart_enabled {
        labels.autostart_disable
    } else {
        labels.autostart_enable
    };
    let autostart_item =
        MenuItem::with_id(app, "toggle_autostart", autostart_label, true, None::<&str>)?;

    let sep3 = PredefinedMenuItem::separator(app)?;

    let quit_item = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &show_item,
            &hide_item,
            &sep1,
            &settings_item,
            &updates_item,
            &logs_item,
            &sep2,
            &autostart_item,
            &sep3,
            &quit_item,
        ],
    )
    .map_err(|e| e.into())
}

/// Handle menu events
fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id.as_ref();
    match id {
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                update_menu_state(app);
            }
        }
        "hide" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
                update_menu_state(app);
            }
        }
        "settings" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app.emit("navigate", "/settings");
            }
        }
        "check_updates" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app.emit("check-updates", ());
            }
        }
        "open_logs" => {
            if let Ok(log_dir) = app.path().app_log_dir() {
                let _ = open::that(log_dir);
            }
        }
        "toggle_autostart" => {
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::ManagerExt;
                let autolaunch = app.autolaunch();
                let is_enabled = autolaunch.is_enabled().unwrap_or(false);
                if is_enabled {
                    let _ = autolaunch.disable();
                    info!("Autostart disabled");
                } else {
                    let _ = autolaunch.enable();
                    info!("Autostart enabled");
                }
                update_menu_state(app);
            }
        }
        "quit" => {
            info!("Quit requested from tray menu");
            app.exit(0);
        }
        _ => {}
    }
}

/// Handle tray icon click events
fn handle_tray_click<R: Runtime>(app: &AppHandle<R>, behavior: TrayClickBehavior) {
    match behavior {
        TrayClickBehavior::ToggleWindow => {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.set_focus();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                update_menu_state(app);
            }
        }
        TrayClickBehavior::ShowMenu => {
            // Menu is shown automatically by right-click
        }
        TrayClickBehavior::DoNothing => {}
    }
}

/// Update tray menu state (enabled/disabled items based on window visibility)
fn update_menu_state<R: Runtime>(app: &AppHandle<R>) {
    let is_visible = app
        .get_webview_window("main")
        .map(|w| w.is_visible().unwrap_or(true))
        .unwrap_or(true);

    let tray_state = app.try_state::<SharedTrayState>();
    let lang = tray_state
        .map(|s| {
            // Use try_read to avoid blocking
            s.try_read().map(|s| s.language).unwrap_or_default()
        })
        .unwrap_or_default();

    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        if let Ok(menu) = build_menu(app, is_visible, lang) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

/// Setup the system tray
pub fn setup_tray(app: &AppHandle<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let tray_state = app
        .try_state::<SharedTrayState>()
        .map(|s| s.inner().clone());

    let (lang, click_behavior) = if let Some(ref state) = tray_state {
        let guard = futures::executor::block_on(state.read());
        (guard.language, guard.click_behavior)
    } else {
        (TrayLanguage::default(), TrayClickBehavior::default())
    };

    let is_visible = app
        .get_webview_window("main")
        .map(|w| w.is_visible().unwrap_or(true))
        .unwrap_or(true);

    let menu = build_menu(app, is_visible, lang)?;

    let icon_bytes = get_icon_for_state(TrayIconState::Normal);
    let icon = Image::from_bytes(icon_bytes)?;

    let tooltip = if let Some(ref state) = tray_state {
        let guard = futures::executor::block_on(state.read());
        get_tooltip(&guard)
    } else {
        format!("CogniaLauncher v{}", APP_VERSION)
    };

    let show_menu_on_left = matches!(click_behavior, TrayClickBehavior::ShowMenu);

    let _tray = TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(icon)
        .menu(&menu)
        .tooltip(&tooltip)
        .show_menu_on_left_click(show_menu_on_left)
        .on_menu_event(|app, event| {
            handle_menu_event(app, event);
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                handle_tray_click(app, click_behavior);
            }
        })
        .build(app)?;

    info!("System tray initialized successfully");
    Ok(())
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Update the tray icon state
#[tauri::command]
pub async fn tray_set_icon_state(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
    icon_state: TrayIconState,
) -> Result<(), String> {
    {
        let mut guard = state.write().await;
        guard.icon_state = icon_state;
    }

    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        let icon_bytes = get_icon_for_state(icon_state);
        let icon = Image::from_bytes(icon_bytes).map_err(|e| e.to_string())?;
        tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Update the tray tooltip
#[tauri::command]
pub async fn tray_update_tooltip(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
) -> Result<(), String> {
    let tooltip = {
        let guard = state.read().await;
        get_tooltip(&guard)
    };

    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Set the number of active downloads (updates tooltip and icon)
#[tauri::command]
pub async fn tray_set_active_downloads(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
    count: usize,
) -> Result<(), String> {
    {
        let guard = state.read().await;
        guard.active_downloads.store(count, Ordering::SeqCst);
    }

    // Update icon state based on downloads
    let new_icon_state = if count > 0 {
        TrayIconState::Downloading
    } else {
        let guard = state.read().await;
        if guard.has_update {
            TrayIconState::Update
        } else {
            TrayIconState::Normal
        }
    };

    tray_set_icon_state(app.clone(), state.clone(), new_icon_state).await?;
    tray_update_tooltip(app, state).await
}

/// Set whether an update is available
#[tauri::command]
pub async fn tray_set_has_update(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
    has_update: bool,
) -> Result<(), String> {
    {
        let mut guard = state.write().await;
        guard.has_update = has_update;
    }

    let new_icon_state = {
        let guard = state.read().await;
        if guard.active_downloads.load(Ordering::SeqCst) > 0 {
            TrayIconState::Downloading
        } else if has_update {
            TrayIconState::Update
        } else {
            TrayIconState::Normal
        }
    };

    tray_set_icon_state(app.clone(), state.clone(), new_icon_state).await?;
    tray_update_tooltip(app, state).await
}

/// Set the tray menu language
#[tauri::command]
pub async fn tray_set_language(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
    language: TrayLanguage,
) -> Result<(), String> {
    {
        let mut guard = state.write().await;
        guard.language = language;
    }

    // Rebuild menu with new language
    update_menu_state(&app);
    tray_update_tooltip(app, state).await
}

/// Set the left-click behavior
#[tauri::command]
pub async fn tray_set_click_behavior(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
    behavior: TrayClickBehavior,
) -> Result<(), String> {
    {
        let mut guard = state.write().await;
        guard.click_behavior = behavior;
    }

    // Rebuild tray with new behavior
    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        let show_menu_on_left = matches!(behavior, TrayClickBehavior::ShowMenu);
        tray.set_show_menu_on_left_click(show_menu_on_left)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Get the current tray state
#[tauri::command]
pub async fn tray_get_state(state: State<'_, SharedTrayState>) -> Result<TrayStateInfo, String> {
    let guard = state.read().await;
    Ok(TrayStateInfo {
        icon_state: guard.icon_state,
        language: guard.language,
        active_downloads: guard.active_downloads.load(Ordering::SeqCst),
        has_update: guard.has_update,
        click_behavior: guard.click_behavior,
    })
}

/// Tray state info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayStateInfo {
    pub icon_state: TrayIconState,
    pub language: TrayLanguage,
    pub active_downloads: usize,
    pub has_update: bool,
    pub click_behavior: TrayClickBehavior,
}

/// Check if autostart is enabled
#[tauri::command]
pub fn tray_is_autostart_enabled(app: AppHandle<Wry>) -> bool {
    is_autostart_enabled(&app)
}

/// Enable autostart
#[tauri::command]
pub fn tray_enable_autostart(app: AppHandle<Wry>) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch()
            .enable()
            .map_err(|e| e.to_string())?;
        info!("Autostart enabled via command");
        update_menu_state(&app);
        Ok(())
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("Autostart not supported on this platform".to_string())
    }
}

/// Disable autostart
#[tauri::command]
pub fn tray_disable_autostart(app: AppHandle<Wry>) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch()
            .disable()
            .map_err(|e| e.to_string())?;
        info!("Autostart disabled via command");
        update_menu_state(&app);
        Ok(())
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("Autostart not supported on this platform".to_string())
    }
}

/// Send a system notification
#[tauri::command]
pub async fn tray_send_notification(
    app: AppHandle<Wry>,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Rebuild tray (useful after settings change)
#[tauri::command]
pub fn tray_rebuild(app: AppHandle<Wry>) -> Result<(), String> {
    update_menu_state(&app);
    Ok(())
}
