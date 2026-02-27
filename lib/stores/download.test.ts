import { useDownloadStore, selectTasks, selectStats, selectHistory, selectHistoryStats, selectSpeedLimit, selectMaxConcurrent, selectIsLoading, selectError, selectSelectedTaskIds, selectShowHistory } from './download';
import type { DownloadTask, DownloadProgress, HistoryRecord, HistoryStats, QueueStats } from './download';

// Mock data factories
function createMockProgress(overrides?: Partial<DownloadProgress>): DownloadProgress {
  return {
    downloadedBytes: 0,
    totalBytes: 1000,
    speed: 100,
    speedHuman: '100 B/s',
    percent: 0,
    etaSecs: 10,
    etaHuman: '10s',
    downloadedHuman: '0 B',
    totalHuman: '1 KB',
    ...overrides,
  };
}

function createMockTask(overrides?: Partial<DownloadTask>): DownloadTask {
  return {
    id: `task-${Date.now()}-${Math.random()}`,
    url: 'https://example.com/file.zip',
    name: 'file.zip',
    destination: '/downloads/file.zip',
    state: 'queued',
    progress: createMockProgress(),
    error: null,
    provider: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    retries: 0,
    priority: 5,
    expectedChecksum: null,
    supportsResume: false,
    metadata: {},
    serverFilename: null,
    ...overrides,
  };
}

function createMockHistoryRecord(overrides?: Partial<HistoryRecord>): HistoryRecord {
  return {
    id: `history-${Date.now()}-${Math.random()}`,
    url: 'https://example.com/file.zip',
    filename: 'file.zip',
    destination: '/downloads/file.zip',
    size: 1024,
    sizeHuman: '1 KB',
    checksum: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationSecs: 10,
    durationHuman: '10s',
    averageSpeed: 100,
    speedHuman: '100 B/s',
    status: 'completed',
    error: null,
    provider: null,
    ...overrides,
  };
}

