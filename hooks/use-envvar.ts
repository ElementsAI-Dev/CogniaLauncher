'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import type {
  EnvVarScope,
  EnvFileFormat,
  EnvVarActionSupport,
  EnvVarSupportSnapshot,
  EnvVarSummary,
  EnvVarShellProfileReadResult,
  EnvVarExportResult,
  EnvVarMutationResult,
  EnvVarPathMutationResult,
  PathEntryInfo,
  ShellProfileInfo,
  EnvVarImportResult,
  EnvVarImportPreview,
  EnvVarPathRepairPreview,
  EnvVarShellGuidance,
  PersistentEnvVar,
  EnvVarConflict,
  EnvVarConflictResolutionResult,
} from '@/types/tauri';

export type EnvVarDetectionState =
  | 'idle'
  | 'loading-no-cache'
  | 'showing-cache-refreshing'
  | 'showing-fresh'
  | 'empty'
  | 'error';

export type EnvVarDetectionScope = EnvVarScope | 'all';

interface EnvVarDetectionSnapshot {
  scope: EnvVarDetectionScope;
  processVarSummaries: EnvVarSummary[];
  userPersistentVarSummaries: EnvVarSummary[];
  systemPersistentVarSummaries: EnvVarSummary[];
  conflicts: EnvVarConflict[];
  fetchedAt: number;
}

const detectionCache = new Map<EnvVarDetectionScope, EnvVarDetectionSnapshot>();

function resolveCacheKeysForInvalidation(scope: EnvVarDetectionScope): EnvVarDetectionScope[] {
  if (scope === 'all') {
    return ['all', 'process', 'user', 'system'];
  }
  return [scope, 'all'];
}

function isSnapshotEmpty(snapshot: EnvVarDetectionSnapshot, scope: EnvVarDetectionScope): boolean {
  switch (scope) {
    case 'process':
      return snapshot.processVarSummaries.length === 0;
    case 'user':
      return snapshot.userPersistentVarSummaries.length === 0;
    case 'system':
      return snapshot.systemPersistentVarSummaries.length === 0;
    case 'all':
    default:
      return (
        snapshot.processVarSummaries.length === 0
        && snapshot.userPersistentVarSummaries.length === 0
        && snapshot.systemPersistentVarSummaries.length === 0
        && snapshot.conflicts.length === 0
      );
  }
}

interface EnvVarState {
  envVars: Record<string, string>;
  processVarSummaries: EnvVarSummary[];
  persistentVars: [string, string][];
  persistentVarsTyped: PersistentEnvVar[];
  userPersistentVarsTyped: PersistentEnvVar[];
  systemPersistentVarsTyped: PersistentEnvVar[];
  userPersistentVarSummaries: EnvVarSummary[];
  systemPersistentVarSummaries: EnvVarSummary[];
  revealedValues: Record<string, string>;
  pathEntries: PathEntryInfo[];
  shellProfiles: ShellProfileInfo[];
  conflicts: EnvVarConflict[];
  importPreview: EnvVarImportPreview | null;
  importPreviewStale: boolean;
  pathRepairPreview: EnvVarPathRepairPreview | null;
  pathRepairPreviewStale: boolean;
  shellGuidance: EnvVarShellGuidance[];
  loading: boolean;
  detectionLoading: boolean;
  pathLoading: boolean;
  importExportLoading: boolean;
  error: string | null;
  detectionState: EnvVarDetectionState;
  detectionFromCache: boolean;
  detectionError: string | null;
  detectionCanRetry: boolean;
  detectionLastUpdated: number | null;
  supportSnapshot: EnvVarSupportSnapshot | null;
  supportLoading: boolean;
  supportError: string | null;
}

function normalizeMutationResult(
  result: EnvVarMutationResult | boolean | undefined,
  key: string,
  scope: EnvVarScope,
  operation: string,
): EnvVarMutationResult {
  if (typeof result === 'object' && result !== null) {
    return result;
  }

  const success = result !== false;
  return {
    operation,
    key,
    scope,
    success,
    verified: success,
    status: success ? 'verified' : 'verification_failed',
    reasonCode: null,
    message: null,
    effectiveValueSummary: null,
    primaryShellTarget: null,
    shellGuidance: [],
  };
}

