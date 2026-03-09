import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ToolCategoryFilter } from '@/types/toolbox';
import type { ToolLifecyclePhase, ToolLifecycleSnapshot } from '@/types/tool-contract';
import type { ToolboxContinuationHint } from '@/types/toolbox-marketplace';

const MAX_RECENT_TOOLS = 10;
const TOOLBOX_STORE_VERSION = 5;

export const TOOLBOX_ASSISTANCE_PANEL_IDS = ['history', 'featured'] as const;
export type ToolboxAssistancePanelId = (typeof TOOLBOX_ASSISTANCE_PANEL_IDS)[number];

export interface ToolboxAssistancePanelPreference {
  collapsed: boolean;
  hidden: boolean;
}

export type ToolboxAssistancePanelsState = Record<
  ToolboxAssistancePanelId,
  ToolboxAssistancePanelPreference
>;

type ToolPreferencePrimitive = string | number | boolean | null;
export type ToolPreferenceRecord = Record<string, ToolPreferencePrimitive>;
type WidenPrimitive<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;
export type ToolPreferenceShape<T extends ToolPreferenceRecord> = {
  [K in keyof T]: WidenPrimitive<T[K]>;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function sanitizeToolUseCounts(value: unknown): Record<string, number> {
  if (!isObjectRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
      result[key] = count;
    }
  }
  return result;
}

function sanitizeToolPreferenceRecord(value: unknown): ToolPreferenceRecord {
  if (!isObjectRecord(value)) return {};
  const result: ToolPreferenceRecord = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    ) {
      result[key] = item;
    }
  }
  return result;
}

function sanitizeToolPreferencesMap(value: unknown): Record<string, ToolPreferenceRecord> {
  if (!isObjectRecord(value)) return {};
  const result: Record<string, ToolPreferenceRecord> = {};
  for (const [toolId, preferences] of Object.entries(value)) {
    if (typeof toolId === 'string') {
      result[toolId] = sanitizeToolPreferenceRecord(preferences);
    }
  }
  return result;
}

function createDefaultAssistancePanelsState(): ToolboxAssistancePanelsState {
  return {
    history: {
      collapsed: false,
      hidden: false,
    },
    featured: {
      collapsed: false,
      hidden: false,
    },
  };
}

function sanitizeAssistancePanelsState(value: unknown): ToolboxAssistancePanelsState {
  const sanitized = createDefaultAssistancePanelsState();
  if (!isObjectRecord(value)) return sanitized;

  for (const panelId of TOOLBOX_ASSISTANCE_PANEL_IDS) {
    const rawPanel = value[panelId];
    if (!isObjectRecord(rawPanel)) continue;

    if (typeof rawPanel.collapsed === 'boolean') {
      sanitized[panelId].collapsed = rawPanel.collapsed;
    }
    if (typeof rawPanel.hidden === 'boolean') {
      sanitized[panelId].hidden = rawPanel.hidden;
    }
  }

  return sanitized;
}

interface ToolboxState {
  favorites: string[];
  recentTools: string[];
  toolUseCounts: Record<string, number>;
  toolPreferences: Record<string, ToolPreferenceRecord>;
  assistancePanels: ToolboxAssistancePanelsState;
  viewMode: 'grid' | 'list';
  toolLifecycles: Record<string, ToolLifecycleSnapshot>;
  continuationHint: ToolboxContinuationHint | null;

  selectedCategory: ToolCategoryFilter;
  searchQuery: string;
  activeToolId: string | null;

  toggleFavorite: (toolId: string) => void;
  addRecent: (toolId: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setCategory: (cat: ToolCategoryFilter) => void;
  setSearchQuery: (q: string) => void;
  setActiveToolId: (id: string | null) => void;
  setToolPreferences: (toolId: string, patch: ToolPreferenceRecord) => void;
  getToolPreferences: <T extends ToolPreferenceRecord>(toolId: string, defaults: T) => ToolPreferenceShape<T>;
  setToolLifecycle: (toolId: string, phase: ToolLifecyclePhase, message?: string) => void;
  clearToolLifecycle: (toolId: string) => void;
  setContinuationHint: (hint: ToolboxContinuationHint) => void;
  clearContinuationHint: () => void;
  setAssistancePanelCollapsed: (panelId: ToolboxAssistancePanelId, collapsed: boolean) => void;
  hideAssistancePanel: (panelId: ToolboxAssistancePanelId) => void;
  restoreAssistancePanel: (panelId: ToolboxAssistancePanelId) => void;
  restoreAllAssistancePanels: () => void;
}

export const useToolboxStore = create<ToolboxState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recentTools: [],
      toolUseCounts: {},
      toolPreferences: {},
      assistancePanels: createDefaultAssistancePanelsState(),
      viewMode: 'grid',
      toolLifecycles: {},
      continuationHint: null,

