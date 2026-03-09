'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import type {
  EnvVarScope,
  EnvFileFormat,
  PathEntryInfo,
  ShellProfileInfo,
  EnvVarImportResult,
  PersistentEnvVar,
  EnvVarConflict,
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
  envVars: Record<string, string>;
  userPersistentVarsTyped: PersistentEnvVar[];
  systemPersistentVarsTyped: PersistentEnvVar[];
  persistentVarsTyped: PersistentEnvVar[];
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
      return Object.keys(snapshot.envVars).length === 0;
    case 'user':
      return snapshot.userPersistentVarsTyped.length === 0;
    case 'system':
      return snapshot.systemPersistentVarsTyped.length === 0;
    case 'all':
    default:
      return (
        Object.keys(snapshot.envVars).length === 0
        && snapshot.userPersistentVarsTyped.length === 0
        && snapshot.systemPersistentVarsTyped.length === 0
        && snapshot.conflicts.length === 0
      );
  }
}

interface EnvVarState {
  envVars: Record<string, string>;
  persistentVars: [string, string][];
  persistentVarsTyped: PersistentEnvVar[];
  userPersistentVarsTyped: PersistentEnvVar[];
  systemPersistentVarsTyped: PersistentEnvVar[];
  pathEntries: PathEntryInfo[];
  shellProfiles: ShellProfileInfo[];
  conflicts: EnvVarConflict[];
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
}

