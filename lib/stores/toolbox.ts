import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ToolCategoryFilter } from '@/types/toolbox';

const MAX_RECENT_TOOLS = 10;
const TOOLBOX_STORE_VERSION = 3;

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

interface ToolboxState {
  favorites: string[];
  recentTools: string[];
  toolUseCounts: Record<string, number>;
  toolPreferences: Record<string, ToolPreferenceRecord>;
  viewMode: 'grid' | 'list';

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
}

export const useToolboxStore = create<ToolboxState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recentTools: [],
      toolUseCounts: {},
      toolPreferences: {},
      viewMode: 'grid',

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
          viewMode: state.viewMode === 'list' ? 'list' : 'grid',
        } as ToolboxState;
      },
      partialize: (state) => ({
        favorites: state.favorites,
        recentTools: state.recentTools,
        toolUseCounts: state.toolUseCounts,
        toolPreferences: state.toolPreferences,
        viewMode: state.viewMode,
      }),
    },
  ),
);
