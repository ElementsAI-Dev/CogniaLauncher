import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  target?: string;
  file?: string;
  line?: number;
}

export interface LogFilter {
  levels: LogLevel[];
  search: string;
  target?: string;
}

export interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modified: number;
}

interface LogState {
  logs: LogEntry[];
  maxLogs: number;
  filter: LogFilter;
  autoScroll: boolean;
  paused: boolean;
  drawerOpen: boolean;
  logFiles: LogFileInfo[];
  selectedLogFile: string | null;
  
  // Actions
  addLog: (log: Omit<LogEntry, 'id'>) => void;
  addLogs: (logs: Omit<LogEntry, 'id'>[]) => void;
  clearLogs: () => void;
  setFilter: (filter: Partial<LogFilter>) => void;
  toggleLevel: (level: LogLevel) => void;
  setSearch: (search: string) => void;
  toggleAutoScroll: () => void;
  togglePaused: () => void;
  setMaxLogs: (max: number) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setLogFiles: (files: LogFileInfo[]) => void;
  setSelectedLogFile: (fileName: string | null) => void;
  
  // Computed
  getFilteredLogs: () => LogEntry[];
  getLogStats: () => { total: number; byLevel: Record<LogLevel, number> };
}

const ALL_LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

let logIdCounter = 0;

function generateLogId(): string {
  return `log_${Date.now()}_${logIdCounter++}`;
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      logs: [],
      maxLogs: 1000,
      filter: {
        levels: ['info', 'warn', 'error'],
        search: '',
      },
      autoScroll: true,
      paused: false,
      drawerOpen: false,
      logFiles: [],
      selectedLogFile: null,

      addLog: (log) => set((state) => {
        if (state.paused) return state;
        const newLog: LogEntry = { ...log, id: generateLogId() };
        const newLogs = [...state.logs, newLog];
        return { logs: newLogs.slice(-state.maxLogs) };
      }),

      addLogs: (logs) => set((state) => {
        if (state.paused) return state;
        const newLogs = logs.map((log) => ({ ...log, id: generateLogId() }));
        const allLogs = [...state.logs, ...newLogs];
        return { logs: allLogs.slice(-state.maxLogs) };
      }),

      clearLogs: () => set({ logs: [] }),

      setFilter: (filter) => set((state) => ({
        filter: { ...state.filter, ...filter },
      })),

      toggleLevel: (level) => set((state) => {
        const levels = [...state.filter.levels];
        const index = levels.indexOf(level);
        if (index === -1) {
          levels.push(level);
        } else {
          levels.splice(index, 1);
        }
        return { filter: { ...state.filter, levels } };
      }),

      setSearch: (search) => set((state) => ({
        filter: { ...state.filter, search },
      })),

      toggleAutoScroll: () => set((state) => ({
        autoScroll: !state.autoScroll,
      })),

      togglePaused: () => set((state) => ({
        paused: !state.paused,
      })),

      setMaxLogs: (maxLogs) => set((state) => ({
        maxLogs,
        logs: state.logs.slice(-maxLogs),
      })),

      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
      toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

      setLogFiles: (logFiles) => set({ logFiles }),
      setSelectedLogFile: (selectedLogFile) => set({ selectedLogFile }),

      getFilteredLogs: () => {
        const state = get();
        return state.logs.filter((log) => {
          // Level filter
          if (!state.filter.levels.includes(log.level)) {
            return false;
          }
          // Search filter
          if (state.filter.search) {
            const searchLower = state.filter.search.toLowerCase();
            const messageMatch = log.message.toLowerCase().includes(searchLower);
            const targetMatch = log.target?.toLowerCase().includes(searchLower);
            if (!messageMatch && !targetMatch) {
              return false;
            }
          }
          // Target filter
          if (state.filter.target) {
            if (!log.target?.includes(state.filter.target)) {
              return false;
            }
          }
          return true;
        });
      },

      getLogStats: () => {
        const state = get();
        const byLevel: Record<LogLevel, number> = {
          trace: 0,
          debug: 0,
          info: 0,
          warn: 0,
          error: 0,
        };
        for (const log of state.logs) {
          byLevel[log.level]++;
        }
        return { total: state.logs.length, byLevel };
      },
    }),
    {
      name: 'cognia-log-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        maxLogs: state.maxLogs,
        filter: {
          levels: state.filter.levels,
          search: '',
        },
        autoScroll: state.autoScroll,
      }),
    }
  )
);

export { ALL_LEVELS };
