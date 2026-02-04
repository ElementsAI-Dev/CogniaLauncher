# System Tray Architecture

## 1. Identity

- **What it is:** A comprehensive Tauri-based system tray with dynamic state management and plugin integration.
- **Purpose:** Provide background presence, status indication, and quick access to core functionality.

## 2. Core Components

### Backend (Rust)

- `src-tauri/src/tray.rs` (setup_tray, TrayState, SharedTrayState): Tray initialization, state management, menu building, event handling. 13 Tauri commands for state control.
- `src-tauri/src/lib.rs`: Tray state management setup (`manage`), command registration (lines 264-275).

### Frontend (TypeScript/React)

- `components/providers/tray-provider.tsx` (TrayProvider): Context provider wrapping `useTraySync`.
- `lib/hooks/use-tray-sync.ts` (useTraySync, updateTrayDownloadCount, updateTrayHasUpdate): Tray state synchronization hook, event listeners, download/update state helpers.
- `components/settings/tray-settings.tsx` (TraySettings): Tray configuration UI with autostart, notifications, click behavior.
- `lib/stores/settings.ts` (useSettingsStore): Settings store (autostart, trayClickBehavior, showNotifications, minimizeToTray, startMinimized).

### Plugins

- `tauri_plugin_autostart`: Autostart management (`ManagerExt::autolaunch()`).
- `tauri_plugin_notification`: System notifications (`NotificationExt`).

## 3. Execution Flow (LLM Retrieval Map)

- **1. Initialization:** Application starts → `setup_tray` called in `src-tauri/src/lib.rs` → creates `SharedTrayState` via `manage()` → builds tray with initial state.
- **2. Menu Building:** `build_menu()` in `src-tauri/src/tray.rs:159-208` creates localized menu items (Show/Hide, Settings, Updates, Logs, Autostart toggle, Quit).
- **3. Event Handling:** Menu events routed to `handle_menu_event()` in `src-tauri/src/tray.rs:211-268` → emits `navigate` or `check-updates` events to frontend.
- **4. Frontend Sync:** `TrayProvider` mounts → `useTraySync()` in `lib/hooks/use-tray-sync.ts:23-72` → syncs language, listens for tray events, routes navigation.
- **5. State Updates:** Frontend calls `tray_set_active_downloads()` / `tray_set_has_update()` → updates `SharedTrayState` → triggers icon/tooltip update via `tray_set_icon_state()` and `tray_update_tooltip()`.
- **6. Icon State:** `get_icon_for_state()` in `src-tauri/src/tray.rs:135-142` returns icon bytes based on `TrayIconState` (Normal, Downloading, Update, Error).

## 4. Design Rationale

`SharedTrayState` (Arc<RwLock<TrayState>>) enables safe concurrent access from Tauri commands. Atomic counters for downloads avoid lock contention for frequent updates. Plugin architecture (autostart, notification) provides cross-platform abstraction. Event emission from tray to frontend enables decoupled navigation and update checking.