      selectedCategory: 'all',
      searchQuery: '',
      activeToolId: null,

      toggleFavorite: (toolId) =>
        set((state) => ({
          favorites: state.favorites.includes(toolId)
            ? state.favorites.filter((id) => id !== toolId)
            : [...state.favorites, toolId],
        })),

      addRecent: (toolId) =>
        set((state) => {
          const filtered = state.recentTools.filter((id) => id !== toolId);
          return {
            recentTools: [toolId, ...filtered].slice(0, MAX_RECENT_TOOLS),
            toolUseCounts: { ...state.toolUseCounts, [toolId]: (state.toolUseCounts[toolId] ?? 0) + 1 },
          };
        }),

      setViewMode: (viewMode) => set({ viewMode }),
      setCategory: (selectedCategory) => set({ selectedCategory }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setActiveToolId: (activeToolId) => set({ activeToolId }),
      setToolPreferences: (toolId, patch) =>
        set((state) => {
          const nextPatch = sanitizeToolPreferenceRecord(patch);
          const existing = state.toolPreferences[toolId] ?? {};
          return {
            toolPreferences: {
              ...state.toolPreferences,
              [toolId]: {
                ...existing,
                ...nextPatch,
              },
            },
          };
        }),
      getToolPreferences: <T extends ToolPreferenceRecord>(toolId: string, defaults: T) => {
        const rawPreferences = get().toolPreferences[toolId] ?? {};
        const merged: ToolPreferenceRecord = { ...defaults };
        for (const [key, value] of Object.entries(rawPreferences)) {
          if (!(key in defaults)) continue;
          const expectedType = typeof defaults[key];
          const actualType = typeof value;
          if (value === null || expectedType === actualType) {
            merged[key] = value;
          }
        }
        return merged as ToolPreferenceShape<T>;
      },
      setToolLifecycle: (toolId, phase, message) =>
        set((state) => ({
          toolLifecycles: {
            ...state.toolLifecycles,
            [toolId]: {
              phase,
              updatedAt: Date.now(),
              ...(message ? { message } : {}),
            },
          },
        })),
      clearToolLifecycle: (toolId) =>
        set((state) => {
          if (!(toolId in state.toolLifecycles)) return state;
          const next = { ...state.toolLifecycles };
          delete next[toolId];
          return { toolLifecycles: next };
        }),
      setContinuationHint: (continuationHint) => set({ continuationHint }),
      clearContinuationHint: () => set({ continuationHint: null }),
      setAssistancePanelCollapsed: (panelId, collapsed) =>
        set((state) => ({
          assistancePanels: {
            ...state.assistancePanels,
            [panelId]: {
              ...state.assistancePanels[panelId],
              collapsed,
            },
          },
        })),
      hideAssistancePanel: (panelId) =>
        set((state) => ({
          assistancePanels: {
            ...state.assistancePanels,
            [panelId]: {
              ...state.assistancePanels[panelId],
              hidden: true,
            },
          },
        })),
      restoreAssistancePanel: (panelId) =>
        set((state) => ({
          assistancePanels: {
            ...state.assistancePanels,
            [panelId]: {
              ...state.assistancePanels[panelId],
              hidden: false,
            },
          },
        })),
      restoreAllAssistancePanels: () =>
        set((state) => ({
          assistancePanels: {
            history: {
              ...state.assistancePanels.history,
              hidden: false,
            },
            featured: {
              ...state.assistancePanels.featured,
              hidden: false,
            },
          },
        })),
    }),
    {
      name: 'cognia-toolbox',
      storage: createJSONStorage(() => localStorage),
      version: TOOLBOX_STORE_VERSION,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<ToolboxState>;
        return {
          favorites: sanitizeStringArray(state.favorites),
          recentTools: sanitizeStringArray(state.recentTools).slice(0, MAX_RECENT_TOOLS),
          toolUseCounts: sanitizeToolUseCounts(state.toolUseCounts),
          toolPreferences: sanitizeToolPreferencesMap(state.toolPreferences),
          assistancePanels: sanitizeAssistancePanelsState(state.assistancePanels),
          viewMode: state.viewMode === 'list' ? 'list' : 'grid',
          toolLifecycles: {},
          continuationHint: state.continuationHint ?? null,
        } as ToolboxState;
      },
      partialize: (state) => ({
        favorites: state.favorites,
        recentTools: state.recentTools,
        toolUseCounts: state.toolUseCounts,
        toolPreferences: state.toolPreferences,
        assistancePanels: state.assistancePanels,
        viewMode: state.viewMode,
        continuationHint: state.continuationHint,
      }),
    },
  ),
);
