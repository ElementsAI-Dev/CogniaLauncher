import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const MAX_RECENT_REPOS = 10;
const MAX_CLONE_HISTORY = 20;

export interface CloneHistoryEntry {
  url: string;
  destPath: string;
  timestamp: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}

interface GitRepoStoreState {
  recentRepos: string[];
  pinnedRepos: string[];
  lastRepoPath: string | null;

  addRecentRepo: (path: string) => void;
  removeRecentRepo: (path: string) => void;
  pinRepo: (path: string) => void;
  unpinRepo: (path: string) => void;
  setLastRepo: (path: string | null) => void;
  clearRecent: () => void;

  cloneHistory: CloneHistoryEntry[];
  addCloneHistory: (entry: CloneHistoryEntry) => void;
  clearCloneHistory: () => void;
}

export const useGitRepoStore = create<GitRepoStoreState>()(
  persist(
    (set) => ({
      recentRepos: [],
      pinnedRepos: [],
      lastRepoPath: null,

      addRecentRepo: (path) =>
        set((state) => {
          const filtered = state.recentRepos.filter((p) => p !== path);
          return {
            recentRepos: [path, ...filtered].slice(0, MAX_RECENT_REPOS),
            lastRepoPath: path,
          };
        }),

      removeRecentRepo: (path) =>
        set((state) => ({
          recentRepos: state.recentRepos.filter((p) => p !== path),
        })),

      pinRepo: (path) =>
        set((state) => {
          if (state.pinnedRepos.includes(path)) return state;
          return { pinnedRepos: [...state.pinnedRepos, path] };
        }),

      unpinRepo: (path) =>
        set((state) => ({
          pinnedRepos: state.pinnedRepos.filter((p) => p !== path),
        })),

      setLastRepo: (path) => set({ lastRepoPath: path }),

      clearRecent: () => set({ recentRepos: [] }),

      cloneHistory: [],
      addCloneHistory: (entry) =>
        set((state) => ({
          cloneHistory: [entry, ...state.cloneHistory].slice(0, MAX_CLONE_HISTORY),
        })),
      clearCloneHistory: () => set({ cloneHistory: [] }),
    }),
    {
      name: 'cognia-git-repos',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          state.cloneHistory = [];
        }
        return state as unknown as GitRepoStoreState;
      },
    },
  ),
);
