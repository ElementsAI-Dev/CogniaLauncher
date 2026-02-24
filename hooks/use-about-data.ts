'use client';

import { useEffect, useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import { isTauri } from '@/lib/platform';
import { APP_VERSION } from '@/lib/app-version';
import { toast } from 'sonner';

export interface SystemInfo {
  os: string;
  arch: string;
  osVersion: string;
  osLongVersion: string;
  kernelVersion: string;
  hostname: string;
  osName: string;
  distributionId: string;
  cpuArch: string;
  cpuModel: string;
  cpuVendorId: string;
  cpuFrequency: number;
  cpuCores: number;
  physicalCoreCount: number | null;
  globalCpuUsage: number;
  totalMemory: number;
  availableMemory: number;
  usedMemory: number;
  totalSwap: number;
  usedSwap: number;
  uptime: number;
  bootTime: number;
  loadAverage: [number, number, number];
  gpus: tauri.GpuInfo[];
  appVersion: string;
  homeDir: string;
  locale: string;
}

export interface UseAboutDataReturn {
  updateInfo: tauri.SelfUpdateInfo | null;
  loading: boolean;
  updating: boolean;
  updateProgress: number;
  updateStatus: 'idle' | 'downloading' | 'installing' | 'done' | 'error';
  error: string | null;
  systemError: string | null;
  systemInfo: SystemInfo | null;
  systemLoading: boolean;
  isDesktop: boolean;
  checkForUpdate: () => Promise<void>;
  reloadSystemInfo: () => Promise<void>;
  handleUpdate: (t: (key: string) => string) => Promise<void>;
  clearError: () => void;
  exportDiagnostics: (t: (key: string) => string) => Promise<void>;
}

export function useAboutData(locale: string): UseAboutDataReturn {
  const [updateInfo, setUpdateInfo] = useState<tauri.SelfUpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'downloading' | 'installing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemLoading, setSystemLoading] = useState(true);
  const isDesktop = isTauri();

  const checkForUpdate = useCallback(async () => {
    if (!tauri.isTauri()) {
      setUpdateInfo({
        current_version: APP_VERSION,
        latest_version: APP_VERSION,
        update_available: false,
        release_notes: null,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const info = await tauri.selfCheckUpdate();
      setUpdateInfo({
        ...info,
        current_version: info.current_version || APP_VERSION,
        latest_version: info.latest_version || info.current_version || APP_VERSION,
      });
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
        setError('network_error');
      } else if (message.includes('timeout') || message.includes('timed out')) {
        setError('timeout_error');
      } else {
        setError('update_check_failed');
      }
      setUpdateInfo({
        current_version: APP_VERSION,
        latest_version: APP_VERSION,
        update_available: false,
        release_notes: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSystemInfo = useCallback(async () => {
    setSystemError(null);
    if (!tauri.isTauri()) {
      setSystemInfo({
        os: 'Web',
        arch: 'Browser',
        osVersion: '',
        osLongVersion: '',
        kernelVersion: '',
        hostname: '',
        osName: '',
        distributionId: '',
        cpuArch: '',
        cpuModel: '',
        cpuVendorId: '',
        cpuFrequency: 0,
        cpuCores: 0,
        physicalCoreCount: null,
        globalCpuUsage: 0,
        totalMemory: 0,
        availableMemory: 0,
        usedMemory: 0,
        totalSwap: 0,
        usedSwap: 0,
        uptime: 0,
        bootTime: 0,
        loadAverage: [0, 0, 0],
        gpus: [],
        appVersion: APP_VERSION,
        homeDir: '~/.cognia',
        locale: locale === 'zh' ? 'zh-CN' : 'en-US',
      });
      setSystemLoading(false);
      return;
    }

    setSystemLoading(true);
    try {
      const [platformInfo, cogniaDir] = await Promise.all([
        tauri.getPlatformInfo(),
        tauri.getCogniaDir(),
      ]);
      setSystemInfo({
        os: platformInfo.os,
        arch: platformInfo.arch,
        osVersion: platformInfo.osVersion,
        osLongVersion: platformInfo.osLongVersion,
        kernelVersion: platformInfo.kernelVersion,
        hostname: platformInfo.hostname,
        osName: platformInfo.osName,
        distributionId: platformInfo.distributionId,
        cpuArch: platformInfo.cpuArch,
        cpuModel: platformInfo.cpuModel,
        cpuVendorId: platformInfo.cpuVendorId,
        cpuFrequency: platformInfo.cpuFrequency,
        cpuCores: platformInfo.cpuCores,
        physicalCoreCount: platformInfo.physicalCoreCount,
        globalCpuUsage: platformInfo.globalCpuUsage,
        totalMemory: platformInfo.totalMemory,
        availableMemory: platformInfo.availableMemory,
        usedMemory: platformInfo.usedMemory,
        totalSwap: platformInfo.totalSwap,
        usedSwap: platformInfo.usedSwap,
        uptime: platformInfo.uptime,
        bootTime: platformInfo.bootTime,
        loadAverage: platformInfo.loadAverage,
        gpus: platformInfo.gpus,
        appVersion: platformInfo.appVersion || APP_VERSION,
        homeDir: cogniaDir,
        locale: locale === 'zh' ? 'zh-CN' : 'en-US',
      });
    } catch (err) {
      console.error('Failed to load system info:', err);
      setSystemError('system_info_failed');
      setSystemInfo({
        os: 'Unknown',
        arch: 'Unknown',
        osVersion: '',
        osLongVersion: '',
        kernelVersion: '',
        hostname: '',
        osName: '',
        distributionId: '',
        cpuArch: '',
        cpuModel: '',
        cpuVendorId: '',
        cpuFrequency: 0,
        cpuCores: 0,
        physicalCoreCount: null,
        globalCpuUsage: 0,
        totalMemory: 0,
        availableMemory: 0,
        usedMemory: 0,
        totalSwap: 0,
        usedSwap: 0,
        uptime: 0,
        bootTime: 0,
        loadAverage: [0, 0, 0],
        gpus: [],
        appVersion: APP_VERSION,
        homeDir: '~/.cognia',
        locale: locale === 'zh' ? 'zh-CN' : 'en-US',
      });
    } finally {
      setSystemLoading(false);
    }
  }, [locale]);

  // Check for updates only once on mount (not affected by locale changes)
  useEffect(() => {
    checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load system info when locale changes
  useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  const handleUpdate = useCallback(async (t: (key: string) => string) => {
    if (!tauri.isTauri()) {
      toast.error(t('about.updateDesktopOnly'));
      return;
    }

    setUpdating(true);
    setUpdateProgress(0);
    setUpdateStatus('downloading');
    try {
      await tauri.selfUpdate();
      setUpdateStatus('done');
      toast.success(t('about.updateStarted') || 'Update started! The application will restart shortly.');
    } catch (err) {
      setUpdateStatus('error');
      toast.error(`${t('common.error')}: ${err}`);
    } finally {
      setUpdating(false);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      if (!tauri.isTauri()) return;
      try {
        const handler = await tauri.listenSelfUpdateProgress((event) => {
          setUpdateStatus(event.status);
          if (typeof event.progress === 'number') {
            setUpdateProgress(event.progress);
          }
          if (event.status === 'done') {
            setUpdateProgress(100);
          }
        });
        unlisten = handler;
      } catch (err) {
        console.error('Failed to listen for update progress:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const exportDiagnostics = useCallback(async (t: (key: string) => string) => {
    if (!tauri.isTauri()) {
      toast.error(t('about.updateDesktopOnly'));
      return;
    }

    try {
      const [providers, cacheStats, logSize] = await Promise.allSettled([
        tauri.providerStatusAll(),
        tauri.getCombinedCacheStats(),
        tauri.logGetTotalSize(),
      ]);

      const formatMem = (bytes: number) => bytes > 0 ? `${Math.round(bytes / (1024 * 1024 * 1024))} GB` : 'N/A';
      const coresStr = systemInfo?.physicalCoreCount && systemInfo.physicalCoreCount !== systemInfo.cpuCores
        ? `${systemInfo.physicalCoreCount}P/${systemInfo.cpuCores}L`
        : `${systemInfo?.cpuCores || 0}`;

      const lines: string[] = [
        'CogniaLauncher Diagnostic Report',
        '================================',
        `Generated: ${new Date().toISOString()}`,
        '',
        '--- System Info ---',
        `App Version: v${updateInfo?.current_version || systemInfo?.appVersion || APP_VERSION}`,
        `OS: ${systemInfo?.osLongVersion || systemInfo?.os || 'Unknown'}`,
        `OS Name: ${systemInfo?.osName || 'Unknown'}`,
        `Arch: ${systemInfo?.cpuArch || systemInfo?.arch || 'Unknown'}`,
        `Kernel: ${systemInfo?.kernelVersion || 'Unknown'}`,
        `Hostname: ${systemInfo?.hostname || 'Unknown'}`,
        `CPU: ${systemInfo?.cpuModel || 'Unknown'} (${coresStr} cores, ${systemInfo?.cpuFrequency || 0} MHz)`,
        `CPU Vendor: ${systemInfo?.cpuVendorId || 'Unknown'}`,
        `Memory: ${systemInfo?.totalMemory ? formatMem(systemInfo.totalMemory) : 'Unknown'} (Used: ${systemInfo?.usedMemory ? formatMem(systemInfo.usedMemory) : 'N/A'})`,
        `Swap: ${systemInfo?.totalSwap ? `${formatMem(systemInfo.totalSwap)} (Used: ${formatMem(systemInfo.usedSwap)})` : 'None'}`,
        `GPU: ${systemInfo?.gpus?.length ? systemInfo.gpus.map(g => `${g.name}${g.vramMb ? ` (${g.vramMb} MB)` : ''}`).join(', ') : 'Unknown'}`,
        `Data Dir: ${systemInfo?.homeDir || 'Unknown'}`,
        `Locale: ${systemInfo?.locale || 'Unknown'}`,
      ];

      if (updateInfo) {
        lines.push('', '--- Update Status ---');
        lines.push(`Current: v${updateInfo.current_version}`);
        lines.push(`Latest: v${updateInfo.latest_version || updateInfo.current_version}`);
        lines.push(`Update Available: ${updateInfo.update_available ? 'Yes' : 'No'}`);
      }

      if (providers.status === 'fulfilled') {
        const all = providers.value;
        const installed = all.filter((p) => p.installed);
        lines.push('', '--- Providers ---');
        lines.push(`Total: ${all.length}, Available: ${installed.length}`);
        if (installed.length > 0) {
          lines.push(`Installed: ${installed.map((p) => p.id).join(', ')}`);
        }
        const notInstalled = all.filter((p) => !p.installed);
        if (notInstalled.length > 0) {
          lines.push(`Not Available: ${notInstalled.map((p) => p.id).join(', ')}`);
        }
      }

      if (cacheStats.status === 'fulfilled') {
        const stats = cacheStats.value;
        lines.push('', '--- Cache ---');
        lines.push(`Internal: ${stats.internalSizeHuman}`);
        lines.push(`External: ${stats.externalSizeHuman}`);
        lines.push(`Total: ${stats.totalSizeHuman}`);
      }

      if (logSize.status === 'fulfilled') {
        const bytes = logSize.value;
        const sizeStr = bytes > 0
          ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
          : '0 B';
        lines.push('', '--- Logs ---');
        lines.push(`Total Log Size: ${sizeStr}`);
      }

      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(t('about.diagnosticsCopied'));
    } catch (err) {
      console.error('Failed to export diagnostics:', err);
      toast.error(t('about.diagnosticsFailed'));
    }
  }, [updateInfo, systemInfo]);

  return {
    updateInfo,
    loading,
    updating,
    updateProgress,
    updateStatus,
    error,
    systemError,
    systemInfo,
    systemLoading,
    isDesktop,
    checkForUpdate,
    reloadSystemInfo: loadSystemInfo,
    handleUpdate,
    clearError,
    exportDiagnostics,
  };
}
