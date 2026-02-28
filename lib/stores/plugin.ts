import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PluginInfo, PluginToolInfo } from '@/types/plugin';

interface PluginState {
  installedPlugins: PluginInfo[];
  pluginTools: PluginToolInfo[];
  loading: boolean;
  error: string | null;

  setInstalledPlugins: (plugins: PluginInfo[]) => void;
  setPluginTools: (tools: PluginToolInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updatePlugin: (pluginId: string, updates: Partial<PluginInfo>) => void;
  removePlugin: (pluginId: string) => void;
  addPlugin: (plugin: PluginInfo) => void;
}

export const usePluginStore = create<PluginState>()(
  persist(
    (set) => ({
      installedPlugins: [],
      pluginTools: [],
      loading: false,
      error: null,

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
    }),
    {
      name: 'cognia-plugins',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        installedPlugins: state.installedPlugins,
      }),
    },
  ),
);
