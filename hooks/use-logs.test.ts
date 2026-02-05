import { renderHook, act } from '@testing-library/react';
import { useLogs } from './use-logs';

// Mock Tauri APIs
const mockLogListFiles = jest.fn();
const mockLogQuery = jest.fn();
const mockLogClear = jest.fn();
const mockLogGetDir = jest.fn();
const mockLogExport = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  logListFiles: (...args: unknown[]) => mockLogListFiles(...args),
  logQuery: (...args: unknown[]) => mockLogQuery(...args),
  logClear: (...args: unknown[]) => mockLogClear(...args),
  logGetDir: (...args: unknown[]) => mockLogGetDir(...args),
  logExport: (...args: unknown[]) => mockLogExport(...args),
}));

// Mock log store
const mockSetLogFiles = jest.fn();
const mockClearLogs = jest.fn();

jest.mock('@/lib/stores/log', () => ({
  useLogStore: jest.fn(() => ({
    logs: [],
    filter: { levels: [], search: '' },
    autoScroll: true,
    paused: false,
    drawerOpen: false,
    logFiles: [],
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
  });

  it('should return log methods', () => {
    const { result } = renderHook(() => useLogs());

    expect(result.current).toHaveProperty('loadLogFiles');
    expect(result.current).toHaveProperty('queryLogFile');
    expect(result.current).toHaveProperty('clearLogFile');
    expect(result.current).toHaveProperty('getLogDirectory');
  });

  it('should load log files', async () => {
    const logFiles = [{ name: 'app.log', size: 1024 }];
    mockLogListFiles.mockResolvedValue(logFiles);
    const { result } = renderHook(() => useLogs());

    await act(async () => {
      await result.current.loadLogFiles();
    });

    expect(mockLogListFiles).toHaveBeenCalled();
    expect(mockSetLogFiles).toHaveBeenCalledWith(logFiles);
  });

  it('should query log file', async () => {
    const queryResult = { entries: [], total: 0 };
    mockLogQuery.mockResolvedValue(queryResult);
    const { result } = renderHook(() => useLogs());

    let response;
    await act(async () => {
      response = await result.current.queryLogFile({ fileName: 'app.log' });
    });

    expect(mockLogQuery).toHaveBeenCalledWith({ fileName: 'app.log' });
    expect(response).toEqual(queryResult);
  });

  it('should clear log file', async () => {
    mockLogClear.mockResolvedValue(undefined);
    mockLogListFiles.mockResolvedValue([]);
    const { result } = renderHook(() => useLogs());

    await act(async () => {
      await result.current.clearLogFile('app.log');
    });

    expect(mockLogClear).toHaveBeenCalledWith('app.log');
  });

  it('should get log directory', async () => {
    const logDir = '/path/to/logs';
    mockLogGetDir.mockResolvedValue(logDir);
    const { result } = renderHook(() => useLogs());

    let dir;
    await act(async () => {
      dir = await result.current.getLogDirectory();
    });

    expect(mockLogGetDir).toHaveBeenCalled();
    expect(dir).toBe(logDir);
  });

  it('should return store state', () => {
    const { result } = renderHook(() => useLogs());

    expect(result.current).toHaveProperty('logs');
    expect(result.current).toHaveProperty('logFiles');
    expect(result.current).toHaveProperty('filter');
  });
});
