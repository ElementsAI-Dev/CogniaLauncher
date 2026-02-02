'use client';

import { useEffect, useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import { toast } from 'sonner';

export interface SystemInfo {
  os: string;
  arch: string;
  homeDir: string;
  locale: string;
}

export interface UseAboutDataReturn {
  updateInfo: tauri.SelfUpdateInfo | null;
  loading: boolean;
  updating: boolean;
  updateProgress: number;
  error: string | null;
  systemInfo: SystemInfo | null;
  systemLoading: boolean;
  checkForUpdate: () => Promise<void>;
  handleUpdate: (t: (key: string) => string) => Promise<void>;
  clearError: () => void;
}

export function useAboutData(locale: string): UseAboutDataReturn {
  const [updateInfo, setUpdateInfo] = useState<tauri.SelfUpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemLoading, setSystemLoading] = useState(true);

  const checkForUpdate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await tauri.selfCheckUpdate();
      setUpdateInfo(info);
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
        setError('network_error');
      } else if (message.includes('timeout') || message.includes('timed out')) {
        setError('timeout_error');
      } else {
        setError('update_check_failed');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSystemInfo = useCallback(async () => {
    setSystemLoading(true);
    try {
      const [platformInfo, cogniaDir] = await Promise.all([
        tauri.getPlatformInfo(),
        tauri.getCogniaDir(),
      ]);
      setSystemInfo({
        os: platformInfo.os,
        arch: platformInfo.arch,
        homeDir: cogniaDir,
        locale: locale === 'zh' ? 'zh-CN' : 'en-US',
      });
    } catch (err) {
      console.error('Failed to load system info:', err);
      setSystemInfo({
        os: 'Unknown',
        arch: 'Unknown',
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
    setUpdating(true);
    setUpdateProgress(0);
    try {
      await tauri.selfUpdate();
      toast.success(t('about.updateStarted') || 'Update started! The application will restart shortly.');
    } catch (err) {
      toast.error(`${t('common.error')}: ${err}`);
    } finally {
      setUpdating(false);
      setUpdateProgress(0);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    updateInfo,
    loading,
    updating,
    updateProgress,
    error,
    systemInfo,
    systemLoading,
    checkForUpdate,
    handleUpdate,
    clearError,
  };
}
