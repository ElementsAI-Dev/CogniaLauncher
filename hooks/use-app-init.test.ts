import { renderHook, act } from '@testing-library/react';
import { useAppInit } from './use-app-init';

// Mock Tauri APIs
const mockIsTauri = jest.fn(() => false);
const mockAppCheckInit = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  appCheckInit: (...args: unknown[]) => mockAppCheckInit(...args),
}));

describe('useAppInit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsTauri.mockReturnValue(false);
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

    it('should transition to ready when backend is initialized', async () => {
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
      expect(result.current.message).toBe('splash.ready');
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

      // First poll interval (200ms)
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      await act(async () => {});

      // Second poll interval (200ms)
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      await act(async () => {});

      expect(callCount).toBeGreaterThanOrEqual(3);
      expect(result.current.phase).toBe('ready');
      expect(result.current.version).toBe('2.0.0');
    });

    it('should show progress messages over time', async () => {
      mockAppCheckInit.mockResolvedValue({ initialized: false, version: null });

      const { result } = renderHook(() => useAppInit());

      // Advance enough for progress to increase
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.phase).toBe('initializing');
      expect(result.current.progress).toBeGreaterThan(0);
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

    it('should handle appCheckInit errors gracefully', async () => {
      mockAppCheckInit.mockRejectedValue(new Error('Backend not ready'));

      const { result } = renderHook(() => useAppInit());

      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      await act(async () => {});

      // Should not crash, stays in initializing phase
      expect(result.current.isReady).toBe(false);
    });

    it('should clean up timers on unmount', async () => {
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
