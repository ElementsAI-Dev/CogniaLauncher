import { renderHook, act } from '@testing-library/react';
import { useLogs } from './use-logs';
import type { LogFileInfo } from '@/types/log';

// Mock Tauri APIs
const mockIsTauri = jest.fn(() => true);
const mockLogListFiles = jest.fn();
const mockLogQuery = jest.fn();
const mockLogClear = jest.fn();
const mockLogGetDir = jest.fn();
const mockLogExport = jest.fn();
const mockLogGetTotalSize = jest.fn();
const mockLogCleanup = jest.fn();
const mockLogCleanupPreview = jest.fn();
const mockLogDeleteFile = jest.fn();
const mockLogDeleteBatch = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  logListFiles: (...args: unknown[]) => mockLogListFiles(...args),
  logQuery: (...args: unknown[]) => mockLogQuery(...args),
  logClear: (...args: unknown[]) => mockLogClear(...args),
  logGetDir: (...args: unknown[]) => mockLogGetDir(...args),
  logExport: (...args: unknown[]) => mockLogExport(...args),
  logGetTotalSize: (...args: unknown[]) => mockLogGetTotalSize(...args),
  logCleanup: (...args: unknown[]) => mockLogCleanup(...args),
  logCleanupPreview: (...args: unknown[]) => mockLogCleanupPreview(...args),
  logDeleteFile: (...args: unknown[]) => mockLogDeleteFile(...args),
  logDeleteBatch: (...args: unknown[]) => mockLogDeleteBatch(...args),
}));

// Mock log store
const mockSetLogFiles = jest.fn();
const mockClearLogs = jest.fn();
let mockStoreLogFiles: LogFileInfo[] = [];

jest.mock('@/lib/stores/log', () => ({
  useLogStore: jest.fn(() => ({
    logs: [],
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
    logFiles: mockStoreLogFiles,
    addLog: jest.fn(),
    clearLogs: mockClearLogs,
    setFilter: jest.fn(),
    toggleLevel: jest.fn(),
    setSearch: jest.fn(),
    setTimeRange: jest.fn(),
    toggleRegex: jest.fn(),
    toggleAutoScroll: jest.fn(),
    togglePaused: jest.fn(),
    openDrawer: jest.fn(),
    closeDrawer: jest.fn(),
    toggleDrawer: jest.fn(),
    setLogFiles: mockSetLogFiles,
    setMaxLogs: jest.fn(),
    getFilteredLogs: () => [],
    getLogStats: () => ({ total: 0 }),
  })),
}));

