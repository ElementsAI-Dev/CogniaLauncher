# Downloads API Reference

## 1. Core Summary

The downloads system provides Tauri commands for managing HTTP downloads with queuing, throttling, persistent history, and provider-aware artifact metadata. All commands return structured responses with task information or error details.

## 2. Source of Truth

- **Primary Code:** `src-tauri/src/commands/download.rs` - Tauri command handlers for download operations.
- **Provider Entry Points:** `src-tauri/src/commands/github.rs`, `src-tauri/src/commands/gitlab.rs` - Provider-specific request builders that normalize `sourceDescriptor`, `artifactProfile`, and `installIntent`.
- **Core Logic:** `src-tauri/src/download/` - Download manager, queue, task, and throttle implementations.
- **History Storage:** `src-tauri/src/cache/download_history.rs` - SQLite-based download history.
- **Frontend Store:** `lib/stores/download.ts` - Zustand store for download state management.
- **Frontend Hook:** `hooks/use-downloads.ts` - React hook for runtime ownership, download operations, and destination-availability checks.
- **UI Components:** `app/downloads/page.tsx`, `components/downloads/` - Download management UI.
- **Related Architecture:** `/llmdoc/architecture/downloads-system.md` - Complete system architecture.

## 3. Contract Notes

- `download_add` is the canonical queue entrypoint for manual, batch, GitHub, and GitLab flows.
- Provider commands persist `sourceDescriptor`, `artifactProfile`, and `installIntent` so queue, detail, history, and reopened drafts can resolve the same follow-up semantics later.
- Frontend follow-up UI MUST treat destination availability as explicit input; completed status alone is not enough to expose open, reveal, install, or extract actions.
- GitLab release assets, pipeline artifacts, and package files now reuse the same platform/architecture recommendation cues as GitHub when the filename provides enough signal.
