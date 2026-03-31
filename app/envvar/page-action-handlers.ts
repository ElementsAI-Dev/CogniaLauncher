import type {
  EnvFileFormat,
  EnvVarExportResult,
  EnvVarImportPreview,
  EnvVarImportResult,
  EnvVarPathRepairPreview,
  EnvVarScope,
  EnvVarSnapshotRestoreResult,
} from '@/types/tauri';
import { resolveRefreshScope, type EnvVarAction } from './page-helpers';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

interface ToastApi {
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
}

interface ActionContext {
  setActiveAction: (action: EnvVarAction | null) => void;
  toastApi?: ToastApi;
  setActionError?: (message: string | null) => void;
  setActionNotice?: (message: string | null) => void;
  formatActionError: (action: EnvVarAction, message: string) => string;
  t: TranslateFn;
}

type BasicMutationResult =
  | boolean
  | { success: boolean; status: string; message?: string | null; removedCount?: number | null }
  | null;

function clearActionFeedback({
  setActionError,
  setActionNotice,
}: Pick<ActionContext, 'setActionError' | 'setActionNotice'>) {
  setActionError?.(null);
  setActionNotice?.(null);
}

function reportActionError(
  message: string,
  {
    toastApi,
    setActionError,
    setActionNotice,
  }: Pick<ActionContext, 'toastApi' | 'setActionError' | 'setActionNotice'>,
) {
  setActionNotice?.(null);
  setActionError?.(message);
  toastApi?.error(message);
}

function reportActionNotice(
  message: string,
  {
    toastApi,
    setActionError,
    setActionNotice,
  }: Pick<ActionContext, 'toastApi' | 'setActionError' | 'setActionNotice'>,
  level: 'success' | 'warning' = 'warning',
) {
  setActionError?.(null);
  setActionNotice?.(message);
  if (level === 'success') {
    toastApi?.success(message);
    return;
  }
  toastApi?.warning(message);
}

export async function handleScopeFilterChangeAction({
  scope,
  refreshVariables,
  setScopeFilter,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
}: {
  scope: EnvVarScope | 'all';
  refreshVariables: (scope: EnvVarScope | 'all', options?: { forceRefresh?: boolean }) => Promise<unknown>;
  setScopeFilter: (scope: EnvVarScope | 'all') => void;
  toastApi?: ToastApi;
  setActionError?: (message: string | null) => void;
  setActionNotice?: (message: string | null) => void;
  setActiveAction: (action: EnvVarAction | null) => void;
}): Promise<void> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('refresh');
  setScopeFilter(scope);
  try {
    await refreshVariables(scope);
  } catch (err) {
    reportActionError(err instanceof Error ? err.message : String(err), {
      toastApi,
      setActionError,
      setActionNotice,
    });
  } finally {
    setActiveAction(null);
  }
}

