import { useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import type { WslDistroStatus, WslStatus, WslImportOptions } from '@/types/tauri';

export interface UseWslReturn {
  // State
  available: boolean | null;
  distros: WslDistroStatus[];
  onlineDistros: [string, string][];
  status: WslStatus | null;
  runningDistros: string[];
  loading: boolean;
  error: string | null;

  // Actions
  checkAvailability: () => Promise<boolean>;
  refreshDistros: () => Promise<void>;
  refreshOnlineDistros: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshRunning: () => Promise<void>;
  refreshAll: () => Promise<void>;
  terminate: (name: string) => Promise<void>;
  shutdown: () => Promise<void>;
  setDefault: (name: string) => Promise<void>;
  setVersion: (name: string, version: number) => Promise<void>;
  setDefaultVersion: (version: number) => Promise<void>;
  exportDistro: (name: string, filePath: string, asVhd?: boolean) => Promise<void>;
  importDistro: (options: WslImportOptions) => Promise<void>;
  updateWsl: () => Promise<string>;
  launch: (name: string, user?: string) => Promise<void>;
}

/**
 * Hook for managing WSL (Windows Subsystem for Linux) distributions.
 *
 * Provides state and actions for:
 * - Listing installed and available distributions
 * - Installing/unregistering distributions (via standard provider commands)
 * - Managing distribution state (launch, terminate, shutdown)
 * - Setting default distribution and WSL version
 * - Exporting/importing distributions
 * - Updating WSL kernel
 * - Checking WSL system status
 */
export function useWsl(): UseWslReturn {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [distros, setDistros] = useState<WslDistroStatus[]>([]);
  const [onlineDistros, setOnlineDistros] = useState<[string, string][]>([]);
  const [status, setStatus] = useState<WslStatus | null>(null);
  const [runningDistros, setRunningDistros] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (!tauri.isTauri()) {
      setAvailable(false);
      return false;
    }
    try {
      const result = await tauri.wslIsAvailable();
      setAvailable(result);
      return result;
    } catch {
      setAvailable(false);
      return false;
    }
  }, []);

  const refreshDistros = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      setLoading(true);
      setError(null);
      const result = await tauri.wslListDistros();
      setDistros(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOnlineDistros = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      setLoading(true);
      setError(null);
      const result = await tauri.wslListOnline();
      setOnlineDistros(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      const result = await tauri.wslGetStatus();
      setStatus(result);
    } catch (err) {
      console.error('Failed to get WSL status:', err);
    }
  }, []);

  const refreshRunning = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      const result = await tauri.wslListRunning();
      setRunningDistros(result);
    } catch (err) {
      console.error('Failed to list running distros:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!tauri.isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const [distroResult, onlineResult, statusResult, runningResult] =
        await Promise.allSettled([
          tauri.wslListDistros(),
          tauri.wslListOnline(),
          tauri.wslGetStatus(),
          tauri.wslListRunning(),
        ]);

      if (distroResult.status === 'fulfilled') setDistros(distroResult.value);
      if (onlineResult.status === 'fulfilled') setOnlineDistros(onlineResult.value);
      if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
      if (runningResult.status === 'fulfilled') setRunningDistros(runningResult.value);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const terminate = useCallback(async (name: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslTerminate(name);
      await refreshDistros();
      await refreshRunning();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshDistros, refreshRunning]);

  const shutdown = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslShutdown();
      await refreshDistros();
      setRunningDistros([]);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshDistros]);

  const setDefault = useCallback(async (name: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetDefault(name);
      await refreshDistros();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshDistros]);

  const setVersion = useCallback(async (name: string, version: number) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetVersion(name, version);
      await refreshDistros();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshDistros]);

  const setDefaultVersion = useCallback(async (version: number) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetDefaultVersion(version);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const exportDistro = useCallback(async (name: string, filePath: string, asVhd?: boolean) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      setLoading(true);
      await tauri.wslExport(name, filePath, asVhd);
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const importDistro = useCallback(async (options: WslImportOptions) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      setLoading(true);
      await tauri.wslImport(options);
      await refreshDistros();
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshDistros]);

  const updateWsl = useCallback(async (): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      setError(null);
      setLoading(true);
      const result = await tauri.wslUpdate();
      await refreshStatus();
      return result;
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const launch = useCallback(async (name: string, user?: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslLaunch(name, user);
      await refreshRunning();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshRunning]);

  return {
    available,
    distros,
    onlineDistros,
    status,
    runningDistros,
    loading,
    error,
    checkAvailability,
    refreshDistros,
    refreshOnlineDistros,
    refreshStatus,
    refreshRunning,
    refreshAll,
    terminate,
    shutdown,
    setDefault,
    setVersion,
    setDefaultVersion,
    exportDistro,
    importDistro,
    updateWsl,
    launch,
  };
}
