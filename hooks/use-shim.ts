'use client';

import { useCallback, useState } from 'react';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import type { ShimInfo, PathStatusInfo } from '@/types/tauri';

interface ShimState {
  shims: ShimInfo[];
  pathStatus: PathStatusInfo | null;
  loading: boolean;
  error: string | null;
}

export function useShim() {
  const [state, setState] = useState<ShimState>({
    shims: [],
    pathStatus: null,
    loading: false,
    error: null,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState((s) => ({ ...s, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const fetchShims = useCallback(async (): Promise<ShimInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const shims = await tauri.shimList();
      setState((s) => ({ ...s, shims, loading: false }));
      return shims;
    } catch (err) {
      const msg = formatError(err);
      setError(msg);
      setLoading(false);
      return [];
    }
  }, [setLoading, setError]);

  const createShim = useCallback(async (
    binaryName: string,
    envType: string,
    version: string | null,
    targetPath: string
  ): Promise<string | null> => {
    setError(null);
    try {
      const shimPath = await tauri.shimCreate(binaryName, envType, version, targetPath);
      await fetchShims();
      return shimPath;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError, fetchShims]);

  const removeShim = useCallback(async (binaryName: string): Promise<boolean> => {
    setError(null);
    try {
      const removed = await tauri.shimRemove(binaryName);
      if (removed) {
        await fetchShims();
      }
      return removed;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError, fetchShims]);

  const updateShim = useCallback(async (binaryName: string, version?: string): Promise<boolean> => {
    setError(null);
    try {
      await tauri.shimUpdate(binaryName, version);
      await fetchShims();
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError, fetchShims]);

  const regenerateAll = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await tauri.shimRegenerateAll();
      await fetchShims();
      return true;
    } catch (err) {
      setError(formatError(err));
      setLoading(false);
      return false;
    }
  }, [setLoading, setError, fetchShims]);

  const fetchPathStatus = useCallback(async (): Promise<PathStatusInfo | null> => {
    try {
      const status = await tauri.pathStatus();
      setState((s) => ({ ...s, pathStatus: status }));
      return status;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const setupPath = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      await tauri.pathSetup();
      await fetchPathStatus();
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError, fetchPathStatus]);

  const removePath = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      await tauri.pathRemove();
      await fetchPathStatus();
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [setError, fetchPathStatus]);

  const checkPath = useCallback(async (): Promise<boolean> => {
    try {
      return await tauri.pathCheck();
    } catch {
      return false;
    }
  }, []);

  const getAddCommand = useCallback(async (): Promise<string | null> => {
    try {
      return await tauri.pathGetAddCommand();
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  return {
    ...state,
    fetchShims,
    createShim,
    removeShim,
    updateShim,
    regenerateAll,
    fetchPathStatus,
    setupPath,
    removePath,
    checkPath,
    getAddCommand,
  };
}
