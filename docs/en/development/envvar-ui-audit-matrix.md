# Envvar UI Audit Matrix

This matrix is the regression baseline for envvar feature wiring:
`src-tauri/src/commands/envvar.rs` command -> `lib/tauri.ts` wrapper -> hook API -> page/component entry.

Notes:
- Rows are grouped by workflow. A row can include multiple commands.
- Hook APIs are from `hooks/use-envvar.ts`.
- UI entry is the main integration in `app/envvar/page.tsx` and `components/envvar/*`.

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
| PATH read/mutate | `envvar_get_path`, `envvar_add_path_entry`, `envvar_remove_path_entry`, `envvar_reorder_path`, `envvar_deduplicate_path` | `envvarGetPath`, `envvarAddPathEntry`, `envvarRemovePathEntry`, `envvarReorderPath`, `envvarDeduplicatePath` | `useEnvVar.fetchPath`, `addPathEntry`, `removePathEntry`, `reorderPath`, `deduplicatePath` | `EnvVarPathEditor` (add/remove/reorder/deduplicate) |
| PATH repair preview/apply | `envvar_preview_path_repair`, `envvar_apply_path_repair` | `envvarPreviewPathRepair`, `envvarApplyPathRepair` | `useEnvVar.previewPathRepair`, `useEnvVar.applyPathRepair` | `EnvVarPathEditor` (preview -> apply, stale preview handling) |
| Shell profiles | `envvar_list_shell_profiles`, `envvar_read_shell_profile` | `envvarListShellProfiles`, `envvarReadShellProfile` | `useEnvVar.fetchShellProfiles`, `readShellProfile` | `EnvVarShellProfiles` |
| Conflict resolution | `envvar_resolve_conflict` | `envvarResolveConflict` | `useEnvVar.resolveConflict` | `EnvVarConflictPanel` |

## Component/Module Verification

| Module | Critical Behaviors (must stay working) | Primary Jest Tests |
|---|---|---|
| `app/envvar/page.tsx` | Desktop gating, init refresh, status banners, header actions, tabs, shell guidance banner, support blocked disable state | `app/envvar/page.test.tsx` |
| `app/envvar/loading.tsx` | Skeleton renders without crashing | `app/envvar/loading.test.tsx` |
| `components/envvar/envvar-toolbar.tsx` | Search input, clear button, scope filter, count text, disabled state | `components/envvar/envvar-toolbar.test.tsx` |
| `components/envvar/envvar-table.tsx` | Filter, copy/edit/delete, masked reveal before copy/edit, PATH open/reveal gating, compact/desktop layouts | `components/envvar/envvar-table.test.tsx` |
| `components/envvar/envvar-edit-dialog.tsx` | Key validation, scope selection (add mode), pending state, PATH split/join, persistent-scope warning | `components/envvar/envvar-edit-dialog.test.tsx` |
| `components/envvar/envvar-import-export.tsx` | Import/direct, import preview/apply + stale warning, export includeSensitive + warnings, copy/download | `components/envvar/envvar-import-export.test.tsx` |
| `components/envvar/envvar-path-editor.tsx` | Add/remove/reorder, deduplicate, repair preview/apply + stale, search filter, disabled state | `components/envvar/envvar-path-editor.test.tsx` |
| `components/envvar/envvar-shell-profiles.tsx` | List/empty state, view/collapse, loading skeleton, copy profile content, guidance rendering | `components/envvar/envvar-shell-profiles.test.tsx` |
| `components/envvar/envvar-conflict-panel.tsx` | Ignore defaults/custom ignores, collapse/dismiss/restore, compact/desktop layout, resolve disabled on busy | `components/envvar/envvar-conflict-panel.test.tsx` |
| `hooks/use-envvar.ts` | Detection cache + concurrency, refresh invalidation, stale preview flags, mutation normalization, reveal cache | `hooks/use-envvar.test.ts` |
| `lib/envvar.ts` | Key validation, row building, file extension mapping, download helper | `lib/envvar.test.ts` |

