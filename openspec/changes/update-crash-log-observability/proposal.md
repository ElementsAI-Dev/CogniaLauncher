# Change: Improve crash logging and diagnostics observability

## Why

The current logging and crash diagnostics flow has several practical gaps:

- Backend log parsing only supports one structured format, causing historical logs to be misparsed (wrong level/timestamp fields and broken filtering).
- Synchronous crash report log-directory discovery still follows legacy paths and can miss real Tauri v2 log files.
- Frontend uncaught runtime failures (`error` / `unhandledrejection`) are not promoted into the diagnostic pipeline, so incidents may lack durable evidence.
- Crash-report retention is unbounded in the crash-reports folder.
- User docs still list outdated log command names.

## What Changes

- Add dual-format structured log parsing compatibility in backend log query/export:
  - New format: `[YYYY-MM-DD HH:MM:SS(.ms)][LEVEL][TARGET] MESSAGE`
  - Legacy format: `[YYYY-MM-DD][HH:MM:SS][TARGET][LEVEL] MESSAGE`
- Update synchronous crash log path resolution to match Tauri v2 platform conventions, with legacy fallback paths.
- Add frontend crash capture command to build a crash ZIP from frontend error context, write crash marker, and apply retention policy.
- Add automatic retention for crash ZIPs (keep latest 20).
- Add frontend runtime error reporting flow:
  - Capture `window.error` and `window.unhandledrejection`
  - Deduplicate to once per session
  - Trigger lightweight toast and preserve marker for next-launch recovery dialog.
- Update docs and i18n text for new behavior and corrected command references.

## Impact

- Affected specs: `platform-abstraction`, `ui-interface`
- Affected backend: `src-tauri/src/commands/log.rs`, `src-tauri/src/commands/diagnostic.rs`, command registration.
- Affected frontend: `lib/tauri.ts`, `types/tauri.ts`, `lib/crash-reporter.ts`, `components/providers/log-provider.tsx`, `app/error.tsx`, `app/global-error.tsx`.
- Affected docs/i18n: `docs/guide/logs.md`, `docs/reference/commands.md`, `messages/en.json`, `messages/zh.json`.
