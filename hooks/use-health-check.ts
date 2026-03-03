'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  healthCheckAll,
  healthCheckEnvironment,
  isTauri,
} from '@/lib/tauri';
import { useHealthCheckStore, type HealthCheckProgress } from '@/lib/stores/health-check';
import { getStatusColor } from '@/lib/provider-utils';
import type { HealthStatus, SystemHealthResult, EnvironmentHealthResult } from '@/types/tauri';

interface UseHealthCheckReturn {
  systemHealth: SystemHealthResult | null;
  environmentHealth: Record<string, EnvironmentHealthResult>;
  loading: boolean;
  error: string | null;
  progress: HealthCheckProgress | null;
  checkAll: (options?: { force?: boolean }) => Promise<void>;
  checkEnvironment: (envType: string) => Promise<void>;
  getStatusColor: (status: HealthStatus) => string;
  getStatusIcon: (status: HealthStatus) => string;
  clearResults: () => void;
}

/**
 * Hook for managing environment health checks.
 * Uses Zustand store for persistence across navigations.
 */
export function useHealthCheck(): UseHealthCheckReturn {
  const systemHealth = useHealthCheckStore((state) => state.systemHealth);
  const environmentHealth = useHealthCheckStore((state) => state.environmentHealth);
  const loading = useHealthCheckStore((state) => state.loading);
  const error = useHealthCheckStore((state) => state.error);
  const progress = useHealthCheckStore((state) => state.progress);
  const clearResults = useHealthCheckStore((state) => state.clearResults);
  const setSystemHealth = useHealthCheckStore((state) => state.setSystemHealth);
  const setEnvironmentHealth = useHealthCheckStore((state) => state.setEnvironmentHealth);
  const setLoading = useHealthCheckStore((state) => state.setLoading);
  const setError = useHealthCheckStore((state) => state.setError);
  const setProgress = useHealthCheckStore((state) => state.setProgress);
  const unlistenRef = useRef<(() => void) | null>(null);
  const checkAllInFlightRef = useRef<Promise<void> | null>(null);

  // Listen for health check progress events
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen<HealthCheckProgress>('health-check-progress', (event) => {
          if (!cancelled) {
            useHealthCheckStore.getState().setProgress(event.payload);
          }
        });
        if (cancelled) {
          unlisten();
        } else {
          unlistenRef.current = unlisten;
        }
      } catch {
        // Not in Tauri context
      }
    })();

    return () => {
      cancelled = true;
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  const checkAll = useCallback((options?: { force?: boolean }) => {
    if (!isTauri()) {
      setError('Health check is only available in desktop app');
      return Promise.resolve();
    }

    const force = options?.force ?? false;
    const state = useHealthCheckStore.getState();

    if (!force && state.systemHealth && !state.isStale()) {
      return Promise.resolve();
    }

    if (checkAllInFlightRef.current) {
      return checkAllInFlightRef.current;
    }

    const request = (async () => {
      setLoading(true);
      setError(null);
      setProgress(null);

      try {
        const result = await healthCheckAll();
        setSystemHealth(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setProgress(null);
        checkAllInFlightRef.current = null;
      }
    })();

    checkAllInFlightRef.current = request;
    return request;
  }, [setError, setLoading, setProgress, setSystemHealth]);

  const checkEnvironment = useCallback(async (envType: string) => {
    if (!isTauri()) {
      setError('Health check is only available in desktop app');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await healthCheckEnvironment(envType);
      setEnvironmentHealth(envType, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [setEnvironmentHealth, setError, setLoading]);

  const getStatusIcon = useCallback((status: HealthStatus): string => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✗';
      case 'unknown':
      default:
        return '?';
    }
  }, []);

  return {
    systemHealth,
    environmentHealth,
    loading,
    error,
    progress,
    checkAll,
    checkEnvironment,
    getStatusColor,
    getStatusIcon,
    clearResults,
  };
}
