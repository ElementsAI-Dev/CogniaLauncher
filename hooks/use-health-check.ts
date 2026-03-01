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
  checkAll: () => Promise<void>;
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
  const store = useHealthCheckStore();
  const unlistenRef = useRef<(() => void) | null>(null);

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

  const checkAll = useCallback(async () => {
    if (!isTauri()) {
      store.setError('Health check is only available in desktop app');
      return;
    }

    store.setLoading(true);
    store.setError(null);
    store.setProgress(null);

    try {
      const result = await healthCheckAll();
      store.setSystemHealth(result);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
    } finally {
      store.setLoading(false);
      store.setProgress(null);
    }
  }, [store]);

  const checkEnvironment = useCallback(async (envType: string) => {
    if (!isTauri()) {
      store.setError('Health check is only available in desktop app');
      return;
    }

    store.setLoading(true);
    store.setError(null);

    try {
      const result = await healthCheckEnvironment(envType);
      store.setEnvironmentHealth(envType, result);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
    } finally {
      store.setLoading(false);
    }
  }, [store]);

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
    systemHealth: store.systemHealth,
    environmentHealth: store.environmentHealth,
    loading: store.loading,
    error: store.error,
    progress: store.progress,
    checkAll,
    checkEnvironment,
    getStatusColor,
    getStatusIcon,
    clearResults: store.clearResults,
  };
}
