# Downloads API Reference

## 1. Core Summary

The downloads system provides Tauri commands for managing HTTP downloads with queuing, throttling, and history tracking. All commands return structured responses with task information or error details.

## 2. Source of Truth

- **Primary Code:** `src-tauri/src/commands/download.rs` - Tauri command handlers for download operations.
- **Core Logic:** `src-tauri/src/download/` - Download manager, queue, task, and throttle implementations.
- **History Storage:** `src-tauri/src/cache/download_history.rs` - SQLite-based download history.
- **Frontend Store:** `lib/stores/download.ts` - Zustand store for download state management.
- **Frontend Hook:** `lib/hooks/use-downloads.ts` - React hook for download operations.
- **UI Components:** `app/downloads/page.tsx`, `components/downloads/` - Download management UI.
- **Related Architecture:** `/llmdoc/architecture/downloads-system.md` - Complete system architecture.
