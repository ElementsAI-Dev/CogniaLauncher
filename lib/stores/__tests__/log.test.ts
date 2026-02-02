import { useLogStore, ALL_LEVELS } from '../log';

describe('useLogStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useLogStore.setState({
      logs: [],
      maxLogs: 1000,
      filter: {
        levels: ['info', 'warn', 'error'],
        search: '',
      },
      autoScroll: true,
      paused: false,
      drawerOpen: false,
      logFiles: [],
      selectedLogFile: null,
    });
  });

  describe('addLog', () => {
    it('should add a log entry', () => {
      useLogStore.getState().addLog({
        timestamp: Date.now(),
        level: 'info',
        message: 'Test message',
        target: 'test',
      });

      const logs = useLogStore.getState().logs;
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].level).toBe('info');
      expect(logs[0].id).toBeDefined();
    });

    it('should not add log when paused', () => {
      useLogStore.getState().togglePaused();
      
      useLogStore.getState().addLog({
        timestamp: Date.now(),
        level: 'info',
        message: 'Test message',
      });

      expect(useLogStore.getState().logs.length).toBe(0);
    });

    it('should respect maxLogs limit', () => {
      useLogStore.setState({ maxLogs: 3 });

      for (let i = 0; i < 5; i++) {
        useLogStore.getState().addLog({
          timestamp: Date.now(),
          level: 'info',
          message: `Message ${i}`,
        });
      }

      const logs = useLogStore.getState().logs;
      expect(logs.length).toBe(3);
      expect(logs[0].message).toBe('Message 2');
      expect(logs[2].message).toBe('Message 4');
    });
  });

  describe('addLogs', () => {
    it('should add multiple log entries', () => {
      useLogStore.getState().addLogs([
        { timestamp: Date.now(), level: 'info', message: 'Message 1' },
        { timestamp: Date.now(), level: 'warn', message: 'Message 2' },
        { timestamp: Date.now(), level: 'error', message: 'Message 3' },
      ]);

      expect(useLogStore.getState().logs.length).toBe(3);
    });

    it('should not add logs when paused', () => {
      useLogStore.getState().togglePaused();

      useLogStore.getState().addLogs([
        { timestamp: Date.now(), level: 'info', message: 'Message 1' },
        { timestamp: Date.now(), level: 'info', message: 'Message 2' },
      ]);

      expect(useLogStore.getState().logs.length).toBe(0);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      useLogStore.getState().addLogs([
        { timestamp: Date.now(), level: 'info', message: 'Message 1' },
        { timestamp: Date.now(), level: 'info', message: 'Message 2' },
      ]);

      expect(useLogStore.getState().logs.length).toBe(2);

      useLogStore.getState().clearLogs();

      expect(useLogStore.getState().logs.length).toBe(0);
    });
  });

  describe('filter', () => {
    it('should set filter', () => {
      useLogStore.getState().setFilter({ search: 'test' });

      expect(useLogStore.getState().filter.search).toBe('test');
    });

    it('should toggle level', () => {
      // Remove 'info' level
      useLogStore.getState().toggleLevel('info');
      expect(useLogStore.getState().filter.levels).not.toContain('info');

      // Add 'info' level back
      useLogStore.getState().toggleLevel('info');
      expect(useLogStore.getState().filter.levels).toContain('info');
    });

    it('should set search', () => {
      useLogStore.getState().setSearch('error');
      expect(useLogStore.getState().filter.search).toBe('error');
    });
  });

  describe('getFilteredLogs', () => {
    beforeEach(() => {
      useLogStore.getState().addLogs([
        { timestamp: 1, level: 'trace', message: 'Trace message' },
        { timestamp: 2, level: 'debug', message: 'Debug message' },
        { timestamp: 3, level: 'info', message: 'Info message' },
        { timestamp: 4, level: 'warn', message: 'Warning message' },
        { timestamp: 5, level: 'error', message: 'Error message' },
      ]);
    });

    it('should filter by level', () => {
      // Default filter includes info, warn, error
      const filtered = useLogStore.getState().getFilteredLogs();
      
      expect(filtered.length).toBe(3);
      expect(filtered.map(l => l.level)).toEqual(['info', 'warn', 'error']);
    });

    it('should filter by search', () => {
      useLogStore.getState().setSearch('warning');
      const filtered = useLogStore.getState().getFilteredLogs();

      expect(filtered.length).toBe(1);
      expect(filtered[0].message).toBe('Warning message');
    });

    it('should combine level and search filters', () => {
      useLogStore.getState().setFilter({
        levels: ['info', 'warn', 'error', 'debug'],
        search: 'message',
      });

      const filtered = useLogStore.getState().getFilteredLogs();
      expect(filtered.length).toBe(4); // All except trace
    });

    it('should be case-insensitive search', () => {
      useLogStore.getState().setSearch('ERROR');
      const filtered = useLogStore.getState().getFilteredLogs();

      expect(filtered.length).toBe(1);
      expect(filtered[0].level).toBe('error');
    });
  });

  describe('getLogStats', () => {
    it('should return correct stats', () => {
      useLogStore.getState().addLogs([
        { timestamp: 1, level: 'info', message: 'Message 1' },
        { timestamp: 2, level: 'info', message: 'Message 2' },
        { timestamp: 3, level: 'warn', message: 'Message 3' },
        { timestamp: 4, level: 'error', message: 'Message 4' },
      ]);

      const stats = useLogStore.getState().getLogStats();

      expect(stats.total).toBe(4);
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.warn).toBe(1);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.byLevel.debug).toBe(0);
      expect(stats.byLevel.trace).toBe(0);
    });

    it('should return zero stats for empty logs', () => {
      const stats = useLogStore.getState().getLogStats();

      expect(stats.total).toBe(0);
      expect(stats.byLevel.info).toBe(0);
    });
  });

  describe('autoScroll', () => {
    it('should toggle autoScroll', () => {
      expect(useLogStore.getState().autoScroll).toBe(true);

      useLogStore.getState().toggleAutoScroll();
      expect(useLogStore.getState().autoScroll).toBe(false);

      useLogStore.getState().toggleAutoScroll();
      expect(useLogStore.getState().autoScroll).toBe(true);
    });
  });

  describe('paused', () => {
    it('should toggle paused', () => {
      expect(useLogStore.getState().paused).toBe(false);

      useLogStore.getState().togglePaused();
      expect(useLogStore.getState().paused).toBe(true);

      useLogStore.getState().togglePaused();
      expect(useLogStore.getState().paused).toBe(false);
    });
  });

  describe('drawer', () => {
    it('should open drawer', () => {
      useLogStore.getState().openDrawer();
      expect(useLogStore.getState().drawerOpen).toBe(true);
    });

    it('should close drawer', () => {
      useLogStore.getState().openDrawer();
      useLogStore.getState().closeDrawer();
      expect(useLogStore.getState().drawerOpen).toBe(false);
    });

    it('should toggle drawer', () => {
      useLogStore.getState().toggleDrawer();
      expect(useLogStore.getState().drawerOpen).toBe(true);

      useLogStore.getState().toggleDrawer();
      expect(useLogStore.getState().drawerOpen).toBe(false);
    });
  });

  describe('maxLogs', () => {
    it('should set maxLogs and trim existing logs', () => {
      useLogStore.getState().addLogs([
        { timestamp: 1, level: 'info', message: 'Message 1' },
        { timestamp: 2, level: 'info', message: 'Message 2' },
        { timestamp: 3, level: 'info', message: 'Message 3' },
        { timestamp: 4, level: 'info', message: 'Message 4' },
        { timestamp: 5, level: 'info', message: 'Message 5' },
      ]);

      expect(useLogStore.getState().logs.length).toBe(5);

      useLogStore.getState().setMaxLogs(3);

      expect(useLogStore.getState().maxLogs).toBe(3);
      expect(useLogStore.getState().logs.length).toBe(3);
      expect(useLogStore.getState().logs[0].message).toBe('Message 3');
    });
  });

  describe('logFiles', () => {
    it('should set log files', () => {
      const files = [
        { name: 'app.log', path: '/logs/app.log', size: 1024, modified: Date.now() },
        { name: 'app.log.1', path: '/logs/app.log.1', size: 2048, modified: Date.now() - 1000 },
      ];

      useLogStore.getState().setLogFiles(files);

      expect(useLogStore.getState().logFiles).toEqual(files);
    });

    it('should set selected log file', () => {
      useLogStore.getState().setSelectedLogFile('app.log');
      expect(useLogStore.getState().selectedLogFile).toBe('app.log');

      useLogStore.getState().setSelectedLogFile(null);
      expect(useLogStore.getState().selectedLogFile).toBeNull();
    });
  });

  describe('ALL_LEVELS constant', () => {
    it('should contain all log levels', () => {
      expect(ALL_LEVELS).toEqual(['trace', 'debug', 'info', 'warn', 'error']);
    });
  });
});
