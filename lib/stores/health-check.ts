import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SystemHealthResult, EnvironmentHealthResult } from '@/types/tauri';

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

  setSystemHealth: (result: SystemHealthResult) => void;
  setEnvironmentHealth: (envType: string, result: EnvironmentHealthResult) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: HealthCheckProgress | null) => void;
  clearResults: () => void;
  isStale: () => boolean;
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
        })),

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setProgress: (progress) => set({ progress }),

      clearResults: () =>
        set({
          systemHealth: null,
          environmentHealth: {},
          error: null,
          progress: null,
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
