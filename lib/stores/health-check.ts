import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  EnvironmentHealthResult,
  HealthRemediationResult,
  HealthStatus,
  SystemHealthResult,
} from '@/types/tauri';

export interface HealthCheckProgress {
  completed: number;
  total: number;
  currentProvider: string;
  phase: string;
}

interface HealthCheckState {
  systemHealth: SystemHealthResult | null;
  environmentHealth: Record<string, EnvironmentHealthResult>;
  loading: boolean;
  error: string | null;
  progress: HealthCheckProgress | null;
  lastCheckedAt: number | null;
  activeRemediationId: string | null;
  lastRemediationResult: HealthRemediationResult | null;

  setSystemHealth: (result: SystemHealthResult) => void;
  setEnvironmentHealth: (envType: string, result: EnvironmentHealthResult) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: HealthCheckProgress | null) => void;
  setActiveRemediationId: (remediationId: string | null) => void;
  setLastRemediationResult: (result: HealthRemediationResult | null) => void;
  clearResults: () => void;
  isStale: () => boolean;
}

function deriveOverallStatus(result: SystemHealthResult): HealthStatus {
  if (
    result.system_issues.some((issue) => issue.severity === 'critical' || issue.severity === 'error') ||
    result.environments.some((env) => env.status === 'error') ||
    result.package_managers.some((provider) => provider.status === 'error')
  ) {
    return 'error';
  }

  if (
    result.system_issues.some((issue) => issue.severity === 'warning') ||
    result.environments.some((env) => env.status === 'warning') ||
    result.package_managers.some((provider) => provider.status === 'warning')
  ) {
    return 'warning';
  }

  return 'healthy';
}

export const useHealthCheckStore = create<HealthCheckState>()(
  persist(
    (set, get) => ({
      systemHealth: null,
      environmentHealth: {},
      loading: false,
      error: null,
      progress: null,
      lastCheckedAt: null,
      activeRemediationId: null,
      lastRemediationResult: null,

      setSystemHealth: (result) =>
        set({
          systemHealth: result,
          lastCheckedAt: Date.now(),
          environmentHealth: Object.fromEntries(
            result.environments.map((e) => [e.env_type, e]),
          ),
        }),

      setEnvironmentHealth: (envType, result) =>
        set((state) => ({
          environmentHealth: { ...state.environmentHealth, [envType]: result },
          systemHealth: state.systemHealth
            ? {
                ...state.systemHealth,
                overall_status: deriveOverallStatus({
                  ...state.systemHealth,
                  environments: (() => {
                    const current = [...state.systemHealth.environments];
                    const index = current.findIndex((entry) => entry.env_type === envType);
                    if (index >= 0) {
                      current[index] = result;
                    } else {
                      current.push(result);
                      current.sort((left, right) => left.env_type.localeCompare(right.env_type));
                    }
                    return current;
                  })(),
                }),
                environments: (() => {
                  const current = [...state.systemHealth.environments];
                  const index = current.findIndex((entry) => entry.env_type === envType);
                  if (index >= 0) {
                    current[index] = result;
                  } else {
                    current.push(result);
                    current.sort((left, right) => left.env_type.localeCompare(right.env_type));
                  }
                  return current;
                })(),
                checked_at: new Date().toISOString(),
              }
            : state.systemHealth,
          lastCheckedAt: Date.now(),
        })),

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setProgress: (progress) => set({ progress }),
      setActiveRemediationId: (activeRemediationId) => set({ activeRemediationId }),
      setLastRemediationResult: (lastRemediationResult) => set({ lastRemediationResult }),

      clearResults: () =>
        set({
          systemHealth: null,
          environmentHealth: {},
          error: null,
          progress: null,
          activeRemediationId: null,
          lastRemediationResult: null,
        }),

      isStale: () => {
        const ts = get().lastCheckedAt;
        return !ts || Date.now() - ts > 10 * 60 * 1000;
      },
    }),
    {
      name: 'cognia-health-check',
      version: 1,
      migrate: (persisted) => persisted as HealthCheckState,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        systemHealth: state.systemHealth,
        environmentHealth: state.environmentHealth,
        lastCheckedAt: state.lastCheckedAt,
      }),
    },
  ),
);
