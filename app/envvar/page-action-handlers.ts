import type {
  EnvFileFormat,
  EnvVarExportResult,
  EnvVarImportPreview,
  EnvVarImportResult,
  EnvVarPathRepairPreview,
  EnvVarScope,
} from '@/types/tauri';
import { resolveRefreshScope, type EnvVarAction } from './page-helpers';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

interface ActionContext {
  setActionError: (message: string | null) => void;
  setActionNotice: (message: string | null) => void;
  setActiveAction: (action: EnvVarAction | null) => void;
  formatActionError: (action: EnvVarAction, message: string) => string;
  t: TranslateFn;
}

interface ToastApi {
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
}

type BasicMutationResult =
  | boolean
  | { success: boolean; status: string; message?: string | null; removedCount?: number | null }
  | null;

export async function handleScopeFilterChangeAction({
  scope,
  refreshVariables,
  setScopeFilter,
  setActionError,
  setActionNotice,
  setActiveAction,
}: {
  scope: EnvVarScope | 'all';
  refreshVariables: (scope: EnvVarScope | 'all', options?: { forceRefresh?: boolean }) => Promise<unknown>;
  setScopeFilter: (scope: EnvVarScope | 'all') => void;
  setActionError: (message: string | null) => void;
  setActionNotice: (message: string | null) => void;
  setActiveAction: (action: EnvVarAction | null) => void;
}): Promise<void> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('refresh');
  setScopeFilter(scope);
  try {
    await refreshVariables(scope);
  } catch (err) {
    setActionError(err instanceof Error ? err.message : String(err));
  } finally {
    setActiveAction(null);
  }
}

export async function handleRefreshAction({
  scopeFilter,
  refreshVariables,
  setActionError,
  setActionNotice,
  setActiveAction,
}: {
  scopeFilter: EnvVarScope | 'all';
  refreshVariables: (scope: EnvVarScope | 'all', options?: { forceRefresh?: boolean }) => Promise<unknown>;
  setActionError: (message: string | null) => void;
  setActionNotice: (message: string | null) => void;
  setActiveAction: (action: EnvVarAction | null) => void;
}): Promise<void> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('refresh');
  try {
    await refreshVariables(scopeFilter, { forceRefresh: true });
  } catch (err) {
    setActionError(err instanceof Error ? err.message : String(err));
  } finally {
    setActiveAction(null);
  }
}

export async function runVarMutationAction({
  action,
  scope,
  mutate,
  successMessage,
  scopeFilter,
  refreshVariables,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  action: EnvVarAction;
  scope: EnvVarScope;
  mutate: () => Promise<BasicMutationResult>;
  successMessage: string;
  scopeFilter: EnvVarScope | 'all';
  refreshVariables: (scope: EnvVarScope | 'all', options?: { forceRefresh?: boolean }) => Promise<unknown>;
  toastApi: ToastApi;
} & ActionContext): Promise<boolean> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction(action);
  try {
    const result = await mutate();
    if (result == null) {
      setActionError(formatActionError(action, t('common.error')));
      return false;
    }

    const normalized = typeof result === 'boolean'
      ? { success: result, status: result ? 'verified' : 'verification_failed', message: null }
      : result;

    if (!normalized.success) {
      setActionError(formatActionError(action, normalized.message || t('envvar.workflow.verificationFailed')));
      return false;
    }

    await refreshVariables(resolveRefreshScope(scopeFilter, scope), { forceRefresh: true });

    if (normalized.status === 'manual_followup_required') {
      const message = normalized.message || t('envvar.workflow.manualFollowup');
      setActionNotice(message);
      toastApi.warning(message);
    } else {
      toastApi.success(successMessage);
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setActionError(formatActionError(action, message));
    toastApi.error(message);
    return false;
  } finally {
    setActiveAction(null);
  }
}

export async function runPathMutationAction({
  action,
  mutation,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  action: EnvVarAction;
  mutation: () => Promise<BasicMutationResult>;
} & ActionContext): Promise<boolean> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction(action);
  try {
    const result = await mutation();
    if (result == null) {
      setActionError(formatActionError(action, t('common.error')));
      return false;
    }

    const normalized = typeof result === 'boolean'
      ? { success: result, status: result ? 'verified' : 'verification_failed', message: null }
      : result;

    if (!normalized.success) {
      setActionError(formatActionError(action, normalized.message || t('envvar.workflow.verificationFailed')));
      return false;
    }

    if (normalized.status === 'manual_followup_required') {
      setActionNotice(normalized.message || t('envvar.workflow.manualFollowup'));
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setActionError(formatActionError(action, message));
    return false;
  } finally {
    setActiveAction(null);
  }
}

