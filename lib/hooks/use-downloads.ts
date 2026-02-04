import { useCallback, useEffect, useRef } from 'react';
import * as tauri from '@/lib/tauri';
import { useDownloadStore } from '@/lib/stores/download';
import type {
  DownloadTask,
  DownloadProgress,
  QueueStats,
  HistoryRecord,
  HistoryStats,
  DownloadRequest,
  DiskSpace,
} from '@/lib/stores/download';

/**
 * Hook for managing downloads with Tauri backend integration
 */
export function useDownloads() {
  const store = useDownloadStore();
  const unlistenRefs = useRef<(() => void)[]>([]);

  // Refresh tasks from backend
  const refreshTasks = useCallback(async () => {
    if (!tauri.isTauri()) return;

    try {
      store.setLoading(true);
      const tasks = await tauri.downloadList();
      store.setTasks(tasks as DownloadTask[]);
    } catch (err) {
      store.setError(String(err));
    } finally {
      store.setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh stats from backend
  const refreshStats = useCallback(async () => {
    if (!tauri.isTauri()) return;

    try {
      const stats = await tauri.downloadStats();
      store.setStats(stats as QueueStats);
    } catch (err) {
      console.error('Failed to refresh stats:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh history from backend
  const refreshHistory = useCallback(async (limit?: number) => {
    if (!tauri.isTauri()) return;

    try {
      const history = await tauri.downloadHistoryList(limit ?? 100);
      store.setHistory(history as HistoryRecord[]);

      const stats = await tauri.downloadHistoryStats();
      store.setHistoryStats(stats as HistoryStats);
    } catch (err) {
      console.error('Failed to refresh history:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!tauri.isTauri()) return;

    const setupListeners = async () => {
      try {
        const unlistenAdded = await tauri.listenDownloadTaskAdded(() => {
          refreshTasks();
        });

        const unlistenStarted = await tauri.listenDownloadTaskStarted((taskId) => {
          store.updateTask(taskId, { state: 'downloading' });
        });

        const unlistenProgress = await tauri.listenDownloadTaskProgress(
          (taskId, progress) => {
            store.updateTaskProgress(taskId, progress as DownloadProgress);
          }
        );

        const unlistenCompleted = await tauri.listenDownloadTaskCompleted((taskId) => {
          store.updateTask(taskId, { state: 'completed' });
          refreshHistory();
        });

        const unlistenFailed = await tauri.listenDownloadTaskFailed((taskId, error) => {
          store.updateTask(taskId, {
            state: 'failed',
            error,
          });
        });

        const unlistenPaused = await tauri.listenDownloadTaskPaused((taskId) => {
          store.updateTask(taskId, { state: 'paused' });
        });

        const unlistenResumed = await tauri.listenDownloadTaskResumed((taskId) => {
          store.updateTask(taskId, { state: 'queued' });
        });

        const unlistenCancelled = await tauri.listenDownloadTaskCancelled((taskId) => {
          store.updateTask(taskId, { state: 'cancelled' });
        });

        const unlistenQueueUpdated = await tauri.listenDownloadQueueUpdated((stats) => {
          store.setStats(stats as QueueStats);
        });

        unlistenRefs.current = [
          unlistenAdded,
          unlistenStarted,
          unlistenProgress,
          unlistenCompleted,
          unlistenFailed,
          unlistenPaused,
          unlistenResumed,
          unlistenCancelled,
          unlistenQueueUpdated,
        ];
      } catch (err) {
        console.error('Failed to setup download listeners:', err);
      }
    };

    setupListeners();

    return () => {
      unlistenRefs.current.forEach((unlisten) => unlisten?.());
      unlistenRefs.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTasks, refreshHistory]);

  // Initial data fetch
  useEffect(() => {
    refreshTasks();
    refreshStats();
  }, [refreshTasks, refreshStats]);

  // Add a new download
  const addDownload = useCallback(
    async (request: DownloadRequest): Promise<string> => {
      if (!tauri.isTauri()) {
        throw new Error('Tauri not available');
      }

      const taskId = await tauri.downloadAdd(request as tauri.DownloadRequest);
      await refreshTasks();
      return taskId;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTasks]
  );

  // Pause a download
  const pauseDownload = useCallback(async (taskId: string) => {
    if (!tauri.isTauri()) return;
    await tauri.downloadPause(taskId);
  }, []);

  // Resume a download
  const resumeDownload = useCallback(async (taskId: string) => {
    if (!tauri.isTauri()) return;
    await tauri.downloadResume(taskId);
  }, []);

  // Cancel a download
  const cancelDownload = useCallback(async (taskId: string) => {
    if (!tauri.isTauri()) return;
    await tauri.downloadCancel(taskId);
  }, []);

  // Remove a download
  const removeDownload = useCallback(
    async (taskId: string) => {
      if (!tauri.isTauri()) return;
      await tauri.downloadRemove(taskId);
      store.removeTask(taskId);
    },
    [store]
  );

  // Pause all downloads
  const pauseAll = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    return await tauri.downloadPauseAll();
  }, []);

  // Resume all downloads
  const resumeAll = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    return await tauri.downloadResumeAll();
  }, []);

  // Cancel all downloads
  const cancelAll = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    return await tauri.downloadCancelAll();
  }, []);

  // Clear finished downloads
  const clearFinished = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    const count = await tauri.downloadClearFinished();
    await refreshTasks();
    return count;
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTasks]);

  // Retry failed downloads
  const retryFailed = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    return await tauri.downloadRetryFailed();
  }, []);

  // Set speed limit
  const setSpeedLimit = useCallback(
    async (bytesPerSecond: number) => {
      if (!tauri.isTauri()) return;
      await tauri.downloadSetSpeedLimit(bytesPerSecond);
      store.setSpeedLimit(bytesPerSecond);
    },
    [store]
  );

  // Get speed limit
  const getSpeedLimit = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    return await tauri.downloadGetSpeedLimit();
  }, []);

  // Set max concurrent downloads
  const setMaxConcurrent = useCallback(
    async (max: number) => {
      if (!tauri.isTauri()) return;
      await tauri.downloadSetMaxConcurrent(max);
      store.setMaxConcurrent(max);
    },
    [store]
  );

  // Search history
  const searchHistory = useCallback(async (query: string): Promise<HistoryRecord[]> => {
    if (!tauri.isTauri()) return [];
    const records = await tauri.downloadHistorySearch(query);
    return records as HistoryRecord[];
  }, []);

  // Clear history
  const clearHistory = useCallback(
    async (days?: number): Promise<number> => {
      if (!tauri.isTauri()) return 0;
      const count = await tauri.downloadHistoryClear(days);
      store.clearHistory();
      return count;
    },
    [store]
  );

  // Remove history record
  const removeHistoryRecord = useCallback(
    async (id: string): Promise<boolean> => {
      if (!tauri.isTauri()) return false;
      const removed = await tauri.downloadHistoryRemove(id);
      if (removed) {
        store.removeHistoryRecord(id);
      }
      return removed;
    },
    [store]
  );

  // Get disk space
  const getDiskSpace = useCallback(async (path: string): Promise<DiskSpace> => {
    if (!tauri.isTauri()) {
      throw new Error('Tauri not available');
    }
    const space = await tauri.diskSpaceGet(path);
    return space as DiskSpace;
  }, []);

  // Check disk space
  const checkDiskSpace = useCallback(
    async (path: string, required: number): Promise<boolean> => {
      if (!tauri.isTauri()) return true;
      return await tauri.diskSpaceCheck(path, required);
    },
    []
  );

  return {
    // State
    tasks: store.tasks,
    stats: store.stats,
    history: store.history,
    historyStats: store.historyStats,
    speedLimit: store.speedLimit,
    maxConcurrent: store.maxConcurrent,
    isLoading: store.isLoading,
    error: store.error,
    selectedTaskIds: store.selectedTaskIds,
    showHistory: store.showHistory,

    // Computed
    activeTasks: store.getActiveTasks(),
    pausedTasks: store.getPausedTasks(),
    completedTasks: store.getCompletedTasks(),
    failedTasks: store.getFailedTasks(),

    // Actions - Downloads
    addDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    removeDownload,
    pauseAll,
    resumeAll,
    cancelAll,
    clearFinished,
    retryFailed,

    // Actions - Settings
    setSpeedLimit,
    getSpeedLimit,
    setMaxConcurrent,

    // Actions - History
    refreshHistory,
    searchHistory,
    clearHistory,
    removeHistoryRecord,

    // Actions - Disk
    getDiskSpace,
    checkDiskSpace,

    // Actions - Refresh
    refreshTasks,
    refreshStats,

    // Actions - UI
    selectTask: store.selectTask,
    deselectTask: store.deselectTask,
    selectAllTasks: store.selectAllTasks,
    deselectAllTasks: store.deselectAllTasks,
    toggleShowHistory: store.toggleShowHistory,
    clearError: () => store.setError(null),
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format speed to human-readable string
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
