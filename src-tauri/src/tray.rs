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
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
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

/// Identifiers for tray menu items that can be toggled on/off
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrayMenuItemId {
    ShowHide,
    QuickNav,
    Downloads,
    Settings,
    CheckUpdates,
    OpenLogs,
    AlwaysOnTop,
    Autostart,
    Quit,
}

impl TrayMenuItemId {
    /// Default set of visible menu items in order
    fn defaults() -> Vec<TrayMenuItemId> {
        vec![
            Self::ShowHide,
            Self::QuickNav,
            Self::Downloads,
            Self::Settings,
            Self::CheckUpdates,
            Self::OpenLogs,
            Self::AlwaysOnTop,
            Self::Autostart,
            Self::Quit,
        ]
    }
}

/// Configuration for which menu items are visible and their order
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuConfig {
    pub items: Vec<TrayMenuItemId>,
}

impl Default for TrayMenuConfig {
    fn default() -> Self {
        Self {
            items: TrayMenuItemId::defaults(),
        }
    }
}

/// Tray state managed by the application
#[derive(Debug)]
pub struct TrayState {
    pub icon_state: TrayIconState,
    pub language: TrayLanguage,
    pub active_downloads: AtomicUsize,
    pub has_update: bool,
    pub click_behavior: TrayClickBehavior,
    pub minimize_to_tray: bool,
    pub start_minimized: bool,
    pub always_on_top: AtomicBool,
    pub menu_config: TrayMenuConfig,
}

impl Default for TrayState {
    fn default() -> Self {
        Self {
            icon_state: TrayIconState::default(),
            language: TrayLanguage::default(),
            active_downloads: AtomicUsize::new(0),
            has_update: false,
            click_behavior: TrayClickBehavior::default(),
            minimize_to_tray: true,
            start_minimized: false,
            always_on_top: AtomicBool::new(false),
            menu_config: TrayMenuConfig::default(),
        }
    }
}

pub type SharedTrayState = Arc<RwLock<TrayState>>;

/// Menu labels for different languages
struct MenuLabels {
    show_window: &'static str,
    hide_window: &'static str,
    open_settings: &'static str,
    check_updates: &'static str,
    open_logs: &'static str,
    autostart: &'static str,
    always_on_top: &'static str,
    quit: &'static str,
    // Quick navigation submenu
    quick_nav: &'static str,
    nav_dashboard: &'static str,
    nav_environments: &'static str,
    nav_packages: &'static str,
    nav_downloads: &'static str,
    nav_cache: &'static str,
    nav_logs: &'static str,
    // Downloads submenu
    downloads_submenu: &'static str,
    downloads_active: &'static str,
    downloads_no_active: &'static str,
    downloads_pause_all: &'static str,
    downloads_resume_all: &'static str,
    downloads_open_page: &'static str,
}