function normalizePathMutationResult(
  result: EnvVarPathMutationResult | number | boolean | undefined,
  scope: EnvVarScope,
  operation: string,
): EnvVarPathMutationResult {
  if (typeof result === 'object' && result !== null) {
    return result;
  }

  const removedCount = typeof result === 'number' ? result : 0;
  const success = result !== false;
  return {
    operation,
    scope,
    success,
    verified: success,
    status: success ? 'verified' : 'verification_failed',
    reasonCode: null,
    message: null,
    removedCount,
    pathEntries: [],
    primaryShellTarget: null,
    shellGuidance: [],
  };
}

function normalizeImportResult(
  result: EnvVarImportResult | null,
  scope: EnvVarScope,
): EnvVarImportResult | null {
  if (result == null) return null;
  if (typeof result.success === 'boolean') return result;

  return {
    ...result,
    scope,
    success: true,
    verified: true,
    status: 'verified',
    reasonCode: null,
    message: null,
    primaryShellTarget: null,
    shellGuidance: [],
  };
}

function normalizeConflictResult(
  result: EnvVarConflictResolutionResult | null,
): EnvVarConflictResolutionResult | null {
  if (result == null) return null;
  if (typeof result.success === 'boolean') return result;

  return {
    ...result,
    appliedValueSummary: {
      displayValue: result.appliedValue,
      masked: false,
      hasValue: Boolean(result.appliedValue),
      length: result.appliedValue.length,
      isSensitive: false,
      sensitivityReason: null,
    },
    success: true,
    verified: true,
    status: 'verified',
    reasonCode: null,
    message: null,
  };
}

