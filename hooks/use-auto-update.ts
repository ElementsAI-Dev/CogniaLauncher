'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useSettingsStore } from '@/lib/stores/settings';
import * as tauri from '@/lib/tauri';
import { isTauri } from '@/lib/tauri';
import { toast } from 'sonner';
import type { UpdateErrorCategory, UpdateStatus } from '@/types/about';
import {
  categorizeUpdateError,
  deriveStatusFromUpdateInfo,
  mapProgressToUpdateStatus,
  normalizeSelfUpdateInfo,
} from '@/lib/update-lifecycle';

export interface UpdateInfo {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseNotes: string | null;
  checking: boolean;
  progress: number;
  status: UpdateStatus;
  errorCategory: UpdateErrorCategory | null;
  errorMessage: string | null;
  error: string | null;
}

interface UseAutoUpdateOptions {
  ready?: boolean;
}

export function useAutoUpdate(options: UseAutoUpdateOptions = {}) {
  const { ready = true } = options;
  const { appSettings } = useSettingsStore();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    currentVersion: null,
    latestVersion: null,
    updateAvailable: false,
    releaseNotes: null,
    checking: false,
    progress: 0,
    status: 'idle',
    errorCategory: null,
    errorMessage: null,
    error: null,
  });
  const hasCheckedOnStartRef = useRef(false);

  const performUpdate = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    setUpdateInfo((prev) => ({
      ...prev,
      status: 'downloading',
      progress: 0,
      error: null,
      errorCategory: null,
      errorMessage: null,
    }));

    try {
      toast.info('Downloading update...');
      await tauri.selfUpdate();
      setUpdateInfo((prev) => ({
        ...prev,
        status: 'installing',
      }));
      toast.success('Update downloaded. Restart to apply.');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const category = categorizeUpdateError(err);
      setUpdateInfo((prev) => ({
        ...prev,
        status: 'error',
        error: errorMsg,
        errorCategory: category === 'unknown_error' ? 'update_install_failed' : category,
        errorMessage: errorMsg,
      }));
      toast.error(`Update failed: ${errorMsg}`);
    }
  }, []);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (!isTauri()) {
      return;
    }

    setUpdateInfo(prev => ({
      ...prev,
      checking: true,
      status: 'checking',
      error: null,
      errorCategory: null,
      errorMessage: null,
    }));

    try {
      const info = normalizeSelfUpdateInfo(
        await tauri.selfCheckUpdate(),
        updateInfo.currentVersion || '0.0.0',
      );
      const status = deriveStatusFromUpdateInfo(info);
      const newUpdateInfo: UpdateInfo = {
        currentVersion: info.current_version,
        latestVersion: info.latest_version,
        updateAvailable: info.update_available,
        releaseNotes: info.release_notes,
        checking: false,
        progress: 0,
        status,
        errorCategory: null,
        errorMessage: null,
        error: null,
      };
      setUpdateInfo(newUpdateInfo);

      if (info.update_available) {
        if (appSettings.autoInstallUpdates) {
          await performUpdate();
        } else if (!silent && appSettings.notifyOnUpdates) {
          toast.info(`New version ${info.latest_version} is available!`, {
            duration: 10000,
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const category = categorizeUpdateError(err);
      setUpdateInfo(prev => ({
        ...prev,
        checking: false,
        status: 'error',
        error: errorMsg,
        errorCategory: category,
        errorMessage: errorMsg,
      }));
      if (!silent) {
        toast.error(`Failed to check for updates: ${errorMsg}`);
      }
    }
  }, [appSettings.autoInstallUpdates, appSettings.notifyOnUpdates, performUpdate, updateInfo.currentVersion]);

  // Check for updates on app start if enabled
  useEffect(() => {
    if (
      ready &&
      appSettings.checkUpdatesOnStart &&
      !hasCheckedOnStartRef.current &&
      isTauri()
    ) {
      hasCheckedOnStartRef.current = true;
      // Delay check slightly to allow app to fully load
      const timer = setTimeout(() => {
        checkForUpdates(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [appSettings.checkUpdatesOnStart, checkForUpdates, ready]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const attachListener = async () => {
      if (!isTauri()) return;
      try {
        unlisten = await tauri.listenSelfUpdateProgress((event) => {
          setUpdateInfo((prev) => {
            const nextStatus = mapProgressToUpdateStatus(event.status);
            const nextProgress =
              event.status === 'done'
                ? 100
                : typeof event.progress === 'number'
                  ? event.progress
                  : prev.progress;
            return {
              ...prev,
              status: nextStatus,
              progress: nextProgress,
              checking: false,
              error:
                event.status === 'error'
                  ? prev.error || 'Update progress reported an error'
                  : prev.error,
              errorCategory:
                event.status === 'error'
                  ? prev.errorCategory || 'update_install_failed'
                  : prev.errorCategory,
            };
          });
        });
      } catch {
        // Keep hook functional even when progress listener is unavailable.
      }
    };

    void attachListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return {
    ...updateInfo,
    checkForUpdates,
    performUpdate,
  };
}
