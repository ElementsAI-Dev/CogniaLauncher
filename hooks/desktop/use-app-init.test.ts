import { renderHook, act } from '@testing-library/react';
import { useAppInit } from './use-app-init';

// Mock Tauri APIs
const mockIsTauri = jest.fn(() => false);
const mockAppCheckInit = jest.fn();
const mockListenInitProgress = jest.fn();
let capturedListener: ((event: {
  phase: string;
  progress: number;
  message: string;
  degraded?: boolean;
  timedOutPhases?: string[];
  skippedPhases?: string[];
}) => void) | null = null;

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  appCheckInit: (...args: unknown[]) => mockAppCheckInit(...args),
  listenInitProgress: (cb: (event: { phase: string; progress: number; message: string }) => void) => {
    capturedListener = cb;
    mockListenInitProgress(cb);
    return Promise.resolve(jest.fn());
  },
}));

describe('useAppInit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsTauri.mockReturnValue(false);
    capturedListener = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('web mode (non-Tauri)', () => {
    it('should immediately be ready in web mode', () => {
      const { result } = renderHook(() => useAppInit());

      expect(result.current.phase).toBe('web-mode');
      expect(result.current.isReady).toBe(true);
      expect(result.current.progress).toBe(100);
      expect(result.current.message).toBe('splash.ready');
    });

    it('should have null version in web mode', () => {
      const { result } = renderHook(() => useAppInit());

      expect(result.current.version).toBeNull();
    });

    it('should not register event listener in web mode', () => {
      renderHook(() => useAppInit());

      expect(mockListenInitProgress).not.toHaveBeenCalled();
    });
  });

  describe('desktop mode (Tauri)', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
    });

    it('should start in checking phase', () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { result } = renderHook(() => useAppInit());

      expect(result.current.phase).toBe('checking');
      expect(result.current.isReady).toBe(false);
      expect(result.current.progress).toBe(0);
    });

    it('should register init progress event listener', () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      renderHook(() => useAppInit());

      expect(mockListenInitProgress).toHaveBeenCalledTimes(1);
    });

    it('should transition to ready when backend is initialized via polling', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: true, version: '1.0.0' });

      const { result } = renderHook(() => useAppInit());

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Allow promise to resolve
      await act(async () => {});

      expect(result.current.phase).toBe('ready');
      expect(result.current.isReady).toBe(true);
      expect(result.current.progress).toBe(100);
      expect(result.current.version).toBe('1.0.0');
    });

    it('should update state when init-progress event is received', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { result } = renderHook(() => useAppInit());

      // Wait for listener to register
      await act(async () => {});

      // Simulate backend emitting init-progress events
      act(() => {
        capturedListener?.({ phase: 'settings', progress: 10, message: 'splash.loadingSettings' });
      });

      expect(result.current.phase).toBe('settings');
      expect(result.current.progress).toBe(10);
      expect(result.current.message).toBe('splash.loadingSettings');

      act(() => {
        capturedListener?.({ phase: 'resources', progress: 20, message: 'splash.checkingResources' });
      });

      expect(result.current.phase).toBe('resources');
      expect(result.current.progress).toBe(20);
      expect(result.current.message).toBe('splash.checkingResources');
    });

    it('captures degraded startup metadata from init-progress events', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { result } = renderHook(() => useAppInit());

      await act(async () => {});

      act(() => {
        capturedListener?.({
          phase: 'plugins',
          progress: 90,
          message: 'splash.loadingPlugins',
          degraded: true,
          timedOutPhases: ['plugins'],
          skippedPhases: ['resources.integrity_check'],
        });
      });

      expect(result.current.isDegraded).toBe(true);
      expect(result.current.timedOutPhases).toEqual(['plugins']);
      expect(result.current.skippedPhases).toEqual(['resources.integrity_check']);
    });

    it('should progress through all init phases via events', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { result } = renderHook(() => useAppInit());

      await act(async () => {});

      const phases = [
        { phase: 'settings', progress: 10, message: 'splash.loadingSettings' },
        { phase: 'resources', progress: 20, message: 'splash.checkingResources' },
        { phase: 'providers', progress: 45, message: 'splash.loadingProviders' },
        { phase: 'detection', progress: 60, message: 'splash.loadingDetection' },
        { phase: 'downloads', progress: 70, message: 'splash.loadingDownloads' },
        { phase: 'terminal', progress: 80, message: 'splash.loadingTerminal' },
        { phase: 'plugins', progress: 90, message: 'splash.loadingPlugins' },
        { phase: 'ready', progress: 100, message: 'splash.ready' },
      ];

      for (const p of phases) {
        act(() => {
          capturedListener?.(p);
        });
        expect(result.current.phase).toBe(p.phase);
        expect(result.current.progress).toBe(p.progress);
      }
    });

    it('should not regress progress on out-of-order events', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { result } = renderHook(() => useAppInit());

      await act(async () => {});

      act(() => {
        capturedListener?.({ phase: 'providers', progress: 45, message: 'splash.loadingProviders' });
      });
      expect(result.current.progress).toBe(45);

      // Simulate an earlier event arriving late
      act(() => {
        capturedListener?.({ phase: 'settings', progress: 10, message: 'splash.loadingSettings' });
      });

      // Progress should not go backwards
      expect(result.current.progress).toBe(45);
    });

    it('should ignore events after reaching ready phase', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { result } = renderHook(() => useAppInit());

      await act(async () => {});

      act(() => {
        capturedListener?.({ phase: 'ready', progress: 100, message: 'splash.ready' });
      });
      expect(result.current.phase).toBe('ready');

      // Late event should be ignored
      act(() => {
        capturedListener?.({ phase: 'settings', progress: 10, message: 'splash.loadingSettings' });
      });
      expect(result.current.phase).toBe('ready');
      expect(result.current.progress).toBe(100);
    });

    it('should poll at intervals until ready', async () => {
      let callCount = 0;
      mockAppCheckInit.mockImplementation(async () => {
        callCount++;
        if (callCount >= 3) {
          return { initialized: true, version: '2.0.0' };
        }
        return { initialized: false, version: null };
      });

      const { result } = renderHook(() => useAppInit());

      // Initial check
      await act(async () => {});

      // First poll interval (300ms)
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      await act(async () => {});

      // Second poll interval (300ms)
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      await act(async () => {});

      expect(callCount).toBeGreaterThanOrEqual(3);
      expect(result.current.phase).toBe('ready');
      expect(result.current.version).toBe('2.0.0');
    });

    it('should timeout and become ready after INIT_TIMEOUT_MS', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { result } = renderHook(() => useAppInit());

      // Advance past timeout (30 seconds)
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });

      expect(result.current.phase).toBe('ready');
      expect(result.current.isReady).toBe(true);
      expect(result.current.progress).toBe(100);
    });

    it('treats backend interactive degraded startup as ready while preserving degraded context', async () => {
      mockAppCheckInit.mockResolvedValue({
        initialized: false,
        interactive: true,
        degraded: true,
        phase: 'plugins',
        progress: 90,
        message: 'splash.loadingPlugins',
        version: '1.2.3',
        timedOutPhases: ['plugins'],
        skippedPhases: [],
      });

      const { result } = renderHook(() => useAppInit());

      await act(async () => {});

      expect(result.current.isReady).toBe(true);
      expect(result.current.phase).toBe('plugins');
      expect(result.current.progress).toBe(90);
      expect(result.current.message).toBe('splash.loadingPlugins');
      expect(result.current.version).toBe('1.2.3');
      expect(result.current.isDegraded).toBe(true);
      expect(result.current.timedOutPhases).toEqual(['plugins']);
    });

    it('uses backend-provided startup timeout instead of the fixed 30 second fallback', async () => {
      mockAppCheckInit.mockResolvedValue({
        initialized: false,
        interactive: false,
        degraded: false,
        phase: 'checking',
        progress: 0,
        message: 'splash.starting',
        version: null,
        startupTimeoutMs: 45_000,
        timedOutPhases: [],
        skippedPhases: [],
      });

      const { result } = renderHook(() => useAppInit());

      await act(async () => {});

      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(result.current.isReady).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(15_000);
      });
      expect(result.current.isReady).toBe(true);
    });

    it('should handle appCheckInit errors gracefully', async () => {
      mockAppCheckInit.mockRejectedValue(new Error('Backend not ready'));

      const { result } = renderHook(() => useAppInit());

      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      await act(async () => {});

      // Should not crash, stays in checking phase
      expect(result.current.isReady).toBe(false);
    });

    it('should clean up timers and listener on unmount', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { unmount } = renderHook(() => useAppInit());

      unmount();

      // Should not throw or leave dangling timers
      await act(async () => {
        jest.advanceTimersByTime(31_000);
      });
    });
  });
});