describe('useDownloadStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDownloadStore.setState({
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
    });
  });

  describe('initial state', () => {
    it('has default values', () => {
      const state = useDownloadStore.getState();
      expect(state.tasks).toEqual([]);
      expect(state.stats).toBeNull();
      expect(state.history).toEqual([]);
      expect(state.historyStats).toBeNull();
      expect(state.speedLimit).toBe(0);
      expect(state.maxConcurrent).toBe(4);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedTaskIds.size).toBe(0);
      expect(state.showHistory).toBe(false);
    });
  });

  describe('queue actions', () => {
    describe('setTasks', () => {
      it('should set tasks', () => {
        const tasks = [createMockTask({ id: 'task-1' }), createMockTask({ id: 'task-2' })];
        useDownloadStore.getState().setTasks(tasks);
        expect(useDownloadStore.getState().tasks).toEqual(tasks);
      });

      it('should replace existing tasks', () => {
        const oldTasks = [createMockTask({ id: 'old-task' })];
        const newTasks = [createMockTask({ id: 'new-task' })];

        useDownloadStore.getState().setTasks(oldTasks);
        useDownloadStore.getState().setTasks(newTasks);

        expect(useDownloadStore.getState().tasks).toEqual(newTasks);
      });
    });

    describe('setStats', () => {
      it('should set queue stats', () => {
        const stats: QueueStats = {
          totalTasks: 5,
          queued: 2,
          downloading: 1,
          paused: 1,
          completed: 1,
          failed: 0,
          cancelled: 0,
          totalBytes: 10000,
          downloadedBytes: 5000,
          totalHuman: '10 KB',
          downloadedHuman: '5 KB',
          overallProgress: 50,
        };

        useDownloadStore.getState().setStats(stats);
        expect(useDownloadStore.getState().stats).toEqual(stats);
      });
    });

    describe('updateTask', () => {
      it('should update a specific task', () => {
        const task = createMockTask({ id: 'task-1', state: 'queued' });
        useDownloadStore.getState().setTasks([task]);

        useDownloadStore.getState().updateTask('task-1', { state: 'downloading' });

        const updated = useDownloadStore.getState().tasks[0];
        expect(updated.state).toBe('downloading');
      });

      it('should not affect other tasks', () => {
        const task1 = createMockTask({ id: 'task-1', name: 'file1.zip' });
        const task2 = createMockTask({ id: 'task-2', name: 'file2.zip' });
        useDownloadStore.getState().setTasks([task1, task2]);

        useDownloadStore.getState().updateTask('task-1', { name: 'updated.zip' });

        expect(useDownloadStore.getState().tasks[0].name).toBe('updated.zip');
        expect(useDownloadStore.getState().tasks[1].name).toBe('file2.zip');
      });

      it('should do nothing if task not found', () => {
        const task = createMockTask({ id: 'task-1' });
        useDownloadStore.getState().setTasks([task]);

        useDownloadStore.getState().updateTask('non-existent', { state: 'completed' });

        expect(useDownloadStore.getState().tasks.length).toBe(1);
        expect(useDownloadStore.getState().tasks[0].state).toBe('queued');
      });
    });

    describe('updateTaskProgress', () => {
      it('should update task progress', () => {
        const task = createMockTask({ id: 'task-1' });
        useDownloadStore.getState().setTasks([task]);

        const newProgress = createMockProgress({ percent: 50, downloadedBytes: 500 });
        useDownloadStore.getState().updateTaskProgress('task-1', newProgress);

        expect(useDownloadStore.getState().tasks[0].progress.percent).toBe(50);
        expect(useDownloadStore.getState().tasks[0].progress.downloadedBytes).toBe(500);
      });
    });

    describe('addTask', () => {
      it('should add task to the beginning of the list', () => {
        const task1 = createMockTask({ id: 'task-1' });
        const task2 = createMockTask({ id: 'task-2' });

        useDownloadStore.getState().addTask(task1);
        useDownloadStore.getState().addTask(task2);

        const tasks = useDownloadStore.getState().tasks;
        expect(tasks.length).toBe(2);
        expect(tasks[0].id).toBe('task-2');
        expect(tasks[1].id).toBe('task-1');
      });
    });

    describe('removeTask', () => {
      it('should remove task from list', () => {
        const task1 = createMockTask({ id: 'task-1' });
        const task2 = createMockTask({ id: 'task-2' });
        useDownloadStore.getState().setTasks([task1, task2]);

        useDownloadStore.getState().removeTask('task-1');

        expect(useDownloadStore.getState().tasks.length).toBe(1);
        expect(useDownloadStore.getState().tasks[0].id).toBe('task-2');
      });

      it('should also remove task from selectedTaskIds', () => {
        const task = createMockTask({ id: 'task-1' });
        useDownloadStore.getState().setTasks([task]);
        useDownloadStore.getState().selectTask('task-1');

        useDownloadStore.getState().removeTask('task-1');

        expect(useDownloadStore.getState().selectedTaskIds.has('task-1')).toBe(false);
      });
    });
  });

  describe('history actions', () => {
    describe('setHistory', () => {
      it('should set history records', () => {
        const records = [createMockHistoryRecord({ id: 'h1' }), createMockHistoryRecord({ id: 'h2' })];
        useDownloadStore.getState().setHistory(records);
        expect(useDownloadStore.getState().history).toEqual(records);
      });
    });

    describe('setHistoryStats', () => {
      it('should set history stats', () => {
        const stats: HistoryStats = {
          totalCount: 10,
          completedCount: 8,
          failedCount: 1,
          cancelledCount: 1,
          totalBytes: 10240,
          totalBytesHuman: '10 KB',
          averageSpeed: 1024,
          averageSpeedHuman: '1 KB/s',
          successRate: 80,
        };

        useDownloadStore.getState().setHistoryStats(stats);
        expect(useDownloadStore.getState().historyStats).toEqual(stats);
      });
    });

    describe('addHistoryRecord', () => {
      it('should add record to the beginning', () => {
        const record1 = createMockHistoryRecord({ id: 'h1' });
        const record2 = createMockHistoryRecord({ id: 'h2' });

        useDownloadStore.getState().addHistoryRecord(record1);
        useDownloadStore.getState().addHistoryRecord(record2);

        const history = useDownloadStore.getState().history;
        expect(history[0].id).toBe('h2');
        expect(history[1].id).toBe('h1');
      });

      it('should keep only last 100 records', () => {
        // Add 105 records
        for (let i = 0; i < 105; i++) {
          useDownloadStore.getState().addHistoryRecord(createMockHistoryRecord({ id: `h${i}` }));
        }

        expect(useDownloadStore.getState().history.length).toBe(100);
      });
    });

    describe('removeHistoryRecord', () => {
      it('should remove record from history', () => {
        const record1 = createMockHistoryRecord({ id: 'h1' });
        const record2 = createMockHistoryRecord({ id: 'h2' });
        useDownloadStore.getState().setHistory([record1, record2]);

        useDownloadStore.getState().removeHistoryRecord('h1');

        expect(useDownloadStore.getState().history.length).toBe(1);
        expect(useDownloadStore.getState().history[0].id).toBe('h2');
      });
    });

    describe('clearHistory', () => {
      it('should clear history and historyStats', () => {
        useDownloadStore.getState().setHistory([createMockHistoryRecord()]);
        useDownloadStore.getState().setHistoryStats({
          totalCount: 1,
          completedCount: 1,
          failedCount: 0,
          cancelledCount: 0,
          totalBytes: 1024,
          totalBytesHuman: '1 KB',
          averageSpeed: 100,
          averageSpeedHuman: '100 B/s',
          successRate: 100,
        });

        useDownloadStore.getState().clearHistory();

        expect(useDownloadStore.getState().history).toEqual([]);
        expect(useDownloadStore.getState().historyStats).toBeNull();
      });
    });
  });

  describe('settings actions', () => {
    describe('setSpeedLimit', () => {
      it('should set speed limit', () => {
        useDownloadStore.getState().setSpeedLimit(1024);
        expect(useDownloadStore.getState().speedLimit).toBe(1024);
      });

      it('should accept 0 for unlimited', () => {
        useDownloadStore.getState().setSpeedLimit(1024);
        useDownloadStore.getState().setSpeedLimit(0);
        expect(useDownloadStore.getState().speedLimit).toBe(0);
      });
    });

    describe('setMaxConcurrent', () => {
      it('should set max concurrent downloads', () => {
        useDownloadStore.getState().setMaxConcurrent(8);
        expect(useDownloadStore.getState().maxConcurrent).toBe(8);
      });
    });
  });

  describe('UI actions', () => {
    describe('setLoading', () => {
      it('should set loading state', () => {
        useDownloadStore.getState().setLoading(true);
        expect(useDownloadStore.getState().isLoading).toBe(true);

        useDownloadStore.getState().setLoading(false);
        expect(useDownloadStore.getState().isLoading).toBe(false);
      });
    });

    describe('setError', () => {
      it('should set error message', () => {
        useDownloadStore.getState().setError('Network error');
        expect(useDownloadStore.getState().error).toBe('Network error');
      });

      it('should clear error message', () => {
        useDownloadStore.getState().setError('Error');
        useDownloadStore.getState().setError(null);
        expect(useDownloadStore.getState().error).toBeNull();
      });
    });

    describe('selectTask', () => {
      it('should add task to selectedTaskIds', () => {
        useDownloadStore.getState().selectTask('task-1');
        expect(useDownloadStore.getState().selectedTaskIds.has('task-1')).toBe(true);
      });

      it('should allow selecting multiple tasks', () => {
        useDownloadStore.getState().selectTask('task-1');
        useDownloadStore.getState().selectTask('task-2');

        const selected = useDownloadStore.getState().selectedTaskIds;
        expect(selected.has('task-1')).toBe(true);
        expect(selected.has('task-2')).toBe(true);
      });
    });

    describe('deselectTask', () => {
      it('should remove task from selectedTaskIds', () => {
        useDownloadStore.getState().selectTask('task-1');
        useDownloadStore.getState().selectTask('task-2');
        useDownloadStore.getState().deselectTask('task-1');

        const selected = useDownloadStore.getState().selectedTaskIds;
        expect(selected.has('task-1')).toBe(false);
        expect(selected.has('task-2')).toBe(true);
      });
    });

    describe('selectAllTasks', () => {
      it('should select all tasks', () => {
        const tasks = [
          createMockTask({ id: 'task-1' }),
          createMockTask({ id: 'task-2' }),
          createMockTask({ id: 'task-3' }),
        ];
        useDownloadStore.getState().setTasks(tasks);

        useDownloadStore.getState().selectAllTasks();

        const selected = useDownloadStore.getState().selectedTaskIds;
        expect(selected.size).toBe(3);
        expect(selected.has('task-1')).toBe(true);
        expect(selected.has('task-2')).toBe(true);
        expect(selected.has('task-3')).toBe(true);
      });
    });

    describe('deselectAllTasks', () => {
      it('should clear selectedTaskIds', () => {
        useDownloadStore.getState().selectTask('task-1');
        useDownloadStore.getState().selectTask('task-2');

        useDownloadStore.getState().deselectAllTasks();

        expect(useDownloadStore.getState().selectedTaskIds.size).toBe(0);
      });
    });

    describe('toggleShowHistory', () => {
      it('should toggle showHistory', () => {
        expect(useDownloadStore.getState().showHistory).toBe(false);

        useDownloadStore.getState().toggleShowHistory();
        expect(useDownloadStore.getState().showHistory).toBe(true);

        useDownloadStore.getState().toggleShowHistory();
        expect(useDownloadStore.getState().showHistory).toBe(false);
      });
    });
  });

  describe('computed getters', () => {
    beforeEach(() => {
      const tasks = [
        createMockTask({ id: 'queued-1', state: 'queued' }),
        createMockTask({ id: 'downloading-1', state: 'downloading' }),
        createMockTask({ id: 'downloading-2', state: 'downloading' }),
        createMockTask({ id: 'paused-1', state: 'paused' }),
        createMockTask({ id: 'completed-1', state: 'completed' }),
        createMockTask({ id: 'completed-2', state: 'completed' }),
        createMockTask({ id: 'failed-1', state: 'failed' }),
        createMockTask({ id: 'cancelled-1', state: 'cancelled' }),
      ];
      useDownloadStore.getState().setTasks(tasks);
    });

    describe('getActiveTasks', () => {
      it('should return queued and downloading tasks', () => {
        const active = useDownloadStore.getState().getActiveTasks();
        expect(active.length).toBe(3);
        expect(active.some((t) => t.id === 'queued-1')).toBe(true);
        expect(active.some((t) => t.id === 'downloading-1')).toBe(true);
        expect(active.some((t) => t.id === 'downloading-2')).toBe(true);
      });
    });

    describe('getPausedTasks', () => {
      it('should return paused tasks', () => {
        const paused = useDownloadStore.getState().getPausedTasks();
        expect(paused.length).toBe(1);
        expect(paused[0].id).toBe('paused-1');
      });
    });

    describe('getCompletedTasks', () => {
      it('should return completed tasks', () => {
        const completed = useDownloadStore.getState().getCompletedTasks();
        expect(completed.length).toBe(2);
        expect(completed.some((t) => t.id === 'completed-1')).toBe(true);
        expect(completed.some((t) => t.id === 'completed-2')).toBe(true);
      });
    });

    describe('getFailedTasks', () => {
      it('should return failed tasks', () => {
        const failed = useDownloadStore.getState().getFailedTasks();
        expect(failed.length).toBe(1);
        expect(failed[0].id).toBe('failed-1');
      });
    });
  });

  describe('selectors', () => {
    it('should return correct values via selectors', () => {
      const tasks = [createMockTask({ id: 'task-1' })];
      const stats: QueueStats = {
        totalTasks: 1,
        queued: 1,
        downloading: 0,
        paused: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        totalBytes: 1000,
        downloadedBytes: 0,
        totalHuman: '1 KB',
        downloadedHuman: '0 B',
        overallProgress: 0,
      };

      useDownloadStore.setState({
        tasks,
        stats,
        speedLimit: 1024,
        maxConcurrent: 2,
        isLoading: true,
        error: 'test error',
        showHistory: true,
      });

      const state = useDownloadStore.getState();
      expect(state.tasks).toEqual(tasks);
      expect(state.stats).toEqual(stats);
      expect(state.speedLimit).toBe(1024);
      expect(state.maxConcurrent).toBe(2);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBe('test error');
      expect(state.showHistory).toBe(true);
    });
  });

  describe('exported selector functions', () => {
    it('selectTasks returns tasks', () => {
      const tasks = [createMockTask({ id: 'sel-1' })];
      useDownloadStore.getState().setTasks(tasks);
      expect(selectTasks(useDownloadStore.getState())).toEqual(tasks);
    });

    it('selectStats returns stats', () => {
      expect(selectStats(useDownloadStore.getState())).toBeNull();
    });

    it('selectHistory returns history', () => {
      expect(selectHistory(useDownloadStore.getState())).toEqual([]);
    });

    it('selectHistoryStats returns historyStats', () => {
      expect(selectHistoryStats(useDownloadStore.getState())).toBeNull();
    });

    it('selectSpeedLimit returns speedLimit', () => {
      expect(selectSpeedLimit(useDownloadStore.getState())).toBe(0);
    });

    it('selectMaxConcurrent returns maxConcurrent', () => {
      expect(selectMaxConcurrent(useDownloadStore.getState())).toBe(4);
    });

    it('selectIsLoading returns isLoading', () => {
      expect(selectIsLoading(useDownloadStore.getState())).toBe(false);
    });

    it('selectError returns error', () => {
      expect(selectError(useDownloadStore.getState())).toBeNull();
    });

    it('selectSelectedTaskIds returns selectedTaskIds', () => {
      expect(selectSelectedTaskIds(useDownloadStore.getState()).size).toBe(0);
    });

    it('selectShowHistory returns showHistory', () => {
      expect(selectShowHistory(useDownloadStore.getState())).toBe(false);
    });
  });
});
