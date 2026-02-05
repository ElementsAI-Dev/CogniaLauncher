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
const mockDownloadSetSpeedLimit = jest.fn();
const mockListenDownloadTaskAdded = jest.fn();
const mockListenDownloadTaskStarted = jest.fn();
const mockListenDownloadTaskProgress = jest.fn();
const mockListenDownloadTaskCompleted = jest.fn();
const mockListenDownloadTaskFailed = jest.fn();
const mockListenDownloadTaskPaused = jest.fn();
const mockListenDownloadTaskResumed = jest.fn();
const mockListenDownloadTaskCancelled = jest.fn();
const mockListenDownloadQueueUpdated = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
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
  downloadSetSpeedLimit: (...args: unknown[]) => mockDownloadSetSpeedLimit(...args),
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
    selectedTaskIds: [],
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
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('should format terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1 TB');
  });
});

describe('formatSpeed', () => {
  it('should format 0 speed', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
  });

  it('should format bytes per second', () => {
    expect(formatSpeed(500)).toBe('500 B/s');
  });

  it('should format kilobytes per second', () => {
    expect(formatSpeed(1024)).toBe('1 KB/s');
  });

  it('should format megabytes per second', () => {
    expect(formatSpeed(1048576)).toBe('1 MB/s');
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
    mockDownloadList.mockResolvedValue([]);
    mockDownloadStats.mockResolvedValue(null);
    mockDownloadHistoryList.mockResolvedValue([]);
    mockDownloadHistoryStats.mockResolvedValue(null);
    
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
});
