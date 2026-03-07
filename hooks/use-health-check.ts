'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  healthCheckAll,
  healthCheckEnvironment,
  healthCheckFix,
  isTauri,
} from '@/lib/tauri';
import { useHealthCheckStore, type HealthCheckProgress } from '@/lib/stores/health-check';
import { getStatusColor } from '@/lib/provider-utils';
import type {
  EnvironmentHealthResult,
  HealthIssue,
  HealthRemediationResult,
  HealthStatus,
  SystemHealthResult,
} from '@/types/tauri';

interface HealthSummary {
  environmentCount: number;
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  unavailableCount: number;
  packageManagerCount: number;
  unavailablePackageManagerCount: number;
  issueCount: number;
  actionableIssueCount: number;
}

interface UseHealthCheckReturn {
  systemHealth: SystemHealthResult | null;
  environmentHealth: Record<string, EnvironmentHealthResult>;
  loading: boolean;
  error: string | null;
  progress: HealthCheckProgress | null;
  summary: HealthSummary;
  activeRemediationId: string | null;
  lastRemediationResult: HealthRemediationResult | null;
  checkAll: (options?: { force?: boolean }) => Promise<void>;
  checkEnvironment: (envType: string) => Promise<void>;
  previewRemediation: (issue: Pick<HealthIssue, 'remediation_id'>) => Promise<HealthRemediationResult | null>;
  applyRemediation: (issue: Pick<HealthIssue, 'remediation_id'>) => Promise<HealthRemediationResult | null>;
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
  const activeRemediationId = useHealthCheckStore((state) => state.activeRemediationId);
  const lastRemediationResult = useHealthCheckStore((state) => state.lastRemediationResult);
  const clearResults = useHealthCheckStore((state) => state.clearResults);
  const setSystemHealth = useHealthCheckStore((state) => state.setSystemHealth);
  const setEnvironmentHealth = useHealthCheckStore((state) => state.setEnvironmentHealth);
  const setLoading = useHealthCheckStore((state) => state.setLoading);
  const setError = useHealthCheckStore((state) => state.setError);
  const setProgress = useHealthCheckStore((state) => state.setProgress);
  const setActiveRemediationId = useHealthCheckStore((state) => state.setActiveRemediationId);
  const setLastRemediationResult = useHealthCheckStore((state) => state.setLastRemediationResult);
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

  const runRemediation = useCallback(async (
    issue: Pick<HealthIssue, 'remediation_id'>,
    dryRun: boolean,
  ): Promise<HealthRemediationResult | null> => {
    if (!isTauri()) {
      setError('Health check remediation is only available in desktop app');
      return null;
    }

    if (!issue.remediation_id) {
      return null;
    }

    setError(null);
    setActiveRemediationId(issue.remediation_id);
    try {
      const result = await healthCheckFix(issue.remediation_id, dryRun);
      setLastRemediationResult(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setActiveRemediationId(null);
    }
  }, [setActiveRemediationId, setError, setLastRemediationResult]);

  const summary = useMemo<HealthSummary>(() => {
    const environments = systemHealth?.environments ?? [];
    const packageManagers = systemHealth?.package_managers ?? [];
    const systemIssues = systemHealth?.system_issues ?? [];
    const allIssues = [
      ...systemIssues,
      ...environments.flatMap((env) => env.issues),
      ...packageManagers.flatMap((provider) => provider.issues),
    ];

    return {
      environmentCount: environments.length,
      healthyCount: environments.filter((env) => env.status === 'healthy').length,
      warningCount: environments.filter((env) => env.status === 'warning').length,
      errorCount: environments.filter((env) => env.status === 'error').length,
      unavailableCount: environments.filter(
        (env) => (env.scope_state ?? 'available') !== 'available' || env.status === 'unknown',
      ).length,
      packageManagerCount: packageManagers.length,
      unavailablePackageManagerCount: packageManagers.filter(
        (provider) => (provider.scope_state ?? 'available') !== 'available' || provider.status === 'unknown',
      ).length,
      issueCount: allIssues.length,
      actionableIssueCount: allIssues.filter((issue) => issue.remediation_id || issue.fix_command).length,
    };
  }, [systemHealth]);

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
    summary,
    activeRemediationId,
    lastRemediationResult,
    checkAll,
    checkEnvironment,
    previewRemediation: (issue) => runRemediation(issue, true),
    applyRemediation: (issue) => runRemediation(issue, false),
    getStatusColor,
    getStatusIcon,
    clearResults,
  };
}