impl MenuLabels {
    fn for_language(lang: TrayLanguage) -> Self {
        match lang {
            TrayLanguage::En => Self {
                show_window: "Show Window",
                hide_window: "Hide Window",
                open_settings: "Settings",
                check_updates: "Check for Updates",
                open_logs: "Open Log Directory",
                autostart: "Start with System",
                always_on_top: "Always on Top",
                quit: "Quit CogniaLauncher",
                quick_nav: "Quick Navigation",
                nav_dashboard: "Dashboard",
                nav_environments: "Environments",
                nav_packages: "Packages",
                nav_downloads: "Downloads",
                nav_cache: "Cache",
                nav_logs: "Logs",
                downloads_submenu: "Downloads",
                downloads_active: "active download(s)",
                downloads_no_active: "No active downloads",
                downloads_pause_all: "Pause All",
                downloads_resume_all: "Resume All",
                downloads_open_page: "Open Downloads Page",
            },
            TrayLanguage::Zh => Self {
                show_window: "显示窗口",
                hide_window: "隐藏窗口",
                open_settings: "设置",
                check_updates: "检查更新",
                open_logs: "打开日志目录",
                autostart: "开机启动",
                always_on_top: "置顶窗口",
                quit: "退出 CogniaLauncher",
                quick_nav: "快速导航",
                nav_dashboard: "仪表盘",
                nav_environments: "环境管理",
                nav_packages: "包管理",
                nav_downloads: "下载",
                nav_cache: "缓存",
                nav_logs: "日志",
                downloads_submenu: "下载",
                downloads_active: "个活动下载",
                downloads_no_active: "无活动下载",
                downloads_pause_all: "全部暂停",
                downloads_resume_all: "全部恢复",
                downloads_open_page: "打开下载页面",
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

/// Build a Quick Navigation submenu
fn build_nav_submenu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &MenuLabels,
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    let submenu = Submenu::with_id_and_items(
        app,
        "quick_nav",
        labels.quick_nav,
        true,
        &[
            &MenuItem::with_id(
                app,
                "nav_dashboard",
                labels.nav_dashboard,
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                "nav_environments",
                labels.nav_environments,
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(app, "nav_packages", labels.nav_packages, true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "nav_downloads",
                labels.nav_downloads,
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(app, "nav_cache", labels.nav_cache, true, None::<&str>)?,
            &MenuItem::with_id(app, "nav_logs", labels.nav_logs, true, None::<&str>)?,
        ],
    )?;
    Ok(submenu)
}

/// Build a Downloads submenu with dynamic status
fn build_downloads_submenu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &MenuLabels,
    active_downloads: usize,
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    let status_text = if active_downloads > 0 {
        format!("{} {}", active_downloads, labels.downloads_active)
    } else {
        labels.downloads_no_active.to_string()
    };
    let status_item = MenuItem::with_id(app, "download_status", &status_text, false, None::<&str>)?;
    let pause_item = MenuItem::with_id(
        app,
        "download_pause_all",
        labels.downloads_pause_all,
        active_downloads > 0,
        None::<&str>,
    )?;
    let resume_item = MenuItem::with_id(
        app,
        "download_resume_all",
        labels.downloads_resume_all,
        true,
        None::<&str>,
    )?;
    let open_item = MenuItem::with_id(
        app,
        "download_open_page",
        labels.downloads_open_page,
        true,
        None::<&str>,
    )?;

    let submenu = Submenu::with_id_and_items(
        app,
        "downloads_sub",
        labels.downloads_submenu,
        true,
        &[
            &status_item,
            &PredefinedMenuItem::separator(app)?,
            &pause_item,
            &resume_item,
            &PredefinedMenuItem::separator(app)?,
            &open_item,
        ],
    )?;
    Ok(submenu)
}

/// Build the tray menu driven by TrayMenuConfig
fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    is_visible: bool,
    state: &TrayState,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let labels = MenuLabels::for_language(state.language);
    let autostart_enabled = is_autostart_enabled(app);
    let always_on_top = state.always_on_top.load(Ordering::SeqCst);
    let active_downloads = state.active_downloads.load(Ordering::SeqCst);

    let menu = Menu::new(app)?;
    let mut need_separator = false;

    for item_id in &state.menu_config.items {
        match item_id {
            TrayMenuItemId::ShowHide => {
                if need_separator {
                    menu.append(&PredefinedMenuItem::separator(app)?)?;
                }
                let show = MenuItem::with_id(
                    app,
                    "show",
                    labels.show_window,
                    !is_visible,
                    Some("CmdOrCtrl+Shift+S"),
                )?;
                let hide =
                    MenuItem::with_id(app, "hide", labels.hide_window, is_visible, None::<&str>)?;
                menu.append(&show)?;
                menu.append(&hide)?;
                need_separator = true;
            }
            TrayMenuItemId::QuickNav => {
                if need_separator {
                    menu.append(&PredefinedMenuItem::separator(app)?)?;
                }
                let nav = build_nav_submenu(app, &labels)?;
                menu.append(&nav)?;
                need_separator = true;
            }
            TrayMenuItemId::Downloads => {
                if need_separator {
                    menu.append(&PredefinedMenuItem::separator(app)?)?;
                }
                let dl = build_downloads_submenu(app, &labels, active_downloads)?;
                menu.append(&dl)?;
                need_separator = true;
            }
            TrayMenuItemId::Settings => {
                if need_separator {
                    menu.append(&PredefinedMenuItem::separator(app)?)?;
                    need_separator = false;
                }
                let item =
                    MenuItem::with_id(app, "settings", labels.open_settings, true, None::<&str>)?;
                menu.append(&item)?;
                need_separator = true;
            }
            TrayMenuItemId::CheckUpdates => {
                let item = MenuItem::with_id(
                    app,
                    "check_updates",
                    labels.check_updates,
                    true,
                    None::<&str>,
                )?;
                menu.append(&item)?;
                need_separator = true;
            }
            TrayMenuItemId::OpenLogs => {
                let item =
                    MenuItem::with_id(app, "open_logs", labels.open_logs, true, None::<&str>)?;
                menu.append(&item)?;
                need_separator = true;
            }
            TrayMenuItemId::AlwaysOnTop => {
                if need_separator {
                    menu.append(&PredefinedMenuItem::separator(app)?)?;
                    need_separator = false;
                }
                let item = CheckMenuItem::with_id(
                    app,
                    "toggle_always_on_top",
                    labels.always_on_top,
                    true,
                    always_on_top,
                    Some("CmdOrCtrl+Shift+T"),
                )?;
                menu.append(&item)?;
                need_separator = true;
            }
            TrayMenuItemId::Autostart => {
                let item = CheckMenuItem::with_id(
                    app,
                    "toggle_autostart",
                    labels.autostart,
                    true,
                    autostart_enabled,
                    None::<&str>,
                )?;
                menu.append(&item)?;
                need_separator = true;
            }
            TrayMenuItemId::Quit => {
                if need_separator {
                    menu.append(&PredefinedMenuItem::separator(app)?)?;
                }
                let item = MenuItem::with_id(app, "quit", labels.quit, true, Some("CmdOrCtrl+Q"))?;
                menu.append(&item)?;
                need_separator = false;
            }
        }
    }

    Ok(menu)
}

/// Show window and navigate to a path
fn show_and_navigate<R: Runtime>(app: &AppHandle<R>, path: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit("navigate", path);
    }
}

/// Handle menu events
fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id.as_ref();
    match id {
        // Window visibility
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

        // Quick navigation
        "nav_dashboard" => show_and_navigate(app, "/"),
        "nav_environments" => show_and_navigate(app, "/environments"),
        "nav_packages" => show_and_navigate(app, "/packages"),
        "nav_downloads" => show_and_navigate(app, "/downloads"),
        "nav_cache" => show_and_navigate(app, "/cache"),
        "nav_logs" => show_and_navigate(app, "/logs"),

        // Downloads actions
        "download_pause_all" => {
            let _ = app.emit("download-pause-all", ());
        }
        "download_resume_all" => {
            let _ = app.emit("download-resume-all", ());
        }
        "download_open_page" => show_and_navigate(app, "/downloads"),

        // Actions
        "settings" => show_and_navigate(app, "/settings"),
        "check_updates" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app.emit("check-updates", ());
            }
        }
        "open_logs" => {
            if let Ok(log_dir) = app.path().app_log_dir() {
                let _ = tauri_plugin_opener::open_path(log_dir, None::<&str>);
            }
        }

