import { renderHook, act } from '@testing-library/react';
import { useDownloads, formatBytes, formatSpeed, formatDuration } from './use-downloads';

// Mock Tauri APIs
const mockDownloadAdd = jest.fn();
const mockDownloadPause = jest.fn();
const mockDownloadResume = jest.fn();
const mockDownloadCancel = jest.fn();
const mockDownloadRemove = jest.fn();
const mockDownloadList = jest.fn();
const mockDownloadStats = jest.fn();
const mockDownloadHistoryList = jest.fn();
const mockDownloadHistoryStats = jest.fn();
const mockDownloadHistoryClear = jest.fn();
const mockDownloadHistorySearch = jest.fn();
const mockDownloadHistoryRemove = jest.fn();
const mockDownloadSetSpeedLimit = jest.fn();
const mockDownloadGetSpeedLimit = jest.fn();
const mockDownloadSetMaxConcurrent = jest.fn();
const mockDownloadGetMaxConcurrent = jest.fn();
const mockDownloadPauseAll = jest.fn();
const mockDownloadResumeAll = jest.fn();
const mockDownloadCancelAll = jest.fn();
const mockDownloadClearFinished = jest.fn();
const mockDownloadRetryFailed = jest.fn();
const mockDownloadVerifyFile = jest.fn();
const mockDownloadOpenFile = jest.fn();
const mockDownloadRevealFile = jest.fn();
const mockDownloadBatchPause = jest.fn();
const mockDownloadBatchResume = jest.fn();
const mockDownloadBatchCancel = jest.fn();
const mockDownloadBatchRemove = jest.fn();
const mockDownloadShutdown = jest.fn();
const mockDiskSpaceGet = jest.fn();
const mockDiskSpaceCheck = jest.fn();
const mockListenDownloadTaskAdded = jest.fn();
const mockListenDownloadTaskStarted = jest.fn();
const mockListenDownloadTaskProgress = jest.fn();
const mockListenDownloadTaskCompleted = jest.fn();
const mockListenDownloadTaskFailed = jest.fn();
const mockListenDownloadTaskPaused = jest.fn();
const mockListenDownloadTaskResumed = jest.fn();
const mockListenDownloadTaskCancelled = jest.fn();
const mockListenDownloadQueueUpdated = jest.fn();
const mockIsTauri = jest.fn(() => true);

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  downloadAdd: (...args: unknown[]) => mockDownloadAdd(...args),
  downloadPause: (...args: unknown[]) => mockDownloadPause(...args),
  downloadResume: (...args: unknown[]) => mockDownloadResume(...args),
  downloadCancel: (...args: unknown[]) => mockDownloadCancel(...args),
  downloadRemove: (...args: unknown[]) => mockDownloadRemove(...args),
  downloadList: (...args: unknown[]) => mockDownloadList(...args),
  downloadStats: (...args: unknown[]) => mockDownloadStats(...args),
  downloadHistoryList: (...args: unknown[]) => mockDownloadHistoryList(...args),
  downloadHistoryStats: (...args: unknown[]) => mockDownloadHistoryStats(...args),
  downloadHistoryClear: (...args: unknown[]) => mockDownloadHistoryClear(...args),
  downloadHistorySearch: (...args: unknown[]) => mockDownloadHistorySearch(...args),
  downloadHistoryRemove: (...args: unknown[]) => mockDownloadHistoryRemove(...args),
  downloadSetSpeedLimit: (...args: unknown[]) => mockDownloadSetSpeedLimit(...args),
  downloadGetSpeedLimit: (...args: unknown[]) => mockDownloadGetSpeedLimit(...args),
  downloadSetMaxConcurrent: (...args: unknown[]) => mockDownloadSetMaxConcurrent(...args),
  downloadGetMaxConcurrent: (...args: unknown[]) => mockDownloadGetMaxConcurrent(...args),
  downloadPauseAll: (...args: unknown[]) => mockDownloadPauseAll(...args),
  downloadResumeAll: (...args: unknown[]) => mockDownloadResumeAll(...args),
  downloadCancelAll: (...args: unknown[]) => mockDownloadCancelAll(...args),
  downloadClearFinished: (...args: unknown[]) => mockDownloadClearFinished(...args),
  downloadRetryFailed: (...args: unknown[]) => mockDownloadRetryFailed(...args),
  downloadVerifyFile: (...args: unknown[]) => mockDownloadVerifyFile(...args),
  downloadOpenFile: (...args: unknown[]) => mockDownloadOpenFile(...args),
  downloadRevealFile: (...args: unknown[]) => mockDownloadRevealFile(...args),
  downloadBatchPause: (...args: unknown[]) => mockDownloadBatchPause(...args),
  downloadBatchResume: (...args: unknown[]) => mockDownloadBatchResume(...args),
  downloadBatchCancel: (...args: unknown[]) => mockDownloadBatchCancel(...args),
  downloadBatchRemove: (...args: unknown[]) => mockDownloadBatchRemove(...args),
  downloadShutdown: (...args: unknown[]) => mockDownloadShutdown(...args),
  diskSpaceGet: (...args: unknown[]) => mockDiskSpaceGet(...args),
  diskSpaceCheck: (...args: unknown[]) => mockDiskSpaceCheck(...args),
  listenDownloadTaskAdded: (...args: unknown[]) => mockListenDownloadTaskAdded(...args),
  listenDownloadTaskStarted: (...args: unknown[]) => mockListenDownloadTaskStarted(...args),
  listenDownloadTaskProgress: (...args: unknown[]) => mockListenDownloadTaskProgress(...args),
  listenDownloadTaskCompleted: (...args: unknown[]) => mockListenDownloadTaskCompleted(...args),
  listenDownloadTaskFailed: (...args: unknown[]) => mockListenDownloadTaskFailed(...args),
  listenDownloadTaskPaused: (...args: unknown[]) => mockListenDownloadTaskPaused(...args),
  listenDownloadTaskResumed: (...args: unknown[]) => mockListenDownloadTaskResumed(...args),
  listenDownloadTaskCancelled: (...args: unknown[]) => mockListenDownloadTaskCancelled(...args),
  listenDownloadQueueUpdated: (...args: unknown[]) => mockListenDownloadQueueUpdated(...args),
}));