describe('useLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockStoreLogFiles = [];
  });

  it('returns log methods and store state', () => {
    const { result } = renderHook(() => useLogs());

    expect(result.current).toHaveProperty('loadLogFiles');
    expect(result.current).toHaveProperty('queryLogFile');
    expect(result.current).toHaveProperty('clearLogFile');
    expect(result.current).toHaveProperty('getLogDirectory');
    expect(result.current).toHaveProperty('cleanupLogs');
    expect(result.current).toHaveProperty('deleteLogFile');
    expect(result.current).toHaveProperty('deleteLogFiles');
    expect(result.current).toHaveProperty('previewCleanupLogs');
    expect(result.current).toHaveProperty('getTotalSize');
    expect(result.current).toHaveProperty('logs');
    expect(result.current).toHaveProperty('logFiles');
    expect(result.current).toHaveProperty('filter');
  });

  it('loads log files with structured success result', async () => {
    const files = [{ name: 'app.log', size: 1024 }];
    mockLogListFiles.mockResolvedValue(files);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.loadLogFiles();
    });

    expect(mockLogListFiles).toHaveBeenCalled();
    expect(mockSetLogFiles).toHaveBeenCalledWith(files);
    expect(response).toEqual({ ok: true, data: files });
  });

  it('queries log file with structured success result', async () => {
    const queryResult = { entries: [], totalCount: 0, hasMore: false };
    mockLogQuery.mockResolvedValue(queryResult);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.queryLogFile({ fileName: 'app.log' });
    });

    expect(mockLogQuery).toHaveBeenCalledWith({ fileName: 'app.log' });
    expect(response).toEqual({ ok: true, data: queryResult });
  });

  it('normalizes query options before calling backend logQuery', async () => {
    const queryResult = { entries: [], totalCount: 0, hasMore: false };
    mockLogQuery.mockResolvedValue(queryResult);
    const { result } = renderHook(() => useLogs());

    await act(async () => {
      await result.current.queryLogFile({
        fileName: ' app.log ',
        levelFilter: [],
        target: '   ',
        search: '   ',
        useRegex: false,
        limit: 0,
        offset: -20,
        maxScanLines: 0,
      });
    });

    const [normalizedOptions] = mockLogQuery.mock.calls[0] as [Record<string, unknown>];
    expect(normalizedOptions.fileName).toBe('app.log');
    expect(normalizedOptions.levelFilter).toBeUndefined();
    expect(normalizedOptions.target).toBeUndefined();
    expect(normalizedOptions.search).toBeUndefined();
    expect(normalizedOptions.limit).toBe(1);
    expect(normalizedOptions.offset).toBe(0);
    expect(normalizedOptions.maxScanLines).toBe(1);
  });

  it('clears historical logs and returns deleted summary', async () => {
    mockStoreLogFiles = [
      { name: 'current.log', path: 'current.log', size: 1000, modified: 2 },
      { name: 'old.log', path: 'old.log', size: 500, modified: 1 },
    ];
    mockLogClear.mockResolvedValue(undefined);
    mockLogListFiles.mockResolvedValue([
      { name: 'current.log', path: 'current.log', size: 1000, modified: 2 },
    ]);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.clearLogFile();
    });

    expect(mockLogClear).toHaveBeenCalledWith(undefined);
    expect(response).toEqual({
      ok: true,
      data: { deletedCount: 1, freedBytes: 500, status: 'success', warnings: [] },
    });
  });

  it('gets log directory with structured success result', async () => {
    mockLogGetDir.mockResolvedValue('/path/to/logs');
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.getLogDirectory();
    });

    expect(mockLogGetDir).toHaveBeenCalled();
    expect(response).toEqual({ ok: true, data: '/path/to/logs' });
  });

  it('runs cleanup and reloads files', async () => {
    const cleanupResult = { deletedCount: 3, freedBytes: 1024, status: 'success', warnings: [] };
    mockLogCleanup.mockResolvedValue(cleanupResult);
    mockLogListFiles.mockResolvedValue([]);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.cleanupLogs();
    });

    expect(mockLogCleanup).toHaveBeenCalled();
    expect(mockLogListFiles).toHaveBeenCalled();
    expect(response).toEqual({ ok: true, data: cleanupResult });
  });

  it('deletes a specific log file and returns deleted summary', async () => {
    mockStoreLogFiles = [
      { name: 'current.log', path: 'current.log', size: 1000, modified: 2 },
      { name: 'history.log', path: 'history.log', size: 256, modified: 1 },
    ];
    mockLogDeleteFile.mockResolvedValue(undefined);
    mockLogListFiles.mockResolvedValue([
      { name: 'current.log', path: 'current.log', size: 1000, modified: 2 },
    ]);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.deleteLogFile('history.log');
    });

    expect(mockLogDeleteFile).toHaveBeenCalledWith('history.log');
    expect(response).toEqual({
      ok: true,
      data: { deletedCount: 1, freedBytes: 256, status: 'success', warnings: [] },
    });
  });

  it('batch deletes log files and returns backend summary', async () => {
    const batchResult = { deletedCount: 2, freedBytes: 2048, status: 'partial_success', warnings: ['Skipped current session log file: a.log'] };
    mockLogDeleteBatch.mockResolvedValue(batchResult);
    mockLogListFiles.mockResolvedValue([]);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.deleteLogFiles(['a.log', 'b.log']);
    });

    expect(mockLogDeleteBatch).toHaveBeenCalledWith(['a.log', 'b.log']);
    expect(mockLogListFiles).toHaveBeenCalled();
    expect(response).toEqual({ ok: true, data: batchResult });
  });

  it('previews cleanup and returns structured summary', async () => {
    const previewResult = { deletedCount: 2, freedBytes: 900, protectedCount: 1, status: 'success', warnings: [] };
    mockLogCleanupPreview.mockResolvedValue(previewResult);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.previewCleanupLogs();
    });

    expect(mockLogCleanupPreview).toHaveBeenCalled();
    expect(response).toEqual({ ok: true, data: previewResult });
  });

  it('gets total size with structured success result', async () => {
    mockLogGetTotalSize.mockResolvedValue(5120);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.getTotalSize();
    });

    expect(mockLogGetTotalSize).toHaveBeenCalled();
    expect(response).toEqual({ ok: true, data: 5120 });
  });

  it('returns structured error for cleanup failure', async () => {
    mockLogCleanup.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.cleanupLogs();
    });

    expect(response).toEqual({ ok: false, error: 'fail' });
  });

  it('returns desktop-only errors when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useLogs());

    let loadResponse;
    await act(async () => {
      loadResponse = await result.current.loadLogFiles();
    });

    expect(loadResponse).toEqual({
      ok: false,
      error: 'Logs file operations are available in desktop mode only',
    });
    expect(mockLogListFiles).not.toHaveBeenCalled();
  });
});
