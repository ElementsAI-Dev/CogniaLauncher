import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as tauri from '@/lib/tauri';
import { useWslStore } from '@/lib/stores/wsl';
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
  WslRuntimeSnapshot,
  WslDistroEnvironment,
  WslDistroResources,
  WslUser,
  WslPackageUpdateResult,
  WslExportWindowsEnvResult,
  WslDistroEnvReadResult,
  WslEnvEntry,
} from '@/types/tauri';
import type {
  WslAssistanceActionDescriptor,
  WslBatchWorkflowItemResult,
  WslBatchWorkflowPreset,
  WslBatchWorkflowSummary,
  WslAssistancePreflightCheck,
  WslAssistancePreflightResult,
  WslAssistanceSuggestion,
  WslAssistanceSummary,
  WslAssistanceScope,
  WslCompletenessSnapshot,
  WslDistroInfoSnapshot,
  WslInfoSection,
  WslOperationFailure,
  WslOperationId,
  WslRuntimeInfoSnapshot,
  WslPortForwardRule,
  WslBackupSchedule,
} from '@/types/wsl';
import {
  buildWslFailure,
  deriveWslCompleteness,
  resolveWslOperationGate,
} from '@/lib/wsl/completeness';
import {
  beginWslInfoLoading,
  createEmptyWslRuntimeInfoSnapshot,
  createUnavailableWslInfoSection,
  finalizeWslDistroInfoSnapshot,
  finalizeWslRuntimeInfoSnapshot,
  resolveWslInfoFailure,
  resolveWslInfoSuccess,
  syncWslDistroInfoSnapshots,
  createEmptyWslDistroInfoSnapshot,
} from '@/lib/wsl/information';
import {
  buildWslBatchWorkflowPreflight,
  getRetryableWorkflowTargetNames,
  getWslBatchWorkflowStepMeta,
  getWslBatchWorkflowSteps,
  normalizeWslBatchWorkflowPreset,
  type WslRefreshTarget,
  summarizeWslBatchWorkflowRun,
} from '@/lib/wsl/workflow';

const WSL_DEFAULT_BACKUP_DIR = '%USERPROFILE%\\WSL-Backups';
let wslBackupSchedulePollTimer: ReturnType<typeof setInterval> | null = null;
let wslBackupSchedulePollOwners = 0;
let wslBackupScheduleTickInFlight = false;

function scheduleIdentity(schedule: Pick<WslBackupSchedule, 'distro_name' | 'interval' | 'time'>): string {
  return `${schedule.distro_name}:${schedule.interval}:${schedule.time}`;
}

function computeNextBackupRun(
  schedule: Pick<WslBackupSchedule, 'interval' | 'time'>,
  fromDate: Date,
): string {
  const [hours, minutes] = schedule.time.split(':').map((value) => Number.parseInt(value, 10) || 0);
  const next = new Date(fromDate);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= fromDate.getTime()) {
    next.setDate(next.getDate() + (schedule.interval === 'daily' ? 1 : 7));
  }
  return next.toISOString();
}

function isBackupDue(schedule: WslBackupSchedule, now: Date): boolean {
  if (schedule.next_run) {
    return new Date(schedule.next_run).getTime() <= now.getTime();
  }

  return computeNextBackupRun(schedule, new Date(now.getTime() - 60_000)) <= now.toISOString();
}

async function syncTrayWslState(): Promise<void> {
  if (!tauri.isTauri()) {
    return;
  }

  try {
    const status = await tauri.wslGetStatus();
    await tauri.traySetWslState(
      status.runningDistros?.length ?? 0,
      status.defaultDistribution ?? null,
    );
    await tauri.trayRebuild();
  } catch {
    // Ignore tray sync failures when tray or WSL is unavailable.
  }
}

export interface UseWslReturn {
  // State
  available: boolean | null;
  distros: WslDistroStatus[];
  onlineDistros: [string, string][];
  status: WslStatus | null;
  runningDistros: string[];
  config: WslConfig | null;
  capabilities: WslCapabilities | null;
  runtimeSnapshot: WslRuntimeSnapshot | null;
  runtimeInfo: WslRuntimeInfoSnapshot;
  distroInfoByName: Record<string, WslDistroInfoSnapshot>;
  completeness: WslCompletenessSnapshot;
  lastFailure: WslOperationFailure | null;
  loading: boolean;
  error: string | null;

