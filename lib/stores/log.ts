import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ALL_LEVELS } from '@/lib/constants/log';

export type { LogLevel, LogEntry, LogFilter, LogFileInfo } from '@/types/log';
import type { LogLevel, LogEntry, LogFilter, LogFileInfo } from '@/types/log';

const EMPTY_LOG_COUNTS: Record<LogLevel, number> = {
  trace: 0, debug: 0, info: 0, warn: 0, error: 0,
};

interface LogState {
  logs: LogEntry[];
  maxLogs: number;
  filter: LogFilter;
  autoScroll: boolean;
  paused: boolean;
  drawerOpen: boolean;
  logFiles: LogFileInfo[];
  selectedLogFile: string | null;
  bookmarkedIds: string[];
  showBookmarksOnly: boolean;
  _logCounts: Record<LogLevel, number>;
  
  // Actions
  addLog: (log: Omit<LogEntry, 'id'>) => void;
  addLogs: (logs: Omit<LogEntry, 'id'>[]) => void;
  clearLogs: () => void;
  setFilter: (filter: Partial<LogFilter>) => void;
  toggleLevel: (level: LogLevel) => void;
  setSearch: (search: string) => void;
  setTimeRange: (startTime: number | null, endTime: number | null) => void;
  toggleRegex: () => void;
  toggleAutoScroll: () => void;
  togglePaused: () => void;
  setMaxLogs: (max: number) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setLogFiles: (files: LogFileInfo[]) => void;
  setSelectedLogFile: (fileName: string | null) => void;
  toggleBookmark: (id: string) => void;
  setShowBookmarksOnly: (show: boolean) => void;
  
  // Computed
  getFilteredLogs: () => LogEntry[];
  getLogStats: () => { total: number; byLevel: Record<LogLevel, number> };
}

let logIdCounter = 0;

function generateLogId(): string {
  return `log_${Date.now()}_${logIdCounter++}`;
}

function buildLogCounts(logs: LogEntry[]): Record<LogLevel, number> {
  const counts = { ...EMPTY_LOG_COUNTS };
  for (const log of logs) {
    counts[log.level] = (counts[log.level] || 0) + 1;
  }
  return counts;
}

