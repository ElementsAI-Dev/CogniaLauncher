import { useEffect, useCallback, useState } from 'react';
import { usePackageStore } from '@/lib/stores/packages';
import * as tauri from '@/lib/tauri';
import { usePackageUpdates } from '@/hooks/use-package-updates';
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
  const { checkUpdates } = usePackageUpdates();

  const [error, setError] = useState<string | null>(null);

  const handleCheckUpdates = useCallback(async () => {
    if (!tauri.isTauri()) return;
    setError(null);
    try {
      await checkUpdates();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [checkUpdates]);

  // Auto-check on mount if last check was >1 hour ago
  useEffect(() => {
    if (!tauri.isTauri()) return;
    const oneHour = 60 * 60 * 1000;
    if (!lastUpdateCheck || Date.now() - lastUpdateCheck > oneHour) {
      const timer = setTimeout(() => {
        handleCheckUpdates();
      }, 0);
      return () => clearTimeout(timer);
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
