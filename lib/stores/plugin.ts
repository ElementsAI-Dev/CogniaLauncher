import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  PluginInfo,
  PluginMarketplaceAcquisitionRecord,
  PluginToolInfo,
  PluginHealth,
  PluginPermissionMode,
  PluginPermissionState,
  PluginUpdateInfo,
} from '@/types/plugin';
import type {
  ToolboxMarketplaceCatalog,
  ToolboxMarketplaceCatalogSource,
  ToolboxMarketplaceSyncState,
} from '@/types/toolbox-marketplace';

interface PluginState {
  installedPlugins: PluginInfo[];
  pluginTools: PluginToolInfo[];
  loading: boolean;
  error: string | null;
  healthMap: Record<string, PluginHealth>;
  permissionMode: PluginPermissionMode;
  permissionStates: Record<string, PluginPermissionState>;
  pendingUpdates: PluginUpdateInfo[];
  marketplaceCatalog: ToolboxMarketplaceCatalog | null;
  marketplaceCatalogSource: ToolboxMarketplaceCatalogSource | null;
  marketplaceSyncState: ToolboxMarketplaceSyncState;
  marketplaceLastSyncedAt: string | null;
  marketplaceLastError: string | null;
  marketplaceAcquisitions: Record<string, PluginMarketplaceAcquisitionRecord>;

  setInstalledPlugins: (plugins: PluginInfo[]) => void;
  setPluginTools: (tools: PluginToolInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updatePlugin: (pluginId: string, updates: Partial<PluginInfo>) => void;
  removePlugin: (pluginId: string) => void;
  addPlugin: (plugin: PluginInfo) => void;
  setHealthMap: (healthMap: Record<string, PluginHealth>) => void;
  setPluginHealth: (pluginId: string, health: PluginHealth) => void;
  setPermissionMode: (mode: PluginPermissionMode) => void;
  setPermissionStates: (states: Record<string, PluginPermissionState>) => void;
  setPluginPermissionState: (pluginId: string, state: PluginPermissionState) => void;
  setPendingUpdates: (updates: PluginUpdateInfo[]) => void;
  setMarketplaceCatalog: (catalog: ToolboxMarketplaceCatalog | null) => void;
  setMarketplaceCatalogSource: (source: ToolboxMarketplaceCatalogSource | null) => void;
  setMarketplaceSyncState: (state: ToolboxMarketplaceSyncState) => void;
  setMarketplaceLastSyncedAt: (timestamp: string | null) => void;
  setMarketplaceLastError: (error: string | null) => void;
  setMarketplaceAcquisition: (pluginId: string, acquisition: PluginMarketplaceAcquisitionRecord) => void;
  clearMarketplaceAcquisition: (pluginId: string) => void;
}

export const usePluginStore = create<PluginState>()(
  persist(
    (set) => ({
      installedPlugins: [],
      pluginTools: [],
      loading: false,
      error: null,
      healthMap: {},
      permissionMode: 'compat',
      permissionStates: {},
      pendingUpdates: [],
      marketplaceCatalog: null,
      marketplaceCatalogSource: null,
      marketplaceSyncState: 'idle',
      marketplaceLastSyncedAt: null,
      marketplaceLastError: null,
      marketplaceAcquisitions: {},

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
          permissionStates: Object.fromEntries(
            Object.entries(state.permissionStates).filter(([id]) => id !== pluginId),
          ),
          healthMap: Object.fromEntries(
            Object.entries(state.healthMap).filter(([id]) => id !== pluginId),
          ),
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
      setPermissionMode: (permissionMode) => set({ permissionMode }),
      setPermissionStates: (permissionStates) => set({ permissionStates }),
      setPluginPermissionState: (pluginId, permissionState) =>
        set((state) => ({
          permissionStates: { ...state.permissionStates, [pluginId]: permissionState },
        })),
      setPendingUpdates: (pendingUpdates) => set({ pendingUpdates }),
      setMarketplaceCatalog: (marketplaceCatalog) => set({ marketplaceCatalog }),
      setMarketplaceCatalogSource: (marketplaceCatalogSource) => set({ marketplaceCatalogSource }),
      setMarketplaceSyncState: (marketplaceSyncState) => set({ marketplaceSyncState }),
      setMarketplaceLastSyncedAt: (marketplaceLastSyncedAt) => set({ marketplaceLastSyncedAt }),
      setMarketplaceLastError: (marketplaceLastError) => set({ marketplaceLastError }),
      setMarketplaceAcquisition: (pluginId, acquisition) =>
        set((state) => ({
          marketplaceAcquisitions: {
            ...state.marketplaceAcquisitions,
            [pluginId]: acquisition,
          },
        })),
      clearMarketplaceAcquisition: (pluginId) =>
        set((state) => {
          if (!(pluginId in state.marketplaceAcquisitions)) return state;
          const next = { ...state.marketplaceAcquisitions };
          delete next[pluginId];
          return { marketplaceAcquisitions: next };
        }),
    }),
    {
      name: 'cognia-plugins',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<PluginState>;
        return {
          installedPlugins: state.installedPlugins ?? [],
          pluginTools: state.pluginTools ?? [],
          loading: false,
          error: null,
          healthMap: {},
          permissionMode: state.permissionMode ?? 'compat',
          permissionStates: state.permissionStates ?? {},
          pendingUpdates: state.pendingUpdates ?? [],
          marketplaceCatalog: state.marketplaceCatalog ?? null,
          marketplaceCatalogSource: state.marketplaceCatalogSource ?? null,
          marketplaceSyncState: state.marketplaceSyncState ?? 'idle',
          marketplaceLastSyncedAt: state.marketplaceLastSyncedAt ?? null,
          marketplaceLastError: state.marketplaceLastError ?? null,
          marketplaceAcquisitions: state.marketplaceAcquisitions ?? {},
        } as PluginState;
      },
      partialize: (state) => ({
        installedPlugins: state.installedPlugins,
        pluginTools: state.pluginTools,
        pendingUpdates: state.pendingUpdates,
        marketplaceCatalog: state.marketplaceCatalog,
        marketplaceCatalogSource: state.marketplaceCatalogSource,
        marketplaceSyncState: state.marketplaceSyncState,
        marketplaceLastSyncedAt: state.marketplaceLastSyncedAt,
        marketplaceLastError: state.marketplaceLastError,
        marketplaceAcquisitions: state.marketplaceAcquisitions,
      }),
    },
  ),
);