function trimBookmarkedIds(logs: LogEntry[], bookmarkedIds: string[]): string[] {
  if (bookmarkedIds.length === 0) return bookmarkedIds;
  const existingIds = new Set(logs.map((log) => log.id));
  return bookmarkedIds.filter((id) => existingIds.has(id));
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      logs: [],
      maxLogs: 1000,
      filter: {
        levels: ['info', 'warn', 'error'],
        search: '',
        useRegex: false,
        maxScanLines: null,
        startTime: null,
        endTime: null,
      },
      autoScroll: true,
      paused: false,
      drawerOpen: false,
      logFiles: [],
      selectedLogFile: null,
      bookmarkedIds: [],
      showBookmarksOnly: false,
      _logCounts: { ...EMPTY_LOG_COUNTS },

      addLog: (log) => set((state) => {
        if (state.paused) return state;
        const newLog: LogEntry = { ...log, id: generateLogId() };
        const counts = { ...state._logCounts };
        counts[newLog.level] = (counts[newLog.level] || 0) + 1;
        if (state.logs.length >= state.maxLogs) {
          const removed = state.logs[0];
          counts[removed.level] = Math.max(0, (counts[removed.level] || 0) - 1);
          const nextLogs = [...state.logs.slice(1), newLog];
          const nextBookmarks = state.bookmarkedIds.includes(removed.id)
            ? state.bookmarkedIds.filter((id) => id !== removed.id)
            : state.bookmarkedIds;
          return { logs: nextLogs, _logCounts: counts, bookmarkedIds: nextBookmarks };
        }
        return { logs: [...state.logs, newLog], _logCounts: counts };
      }),

      addLogs: (logs) => set((state) => {
        if (state.paused) return state;
        const newLogs = logs.map((log) => ({ ...log, id: generateLogId() }));
        const allLogs = [...state.logs, ...newLogs];
        const trimmed = allLogs.slice(-state.maxLogs);
        const counts = buildLogCounts(trimmed);
        const bookmarkedIds = trimBookmarkedIds(trimmed, state.bookmarkedIds);
        return { logs: trimmed, _logCounts: counts, bookmarkedIds };
      }),

      clearLogs: () => set({ logs: [], bookmarkedIds: [], _logCounts: { ...EMPTY_LOG_COUNTS } }),

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

      setTimeRange: (startTime, endTime) => set((state) => ({
        filter: {
          ...state.filter,
          startTime,
          endTime,
        },
      })),

      toggleRegex: () => set((state) => ({
        filter: {
          ...state.filter,
          useRegex: !state.filter.useRegex,
        },
      })),

      toggleAutoScroll: () => set((state) => ({
        autoScroll: !state.autoScroll,
      })),

      togglePaused: () => set((state) => ({
        paused: !state.paused,
      })),

      setMaxLogs: (maxLogs) => set((state) => {
        const normalizedMaxLogs = Math.max(1, maxLogs);
        const logs = state.logs.slice(-normalizedMaxLogs);
        return {
          maxLogs: normalizedMaxLogs,
          logs,
          _logCounts: buildLogCounts(logs),
          bookmarkedIds: trimBookmarkedIds(logs, state.bookmarkedIds),
        };
      }),

      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
      toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

      setLogFiles: (logFiles) => set({ logFiles }),
      setSelectedLogFile: (selectedLogFile) => set({ selectedLogFile }),
      toggleBookmark: (id) => set((state) => ({
        bookmarkedIds: state.bookmarkedIds.includes(id)
          ? state.bookmarkedIds.filter((i) => i !== id)
          : [...state.bookmarkedIds, id],
      })),
      setShowBookmarksOnly: (showBookmarksOnly) => set({ showBookmarksOnly }),

      getFilteredLogs: () => {
        const state = get();
        const { search, useRegex, startTime, endTime } = state.filter;
        const bookmarkedSet = state.showBookmarksOnly
          ? new Set(state.bookmarkedIds)
          : null;
        let regex: RegExp | null = null;

        if (useRegex && search) {
          try {
            regex = new RegExp(search, 'i');
          } catch {
            regex = null;
          }
        }

        return state.logs.filter((log) => {
          // Level filter
          if (!state.filter.levels.includes(log.level)) {
            return false;
          }
          // Time range filter
          if (startTime && log.timestamp < startTime) {
            return false;
          }
          if (endTime && log.timestamp > endTime) {
            return false;
          }
          // Search filter
          if (search) {
            if (regex) {
              const messageMatch = regex.test(log.message);
              const targetMatch = log.target ? regex.test(log.target) : false;
              if (!messageMatch && !targetMatch) {
                return false;
              }
            } else {
              const searchLower = search.toLowerCase();
              const messageMatch = log.message.toLowerCase().includes(searchLower);
              const targetMatch = log.target?.toLowerCase().includes(searchLower);
              if (!messageMatch && !targetMatch) {
                return false;
              }
            }
          }
          // Target filter
          if (state.filter.target) {
            if (!log.target?.includes(state.filter.target)) {
              return false;
            }
          }
          // Bookmarks filter
          if (bookmarkedSet && !bookmarkedSet.has(log.id)) {
            return false;
          }
          return true;
        });
      },

      getLogStats: () => {
        const state = get();
        return { total: state.logs.length, byLevel: { ...state._logCounts } };
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
          useRegex: false,
          maxScanLines: state.filter.maxScanLines ?? null,
          startTime: null,
          endTime: null,
        },
        autoScroll: state.autoScroll,
        bookmarkedIds: state.bookmarkedIds,
      }),
    }
  )
);

export { ALL_LEVELS };
export type { LogLevel as LogLevelType } from '@/types/log';
