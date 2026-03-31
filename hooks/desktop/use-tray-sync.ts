'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { dispatchDesktopActionEvent } from '@/lib/desktop-actions';
import {
  isTauri,
  traySetLanguage,
  traySetActiveDownloads,
  traySetWslState,
  traySetHasUpdate,
  traySetTerminalProfiles,
  traySetAlwaysOnTop,
  trayRebuild,
  listenNavigate,
  listenCheckUpdates,
  listenDesktopAction,
  listenTrayTerminalLaunch,
  listenDownloadPauseAll,
  listenDownloadResumeAll,
  listenToggleAlwaysOnTop,
  listenTrayShowNotificationsChanged,
  terminalLaunchProfile,
  wslGetStatus,
  type TrayLanguage,
} from '@/lib/tauri';
import { useRouter } from 'next/navigation';
import { useDownloadStore } from '@/lib/stores/download';
import { useSettingsStore } from '@/lib/stores/settings';
import { useTerminalStore } from '@/lib/stores/terminal';

/**
 * Hook to sync tray state with app state.
 * - Syncs language when locale changes
 * - Listens for navigation events from tray
 * - Listens for check-updates events from tray
 * - Auto-syncs active download count to tray
 * - Listens for download pause/resume all from tray
 * - Listens for always-on-top toggle from tray
 * - Syncs frontend notification toggle when tray menu changes it
 */
export function useTraySync() {
  const { locale } = useLocale();
  const router = useRouter();
  const prevDownloadCountRef = useRef<number>(-1);
  const prevTerminalSnapshotRef = useRef<string>("");
  const setAppSettings = useSettingsStore((s) => s.setAppSettings);

  // Auto-sync active download count to tray
  const activeCount = useDownloadStore((s) =>
    s.tasks.filter((t) => t.state === 'downloading' || t.state === 'queued').length
  );
  const terminalProfiles = useTerminalStore((s) => s.profiles);
  const defaultProfileId = useTerminalStore((s) => s.defaultProfileId);
  const recentlyLaunchedIds = useTerminalStore((s) => s.recentlyLaunchedIds);
  const hydrateTerminalStore = useTerminalStore((s) => s.hydrate);
  const markProfileLaunched = useTerminalStore((s) => s.markProfileLaunched);
  const terminalLoading = useTerminalStore((s) => s.loading);

  useEffect(() => {
    if (!isTauri()) return;
    if (activeCount === prevDownloadCountRef.current) return;
    prevDownloadCountRef.current = activeCount;

    traySetActiveDownloads(activeCount).catch(console.error);
  }, [activeCount]);

  useEffect(() => {
    if (!isTauri() || terminalLoading || terminalProfiles.length > 0 || defaultProfileId) {
      return;
    }

    void hydrateTerminalStore();
  }, [defaultProfileId, hydrateTerminalStore, terminalLoading, terminalProfiles.length]);

  useEffect(() => {
    if (!isTauri()) return;

    const recentProfiles = recentlyLaunchedIds
      .map((profileId) => terminalProfiles.find((profile) => profile.id === profileId))
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
      }));

    const nextSnapshot = JSON.stringify({
      defaultProfileId,
      recentProfiles,
    });

    if (nextSnapshot === prevTerminalSnapshotRef.current) return;
    prevTerminalSnapshotRef.current = nextSnapshot;

    traySetTerminalProfiles(defaultProfileId, recentProfiles)
      .then(() => trayRebuild())
      .catch(console.error);
  }, [defaultProfileId, recentlyLaunchedIds, terminalProfiles]);

  // Sync tray language with app locale
  useEffect(() => {
    if (!isTauri()) return;

    const trayLang: TrayLanguage = locale === 'zh' ? 'zh' : 'en';
    
    traySetLanguage(trayLang)
      .then(() => trayRebuild())
      .catch(console.error);
  }, [locale]);

  useEffect(() => {
    if (!isTauri()) return;

    wslGetStatus()
      .then((status) =>
        traySetWslState(
          status.runningDistros?.length ?? 0,
          status.defaultDistribution ?? null,
        ),
      )
      .then(() => trayRebuild())
      .catch(() => {
        // Ignore WSL sync failures when WSL is unavailable or unsupported.
      });
  }, []);

  // Listen for navigation events from tray menu
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenNavigate((path) => {
      router.push(path);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [router]);

  // Listen for check-updates events from tray menu
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenCheckUpdates(() => {
      router.push('/about');
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [router]);

  // Bridge shared desktop actions emitted by the tray into the browser runtime.
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenDesktopAction((actionId) => {
      dispatchDesktopActionEvent(actionId);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenTrayTerminalLaunch((profileId) => {
      terminalLaunchProfile(profileId)
        .then(() => {
          markProfileLaunched(profileId);
        })
        .catch(console.error);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [markProfileLaunched]);

  // Listen for download pause/resume all from tray
  useEffect(() => {
    if (!isTauri()) return;

    const unlisteners: (() => void)[] = [];

    listenDownloadPauseAll(async () => {
      try {
        const { downloadBatchPause } = await import('@/lib/tauri');
        const activeIds = useDownloadStore.getState().tasks
          .filter((t) => t.state === 'downloading')
          .map((t) => t.id);
        if (activeIds.length > 0) {
          await downloadBatchPause(activeIds);
        }
      } catch (error) {
        console.error('Failed to pause all downloads:', error);
      }
    }).then((fn) => unlisteners.push(fn));

    listenDownloadResumeAll(async () => {
      try {
        const { downloadBatchResume } = await import('@/lib/tauri');
        const pausedIds = useDownloadStore.getState().tasks
          .filter((t) => t.state === 'paused')
          .map((t) => t.id);
        if (pausedIds.length > 0) {
          await downloadBatchResume(pausedIds);
        }
      } catch (error) {
        console.error('Failed to resume all downloads:', error);
      }
    }).then((fn) => unlisteners.push(fn));

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  // Listen for always-on-top toggle from tray menu
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenToggleAlwaysOnTop(() => {
      // The backend already set the window always-on-top state.
      // This listener is here for any frontend state sync if needed.
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  // Keep frontend settings state in sync when tray toggles notification visibility.
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenTrayShowNotificationsChanged((enabled) => {
      setAppSettings({ showNotifications: enabled });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [setAppSettings]);
}

/**
 * Update tray icon based on download count.
 * Call this when download state changes.
 */
export async function updateTrayDownloadCount(count: number): Promise<void> {
  if (!isTauri()) return;

  try {
    await traySetActiveDownloads(count);
  } catch (error) {
    console.error('Failed to update tray download count:', error);
  }
}

/**
 * Update tray to show update available state.
 * Call this when an update is detected.
 */
export async function updateTrayHasUpdate(hasUpdate: boolean): Promise<void> {
  if (!isTauri()) return;

  try {
    await traySetHasUpdate(hasUpdate);
  } catch (error) {
    console.error('Failed to update tray update state:', error);
  }
}

/**
 * Sync always-on-top state to tray (call from window controls).
 */
export async function updateTrayAlwaysOnTop(enabled: boolean): Promise<void> {
  if (!isTauri()) return;

  try {
    await traySetAlwaysOnTop(enabled);
  } catch (error) {
    console.error('Failed to update tray always-on-top:', error);
  }
}
