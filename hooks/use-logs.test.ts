import { renderHook, act } from '@testing-library/react';
import { useLogs } from './use-logs';
import type { LogFileInfo } from '@/types/log';

// Mock Tauri APIs
const mockIsTauri = jest.fn(() => true);
const mockDiagnosticListCrashReports = jest.fn();
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
const mockExportDesktopDiagnosticBundle = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  diagnosticListCrashReports: (...args: unknown[]) => mockDiagnosticListCrashReports(...args),
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

jest.mock('@/lib/diagnostic-export', () => ({
  exportDesktopDiagnosticBundle: (...args: unknown[]) =>
    mockExportDesktopDiagnosticBundle(...args),
}));

// Mock log store
const mockSetLogFiles = jest.fn();
const mockSetCrashReports = jest.fn();
const mockSetLatestDiagnosticAction = jest.fn();
const mockClearLogs = jest.fn();
let mockStoreLogFiles: LogFileInfo[] = [];
let mockCrashReports: Array<Record<string, unknown>> = [];
let mockLatestDiagnosticAction: Record<string, unknown> | null = null;

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
    crashReports: mockCrashReports,
    observability: {
      runtimeMode: 'desktop-release',
      backendBridgeState: 'available',
      backendBridgeError: null,
      latestCrashCapture: null,
    },
    latestDiagnosticAction: mockLatestDiagnosticAction,
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
    setCrashReports: mockSetCrashReports,
    setLatestDiagnosticAction: mockSetLatestDiagnosticAction,
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
    mockCrashReports = [];
    mockLatestDiagnosticAction = null;
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
    expect(result.current).toHaveProperty('loadCrashReports');
    expect(result.current).toHaveProperty('exportDiagnosticBundle');
    expect(result.current).toHaveProperty('logs');
    expect(result.current).toHaveProperty('logFiles');
    expect(result.current).toHaveProperty('crashReports');
    expect(result.current).toHaveProperty('observability');
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
    expect(response).toEqual({
      ok: true,
      data: {
        entries: [],
        totalCount: 0,
        hasMore: false,
        meta: {
          scannedLines: 0,
          sourceLineCount: 0,
          matchedCount: 0,
          effectiveMaxScanLines: null,
          scanTruncated: false,
          windowStartLine: null,
          windowEndLine: null,
          queryFingerprint: '',
        },
      },
    });
  });

  it('normalizes query metadata with backward-compatible defaults', async () => {
    mockLogQuery.mockResolvedValue({
      entries: [],
      totalCount: 2,
      hasMore: false,
      meta: {
        scannedLines: 5,
        sourceLineCount: 10,
        matchedCount: 1,
        scanTruncated: true,
      },
    });
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.queryLogFile({ fileName: 'app.log' });
    });

    expect(response).toEqual({
      ok: true,
      data: {
        entries: [],
        totalCount: 2,
        hasMore: false,
        meta: {
          scannedLines: 5,
          sourceLineCount: 10,
          matchedCount: 2,
          effectiveMaxScanLines: null,
          scanTruncated: true,
          windowStartLine: null,
          windowEndLine: null,
          queryFingerprint: '',
        },
      },
    });
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
    const clearResult = {
      deletedCount: 1,
      freedBytes: 500,
      protectedCount: 0,
      skippedCount: 0,
      status: 'success',
      reasonCode: null,
      warnings: [],
      policyFingerprint: null,
      maxRetentionDays: null,
      maxTotalSizeMb: null,
    };
    mockStoreLogFiles = [
      { name: 'current.log', path: 'current.log', size: 1000, modified: 2 },
      { name: 'old.log', path: 'old.log', size: 500, modified: 1 },
    ];
    mockLogClear.mockResolvedValue(clearResult);
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
      data: clearResult,
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
    const cleanupResult = {
      deletedCount: 3,
      freedBytes: 1024,
      protectedCount: 0,
      skippedCount: 0,
      status: 'success',
      reasonCode: null,
      warnings: [],
      policyFingerprint: null,
      maxRetentionDays: null,
      maxTotalSizeMb: null,
    };
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
    const deleteResult = {
      deletedCount: 1,
      freedBytes: 256,
      protectedCount: 0,
      skippedCount: 0,
      status: 'success',
      reasonCode: null,
      warnings: [],
      policyFingerprint: null,
      maxRetentionDays: null,
      maxTotalSizeMb: null,
    };
    mockStoreLogFiles = [
      { name: 'current.log', path: 'current.log', size: 1000, modified: 2 },
      { name: 'history.log', path: 'history.log', size: 256, modified: 1 },
    ];
    mockLogDeleteFile.mockResolvedValue(deleteResult);
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
      data: deleteResult,
    });
  });

  it('batch deletes log files and returns backend summary', async () => {
    const batchResult = {
      deletedCount: 2,
      freedBytes: 2048,
      protectedCount: 0,
      skippedCount: 0,
      status: 'partial_success',
      reasonCode: null,
      warnings: ['Skipped current session log file: a.log'],
      policyFingerprint: null,
      maxRetentionDays: null,
      maxTotalSizeMb: null,
    };
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
    const previewResult = {
      deletedCount: 2,
      freedBytes: 900,
      protectedCount: 1,
      skippedCount: 0,
      status: 'success',
      reasonCode: null,
      warnings: [],
      policyFingerprint: 'v1:0:0',
      maxRetentionDays: 0,
      maxTotalSizeMb: 0,
    };
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

  it('loads crash reports with structured success result', async () => {
    const reports = [
      {
        id: 'frontend-runtime-1',
        source: 'frontend-runtime',
        reportPath: 'D:/Crash/report.zip',
        timestamp: '2026-02-25T00:00:00Z',
        message: 'boom',
        size: 2048,
        pending: true,
      },
    ];
    mockDiagnosticListCrashReports.mockResolvedValue(reports);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.loadCrashReports();
    });

    expect(mockDiagnosticListCrashReports).toHaveBeenCalled();
    expect(mockSetCrashReports).toHaveBeenCalledWith(reports);
    expect(response).toEqual({ ok: true, data: reports });
  });

  it('exports a full diagnostic bundle and stores the latest successful result', async () => {
    mockExportDesktopDiagnosticBundle.mockResolvedValue({
      ok: true,
      data: {
        path: 'D:/Crash/cognia-diagnostic.zip',
        size: 4096,
        fileCount: 8,
      },
    });
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.exportDiagnosticBundle({
        t: (key: string) => key,
        workspaceSection: 'files',
        selectedFile: 'app.log',
        filterContext: {
          search: 'panic',
          target: 'runtime',
          useRegex: false,
        },
      });
    });

    expect(mockExportDesktopDiagnosticBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        failureToastKey: 'logs.diagnosticBundleError',
        errorContext: expect.objectContaining({
          message: 'Logs workspace diagnostic export',
          extra: expect.objectContaining({
            logsContext: expect.objectContaining({
              workspaceSection: 'files',
              selectedFile: 'app.log',
            }),
          }),
        }),
      }),
    );
    expect(mockSetLatestDiagnosticAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'full_diagnostic_export',
        status: 'success',
        path: 'D:/Crash/cognia-diagnostic.zip',
      }),
    );
    expect(response).toEqual({
      ok: true,
      data: {
        path: 'D:/Crash/cognia-diagnostic.zip',
        size: 4096,
        fileCount: 8,
      },
    });
  });

  it('returns a quiet success with null data when diagnostic export is cancelled', async () => {
    mockExportDesktopDiagnosticBundle.mockResolvedValue({
      ok: false,
      cancelled: true,
    });
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.exportDiagnosticBundle({
        t: (key: string) => key,
        workspaceSection: 'management',
      });
    });

    expect(mockSetLatestDiagnosticAction).not.toHaveBeenCalled();
    expect(response).toEqual({
      ok: true,
      data: null,
    });
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
