# Downloads System Architecture

## 1. Identity

- **What it is:** A multi-layer download management architecture with one shared desktop runtime owner, a queue/task workspace, and persistent history plus provider metadata.
- **Purpose:** Coordinate concurrent downloads with trustworthy state management, progress tracking, provider-aware artifact metadata, and reusable follow-up workflows.

## 2. Core Components

### Backend (Rust)

- `src-tauri/src/download/manager.rs` (DownloadManager, DownloadEvent): Main coordinator managing download queue and task lifecycle.
- `src-tauri/src/download/queue.rs` (DownloadQueue, QueueStats): Queue management with concurrency control and task ordering.
- `src-tauri/src/download/task.rs` (DownloadTask, DownloadConfig, DownloadProgress): Individual download task with state machine (queued, downloading, paused, completed, failed, cancelled).
- `src-tauri/src/download/throttle.rs` (SpeedLimiter): Download speed throttling with token bucket algorithm.
- `src-tauri/src/download/state.rs` (DownloadError): Error types and state transitions.
- `src-tauri/src/cache/download_history.rs` (DownloadHistory, DownloadRecord, HistoryStats): SQLite-based persistent download history.
- `src-tauri/src/commands/download.rs` (download_start, download_pause, download_resume, download_cancel, download_list, download_get_history, download_clear_history): Tauri command handlers for frontend interaction.
- `src-tauri/src/commands/github.rs` / `src-tauri/src/commands/gitlab.rs`: Provider-specific download entrypoints that normalize source descriptors and infer artifact metadata for persistence.

### Frontend (TypeScript/React)

- `app/layout.tsx` + `components/providers/download-runtime-provider.tsx`: Shared runtime owner that hydrates queue/history state, listens for download events, and persists recoverable shutdown state.
- `app/downloads/page.tsx` (DownloadsPage): Main downloads UI with grouped task cards, detail dialog, and draft reuse entrypoints that consume the shared store without starting a second runtime.
- `components/downloads/add-download-dialog.tsx` (AddDownloadDialog): Dialog for adding new download tasks.
- `components/downloads/download-detail-dialog.tsx` / `components/downloads/download-history-panel.tsx`: Follow-up surfaces that derive safe actions from persisted artifact metadata plus explicit destination availability.
- `components/downloads/gitlab-*.tsx`: GitLab selection surfaces that reuse the same artifact-intelligence cues as GitHub when filenames provide enough signal.
- `lib/stores/download.ts` (useDownloadStore): Zustand store managing download state and history.
- `hooks/use-downloads.ts` (useDownloads): Shared hook for download operations, runtime ownership guards, and destination-availability checks.
- `lib/tauri.ts`: Tauri bindings for download commands.

## 3. Execution Flow (LLM Retrieval Map)

- **1. Runtime Ownership:** `DownloadRuntimeProvider` mounts once per window and activates `useDownloads({ enableRuntime: true })` to hydrate the shared store, attach event listeners, and persist shutdown state.
- **2. Task Creation:** Manual, batch, GitHub, and GitLab entrypoints normalize request metadata (`sourceDescriptor`, `artifactProfile`, `installIntent`) before calling `download_add`.
- **3. Queue Management:** Backend command validates input → creates `DownloadTask` → submits to `DownloadManager`.
- **4. Progress Tracking:** `DownloadManager` emits queue/task events → shared runtime updates Zustand store → task cards, dashboard consumers, and detail surfaces react from the same session state.
- **5. Follow-up Resolution:** Detail/history derive file, install, extract, and reuse actions from persisted artifact metadata plus explicit destination-availability checks.
- **6. History Persistence:** Completed, failed, and cancelled tasks are recorded to SQLite with provider-aware metadata so later sessions can reopen safe follow-up or edit flows.

## 4. Design Rationale

The system uses a queue-based architecture to limit concurrent downloads and prevent resource exhaustion. A single runtime owner avoids duplicate listeners and duplicated startup/shutdown side effects. Persisted provider metadata keeps GitHub and GitLab flows comparable across queue/detail/history surfaces, while explicit destination-availability checks prevent invalid follow-up actions after files move or disappear.
