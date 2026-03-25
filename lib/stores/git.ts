import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const MAX_RECENT_REPOS = 10;
const MAX_CLONE_HISTORY = 20;
const GIT_REPO_STORE_VERSION = 3;

export const GIT_WORKBENCH_TABS = [
  'overview',
  'repository',
  'graph',
  'history',
  'changes',
  'tools',
  'advanced',
  'operations',
] as const;

export type GitWorkbenchTab = (typeof GIT_WORKBENCH_TABS)[number];

export const GIT_WORKBENCH_PANEL_IDS = [
  'graphDetail',
  'historyDetail',
  'changesInspector',
  'toolsWorkspace',
  'advancedWorkspace',
  'operationsWorkspace',
] as const;

export type GitWorkbenchPanelId = (typeof GIT_WORKBENCH_PANEL_IDS)[number];

export interface GitWorkbenchPanelPreference {
  collapsed: boolean;
  hidden: boolean;
}

export type GitWorkbenchPanelsState = Record<
  GitWorkbenchPanelId,
  GitWorkbenchPanelPreference
>;

export interface GitWorkbenchPreference {
  activeTab: GitWorkbenchTab;
  panels: GitWorkbenchPanelsState;
}

export interface CloneHistoryEntry {
  url: string;
  destPath: string;
  timestamp: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeGitWorkbenchTab(value: unknown): GitWorkbenchTab {
  return GIT_WORKBENCH_TABS.includes(value as GitWorkbenchTab)
    ? (value as GitWorkbenchTab)
    : 'overview';
}

export function createDefaultGitWorkbenchPanelsState(): GitWorkbenchPanelsState {
  return {
    graphDetail: { collapsed: false, hidden: false },
    historyDetail: { collapsed: false, hidden: false },
    changesInspector: { collapsed: false, hidden: false },
    toolsWorkspace: { collapsed: false, hidden: false },
    advancedWorkspace: { collapsed: false, hidden: false },
    operationsWorkspace: { collapsed: false, hidden: false },
  };
}

export function createDefaultGitWorkbenchPreference(): GitWorkbenchPreference {
  return {
    activeTab: 'overview',
    panels: createDefaultGitWorkbenchPanelsState(),
  };
}

function sanitizeGitWorkbenchPanelsState(value: unknown): GitWorkbenchPanelsState {
  const sanitized = createDefaultGitWorkbenchPanelsState();
  if (!isObjectRecord(value)) return sanitized;

  for (const panelId of GIT_WORKBENCH_PANEL_IDS) {
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

function sanitizeWorkbenchByRepoPath(
  value: unknown,
): Record<string, GitWorkbenchPreference> {
  if (!isObjectRecord(value)) return {};

  const result: Record<string, GitWorkbenchPreference> = {};
  for (const [repoPath, rawPreference] of Object.entries(value)) {
    if (typeof repoPath !== 'string' || !repoPath.trim() || !isObjectRecord(rawPreference)) {
      continue;
    }

    result[repoPath] = {
      activeTab: sanitizeGitWorkbenchTab(rawPreference.activeTab),
      panels: sanitizeGitWorkbenchPanelsState(rawPreference.panels),
    };
  }

  return result;
}

interface GitRepoStoreState {
  recentRepos: string[];
  pinnedRepos: string[];
  lastRepoPath: string | null;
  workbenchByRepoPath: Record<string, GitWorkbenchPreference>;

  addRecentRepo: (path: string) => void;
  removeRecentRepo: (path: string) => void;
  pinRepo: (path: string) => void;
  unpinRepo: (path: string) => void;
  setLastRepo: (path: string | null) => void;
  clearRecent: () => void;
  getWorkbenchPreference: (path: string | null | undefined) => GitWorkbenchPreference;
  setWorkbenchActiveTab: (path: string, activeTab: GitWorkbenchTab) => void;
  setWorkbenchPanelCollapsed: (
    path: string,
    panelId: GitWorkbenchPanelId,
    collapsed: boolean,
  ) => void;
  hideWorkbenchPanel: (path: string, panelId: GitWorkbenchPanelId) => void;
  restoreWorkbenchPanel: (path: string, panelId: GitWorkbenchPanelId) => void;
  restoreAllWorkbenchPanels: (path: string) => void;

  cloneHistory: CloneHistoryEntry[];
  addCloneHistory: (entry: CloneHistoryEntry) => void;
  clearCloneHistory: () => void;
}

export const useGitRepoStore = create<GitRepoStoreState>()(
  persist(
    (set, get) => ({
      recentRepos: [],
      pinnedRepos: [],
      lastRepoPath: null,
      workbenchByRepoPath: {},

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

      getWorkbenchPreference: (path) => {
        if (!path) return createDefaultGitWorkbenchPreference();
        return get().workbenchByRepoPath[path] ?? createDefaultGitWorkbenchPreference();
      },

      setWorkbenchActiveTab: (path, activeTab) =>
        set((state) => {
          if (!path) return state;
          const current = state.workbenchByRepoPath[path] ?? createDefaultGitWorkbenchPreference();
          return {
            workbenchByRepoPath: {
              ...state.workbenchByRepoPath,
              [path]: {
                ...current,
                activeTab,
              },
            },
          };
        }),

      setWorkbenchPanelCollapsed: (path, panelId, collapsed) =>
        set((state) => {
          if (!path) return state;
          const current = state.workbenchByRepoPath[path] ?? createDefaultGitWorkbenchPreference();
          return {
            workbenchByRepoPath: {
              ...state.workbenchByRepoPath,
              [path]: {
                ...current,
                panels: {
                  ...current.panels,
                  [panelId]: {
                    ...current.panels[panelId],
                    collapsed,
                  },
                },
              },
            },
          };
        }),

      hideWorkbenchPanel: (path, panelId) =>
        set((state) => {
          if (!path) return state;
          const current = state.workbenchByRepoPath[path] ?? createDefaultGitWorkbenchPreference();
          return {
            workbenchByRepoPath: {
              ...state.workbenchByRepoPath,
              [path]: {
                ...current,
                panels: {
                  ...current.panels,
                  [panelId]: {
                    ...current.panels[panelId],
                    hidden: true,
                  },
                },
              },
            },
          };
        }),

      restoreWorkbenchPanel: (path, panelId) =>
        set((state) => {
          if (!path) return state;
          const current = state.workbenchByRepoPath[path] ?? createDefaultGitWorkbenchPreference();
          return {
            workbenchByRepoPath: {
              ...state.workbenchByRepoPath,
              [path]: {
                ...current,
                panels: {
                  ...current.panels,
                  [panelId]: {
                    ...current.panels[panelId],
                    hidden: false,
                  },
                },
              },
            },
          };
        }),

      restoreAllWorkbenchPanels: (path) =>
        set((state) => {
          if (!path) return state;
          const current = state.workbenchByRepoPath[path] ?? createDefaultGitWorkbenchPreference();
          const nextPanels = { ...current.panels };
          for (const panelId of GIT_WORKBENCH_PANEL_IDS) {
            nextPanels[panelId] = {
              ...nextPanels[panelId],
              hidden: false,
            };
          }
          return {
            workbenchByRepoPath: {
              ...state.workbenchByRepoPath,
              [path]: {
                ...current,
                panels: nextPanels,
              },
            },
          };
        }),

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
      version: GIT_REPO_STORE_VERSION,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          state.cloneHistory = [];
        }
        if (version < 3) {
          state.workbenchByRepoPath = {};
        }
        state.workbenchByRepoPath = sanitizeWorkbenchByRepoPath(
          state.workbenchByRepoPath,
        );
        return state as unknown as GitRepoStoreState;
      },
      partialize: (state) => ({
        recentRepos: state.recentRepos,
        pinnedRepos: state.pinnedRepos,
        lastRepoPath: state.lastRepoPath,
        workbenchByRepoPath: state.workbenchByRepoPath,
        cloneHistory: state.cloneHistory,
      }),
    },
  ),
);
