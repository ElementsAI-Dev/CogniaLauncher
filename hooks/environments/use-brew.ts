'use client';

import { useState, useCallback } from 'react';
import { isTauri } from '@/lib/platform';
import type {
  BrewTap,
  BrewService,
  BrewDoctorResult,
  BrewCleanupResult,
  BrewPinnedPackage,
  BrewConfigInfo,
} from '@/types/tauri';

export interface UseBrewReturn {
  taps: BrewTap[];
  services: BrewService[];
  pinnedPackages: BrewPinnedPackage[];
  doctorResult: BrewDoctorResult | null;
  cleanupResult: BrewCleanupResult | null;
  configInfo: BrewConfigInfo | null;
  analyticsEnabled: boolean | null;
  loading: boolean;
  error: string | null;

  fetchTaps: () => Promise<void>;
  addTap: (name: string) => Promise<void>;
  removeTap: (name: string) => Promise<void>;
  fetchServices: () => Promise<void>;
  startService: (name: string) => Promise<void>;
  stopService: (name: string) => Promise<void>;
  restartService: (name: string) => Promise<void>;
  cleanup: (dryRun?: boolean) => Promise<void>;
  runDoctor: () => Promise<void>;
  autoremove: () => Promise<string[]>;
  fetchPinned: () => Promise<void>;
  pin: (name: string) => Promise<void>;
  unpin: (name: string) => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchAnalyticsStatus: () => Promise<void>;
  toggleAnalytics: (enabled: boolean) => Promise<void>;
}

export function useBrew(): UseBrewReturn {
  const [taps, setTaps] = useState<BrewTap[]>([]);
  const [services, setServices] = useState<BrewService[]>([]);
  const [pinnedPackages, setPinnedPackages] = useState<BrewPinnedPackage[]>([]);
  const [doctorResult, setDoctorResult] = useState<BrewDoctorResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<BrewCleanupResult | null>(null);
  const [configInfo, setConfigInfo] = useState<BrewConfigInfo | null>(null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withLoading = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTaps = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewListTaps } = await import('@/lib/tauri');
      setTaps(await brewListTaps());
    });
  }, [withLoading]);

  const addTap = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewAddTap } = await import('@/lib/tauri');
      await brewAddTap(name);
      const { brewListTaps } = await import('@/lib/tauri');
      setTaps(await brewListTaps());
    });
  }, [withLoading]);

  const removeTap = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewRemoveTap } = await import('@/lib/tauri');
      await brewRemoveTap(name);
      const { brewListTaps } = await import('@/lib/tauri');
      setTaps(await brewListTaps());
    });
  }, [withLoading]);

  const fetchServices = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewListServices } = await import('@/lib/tauri');
      setServices(await brewListServices());
    });
  }, [withLoading]);

  const startService = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewServiceStart, brewListServices } = await import('@/lib/tauri');
      await brewServiceStart(name);
      setServices(await brewListServices());
    });
  }, [withLoading]);

  const stopService = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewServiceStop, brewListServices } = await import('@/lib/tauri');
      await brewServiceStop(name);
      setServices(await brewListServices());
    });
  }, [withLoading]);

  const restartService = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewServiceRestart, brewListServices } = await import('@/lib/tauri');
      await brewServiceRestart(name);
      setServices(await brewListServices());
    });
  }, [withLoading]);

  const cleanup = useCallback(async (dryRun: boolean = false) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewCleanup } = await import('@/lib/tauri');
      setCleanupResult(await brewCleanup(dryRun));
    });
  }, [withLoading]);

  const runDoctor = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewDoctor } = await import('@/lib/tauri');
      setDoctorResult(await brewDoctor());
    });
  }, [withLoading]);

  const autoremove = useCallback(async (): Promise<string[]> => {
    if (!isTauri()) return [];
    return withLoading(async () => {
      const { brewAutoremove } = await import('@/lib/tauri');
      return await brewAutoremove();
    });
  }, [withLoading]);

  const fetchPinned = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewListPinned } = await import('@/lib/tauri');
      setPinnedPackages(await brewListPinned());
    });
  }, [withLoading]);

  const pin = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewPin, brewListPinned } = await import('@/lib/tauri');
      await brewPin(name);
      setPinnedPackages(await brewListPinned());
    });
  }, [withLoading]);

  const unpin = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewUnpin, brewListPinned } = await import('@/lib/tauri');
      await brewUnpin(name);
      setPinnedPackages(await brewListPinned());
    });
  }, [withLoading]);

  const fetchConfig = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewGetConfig } = await import('@/lib/tauri');
      setConfigInfo(await brewGetConfig());
    });
  }, [withLoading]);

  const fetchAnalyticsStatus = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewAnalyticsStatus } = await import('@/lib/tauri');
      setAnalyticsEnabled(await brewAnalyticsStatus());
    });
  }, [withLoading]);

  const toggleAnalytics = useCallback(async (enabled: boolean) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { brewAnalyticsToggle } = await import('@/lib/tauri');
      await brewAnalyticsToggle(enabled);
      setAnalyticsEnabled(enabled);
    });
  }, [withLoading]);

  return {
    taps,
    services,
    pinnedPackages,
    doctorResult,
    cleanupResult,
    configInfo,
    analyticsEnabled,
    loading,
    error,
    fetchTaps,
    addTap,
    removeTap,
    fetchServices,
    startService,
    stopService,
    restartService,
    cleanup,
    runDoctor,
    autoremove,
    fetchPinned,
    pin,
    unpin,
    fetchConfig,
    fetchAnalyticsStatus,
    toggleAnalytics,
  };
}
