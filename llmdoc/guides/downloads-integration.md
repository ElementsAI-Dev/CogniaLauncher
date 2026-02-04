# How to Integrate with the Downloads System

1. **Add Tauri Command Handler:** If creating a new download source, add a command in `src-tauri/src/commands/download.rs` that calls `download_start` with appropriate URL and metadata.

2. **Register Command:** Export the new command from `src-tauri/src/commands/mod.rs` and register it in `src-tauri/src/lib.rs` invoke handler.

3. **Add Frontend Integration:** Create a function in `lib/tauri.ts` that invokes your new command with proper TypeScript types.

4. **Update UI:** Add UI elements (buttons, dialogs) that call your new function via the download hook or store.

5. **Handle Events:** Subscribe to `download-progress` events in your component to display real-time progress updates.

6. **Test Integration:** Run `pnpm tauri dev` and verify downloads appear in the downloads page with correct progress and history.
