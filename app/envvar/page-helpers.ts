import type { EnvVarRow } from '@/lib/envvar';
import type { EnvVarDetectionState } from '@/hooks/use-envvar';
import type { EnvVarActionSupport, EnvVarScope, EnvVarSupportSnapshot } from '@/types/tauri';

export type EnvVarAction =
  | 'refresh'
  | 'add'
  | 'edit'
  | 'delete'
  | 'import'
  | 'import-preview'
  | 'export'
  | 'conflict-resolve'
  | 'path-add'
  | 'path-remove'
  | 'path-reorder'
  | 'path-deduplicate'
  | 'path-repair';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function getSupportForAction(
  supportSnapshot: EnvVarSupportSnapshot | null,
  action: string,
  scope: EnvVarScope | 'all',
): EnvVarActionSupport | null {
  if (!supportSnapshot) return null;

  const exact = supportSnapshot.actions.find(
    (item) => item.action === action && item.scope === scope,
  );
  if (exact) return exact;

  if (scope === 'all') {
    return supportSnapshot.actions.find((item) => item.action === action && !item.supported)
      ?? supportSnapshot.actions.find((item) => item.action === action)
      ?? null;
  }

  return supportSnapshot.actions.find((item) => item.action === action && item.scope == null) ?? null;
}

export function resolveRefreshScope(
  scopeFilter: EnvVarScope | 'all',
  scope: EnvVarScope,
): EnvVarScope | 'all' {
  if (scopeFilter === 'all') return 'all';
  return scope;
}

export function getActionLabel(action: EnvVarAction, t: TranslateFn): string {
  switch (action) {
    case 'refresh':
      return t('envvar.actions.refresh');
    case 'add':
      return t('envvar.actions.add');
    case 'edit':
      return t('envvar.actions.edit');
    case 'delete':
      return t('envvar.actions.delete');
    case 'import':
      return t('envvar.importExport.import');
    case 'import-preview':
      return t('envvar.importExport.preview');
    case 'export':
      return t('envvar.importExport.export');
    case 'conflict-resolve':
      return t('envvar.conflicts.resolve');
    case 'path-add':
      return t('envvar.pathEditor.add');
    case 'path-remove':
      return t('envvar.pathEditor.remove');
    case 'path-reorder':
      return t('envvar.pathEditor.title');
    case 'path-deduplicate':
      return t('envvar.pathEditor.deduplicate');
    case 'path-repair':
      return t('envvar.pathEditor.applyRepair');
    default:
      return t('common.error');
  }
}

export function getDetectionStatusText(
  detectionState: EnvVarDetectionState,
  detectionFromCache: boolean,
  t: TranslateFn,
): string {
  switch (detectionState) {
    case 'loading-no-cache':
      return t('envvar.detection.loading');
    case 'showing-cache-refreshing':
      return t('envvar.detection.cacheRefreshing');
    case 'showing-fresh':
      return t('envvar.detection.fresh');
    case 'empty':
      return t('envvar.detection.empty');
    case 'error':
      return detectionFromCache
        ? t('envvar.detection.errorWithCache')
        : t('envvar.detection.error');
    case 'idle':
    default:
      return t('envvar.detection.idle');
  }
}

export function getFilteredRowCount(envRows: EnvVarRow[], searchQuery: string): number {
  if (!searchQuery) return envRows.length;
  const q = searchQuery.toLowerCase();
  return envRows.filter(
    (row) => row.key.toLowerCase().includes(q) || row.value.toLowerCase().includes(q),
  ).length;
}
