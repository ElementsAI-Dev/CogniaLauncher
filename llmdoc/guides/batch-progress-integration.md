# How to Use Batch Progress Events

1. **Import Listener:** Import `listenBatchProgress` from `lib/tauri.ts:225`

2. **Setup Listener:** Call `listenBatchProgress` with a callback before invoking batch commands

```typescript
const unlisten = await listenBatchProgress((progress) => {
  switch (progress.type) {
    case 'starting':
      // Initialize UI with progress.total
      break;
    case 'item_completed':
      // Update individual package status
      break;
    case 'completed':
      // Display final result from progress.result
      break;
  }
});
```

3. **Invoke Batch Operation:** Call `batch_install`, `batch_uninstall`, or `batch_update` via `lib/tauri.ts`

4. **Cleanup:** Call `unlisten()` when component unmounts or operation completes.

**Reference:** Frontend types in `lib/tauri.ts:217-231`, backend emission in `src-tauri/src/commands/batch.rs:23`
