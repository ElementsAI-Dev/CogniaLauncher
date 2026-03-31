# Logs Workspace Completeness Audit

## Scope

- Page: `app/logs/page.tsx`
- Drawer: `components/log/log-drawer.tsx`
- Core components:
  - `components/log/log-panel.tsx`
  - `components/log/log-toolbar.tsx`
  - `components/log/log-entry.tsx`
  - `components/log/log-file-list-card.tsx`
  - `components/log/log-file-viewer.tsx`
  - `components/log/log-management-card.tsx`
  - `components/log/log-diagnostics-card.tsx`
  - `components/log/log-stats-strip.tsx`
- Orchestration/state:
  - `hooks/use-logs.ts`
  - `lib/stores/log.ts`
  - `lib/log-workspace.ts`
  - `components/providers/log-provider.tsx`

## 1. Component Capability Inventory

| Surface | Primary Capability | Action Path |
|---|---|---|
| `LogPanel` | Realtime stream rendering, filtering result display, empty-state handling | `useLogStore` computed state + `LogToolbar` controls |
| `LogToolbar` | Search, level filter, presets, time range, export, clear, scan limit | `useLogStore` actions + `useLogs.exportLogs` |
| `LogEntry` | Single-entry rendering, copy, bookmark, detail expand/collapse | Store-backed entry actions |
| `LogDrawer` | Quick triage realtime panel, cross-entry handoff to `/logs` | Shared store + route context serialization |
| `LogFileListCard` | Historical file browse/search/sort/pagination/select/delete/clear | Page callbacks -> `useLogs` mutations |
| `LogFileViewer` | Historical query viewing window and bounded dialog UX | Selected file from store/page |
| `LogManagementCard` | Cleanup preview/confirm execution, policy save feedback, refresh | `useLogs.previewCleanupLogs` + `useLogs.cleanupLogs` |
| `LogDiagnosticsCard` | Full diagnostic export, bridge guidance, crash report browsing | `useLogs.exportDiagnosticBundle` + crash-report actions |
| `LogStatsStrip` | Runtime/storage/context overview + latest action summary | `lib/log-workspace` derived overview/actions |
| `/logs` page | Workbench orchestration across realtime/files/management sections | Page-level handlers wired to shared hook/store |

## 2. Cross-entry Capability Matrix

Legend: `Y` = direct capability, `H` = one-step handoff, `N` = unavailable with explicit guidance

| Entry Surface | Realtime triage | File history | Management mutations | Diagnostics export | Persistent latest action |
|---|---|---|---|---|---|
| `/logs` realtime tab | Y | H (tab switch) | Y (context rail) / N (web runtime) | Y (context rail) | Y (`LogStatsStrip`) |
| `/logs` files tab | H (tab switch) | Y | Y (file-list actions + rail) / N (web runtime) | Y (context rail) | Y (`LogStatsStrip`) |
| `/logs` management tab (narrow layout) | H | H | Y (desktop) / N (web runtime) | Y (desktop/web guidance) | Y (`LogStatsStrip`) |
| `LogDrawer` | Y | H (open `/logs` with route context) | H (open `/logs`) | H (open `/logs`) | H (open `/logs`) |

## 3. Gap List and Priority

### P0 (fixed in current change)

1. Drawer-to-page context handoff was missing.
- Symptom: quick-entry triage state could not continue in `/logs`.
- Fix seam: `components/log/log-drawer.tsx`, `lib/log-workspace.ts`, `app/logs/page.tsx`.

2. Non-desktop runtime management capability was effectively hidden on `/logs`.
- Symptom: management section silently disappeared in contextual rail.
- Fix seam: `app/logs/page.tsx` explicit unavailable management card.

3. Failed management/delete operations did not always emit persistent workspace action summary.
- Symptom: some failures only surfaced as transient toast.
- Fix seam: `app/logs/page.tsx` normalized failed summary write to `lastMutationSummary`.

### P1 (stabilized in current change)

4. Route-context contract lived ad-hoc in UI surfaces.
- Symptom: risk of duplicated query encoding logic.
- Fix seam: `lib/log-workspace.ts` shared route context build/parse helpers.

### P2 (monitor)

5. Cross-entry regression guard needed stronger tests around route hydration and runtime guidance.
- Fix seam: `app/logs/page.test.tsx`, `components/log/log-drawer.test.tsx`, `lib/log-workspace.test.ts`.

## 4. Layering Contract (Code Norms)

- Presentation layer (`components/log/*`) should not call Tauri bridges directly.
- Orchestration layer (`app/logs/page.tsx`, `components/providers/log-provider.tsx`) owns runtime branching and mutation feedback composition.
- Action/state layer (`hooks/use-logs.ts`, `lib/stores/log.ts`) owns command wrappers, normalization, and persistent state.
- Shared derivation/route contract (`lib/log-workspace.ts`) owns overview summarization and cross-entry context serialization.
