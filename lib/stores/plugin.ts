import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PluginInfo, PluginToolInfo, PluginHealth, PluginUpdateInfo } from '@/types/plugin';

interface PluginState {
  installedPlugins: PluginInfo[];
  pluginTools: PluginToolInfo[];
  loading: boolean;
  error: string | null;
  healthMap: Record<string, PluginHealth>;
  pendingUpdates: PluginUpdateInfo[];

  setInstalledPlugins: (plugins: PluginInfo[]) => void;
  setPluginTools: (tools: PluginToolInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updatePlugin: (pluginId: string, updates: Partial<PluginInfo>) => void;
  removePlugin: (pluginId: string) => void;
  addPlugin: (plugin: PluginInfo) => void;
  setHealthMap: (healthMap: Record<string, PluginHealth>) => void;
  setPluginHealth: (pluginId: string, health: PluginHealth) => void;
  setPendingUpdates: (updates: PluginUpdateInfo[]) => void;
}

export const usePluginStore = create<PluginState>()(
  persist(
    (set) => ({
      installedPlugins: [],
      pluginTools: [],
      loading: false,
      error: null,
      healthMap: {},
      pendingUpdates: [],

      setInstalledPlugins: (installedPlugins) => set({ installedPlugins }),
      setPluginTools: (pluginTools) => set({ pluginTools }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      updatePlugin: (pluginId, updates) =>
        set((state) => ({
          installedPlugins: state.installedPlugins.map((p) =>
            p.id === pluginId ? { ...p, ...updates } : p,
          ),
        })),

      removePlugin: (pluginId) =>
        set((state) => ({
          installedPlugins: state.installedPlugins.filter((p) => p.id !== pluginId),
          pluginTools: state.pluginTools.filter((t) => t.pluginId !== pluginId),
        })),

      addPlugin: (plugin) =>
        set((state) => ({
          installedPlugins: [...state.installedPlugins, plugin],
        })),

      setHealthMap: (healthMap) => set({ healthMap }),
      setPluginHealth: (pluginId, health) =>
        set((state) => ({
          healthMap: { ...state.healthMap, [pluginId]: health },
        })),
      setPendingUpdates: (pendingUpdates) => set({ pendingUpdates }),
    }),
    {
      name: 'cognia-plugins',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted) => persisted as PluginState,
      partialize: (state) => ({
        installedPlugins: state.installedPlugins,
        pluginTools: state.pluginTools,
      }),
    },
  ),
);
