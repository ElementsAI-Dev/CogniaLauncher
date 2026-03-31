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

interface UseDownloadsOptions {
  enableRuntime?: boolean;
}

let activeRuntimeOwnerCount = 0;

/**
 * Hook for managing downloads with Tauri backend integration
 */
export function useDownloads(options: UseDownloadsOptions = {}) {
  const store = useDownloadStore();
  const unlistenRefs = useRef<(() => void)[]>([]);
  const ownsRuntimeRef = useRef(false);
  const { enableRuntime = true } = options;

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
    if (!enableRuntime || !tauri.isTauri()) return;
    if (activeRuntimeOwnerCount > 0) return;

    activeRuntimeOwnerCount += 1;
    ownsRuntimeRef.current = true;

    let disposed = false;
    const registerUnlisten = (unlisten: () => void) => {
      if (disposed) {
        unlisten();
        return;
      }

      unlistenRefs.current = [...unlistenRefs.current, unlisten];
    };

    const setupListeners = async () => {
      try {
        const unlistenAdded = await tauri.listenDownloadTaskAdded(() => {
          void refreshTasks();
          void refreshStats();
        });
        registerUnlisten(unlistenAdded);

        const unlistenStarted = await tauri.listenDownloadTaskStarted((taskId) => {
          store.updateTask(taskId, { state: 'downloading' });
          void refreshStats();
        });
        registerUnlisten(unlistenStarted);

        let lastSpeedSample = 0;
        const unlistenProgress = await tauri.listenDownloadTaskProgress(
          (taskId, progress) => {
            store.updateTaskProgress(taskId, progress as DownloadProgress);
            const now = Date.now();
            if (now - lastSpeedSample >= 1000) {
              lastSpeedSample = now;
              store.addSpeedSample((progress as DownloadProgress).speed);
            }
          }
        );
        registerUnlisten(unlistenProgress);

        const unlistenCompleted = await tauri.listenDownloadTaskCompleted((taskId) => {
          store.updateTask(taskId, { state: 'completed' });
          void refreshStats();
          void refreshHistory();
        });
        registerUnlisten(unlistenCompleted);

        const unlistenFailed = await tauri.listenDownloadTaskFailed(
          (taskId, error, reasonCode, recoverable) => {
            store.updateTask(taskId, {
              state: 'failed',
              error,
              recoverable,
              failureReasonCode: reasonCode,
            });
            void refreshStats();
            void refreshHistory();
          }
        );
        registerUnlisten(unlistenFailed);

        const unlistenPaused = await tauri.listenDownloadTaskPaused((taskId) => {
          store.updateTask(taskId, { state: 'paused' });
          void refreshStats();
        });
        registerUnlisten(unlistenPaused);

        const unlistenResumed = await tauri.listenDownloadTaskResumed((taskId) => {
          store.updateTask(taskId, { state: 'queued' });
          void refreshStats();
        });
        registerUnlisten(unlistenResumed);

        const unlistenCancelled = await tauri.listenDownloadTaskCancelled((taskId) => {
          store.updateTask(taskId, { state: 'cancelled' });
          void refreshStats();
          void refreshHistory();
        });
        registerUnlisten(unlistenCancelled);

        const unlistenQueueUpdated = await tauri.listenDownloadQueueUpdated((stats) => {
          store.setStats(stats as QueueStats);
        });
        registerUnlisten(unlistenQueueUpdated);

        const unlistenExtracting = await tauri.listenDownloadTaskExtracting((taskId) => {
          store.updateTask(taskId, { state: 'extracting' });
        });
        registerUnlisten(unlistenExtracting);

        const unlistenExtracted = await tauri.listenDownloadTaskExtracted(() => {
          void refreshTasks();
        });
        registerUnlisten(unlistenExtracted);
      } catch (err) {
        console.error('Failed to setup download listeners:', err);
      }
    };

    setupListeners();

    return () => {
      ownsRuntimeRef.current = false;
      activeRuntimeOwnerCount = Math.max(0, activeRuntimeOwnerCount - 1);
      disposed = true;
      const unlisteners = unlistenRefs.current;
      unlistenRefs.current = [];
      unlisteners.forEach((unlisten) => unlisten?.());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableRuntime, refreshTasks, refreshHistory, refreshStats]);

  // Initial data fetch and sync settings from backend
  useEffect(() => {
    if (!enableRuntime || !tauri.isTauri() || !ownsRuntimeRef.current) return;

    refreshTasks();
    refreshStats();
    refreshHistory();

    // Sync speed limit and concurrency from backend
    const syncSettings = async () => {
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

    // Graceful shutdown: persist recoverable queue state on window close.
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
  }, [enableRuntime, refreshTasks, refreshStats, refreshHistory]);

  // Clipboard URL monitoring
  const seenUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!enableRuntime || !tauri.isTauri() || !ownsRuntimeRef.current || !store.clipboardMonitor) return;

    const DOWNLOAD_EXTENSIONS = /\.(zip|tar\.gz|tgz|tar\.xz|tar\.bz2|7z|rar|exe|msi|dmg|pkg|deb|rpm|appimage|iso|img|bin|gz|xz|bz2|zst)$/i;

    const interval = setInterval(async () => {
      try {
        const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
        const text = await readText();
        if (!text) return;

        const url = text.trim();
        if (seenUrlsRef.current.has(url)) return;
        if (!/^https?:\/\//i.test(url)) return;

        try { new URL(url); } catch { return; }

        const pathname = new URL(url).pathname;
        if (!DOWNLOAD_EXTENSIONS.test(pathname)) return;

        seenUrlsRef.current.add(url);

        const { toast } = await import('sonner');
        const filename = pathname.split('/').filter(Boolean).pop() ?? 'download';
        toast(filename, {
          description: url.length > 80 ? url.slice(0, 80) + '…' : url,
          action: {
            label: '↓',
            onClick: () => {
              store.setError(null);
              window.dispatchEvent(new CustomEvent('clipboard-download-url', { detail: url }));
            },
          },
          duration: 8000,
        });
      } catch {
        // Clipboard read may fail silently (e.g. no permission, empty)
      }
    }, 2000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableRuntime, store.clipboardMonitor]);

  // Add a new download
  const addDownload = useCallback(
    async (request: DownloadRequest): Promise<string> => {
      if (!tauri.isTauri()) {
        throw new Error('Tauri not available');
      }

      const taskId = await tauri.downloadAdd(request as tauri.DownloadRequest);
      await Promise.all([refreshTasks(), refreshStats()]);
      return taskId;
    },
     
    [refreshStats, refreshTasks]
  );

  // Pause a download
  const pauseDownload = useCallback(async (taskId: string) => {
    if (!tauri.isTauri()) return;
    await tauri.downloadPause(taskId);
    store.updateTask(taskId, { state: 'paused' });
    await refreshStats();
  }, [refreshStats, store]);

  // Resume a download
  const resumeDownload = useCallback(async (taskId: string) => {
    if (!tauri.isTauri()) return;
    await tauri.downloadResume(taskId);
    store.updateTask(taskId, { state: 'queued' });
    await refreshStats();
  }, [refreshStats, store]);

  // Cancel a download
  const cancelDownload = useCallback(async (taskId: string) => {
    if (!tauri.isTauri()) return;
    await tauri.downloadCancel(taskId);
    store.updateTask(taskId, { state: 'cancelled' });
    await Promise.all([refreshStats(), refreshHistory()]);
  }, [refreshHistory, refreshStats, store]);

  // Remove a download
  const removeDownload = useCallback(
    async (taskId: string) => {
      if (!tauri.isTauri()) return;
      await tauri.downloadRemove(taskId);
      store.removeTask(taskId);
      await refreshStats();
    },
    [refreshStats, store]
  );

  // Pause all downloads
  const pauseAll = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    const count = await tauri.downloadPauseAll();
    if (count > 0) {
      await Promise.all([refreshTasks(), refreshStats()]);
    }
    return count;
  }, [refreshStats, refreshTasks]);

  // Resume all downloads
  const resumeAll = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    const count = await tauri.downloadResumeAll();
    if (count > 0) {
      await Promise.all([refreshTasks(), refreshStats()]);
    }
    return count;
  }, [refreshStats, refreshTasks]);

  // Cancel all downloads
  const cancelAll = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    const count = await tauri.downloadCancelAll();
    if (count > 0) {
      await Promise.all([refreshTasks(), refreshStats(), refreshHistory()]);
    }
    return count;
  }, [refreshHistory, refreshStats, refreshTasks]);

  // Clear finished downloads
  const clearFinished = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    const count = await tauri.downloadClearFinished();
    await Promise.all([refreshTasks(), refreshStats()]);
    return count;
  },  
    [refreshStats, refreshTasks]);

  // Retry failed downloads
  const retryFailed = useCallback(async (): Promise<number> => {
    if (!tauri.isTauri()) return 0;
    const count = await tauri.downloadRetryFailed();
    if (count > 0) {
      await Promise.all([refreshTasks(), refreshStats()]);
    }
    return count;
  }, [refreshStats, refreshTasks]);

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

  // Set per-task speed limit
  const setTaskSpeedLimit = useCallback(
    async (taskId: string, bytesPerSecond: number) => {
      if (!tauri.isTauri()) return;
      await tauri.downloadSetTaskSpeedLimit(taskId, bytesPerSecond);
      store.updateTask(taskId, { speedLimit: bytesPerSecond });
    },
    [store]
  );

  // Force-retry a single terminal task (failed/cancelled/completed)
  const retryTask = useCallback(
    async (taskId: string) => {
      if (!tauri.isTauri()) return;
      await tauri.downloadRetry(taskId);
      await Promise.all([refreshTasks(), refreshStats()]);
    },
    [refreshStats, refreshTasks]
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
      const count = await tauri.downloadBatchPause(ids);
      if (count > 0) {
        await Promise.all([refreshTasks(), refreshStats()]);
      }
      return count;
    },
    [refreshStats, refreshTasks, store.selectedTaskIds]
  );

  // Batch resume selected downloads
  const batchResume = useCallback(
    async (taskIds?: string[]): Promise<number> => {
      if (!tauri.isTauri()) return 0;
      const ids = taskIds ?? [...store.selectedTaskIds];
      if (ids.length === 0) return 0;
      const count = await tauri.downloadBatchResume(ids);
      if (count > 0) {
        await Promise.all([refreshTasks(), refreshStats()]);
      }
      return count;
    },
    [refreshStats, refreshTasks, store.selectedTaskIds]
  );

  // Batch cancel selected downloads
  const batchCancel = useCallback(
    async (taskIds?: string[]): Promise<number> => {
      if (!tauri.isTauri()) return 0;
      const ids = taskIds ?? [...store.selectedTaskIds];
      if (ids.length === 0) return 0;
      const count = await tauri.downloadBatchCancel(ids);
      if (count > 0) {
        await Promise.all([refreshTasks(), refreshStats(), refreshHistory()]);
      }
      return count;
    },
    [refreshHistory, refreshStats, refreshTasks, store.selectedTaskIds]
  );

  // Batch remove selected downloads
  const batchRemove = useCallback(
    async (taskIds?: string[]): Promise<number> => {
      if (!tauri.isTauri()) return 0;
      const ids = taskIds ?? [...store.selectedTaskIds];
      if (ids.length === 0) return 0;
      const count = await tauri.downloadBatchRemove(ids);
      if (count > 0) {
        await Promise.all([refreshTasks(), refreshStats()]);
      }
      return count;
    },
    [refreshStats, refreshTasks, store.selectedTaskIds]
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
      await Promise.all([refreshHistory(), refreshStats()]);
      return count;
    },
    [store, refreshHistory, refreshStats]
  );

  // Remove history record
  const removeHistoryRecord = useCallback(
    async (id: string): Promise<boolean> => {
      if (!tauri.isTauri()) return false;
      const removed = await tauri.downloadHistoryRemove(id);
      if (removed) {
        store.removeHistoryRecord(id);
        await Promise.all([refreshHistory(), refreshStats()]);
      }
      return removed;
    },
    [store, refreshHistory, refreshStats]
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

  const checkDestinationAvailability = useCallback(async (path: string): Promise<boolean> => {
    if (!tauri.isTauri()) return false;

    try {
      const { exists } = await import('@tauri-apps/plugin-fs');
      return await exists(path);
    } catch {
      return false;
    }
  }, []);

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
    clipboardMonitor: store.clipboardMonitor,
    setClipboardMonitor: store.setClipboardMonitor,

    // Actions - File
    verifyFile,
    openFile,
    revealFile,
    calculateChecksum,

    // Actions - Task
    retryTask,
    setPriority,
    setTaskSpeedLimit,

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
    checkDestinationAvailability,

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
