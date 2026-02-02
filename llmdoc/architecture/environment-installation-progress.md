# Environment Installation Progress System

## 1. Identity

- **What it is:** Real-time progress tracking and cancellation system for environment installations.
- **Purpose:** Provides live feedback during environment version installations with the ability to cancel ongoing operations.

## 2. Core Components

- `lib/tauri.ts:10-28` (EnvInstallProgressEvent, listenEnvInstallProgress): TypeScript types and event listener for progress events.
- `src-tauri/src/commands/environment.rs:19-31` (EnvInstallProgress): Rust progress event structure.
- `src-tauri/src/commands/environment.rs:51-131` (env_install): Installation command with progress emission.
- `src-tauri/src/commands/environment.rs:323-353` (env_install_cancel): Cancellation command implementation.
- `lib/stores/environment.ts:5-15` (InstallationProgress): Zustand store interface for progress state.
- `lib/hooks/use-environments.ts:49-116` (installVersion): Frontend installation logic with progress tracking.
- `components/environments/installation-progress-dialog.tsx:1-169` (InstallationProgressDialog): Progress UI component.

## 3. Execution Flow (LLM Retrieval Map)

**Installation with Progress:**
- **1. Start:** User triggers install via `components/environments/version-browser-panel.tsx:71-78`
- **2. Store:** Opens progress dialog via `lib/stores/environment.ts:305-308`
- **3. Listen:** Sets up event listener via `lib/hooks/use-environments.ts:65-86`
- **4. Command:** Invokes `env_install` in `src-tauri/src/commands/environment.rs:51-131`
- **5. Events:** Emits progress events: fetching → downloading → configuring → done/error
- **6. Update:** Store updates via `lib/stores/environment.ts:313-317`
- **7. UI:** Dialog updates in real-time via `components/environments/installation-progress-dialog.tsx:82-106`

**Cancellation:**
- **1. Trigger:** User clicks cancel in `components/environments/installation-progress-dialog.tsx:156-158`
- **2. Hook:** Calls `cancelInstallation` in `lib/hooks/use-environments.ts:177-191`
- **3. Command:** Invokes `env_install_cancel` in `src-tauri/src/commands/environment.rs:323-353`
- **4. Token:** Sets cancellation flag via atomic boolean
- **5. Event:** Emits error event with cancellation message
- **6. Cleanup:** Removes listener and closes dialog

## 4. Design Rationale

- **Event-driven:** Uses Tauri's event system for real-time updates without polling
- **Atomic cancellation:** Uses `AtomicBool` for thread-safe cancellation token
- **Graceful degradation:** Falls back to non-progressive mode in web environment
- **Step-based progress:** Discrete steps (fetching, downloading, extracting, configuring) map to user-facing milestones