  // Actions
  checkAvailability: () => Promise<boolean>;
  refreshDistros: () => Promise<void>;
  refreshOnlineDistros: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshRunning: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  refreshRuntimeSnapshot: () => Promise<WslRuntimeSnapshot | null>;
  refreshRuntimeInfo: () => Promise<WslRuntimeInfoSnapshot>;
  refreshDistroInfo: (distroName: string) => Promise<WslDistroInfoSnapshot | null>;
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
  setNetworkingMode: (mode: 'NAT' | 'mirrored' | 'virtioproxy') => Promise<void>;
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
  exportWindowsEnv: (distro: string) => Promise<WslExportWindowsEnvResult | null>;
  readDistroEnv: (distro: string) => Promise<WslDistroEnvReadResult | null>;
  getWslenv: () => Promise<WslEnvEntry[]>;
  setWslenv: (entries: WslEnvEntry[]) => Promise<void>;
  getDistroResources: (distro: string) => Promise<WslDistroResources | null>;
  listUsers: (distro: string) => Promise<WslUser[]>;
  updateDistroPackages: (distro: string, mode: string) => Promise<WslPackageUpdateResult>;
  openInExplorer: (name: string) => Promise<void>;
  openInTerminal: (name: string) => Promise<void>;
  cloneDistro: (name: string, newName: string, location: string) => Promise<string>;
  batchLaunch: (names: string[]) => Promise<[string, boolean, string][]>;
  batchTerminate: (names: string[]) => Promise<[string, boolean, string][]>;
  runBatchWorkflow: (
    workflow: WslBatchWorkflowPreset,
    options?: {
      selectedDistros?: Iterable<string>;
      distroTags?: Record<string, string[]>;
    }
  ) => Promise<WslBatchWorkflowSummary>;
  retryBatchWorkflowFailures: (
    summary: WslBatchWorkflowSummary,
    options?: { distroTags?: Record<string, string[]> }
  ) => Promise<WslBatchWorkflowSummary>;
  healthCheck: (distro: string) => Promise<{ status: string; issues: { severity: string; category: string; message: string }[]; checkedAt: string }>;
  listPortForwards: () => Promise<WslPortForwardRule[]>;
  addPortForward: (
    listenAddress: string,
    listenPort: number,
    connectPort: number,
    connectAddress: string
  ) => Promise<void>;
  removePortForward: (listenAddress: string, listenPort: number) => Promise<void>;
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
  const backupSchedules = useWslStore((state) => state.backupSchedules);
  const replaceBackupSchedules = useWslStore((state) => state.replaceBackupSchedules);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [distros, setDistros] = useState<WslDistroStatus[]>([]);
  const [onlineDistros, setOnlineDistros] = useState<[string, string][]>([]);
  const [status, setStatus] = useState<WslStatus | null>(null);
  const [runningDistros, setRunningDistros] = useState<string[]>([]);
  const [config, setConfig] = useState<WslConfig | null>(null);
  const [capabilities, setCapabilities] = useState<WslCapabilities | null>(null);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<WslRuntimeSnapshot | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<WslRuntimeInfoSnapshot>(() => createEmptyWslRuntimeInfoSnapshot());
  const [distroInfoByName, setDistroInfoByName] = useState<Record<string, WslDistroInfoSnapshot>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailure, setLastFailure] = useState<WslOperationFailure | null>(null);
  const runtimeInfoRef = useRef(runtimeInfo);
  const distroInfoRef = useRef(distroInfoByName);
  const distrosRef = useRef(distros);
  const backupSchedulesRef = useRef(backupSchedules);

  useEffect(() => {
    runtimeInfoRef.current = runtimeInfo;
  }, [runtimeInfo]);

  useEffect(() => {
    distroInfoRef.current = distroInfoByName;
  }, [distroInfoByName]);

  useEffect(() => {
    distrosRef.current = distros;
  }, [distros]);

  useEffect(() => {
    backupSchedulesRef.current = backupSchedules;
  }, [backupSchedules]);

  const clearWslFailure = useCallback(() => {
    setError(null);
    setLastFailure(null);
  }, []);

  const recordWslFailure = useCallback((err: unknown): never => {
    const failure = buildWslFailure(err);
    setError(failure.message);
    setLastFailure(failure);
    throw new Error(failure.message);
  }, []);

  const assertOperationSupported = useCallback((operationId: WslOperationId) => {
    const gate = resolveWslOperationGate(
      operationId,
      available,
      capabilities,
      runtimeSnapshot
    );
    if (gate.supported) {
      return;
    }
    const raw = `[WSL_UNSUPPORTED:${operationId}] ${gate.reason ?? 'Operation is unsupported in current runtime.'}`;
    recordWslFailure(raw);
  }, [available, capabilities, recordWslFailure, runtimeSnapshot]);

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (!tauri.isTauri()) {
      setAvailable(false);
      setCapabilities(null);
      setRuntimeSnapshot(null);
      return false;
    }
    try {
      const snapshot = await tauri.wslGetRuntimeSnapshot();
      setRuntimeSnapshot(snapshot);
      setAvailable(snapshot.available);
      if (!snapshot.available) {
        setCapabilities(null);
      }
      return snapshot.available;
    } catch {
      try {
        const result = await tauri.wslIsAvailable();
        setAvailable(result);
        setRuntimeSnapshot(null);
        if (!result) {
          setCapabilities(null);
        }
        return result;
      } catch {
        setAvailable(false);
        setCapabilities(null);
        setRuntimeSnapshot(null);
        return false;
      }
    }
  }, []);

  const refreshDistros = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      setLoading(true);
      setError(null);
      const result = await tauri.wslListDistros();
      distrosRef.current = result;
      setDistros(result);
      setDistroInfoByName((current) => syncWslDistroInfoSnapshots(result, current));
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
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        status: resolveWslInfoSuccess(current.status, result),
      }));
    } catch (err) {
      console.error('Failed to get WSL status:', err);
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        status: resolveWslInfoFailure(current.status, err, {
          reason: 'WSL status could not be read.',
        }),
      }));
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
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        capabilities: resolveWslInfoSuccess(current.capabilities, result),
      }));
    } catch (err) {
      console.error('Failed to detect WSL capabilities:', err);
      setCapabilities(null);
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        capabilities: resolveWslInfoFailure(current.capabilities, err, {
          reason: 'WSL capabilities could not be detected.',
        }),
      }));
    }
  }, []);

  const refreshRuntimeSnapshot = useCallback(async (): Promise<WslRuntimeSnapshot | null> => {
    if (!tauri.isTauri()) return null;
    try {
      const snapshot = await tauri.wslGetRuntimeSnapshot();
      setRuntimeSnapshot(snapshot);
      setAvailable(snapshot.available);
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        runtime: resolveWslInfoSuccess(current.runtime, snapshot),
      }));
      return snapshot;
    } catch (err) {
      console.error('Failed to detect staged WSL runtime snapshot:', err);
      setRuntimeSnapshot(null);
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        runtime: resolveWslInfoFailure(current.runtime, err, {
          reason: 'WSL runtime readiness could not be detected.',
        }),
      }));
      return null;
    }
  }, []);

  const refreshRuntimeInfo = useCallback(async (): Promise<WslRuntimeInfoSnapshot> => {
    if (!tauri.isTauri()) {
      const empty = createEmptyWslRuntimeInfoSnapshot();
      setRuntimeInfo(empty);
      return empty;
    }

    const previous = runtimeInfoRef.current;
    setRuntimeInfo((current) => ({
      ...current,
      state: 'loading',
      runtime: beginWslInfoLoading(current.runtime, 'Refreshing WSL runtime information.'),
      status: beginWslInfoLoading(current.status, 'Refreshing WSL runtime information.'),
      capabilities: beginWslInfoLoading(current.capabilities, 'Refreshing WSL runtime information.'),
      versionInfo: beginWslInfoLoading(current.versionInfo, 'Refreshing WSL runtime information.'),
    }));

    const [runtimeResult, statusResult, capabilityResult, versionResult] = await Promise.allSettled([
      tauri.wslGetRuntimeSnapshot(),
      tauri.wslGetStatus(),
      tauri.wslGetCapabilities(),
      tauri.wslGetVersionInfo(),
    ]);

    const nextRuntimeInfo = finalizeWslRuntimeInfoSnapshot({
      ...previous,
      runtime: runtimeResult.status === 'fulfilled'
        ? resolveWslInfoSuccess(previous.runtime, runtimeResult.value)
        : resolveWslInfoFailure(previous.runtime, runtimeResult.reason, {
          reason: 'WSL runtime readiness could not be detected.',
        }),
      status: statusResult.status === 'fulfilled'
        ? resolveWslInfoSuccess(previous.status, statusResult.value)
        : resolveWslInfoFailure(previous.status, statusResult.reason, {
          reason: 'WSL status could not be read.',
        }),
      capabilities: capabilityResult.status === 'fulfilled'
        ? resolveWslInfoSuccess(previous.capabilities, capabilityResult.value)
        : resolveWslInfoFailure(previous.capabilities, capabilityResult.reason, {
          reason: 'WSL capabilities could not be detected.',
        }),
      versionInfo: versionResult.status === 'fulfilled'
        ? resolveWslInfoSuccess(previous.versionInfo, versionResult.value)
        : resolveWslInfoFailure(previous.versionInfo, versionResult.reason, {
          reason: 'WSL version details could not be detected.',
        }),
    });

    setRuntimeInfo(nextRuntimeInfo);

    if (runtimeResult.status === 'fulfilled') {
      setRuntimeSnapshot(runtimeResult.value);
      setAvailable(runtimeResult.value.available);
    }
    if (statusResult.status === 'fulfilled') {
      setStatus(statusResult.value);
    }
    if (capabilityResult.status === 'fulfilled') {
      setCapabilities(capabilityResult.value);
    }

    return nextRuntimeInfo;
  }, []);

  const refreshDistroInfo = useCallback(async (distroName: string): Promise<WslDistroInfoSnapshot | null> => {
    if (!tauri.isTauri()) return null;

    const distro = distrosRef.current.find((entry) => entry.name === distroName);
    const previous = distroInfoRef.current[distroName] ?? createEmptyWslDistroInfoSnapshot(distroName, distro?.state ?? null);

    setDistroInfoByName((current) => ({
      ...current,
      [distroName]: finalizeWslDistroInfoSnapshot({
        ...previous,
        distroState: distro?.state ?? previous.distroState,
        state: 'loading',
        diskUsage: beginWslInfoLoading(previous.diskUsage, 'Refreshing distribution information.'),
        ipAddress: beginWslInfoLoading(previous.ipAddress, 'Refreshing distribution information.'),
        environment: beginWslInfoLoading(previous.environment, 'Refreshing distribution information.'),
        resources: beginWslInfoLoading(previous.resources, 'Refreshing distribution information.'),
        portForwards: beginWslInfoLoading(previous.portForwards, 'Refreshing distribution information.'),
      }),
    }));

    let diskUsage: WslInfoSection<WslDiskUsage>;
    try {
      diskUsage = resolveWslInfoSuccess(previous.diskUsage, await tauri.wslDiskUsage(distroName));
    } catch (err) {
      diskUsage = resolveWslInfoFailure(previous.diskUsage, err, {
        reason: 'Disk usage could not be loaded.',
      });
    }

    const isRunning = (distro?.state ?? '').toLowerCase() === 'running';
    let ipAddress: WslInfoSection<string>;
    let environment: WslInfoSection<WslDistroEnvironment>;
    let resources: WslInfoSection<WslDistroResources>;
    let portForwards: WslInfoSection<WslPortForwardRule[]>;

    try {
      portForwards = resolveWslInfoSuccess(previous.portForwards, await tauri.wslListPortForwards());
    } catch (err) {
      portForwards = resolveWslInfoFailure(previous.portForwards, err, {
        reason: 'Port forwarding rules could not be loaded.',
      });
    }

    if (!isRunning) {
      ipAddress = createUnavailableWslInfoSection('Distribution is not running.');
      environment = createUnavailableWslInfoSection('Distribution is not running.');
      resources = createUnavailableWslInfoSection('Distribution is not running.');
    } else {
      try {
        ipAddress = resolveWslInfoSuccess(previous.ipAddress, await tauri.wslGetIp(distroName));
      } catch (err) {
        ipAddress = resolveWslInfoFailure(previous.ipAddress, err, {
          reason: 'IP address could not be loaded.',
        });
      }

      try {
        environment = resolveWslInfoSuccess(previous.environment, await tauri.wslDetectDistroEnv(distroName));
      } catch (err) {
        environment = resolveWslInfoFailure(previous.environment, err, {
          reason: 'Distribution environment could not be detected.',
        });
      }

      try {
        resources = resolveWslInfoSuccess(previous.resources, await tauri.wslGetDistroResources(distroName));
      } catch (err) {
        resources = resolveWslInfoFailure(previous.resources, err, {
          reason: 'Live resource usage could not be loaded.',
        });
      }
    }

    const nextSnapshot = finalizeWslDistroInfoSnapshot({
      ...previous,
      distroState: distro?.state ?? previous.distroState,
      diskUsage,
      ipAddress,
      environment,
      resources,
      portForwards,
    });

    setDistroInfoByName((current) => ({
      ...current,
      [distroName]: nextSnapshot,
    }));

    return nextSnapshot;
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

  const setNetworkingMode = useCallback(async (
    mode: 'NAT' | 'mirrored' | 'virtioproxy',
  ) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      clearWslFailure();
      await tauri.wslSetNetworkingMode(mode);
      await refreshConfig();
    } catch (err) {
      recordWslFailure(err);
    }
  }, [clearWslFailure, recordWslFailure, refreshConfig]);

  const refreshAll = useCallback(async () => {
    if (!tauri.isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const [runtimeInfoResult, distroResult, onlineResult, runningResult, configResult] =
        await Promise.allSettled([
          refreshRuntimeInfo(),
          tauri.wslListDistros(),
          tauri.wslListOnline(),
          tauri.wslListRunning(),
          tauri.wslGetConfig(),
        ]);

      if (runtimeInfoResult.status === 'rejected') {
        setError(String(runtimeInfoResult.reason));
      }
      if (distroResult.status === 'fulfilled') {
        distrosRef.current = distroResult.value;
        setDistros(distroResult.value);
        setDistroInfoByName((current) => syncWslDistroInfoSnapshots(distroResult.value, current));
      }
      if (onlineResult.status === 'fulfilled') setOnlineDistros(onlineResult.value);
      if (runningResult.status === 'fulfilled') setRunningDistros(runningResult.value);
      if (configResult.status === 'fulfilled') setConfig(configResult.value);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [refreshRuntimeInfo]);

  const refreshInventoryState = useCallback(async () => {
    await Promise.all([
      refreshRuntimeInfo(),
      refreshDistros(),
      refreshRunning(),
    ]);
  }, [refreshDistros, refreshRunning, refreshRuntimeInfo]);

  const refreshRuntimeState = useCallback(async () => {
    await Promise.all([
      refreshRuntimeInfo(),
      refreshDistros(),
      refreshRunning(),
      refreshConfig(),
    ]);
  }, [
    refreshConfig,
    refreshDistros,
    refreshRunning,
    refreshRuntimeInfo,
  ]);

  const terminate = useCallback(async (name: string) => {
    if (!tauri.isTauri()) return;
    try {
      setError(null);
      await tauri.wslTerminate(name);
      await refreshInventoryState();
      await syncTrayWslState();
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
      await syncTrayWslState();
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
      await syncTrayWslState();
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
      clearWslFailure();
      assertOperationSupported('runtime.importInPlace');
      await tauri.wslImportInPlace(name, vhdxPath);
      await refreshDistros();
    } catch (err) {
      recordWslFailure(err);
    }
  }, [assertOperationSupported, clearWslFailure, recordWslFailure, refreshDistros]);

  const mountDisk = useCallback(async (options: WslMountOptions): Promise<string> => {
    if (!tauri.isTauri()) return '';
    try {
      clearWslFailure();
      assertOperationSupported('runtime.mount');
      if (options.mountOptions) {
        assertOperationSupported('runtime.mountWithOptions');
      }
      return await tauri.wslMount(options);
    } catch (err) {
      recordWslFailure(err);
      throw err;
    }
  }, [assertOperationSupported, clearWslFailure, recordWslFailure]);

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
      const versionInfo = await tauri.wslGetVersionInfo();
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        versionInfo: resolveWslInfoSuccess(current.versionInfo, versionInfo),
      }));
      return versionInfo;
    } catch (err) {
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        versionInfo: resolveWslInfoFailure(current.versionInfo, err, {
          reason: 'WSL version details could not be detected.',
        }),
      }));
      return null;
    }
  }, []);

  const getCapabilities = useCallback(async (): Promise<WslCapabilities | null> => {
    if (!tauri.isTauri()) return null;
    try {
      const detected = await tauri.wslGetCapabilities();
      setCapabilities(detected);
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        capabilities: resolveWslInfoSuccess(current.capabilities, detected),
      }));
      return detected;
    } catch (err) {
      setRuntimeInfo((current) => finalizeWslRuntimeInfoSnapshot({
        ...current,
        capabilities: resolveWslInfoFailure(current.capabilities, err, {
          reason: 'WSL capabilities could not be detected.',
        }),
      }));
      return null;
    }
  }, []);

  const setSparse = useCallback(async (distro: string, enabled: boolean) => {
    if (!tauri.isTauri()) return;
    try {
      clearWslFailure();
      assertOperationSupported('distro.setSparse');
      await tauri.wslSetSparse(distro, enabled);
      await refreshInventoryState();
    } catch (err) {
      recordWslFailure(err);
    }
  }, [assertOperationSupported, clearWslFailure, recordWslFailure, refreshInventoryState]);

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
      const environment = await tauri.wslDetectDistroEnv(distro);
      setDistroInfoByName((current) => ({
        ...current,
        [distro]: finalizeWslDistroInfoSnapshot({
          ...(current[distro] ?? createEmptyWslDistroInfoSnapshot(distro)),
          environment: resolveWslInfoSuccess(current[distro]?.environment ?? null, environment),
        }),
      }));
      return environment;
    } catch (err) {
      setDistroInfoByName((current) => ({
        ...current,
        [distro]: finalizeWslDistroInfoSnapshot({
          ...(current[distro] ?? createEmptyWslDistroInfoSnapshot(distro)),
          environment: resolveWslInfoFailure(current[distro]?.environment ?? null, err, {
            reason: 'Distribution environment could not be detected.',
          }),
        }),
      }));
      return null;
    }
  }, []);

  const exportWindowsEnv = useCallback(async (
    distro: string,
  ): Promise<WslExportWindowsEnvResult | null> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      return await tauri.wslExportWindowsEnv(distro);
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, []);

  const readDistroEnv = useCallback(async (
    distro: string,
  ): Promise<WslDistroEnvReadResult | null> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      return await tauri.wslReadDistroEnv(distro);
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, []);

  const getWslenv = useCallback(async (): Promise<WslEnvEntry[]> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      return await tauri.wslGetWslenv();
    } catch (err) {
      setError(String(err));
      return [];
    }
  }, []);

  const setWslenv = useCallback(async (entries: WslEnvEntry[]): Promise<void> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      await tauri.wslSetWslenv(entries);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }, []);

  const getDistroResources = useCallback(async (distro: string): Promise<WslDistroResources | null> => {
    if (!tauri.isTauri()) return null;
    try {
      const resources = await tauri.wslGetDistroResources(distro);
      setDistroInfoByName((current) => ({
        ...current,
        [distro]: finalizeWslDistroInfoSnapshot({
          ...(current[distro] ?? createEmptyWslDistroInfoSnapshot(distro)),
          resources: resolveWslInfoSuccess(current[distro]?.resources ?? null, resources),
        }),
      }));
      return resources;
    } catch (err) {
      setDistroInfoByName((current) => ({
        ...current,
        [distro]: finalizeWslDistroInfoSnapshot({
          ...(current[distro] ?? createEmptyWslDistroInfoSnapshot(distro)),
          resources: resolveWslInfoFailure(current[distro]?.resources ?? null, err, {
            reason: 'Live resource usage could not be loaded.',
          }),
        }),
      }));
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

  const completeness = useMemo(
    () => deriveWslCompleteness(available, distros, status, capabilities, runtimeSnapshot),
    [available, capabilities, distros, runtimeSnapshot, status]
  );

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

  const refreshBatchWorkflowTargets = useCallback(async (targets: WslRefreshTarget[]) => {
    const uniqueTargets = new Set(targets);

    if (uniqueTargets.has('config') && (uniqueTargets.has('inventory') || uniqueTargets.has('runtime'))) {
      await refreshRuntimeState();
      return;
    }

    if (uniqueTargets.has('inventory') && uniqueTargets.has('runtime')) {
      await refreshRuntimeState();
      return;
    }

    if (uniqueTargets.has('inventory')) {
      await refreshInventoryState();
    }

    if (uniqueTargets.has('runtime')) {
      await Promise.all([
        refreshRuntimeSnapshot(),
        refreshStatus(),
        refreshCapabilities(),
      ]);
    }

    if (uniqueTargets.has('config')) {
      await refreshConfig();
    }
  }, [
    refreshCapabilities,
    refreshConfig,
    refreshInventoryState,
    refreshRuntimeSnapshot,
    refreshRuntimeState,
    refreshStatus,
  ]);

  const healthCheck = useCallback(async (distro: string) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      clearWslFailure();
      assertOperationSupported('distro.healthCheck');
      return await tauri.wslDistroHealthCheck(distro);
    } catch (err) {
      recordWslFailure(err);
      throw err;
    }
  }, [assertOperationSupported, clearWslFailure, recordWslFailure]);

  const listPortForwards = useCallback(async () => {
    if (!tauri.isTauri()) return [];
    try {
      clearWslFailure();
      assertOperationSupported('network.portForward');
      return await tauri.wslListPortForwards();
    } catch (err) {
      recordWslFailure(err);
      return [];
    }
  }, [assertOperationSupported, clearWslFailure, recordWslFailure]);

  const addPortForward = useCallback(async (
    listenAddress: string,
    listenPort: number,
    connectPort: number,
    connectAddress: string,
  ) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      clearWslFailure();
      assertOperationSupported('network.portForward');
      await tauri.wslAddPortForward(listenAddress, listenPort, connectPort, connectAddress);
    } catch (err) {
      recordWslFailure(err);
    }
  }, [assertOperationSupported, clearWslFailure, recordWslFailure]);

  const removePortForward = useCallback(async (listenAddress: string, listenPort: number) => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      clearWslFailure();
      assertOperationSupported('network.portForward');
      await tauri.wslRemovePortForward(listenAddress, listenPort);
    } catch (err) {
      recordWslFailure(err);
    }
  }, [assertOperationSupported, clearWslFailure, recordWslFailure]);

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

  const runBackupScheduleTick = useCallback(async (now = new Date()) => {
    if (!tauri.isTauri() || wslBackupScheduleTickInFlight) {
      return;
    }

    const schedules = backupSchedulesRef.current;
    if (schedules.length === 0) {
      return;
    }

    const scheduleUpdates = new Map<string, WslBackupSchedule>();
    wslBackupScheduleTickInFlight = true;
    try {
      for (const schedule of schedules) {
        if (!isBackupDue(schedule, now)) {
          continue;
        }

        try {
          await backupDistro(schedule.distro_name, WSL_DEFAULT_BACKUP_DIR);
          const backups = await listBackups(WSL_DEFAULT_BACKUP_DIR);
          const distroBackups = backups
            .filter((entry) => entry.distroName === schedule.distro_name)
            .sort((left, right) => (
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
            ));
          const staleBackups = distroBackups.slice(schedule.retention);
          for (const staleBackup of staleBackups) {
            await deleteBackup(staleBackup.filePath);
          }

          scheduleUpdates.set(scheduleIdentity(schedule), {
            ...schedule,
            last_run: now.toISOString(),
            next_run: computeNextBackupRun(schedule, now),
          });
        } catch {
          // Keep the schedule intact so it can retry on the next polling cycle.
        }
      }

      if (scheduleUpdates.size > 0) {
        replaceBackupSchedules(
          schedules.map((schedule) => scheduleUpdates.get(scheduleIdentity(schedule)) ?? schedule),
        );
      }
    } finally {
      wslBackupScheduleTickInFlight = false;
    }
  }, [backupDistro, deleteBackup, listBackups, replaceBackupSchedules]);

  useEffect(() => {
    if (!tauri.isTauri()) {
      return;
    }

    wslBackupSchedulePollOwners += 1;

    if (!wslBackupSchedulePollTimer) {
      wslBackupSchedulePollTimer = setInterval(() => {
        void runBackupScheduleTick(new Date());
      }, 60_000);
    }

    void runBackupScheduleTick(new Date());

    return () => {
      wslBackupSchedulePollOwners -= 1;
      if (wslBackupSchedulePollOwners <= 0 && wslBackupSchedulePollTimer) {
        clearInterval(wslBackupSchedulePollTimer);
        wslBackupSchedulePollTimer = null;
        wslBackupSchedulePollOwners = 0;
      }
    };
  }, [runBackupScheduleTick]);

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

    const stagedSnapshot = await refreshRuntimeSnapshot();
    const availableNow = stagedSnapshot?.available ?? await checkAvailability();
    checks.push({
      id: 'runtime-availability',
      label: 'Runtime Availability',
      status: availableNow ? 'healthy' : 'error',
      detail: availableNow
        ? stagedSnapshot?.reason ?? 'WSL runtime is available.'
        : stagedSnapshot?.reason ?? 'WSL runtime is unavailable.',
      recommendation: availableNow ? undefined : 'Install or enable WSL before retrying.',
    });

    if (stagedSnapshot?.state === 'degraded') {
      checks.push({
        id: 'runtime-detection-state',
        label: 'Runtime Detection State',
        status: 'warning',
        detail: stagedSnapshot.reason || 'Runtime is degraded due to incomplete probes.',
        recommendation: 'Refresh runtime state and address missing probe prerequisites.',
      });
      recommendations.push(...stagedSnapshot.degradedReasons);
      recommendations.push('Refresh runtime state and address missing probe prerequisites.');
    }

    if (stagedSnapshot?.state === 'empty') {
      checks.push({
        id: 'runtime-detection-state',
        label: 'Runtime Detection State',
        status: 'warning',
        detail: stagedSnapshot.reason || 'Runtime is available, but no distributions were found.',
        recommendation: 'Install or import a distribution before running distro workflows.',
      });
      recommendations.push('Install or import a distribution before running distro workflows.');
    }

    if (!availableNow) {
      return {
        status: 'error',
        timestamp,
        checks,
        recommendations: Array.from(
          new Set([
            stagedSnapshot?.reason ?? 'Install or enable WSL before retrying.',
            'Install or enable WSL before retrying.',
          ])
        ),
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
  }, [
    capabilities,
    checkAvailability,
    distros,
    refreshRuntimeSnapshot,
    runningDistros,
    status,
  ]);

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

  const runBatchWorkflow = useCallback(async (
    workflow: WslBatchWorkflowPreset,
    options?: {
      selectedDistros?: Iterable<string>;
      distroTags?: Record<string, string[]>;
      startFromStepIndex?: number;
      startFromStepIndexByTarget?: Record<string, number>;
    }
  ): Promise<WslBatchWorkflowSummary> => {
    const normalizedWorkflow = normalizeWslBatchWorkflowPreset(workflow);
    const workflowSteps = getWslBatchWorkflowSteps(normalizedWorkflow);
    const startedAt = new Date().toISOString();
    const preflight = buildWslBatchWorkflowPreflight({
      workflow: normalizedWorkflow,
      distros,
      selectedDistros: options?.selectedDistros ?? [],
      distroTags: options?.distroTags ?? {},
      capabilities,
      resolveAssistanceAction: (distroName, actionId) =>
        getAssistanceActions('distro', distroName).find((action) => action.id === actionId),
    });
    const executionResults: WslBatchWorkflowItemResult[] = [];
    const startFromStepIndex = options?.startFromStepIndex ?? 0;
    const startFromStepIndexByTarget = options?.startFromStepIndexByTarget ?? {};
    const finalRefreshTargets = new Set<WslRefreshTarget>();

    if (tauri.isTauri()) {
      const preflightTargetsByName = new Map(
        preflight.targets.map((target) => [target.distroName, target] as const)
      );
      const runnableTargets = preflight.targets
        .filter((target) => target.status === 'runnable')
        .map((target) => target.distroName);
      const activeTargets = new Set(runnableTargets);

      for (let stepIndex = startFromStepIndex; stepIndex < workflowSteps.length; stepIndex += 1) {
        const step = workflowSteps[stepIndex];
        const stepLabel = preflight.steps[stepIndex]?.label ?? step.label ?? step.id;
        const stepMeta = getWslBatchWorkflowStepMeta(step);
        stepMeta.refreshTargets.forEach((target) => finalRefreshTargets.add(target));

        const targetNames = Array.from(activeTargets);
        if (targetNames.length === 0) {
          break;
        }

        const failedTargets: string[] = [];
        const stepRunnableTargets: string[] = [];

        for (const distroName of targetNames) {
          const targetStartIndex = startFromStepIndexByTarget[distroName] ?? startFromStepIndex;
          if (stepIndex < targetStartIndex) {
            continue;
          }

          const stepStatus = preflightTargetsByName.get(distroName)?.stepStatuses[stepIndex];
          if (stepStatus?.status === 'skipped') {
            executionResults.push({
              stepId: step.id,
              stepLabel,
              distroName,
              status: 'skipped',
              detail: stepStatus.reason,
              retryable: false,
            });
            continue;
          }
          stepRunnableTargets.push(distroName);
        }

        if (
          step.kind === 'lifecycle'
          && (step.operation === 'launch' || step.operation === 'terminate')
          && stepRunnableTargets.length > 0
        ) {
          const rawResults = step.operation === 'launch'
            ? await batchLaunch(stepRunnableTargets)
            : await batchTerminate(stepRunnableTargets);
          executionResults.push(
            ...rawResults.map<WslBatchWorkflowItemResult>(([distroName, ok, detail]) => ({
              stepId: step.id,
              stepLabel,
              distroName,
              status: ok ? 'success' : 'failed',
              detail,
              retryable: !ok,
            }))
          );
          failedTargets.push(
            ...rawResults
              .filter(([, ok]) => !ok)
              .map(([distroName]) => distroName)
          );
        } else {
          for (const distroName of stepRunnableTargets) {
            try {
              if (step.kind === 'command') {
                const result = await execCommand(distroName, step.command, step.user);
                const failed = result.exitCode !== 0;
                executionResults.push({
                  stepId: step.id,
                  stepLabel,
                  distroName,
                  status: failed ? 'failed' : 'success',
                  detail: result.stderr || result.stdout,
                  retryable: failed,
                });
                if (failed) {
                  failedTargets.push(distroName);
                }
                continue;
              }

              if (step.kind === 'health-check') {
                const result = await healthCheck(distroName);
                const failed = result.status === 'error';
                executionResults.push({
                  stepId: step.id,
                  stepLabel,
                  distroName,
                  status: failed ? 'failed' : 'success',
                  detail: result.issues[0]?.message,
                  retryable: true,
                });
                if (failed) {
                  failedTargets.push(distroName);
                }
                continue;
              }

              if (step.kind === 'assistance') {
                const result = await executeAssistanceAction(step.actionId, 'distro', distroName);
                const status = result.status === 'success'
                  ? 'success'
                  : result.status === 'blocked'
                    ? 'skipped'
                    : 'failed';
                executionResults.push({
                  stepId: step.id,
                  stepLabel,
                  distroName,
                  status,
                  detail: result.details ?? result.findings[0],
                  retryable: result.retryable,
                });
                if (status === 'failed') {
                  failedTargets.push(distroName);
                }
                continue;
              }

              if (step.kind === 'backup') {
                const result = await backupDistro(
                  distroName,
                  step.destinationPath ?? '%USERPROFILE%\\WSL-Backups'
                );
                executionResults.push({
                  stepId: step.id,
                  stepLabel,
                  distroName,
                  status: 'success',
                  detail: result.fileName,
                  retryable: false,
                });
                continue;
              }

              if (step.kind === 'package-upkeep') {
                const result = await updateDistroPackages(distroName, step.mode);
                const failed = result.exitCode !== 0;
                executionResults.push({
                  stepId: step.id,
                  stepLabel,
                  distroName,
                  status: failed ? 'failed' : 'success',
                  detail: result.stderr || result.stdout,
                  retryable: true,
                });
                if (failed) {
                  failedTargets.push(distroName);
                }
                continue;
              }

              if (step.kind === 'lifecycle' && step.operation === 'relaunch') {
                const result = await executeAssistanceAction('distro.relaunch', 'distro', distroName);
                const failed = result.status !== 'success';
                executionResults.push({
                  stepId: step.id,
                  stepLabel,
                  distroName,
                  status: failed ? 'failed' : 'success',
                  detail: result.details ?? result.findings[0],
                  retryable: result.retryable,
                });
                if (failed) {
                  failedTargets.push(distroName);
                }
              }
            } catch (err) {
              executionResults.push({
                stepId: step.id,
                stepLabel,
                distroName,
                status: 'failed',
                detail: String(err),
                retryable: true,
              });
              failedTargets.push(distroName);
            }
          }
        }

        if (stepIndex < workflowSteps.length - 1) {
          const skippedTargets = Array.from(new Set(failedTargets));
          for (const failedTarget of skippedTargets) {
            for (let laterStepIndex = stepIndex + 1; laterStepIndex < workflowSteps.length; laterStepIndex += 1) {
              const laterStep = workflowSteps[laterStepIndex];
              const laterStepLabel = preflight.steps[laterStepIndex]?.label ?? laterStep.label ?? laterStep.id;
              executionResults.push({
                stepId: laterStep.id,
                stepLabel: laterStepLabel,
                distroName: failedTarget,
                status: 'skipped',
                detail: `Blocked by failed step: ${stepLabel}`,
                retryable: false,
              });
            }
            activeTargets.delete(failedTarget);
          }
        }

        if (stepIndex < workflowSteps.length - 1 && stepMeta.refreshTargets.length > 0) {
          await refreshBatchWorkflowTargets(stepMeta.refreshTargets);
        }
      }

      if (finalRefreshTargets.size > 0) {
        await refreshBatchWorkflowTargets(Array.from(finalRefreshTargets));
      }
    }

    return summarizeWslBatchWorkflowRun({
      workflow: normalizedWorkflow,
      preflight,
      startedAt,
      completedAt: new Date().toISOString(),
      executionResults,
    });
  }, [
    backupDistro,
    batchLaunch,
    batchTerminate,
    capabilities,
    distros,
    execCommand,
    executeAssistanceAction,
    getAssistanceActions,
    healthCheck,
    refreshBatchWorkflowTargets,
    updateDistroPackages,
  ]);

  const retryBatchWorkflowFailures = useCallback(async (
    summary: WslBatchWorkflowSummary,
    options?: { distroTags?: Record<string, string[]> }
  ): Promise<WslBatchWorkflowSummary> => {
    const retryTargets = getRetryableWorkflowTargetNames(summary);

    if (retryTargets.length === 0) {
      return summary;
    }

    return runBatchWorkflow(
      {
        ...summary.workflow,
        target: { mode: 'explicit', distroNames: retryTargets },
        updatedAt: new Date().toISOString(),
      },
      {
        selectedDistros: retryTargets,
        distroTags: options?.distroTags ?? {},
        startFromStepIndex: summary.resumeFromStepIndex ?? 0,
        startFromStepIndexByTarget: Object.fromEntries(
          retryTargets.map((distroName) => [
            distroName,
            summary.resumeFromStepIndexByDistro?.[distroName] ?? summary.resumeFromStepIndex ?? 0,
          ]),
        ),
      }
    );
  }, [runBatchWorkflow]);

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
    runtimeSnapshot,
    runtimeInfo,
    distroInfoByName,
    completeness,
    lastFailure,
    loading,
    error,
    checkAvailability,
    refreshDistros,
    refreshOnlineDistros,
    refreshStatus,
    refreshRunning,
    refreshCapabilities,
    refreshRuntimeSnapshot,
    refreshRuntimeInfo,
    refreshDistroInfo,
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
    setNetworkingMode,
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
    exportWindowsEnv,
    readDistroEnv,
    getWslenv,
    setWslenv,
    getDistroResources,
    listUsers,
    updateDistroPackages,
    openInExplorer,
    openInTerminal,
    cloneDistro,
    batchLaunch,
    batchTerminate,
    runBatchWorkflow,
    retryBatchWorkflowFailures,
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
