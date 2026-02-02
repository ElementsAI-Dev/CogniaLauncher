# Batch Operations System

## 1. Identity

- **What it is:** Real-time batch package management with progress events.
- **Purpose:** Execute multiple package operations concurrently/sequentially with live progress feedback.

## 2. Core Components

- `src-tauri/src/core/batch.rs` (BatchManager, BatchProgress, CancellationToken): Core batch operation logic with cancellation support.
- `src-tauri/src/commands/batch.rs` (batch_install, batch_uninstall, batch_update): Tauri command handlers emitting progress events.
- `lib/tauri.ts` (BatchProgress, listenBatchProgress): TypeScript event listener types and bindings.

## 3. Execution Flow (LLM Retrieval Map)

### Batch Install Flow

1. **Frontend Request:** `batch_install` invoked via `lib/tauri.ts:217`
2. **Command Handler:** `src-tauri/src/commands/batch.rs:27-44` creates BatchManager
3. **Progress Emission:** Each progress step emitted via `emit_batch_progress` at `src-tauri/src/commands/batch.rs:23`
4. **Core Execution:** `src-tauri/src/core/batch.rs:237-258` processes packages with cancellation checks
5. **Frontend Listener:** `listenBatchProgress` in `lib/tauri.ts:225` receives events

### Event Types

- `starting`: Batch operation initialized (`src-tauri/src/core/batch.rs:95`)
- `resolving`: Dependency resolution in progress
- `downloading`: Package download with progress percentage
- `installing`: Installation execution per package
- `item_completed`: Individual package result
- `completed`: Final batch result with `BatchResult`

## 4. Design Rationale

- **Cancellation:** `CancellationToken` uses `Arc<AtomicBool>` for thread-safe shared state (`src-tauri/src/core/batch.rs:96-120`)
- **Progress Events:** Tauri's event system enables real-time UI updates without polling
- **Parallel/Sequential:** Configurable via `parallel` flag in `BatchInstallRequest`
