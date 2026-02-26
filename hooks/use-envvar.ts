'use client';

import { useCallback, useState } from 'react';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import type {
  EnvVarScope,
  EnvFileFormat,
  PathEntryInfo,
  ShellProfileInfo,
  EnvVarImportResult,
} from '@/types/tauri';

interface EnvVarState {
  envVars: Record<string, string>;
  persistentVars: [string, string][];
  pathEntries: PathEntryInfo[];
  shellProfiles: ShellProfileInfo[];
  loading: boolean;
  error: string | null;
}

export function useEnvVar() {
  const [state, setState] = useState<EnvVarState>({
    envVars: {},
    persistentVars: [],
    pathEntries: [],
    shellProfiles: [],
    loading: false,
    error: null,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState((s) => ({ ...s, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
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
      // Update local state
      if (scope === 'process') {
        setState((s) => ({
          ...s,
          envVars: { ...s.envVars, [key]: value },
        }));
      }
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError]);

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
      // Update local state
      if (scope === 'process') {
        setState((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [key]: _removed, ...rest } = s.envVars;
          return { ...s, envVars: rest };
        });
      }
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError]);

  const fetchPath = useCallback(async (scope: EnvVarScope): Promise<PathEntryInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const pathEntries = await tauri.envvarGetPath(scope);
      setState((s) => ({ ...s, pathEntries, loading: false }));
      return pathEntries;
    } catch (err) {
      setError(formatError(err));
      setLoading(false);
      return [];
    }
  }, [setLoading, setError]);

  const addPathEntry = useCallback(async (
    path: string,
    scope: EnvVarScope,
    position?: number,
  ): Promise<boolean> => {
    setError(null);
    try {
      await tauri.envvarAddPathEntry(path, scope, position);
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError]);

  const removePathEntry = useCallback(async (
    path: string,
    scope: EnvVarScope,
  ): Promise<boolean> => {
    setError(null);
    try {
      await tauri.envvarRemovePathEntry(path, scope);
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError]);

  const reorderPath = useCallback(async (
    entries: string[],
    scope: EnvVarScope,
  ): Promise<boolean> => {
    setError(null);
    try {
      await tauri.envvarReorderPath(entries, scope);
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError]);

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
    setError(null);
    try {
      return await tauri.envvarImportEnvFile(content, scope);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const exportEnvFile = useCallback(async (
    scope: EnvVarScope,
    format: EnvFileFormat,
  ): Promise<string | null> => {
    setError(null);
    try {
      return await tauri.envvarExportEnvFile(scope, format);
    } catch (err) {
      setError(formatError(err));
      return null;
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
      return await tauri.envvarDeduplicatePath(scope);
    } catch (err) {
      setError(formatError(err));
      return 0;
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
  };
}
