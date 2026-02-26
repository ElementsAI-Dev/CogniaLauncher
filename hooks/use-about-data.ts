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
  components: tauri.ComponentInfo[];
  battery: tauri.BatteryInfo | null;
  disks: tauri.DiskInfo[];
  networks: tauri.NetworkInterfaceInfo[];
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
        components: [],
        battery: null,
        disks: [],
        networks: [],
      });
      setSystemLoading(false);
      return;
    }

    setSystemLoading(true);
    try {
      const [platformResult, cogniaDirResult, componentsResult, batteryResult, disksResult, networksResult] = await Promise.allSettled([
        tauri.getPlatformInfo(),
        tauri.getCogniaDir(),
        tauri.getComponentsInfo(),
        tauri.getBatteryInfo(),
        tauri.getDiskInfo(),
        tauri.getNetworkInterfaces(),
      ]);

      const platformInfo = platformResult.status === 'fulfilled' ? platformResult.value : null;
      const cogniaDir = cogniaDirResult.status === 'fulfilled' ? cogniaDirResult.value : '~/.cognia';
      const components = componentsResult.status === 'fulfilled' ? componentsResult.value : [];
      const battery = batteryResult.status === 'fulfilled' ? batteryResult.value : null;
      const disks = disksResult.status === 'fulfilled' ? disksResult.value : [];
      const networks = networksResult.status === 'fulfilled' ? networksResult.value : [];

      if (!platformInfo) {
        throw new Error('Failed to load platform info');
      }

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
        components,
        battery,
        disks,
        networks,
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
        components: [],
        battery: null,
        disks: [],
        networks: [],
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
    // Desktop mode: full ZIP bundle via Tauri backend
    if (isTauri()) {
      try {
        let outputPath: string | undefined;
        try {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const defaultPath = await tauri.diagnosticGetDefaultExportPath();
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const selected = await save({
            title: t('diagnostic.selectExportPath'),
            defaultPath: `${defaultPath}/cognia-diagnostic-${ts}.zip`,
            filters: [{ name: 'ZIP', extensions: ['zip'] }],
          });
          if (!selected) return; // user cancelled
          outputPath = selected;
        } catch {
          // Dialog failed, let backend use default path
        }

        toast.info(t('diagnostic.generating'));

        const result = await tauri.diagnosticExportBundle({
          outputPath,
          includeConfig: true,
        });

        const sizeMb = (result.size / (1024 * 1024)).toFixed(1);
        toast.success(t('diagnostic.exportSuccess'), {
          description: `${result.path} (${sizeMb} MB, ${result.fileCount} files)`,
          duration: 8000,
          action: {
            label: t('diagnostic.openFolder'),
            onClick: async () => {
              try {
                const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
                await revealItemInDir(result.path);
              } catch {
                // fallback: ignore
              }
            },
          },
        });
      } catch (err) {
        console.error('Failed to export diagnostics:', err);
        toast.error(t('about.diagnosticsFailed'));
      }
      return;
    }

    // Web mode: generate a client-side diagnostic JSON file download
    try {
      const formatMem = (bytes: number) =>
        bytes > 0 ? `${Math.round(bytes / (1024 * 1024 * 1024))} GB` : 'N/A';

      const report: Record<string, unknown> = {
        generated: new Date().toISOString(),
        mode: 'web',
        appVersion: APP_VERSION,
        system: {
          os: systemInfo?.osLongVersion || systemInfo?.os || 'Web',
          osName: systemInfo?.osName || navigator.platform || 'Unknown',
          arch: systemInfo?.cpuArch || systemInfo?.arch || 'Unknown',
          cpu: systemInfo?.cpuModel || 'Unknown',
          cpuCores: systemInfo?.cpuCores || navigator.hardwareConcurrency || 0,
          memoryTotal: systemInfo?.totalMemory
            ? formatMem(systemInfo.totalMemory)
            : 'Unknown',
          memoryUsed: systemInfo?.usedMemory
            ? formatMem(systemInfo.usedMemory)
            : 'Unknown',
          gpus: systemInfo?.gpus?.map((g) => ({
            name: g.name,
            vramMb: g.vramMb,
          })) || [],
        },
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          languages: [...navigator.languages],
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          hardwareConcurrency: navigator.hardwareConcurrency,
          // deviceMemory may not be available in all browsers
          deviceMemory: (navigator as unknown as Record<string, unknown>).deviceMemory ?? null,
          maxTouchPoints: navigator.maxTouchPoints,
        },
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
          pixelRatio: window.devicePixelRatio,
        },
        performance: {
          memory: (performance as unknown as Record<string, unknown>).memory ?? null,
          timing: performance.timing
            ? {
                navigationStart: performance.timing.navigationStart,
                loadEventEnd: performance.timing.loadEventEnd,
                domContentLoadedEventEnd:
                  performance.timing.domContentLoadedEventEnd,
              }
            : null,
        },
        update: updateInfo
          ? {
              currentVersion: updateInfo.current_version,
              latestVersion: updateInfo.latest_version,
              updateAvailable: updateInfo.update_available,
            }
          : null,
        localStorage: {
          itemCount: localStorage.length,
          estimatedSizeKB: (() => {
            try {
              let total = 0;
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                  total += key.length + (localStorage.getItem(key)?.length || 0);
                }
              }
              return Math.round((total * 2) / 1024); // UTF-16 → bytes → KB
            } catch {
              return null;
            }
          })(),
        },
      };

      const json = JSON.stringify(report, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cognia-diagnostic-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('diagnostic.exportSuccessWeb'));
    } catch (err) {
      console.error('Failed to export web diagnostics:', err);
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
