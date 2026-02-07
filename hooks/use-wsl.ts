import { useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import type {
  WslDistroStatus,
  WslStatus,
  WslImportOptions,
  WslExecResult,
  WslDiskUsage,
  WslConfig,
  WslDistroConfig,
  WslMountOptions,
} from '@/types/tauri';

export interface UseWslReturn {
  // State
  available: boolean | null;
  distros: WslDistroStatus[];
  onlineDistros: [string, string][];
  status: WslStatus | null;
  runningDistros: string[];
  config: WslConfig | null;
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
  execCommand: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  convertPath: (path: string, distro?: string, toWindows?: boolean) => Promise<string>;
  refreshConfig: () => Promise<void>;
  setConfigValue: (section: string, key: string, value?: string) => Promise<void>;
  getDiskUsage: (name: string) => Promise<WslDiskUsage | null>;
  importInPlace: (name: string, vhdxPath: string) => Promise<void>;
  mountDisk: (options: WslMountOptions) => Promise<string>;
  unmountDisk: (diskPath?: string) => Promise<void>;
  getIpAddress: (distro?: string) => Promise<string>;
  changeDefaultUser: (distro: string, username: string) => Promise<void>;
  getDistroConfig: (distro: string) => Promise<WslDistroConfig | null>;
  setDistroConfigValue: (distro: string, section: string, key: string, value?: string) => Promise<void>;
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
  const [config, setConfig] = useState<WslConfig | null>(null);
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

  const refreshConfig = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      const result = await tauri.wslGetConfig();
      setConfig(result);
    } catch (err) {
      console.error('Failed to get WSL config:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!tauri.isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const [distroResult, onlineResult, statusResult, runningResult, configResult] =
        await Promise.allSettled([
          tauri.wslListDistros(),
          tauri.wslListOnline(),
          tauri.wslGetStatus(),
          tauri.wslListRunning(),
          tauri.wslGetConfig(),
        ]);

      if (distroResult.status === 'fulfilled') setDistros(distroResult.value);
      if (onlineResult.status === 'fulfilled') setOnlineDistros(onlineResult.value);
      if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
      if (runningResult.status === 'fulfilled') setRunningDistros(runningResult.value);
      if (configResult.status === 'fulfilled') setConfig(configResult.value);
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

  const execCommand = useCallback(async (distro: string, command: string, user?: string): Promise<WslExecResult> => {
    if (!tauri.isTauri()) return { stdout: '', stderr: 'Not in Tauri environment', exitCode: 1 };
    try {
      setError(null);
      return await tauri.wslExec(distro, command, user);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const convertPath = useCallback(async (path: string, distro?: string, toWindows?: boolean): Promise<string> => {
    if (!tauri.isTauri()) return path;
    try {
      return await tauri.wslConvertPath(path, distro, toWindows);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const setConfigValue = useCallback(async (section: string, key: string, value?: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetConfig(section, key, value);
      await refreshConfig();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshConfig]);

  const getDiskUsage = useCallback(async (name: string): Promise<WslDiskUsage | null> => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.wslDiskUsage(name);
    } catch {
      return null;
    }
  }, []);

  const importInPlace = useCallback(async (name: string, vhdxPath: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslImportInPlace(name, vhdxPath);
      await refreshDistros();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshDistros]);

  const mountDisk = useCallback(async (options: WslMountOptions): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      setError(null);
      return await tauri.wslMount(options);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const unmountDisk = useCallback(async (diskPath?: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslUnmount(diskPath);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const getIpAddress = useCallback(async (distro?: string): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      return await tauri.wslGetIp(distro);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const changeDefaultUser = useCallback(async (distro: string, username: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslChangeDefaultUser(distro, username);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const getDistroConfig = useCallback(async (distro: string): Promise<WslDistroConfig | null> => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.wslGetDistroConfig(distro);
    } catch {
      return null;
    }
  }, []);

  const setDistroConfigValue = useCallback(async (
    distro: string, section: string, key: string, value?: string
  ) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetDistroConfig(distro, section, key, value);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  return {
    available,
    distros,
    onlineDistros,
    status,
    runningDistros,
    config,
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
    execCommand,
    convertPath,
    refreshConfig,
    setConfigValue,
    getDiskUsage,
    importInPlace,
    mountDisk,
    unmountDisk,
    getIpAddress,
    changeDefaultUser,
    getDistroConfig,
    setDistroConfigValue,
  };
}