// Mock download store
const mockSetTasks = jest.fn();
const mockSetStats = jest.fn();
const mockSetHistory = jest.fn();
const mockSetHistoryStats = jest.fn();
const mockSetLoading = jest.fn();
const mockSetError = jest.fn();
const mockUpdateTask = jest.fn();
const mockUpdateTaskProgress = jest.fn();
const mockRemoveTask = jest.fn();
const mockClearHistory = jest.fn();
const mockSetSpeedLimit = jest.fn();
const mockSetMaxConcurrent = jest.fn();
const mockRemoveHistoryRecord = jest.fn();

jest.mock('@/lib/stores/download', () => ({
  useDownloadStore: jest.fn(() => ({
    tasks: [],
    stats: null,
    history: [],
    historyStats: null,
    speedLimit: 0,
    maxConcurrent: 3,
    isLoading: false,
    error: null,
    selectedTaskIds: new Set(['sel-1', 'sel-2']),
    showHistory: false,
    setTasks: mockSetTasks,
    setStats: mockSetStats,
    setHistory: mockSetHistory,
    setHistoryStats: mockSetHistoryStats,
    setLoading: mockSetLoading,
    setError: mockSetError,
    updateTask: mockUpdateTask,
    updateTaskProgress: mockUpdateTaskProgress,
    removeTask: mockRemoveTask,
    clearHistory: mockClearHistory,
    setSpeedLimit: mockSetSpeedLimit,
    setMaxConcurrent: mockSetMaxConcurrent,
    removeHistoryRecord: mockRemoveHistoryRecord,
    getActiveTasks: () => [],
    getPausedTasks: () => [],
    getCompletedTasks: () => [],
    getFailedTasks: () => [],
    selectTask: jest.fn(),
    deselectTask: jest.fn(),
    selectAllTasks: jest.fn(),
    deselectAllTasks: jest.fn(),
    toggleShowHistory: jest.fn(),
  })),
}));

