import { renderHook, act, waitFor } from '@testing-library/react';
import { useDownloadStore } from '../../stores/download';

jest.mock('../../tauri', () => ({
  isTauri: jest.fn(),
  downloadList: jest.fn(),
  downloadStats: jest.fn(),
  downloadAdd: jest.fn(),
  downloadPause: jest.fn(),
  downloadResume: jest.fn(),
  downloadCancel: jest.fn(),
  downloadRemove: jest.fn(),
  downloadPauseAll: jest.fn(),
  downloadResumeAll: jest.fn(),
  downloadCancelAll: jest.fn(),
  downloadClearFinished: jest.fn(),
  downloadRetryFailed: jest.fn(),
  downloadSetSpeedLimit: jest.fn(),
  downloadGetSpeedLimit: jest.fn(),
  downloadSetMaxConcurrent: jest.fn(),
  downloadHistoryList: jest.fn(),
  downloadHistoryStats: jest.fn(),
  downloadHistorySearch: jest.fn(),
  downloadHistoryClear: jest.fn(),
  downloadHistoryRemove: jest.fn(),
  diskSpaceGet: jest.fn(),
  diskSpaceCheck: jest.fn(),
  listenDownloadTaskAdded: jest.fn(),
  listenDownloadTaskStarted: jest.fn(),
  listenDownloadTaskProgress: jest.fn(),
  listenDownloadTaskCompleted: jest.fn(),
  listenDownloadTaskFailed: jest.fn(),
  listenDownloadTaskPaused: jest.fn(),
  listenDownloadTaskResumed: jest.fn(),
  listenDownloadTaskCancelled: jest.fn(),
  listenDownloadQueueUpdated: jest.fn(),
}));

import { useDownloads } from '../use-downloads';
import * as tauri from '../../tauri';
import type { DownloadTask, HistoryRecord, QueueStats } from '../../stores/download';

const mockedTauri = jest.mocked(tauri);

const mockTask: DownloadTask = {
  id: 'task-1',
  url: 'https://example.com/file.zip',
  name: 'file.zip',
  destination: '/downloads/file.zip',
  state: 'queued',
  progress: {
    downloadedBytes: 0,
    totalBytes: 1024,
    speed: 0,
    speedHuman: '0 B/s',
    percent: 0,
    etaSecs: null,
    etaHuman: null,
    downloadedHuman: '0 B',
    totalHuman: '1 KB',
  },
  error: null,
  provider: null,
  createdAt: '2024-01-01T10:00:00Z',
  startedAt: null,
  completedAt: null,
};

const mockHistory: HistoryRecord = {
  id: 'history-1',
  url: 'https://example.com/history.zip',
  filename: 'history.zip',
  destination: '/downloads/history.zip',
  size: 1024,
  sizeHuman: '1 KB',
  checksum: null,
  startedAt: '2024-01-01T10:00:00Z',
  completedAt: '2024-01-01T10:01:00Z',
  durationSecs: 60,
  durationHuman: '1m',
  averageSpeed: 128,
  speedHuman: '128 KB/s',
  status: 'completed',
  error: null,
  provider: null,
};

const mockStats: QueueStats = {
  totalTasks: 1,
  queued: 1,
  downloading: 0,
  paused: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  totalBytes: 1024,
  downloadedBytes: 0,
  totalHuman: '1 KB',
  downloadedHuman: '0 B',
  overallProgress: 0,
};

const defaultState = {
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
};

const makeUnlistenMocks = () => Array.from({ length: 9 }, () => jest.fn());

const setupListeners = () => {
  const unlistenMocks = makeUnlistenMocks();
  mockedTauri.listenDownloadTaskAdded.mockResolvedValue(unlistenMocks[0]);
  mockedTauri.listenDownloadTaskStarted.mockResolvedValue(unlistenMocks[1]);
  mockedTauri.listenDownloadTaskProgress.mockResolvedValue(unlistenMocks[2]);
  mockedTauri.listenDownloadTaskCompleted.mockResolvedValue(unlistenMocks[3]);
  mockedTauri.listenDownloadTaskFailed.mockResolvedValue(unlistenMocks[4]);
  mockedTauri.listenDownloadTaskPaused.mockResolvedValue(unlistenMocks[5]);
  mockedTauri.listenDownloadTaskResumed.mockResolvedValue(unlistenMocks[6]);
  mockedTauri.listenDownloadTaskCancelled.mockResolvedValue(unlistenMocks[7]);
  mockedTauri.listenDownloadQueueUpdated.mockResolvedValue(unlistenMocks[8]);
  return unlistenMocks;
};

