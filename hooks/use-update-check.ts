import { useEffect, useCallback, useState } from 'react';
import { usePackageStore } from '@/lib/stores/packages';
import * as tauri from '@/lib/tauri';
import type { UpdateInfo, UpdateCheckProgress } from '@/types/tauri';

export interface UseUpdateCheckReturn {
  availableUpdates: UpdateInfo[];
  isCheckingUpdates: boolean;
  updateCheckProgress: UpdateCheckProgress | null;
  lastUpdateCheck: number | null;
  error: string | null;
  progressPercent: number;
  lastCheckFormatted: string | null;
  handleCheckUpdates: () => Promise<void>;
}

export function useUpdateCheck(): UseUpdateCheckReturn {
  const availableUpdates = usePackageStore((s) => s.availableUpdates);
  const isCheckingUpdates = usePackageStore((s) => s.isCheckingUpdates);
  const updateCheckProgress = usePackageStore((s) => s.updateCheckProgress);
  const lastUpdateCheck = usePackageStore((s) => s.lastUpdateCheck);
  const setAvailableUpdates = usePackageStore((s) => s.setAvailableUpdates);
  const setIsCheckingUpdates = usePackageStore((s) => s.setIsCheckingUpdates);
  const setUpdateCheckProgress = usePackageStore((s) => s.setUpdateCheckProgress);
  const setUpdateCheckErrors = usePackageStore((s) => s.setUpdateCheckErrors);
  const setLastUpdateCheck = usePackageStore((s) => s.setLastUpdateCheck);

  const [error, setError] = useState<string | null>(null);

  const handleCheckUpdates = useCallback(async () => {
    if (!tauri.isTauri()) return;
    setIsCheckingUpdates(true);
    setUpdateCheckProgress(null);
    setError(null);

    let unlisten: (() => void) | null = null;
    try {
      unlisten = await tauri.listenUpdateCheckProgress((progress) => {
        setUpdateCheckProgress(progress);
      });

      const summary = await tauri.checkUpdates();
      setAvailableUpdates(summary.updates);
      setUpdateCheckErrors(summary.errors);
      setLastUpdateCheck(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCheckingUpdates(false);
      unlisten?.();
    }
  }, [setIsCheckingUpdates, setUpdateCheckProgress, setAvailableUpdates, setUpdateCheckErrors, setLastUpdateCheck]);

  // Auto-check on mount if last check was >1 hour ago
  useEffect(() => {
    if (!tauri.isTauri()) return;
    const oneHour = 60 * 60 * 1000;
    if (!lastUpdateCheck || Date.now() - lastUpdateCheck > oneHour) {
      handleCheckUpdates();
    }
  }, [lastUpdateCheck, handleCheckUpdates]);

  const progressPercent = updateCheckProgress
    ? updateCheckProgress.total > 0
      ? Math.round((updateCheckProgress.current / updateCheckProgress.total) * 100)
      : 0
    : 0;

  const lastCheckFormatted = lastUpdateCheck
    ? new Date(lastUpdateCheck).toLocaleTimeString()
    : null;

  return {
    availableUpdates,
    isCheckingUpdates,
    updateCheckProgress,
    lastUpdateCheck,
    error,
    progressPercent,
    lastCheckFormatted,
    handleCheckUpdates,
  };
}