        // Toggles
        "toggle_always_on_top" => {
            if let Some(tray_state) = app.try_state::<SharedTrayState>() {
                let prev = tray_state
                    .try_read()
                    .map(|s| s.always_on_top.load(Ordering::SeqCst))
                    .unwrap_or(false);
                let new_val = !prev;
                if let Some(guard) = tray_state.try_read().ok() {
                    guard.always_on_top.store(new_val, Ordering::SeqCst);
                }
                let _ = app.emit("toggle-always-on-top", new_val);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_always_on_top(new_val);
                }
                update_menu_state(app);
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

        // Quit
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

    let tray_state_handle = app.try_state::<SharedTrayState>();

    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        if let Some(ref state_arc) = tray_state_handle {
            if let Ok(guard) = state_arc.try_read() {
                if let Ok(menu) = build_menu(app, is_visible, &guard) {
                    let _ = tray.set_menu(Some(menu));
                }
            }
        } else {
            // Fallback with default state
            let default_state = TrayState::default();
            if let Ok(menu) = build_menu(app, is_visible, &default_state) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    }
}

/// Setup the system tray
pub fn setup_tray(app: &AppHandle<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let tray_state = app
        .try_state::<SharedTrayState>()
        .map(|s| s.inner().clone());

    let default_state = TrayState::default();

    let (click_behavior, tooltip, menu) = if let Some(ref state_arc) = tray_state {
        let guard = futures::executor::block_on(state_arc.read());
        let is_visible = app
            .get_webview_window("main")
            .map(|w| w.is_visible().unwrap_or(true))
            .unwrap_or(true);
        let m = build_menu(app, is_visible, &guard)?;
        (guard.click_behavior, get_tooltip(&guard), m)
    } else {
        let is_visible = app
            .get_webview_window("main")
            .map(|w| w.is_visible().unwrap_or(true))
            .unwrap_or(true);
        let m = build_menu(app, is_visible, &default_state)?;
        (
            TrayClickBehavior::default(),
            format!("CogniaLauncher v{}", APP_VERSION),
            m,
        )
    };

    let icon_bytes = get_icon_for_state(TrayIconState::Normal);
    let icon = Image::from_bytes(icon_bytes)?;

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

/// Check if the app should start minimized (from TrayState or CLI args)
pub fn should_start_minimized(app: &AppHandle<Wry>) -> bool {
    // Check CLI args for --minimized (passed by autostart plugin)
    if std::env::args().any(|arg| arg == "--minimized") {
        return true;
    }
    // Check TrayState
    if let Some(state) = app.try_state::<SharedTrayState>() {
        if let Ok(guard) = state.try_read() {
            return guard.start_minimized;
        }
    }
    false
}

/// Handle window close event — hides window to tray if minimize_to_tray is enabled.
/// Returns true if the close was intercepted (window hidden), false to allow normal close.
pub fn handle_close_to_tray(app: &AppHandle<Wry>) -> bool {
    if let Some(state) = app.try_state::<SharedTrayState>() {
        if let Ok(guard) = state.try_read() {
            if guard.minimize_to_tray {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                    update_menu_state(app);
                    return true;
                }
            }
        }
    }
    false
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
        tray.set_tooltip(Some(&tooltip))
            .map_err(|e| e.to_string())?;
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
        minimize_to_tray: guard.minimize_to_tray,
        start_minimized: guard.start_minimized,
        always_on_top: guard.always_on_top.load(Ordering::SeqCst),
        menu_config: guard.menu_config.clone(),
    })
}