describe('useDownloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDownloadStore.setState(defaultState);
    mockedTauri.isTauri.mockReturnValue(false);
    setupListeners();
  });

  it('exposes download store state', () => {
    const { result } = renderHook(() => useDownloads());

    expect(result.current.tasks).toEqual([]);
    expect(result.current.speedLimit).toBe(0);
    expect(result.current.maxConcurrent).toBe(4);
    expect(result.current.history).toEqual([]);
  });

  it('refreshes tasks from Tauri', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.downloadList.mockResolvedValue([mockTask]);
    mockedTauri.downloadStats.mockResolvedValue(mockStats);

    const { result } = renderHook(() => useDownloads());

    await waitFor(() => {
      expect(mockedTauri.downloadList).toHaveBeenCalled();
    });

    mockedTauri.downloadList.mockClear();

    await act(async () => {
      await result.current.refreshTasks();
    });

    expect(mockedTauri.downloadList).toHaveBeenCalledTimes(1);
    expect(useDownloadStore.getState().tasks).toEqual([mockTask]);
  });

  it('adds a download and refreshes tasks', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.downloadAdd.mockResolvedValue('task-1');
    mockedTauri.downloadList.mockResolvedValue([mockTask]);
    mockedTauri.downloadStats.mockResolvedValue(mockStats);

    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      const taskId = await result.current.addDownload({
        url: mockTask.url,
        destination: mockTask.destination,
        name: mockTask.name,
      });
      expect(taskId).toBe('task-1');
    });

    expect(mockedTauri.downloadAdd).toHaveBeenCalledTimes(1);
    expect(mockedTauri.downloadList).toHaveBeenCalled();
  });

  it('removes a download task', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.downloadRemove.mockResolvedValue(true);
    useDownloadStore.setState({ tasks: [mockTask] });

    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.removeDownload(mockTask.id);
    });

    expect(mockedTauri.downloadRemove).toHaveBeenCalledWith(mockTask.id);
    expect(useDownloadStore.getState().tasks).toEqual([]);
  });

  it('sets speed limit via tauri', async () => {
    mockedTauri.isTauri.mockReturnValue(true);

    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      await result.current.setSpeedLimit(512);
    });

    expect(mockedTauri.downloadSetSpeedLimit).toHaveBeenCalledWith(512);
    expect(useDownloadStore.getState().speedLimit).toBe(512);
  });

  it('clears download history', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.downloadHistoryClear.mockResolvedValue(2);
    useDownloadStore.setState({ history: [mockHistory] });

    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      const cleared = await result.current.clearHistory();
      expect(cleared).toBe(2);
    });

    expect(mockedTauri.downloadHistoryClear).toHaveBeenCalled();
    expect(useDownloadStore.getState().history).toEqual([]);
  });

  it('removes a history record', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.downloadHistoryRemove.mockResolvedValue(true);
    useDownloadStore.setState({ history: [mockHistory] });

    const { result } = renderHook(() => useDownloads());

    await act(async () => {
      const removed = await result.current.removeHistoryRecord(mockHistory.id);
      expect(removed).toBe(true);
    });

    expect(mockedTauri.downloadHistoryRemove).toHaveBeenCalledWith(mockHistory.id);
    expect(useDownloadStore.getState().history).toEqual([]);
  });

  it('registers and cleans up listeners', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.downloadList.mockResolvedValue([]);
    mockedTauri.downloadStats.mockResolvedValue(mockStats);
    const unlistenMocks = setupListeners();

    const { unmount } = renderHook(() => useDownloads());

    await waitFor(() => {
      expect(mockedTauri.listenDownloadTaskAdded).toHaveBeenCalled();
      expect(mockedTauri.listenDownloadQueueUpdated).toHaveBeenCalled();
    });

    unmount();

    unlistenMocks.forEach((unlisten) => {
      expect(unlisten).toHaveBeenCalled();
    });
  });
});