export function useEnvVar() {
  const [state, setState] = useState<EnvVarState>({
    envVars: {},
    persistentVars: [],
    persistentVarsTyped: [],
    userPersistentVarsTyped: [],
    systemPersistentVarsTyped: [],
    pathEntries: [],
    shellProfiles: [],
    conflicts: [],
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
    let envVars = base.envVars;
    let userPersistentVarsTyped = base.userPersistentVarsTyped;
    let systemPersistentVarsTyped = base.systemPersistentVarsTyped;
    let conflicts = base.conflicts;

    if (scope === 'all') {
      const [allEnvVars, userVars, systemVars, detectedConflicts] = await Promise.all([
        tauri.envvarListAll(),
        tauri.envvarListPersistentTyped('user'),
        tauri.envvarListPersistentTyped('system'),
        tauri.envvarDetectConflicts(),
      ]);
      envVars = allEnvVars;
      userPersistentVarsTyped = userVars;
      systemPersistentVarsTyped = systemVars;
      conflicts = detectedConflicts;
    } else if (scope === 'process') {
      envVars = await tauri.envvarListAll();
    } else if (scope === 'user') {
      const [userVars, detectedConflicts] = await Promise.all([
        tauri.envvarListPersistentTyped('user'),
        tauri.envvarDetectConflicts(),
      ]);
      userPersistentVarsTyped = userVars;
      conflicts = detectedConflicts;
    } else {
      const [systemVars, detectedConflicts] = await Promise.all([
        tauri.envvarListPersistentTyped('system'),
        tauri.envvarDetectConflicts(),
      ]);
      systemPersistentVarsTyped = systemVars;
      conflicts = detectedConflicts;
    }

    const persistentVarsTyped =
      scope === 'system'
        ? systemPersistentVarsTyped
        : userPersistentVarsTyped;

    return {
      scope,
      envVars,
      userPersistentVarsTyped,
      systemPersistentVarsTyped,
      persistentVarsTyped,
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
            envVars: cached.envVars,
            userPersistentVarsTyped: cached.userPersistentVarsTyped,
            systemPersistentVarsTyped: cached.systemPersistentVarsTyped,
            persistentVarsTyped: cached.persistentVarsTyped,
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
        envVars: fresh.envVars,
        userPersistentVarsTyped: fresh.userPersistentVarsTyped,
        systemPersistentVarsTyped: fresh.systemPersistentVarsTyped,
        persistentVarsTyped: fresh.persistentVarsTyped,
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
          envVars: cached.envVars,
          userPersistentVarsTyped: cached.userPersistentVarsTyped,
          systemPersistentVarsTyped: cached.systemPersistentVarsTyped,
          persistentVarsTyped: cached.persistentVarsTyped,
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
  ): Promise<boolean> => {
    setError(null);
    try {
      if (scope === 'process') {
        await tauri.envvarSetProcess(key, value);
      } else {
        await tauri.envvarSetPersistent(key, value, scope);
      }

      if (scope === 'process') {
        setState((s) => ({
          ...s,
          envVars: { ...s.envVars, [key]: value },
        }));
      }

      invalidateDetectionCache(scope);
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [invalidateDetectionCache, setError]);

  const removeVar = useCallback(async (
    key: string,
    scope: EnvVarScope,
  ): Promise<boolean> => {
    setError(null);
    try {
      if (scope === 'process') {
        await tauri.envvarRemoveProcess(key);
      } else {
        await tauri.envvarRemovePersistent(key, scope);
      }
      if (scope === 'process') {
        setState((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [key]: _removed, ...rest } = s.envVars;
          return { ...s, envVars: rest };
        });
      }
      invalidateDetectionCache(scope);
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
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
  ): Promise<boolean> => {
    setError(null);
    try {
      await tauri.envvarAddPathEntry(path, scope, position);
      const pathEntries = await tauri.envvarGetPath(scope);
      setState((s) => ({ ...s, pathEntries }));
      invalidateDetectionCache(scope);
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [invalidateDetectionCache, setError]);

  const removePathEntry = useCallback(async (
    path: string,
    scope: EnvVarScope,
  ): Promise<boolean> => {
    setError(null);
    try {
      await tauri.envvarRemovePathEntry(path, scope);
      const pathEntries = await tauri.envvarGetPath(scope);
      setState((s) => ({ ...s, pathEntries }));
      invalidateDetectionCache(scope);
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [invalidateDetectionCache, setError]);

  const reorderPath = useCallback(async (
    entries: string[],
    scope: EnvVarScope,
  ): Promise<boolean> => {
    setError(null);
    try {
      await tauri.envvarReorderPath(entries, scope);
      const pathEntries = await tauri.envvarGetPath(scope);
      setState((s) => ({ ...s, pathEntries }));
      invalidateDetectionCache(scope);
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [invalidateDetectionCache, setError]);

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
      return await tauri.envvarReadShellProfile(path);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const importEnvFile = useCallback(async (
    content: string,
    scope: EnvVarScope,
  ): Promise<EnvVarImportResult | null> => {
    setState((s) => ({ ...s, importExportLoading: true }));
    setError(null);
    try {
      const result = await tauri.envvarImportEnvFile(content, scope);
      if (result && (result.imported > 0 || result.skipped >= 0)) {
        invalidateDetectionCache(scope);
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
  ): Promise<string | null> => {
    setState((s) => ({ ...s, importExportLoading: true }));
    setError(null);
    try {
      return await tauri.envvarExportEnvFile(scope, format);
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
  ): Promise<number> => {
    setError(null);
    try {
      const removed = await tauri.envvarDeduplicatePath(scope);
      const pathEntries = await tauri.envvarGetPath(scope);
      setState((s) => ({ ...s, pathEntries }));
      invalidateDetectionCache(scope);
      return removed;
    } catch (err) {
      setError(formatError(err));
      return 0;
    }
  }, [invalidateDetectionCache, setError]);

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

  return {
    ...state,
    fetchAllVars,
    getVar,
    setVar,
    removeVar,
    fetchPath,
    addPathEntry,
    removePathEntry,
    reorderPath,
    fetchShellProfiles,
    readShellProfile,
    importEnvFile,
    exportEnvFile,
    fetchPersistentVars,
    expandPath,
    deduplicatePath,
    fetchPersistentVarsTyped,
    detectConflicts,
    loadDetection,
    invalidateDetectionCache,
  };
}