export async function handleRefreshAction({
  scopeFilter,
  refreshVariables,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
}: {
  scopeFilter: EnvVarScope | 'all';
  refreshVariables: (scope: EnvVarScope | 'all', options?: { forceRefresh?: boolean }) => Promise<unknown>;
  toastApi?: ToastApi;
  setActionError?: (message: string | null) => void;
  setActionNotice?: (message: string | null) => void;
  setActiveAction: (action: EnvVarAction | null) => void;
}): Promise<void> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('refresh');
  try {
    await refreshVariables(scopeFilter, { forceRefresh: true });
  } catch (err) {
    reportActionError(err instanceof Error ? err.message : String(err), {
      toastApi,
      setActionError,
      setActionNotice,
    });
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
} & ActionContext): Promise<boolean> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction(action);
  try {
    const result = await mutate();
    if (result == null) {
      reportActionError(formatActionError(action, t('common.error')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
      return false;
    }

    const normalized = typeof result === 'boolean'
      ? { success: result, status: result ? 'verified' : 'verification_failed', message: null }
      : result;

    if (!normalized.success) {
      reportActionError(formatActionError(action, normalized.message || t('envvar.workflow.verificationFailed')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
      return false;
    }

    await refreshVariables(resolveRefreshScope(scopeFilter, scope), { forceRefresh: true });

    if (normalized.status === 'manual_followup_required') {
      const message = normalized.message || t('envvar.workflow.manualFollowup');
      reportActionNotice(message, { toastApi, setActionError, setActionNotice });
    } else {
      clearActionFeedback({ setActionError, setActionNotice });
      toastApi?.success(successMessage);
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportActionError(formatActionError(action, message), {
      toastApi,
      setActionError,
      setActionNotice,
    });
    return false;
  } finally {
    setActiveAction(null);
  }
}

export async function runPathMutationAction({
  action,
  mutation,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  action: EnvVarAction;
  mutation: () => Promise<BasicMutationResult>;
} & ActionContext): Promise<boolean> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction(action);
  try {
    const result = await mutation();
    if (result == null) {
      reportActionError(formatActionError(action, t('common.error')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
      return false;
    }

    const normalized = typeof result === 'boolean'
      ? { success: result, status: result ? 'verified' : 'verification_failed', message: null }
      : result;

    if (!normalized.success) {
      reportActionError(formatActionError(action, normalized.message || t('envvar.workflow.verificationFailed')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
      return false;
    }

    if (normalized.status === 'manual_followup_required') {
      reportActionNotice(normalized.message || t('envvar.workflow.manualFollowup'), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportActionError(formatActionError(action, message), {
      toastApi,
      setActionError,
      setActionNotice,
    });
    return false;
  } finally {
    setActiveAction(null);
  }
}

export async function handlePathDeduplicateAction({
  pathScope,
  deduplicatePath,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
  t,
}: {
  pathScope: EnvVarScope;
  deduplicatePath: (scope: EnvVarScope) => Promise<{ status?: string; message?: string | null; removedCount?: number | null } | null>;
  toastApi?: ToastApi;
  setActionError?: (message: string | null) => void;
  setActionNotice?: (message: string | null) => void;
  setActiveAction: (action: EnvVarAction | null) => void;
  t: TranslateFn;
}): Promise<number> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('path-deduplicate');
  try {
    const result = await deduplicatePath(pathScope);
    if (result?.status === 'manual_followup_required') {
      reportActionNotice(result.message || t('envvar.workflow.manualFollowup'), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    }
    return result?.removedCount ?? 0;
  } catch (err) {
    reportActionError(err instanceof Error ? err.message : String(err), {
      toastApi,
      setActionError,
      setActionNotice,
    });
    return 0;
  } finally {
    setActiveAction(null);
  }
}

export async function handlePreviewImportAction({
  content,
  scope,
  previewImportEnvFile,
  beforeAction,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  content: string;
  scope: EnvVarScope;
  previewImportEnvFile: (content: string, scope: EnvVarScope) => Promise<EnvVarImportPreview | null>;
  beforeAction?: (scope: EnvVarScope) => Promise<unknown> | unknown;
} & ActionContext): Promise<EnvVarImportPreview | null> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('import-preview');
  try {
    await beforeAction?.(scope);
    const preview = await previewImportEnvFile(content, scope);
    if (!preview) {
      reportActionError(formatActionError('import-preview', t('common.error')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    }
    return preview;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportActionError(formatActionError('import-preview', message), {
      toastApi,
      setActionError,
      setActionNotice,
    });
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
  beforeAction,
  toastApi,
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
  beforeAction?: (scope: EnvVarScope) => Promise<unknown> | unknown;
} & ActionContext): Promise<EnvVarImportResult | null> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('import');
  try {
    await beforeAction?.(scope);
    const result = await applyImportPreview(content, scope, fingerprint);
    if (!result) {
      const message = importPreviewStale ? t('envvar.importExport.previewStale') : t('common.error');
      reportActionError(formatActionError('import', message), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    } else if (result.status === 'manual_followup_required') {
      reportActionNotice(result.message || t('envvar.workflow.manualFollowup'), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportActionError(formatActionError('import', message), {
      toastApi,
      setActionError,
      setActionNotice,
    });
    return null;
  } finally {
    setActiveAction(null);
  }
}

export async function handlePreviewPathRepairAction({
  pathScope,
  previewPathRepair,
  beforeAction,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  pathScope: EnvVarScope;
  previewPathRepair: (scope: EnvVarScope) => Promise<EnvVarPathRepairPreview | null>;
  beforeAction?: (scope: EnvVarScope) => Promise<unknown> | unknown;
} & ActionContext): Promise<EnvVarPathRepairPreview | null> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('path-repair');
  try {
    await beforeAction?.(pathScope);
    const preview = await previewPathRepair(pathScope);
    if (!preview) {
      reportActionError(formatActionError('path-repair', t('common.error')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    }
    return preview;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportActionError(formatActionError('path-repair', message), {
      toastApi,
      setActionError,
      setActionNotice,
    });
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
  beforeAction,
  toastApi,
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
  beforeAction?: (scope: EnvVarScope) => Promise<unknown> | unknown;
} & ActionContext): Promise<number | null> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('path-repair');
  try {
    await beforeAction?.(pathScope);
    const result = await applyPathRepair(pathScope, fingerprint);
    if (result === null) {
      const message = pathRepairPreviewStale ? t('envvar.pathEditor.repairPreviewStale') : t('common.error');
      reportActionError(formatActionError('path-repair', message), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    } else if (result.status === 'manual_followup_required') {
      reportActionNotice(result.message || t('envvar.workflow.manualFollowup'), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    }
    return result?.removedCount ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportActionError(formatActionError('path-repair', message), {
      toastApi,
      setActionError,
      setActionNotice,
    });
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
  beforeAction,
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
  beforeAction?: (targetScope: EnvVarScope) => Promise<unknown> | unknown;
} & ActionContext): Promise<boolean> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('conflict-resolve');
  try {
    await beforeAction?.(targetScope);
    const result = await resolveConflict(key, sourceScope, targetScope);
    if (!result) {
      reportActionError(formatActionError('conflict-resolve', t('common.error')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
      return false;
    }
    if (result.status === 'manual_followup_required') {
      reportActionNotice(result.message || t('envvar.workflow.manualFollowup'), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    } else {
      clearActionFeedback({ setActionError, setActionNotice });
      toastApi?.success(t('common.saved'));
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportActionError(formatActionError('conflict-resolve', message), {
      toastApi,
      setActionError,
      setActionNotice,
    });
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
  beforeAction,
  toastApi,
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
  beforeAction?: (scope: EnvVarScope) => Promise<unknown> | unknown;
} & ActionContext): Promise<EnvVarImportResult | null> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('import');
  try {
    await beforeAction?.(scope);
    const result = await importEnvFile(content, scope);
    if (result?.success) {
      await refreshVariables(resolveRefreshScope(scopeFilter, scope), { forceRefresh: true });
      if (result.status === 'manual_followup_required') {
        reportActionNotice(result.message || t('envvar.workflow.manualFollowup'), {
          toastApi,
          setActionError,
          setActionNotice,
        });
      } else {
        clearActionFeedback({ setActionError, setActionNotice });
      }
    } else {
      reportActionError(formatActionError('import', result?.message || t('envvar.workflow.verificationFailed')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    }
    return result;
  } catch (err) {
    reportActionError(formatActionError('import', err instanceof Error ? err.message : String(err)), {
      toastApi,
      setActionError,
      setActionNotice,
    });
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
  toastApi,
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
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('export');
  try {
    const result = await exportEnvFile(scope, format, includeSensitive);
    if (!result) {
      reportActionError(formatActionError('export', t('common.error')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
    }
    return result;
  } catch (err) {
    reportActionError(formatActionError('export', err instanceof Error ? err.message : String(err)), {
      toastApi,
      setActionError,
      setActionNotice,
    });
    return null;
  } finally {
    setActiveAction(null);
  }
}

export async function handleRestoreSnapshotAction({
  snapshotPath,
  scopes = [],
  previewFingerprint,
  restoreSnapshot,
  afterRestore,
  toastApi,
  setActionError,
  setActionNotice,
  setActiveAction,
  formatActionError,
  t,
}: {
  snapshotPath: string;
  scopes?: EnvVarScope[];
  previewFingerprint?: string;
  restoreSnapshot: (
    snapshotPath: string,
    scopes?: EnvVarScope[],
    previewFingerprint?: string,
  ) => Promise<EnvVarSnapshotRestoreResult | null>;
  afterRestore?: (
    result: EnvVarSnapshotRestoreResult,
  ) => Promise<unknown> | unknown;
} & ActionContext): Promise<EnvVarSnapshotRestoreResult | null> {
  clearActionFeedback({ setActionError, setActionNotice });
  setActiveAction('snapshot-restore');
  try {
    const result = await restoreSnapshot(
      snapshotPath,
      scopes.length > 0 ? scopes : undefined,
      previewFingerprint,
    );
    if (!result) {
      reportActionError(formatActionError('snapshot-restore', t('common.error')), {
        toastApi,
        setActionError,
        setActionNotice,
      });
      return null;
    }

    if (!result.success) {
      reportActionError(
        formatActionError('snapshot-restore', result.message || t('envvar.workflow.verificationFailed')),
        {
          toastApi,
          setActionError,
          setActionNotice,
        },
      );
      return result;
    }

    await afterRestore?.(result);
    const notice = result.message || t('envvar.snapshots.restoreComplete');
    reportActionNotice(
      notice,
      { toastApi, setActionError, setActionNotice },
      result.message ? 'warning' : 'success',
    );
    return result;
  } catch (err) {
    reportActionError(
      formatActionError('snapshot-restore', err instanceof Error ? err.message : String(err)),
      {
        toastApi,
        setActionError,
        setActionNotice,
      },
    );
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

export function createRestoreSnapshotHandler(
  args: Omit<Parameters<typeof handleRestoreSnapshotAction>[0], 'snapshotPath' | 'scopes' | 'previewFingerprint'>,
) {
  return (snapshotPath: string, scopes: EnvVarScope[] = [], previewFingerprint?: string) => handleRestoreSnapshotAction({
    ...args,
    snapshotPath,
    scopes,
    previewFingerprint,
  });
}
