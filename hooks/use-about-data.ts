'use client';

import { useEffect, useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import { APP_VERSION } from '@/lib/app-version';
import { toast } from 'sonner';

export interface SystemInfo {
  os: string;
  arch: string;
  osVersion: string;
  osLongVersion: string;
  kernelVersion: string;
  hostname: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: number;
  availableMemory: number;
  uptime: number;
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
  const [isDesktop, setIsDesktop] = useState(false);

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
        cpuModel: '',
        cpuCores: 0,
        totalMemory: 0,
        availableMemory: 0,
        uptime: 0,
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
        osVersion: platformInfo.os_version,
        osLongVersion: platformInfo.os_long_version,
        kernelVersion: platformInfo.kernel_version,
        hostname: platformInfo.hostname,
        cpuModel: platformInfo.cpu_model,
        cpuCores: platformInfo.cpu_cores,
        totalMemory: platformInfo.total_memory,
        availableMemory: platformInfo.available_memory,
        uptime: platformInfo.uptime,
        appVersion: platformInfo.app_version || APP_VERSION,
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
        cpuModel: '',
        cpuCores: 0,
        totalMemory: 0,
        availableMemory: 0,
        uptime: 0,
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
    const desktop = tauri.isTauri();
    setIsDesktop(desktop);
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
  };
}