export function useEnvVar() {
  const [state, setState] = useState<EnvVarState>({
    envVars: {},
    processVarSummaries: [],
    persistentVars: [],
    persistentVarsTyped: [],
    userPersistentVarsTyped: [],
    systemPersistentVarsTyped: [],
    userPersistentVarSummaries: [],
    systemPersistentVarSummaries: [],
    revealedValues: {},
    pathEntries: [],
    shellProfiles: [],
    conflicts: [],
    importPreview: null,
    importPreviewStale: false,
    pathRepairPreview: null,
    pathRepairPreviewStale: false,
    shellGuidance: [],
    loading: false,
    detectionLoading: false,
    pathLoading: false,
    importExportLoading: false,
    error: null,
    detectionState: 'idle',
    detectionFromCache: false,
    detectionError: null,
    detectionCanRetry: false,
    detectionLastUpdated: null,
    supportSnapshot: null,
    supportLoading: false,
    supportError: null,
  });

  const stateRef = useRef(state);
  const detectionRequestIdRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setLoading = useCallback((loading: boolean) => {
    setState((s) => ({ ...s, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const invalidateDetectionCache = useCallback((scope: EnvVarDetectionScope = 'all') => {
    for (const cacheKey of resolveCacheKeysForInvalidation(scope)) {
      detectionCache.delete(cacheKey);
    }
  }, []);

  const readFreshDetectionSnapshot = useCallback(async (
    scope: EnvVarDetectionScope,
  ): Promise<EnvVarDetectionSnapshot> => {
    const base = stateRef.current;
    let processVarSummaries = base.processVarSummaries;
    let userPersistentVarSummaries = base.userPersistentVarSummaries;
    let systemPersistentVarSummaries = base.systemPersistentVarSummaries;
    let conflicts = base.conflicts;

    if (scope === 'all') {
      const [allEnvVars, userVars, systemVars, detectedConflicts] = await Promise.all([
        tauri.envvarListProcessSummaries(),
        tauri.envvarListPersistentTypedSummaries('user'),
        tauri.envvarListPersistentTypedSummaries('system'),
        tauri.envvarDetectConflicts(),
      ]);
      processVarSummaries = allEnvVars;
      userPersistentVarSummaries = userVars;
      systemPersistentVarSummaries = systemVars;
      conflicts = detectedConflicts;
    } else if (scope === 'process') {
      processVarSummaries = await tauri.envvarListProcessSummaries();
    } else if (scope === 'user') {
      const [userVars, detectedConflicts] = await Promise.all([
        tauri.envvarListPersistentTypedSummaries('user'),
        tauri.envvarDetectConflicts(),
      ]);
      userPersistentVarSummaries = userVars;
      conflicts = detectedConflicts;
    } else {
      const [systemVars, detectedConflicts] = await Promise.all([
        tauri.envvarListPersistentTypedSummaries('system'),
        tauri.envvarDetectConflicts(),
      ]);
      systemPersistentVarSummaries = systemVars;
      conflicts = detectedConflicts;
    }

    return {
      scope,
      processVarSummaries,
      userPersistentVarSummaries,
      systemPersistentVarSummaries,
      conflicts,
      fetchedAt: Date.now(),
    };
  }, []);

  const loadDetection = useCallback(async (
    scope: EnvVarDetectionScope,
    options?: { forceRefresh?: boolean },
  ): Promise<EnvVarDetectionSnapshot | null> => {
    const forceRefresh = options?.forceRefresh ?? false;
    const cached = forceRefresh ? undefined : detectionCache.get(scope);

    setState((s) => ({
      ...s,
      ...(cached
        ? {
            processVarSummaries: cached.processVarSummaries,
            userPersistentVarSummaries: cached.userPersistentVarSummaries,
            systemPersistentVarSummaries: cached.systemPersistentVarSummaries,
            conflicts: cached.conflicts,
            detectionLastUpdated: cached.fetchedAt,
          }
        : {}),
      loading: !cached,
      detectionLoading: true,
      detectionState: cached ? 'showing-cache-refreshing' : 'loading-no-cache',
      detectionFromCache: Boolean(cached),
      detectionError: null,
      detectionCanRetry: false,
      error: null,
    }));

    const requestId = detectionRequestIdRef.current + 1;
    detectionRequestIdRef.current = requestId;

    try {
      const fresh = await readFreshDetectionSnapshot(scope);
      if (requestId !== detectionRequestIdRef.current) {
        return null;
      }

      detectionCache.set(scope, fresh);
      if (scope !== 'all') {
        detectionCache.delete('all');
      }

      const nextState: EnvVarDetectionState =
        isSnapshotEmpty(fresh, scope) ? 'empty' : 'showing-fresh';

      setState((s) => ({
        ...s,
        processVarSummaries: fresh.processVarSummaries,
        userPersistentVarSummaries: fresh.userPersistentVarSummaries,
        systemPersistentVarSummaries: fresh.systemPersistentVarSummaries,
        conflicts: fresh.conflicts,
        loading: false,
        detectionLoading: false,
        error: null,
        detectionState: nextState,
        detectionFromCache: false,
        detectionError: null,
        detectionCanRetry: nextState === 'empty',
        detectionLastUpdated: fresh.fetchedAt,
      }));

      return fresh;
    } catch (err) {
      if (requestId !== detectionRequestIdRef.current) {
        return null;
      }

      const msg = formatError(err);

      if (cached) {
        setState((s) => ({
          ...s,
          processVarSummaries: cached.processVarSummaries,
          userPersistentVarSummaries: cached.userPersistentVarSummaries,
          systemPersistentVarSummaries: cached.systemPersistentVarSummaries,
          conflicts: cached.conflicts,
          loading: false,
          detectionLoading: false,
          detectionState: 'error',
          detectionFromCache: true,
          detectionError: msg,
          detectionCanRetry: true,
          detectionLastUpdated: cached.fetchedAt,
        }));
        return cached;
      }

      setState((s) => ({
        ...s,
        loading: false,
        detectionLoading: false,
        detectionState: 'error',
        detectionFromCache: false,
        detectionError: msg,
        detectionCanRetry: true,
      }));

      return null;
    }
  }, [readFreshDetectionSnapshot]);

  const isStalePreviewError = useCallback((message: string) => {
    return message.includes('stale_preview');
  }, []);

  const getDetectionRefreshScope = useCallback((scope: EnvVarScope): EnvVarDetectionScope => {
    return scope === 'process' ? 'process' : 'all';
  }, []);

  const refreshAfterScopeMutation = useCallback(async (scope: EnvVarScope) => {
    const refreshScope = getDetectionRefreshScope(scope);
    invalidateDetectionCache(refreshScope);
    await loadDetection(refreshScope, { forceRefresh: true });
  }, [getDetectionRefreshScope, invalidateDetectionCache, loadDetection]);

  const refreshAfterPathMutation = useCallback(async (scope: EnvVarScope) => {
    const pathEntries = await tauri.envvarGetPath(scope);
    setState((s) => ({ ...s, pathEntries }));
    await refreshAfterScopeMutation(scope);
    return pathEntries;
  }, [refreshAfterScopeMutation]);

  const clearImportPreview = useCallback(() => {
    setState((s) => ({ ...s, importPreview: null, importPreviewStale: false }));
  }, []);

  const clearPathRepairPreview = useCallback(() => {
    setState((s) => ({ ...s, pathRepairPreview: null, pathRepairPreviewStale: false }));
  }, []);

  const fetchAllVars = useCallback(async (): Promise<Record<string, string>> => {
    setLoading(true);
    setError(null);
    try {
      const envVars = await tauri.envvarListAll();
      setState((s) => ({ ...s, envVars, loading: false }));
      return envVars;
    } catch (err) {
      const msg = formatError(err);
      setError(msg);
      setLoading(false);
      return {};
    }
  }, [setLoading, setError]);

  const loadSupportSnapshot = useCallback(async (): Promise<EnvVarSupportSnapshot | null> => {
    setState((s) => ({ ...s, supportLoading: true, supportError: null }));
    try {
      const supportSnapshot = await tauri.envvarGetSupportSnapshot();
      setState((s) => ({ ...s, supportSnapshot, supportLoading: false, supportError: null }));
      return supportSnapshot;
    } catch (err) {
      const message = formatError(err);
      setState((s) => ({ ...s, supportLoading: false, supportError: message }));
      return null;
    }
  }, []);

  const getVar = useCallback(async (key: string): Promise<string | null> => {
    try {
      return await tauri.envvarGet(key);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const setVar = useCallback(async (
    key: string,
    value: string,
    scope: EnvVarScope,
  ): Promise<EnvVarMutationResult | null> => {
    setError(null);
    try {
      let rawResult: EnvVarMutationResult | boolean | undefined;
      if (scope === 'process') {
        rawResult = await tauri.envvarSetProcess(key, value);
      } else {
        rawResult = await tauri.envvarSetPersistent(key, value, scope);
      }
      const result = normalizeMutationResult(rawResult, key, scope, 'set');

      if (scope === 'process' && result.success) {
        setState((s) => ({
          ...s,
          envVars: { ...s.envVars, [key]: value },
          revealedValues: {
            ...s.revealedValues,
            [`${scope}:${key}`]: value,
          },
        }));
      }

      if (result.success) {
        invalidateDetectionCache(scope);
      } else if (result.message) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [invalidateDetectionCache, setError]);

  const removeVar = useCallback(async (
    key: string,
    scope: EnvVarScope,
  ): Promise<EnvVarMutationResult | null> => {
    setError(null);
    try {
      let rawResult: EnvVarMutationResult | boolean | undefined;
      if (scope === 'process') {
        rawResult = await tauri.envvarRemoveProcess(key);
      } else {
        rawResult = await tauri.envvarRemovePersistent(key, scope);
      }
      const result = normalizeMutationResult(rawResult, key, scope, 'remove');
      if (scope === 'process' && result.success) {
        setState((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [key]: _removed, ...rest } = s.envVars;
          const nextRevealed = { ...s.revealedValues };
          delete nextRevealed[`${scope}:${key}`];
          return { ...s, envVars: rest, revealedValues: nextRevealed };
        });
      } else if (result.success) {
        setState((s) => {
          const nextRevealed = { ...s.revealedValues };
          delete nextRevealed[`${scope}:${key}`];
          return { ...s, revealedValues: nextRevealed };
        });
      }
      if (result.success) {
        invalidateDetectionCache(scope);
      } else if (result.message) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [invalidateDetectionCache, setError]);

  const fetchPath = useCallback(async (scope: EnvVarScope): Promise<PathEntryInfo[]> => {
    setState((s) => ({ ...s, pathLoading: true }));
    setError(null);
    try {
      const pathEntries = await tauri.envvarGetPath(scope);
      setState((s) => ({ ...s, pathEntries, pathLoading: false }));
      return pathEntries;
    } catch (err) {
      setError(formatError(err));
      setState((s) => ({ ...s, pathLoading: false }));
      return [];
    }
  }, [setError]);

  const addPathEntry = useCallback(async (
    path: string,
    scope: EnvVarScope,
    position?: number,
  ): Promise<EnvVarPathMutationResult | null> => {
    setError(null);
    try {
      const rawResult = await tauri.envvarAddPathEntry(path, scope, position);
      const result = normalizePathMutationResult(rawResult, scope, 'path_add');
      if (result.success) {
        await refreshAfterPathMutation(scope);
      } else if (result.message) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [refreshAfterPathMutation, setError]);

  const removePathEntry = useCallback(async (
    path: string,
    scope: EnvVarScope,
  ): Promise<EnvVarPathMutationResult | null> => {
    setError(null);
    try {
      const rawResult = await tauri.envvarRemovePathEntry(path, scope);
      const result = normalizePathMutationResult(rawResult, scope, 'path_remove');
      if (result.success) {
        await refreshAfterPathMutation(scope);
      } else if (result.message) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [refreshAfterPathMutation, setError]);

  const reorderPath = useCallback(async (
    entries: string[],
    scope: EnvVarScope,
  ): Promise<EnvVarPathMutationResult | null> => {
    setError(null);
    try {
      const rawResult = await tauri.envvarReorderPath(entries, scope);
      const result = normalizePathMutationResult(rawResult, scope, 'path_reorder');
      if (result.success) {
        await refreshAfterPathMutation(scope);
      } else if (result.message) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [refreshAfterPathMutation, setError]);

  const fetchShellProfiles = useCallback(async (): Promise<ShellProfileInfo[]> => {
    setError(null);
    try {
      const shellProfiles = await tauri.envvarListShellProfiles();
      setState((s) => ({ ...s, shellProfiles }));
      return shellProfiles;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setError]);

  const readShellProfile = useCallback(async (path: string): Promise<string | null> => {
    setError(null);
    try {
      const result = await tauri.envvarReadShellProfile(path);
      return result.content;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const readShellProfileResult = useCallback(async (
    path: string,
    includeSensitive = false,
  ): Promise<EnvVarShellProfileReadResult | null> => {
    setError(null);
    try {
      return await tauri.envvarReadShellProfile(path, includeSensitive);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const previewImportEnvFile = useCallback(async (
    content: string,
    scope: EnvVarScope,
  ): Promise<EnvVarImportPreview | null> => {
    setState((s) => ({ ...s, importExportLoading: true, importPreviewStale: false }));
    setError(null);
    try {
      const preview = await tauri.envvarPreviewImportEnvFile(content, scope);
      setState((s) => ({
        ...s,
        importPreview: preview,
        importPreviewStale: false,
        shellGuidance: preview.shellGuidance,
      }));
      return preview;
    } catch (err) {
      setError(formatError(err));
      return null;
    } finally {
      setState((s) => ({ ...s, importExportLoading: false }));
    }
  }, [setError]);

  const applyImportPreview = useCallback(async (
    content: string,
    scope: EnvVarScope,
    fingerprint: string,
  ): Promise<EnvVarImportResult | null> => {
    setState((s) => ({ ...s, importExportLoading: true }));
    setError(null);
    try {
      const rawResult = await tauri.envvarApplyImportPreview(content, scope, fingerprint);
      const result = normalizeImportResult(rawResult, scope);
      if (!result) {
        return null;
      }
      if (result.success) {
        await refreshAfterScopeMutation(scope);
      } else if (result.message) {
        setError(result.message);
      }
      setState((s) => ({
        ...s,
        importPreviewStale: false,
        importPreview: null,
      }));
      return result;
    } catch (err) {
      const message = formatError(err);
      setError(message);
      setState((s) => ({
        ...s,
        importPreviewStale: isStalePreviewError(message),
      }));
      return null;
    } finally {
      setState((s) => ({ ...s, importExportLoading: false }));
    }
  }, [isStalePreviewError, refreshAfterScopeMutation, setError]);

  const importEnvFile = useCallback(async (
    content: string,
    scope: EnvVarScope,
  ): Promise<EnvVarImportResult | null> => {
    setState((s) => ({ ...s, importExportLoading: true }));
    setError(null);
    try {
      const rawResult = await tauri.envvarImportEnvFile(content, scope);
      const result = normalizeImportResult(rawResult, scope);
      if (result && result.success) {
        invalidateDetectionCache(scope);
      } else if (result?.message) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    } finally {
      setState((s) => ({ ...s, importExportLoading: false }));
    }
  }, [invalidateDetectionCache, setError]);

  const exportEnvFile = useCallback(async (
    scope: EnvVarScope,
    format: EnvFileFormat,
    includeSensitive = false,
  ): Promise<EnvVarExportResult | null> => {
    setState((s) => ({ ...s, importExportLoading: true }));
    setError(null);
    try {
      return await tauri.envvarExportEnvFile(scope, format, includeSensitive);
    } catch (err) {
      setError(formatError(err));
      return null;
    } finally {
      setState((s) => ({ ...s, importExportLoading: false }));
    }
  }, [setError]);

  const fetchPersistentVars = useCallback(async (
    scope: EnvVarScope,
  ): Promise<[string, string][]> => {
    setLoading(true);
    setError(null);
    try {
      const persistentVars = await tauri.envvarListPersistent(scope);
      setState((s) => ({ ...s, persistentVars, loading: false }));
      return persistentVars;
    } catch (err) {
      setError(formatError(err));
      setLoading(false);
      return [];
    }
  }, [setLoading, setError]);

  const expandPath = useCallback(async (path: string): Promise<string | null> => {
    try {
      return await tauri.envvarExpand(path);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const deduplicatePath = useCallback(async (
    scope: EnvVarScope,
  ): Promise<EnvVarPathMutationResult | null> => {
    setError(null);
    try {
      const rawResult = await tauri.envvarDeduplicatePath(scope);
      const result = normalizePathMutationResult(rawResult, scope, 'path_deduplicate');
      if (result.success) {
        await refreshAfterPathMutation(scope);
      } else if (result.message) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [refreshAfterPathMutation, setError]);

  const previewPathRepair = useCallback(async (
    scope: EnvVarScope,
  ): Promise<EnvVarPathRepairPreview | null> => {
    setState((s) => ({ ...s, pathLoading: true, pathRepairPreviewStale: false }));
    setError(null);
    try {
      const preview = await tauri.envvarPreviewPathRepair(scope);
      setState((s) => ({
        ...s,
        pathRepairPreview: preview,
        pathRepairPreviewStale: false,
        shellGuidance: preview.shellGuidance,
      }));
      return preview;
    } catch (err) {
      setError(formatError(err));
      return null;
    } finally {
      setState((s) => ({ ...s, pathLoading: false }));
    }
  }, [setError]);

  const applyPathRepair = useCallback(async (
    scope: EnvVarScope,
    fingerprint: string,
  ): Promise<EnvVarPathMutationResult | null> => {
    setState((s) => ({ ...s, pathLoading: true }));
    setError(null);
    try {
      const rawResult = await tauri.envvarApplyPathRepair(scope, fingerprint);
      const result = normalizePathMutationResult(rawResult, scope, 'path_repair');
      if (result.success) {
        await refreshAfterPathMutation(scope);
      } else if (result.message) {
        setError(result.message);
      }
      setState((s) => ({
        ...s,
        pathRepairPreview: null,
        pathRepairPreviewStale: false,
      }));
      return result;
    } catch (err) {
      const message = formatError(err);
      setError(message);
      setState((s) => ({
        ...s,
        pathRepairPreviewStale: isStalePreviewError(message),
      }));
      return null;
    } finally {
      setState((s) => ({ ...s, pathLoading: false }));
    }
  }, [isStalePreviewError, refreshAfterPathMutation, setError]);

  const fetchPersistentVarsTyped = useCallback(async (
    scope: EnvVarScope,
  ): Promise<PersistentEnvVar[]> => {
    setLoading(true);
    setError(null);
    try {
      const persistentVarsTyped = await tauri.envvarListPersistentTyped(scope);
      setState((s) => ({
        ...s,
        persistentVarsTyped,
        userPersistentVarsTyped: scope === 'user' ? persistentVarsTyped : s.userPersistentVarsTyped,
        systemPersistentVarsTyped: scope === 'system' ? persistentVarsTyped : s.systemPersistentVarsTyped,
        loading: false,
      }));
      return persistentVarsTyped;
    } catch (err) {
      setError(formatError(err));
      setLoading(false);
      return [];
    }
  }, [setLoading, setError]);

  const detectConflicts = useCallback(async (): Promise<EnvVarConflict[]> => {
    try {
      const conflicts = await tauri.envvarDetectConflicts();
      setState((s) => ({ ...s, conflicts }));
      return conflicts;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setError]);

  const getRevealCacheKey = useCallback((key: string, scope: EnvVarScope) => {
    return `${scope}:${key}`;
  }, []);

  const revealVar = useCallback(async (
    key: string,
    scope: EnvVarScope,
  ): Promise<string | null> => {
    setError(null);
    try {
      const result = await tauri.envvarRevealValue(key, scope);
      if (result.value != null) {
        setState((s) => ({
          ...s,
          revealedValues: {
            ...s.revealedValues,
            [getRevealCacheKey(key, scope)]: result.value!,
          },
        }));
      }
      return result.value;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [getRevealCacheKey, setError]);

  const clearRevealedVar = useCallback((key: string, scope: EnvVarScope) => {
    setState((s) => {
      const next = { ...s.revealedValues };
      delete next[getRevealCacheKey(key, scope)];
      return { ...s, revealedValues: next };
    });
  }, [getRevealCacheKey]);

  const resolveConflict = useCallback(async (
    key: string,
    sourceScope: EnvVarScope,
    targetScope: EnvVarScope,
  ): Promise<EnvVarConflictResolutionResult | null> => {
    setError(null);
    try {
      const rawResult = await tauri.envvarResolveConflict(key, sourceScope, targetScope);
      const result = normalizeConflictResult(rawResult);
      if (!result) {
        return null;
      }
      setState((s) => ({ ...s, shellGuidance: result.shellGuidance }));
      clearRevealedVar(key, sourceScope);
      clearRevealedVar(key, targetScope);
      if (result.success) {
        await refreshAfterScopeMutation(targetScope);
      } else if (result.message) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [clearRevealedVar, refreshAfterScopeMutation, setError]);

  const getActionSupport = useCallback((
    action: string,
    scope?: EnvVarScope | 'all',
  ): EnvVarActionSupport | null => {
    if (!state.supportSnapshot) return null;
    return state.supportSnapshot.actions.find((item) => {
      if (item.action !== action) return false;
      if (scope === 'all') {
        return item.scope == null || item.scope === ('all' as never);
      }
      return item.scope === scope || (scope == null && item.scope == null);
    }) ?? null;
  }, [state.supportSnapshot]);

  return {
    ...state,
    fetchAllVars,
    loadSupportSnapshot,
    getVar,
    setVar,
    removeVar,
    fetchPath,
    addPathEntry,
    removePathEntry,
    reorderPath,
    fetchShellProfiles,
    readShellProfile,
    previewImportEnvFile,
    applyImportPreview,
    clearImportPreview,
    importEnvFile,
    exportEnvFile,
    fetchPersistentVars,
    expandPath,
    deduplicatePath,
    previewPathRepair,
    applyPathRepair,
    clearPathRepairPreview,
    fetchPersistentVarsTyped,
    detectConflicts,
    resolveConflict,
    revealVar,
    clearRevealedVar,
    readShellProfileResult,
    loadDetection,
    invalidateDetectionCache,
    getActionSupport,
  };
}
