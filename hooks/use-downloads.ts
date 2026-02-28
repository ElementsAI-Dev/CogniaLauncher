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

        const unlistenExtracting = await tauri.listenDownloadTaskExtracting((taskId) => {
          store.updateTask(taskId, { state: 'extracting' as DownloadTask['state'] });
        });

        const unlistenExtracted = await tauri.listenDownloadTaskExtracted(() => {
          refreshTasks();
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
          unlistenExtracting,
          unlistenExtracted,
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

  // Initial data fetch and sync settings from backend
  useEffect(() => {
    refreshTasks();
    refreshStats();

    // Sync speed limit and concurrency from backend
    const syncSettings = async () => {
      if (!tauri.isTauri()) return;
      try {
        const [backendSpeed, backendConcurrent] = await Promise.all([
          tauri.downloadGetSpeedLimit(),
          tauri.downloadGetMaxConcurrent(),
        ]);
        store.setSpeedLimit(backendSpeed);
        store.setMaxConcurrent(backendConcurrent);
      } catch (err) {
        console.error('Failed to sync download settings:', err);
      }
    };
    syncSettings();

    // Graceful shutdown: cancel active downloads on window close
    const handleBeforeUnload = () => {
      if (tauri.isTauri()) {
        tauri.downloadShutdown().catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  },  
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

  // Get max concurrent downloads
  const getMaxConcurrent = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 4;
    return await tauri.downloadGetMaxConcurrent();
  }, []);

  // Verify a downloaded file's checksum
  const verifyFile = useCallback(
    async (path: string, expectedChecksum: string) => {
      if (!tauri.isTauri()) {
        throw new Error('Tauri not available');
      }
      return await tauri.downloadVerifyFile(path, expectedChecksum);
    },
    []
  );

  // Open a downloaded file with system default app
  const openFile = useCallback(async (path: string) => {
    if (!tauri.isTauri()) return;
    await tauri.downloadOpenFile(path);
  }, []);

  // Reveal a downloaded file in system file manager
  const revealFile = useCallback(async (path: string) => {
    if (!tauri.isTauri()) return;
    await tauri.downloadRevealFile(path);
  }, []);

  // Set priority for a download task
  const setPriority = useCallback(
    async (taskId: string, priority: number) => {
      if (!tauri.isTauri()) return;
      await tauri.downloadSetPriority(taskId, priority);
      await refreshTasks();
    },
    [refreshTasks]
  );

  // Force-retry a single terminal task (failed/cancelled/completed)
  const retryTask = useCallback(
    async (taskId: string) => {
      if (!tauri.isTauri()) return;
      await tauri.downloadRetry(taskId);
      await refreshTasks();
    },
    [refreshTasks]
  );

  // Calculate SHA256 checksum of a file
  const calculateChecksum = useCallback(
    async (path: string): Promise<string> => {
      if (!tauri.isTauri()) {
        throw new Error('Tauri not available');
      }
      return await tauri.downloadCalculateChecksum(path);
    },
    []
  );

  // Batch pause selected downloads
  const batchPause = useCallback(
    async (taskIds?: string[]): Promise<number> => {
      if (!tauri.isTauri()) return 0;
      const ids = taskIds ?? [...store.selectedTaskIds];
      if (ids.length === 0) return 0;
      return await tauri.downloadBatchPause(ids);
    },
    [store.selectedTaskIds]
  );

  // Batch resume selected downloads
  const batchResume = useCallback(
    async (taskIds?: string[]): Promise<number> => {
      if (!tauri.isTauri()) return 0;
      const ids = taskIds ?? [...store.selectedTaskIds];
      if (ids.length === 0) return 0;
      return await tauri.downloadBatchResume(ids);
    },
    [store.selectedTaskIds]
  );

  // Batch cancel selected downloads
  const batchCancel = useCallback(
    async (taskIds?: string[]): Promise<number> => {
      if (!tauri.isTauri()) return 0;
      const ids = taskIds ?? [...store.selectedTaskIds];
      if (ids.length === 0) return 0;
      return await tauri.downloadBatchCancel(ids);
    },
    [store.selectedTaskIds]
  );

  // Batch remove selected downloads
  const batchRemove = useCallback(
    async (taskIds?: string[]): Promise<number> => {
      if (!tauri.isTauri()) return 0;
      const ids = taskIds ?? [...store.selectedTaskIds];
      if (ids.length === 0) return 0;
      const count = await tauri.downloadBatchRemove(ids);
      await refreshTasks();
      return count;
    },
    [store.selectedTaskIds, refreshTasks]
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

  // Extract archive
  const extractArchive = useCallback(
    async (archivePath: string, destPath: string): Promise<string[]> => {
      if (!tauri.isTauri()) {
        throw new Error('Tauri not available');
      }
      return await tauri.downloadExtract(archivePath, destPath);
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
    getMaxConcurrent,

    // Actions - File
    verifyFile,
    openFile,
    revealFile,
    calculateChecksum,

    // Actions - Task
    retryTask,
    setPriority,

    // Actions - Batch
    batchPause,
    batchResume,
    batchCancel,
    batchRemove,

    // Actions - History
    refreshHistory,
    searchHistory,
    clearHistory,
    removeHistoryRecord,

    // Actions - Disk
    getDiskSpace,
    checkDiskSpace,

    // Actions - Extract
    extractArchive,

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

// Re-export formatBytes from shared utils for backward compatibility
export { formatBytes } from '@/lib/utils';

/**
 * Format speed to human-readable string
 */
export { formatSpeed } from '@/lib/utils';

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