export async function handlePathDeduplicateAction({
  pathScope,
  deduplicatePath,
  setActionError,
  setActionNotice,
  setActiveAction,
  t,
}: {
  pathScope: EnvVarScope;
  deduplicatePath: (scope: EnvVarScope) => Promise<{ status?: string; message?: string | null; removedCount?: number | null } | null>;
  setActionError: (message: string | null) => void;
  setActionNotice: (message: string | null) => void;
  setActiveAction: (action: EnvVarAction | null) => void;
  t: TranslateFn;
}): Promise<number> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('path-deduplicate');
  try {
    const result = await deduplicatePath(pathScope);
    if (result?.status === 'manual_followup_required') {
      setActionNotice(result.message || t('envvar.workflow.manualFollowup'));
    }
    return result?.removedCount ?? 0;
  } catch (err) {
    setActionError(err instanceof Error ? err.message : String(err));
    return 0;
  } finally {
    setActiveAction(null);
  }
}

export async function handlePreviewImportAction({
  content,
  scope,
  previewImportEnvFile,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  content: string;
  scope: EnvVarScope;
  previewImportEnvFile: (content: string, scope: EnvVarScope) => Promise<EnvVarImportPreview | null>;
} & ActionContext): Promise<EnvVarImportPreview | null> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('import-preview');
  try {
    const preview = await previewImportEnvFile(content, scope);
    if (!preview) {
      setActionError(formatActionError('import-preview', t('common.error')));
    }
    return preview;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setActionError(formatActionError('import-preview', message));
    return null;
  } finally {
    setActiveAction(null);
  }
}

export async function handleApplyImportPreviewAction({
  content,
  scope,
  fingerprint,
  importPreviewStale,
  applyImportPreview,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  content: string;
  scope: EnvVarScope;
  fingerprint: string;
  importPreviewStale: boolean;
  applyImportPreview: (content: string, scope: EnvVarScope, fingerprint: string) => Promise<EnvVarImportResult | null>;
} & ActionContext): Promise<EnvVarImportResult | null> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('import');
  try {
    const result = await applyImportPreview(content, scope, fingerprint);
    if (!result) {
      const message = importPreviewStale ? t('envvar.importExport.previewStale') : t('common.error');
      setActionError(formatActionError('import', message));
    } else if (result.status === 'manual_followup_required') {
      setActionNotice(result.message || t('envvar.workflow.manualFollowup'));
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setActionError(formatActionError('import', message));
    return null;
  } finally {
    setActiveAction(null);
  }
}

export async function handlePreviewPathRepairAction({
  pathScope,
  previewPathRepair,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  pathScope: EnvVarScope;
  previewPathRepair: (scope: EnvVarScope) => Promise<EnvVarPathRepairPreview | null>;
} & ActionContext): Promise<EnvVarPathRepairPreview | null> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('path-repair');
  try {
    const preview = await previewPathRepair(pathScope);
    if (!preview) {
      setActionError(formatActionError('path-repair', t('common.error')));
    }
    return preview;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setActionError(formatActionError('path-repair', message));
    return null;
  } finally {
    setActiveAction(null);
  }
}

export async function handleApplyPathRepairAction({
  fingerprint,
  pathScope,
  pathRepairPreviewStale,
  applyPathRepair,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  fingerprint: string;
  pathScope: EnvVarScope;
  pathRepairPreviewStale: boolean;
  applyPathRepair: (scope: EnvVarScope, fingerprint: string) => Promise<{ removedCount?: number | null; status?: string; message?: string | null } | null>;
} & ActionContext): Promise<number | null> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('path-repair');
  try {
    const result = await applyPathRepair(pathScope, fingerprint);
    if (result === null) {
      const message = pathRepairPreviewStale ? t('envvar.pathEditor.repairPreviewStale') : t('common.error');
      setActionError(formatActionError('path-repair', message));
    } else if (result.status === 'manual_followup_required') {
      setActionNotice(result.message || t('envvar.workflow.manualFollowup'));
    }
    return result?.removedCount ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setActionError(formatActionError('path-repair', message));
    return null;
  } finally {
    setActiveAction(null);
  }
}

export async function handleResolveConflictAction({
  key,
  sourceScope,
  targetScope,
  resolveConflict,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  key: string;
  sourceScope: EnvVarScope;
  targetScope: EnvVarScope;
  resolveConflict: (key: string, sourceScope: EnvVarScope, targetScope: EnvVarScope) => Promise<{ status?: string; message?: string | null } | null>;
  toastApi: ToastApi;
} & ActionContext): Promise<boolean> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('conflict-resolve');
  try {
    const result = await resolveConflict(key, sourceScope, targetScope);
    if (!result) {
      setActionError(formatActionError('conflict-resolve', t('common.error')));
      return false;
    }
    if (result.status === 'manual_followup_required') {
      setActionNotice(result.message || t('envvar.workflow.manualFollowup'));
    } else {
      toastApi.success(t('common.saved'));
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setActionError(formatActionError('conflict-resolve', message));
    return false;
  } finally {
    setActiveAction(null);
  }
}

