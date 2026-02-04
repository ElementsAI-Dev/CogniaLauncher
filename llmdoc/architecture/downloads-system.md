# Downloads System Architecture

## 1. Identity

- **What it is:** A multi-layer download management architecture with queue, task, and history components.
- **Purpose:** Coordinate concurrent downloads with state management, progress tracking, and persistent history.

## 2. Core Components

### Backend (Rust)

- `src-tauri/src/download/manager.rs` (DownloadManager, DownloadEvent): Main coordinator managing download queue and task lifecycle.
- `src-tauri/src/download/queue.rs` (DownloadQueue, QueueStats): Queue management with concurrency control and task ordering.
- `src-tauri/src/download/task.rs` (DownloadTask, DownloadConfig, DownloadProgress): Individual download task with state machine (queued, downloading, paused, completed, failed, cancelled).
- `src-tauri/src/download/throttle.rs` (SpeedLimiter): Download speed throttling with token bucket algorithm.
- `src-tauri/src/download/state.rs` (DownloadError): Error types and state transitions.
- `src-tauri/src/cache/download_history.rs` (DownloadHistory, DownloadRecord, HistoryStats): SQLite-based persistent download history.
- `src-tauri/src/commands/download.rs` (download_start, download_pause, download_resume, download_cancel, download_list, download_get_history, download_clear_history): Tauri command handlers for frontend interaction.

### Frontend (TypeScript/React)

- `app/downloads/page.tsx` (DownloadsPage): Main downloads UI with active tasks and history tabs.
- `components/downloads/add-download-dialog.tsx` (AddDownloadDialog): Dialog for adding new download tasks.
- `lib/stores/download.ts` (useDownloadStore): Zustand store managing download state and history.
- `lib/hooks/use-downloads.ts` (useDownloads): Convenience hook for download operations.
- `lib/tauri.ts`: Tauri bindings for download commands.

## 3. Execution Flow (LLM Retrieval Map)

- **1. Task Creation:** User adds download via `AddDownloadDialog` → calls `download_start` in `src-tauri/src/commands/download.rs:25-70`.
- **2. Queue Management:** Command validates input → creates `DownloadTask` → submits to `DownloadManager` in `src-tauri/src/download/manager.rs:60-95`.
- **3. Download Execution:** `DownloadManager` processes queue → spawns tokio task → makes HTTP request via reqwest in `src-tauri/src/download/task.rs:120-180`.
- **4. Progress Tracking:** Task emits `DownloadEvent::TaskProgress` → manager forwards to frontend via Tauri events in `src-tauri/src/download/manager.rs:150-170`.
- **5. History Persistence:** Completed tasks recorded to SQLite via `DownloadHistory` in `src-tauri/src/cache/download_history.rs:45-80`.

## 4. Design Rationale

The system uses a queue-based architecture to limit concurrent downloads and prevent resource exhaustion. Speed throttling prevents network saturation. History persistence in SQLite provides audit trail and resume capability. Event-driven architecture enables real-time UI updates without polling.