/// Tray state info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStateInfo {
    pub icon_state: TrayIconState,
    pub language: TrayLanguage,
    pub active_downloads: usize,
    pub has_update: bool,
    pub click_behavior: TrayClickBehavior,
    pub minimize_to_tray: bool,
    pub start_minimized: bool,
    pub always_on_top: bool,
    pub menu_config: TrayMenuConfig,
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
        app.autolaunch().enable().map_err(|e| e.to_string())?;
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
        app.autolaunch().disable().map_err(|e| e.to_string())?;
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

/// Set minimize-to-tray behavior
#[tauri::command]
pub async fn tray_set_minimize_to_tray(
    state: State<'_, SharedTrayState>,
    enabled: bool,
) -> Result<(), String> {
    let mut guard = state.write().await;
    guard.minimize_to_tray = enabled;
    info!("Minimize to tray set to {}", enabled);
    Ok(())
}

/// Set start-minimized behavior
#[tauri::command]
pub async fn tray_set_start_minimized(
    state: State<'_, SharedTrayState>,
    enabled: bool,
) -> Result<(), String> {
    let mut guard = state.write().await;
    guard.start_minimized = enabled;
    info!("Start minimized set to {}", enabled);
    Ok(())
}

/// Set always-on-top state (called from frontend when toggling via window controls)
#[tauri::command]
pub async fn tray_set_always_on_top(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
    enabled: bool,
) -> Result<(), String> {
    {
        let guard = state.read().await;
        guard.always_on_top.store(enabled, Ordering::SeqCst);
    }
    update_menu_state(&app);
    Ok(())
}

/// Get the current menu configuration
#[tauri::command]
pub async fn tray_get_menu_config(
    state: State<'_, SharedTrayState>,
) -> Result<TrayMenuConfig, String> {
    let guard = state.read().await;
    Ok(guard.menu_config.clone())
}

/// Set the menu configuration (reorder/toggle items)
#[tauri::command]
pub async fn tray_set_menu_config(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
    config: TrayMenuConfig,
) -> Result<(), String> {
    {
        let mut guard = state.write().await;
        guard.menu_config = config;
    }
    update_menu_state(&app);
    info!("Tray menu config updated");
    Ok(())
}

/// Get the list of all available menu item IDs (for customization UI)
#[tauri::command]
pub fn tray_get_available_menu_items() -> Vec<TrayMenuItemId> {
    TrayMenuItemId::defaults()
}

/// Reset menu config to defaults
#[tauri::command]
pub async fn tray_reset_menu_config(
    app: AppHandle<Wry>,
    state: State<'_, SharedTrayState>,
) -> Result<(), String> {
    {
        let mut guard = state.write().await;
        guard.menu_config = TrayMenuConfig::default();
    }
    update_menu_state(&app);
    info!("Tray menu config reset to defaults");
    Ok(())
}
