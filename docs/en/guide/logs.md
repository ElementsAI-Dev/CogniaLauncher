# Logging System

CogniaLauncher's logging architecture consists of three layers: backend structured logs, frontend runtime logs, and crash diagnostic bundles.

---

## Log Sources

### Backend Logs (Tauri + `tauri-plugin-log`)

- Output targets: stdout, WebView, log files
- Log rotation: max 5 files, 10MB per file
- Log levels: `ERROR` / `WARN` / `INFO` / `DEBUG` / `TRACE`

### Frontend Logs (LogProvider)

- Console interception: `console.*` writes to frontend log store
- Event logs: downloads, batch operations, self-update, update checks all feed into the log panel
- Runtime exceptions: listens to `window.error` and `window.unhandledrejection`

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

## Crash Recovery Experience

- After successful auto-diagnosis, a lightweight toast notification is shown for the current session.
- A crash marker is also written; on next launch, a recovery dialog appears with options to open the report directory or dismiss.

---

## Related Commands

| Command | Description |
|---------|-------------|
| `log_query` | Query logs (level/time/keyword filter + pagination) |
| `log_export` | Export logs (TXT/JSON) |
| `log_list_files` | List log files |
| `log_get_dir` | Get log directory |
| `log_get_total_size` | Get total log size |
| `log_clear` | Clear log files |
| `diagnostic_export_bundle` | Manually export diagnostic bundle |
| `diagnostic_capture_frontend_crash` | Frontend exception auto-diagnostic command |
