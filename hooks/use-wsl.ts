import { useState, useCallback, useEffect, useRef } from 'react';
import * as tauri from '@/lib/tauri';
import type {
  WslDistroStatus,
  WslStatus,
  WslVersionInfo,
  WslCapabilities,
  WslImportOptions,
  WslExecResult,
  WslDiskUsage,
  WslTotalDiskUsage,
  WslConfig,
  WslDistroConfig,
  WslMountOptions,
  WslDistroEnvironment,
  WslDistroResources,
  WslUser,
  WslPackageUpdateResult,
} from '@/types/tauri';
import type {
  WslAssistanceActionDescriptor,
  WslAssistancePreflightCheck,
  WslAssistancePreflightResult,
  WslAssistanceSuggestion,
  WslAssistanceSummary,
  WslAssistanceScope,
} from '@/types/wsl';

export interface UseWslReturn {
  // State
  available: boolean | null;
  distros: WslDistroStatus[];
  onlineDistros: [string, string][];
  status: WslStatus | null;
  runningDistros: string[];
  config: WslConfig | null;
  capabilities: WslCapabilities | null;
  loading: boolean;
  error: string | null;

  // Actions
  checkAvailability: () => Promise<boolean>;
  refreshDistros: () => Promise<void>;
  refreshOnlineDistros: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshRunning: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
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
  getVersionInfo: () => Promise<WslVersionInfo | null>;
  getCapabilities: () => Promise<WslCapabilities | null>;
  setSparse: (distro: string, enabled: boolean) => Promise<void>;
  moveDistro: (name: string, location: string) => Promise<string>;
  resizeDistro: (name: string, size: string) => Promise<string>;
  installWslOnly: () => Promise<string>;
  installOnlineDistro: (name: string) => Promise<void>;
  unregisterDistro: (name: string) => Promise<void>;
  installWithLocation: (name: string, location: string) => Promise<string>;
  getTotalDiskUsage: () => Promise<WslTotalDiskUsage | null>;
  detectDistroEnv: (distro: string) => Promise<WslDistroEnvironment | null>;
  getDistroResources: (distro: string) => Promise<WslDistroResources | null>;
  listUsers: (distro: string) => Promise<WslUser[]>;
  updateDistroPackages: (distro: string, mode: string) => Promise<WslPackageUpdateResult>;
  openInExplorer: (name: string) => Promise<void>;
  openInTerminal: (name: string) => Promise<void>;
  cloneDistro: (name: string, newName: string, location: string) => Promise<string>;
  batchLaunch: (names: string[]) => Promise<[string, boolean, string][]>;
  batchTerminate: (names: string[]) => Promise<[string, boolean, string][]>;
  healthCheck: (distro: string) => Promise<{ status: string; issues: { severity: string; category: string; message: string }[]; checkedAt: string }>;
  listPortForwards: () => Promise<{
    listenAddress: string;
    listenPort: string;
    connectAddress: string;
    connectPort: string;
  }[]>;
  addPortForward: (listenPort: number, connectPort: number, connectAddress: string) => Promise<void>;
  removePortForward: (listenPort: number) => Promise<void>;
  backupDistro: (name: string, destDir: string) => Promise<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
    createdAt: string;
    distroName: string;
  }>;
  listBackups: (backupDir: string) => Promise<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
    createdAt: string;
    distroName: string;
  }[]>;
  restoreBackup: (backupPath: string, name: string, installLocation: string) => Promise<void>;
  deleteBackup: (backupPath: string) => Promise<void>;
  getAssistanceActions: (
    scope: WslAssistanceScope,
    distroName?: string
  ) => WslAssistanceActionDescriptor[];
  runAssistancePreflight: (
    scope: WslAssistanceScope,
    distroName?: string
  ) => Promise<WslAssistancePreflightResult>;
  executeAssistanceAction: (
    actionId: string,
    scope?: WslAssistanceScope,
    distroName?: string
  ) => Promise<WslAssistanceSummary>;
  mapErrorToAssistance: (
    errorMessage: string,
    scope: WslAssistanceScope,
    distroName?: string
  ) => WslAssistanceSuggestion[];
  autoRefreshEnabled: boolean;
  setAutoRefresh: (enabled: boolean) => void;
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
  const [capabilities, setCapabilities] = useState<WslCapabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (!tauri.isTauri()) {
      setAvailable(false);
      setCapabilities(null);
      return false;
    }
    try {
      const result = await tauri.wslIsAvailable();
      setAvailable(result);
      if (!result) {
        setCapabilities(null);
      }
      return result;
    } catch {
      setAvailable(false);
      setCapabilities(null);
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

  const refreshCapabilities = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      const result = await tauri.wslGetCapabilities();
      setCapabilities(result);
    } catch (err) {
      console.error('Failed to detect WSL capabilities:', err);
      setCapabilities(null);
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
      const [distroResult, onlineResult, statusResult, runningResult, configResult, capabilitiesResult] =
        await Promise.allSettled([
          tauri.wslListDistros(),
          tauri.wslListOnline(),
          tauri.wslGetStatus(),
          tauri.wslListRunning(),
          tauri.wslGetConfig(),
          tauri.wslGetCapabilities(),
        ]);

      if (distroResult.status === 'fulfilled') setDistros(distroResult.value);
      if (onlineResult.status === 'fulfilled') setOnlineDistros(onlineResult.value);
      if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
      if (runningResult.status === 'fulfilled') setRunningDistros(runningResult.value);
      if (configResult.status === 'fulfilled') setConfig(configResult.value);
      if (capabilitiesResult.status === 'fulfilled') setCapabilities(capabilitiesResult.value);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshInventoryState = useCallback(async () => {
    await Promise.all([refreshDistros(), refreshRunning(), refreshStatus()]);
  }, [refreshDistros, refreshRunning, refreshStatus]);

  const refreshRuntimeState = useCallback(async () => {
    await Promise.all([
      refreshDistros(),
      refreshRunning(),
      refreshStatus(),
      refreshConfig(),
      refreshCapabilities(),
    ]);
  }, [refreshCapabilities, refreshConfig, refreshDistros, refreshRunning, refreshStatus]);

  const terminate = useCallback(async (name: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslTerminate(name);
      await refreshInventoryState();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const shutdown = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslShutdown();
      setRunningDistros([]);
      await refreshInventoryState();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const setDefault = useCallback(async (name: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetDefault(name);
      await refreshInventoryState();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const setVersion = useCallback(async (name: string, version: number) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetVersion(name, version);
      await refreshInventoryState();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const setDefaultVersion = useCallback(async (version: number) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetDefaultVersion(version);
      await refreshStatus();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshStatus]);

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
      await refreshInventoryState();
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshInventoryState]);

  const updateWsl = useCallback(async (): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      setError(null);
      setLoading(true);
      const result = await tauri.wslUpdate();
      await Promise.all([refreshStatus(), refreshCapabilities()]);
      return result;
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshCapabilities, refreshStatus]);

  const launch = useCallback(async (name: string, user?: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslLaunch(name, user);
      await refreshInventoryState();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

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
      await refreshDistros();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshDistros]);

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

  const getVersionInfo = useCallback(async (): Promise<WslVersionInfo | null> => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.wslGetVersionInfo();
    } catch {
      return null;
    }
  }, []);

  const getCapabilities = useCallback(async (): Promise<WslCapabilities | null> => {
    if (!tauri.isTauri()) return null;
    try {
      const detected = await tauri.wslGetCapabilities();
      setCapabilities(detected);
      return detected;
    } catch {
      return null;
    }
  }, []);

  const setSparse = useCallback(async (distro: string, enabled: boolean) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslSetSparse(distro, enabled);
      await refreshInventoryState();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const moveDistro = useCallback(async (name: string, location: string): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      setError(null);
      const result = await tauri.wslMoveDistro(name, location);
      await refreshInventoryState();
      return result;
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const resizeDistro = useCallback(async (name: string, size: string): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      setError(null);
      const result = await tauri.wslResizeDistro(name, size);
      await refreshInventoryState();
      return result;
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const installWslOnly = useCallback(async (): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      setError(null);
      return await tauri.wslInstallWslOnly();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const installOnlineDistro = useCallback(async (name: string): Promise<void> => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.packageInstall([`wsl:${name}`]);
      await Promise.all([refreshDistros(), refreshStatus(), refreshOnlineDistros()]);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshDistros, refreshOnlineDistros, refreshStatus]);

  const unregisterDistro = useCallback(async (name: string): Promise<void> => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.packageUninstall([`wsl:${name}`]);
      await refreshRuntimeState();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshRuntimeState]);

  const installWithLocation = useCallback(async (name: string, location: string): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      setError(null);
      const result = await tauri.wslInstallWithLocation(name, location);
      await Promise.all([refreshDistros(), refreshStatus(), refreshOnlineDistros()]);
      return result;
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshDistros, refreshOnlineDistros, refreshStatus]);

  const getTotalDiskUsage = useCallback(async (): Promise<WslTotalDiskUsage | null> => {
    if (!tauri.isTauri()) return null;
    try {
      const [totalBytes, perDistro] = await tauri.wslTotalDiskUsage();
      return { totalBytes, perDistro };
    } catch {
      return null;
    }
  }, []);

  const detectDistroEnv = useCallback(async (distro: string): Promise<WslDistroEnvironment | null> => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.wslDetectDistroEnv(distro);
    } catch {
      return null;
    }
  }, []);

  const getDistroResources = useCallback(async (distro: string): Promise<WslDistroResources | null> => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.wslGetDistroResources(distro);
    } catch {
      return null;
    }
  }, []);

  const listUsers = useCallback(async (distro: string): Promise<WslUser[]> => {
    if (!tauri.isTauri()) return [];
    try {
      return await tauri.wslListUsers(distro);
    } catch {
      return [];
    }
  }, []);

  const updateDistroPackages = useCallback(async (distro: string, mode: string): Promise<WslPackageUpdateResult> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    return await tauri.wslUpdateDistroPackages(distro, mode);
  }, []);

  const [autoRefreshEnabled, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoRefreshEnabled && tauri.isTauri()) {
      autoRefreshRef.current = setInterval(async () => {
        try {
          const result = await tauri.wslListDistros();
          setDistros(result);
          const running = await tauri.wslListRunning();
          setRunningDistros(running);
        } catch { /* ignore polling errors */ }
      }, 10000);
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefreshEnabled]);

  const openInExplorer = useCallback(async (name: string): Promise<void> => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslOpenInExplorer(name);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const openInTerminal = useCallback(async (name: string): Promise<void> => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslOpenInTerminal(name);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const cloneDistro = useCallback(async (name: string, newName: string, location: string): Promise<string> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      const result = await tauri.wslCloneDistro(name, newName, location);
      await refreshInventoryState();
      return result;
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const batchLaunch = useCallback(async (names: string[]): Promise<[string, boolean, string][]> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      const results = await tauri.wslBatchLaunch(names);
      await refreshInventoryState();
      return results;
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const batchTerminate = useCallback(async (names: string[]): Promise<[string, boolean, string][]> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      const results = await tauri.wslBatchTerminate(names);
      await refreshInventoryState();
      return results;
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshInventoryState]);

  const healthCheck = useCallback(async (distro: string) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      return await tauri.wslDistroHealthCheck(distro);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const listPortForwards = useCallback(async () => {
    if (!tauri.isTauri()) return [];
    try {
      setError(null);
      return await tauri.wslListPortForwards();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const addPortForward = useCallback(async (listenPort: number, connectPort: number, connectAddress: string) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      await tauri.wslAddPortForward(listenPort, connectPort, connectAddress);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const removePortForward = useCallback(async (listenPort: number) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      await tauri.wslRemovePortForward(listenPort);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const backupDistro = useCallback(async (name: string, destDir: string) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      return await tauri.wslBackupDistro(name, destDir);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const listBackups = useCallback(async (backupDir: string) => {
    if (!tauri.isTauri()) return [];
    try {
      setError(null);
      return await tauri.wslListBackups(backupDir);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const restoreBackup = useCallback(async (backupPath: string, name: string, installLocation: string) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      await tauri.wslRestoreBackup(backupPath, name, installLocation);
      await refreshRuntimeState();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, [refreshRuntimeState]);

  const deleteBackup = useCallback(async (backupPath: string) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      setError(null);
      await tauri.wslDeleteBackup(backupPath);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const getAssistanceActions = useCallback((
    scope: WslAssistanceScope,
    distroName?: string
  ): WslAssistanceActionDescriptor[] => {
    const blockedWhenUnavailable = available === false;
    const baseReason = blockedWhenUnavailable ? 'WSL is unavailable on this host.' : undefined;

    if (scope === 'runtime') {
      return [
        {
          id: 'runtime.preflight',
          scope,
          category: 'check',
          risk: 'safe',
          labelKey: 'wsl.assistance.actions.runtimePreflight.label',
          descriptionKey: 'wsl.assistance.actions.runtimePreflight.desc',
          supported: !blockedWhenUnavailable,
          blockedReason: baseReason,
        },
        {
          id: 'runtime.refreshState',
          scope,
          category: 'repair',
          risk: 'safe',
          labelKey: 'wsl.assistance.actions.runtimeRefresh.label',
          descriptionKey: 'wsl.assistance.actions.runtimeRefresh.desc',
          supported: !blockedWhenUnavailable,
          blockedReason: baseReason,
        },
        {
          id: 'runtime.updateKernel',
          scope,
          category: 'maintenance',
          risk: 'safe',
          labelKey: 'wsl.assistance.actions.runtimeUpdate.label',
          descriptionKey: 'wsl.assistance.actions.runtimeUpdate.desc',
          supported: !blockedWhenUnavailable,
          blockedReason: baseReason,
        },
        {
          id: 'runtime.shutdownAll',
          scope,
          category: 'repair',
          risk: 'high',
          labelKey: 'wsl.assistance.actions.runtimeShutdown.label',
          descriptionKey: 'wsl.assistance.actions.runtimeShutdown.desc',
          supported: !blockedWhenUnavailable,
          blockedReason: baseReason,
          requiresAdmin: true,
        },
      ];
    }

    const distroMissing = !distroName || !distros.some((d) => d.name === distroName);
    const distroReason = blockedWhenUnavailable
      ? 'WSL is unavailable on this host.'
      : distroMissing
        ? 'Target distribution is not available.'
        : undefined;
    const sparseUnsupported = capabilities?.setSparse === false;

    return [
      {
        id: 'distro.preflight',
        scope,
        category: 'check',
        risk: 'safe',
        labelKey: 'wsl.assistance.actions.distroPreflight.label',
        descriptionKey: 'wsl.assistance.actions.distroPreflight.desc',
        supported: !blockedWhenUnavailable && !distroMissing,
        blockedReason: distroReason,
        distroName,
      },
      {
        id: 'distro.healthCheck',
        scope,
        category: 'check',
        risk: 'safe',
        labelKey: 'wsl.assistance.actions.distroHealth.label',
        descriptionKey: 'wsl.assistance.actions.distroHealth.desc',
        supported: !blockedWhenUnavailable && !distroMissing,
        blockedReason: distroReason,
        distroName,
      },
      {
        id: 'distro.refreshState',
        scope,
        category: 'repair',
        risk: 'safe',
        labelKey: 'wsl.assistance.actions.distroRefresh.label',
        descriptionKey: 'wsl.assistance.actions.distroRefresh.desc',
        supported: !blockedWhenUnavailable && !distroMissing,
        blockedReason: distroReason,
        distroName,
      },
      {
        id: 'distro.relaunch',
        scope,
        category: 'repair',
        risk: 'high',
        labelKey: 'wsl.assistance.actions.distroRelaunch.label',
        descriptionKey: 'wsl.assistance.actions.distroRelaunch.desc',
        supported: !blockedWhenUnavailable && !distroMissing,
        blockedReason: distroReason,
        distroName,
      },
      {
        id: 'distro.enableSparse',
        scope,
        category: 'maintenance',
        risk: 'safe',
        labelKey: 'wsl.assistance.actions.distroSparse.label',
        descriptionKey: 'wsl.assistance.actions.distroSparse.desc',
        supported: !blockedWhenUnavailable && !distroMissing && !sparseUnsupported,
        blockedReason: sparseUnsupported ? 'Sparse mode is unsupported in current WSL runtime.' : distroReason,
        distroName,
      },
      {
        id: 'distro.openTerminal',
        scope,
        category: 'maintenance',
        risk: 'safe',
        labelKey: 'wsl.assistance.actions.distroTerminal.label',
        descriptionKey: 'wsl.assistance.actions.distroTerminal.desc',
        supported: !blockedWhenUnavailable && !distroMissing,
        blockedReason: distroReason,
        distroName,
      },
    ];
  }, [available, capabilities?.setSparse, distros]);

  const runAssistancePreflight = useCallback(async (
    scope: WslAssistanceScope,
    distroName?: string
  ): Promise<WslAssistancePreflightResult> => {
    const timestamp = new Date().toISOString();
    const checks: WslAssistancePreflightCheck[] = [];
    const recommendations: string[] = [];

    const availableNow = await checkAvailability();
    checks.push({
      id: 'runtime-availability',
      label: 'Runtime Availability',
      status: availableNow ? 'healthy' : 'error',
      detail: availableNow ? 'WSL runtime is available.' : 'WSL runtime is unavailable.',
      recommendation: availableNow ? undefined : 'Install or enable WSL before retrying.',
    });
    if (!availableNow) {
      return {
        status: 'error',
        timestamp,
        checks,
        recommendations: ['Install or enable WSL before retrying.'],
      };
    }

    const [capsResult, statusResult, distroResult, runningResult] = await Promise.allSettled([
      tauri.wslGetCapabilities(),
      tauri.wslGetStatus(),
      tauri.wslListDistros(),
      tauri.wslListRunning(),
    ]);

    let detectedCaps = capabilities;
    let detectedStatus = status;
    let detectedDistros = distros;
    let detectedRunning = runningDistros;

    if (capsResult.status === 'fulfilled') {
      detectedCaps = capsResult.value;
      setCapabilities(capsResult.value);
    }
    if (statusResult.status === 'fulfilled') {
      detectedStatus = statusResult.value;
      setStatus(statusResult.value);
    }
    if (distroResult.status === 'fulfilled') {
      detectedDistros = distroResult.value;
      setDistros(distroResult.value);
    }
    if (runningResult.status === 'fulfilled') {
      detectedRunning = runningResult.value;
      setRunningDistros(runningResult.value);
    }

    checks.push({
      id: 'runtime-capabilities',
      label: 'Command Capabilities',
      status: detectedCaps ? 'healthy' : 'warning',
      detail: detectedCaps ? 'Capabilities detected successfully.' : 'Capability data unavailable.',
      recommendation: detectedCaps ? undefined : 'Refresh runtime state to re-detect capabilities.',
    });
    if (!detectedCaps) {
      recommendations.push('Refresh runtime state to re-detect capabilities.');
    }

    checks.push({
      id: 'runtime-status',
      label: 'Runtime Status',
      status: detectedStatus ? 'healthy' : 'warning',
      detail: detectedStatus
        ? `Running distros: ${detectedRunning.length}`
        : 'Runtime status is temporarily unavailable.',
      recommendation: detectedStatus ? undefined : 'Retry status refresh and preflight check.',
    });
    if (!detectedStatus) {
      recommendations.push('Retry status refresh and preflight check.');
    }

    checks.push({
      id: 'runtime-distro-inventory',
      label: 'Distribution Inventory',
      status: detectedDistros.length > 0 ? 'healthy' : 'warning',
      detail: detectedDistros.length > 0
        ? `${detectedDistros.length} distribution(s) detected.`
        : 'No distributions detected.',
      recommendation: detectedDistros.length > 0 ? undefined : 'Install a distribution before running distro workflows.',
    });
    if (detectedDistros.length === 0) {
      recommendations.push('Install a distribution before running distro workflows.');
    }

    if (scope === 'distro') {
      const selected = distroName
        ? detectedDistros.find((d) => d.name === distroName)
        : undefined;

      checks.push({
        id: 'distro-target',
        label: 'Target Distribution',
        status: selected ? 'healthy' : 'error',
        detail: selected
          ? `Target '${distroName}' is available.`
          : `Target '${distroName ?? 'unknown'}' is unavailable.`,
        recommendation: selected ? undefined : 'Re-select an existing distribution and retry.',
      });
      if (!selected) {
        recommendations.push('Re-select an existing distribution and retry.');
      } else {
        const running = detectedRunning.some((name) => name === selected.name);
        checks.push({
          id: 'distro-runtime',
          label: 'Distribution Runtime State',
          status: running ? 'healthy' : 'warning',
          detail: running ? 'Distribution is running.' : 'Distribution is not running.',
          recommendation: running ? undefined : 'Launch or relaunch the distribution before retrying runtime-sensitive actions.',
        });
        if (!running) {
          recommendations.push('Launch or relaunch the distribution before retrying runtime-sensitive actions.');
        }
      }
    }

    const hasError = checks.some((check) => check.status === 'error');
    const hasWarning = checks.some((check) => check.status === 'warning');

    return {
      status: hasError ? 'error' : hasWarning ? 'warning' : 'healthy',
      timestamp,
      checks,
      recommendations: Array.from(new Set(recommendations)),
    };
  }, [capabilities, checkAvailability, distros, runningDistros, status]);

  const executeAssistanceAction = useCallback(async (
    actionId: string,
    scope?: WslAssistanceScope,
    distroName?: string
  ): Promise<WslAssistanceSummary> => {
    const resolvedScope = scope ?? (actionId.startsWith('distro.') ? 'distro' : 'runtime');
    const action = getAssistanceActions(resolvedScope, distroName)
      .find((candidate) => candidate.id === actionId);
    const timestamp = new Date().toISOString();

    if (!action) {
      return {
        actionId,
        status: 'blocked',
        timestamp,
        title: `Unsupported assistance action: ${actionId}`,
        findings: ['Assistance action is not registered in current runtime.'],
        recommendations: ['Refresh assistance actions and retry.'],
        retryable: false,
      };
    }
    if (!action.supported) {
      return {
        actionId,
        status: 'blocked',
        timestamp,
        title: 'Assistance action blocked',
        findings: [action.blockedReason ?? 'Action prerequisites are not satisfied.'],
        recommendations: ['Run preflight checks to inspect missing prerequisites.'],
        retryable: false,
      };
    }

    try {
      if (actionId === 'runtime.preflight') {
        const preflight = await runAssistancePreflight('runtime');
        return {
          actionId,
          status: preflight.status === 'error' ? 'failed' : 'success',
          timestamp: preflight.timestamp,
          title: preflight.status === 'healthy'
            ? 'Runtime preflight passed'
            : 'Runtime preflight completed with findings',
          findings: preflight.checks.map((check) => `${check.label}: ${check.detail}`),
          recommendations: preflight.recommendations,
          retryable: true,
        };
      }

      if (actionId === 'runtime.refreshState') {
        await Promise.all([
          refreshDistros(),
          refreshStatus(),
          refreshRunning(),
          refreshConfig(),
          refreshCapabilities(),
        ]);
        return {
          actionId,
          status: 'success',
          timestamp,
          title: 'Runtime state refreshed',
          findings: ['Runtime, distro, and configuration slices were refreshed.'],
          recommendations: ['Retry the failed workflow if needed.'],
          retryable: true,
        };
      }

      if (actionId === 'runtime.updateKernel') {
        const output = await updateWsl();
        await Promise.all([refreshStatus(), refreshCapabilities()]);
        return {
          actionId,
          status: 'success',
          timestamp,
          title: 'WSL runtime update completed',
          findings: [output || 'WSL update command completed successfully.'],
          recommendations: ['If issues persist, run runtime preflight and retry the original action.'],
          retryable: true,
        };
      }

      if (actionId === 'runtime.shutdownAll') {
        await shutdown();
        await Promise.all([refreshDistros(), refreshRunning(), refreshStatus()]);
        return {
          actionId,
          status: 'success',
          timestamp,
          title: 'Runtime shutdown completed',
          findings: ['All running WSL instances were shut down and state was reconciled.'],
          recommendations: ['Relaunch required distributions and retry your workflow.'],
          retryable: true,
        };
      }

      const targetDistro = distroName ?? action.distroName;
      if (!targetDistro) {
        return {
          actionId,
          status: 'blocked',
          timestamp,
          title: 'Assistance action blocked',
          findings: ['No target distribution was provided.'],
          recommendations: ['Select a distribution and retry.'],
          retryable: false,
        };
      }

      if (actionId === 'distro.preflight') {
        const preflight = await runAssistancePreflight('distro', targetDistro);
        return {
          actionId,
          status: preflight.status === 'error' ? 'failed' : 'success',
          timestamp: preflight.timestamp,
          title: preflight.status === 'healthy'
            ? `Preflight passed for ${targetDistro}`
            : `Preflight completed for ${targetDistro} with findings`,
          findings: preflight.checks.map((check) => `${check.label}: ${check.detail}`),
          recommendations: preflight.recommendations,
          retryable: true,
        };
      }

      if (actionId === 'distro.healthCheck') {
        const result = await healthCheck(targetDistro);
        return {
          actionId,
          status: result.status === 'error' ? 'failed' : 'success',
          timestamp: result.checkedAt,
          title: `Health check completed for ${targetDistro}`,
          findings: result.issues.length > 0
            ? result.issues.map((issue) => `${issue.category}: ${issue.message}`)
            : ['No health issues detected.'],
          recommendations: result.issues.length > 0
            ? ['Apply the listed remediations and rerun health check.']
            : ['No additional action required.'],
          retryable: true,
        };
      }

      if (actionId === 'distro.refreshState') {
        await Promise.all([
          refreshDistros(),
          refreshStatus(),
          refreshRunning(),
          refreshConfig(),
          refreshCapabilities(),
        ]);
        return {
          actionId,
          status: 'success',
          timestamp,
          title: `State refreshed for ${targetDistro}`,
          findings: ['Distro and runtime state were refreshed from backend truth.'],
          recommendations: ['Retry your previous action in the same workflow.'],
          retryable: true,
        };
      }

      if (actionId === 'distro.relaunch') {
        const running = runningDistros.some((name) => name === targetDistro);
        if (running) {
          await terminate(targetDistro);
        }
        await launch(targetDistro);
        await Promise.all([refreshDistros(), refreshRunning(), refreshStatus()]);
        return {
          actionId,
          status: 'success',
          timestamp,
          title: `Distribution relaunched: ${targetDistro}`,
          findings: [running ? 'Distribution was restarted.' : 'Distribution was launched.'],
          recommendations: ['Re-run the interrupted workflow.'],
          retryable: true,
        };
      }

      if (actionId === 'distro.enableSparse') {
        await setSparse(targetDistro, true);
        await refreshDistros();
        return {
          actionId,
          status: 'success',
          timestamp,
          title: `Sparse mode enabled for ${targetDistro}`,
          findings: ['Sparse mode mutation completed and distro state was refreshed.'],
          recommendations: ['Monitor disk reclaim behavior in subsequent operations.'],
          retryable: true,
        };
      }

      if (actionId === 'distro.openTerminal') {
        await openInTerminal(targetDistro);
        return {
          actionId,
          status: 'success',
          timestamp,
          title: `Opened terminal for ${targetDistro}`,
          findings: ['Terminal handoff completed.'],
          recommendations: ['Run detailed diagnostics commands as needed.'],
          retryable: true,
        };
      }

      return {
        actionId,
        status: 'blocked',
        timestamp,
        title: 'Assistance action blocked',
        findings: ['No handler defined for this action.'],
        recommendations: ['Refresh runtime state and retry.'],
        retryable: false,
      };
    } catch (err) {
      const message = String(err);
      setError(message);
      return {
        actionId,
        status: 'failed',
        timestamp,
        title: 'Assistance action failed',
        findings: ['Action execution failed.'],
        recommendations: ['Review diagnostics details and retry.', 'Run preflight before retrying.'],
        details: message,
        retryable: true,
      };
    }
  }, [
    getAssistanceActions,
    healthCheck,
    launch,
    openInTerminal,
    refreshCapabilities,
    refreshConfig,
    refreshDistros,
    refreshRunning,
    refreshStatus,
    runAssistancePreflight,
    runningDistros,
    setSparse,
    shutdown,
    terminate,
    updateWsl,
  ]);

  const mapErrorToAssistance = useCallback((
    errorMessage: string,
    scope: WslAssistanceScope,
    distroName?: string
  ): WslAssistanceSuggestion[] => {
    const lower = errorMessage.toLowerCase();
    const suggestions: WslAssistanceSuggestion[] = [];
    const pushSuggestion = (actionId: string, reason: string) => {
      if (!suggestions.some((entry) => entry.actionId === actionId)) {
        suggestions.push({ actionId, reason });
      }
    };

    const preflightId = scope === 'distro' ? 'distro.preflight' : 'runtime.preflight';
    const refreshId = scope === 'distro' ? 'distro.refreshState' : 'runtime.refreshState';
    pushSuggestion(preflightId, 'Validate runtime prerequisites first.');

    if (
      lower.includes('permission')
      || lower.includes('access is denied')
      || lower.includes('administrator')
    ) {
      pushSuggestion(refreshId, 'Refresh runtime state after adjusting privileges.');
    }
    if (
      lower.includes('unknown option')
      || lower.includes('not supported')
      || lower.includes('unsupported')
      || lower.includes('未识别')
      || lower.includes('不支持')
    ) {
      pushSuggestion(preflightId, 'Re-evaluate capability support before retry.');
    }
    if (scope === 'distro' && distroName) {
      if (lower.includes('network') || lower.includes('portproxy') || lower.includes('netsh')) {
        pushSuggestion('distro.healthCheck', 'Inspect distro network health and retry.');
      }
      if (lower.includes('terminated') || lower.includes('not running')) {
        pushSuggestion('distro.relaunch', 'Relaunch distro and retry the interrupted workflow.');
      }
    } else if (scope === 'runtime') {
      if (lower.includes('kernel') || lower.includes('update')) {
        pushSuggestion('runtime.updateKernel', 'Update runtime components and retry.');
      }
      if (lower.includes('timeout')) {
        pushSuggestion('runtime.refreshState', 'Refresh runtime state to reconcile stale status.');
      }
    }

    if (suggestions.length === 1) {
      pushSuggestion(refreshId, 'Refresh state before retrying the failed action.');
    }
    return suggestions;
  }, []);

  return {
    available,
    distros,
    onlineDistros,
    status,
    runningDistros,
    config,
    capabilities,
    loading,
    error,
    checkAvailability,
    refreshDistros,
    refreshOnlineDistros,
    refreshStatus,
    refreshRunning,
    refreshCapabilities,
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
    getVersionInfo,
    getCapabilities,
    setSparse,
    moveDistro,
    resizeDistro,
    installWslOnly,
    installOnlineDistro,
    unregisterDistro,
    installWithLocation,
    getTotalDiskUsage,
    detectDistroEnv,
    getDistroResources,
    listUsers,
    updateDistroPackages,
    openInExplorer,
    openInTerminal,
    cloneDistro,
    batchLaunch,
    batchTerminate,
    healthCheck,
    listPortForwards,
    addPortForward,
    removePortForward,
    backupDistro,
    listBackups,
    restoreBackup,
    deleteBackup,
    getAssistanceActions,
    runAssistancePreflight,
    executeAssistanceAction,
    mapErrorToAssistance,
    autoRefreshEnabled,
    setAutoRefresh,
  };
}