export async function handleImportAction({
  content,
  scope,
  scopeFilter,
  importEnvFile,
  refreshVariables,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  content: string;
  scope: EnvVarScope;
  scopeFilter: EnvVarScope | 'all';
  importEnvFile: (content: string, scope: EnvVarScope) => Promise<EnvVarImportResult | null>;
  refreshVariables: (scope: EnvVarScope | 'all', options?: { forceRefresh?: boolean }) => Promise<unknown>;
} & ActionContext): Promise<EnvVarImportResult | null> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('import');
  try {
    const result = await importEnvFile(content, scope);
    if (result?.success) {
      await refreshVariables(resolveRefreshScope(scopeFilter, scope), { forceRefresh: true });
      if (result.status === 'manual_followup_required') {
        setActionNotice(result.message || t('envvar.workflow.manualFollowup'));
      }
    } else {
      setActionError(formatActionError('import', result?.message || t('envvar.workflow.verificationFailed')));
    }
    return result;
  } catch (err) {
    setActionError(formatActionError('import', err instanceof Error ? err.message : String(err)));
    return null;
  } finally {
    setActiveAction(null);
  }
}

export async function handleExportAction({
  scope,
  format,
  includeSensitive = false,
  exportEnvFile,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  scope: EnvVarScope;
  format: EnvFileFormat;
  includeSensitive?: boolean;
  exportEnvFile: (scope: EnvVarScope, format: EnvFileFormat, includeSensitive?: boolean) => Promise<EnvVarExportResult | null>;
} & ActionContext): Promise<EnvVarExportResult | null> {
  setActionError(null);
  setActionNotice(null);
  setActiveAction('export');
  try {
    const result = await exportEnvFile(scope, format, includeSensitive);
    if (!result) {
      setActionError(formatActionError('export', t('common.error')));
    }
    return result;
  } catch (err) {
    setActionError(formatActionError('export', err instanceof Error ? err.message : String(err)));
    return null;
  } finally {
    setActiveAction(null);
  }
}

export function createScopeFilterChangeHandler(args: Omit<Parameters<typeof handleScopeFilterChangeAction>[0], 'scope'>) {
  return (scope: EnvVarScope | 'all') => handleScopeFilterChangeAction({ ...args, scope });
}

export function createVarMutationHandler(
  args: Omit<Parameters<typeof runVarMutationAction>[0], 'action' | 'scope' | 'mutate' | 'successMessage'>,
) {
  return (
    action: EnvVarAction,
    scope: EnvVarScope,
    mutate: () => Promise<BasicMutationResult>,
    successMessage: string,
  ) => runVarMutationAction({ ...args, action, scope, mutate, successMessage });
}

export function createRefreshHandler(args: Parameters<typeof handleRefreshAction>[0]) {
  return () => handleRefreshAction(args);
}

export function createPathMutationHandler(
  args: Omit<Parameters<typeof runPathMutationAction>[0], 'action' | 'mutation'>,
) {
  return (
    action: EnvVarAction,
    mutation: () => Promise<BasicMutationResult>,
  ) => runPathMutationAction({ ...args, action, mutation });
}

export function createPathDeduplicateHandler(args: Parameters<typeof handlePathDeduplicateAction>[0]) {
  return () => handlePathDeduplicateAction(args);
}

export function createPreviewImportHandler(
  args: Omit<Parameters<typeof handlePreviewImportAction>[0], 'content' | 'scope'>,
) {
  return (content: string, scope: EnvVarScope) => handlePreviewImportAction({ ...args, content, scope });
}

export function createApplyImportPreviewHandler(
  args: Omit<Parameters<typeof handleApplyImportPreviewAction>[0], 'content' | 'scope' | 'fingerprint'>,
) {
  return (content: string, scope: EnvVarScope, fingerprint: string) => handleApplyImportPreviewAction({
    ...args,
    content,
    scope,
    fingerprint,
  });
}

export function createPreviewPathRepairHandler(args: Parameters<typeof handlePreviewPathRepairAction>[0]) {
  return () => handlePreviewPathRepairAction(args);
}

export function createApplyPathRepairHandler(
  args: Omit<Parameters<typeof handleApplyPathRepairAction>[0], 'fingerprint'>,
) {
  return (fingerprint: string) => handleApplyPathRepairAction({ ...args, fingerprint });
}

export function createResolveConflictHandler(
  args: Omit<Parameters<typeof handleResolveConflictAction>[0], 'key' | 'sourceScope' | 'targetScope'>,
) {
  return (key: string, sourceScope: EnvVarScope, targetScope: EnvVarScope) => handleResolveConflictAction({
    ...args,
    key,
    sourceScope,
    targetScope,
  });
}

export function createImportHandler(
  args: Omit<Parameters<typeof handleImportAction>[0], 'content' | 'scope'>,
) {
  return (content: string, scope: EnvVarScope) => handleImportAction({ ...args, content, scope });
}

export function createExportHandler(
  args: Omit<Parameters<typeof handleExportAction>[0], 'scope' | 'format' | 'includeSensitive'>,
) {
  return (scope: EnvVarScope, format: EnvFileFormat, includeSensitive = false) => handleExportAction({
    ...args,
    scope,
    format,
    includeSensitive,
  });
}
