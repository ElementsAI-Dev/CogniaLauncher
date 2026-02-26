# Tasks: Improve crash logging and diagnostics observability

## 1. Specification

- [x] 1.1 Add spec deltas for logging/crash observability behavior (`platform-abstraction` and `ui-interface`).
- [x] 1.2 Run `openspec validate update-crash-log-observability --strict`.

## 2. Backend logging compatibility

- [x] 2.1 Update log line parser to support both new and legacy structured formats.
- [x] 2.2 Ensure parsed timestamps from legacy logs are normalized (`date + time`) for time filtering.
- [x] 2.3 Keep robust fallback parsing for non-structured lines.
- [x] 2.4 Add Rust unit tests for both log formats and filter correctness.

## 3. Crash diagnostics backend

- [x] 3.1 Update panic-time log directory discovery to Tauri v2 canonical paths with legacy fallback.
- [x] 3.2 Add crash report retention cleanup (keep latest 20 ZIPs).
- [x] 3.3 Add `diagnostic_capture_frontend_crash` Tauri command.
- [x] 3.4 Register and expose the new command in backend command exports/invoke handler.
- [x] 3.5 Add Rust unit tests for retention and path candidate behavior.

## 4. Frontend crash reporting flow

- [x] 4.1 Add unified crash reporter utility with session-level deduplication.
- [x] 4.2 Wire runtime listeners (`error`, `unhandledrejection`) in `LogProvider`.
- [x] 4.3 Wire `app/error.tsx` and `app/global-error.tsx` to report boundary-caught crashes.
- [x] 4.4 Expose new TS API/type wrappers (`types/tauri.ts`, `lib/tauri.ts`).
- [x] 4.5 Add frontend unit tests for crash reporter and listener behavior.

## 5. Documentation and localization

- [x] 5.1 Update `docs/guide/logs.md` command table and crash/format details.
- [x] 5.2 Update `docs/reference/commands.md` with new diagnostic command.
- [x] 5.3 Add i18n copy for automatic frontend crash capture notices.

## 6. Validation

- [x] 6.1 Run targeted frontend tests (`pnpm test -- ...`) for updated modules.
- [x] 6.2 Run targeted Rust tests (`cargo test`) for `log` and `diagnostic`.
