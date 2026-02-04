import { renderHook, act } from '@testing-library/react';
import { useLogStore } from '../../stores/log';

// Mock the tauri module
// Note: Event listeners (listenCommandOutput, listenEnvInstallProgress, listenBatchProgress)
// are now handled by LogProvider, not useLogs hook.
jest.mock('../../tauri', () => ({
  isTauri: jest.fn(() => false),
  logListFiles: jest.fn(),
  logQuery: jest.fn(),
  logClear: jest.fn(),
  logGetDir: jest.fn(),
  logExport: jest.fn(),
}));

// Import after mocking
import { useLogs } from '../use-logs';
import * as tauri from '../../tauri';

const mockedTauri = jest.mocked(tauri);

describe('useLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useLogStore.setState({
      logs: [],
      maxLogs: 1000,
      filter: {
        levels: ['info', 'warn', 'error'],
        search: '',
        useRegex: false,
        startTime: null,
        endTime: null,
      },
      autoScroll: true,
      paused: false,
      drawerOpen: false,
      logFiles: [],
      selectedLogFile: null,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('state access', () => {
    it('should provide access to log store state', () => {
      const { result } = renderHook(() => useLogs());

      expect(result.current.logs).toEqual([]);
      expect(result.current.autoScroll).toBe(true);
      expect(result.current.paused).toBe(false);
      expect(result.current.drawerOpen).toBe(false);
    });

    it('should provide access to filter state', () => {
      const { result } = renderHook(() => useLogs());

      expect(result.current.filter.levels).toEqual(['info', 'warn', 'error']);
      expect(result.current.filter.search).toBe('');
    });
  });

  describe('actions', () => {
    it('should add log entry', () => {
      const { result } = renderHook(() => useLogs());

      act(() => {
        result.current.addLog({
          timestamp: Date.now(),
          level: 'info',
          message: 'Test message',
        });
      });

      expect(result.current.logs.length).toBe(1);
      expect(result.current.logs[0].message).toBe('Test message');
    });

    it('should clear logs', () => {
      const { result } = renderHook(() => useLogs());

      act(() => {
        result.current.addLog({
          timestamp: Date.now(),
          level: 'info',
          message: 'Test message',
        });
      });

      expect(result.current.logs.length).toBe(1);

      act(() => {
        result.current.clearLogs();
      });

      expect(result.current.logs.length).toBe(0);
    });

    it('should toggle level filter', () => {
      const { result } = renderHook(() => useLogs());

      expect(result.current.filter.levels).toContain('info');

      act(() => {
        result.current.toggleLevel('info');
      });

      expect(result.current.filter.levels).not.toContain('info');
    });

    it('should set search filter', () => {
      const { result } = renderHook(() => useLogs());

      act(() => {
        result.current.setSearch('error');
      });

      expect(result.current.filter.search).toBe('error');
    });

    it('should toggle autoScroll', () => {
      const { result } = renderHook(() => useLogs());

      expect(result.current.autoScroll).toBe(true);

      act(() => {
        result.current.toggleAutoScroll();
      });

      expect(result.current.autoScroll).toBe(false);
    });

    it('should toggle paused', () => {
      const { result } = renderHook(() => useLogs());

      expect(result.current.paused).toBe(false);

      act(() => {
        result.current.togglePaused();
      });

      expect(result.current.paused).toBe(true);
    });

    it('should open/close/toggle drawer', () => {
      const { result } = renderHook(() => useLogs());

      expect(result.current.drawerOpen).toBe(false);

      act(() => {
        result.current.openDrawer();
      });
      expect(result.current.drawerOpen).toBe(true);

      act(() => {
        result.current.closeDrawer();
      });
      expect(result.current.drawerOpen).toBe(false);

      act(() => {
        result.current.toggleDrawer();
      });
      expect(result.current.drawerOpen).toBe(true);
    });
  });

  describe('computed values', () => {
    it('should return filtered logs', () => {
      const { result } = renderHook(() => useLogs());

      act(() => {
        result.current.addLog({ timestamp: 1, level: 'debug', message: 'Debug' });
        result.current.addLog({ timestamp: 2, level: 'info', message: 'Info' });
        result.current.addLog({ timestamp: 3, level: 'error', message: 'Error' });
      });

      // Default filter excludes debug
      const filtered = result.current.getFilteredLogs();
      expect(filtered.length).toBe(2);
      expect(filtered.map(l => l.level)).toEqual(['info', 'error']);
    });

    it('should return log stats', () => {
      const { result } = renderHook(() => useLogs());

      act(() => {
        result.current.addLog({ timestamp: 1, level: 'info', message: 'Info 1' });
        result.current.addLog({ timestamp: 2, level: 'info', message: 'Info 2' });
        result.current.addLog({ timestamp: 3, level: 'error', message: 'Error' });
      });

      const stats = result.current.getLogStats();
      expect(stats.total).toBe(3);
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.error).toBe(1);
    });
  });

  describe('file operations', () => {
    it('should load log files when in Tauri', async () => {
      mockedTauri.isTauri.mockReturnValue(true);
      const mockFiles = [
        { name: 'app.log', path: '/logs/app.log', size: 1024, modified: Date.now() },
      ];
      mockedTauri.logListFiles.mockResolvedValue(mockFiles);

      const { result } = renderHook(() => useLogs());

      await act(async () => {
        await result.current.loadLogFiles();
      });

      expect(mockedTauri.logListFiles).toHaveBeenCalled();
      expect(result.current.logFiles).toEqual(mockFiles);
    });

    it('should not load log files when not in Tauri', async () => {
      mockedTauri.isTauri.mockReturnValue(false);

      const { result } = renderHook(() => useLogs());

      await act(async () => {
        await result.current.loadLogFiles();
      });

      expect(mockedTauri.logListFiles).not.toHaveBeenCalled();
    });

    it('should query log file', async () => {
      mockedTauri.isTauri.mockReturnValue(true);
      const mockResult = {
        entries: [{ timestamp: '2026-02-02', level: 'INFO', target: 'app', message: 'Test', lineNumber: 1 }],
        totalCount: 1,
        hasMore: false,
      };
      mockedTauri.logQuery.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useLogs());

      let queryResult;
      await act(async () => {
        queryResult = await result.current.queryLogFile({ limit: 100 });
      });

      expect(mockedTauri.logQuery).toHaveBeenCalledWith({ limit: 100 });
      expect(queryResult).toEqual(mockResult);
    });

    it('should clear log file', async () => {
      mockedTauri.isTauri.mockReturnValue(true);
      mockedTauri.logClear.mockResolvedValue(undefined);
      mockedTauri.logListFiles.mockResolvedValue([]);

      const { result } = renderHook(() => useLogs());

      await act(async () => {
        await result.current.clearLogFile('app.log');
      });

      expect(mockedTauri.logClear).toHaveBeenCalledWith('app.log');
      expect(mockedTauri.logListFiles).toHaveBeenCalled(); // Should refresh list
    });

    it('should get log directory', async () => {
      mockedTauri.isTauri.mockReturnValue(true);
      mockedTauri.logGetDir.mockResolvedValue('/path/to/logs');

      const { result } = renderHook(() => useLogs());

      let logDir;
      await act(async () => {
        logDir = await result.current.getLogDirectory();
      });

      expect(mockedTauri.logGetDir).toHaveBeenCalled();
      expect(logDir).toBe('/path/to/logs');
    });

    it('should export log file', async () => {
      mockedTauri.isTauri.mockReturnValue(true);
      mockedTauri.logExport.mockResolvedValue({
        content: 'log content',
        fileName: 'app.log',
      });

      const { result } = renderHook(() => useLogs());

      let exportResult;
      await act(async () => {
        exportResult = await result.current.exportLogFile({ fileName: 'app.log', format: 'txt' });
      });

      expect(mockedTauri.logExport).toHaveBeenCalledWith({ fileName: 'app.log', format: 'txt' });
      expect(exportResult).toEqual({ content: 'log content', fileName: 'app.log' });
    });
  });

  describe('exportLogs', () => {
    it('should export logs as text', () => {
      // Mock URL APIs
      const mockUrl = 'blob:test-url';
      const mockCreateObjectURL = jest.fn(() => mockUrl);
      const mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock DOM APIs
      const mockClick = jest.fn();
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();
      document.createElement = jest.fn(() => ({
        click: mockClick,
        href: '',
        download: '',
      })) as unknown as typeof document.createElement;
      document.body.appendChild = mockAppendChild;
      document.body.removeChild = mockRemoveChild;

      const { result } = renderHook(() => useLogs());

      act(() => {
        result.current.addLog({ timestamp: Date.now(), level: 'info', message: 'Test' });
      });

      act(() => {
        result.current.exportLogs('txt');
      });

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });

    it('should export logs as JSON', () => {
      const mockUrl = 'blob:test-url';
      const mockCreateObjectURL = jest.fn(() => mockUrl);
      const mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockClick = jest.fn();
      document.createElement = jest.fn(() => ({
        click: mockClick,
        href: '',
        download: '',
      })) as unknown as typeof document.createElement;
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();

      const { result } = renderHook(() => useLogs());

      act(() => {
        result.current.addLog({ timestamp: Date.now(), level: 'info', message: 'Test' });
      });

      act(() => {
        result.current.exportLogs('json');
      });

      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });
});
