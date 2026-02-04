'use client';

import { useState, useCallback } from 'react';
import {
  healthCheckAll,
  healthCheckEnvironment,
  type SystemHealthResult,
  type EnvironmentHealthResult,
  type HealthStatus,
} from '../tauri';
import { isTauri } from '../tauri';

interface UseHealthCheckReturn {
  systemHealth: SystemHealthResult | null;
  environmentHealth: Record<string, EnvironmentHealthResult>;
  loading: boolean;
  error: string | null;
  checkAll: () => Promise<void>;
  checkEnvironment: (envType: string) => Promise<void>;
  getStatusColor: (status: HealthStatus) => string;
  getStatusIcon: (status: HealthStatus) => string;
  clearResults: () => void;
}

/**
 * Hook for managing environment health checks
 */
export function useHealthCheck(): UseHealthCheckReturn {
  const [systemHealth, setSystemHealth] = useState<SystemHealthResult | null>(null);
  const [environmentHealth, setEnvironmentHealth] = useState<Record<string, EnvironmentHealthResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAll = useCallback(async () => {
    if (!isTauri()) {
      setError('Health check is only available in desktop app');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await healthCheckAll();
      setSystemHealth(result);
      
      // Also populate individual environment health
      const envHealthMap: Record<string, EnvironmentHealthResult> = {};
      for (const env of result.environments) {
        envHealthMap[env.env_type] = env;
      }
      setEnvironmentHealth(envHealthMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const checkEnvironment = useCallback(async (envType: string) => {
    if (!isTauri()) {
      setError('Health check is only available in desktop app');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await healthCheckEnvironment(envType);
      setEnvironmentHealth((prev) => ({
        ...prev,
        [envType]: result,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const getStatusColor = useCallback((status: HealthStatus): string => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'unknown':
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, []);

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

  const clearResults = useCallback(() => {
    setSystemHealth(null);
    setEnvironmentHealth({});
    setError(null);
  }, []);

  return {
    systemHealth,
    environmentHealth,
    loading,
    error,
    checkAll,
    checkEnvironment,
    getStatusColor,
    getStatusIcon,
    clearResults,
  };
}
