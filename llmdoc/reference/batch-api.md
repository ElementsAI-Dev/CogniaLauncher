# Batch Operations API Reference

## 1. Core Summary

Batch operations enable installing, updating, or uninstalling multiple packages with real-time progress events. Operations support parallel/sequential execution and cancellation.

## 2. Source of Truth

- **TypeScript Types:** `lib/tauri.ts:217-231` - `BatchProgress` union type and `listenBatchProgress` function
- **Rust Core:** `src-tauri/src/core/batch.rs:96-120` - `CancellationToken` implementation
- **Command Handlers:** `src-tauri/src/commands/batch.rs:23-91` - Progress emission logic
- **Architecture:** `/llmdoc/architecture/batch-operations-system.md` - System design details
