import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ToolCategoryFilter } from '@/types/toolbox';

const MAX_RECENT_TOOLS = 10;

interface ToolboxState {
  favorites: string[];
  recentTools: string[];
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
}

export const useToolboxStore = create<ToolboxState>()(
  persist(
    (set) => ({
      favorites: [],
      recentTools: [],
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
          return { recentTools: [toolId, ...filtered].slice(0, MAX_RECENT_TOOLS) };
        }),

      setViewMode: (viewMode) => set({ viewMode }),
      setCategory: (selectedCategory) => set({ selectedCategory }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setActiveToolId: (activeToolId) => set({ activeToolId }),
    }),
    {
      name: 'cognia-toolbox',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        favorites: state.favorites,
        recentTools: state.recentTools,
        viewMode: state.viewMode,
      }),
    },
  ),
);