describe('formatBytes', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('2 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('should format terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB');
  });
});

describe('formatSpeed', () => {
  it('should format 0 speed', () => {
    expect(formatSpeed(0)).toBe('0.0 B/s');
  });

  it('should format bytes per second', () => {
    expect(formatSpeed(500)).toBe('500.0 B/s');
  });

  it('should format kilobytes per second', () => {
    expect(formatSpeed(1024)).toBe('1.0 KB/s');
  });

  it('should format megabytes per second', () => {
    expect(formatSpeed(1048576)).toBe('1.0 MB/s');
  });
});

describe('formatDuration', () => {
  it('should format 0 seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('should format seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('should format exact hours', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });

  it('should format only minutes', () => {
    expect(formatDuration(60)).toBe('1m 0s');
  });
});

describe('useDownloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockDownloadList.mockResolvedValue([]);
    mockDownloadStats.mockResolvedValue(null);
    mockDownloadHistoryList.mockResolvedValue([]);
    mockDownloadHistoryStats.mockResolvedValue(null);
    mockDownloadGetSpeedLimit.mockResolvedValue(0);
    mockDownloadGetMaxConcurrent.mockResolvedValue(4);
    
    // Mock listener cleanup functions
    mockListenDownloadTaskAdded.mockResolvedValue(() => {});
    mockListenDownloadTaskStarted.mockResolvedValue(() => {});
    mockListenDownloadTaskProgress.mockResolvedValue(() => {});
    mockListenDownloadTaskCompleted.mockResolvedValue(() => {});
    mockListenDownloadTaskFailed.mockResolvedValue(() => {});
    mockListenDownloadTaskPaused.mockResolvedValue(() => {});
    mockListenDownloadTaskResumed.mockResolvedValue(() => {});
    mockListenDownloadTaskCancelled.mockResolvedValue(() => {});
    mockListenDownloadQueueUpdated.mockResolvedValue(() => {});
  });

  it('should return download methods', () => {
    const { result } = renderHook(() => useDownloads());

    expect(result.current).toHaveProperty('addDownload');
    expect(result.current).toHaveProperty('pauseDownload');
    expect(result.current).toHaveProperty('resumeDownload');
    expect(result.current).toHaveProperty('cancelDownload');
    expect(result.current).toHaveProperty('removeDownload');
    expect(result.current).toHaveProperty('refreshTasks');
    expect(result.current).toHaveProperty('refreshHistory');
    expect(result.current).toHaveProperty('clearHistory');
    expect(result.current).toHaveProperty('setSpeedLimit');
  });

  it('should add a download', async () => {
    mockDownloadAdd.mockResolvedValue('task-1');
    const { result } = renderHook(() => useDownloads());

    const request = { 
      url: 'https://example.com/file.zip', 
      destination: '/downloads',
      name: 'file.zip'
    };
    await act(async () => {
      await result.current.addDownload(request);
    });

    expect(mockDownloadAdd).toHaveBeenCalledWith(request);
  });

  it('should pause a download', async () => {
    mockDownloadPause.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.pauseDownload('task-1');
    });

    expect(mockDownloadPause).toHaveBeenCalledWith('task-1');
  });

  it('should resume a download', async () => {
    mockDownloadResume.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.resumeDownload('task-1');
    });

    expect(mockDownloadResume).toHaveBeenCalledWith('task-1');
  });

  it('should cancel a download', async () => {
    mockDownloadCancel.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.cancelDownload('task-1');
    });

    expect(mockDownloadCancel).toHaveBeenCalledWith('task-1');
  });

  it('should remove a download', async () => {
    mockDownloadRemove.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.removeDownload('task-1');
    });

    expect(mockDownloadRemove).toHaveBeenCalledWith('task-1');
  });

  it('should refresh tasks', async () => {
    const tasks = [{ id: 'task-1', state: 'downloading' }];
    mockDownloadList.mockResolvedValue(tasks);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.refreshTasks();
    });

    expect(mockDownloadList).toHaveBeenCalled();
    expect(mockSetTasks).toHaveBeenCalledWith(tasks);
  });

  it('should refresh history', async () => {
    const history = [{ id: 'task-1', state: 'completed' }];
    const stats = { total: 1, completed: 1 };
    mockDownloadHistoryList.mockResolvedValue(history);
    mockDownloadHistoryStats.mockResolvedValue(stats);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.refreshHistory();
    });

    expect(mockDownloadHistoryList).toHaveBeenCalled();
    expect(mockSetHistory).toHaveBeenCalledWith(history);
  });

  it('should clear history', async () => {
    mockDownloadHistoryClear.mockResolvedValue(5);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(mockDownloadHistoryClear).toHaveBeenCalled();
    expect(mockClearHistory).toHaveBeenCalled();
  });

  it('should set speed limit', async () => {
    mockDownloadSetSpeedLimit.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.setSpeedLimit(1000);
    });

    expect(mockDownloadSetSpeedLimit).toHaveBeenCalledWith(1000);
    expect(mockSetSpeedLimit).toHaveBeenCalledWith(1000);
  });

  it('should return store state', () => {
    const { result } = renderHook(() => useDownloads());

    expect(result.current).toHaveProperty('tasks');
    expect(result.current).toHaveProperty('history');
    expect(result.current).toHaveProperty('speedLimit');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  // === Pause/Resume/Cancel All ===

  it('should pause all downloads', async () => {
    mockDownloadPauseAll.mockResolvedValue(3);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.pauseAll();
    });

    expect(mockDownloadPauseAll).toHaveBeenCalled();
    expect(count).toBe(3);
  });

  it('should resume all downloads', async () => {
    mockDownloadResumeAll.mockResolvedValue(2);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.resumeAll();
    });

    expect(mockDownloadResumeAll).toHaveBeenCalled();
    expect(count).toBe(2);
  });

  it('should cancel all downloads', async () => {
    mockDownloadCancelAll.mockResolvedValue(5);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.cancelAll();
    });

    expect(mockDownloadCancelAll).toHaveBeenCalled();
    expect(count).toBe(5);
  });

  // === Clear Finished / Retry Failed ===

  it('should clear finished downloads', async () => {
    mockDownloadClearFinished.mockResolvedValue(4);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.clearFinished();
    });

    expect(mockDownloadClearFinished).toHaveBeenCalled();
    expect(count).toBe(4);
  });

  it('should retry failed downloads', async () => {
    mockDownloadRetryFailed.mockResolvedValue(2);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.retryFailed();
    });

    expect(mockDownloadRetryFailed).toHaveBeenCalled();
    expect(count).toBe(2);
  });

  // === Settings ===

  it('should set max concurrent downloads', async () => {
    mockDownloadSetMaxConcurrent.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.setMaxConcurrent(8);
    });

    expect(mockDownloadSetMaxConcurrent).toHaveBeenCalledWith(8);
    expect(mockSetMaxConcurrent).toHaveBeenCalledWith(8);
  });

  it('should get max concurrent downloads', async () => {
    mockDownloadGetMaxConcurrent.mockResolvedValue(6);
    const { result } = renderHook(() => useDownloads());

    let max: number = 0;
    await act(async () => {
      max = await result.current.getMaxConcurrent();
    });

    expect(max).toBe(6);
  });

  it('should get speed limit', async () => {
    mockDownloadGetSpeedLimit.mockResolvedValue(1024000);
    const { result } = renderHook(() => useDownloads());

    let limit: number = 0;
    await act(async () => {
      limit = await result.current.getSpeedLimit();
    });

    expect(limit).toBe(1024000);
  });

  // === File Operations ===

  it('should verify a file', async () => {
    const verifyResult = { valid: true, actualChecksum: 'abc', expectedChecksum: 'abc', error: null };
    mockDownloadVerifyFile.mockResolvedValue(verifyResult);
    const { result } = renderHook(() => useDownloads());

    let res: unknown;
    await act(async () => {
      res = await result.current.verifyFile('/tmp/file.zip', 'abc');
    });

    expect(mockDownloadVerifyFile).toHaveBeenCalledWith('/tmp/file.zip', 'abc');
    expect(res).toEqual(verifyResult);
  });

  it('should open a file', async () => {
    mockDownloadOpenFile.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.openFile('/tmp/file.zip');
    });

    expect(mockDownloadOpenFile).toHaveBeenCalledWith('/tmp/file.zip');
  });

  it('should reveal a file in file manager', async () => {
    mockDownloadRevealFile.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.revealFile('/tmp/file.zip');
    });

    expect(mockDownloadRevealFile).toHaveBeenCalledWith('/tmp/file.zip');
  });

  // === Batch Operations ===

  it('should batch pause with explicit IDs', async () => {
    mockDownloadBatchPause.mockResolvedValue(2);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.batchPause(['t1', 't2']);
    });

    expect(mockDownloadBatchPause).toHaveBeenCalledWith(['t1', 't2']);
    expect(count).toBe(2);
  });

  it('should batch pause with selected IDs from store', async () => {
    mockDownloadBatchPause.mockResolvedValue(2);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.batchPause();
    });

    // Should use selectedTaskIds from store: Set(['sel-1', 'sel-2'])
    expect(mockDownloadBatchPause).toHaveBeenCalledWith(['sel-1', 'sel-2']);
  });

  it('should batch resume with explicit IDs', async () => {
    mockDownloadBatchResume.mockResolvedValue(3);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.batchResume(['t1', 't2', 't3']);
    });

    expect(mockDownloadBatchResume).toHaveBeenCalledWith(['t1', 't2', 't3']);
    expect(count).toBe(3);
  });

  it('should batch cancel with explicit IDs', async () => {
    mockDownloadBatchCancel.mockResolvedValue(1);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.batchCancel(['t1']);
    });

    expect(mockDownloadBatchCancel).toHaveBeenCalledWith(['t1']);
    expect(count).toBe(1);
  });

  it('should batch remove with explicit IDs', async () => {
    mockDownloadBatchRemove.mockResolvedValue(2);
    const { result } = renderHook(() => useDownloads());

    let count: number = 0;
    await act(async () => {
      count = await result.current.batchRemove(['t1', 't2']);
    });

    expect(mockDownloadBatchRemove).toHaveBeenCalledWith(['t1', 't2']);
    expect(count).toBe(2);
  });

  // === History Operations ===

  it('should search history', async () => {
    const records = [{ id: 'h1', filename: 'found.zip' }];
    mockDownloadHistorySearch.mockResolvedValue(records);
    const { result } = renderHook(() => useDownloads());

    let res: unknown[] = [];
    await act(async () => {
      res = await result.current.searchHistory('found');
    });

    expect(mockDownloadHistorySearch).toHaveBeenCalledWith('found');
    expect(res).toEqual(records);
  });

  it('should remove a history record', async () => {
    mockDownloadHistoryRemove.mockResolvedValue(true);
    const { result } = renderHook(() => useDownloads());

    let removed: boolean = false;
    await act(async () => {
      removed = await result.current.removeHistoryRecord('h1');
    });

    expect(mockDownloadHistoryRemove).toHaveBeenCalledWith('h1');
    expect(mockRemoveHistoryRecord).toHaveBeenCalledWith('h1');
    expect(removed).toBe(true);
  });

  it('should not call store removeHistoryRecord if backend returns false', async () => {
    mockDownloadHistoryRemove.mockResolvedValue(false);
    const { result } = renderHook(() => useDownloads());

    let removed: boolean = true;
    await act(async () => {
      removed = await result.current.removeHistoryRecord('h-nonexistent');
    });

    expect(mockRemoveHistoryRecord).not.toHaveBeenCalled();
    expect(removed).toBe(false);
  });

  // === Disk Space ===

  it('should get disk space', async () => {
    const space = { total: 1000000, available: 500000, used: 500000, usagePercent: 50 };
    mockDiskSpaceGet.mockResolvedValue(space);
    const { result } = renderHook(() => useDownloads());

    let res: unknown;
    await act(async () => {
      res = await result.current.getDiskSpace('/tmp');
    });

    expect(mockDiskSpaceGet).toHaveBeenCalledWith('/tmp');
    expect(res).toEqual(space);
  });

  it('should check disk space', async () => {
    mockDiskSpaceCheck.mockResolvedValue(true);
    const { result } = renderHook(() => useDownloads());

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.checkDiskSpace('/tmp', 1024);
    });

    expect(mockDiskSpaceCheck).toHaveBeenCalledWith('/tmp', 1024);
    expect(ok).toBe(true);
  });

  // === Non-Tauri Fallbacks ===

  it('should return 0 for pauseAll when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    let count: number = -1;
    await act(async () => {
      count = await result.current.pauseAll();
    });

    expect(count).toBe(0);
    expect(mockDownloadPauseAll).not.toHaveBeenCalled();
  });

  it('should return 0 for resumeAll when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    let count: number = -1;
    await act(async () => {
      count = await result.current.resumeAll();
    });

    expect(count).toBe(0);
    expect(mockDownloadResumeAll).not.toHaveBeenCalled();
  });

  it('should return 0 for cancelAll when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    let count: number = -1;
    await act(async () => {
      count = await result.current.cancelAll();
    });

    expect(count).toBe(0);
    expect(mockDownloadCancelAll).not.toHaveBeenCalled();
  });

  it('should throw error for addDownload when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await expect(
        result.current.addDownload({ url: 'https://x.com/f.zip', destination: '/tmp', name: 'f.zip' })
      ).rejects.toThrow('Tauri not available');
    });
  });

  it('should throw error for verifyFile when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await expect(
        result.current.verifyFile('/tmp/file.zip', 'abc')
      ).rejects.toThrow('Tauri not available');
    });
  });

  it('should throw error for getDiskSpace when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await expect(
        result.current.getDiskSpace('/tmp')
      ).rejects.toThrow('Tauri not available');
    });
  });

  it('should return true for checkDiskSpace when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.checkDiskSpace('/tmp', 1024);
    });

    expect(ok).toBe(true);
    expect(mockDiskSpaceCheck).not.toHaveBeenCalled();
  });

  it('should return 4 for getMaxConcurrent when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    let max: number = 0;
    await act(async () => {
      max = await result.current.getMaxConcurrent();
    });

    expect(max).toBe(4);
    expect(mockDownloadGetMaxConcurrent).not.toHaveBeenCalled();
  });

  it('should return 0 for getSpeedLimit when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    let limit: number = -1;
    await act(async () => {
      limit = await result.current.getSpeedLimit();
    });

    expect(limit).toBe(0);
    expect(mockDownloadGetSpeedLimit).not.toHaveBeenCalled();
  });

  it('should return empty array for searchHistory when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    let res: unknown[] = [{ id: 'should-be-cleared' }];
    await act(async () => {
      res = await result.current.searchHistory('test');
    });

    expect(res).toEqual([]);
    expect(mockDownloadHistorySearch).not.toHaveBeenCalled();
  });

  it('should return false for removeHistoryRecord when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useDownloads());

    let removed: boolean = true;
    await act(async () => {
      removed = await result.current.removeHistoryRecord('h1');
    });

    expect(removed).toBe(false);
    expect(mockDownloadHistoryRemove).not.toHaveBeenCalled();
  });

  // === Error Handling ===

  it('should set error on refreshTasks failure', async () => {
    mockDownloadList.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.refreshTasks();
    });

    expect(mockSetError).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    expect(mockSetLoading).toHaveBeenCalledWith(false);
  });

  // === Refresh Stats ===

  it('should refresh stats', async () => {
    const stats = { totalTasks: 5, queued: 1, downloading: 2, paused: 1, completed: 1, failed: 0, cancelled: 0 };
    mockDownloadStats.mockResolvedValue(stats);
    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.refreshStats();
    });

    expect(mockDownloadStats).toHaveBeenCalled();
    expect(mockSetStats).toHaveBeenCalledWith(stats);
  });

  // === Return Value Shape ===

  it('should return all expected properties', () => {
    const { result } = renderHook(() => useDownloads());

    // State
    expect(result.current).toHaveProperty('tasks');
    expect(result.current).toHaveProperty('stats');
    expect(result.current).toHaveProperty('history');
    expect(result.current).toHaveProperty('historyStats');
    expect(result.current).toHaveProperty('speedLimit');
    expect(result.current).toHaveProperty('maxConcurrent');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('selectedTaskIds');
    expect(result.current).toHaveProperty('showHistory');

    // Computed
    expect(result.current).toHaveProperty('activeTasks');
    expect(result.current).toHaveProperty('pausedTasks');
    expect(result.current).toHaveProperty('completedTasks');
    expect(result.current).toHaveProperty('failedTasks');

    // Actions - Downloads
    expect(typeof result.current.addDownload).toBe('function');
    expect(typeof result.current.pauseDownload).toBe('function');
    expect(typeof result.current.resumeDownload).toBe('function');
    expect(typeof result.current.cancelDownload).toBe('function');
    expect(typeof result.current.removeDownload).toBe('function');
    expect(typeof result.current.pauseAll).toBe('function');
    expect(typeof result.current.resumeAll).toBe('function');
    expect(typeof result.current.cancelAll).toBe('function');
    expect(typeof result.current.clearFinished).toBe('function');
    expect(typeof result.current.retryFailed).toBe('function');

    // Actions - Settings
    expect(typeof result.current.setSpeedLimit).toBe('function');
    expect(typeof result.current.getSpeedLimit).toBe('function');
    expect(typeof result.current.setMaxConcurrent).toBe('function');
    expect(typeof result.current.getMaxConcurrent).toBe('function');

    // Actions - File
    expect(typeof result.current.verifyFile).toBe('function');
    expect(typeof result.current.openFile).toBe('function');
    expect(typeof result.current.revealFile).toBe('function');

    // Actions - Batch
    expect(typeof result.current.batchPause).toBe('function');
    expect(typeof result.current.batchResume).toBe('function');
    expect(typeof result.current.batchCancel).toBe('function');
    expect(typeof result.current.batchRemove).toBe('function');

    // Actions - History
    expect(typeof result.current.refreshHistory).toBe('function');
    expect(typeof result.current.searchHistory).toBe('function');
    expect(typeof result.current.clearHistory).toBe('function');
    expect(typeof result.current.removeHistoryRecord).toBe('function');

    // Actions - Disk
    expect(typeof result.current.getDiskSpace).toBe('function');
    expect(typeof result.current.checkDiskSpace).toBe('function');

    // Actions - Refresh
    expect(typeof result.current.refreshTasks).toBe('function');
    expect(typeof result.current.refreshStats).toBe('function');

    // Actions - UI
    expect(typeof result.current.selectTask).toBe('function');
    expect(typeof result.current.deselectTask).toBe('function');
    expect(typeof result.current.selectAllTasks).toBe('function');
    expect(typeof result.current.deselectAllTasks).toBe('function');
    expect(typeof result.current.toggleShowHistory).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });
});
