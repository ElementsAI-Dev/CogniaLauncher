# Logging System

CogniaLauncher's logging architecture consists of three layers: backend structured logs, frontend runtime logs, and crash diagnostic bundles.

---

## Log Sources

### Backend Logs (profile-aware)

- **Release builds** use `tauri-plugin-log` for stdout, WebView forwarding, and persisted session log files.
- **Desktop debug builds** use CrabNebula DevTools instrumentation instead of `tauri-plugin-log` because the two logger integrations conflict.
- If you need backend log streaming, event inspection, or command tracing during `pnpm tauri dev`, connect the app from CrabNebula DevTools.

### Frontend Logs (LogProvider)

- Console interception: `console.*` writes to frontend log store
- Event logs: downloads, batch operations, self-update, update checks all feed into the log panel
- Runtime exceptions: listens to `window.error` and `window.unhandledrejection`
- When the backend `plugin-log` bridge is unavailable in a desktop debug build, the provider keeps frontend/event logging active and shows a developer hint that points to CrabNebula DevTools.

## Debug vs Release Workflow

- Use `pnpm tauri dev` + CrabNebula DevTools when you need live backend diagnostics in development.
- Use the in-app `/logs` page to inspect persisted session files and historical exports in release-style builds where `tauri-plugin-log` is enabled.
- It is expected that a desktop debug build may not stream Rust backend logs into the in-app log panel.

### Crash Diagnostic Bundles

- Rust panic: automatically generates a ZIP via panic hook
- Frontend uncaught exceptions (desktop mode only): auto-calls `diagnostic_capture_frontend_crash`
- Max 1 auto-report per session to avoid flooding
- Keeps the most recent 20 bundles, older ones are auto-cleaned

---

## Log Format Compatibility

Log querying and export supports parsing both historical formats:

1. New format
   `[YYYY-MM-DD HH:MM:SS(.ms)][LEVEL][TARGET] MESSAGE`
2. Old format
   `[YYYY-MM-DD][HH:MM:SS][TARGET][LEVEL] MESSAGE`

Notes:

- The old format automatically merges `date + time` into a full timestamp, ensuring accurate `start_time` / `end_time` filtering.
- Unstructured lines go through a fallback path so no logs are lost due to parse failures.

---

## Query and Export Behavior

- Both `log_query` and `log_export` support plain `.log` and compressed `.log.gz` files.
- `log_query` uses tail-window pagination (latest entries first with `offset` / `limit`), reducing memory pressure on large files.
- When filters are enabled, `max_scan_lines` can be passed to limit scan depth (especially useful in follow/polling mode).
- `log_export` supports filtered export in TXT/JSON for the same log formats.

---

## Crash Recovery Experience

- After successful auto-diagnosis, a lightweight toast notification is shown for the current session.
- A crash marker is also written; on next launch, a recovery dialog appears with options to open the report directory or dismiss.

---

## Related Commands

| Command | Description |
|---------|-------------|
| `log_query` | Query logs (level/time/keyword filter + pagination, supports `max_scan_lines`) |
| `log_export` | Export logs (TXT/JSON, supports `.log` and `.log.gz`) |
| `log_list_files` | List log files |
| `log_get_dir` | Get log directory |
| `log_get_total_size` | Get total log size |
| `log_clear` | Clear log files |
| `diagnostic_export_bundle` | Manually export diagnostic bundle |
| `diagnostic_capture_frontend_crash` | Frontend exception auto-diagnostic command |
