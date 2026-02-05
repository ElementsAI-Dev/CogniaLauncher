'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useSettingsStore } from '@/lib/stores/settings';
import * as tauri from '@/lib/tauri';
import { isTauri } from '@/lib/tauri';
import { toast } from 'sonner';

export interface UpdateInfo {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseNotes: string | null;
  checking: boolean;
  error: string | null;
}

export function useAutoUpdate() {
  const { appSettings } = useSettingsStore();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    currentVersion: null,
    latestVersion: null,
    updateAvailable: false,
    releaseNotes: null,
    checking: false,
    error: null,
  });
  const hasCheckedOnStartRef = useRef(false);

  const performUpdate = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    try {
      toast.info('Downloading update...');
      await tauri.selfUpdate();
      toast.success('Update downloaded. Restart to apply.');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Update failed: ${errorMsg}`);
    }
  }, []);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (!isTauri()) {
      return;
    }

    setUpdateInfo(prev => ({ ...prev, checking: true, error: null }));

    try {
      const info = await tauri.selfCheckUpdate();
      const newUpdateInfo: UpdateInfo = {
        currentVersion: info.current_version,
        latestVersion: info.latest_version,
        updateAvailable: info.update_available,
        releaseNotes: info.release_notes,
        checking: false,
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
      setUpdateInfo(prev => ({
        ...prev,
        checking: false,
        error: errorMsg,
      }));
      if (!silent) {
        toast.error(`Failed to check for updates: ${errorMsg}`);
      }
    }
  }, [appSettings.autoInstallUpdates, appSettings.notifyOnUpdates, performUpdate]);

  // Check for updates on app start if enabled
  useEffect(() => {
    if (
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
  }, [appSettings.checkUpdatesOnStart, checkForUpdates]);

  return {
    ...updateInfo,
    checkForUpdates,
    performUpdate,
  };
}
