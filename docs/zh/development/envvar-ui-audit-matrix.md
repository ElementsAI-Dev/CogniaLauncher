# EnvVar UI 审计矩阵

这份矩阵是 EnvVar 功能链路的回归基线：
`src-tauri/src/commands/envvar.rs` command -> `lib/tauri.ts` wrapper -> hook API -> page/component entry。

说明：
- 行按 workflow 分组。一行可能覆盖多个命令。
- Hook API 来自 `hooks/envvar/use-envvar.ts`。
- UI 入口主要集中在 `app/envvar/page.tsx` 与 `components/envvar/*`。

## Wiring Baseline

| Workflow | Rust Command(s) | `lib/tauri.ts` Wrapper(s) | Hook API | UI Entry |
|---|---|---|---|---|
| Capability gating / readiness | `envvar_get_support_snapshot` | `envvarGetSupportSnapshot` | `useEnvVar.loadSupportSnapshot`, `useEnvVar.getActionSupport` | `app/envvar/page.tsx` (header actions + support error banner) |
| Detection (lists + conflicts) | `envvar_list_process_summaries`, `envvar_list_persistent_typed_summaries`, `envvar_detect_conflicts` | `envvarListProcessSummaries`, `envvarListPersistentTypedSummaries`, `envvarDetectConflicts` | `useEnvVar.loadDetection` | `EnvVarToolbar`, `EnvVarTable`, `EnvVarConflictPanel` |
| Process mutation (set/remove) | `envvar_set_process`, `envvar_remove_process` | `envvarSetProcess`, `envvarRemoveProcess` | `useEnvVar.setVar`, `useEnvVar.removeVar` | `EnvVarTable` (inline edit/delete), `EnvVarEditDialog` (add) |
| Persistent mutation (set/remove) | `envvar_set_persistent`, `envvar_remove_persistent` | `envvarSetPersistent`, `envvarRemovePersistent` | `useEnvVar.setVar`, `useEnvVar.removeVar` | `EnvVarTable`, `EnvVarEditDialog` (scope selection) |
| Sensitive value reveal | `envvar_reveal_value` | `envvarRevealValue` | `useEnvVar.revealVar`, `useEnvVar.clearRevealedVar` | `EnvVarTable` (reveal/copy/edit flows) |
| Import (direct) | `envvar_import_env_file` | `envvarImportEnvFile` | `useEnvVar.importEnvFile` | `EnvVarImportExport` (import tab, no-preview mode) |
| Import preview/apply | `envvar_preview_import_env_file`, `envvar_apply_import_preview` | `envvarPreviewImportEnvFile`, `envvarApplyImportPreview` | `useEnvVar.previewImportEnvFile`, `useEnvVar.applyImportPreview` | `EnvVarImportExport` (preview -> apply, stale preview handling) |
| Export | `envvar_export_env_file` | `envvarExportEnvFile` | `useEnvVar.exportEnvFile` | `EnvVarImportExport` (includeSensitive + redacted warnings) |
| 快照历史 / 保护预检 / 恢复 | `envvar_list_snapshots`, `envvar_create_snapshot`, `envvar_get_backup_protection`, `envvar_preview_snapshot_restore`, `envvar_restore_snapshot`, `envvar_delete_snapshot` | `envvarListSnapshots`, `envvarCreateSnapshot`, `envvarGetBackupProtection`, `envvarPreviewSnapshotRestore`, `envvarRestoreSnapshot`, `envvarDeleteSnapshot` | `useEnvVar.fetchSnapshotHistory`, `createSnapshot`, `getBackupProtection`, `previewSnapshotRestore`, `restoreSnapshot`, `deleteSnapshot` | `app/envvar/page.tsx`（快照历史卡片、精确 action 保护提示、scope-aware 恢复预览、恢复/删除动作） |
| PATH read/mutate | `envvar_get_path`, `envvar_add_path_entry`, `envvar_remove_path_entry`, `envvar_reorder_path`, `envvar_deduplicate_path` | `envvarGetPath`, `envvarAddPathEntry`, `envvarRemovePathEntry`, `envvarReorderPath`, `envvarDeduplicatePath` | `useEnvVar.fetchPath`, `addPathEntry`, `removePathEntry`, `reorderPath`, `deduplicatePath` | `EnvVarPathEditor` (add/remove/reorder/deduplicate) |
| PATH repair preview/apply | `envvar_preview_path_repair`, `envvar_apply_path_repair` | `envvarPreviewPathRepair`, `envvarApplyPathRepair` | `useEnvVar.previewPathRepair`, `useEnvVar.applyPathRepair` | `EnvVarPathEditor` (preview -> apply, stale preview handling) |
| Shell profiles | `envvar_list_shell_profiles`, `envvar_read_shell_profile` | `envvarListShellProfiles`, `envvarReadShellProfile` | `useEnvVar.fetchShellProfiles`, `readShellProfile` | `EnvVarShellProfiles` |
| Conflict resolution | `envvar_resolve_conflict` | `envvarResolveConflict` | `useEnvVar.resolveConflict` | `EnvVarConflictPanel` |

## Component/Module Verification

| Module | Critical Behaviors (must stay working) | Primary Jest Tests |
|---|---|---|
| `app/envvar/page.tsx` | Desktop gating、初始化刷新、状态提示、精确 action 快照保护提示、scope-aware 恢复预览/确认、页头动作、Tabs、Shell guidance 提示点、support blocked disable state | `app/envvar/page.test.tsx` |
| `app/envvar/loading.tsx` | Skeleton renders without crashing | `app/envvar/loading.test.tsx` |
| `components/envvar/envvar-toolbar.tsx` | Search input, clear button, scope filter, count text, disabled state | `components/envvar/envvar-toolbar.test.tsx` |
| `components/envvar/envvar-table.tsx` | Filter, copy/edit/delete, masked reveal before copy/edit, PATH open/reveal gating, compact/desktop layouts | `components/envvar/envvar-table.test.tsx` |
| `components/envvar/envvar-edit-dialog.tsx` | Key validation, scope selection (add mode), pending state, PATH split/join, persistent-scope warning | `components/envvar/envvar-edit-dialog.test.tsx` |
| `components/envvar/envvar-import-export.tsx` | Import/direct, import preview/apply + stale warning, export includeSensitive + warnings, copy/download | `components/envvar/envvar-import-export.test.tsx` |
| `components/envvar/envvar-path-editor.tsx` | Add/remove/reorder, deduplicate, repair preview/apply + stale, search filter, disabled state | `components/envvar/envvar-path-editor.test.tsx` |
| `components/envvar/envvar-shell-profiles.tsx` | List/empty state, view/collapse, loading skeleton, copy profile content, guidance rendering | `components/envvar/envvar-shell-profiles.test.tsx` |
| `components/envvar/envvar-conflict-panel.tsx` | Ignore defaults/custom ignores, collapse/dismiss/restore, compact/desktop layout, resolve disabled on busy | `components/envvar/envvar-conflict-panel.test.tsx` |
| `hooks/envvar/use-envvar.ts` | Detection cache + concurrency、shared recovery reconcile、精确 action 保护预检、stale preview flags、mutation normalization、reveal cache | `hooks/envvar/use-envvar.test.ts` |
| `lib/envvar.ts` | Key validation, row building, file extension mapping, download helper | `lib/envvar.test.ts` |
