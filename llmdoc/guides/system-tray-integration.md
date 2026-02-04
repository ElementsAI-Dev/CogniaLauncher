# How to Extend the System Tray

1. **Add Menu Item:** Add menu item in `build_menu()` at `src-tauri/src/tray.rs:159-208` using `MenuItem::with_id()`. Add localized labels to `MenuLabels` struct.

2. **Add Handler:** Implement event handler in `handle_menu_event()` at `src-tauri/src/tray.rs:211-268`. Emit events to frontend using `app.emit()` if needed.

3. **Frontend Listener (Optional):** If emitting events, add listener in `useTraySync()` at `lib/hooks/use-tray-sync.ts:23-72` using helpers like `listenNavigate()` or `listenCheckUpdates()`.

4. **Add Command (Optional):** For state control, add Tauri command in `src-tauri/src/tray.rs` and register in `src-tauri/src/lib.rs:264-275`. Add TypeScript wrapper in `lib/tauri.ts:950-983`.

5. **Add Setting (Optional):** Add setting to `lib/stores/settings.ts` and UI in `components/settings/tray-settings.tsx`.

6. **Add Icon State (Optional):** Add variant to `TrayIconState` enum in `src-tauri/src/tray.rs:29-35`. Add icon bytes in `get_icon_for_state()` at `src-tauri/src/tray.rs:135-142`.

7. **Test:** Run `pnpm tauri dev`, verify tray icon, menu actions, state updates, and event routing.
