'use client';

import { useEffect } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import {
  isTauri,
  traySetLanguage,
  traySetActiveDownloads,
  traySetHasUpdate,
  trayRebuild,
  listenNavigate,
  listenCheckUpdates,
  type TrayLanguage,
} from '@/lib/tauri';
import { useRouter } from 'next/navigation';

/**
 * Hook to sync tray state with app state.
 * - Syncs language when locale changes
 * - Listens for navigation events from tray
 * - Listens for check-updates events from tray
 */
export function useTraySync() {
  const { locale } = useLocale();
  const router = useRouter();

  // Sync tray language with app locale
  useEffect(() => {
    if (!isTauri()) return;

    const trayLang: TrayLanguage = locale === 'zh' ? 'zh' : 'en';
    
    traySetLanguage(trayLang)
      .then(() => trayRebuild())
      .catch(console.error);
  }, [locale]);

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
      // Navigate to about page which handles update checks
      router.push('/about');
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [router]);
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
