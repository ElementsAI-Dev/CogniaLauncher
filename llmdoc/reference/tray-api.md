# System Tray API Reference

## 1. Core Summary

The system tray exposes 13 Tauri commands for state management, icon control, notifications, and autostart. Frontend communicates via `lib/tauri.ts` wrapper functions. State is managed through `SharedTrayState` (Arc<RwLock<TrayState>>).

## 2. Source of Truth

- **Primary Backend:** `src-tauri/src/tray.rs` - Complete tray implementation, state types, Tauri commands (lines 1-601)
- **Command Registration:** `src-tauri/src/lib.rs:264-275` - Tray command registration in invoke_handler
- **Frontend API:** `lib/tauri.ts:950-983` - TypeScript command wrappers, type definitions (TrayIconState, TrayLanguage, TrayClickBehavior, TrayStateInfo)
- **Frontend State Sync:** `lib/hooks/use-tray-sync.ts:23-72` - useTraySync hook, event listeners, helper functions
- **Settings UI:** `components/settings/tray-settings.tsx` - Tray settings component (autostart, notifications, click behavior)
- **Settings Store:** `lib/stores/settings.ts:11-13,45-47` - Tray-related settings (autostart, trayClickBehavior, showNotifications)

## 3. Tauri Commands

| Command | Purpose | State Access |
|---------|---------|--------------|
| `tray_set_icon_state` | Update tray icon based on state | Write |
| `tray_update_tooltip` | Update tooltip with downloads/update info | Read |
| `tray_set_active_downloads` | Set download count, updates icon/tooltip | Read/Write |
| `tray_set_has_update` | Set update availability, updates icon/tooltip | Read/Write |
| `tray_set_language` | Change menu language | Write |
| `tray_set_click_behavior` | Configure left-click action | Write |
| `tray_get_state` | Get current tray state | Read |
| `tray_is_autostart_enabled` | Check autostart status | None |
| `tray_enable_autostart` | Enable application autostart | None |
| `tray_disable_autostart` | Disable application autostart | None |
| `tray_send_notification` | Send system notification | None |
| `tray_rebuild` | Rebuild menu after settings change | None |

## 4. Frontend Events

| Event | Source | Handler |
|-------|--------|---------|
| `navigate` | Tray menu → Frontend | `useTraySync()` → `router.push()` |
| `check-updates` | Tray menu → Frontend | `useTraySync()` → `router.push('/about')` |

## 5. Types

```typescript
// TrayIconState: 'normal' | 'downloading' | 'update' | 'error'
// TrayLanguage: 'en' | 'zh'
// TrayClickBehavior: 'toggle_window' | 'show_menu' | 'do_nothing'
```
