import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DownloadProgress,
  DownloadTask,
  DownloadQueueStats,
  DownloadHistoryRecord,
  DownloadHistoryStats,
  DiskSpaceInfo,
  DownloadRequest,
} from '@/types/tauri';

// Re-export types for backward compatibility
export type { DownloadProgress, DownloadTask, DownloadRequest };
export type QueueStats = DownloadQueueStats;
export type HistoryRecord = DownloadHistoryRecord;
export type HistoryStats = DownloadHistoryStats;
export type DiskSpace = DiskSpaceInfo;

interface DownloadState {
  // Queue state
  tasks: DownloadTask[];
  stats: QueueStats | null;
  
  // History state
  history: HistoryRecord[];
  historyStats: HistoryStats | null;
  
  // Settings
  speedLimit: number; // 0 = unlimited
  maxConcurrent: number;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  selectedTaskIds: Set<string>;
  showHistory: boolean;
  
  // Actions - Queue
  setTasks: (tasks: DownloadTask[]) => void;
  setStats: (stats: QueueStats) => void;
  updateTask: (taskId: string, updates: Partial<DownloadTask>) => void;
  updateTaskProgress: (taskId: string, progress: DownloadProgress) => void;
  addTask: (task: DownloadTask) => void;
  removeTask: (taskId: string) => void;
  
  // Actions - History
  setHistory: (history: HistoryRecord[]) => void;
  setHistoryStats: (stats: HistoryStats) => void;
  addHistoryRecord: (record: HistoryRecord) => void;
  removeHistoryRecord: (id: string) => void;
  clearHistory: () => void;
  
  // Actions - Settings
  setSpeedLimit: (limit: number) => void;
  setMaxConcurrent: (max: number) => void;
  
  // Actions - UI
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectTask: (taskId: string) => void;
  deselectTask: (taskId: string) => void;
  selectAllTasks: () => void;
  deselectAllTasks: () => void;
  toggleShowHistory: () => void;
  
  // Computed
  getActiveTasks: () => DownloadTask[];
  getPausedTasks: () => DownloadTask[];
  getCompletedTasks: () => DownloadTask[];
  getFailedTasks: () => DownloadTask[];
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      // Initial state
      tasks: [],
      stats: null,
      history: [],
      historyStats: null,
      speedLimit: 0,
      maxConcurrent: 4,
      isLoading: false,
      error: null,
      selectedTaskIds: new Set<string>(),
      showHistory: false,

      // Queue actions
      setTasks: (tasks) => set({ tasks }),
      
      setStats: (stats) => set({ stats }),
      
      updateTask: (taskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, ...updates } : task
          ),
        })),
      
      updateTaskProgress: (taskId, progress) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, progress } : task
          ),
        })),
      
      addTask: (task) =>
        set((state) => ({
          tasks: [task, ...state.tasks],
        })),
      
      removeTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
          selectedTaskIds: new Set(
            [...state.selectedTaskIds].filter((id) => id !== taskId)
          ),
        })),

      // History actions
      setHistory: (history) => set({ history }),
      
      setHistoryStats: (stats) => set({ historyStats: stats }),
      
      addHistoryRecord: (record) =>
        set((state) => ({
          history: [record, ...state.history].slice(0, 100), // Keep last 100
        })),
      
      removeHistoryRecord: (id) =>
        set((state) => ({
          history: state.history.filter((record) => record.id !== id),
        })),
      
      clearHistory: () => set({ history: [], historyStats: null }),

      // Settings actions
      setSpeedLimit: (limit) => set({ speedLimit: limit }),
      
      setMaxConcurrent: (max) => set({ maxConcurrent: max }),

      // UI actions
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      selectTask: (taskId) =>
        set((state) => ({
          selectedTaskIds: new Set([...state.selectedTaskIds, taskId]),
        })),
      
      deselectTask: (taskId) =>
        set((state) => ({
          selectedTaskIds: new Set(
            [...state.selectedTaskIds].filter((id) => id !== taskId)
          ),
        })),
      
      selectAllTasks: () =>
        set((state) => ({
          selectedTaskIds: new Set(state.tasks.map((task) => task.id)),
        })),
      
      deselectAllTasks: () => set({ selectedTaskIds: new Set() }),
      
      toggleShowHistory: () =>
        set((state) => ({ showHistory: !state.showHistory })),

      // Computed getters
      getActiveTasks: () =>
        get().tasks.filter(
          (task) => task.state === 'downloading' || task.state === 'queued'
        ),
      
      getPausedTasks: () =>
        get().tasks.filter((task) => task.state === 'paused'),
      
      getCompletedTasks: () =>
        get().tasks.filter((task) => task.state === 'completed'),
      
      getFailedTasks: () =>
        get().tasks.filter((task) => task.state === 'failed'),
    }),
    {
      name: 'download-storage',
      partialize: (state) => ({
        speedLimit: state.speedLimit,
        maxConcurrent: state.maxConcurrent,
        showHistory: state.showHistory,
      }),
    }
  )
);

// Selectors for better performance
export const selectTasks = (state: DownloadState) => state.tasks;
export const selectStats = (state: DownloadState) => state.stats;
export const selectHistory = (state: DownloadState) => state.history;
export const selectHistoryStats = (state: DownloadState) => state.historyStats;
export const selectSpeedLimit = (state: DownloadState) => state.speedLimit;
export const selectMaxConcurrent = (state: DownloadState) => state.maxConcurrent;
export const selectIsLoading = (state: DownloadState) => state.isLoading;
export const selectError = (state: DownloadState) => state.error;
export const selectSelectedTaskIds = (state: DownloadState) => state.selectedTaskIds;
export const selectShowHistory = (state: DownloadState) => state.showHistory;
