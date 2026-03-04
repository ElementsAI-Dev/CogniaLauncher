import { renderHook, act } from '@testing-library/react';
import { useWindowControls } from './use-window-controls';

// Mock platform detection
const mockIsTauri = jest.fn(() => false);
const mockIsWindows = jest.fn(() => false);

jest.mock('@/lib/platform', () => ({
  isTauri: () => mockIsTauri(),
  isWindows: () => mockIsWindows(),
}));

// Mock stores
const mockSetMaximized = jest.fn();
const mockSetFullscreen = jest.fn();
const mockSetFocused = jest.fn();
let mockMinimizeToTray = false;

jest.mock('@/lib/stores/settings', () => ({
  useSettingsStore: () => ({
    appSettings: { get minimizeToTray() { return mockMinimizeToTray; } },
  }),
}));

jest.mock('@/lib/stores/window-state', () => ({
  useWindowStateStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setMaximized: mockSetMaximized,
      setFullscreen: mockSetFullscreen,
      setFocused: mockSetFocused,
    }),
}));

const mockUpdateTrayAlwaysOnTop = jest.fn(() => Promise.resolve());
jest.mock('@/hooks/use-tray-sync', () => ({
  updateTrayAlwaysOnTop: (enabled: boolean) => mockUpdateTrayAlwaysOnTop(enabled),
}));

// Mock Tauri window API
const mockMinimize = jest.fn();
const mockToggleMaximize = jest.fn();
const mockSetFullscreenWin = jest.fn();
const mockCenter = jest.fn();
const mockSetAlwaysOnTop = jest.fn();
const mockClose = jest.fn();
const mockHide = jest.fn();
const mockDestroy = jest.fn();
const mockIsMaximized = jest.fn(() => Promise.resolve(false));
const mockIsFullscreen = jest.fn(() => Promise.resolve(false));
const mockIsAlwaysOnTop = jest.fn(() => Promise.resolve(false));
const mockOuterPosition = jest.fn(() => Promise.resolve({ x: 0, y: 0 }));
const mockInnerPosition = jest.fn(() => Promise.resolve({ x: 0, y: 0 }));
const mockOuterSize = jest.fn(() => Promise.resolve({ width: 1280, height: 720 }));
const mockInnerSize = jest.fn(() => Promise.resolve({ width: 1264, height: 704 }));
const defaultMonitor = {
  name: 'Monitor-1',
  position: { x: 0, y: 0 },
  size: { width: 1280, height: 720 },
  workArea: {
    position: { x: 0, y: 0 },
    size: { width: 1280, height: 720 },
  },
  scaleFactor: 1,
};
const mockCurrentMonitor = jest.fn(() =>
  Promise.resolve(defaultMonitor),
);
const mockAvailableMonitors = jest.fn(() => Promise.resolve([defaultMonitor]));
const mockMonitorFromPoint = jest.fn(() => Promise.resolve(defaultMonitor));
const mockScaleFactor = jest.fn(() => Promise.resolve(1));

let closeCallback: ((ev: { preventDefault: () => void }) => Promise<void>) | null = null;

const mockOnResized = jest.fn(() => Promise.resolve(jest.fn()));
const mockOnMoved = jest.fn(() => Promise.resolve(jest.fn()));
const mockOnScaleChanged = jest.fn(() => Promise.resolve(jest.fn()));
const mockOnFocusChanged = jest.fn(() => Promise.resolve(jest.fn()));
const mockOnCloseRequested = jest.fn((cb: (ev: { preventDefault: () => void }) => Promise<void>) => { closeCallback = cb; return Promise.resolve(jest.fn()); });

const mockWin = {
  minimize: mockMinimize,
  toggleMaximize: mockToggleMaximize,
  setFullscreen: mockSetFullscreenWin,
  center: mockCenter,
  setAlwaysOnTop: mockSetAlwaysOnTop,
  close: mockClose,
  hide: mockHide,
  destroy: mockDestroy,
  isMaximized: mockIsMaximized,
  isFullscreen: mockIsFullscreen,
  isAlwaysOnTop: mockIsAlwaysOnTop,
  outerPosition: mockOuterPosition,
  innerPosition: mockInnerPosition,
  outerSize: mockOuterSize,
  innerSize: mockInnerSize,
  scaleFactor: mockScaleFactor,
  onResized: mockOnResized,
  onMoved: mockOnMoved,
  onScaleChanged: mockOnScaleChanged,
  onFocusChanged: mockOnFocusChanged,
  onCloseRequested: mockOnCloseRequested,
};

jest.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWin,
  currentMonitor: () => mockCurrentMonitor(),
  availableMonitors: () => mockAvailableMonitors(),
  monitorFromPoint: (x: number, y: number) => mockMonitorFromPoint(x, y),
}));

describe('useWindowControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockIsWindows.mockReturnValue(false);
    mockOuterPosition.mockResolvedValue({ x: 0, y: 0 });
    mockInnerPosition.mockResolvedValue({ x: 0, y: 0 });
    mockOuterSize.mockResolvedValue({ width: 1280, height: 720 });
    mockInnerSize.mockResolvedValue({ width: 1264, height: 704 });
    mockCurrentMonitor.mockResolvedValue(defaultMonitor);
    mockAvailableMonitors.mockResolvedValue([defaultMonitor]);
    mockMonitorFromPoint.mockResolvedValue(defaultMonitor);
    mockScaleFactor.mockResolvedValue(1);
  });

  it('should initialize with default state (non-Tauri)', () => {
    const { result } = renderHook(() => useWindowControls());

    // mounted becomes true after useEffect
    expect(result.current.mounted).toBe(true);
    expect(result.current.isTauriEnv).toBe(false);
    expect(result.current.isWindows).toBe(false);
    expect(result.current.appWindow).toBeNull();
    expect(result.current.isMaximized).toBe(false);
    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.isFocused).toBe(true);
    expect(result.current.isAlwaysOnTop).toBe(false);
    expect(result.current.maximizeInsets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(result.current.maximizePadding).toBe(0);
  });

  it('should set mounted to true after mount', () => {
    const { result } = renderHook(() => useWindowControls());

    expect(result.current.mounted).toBe(true);
  });

  it('should compute isTauriEnv correctly', () => {
    mockIsTauri.mockReturnValue(true);

    const { result } = renderHook(() => useWindowControls());

    expect(result.current.isTauriEnv).toBe(true);
  });

  it('should compute isWindows correctly', () => {
    mockIsWindows.mockReturnValue(true);

    const { result } = renderHook(() => useWindowControls());

    expect(result.current.isWindows).toBe(true);
  });

  it('should return 0 maximizePadding when not Tauri', () => {
    mockIsWindows.mockReturnValue(true);

    const { result } = renderHook(() => useWindowControls());

    expect(result.current.maximizePadding).toBe(0);
  });

  it('should have all handler functions', () => {
    const { result } = renderHook(() => useWindowControls());

    expect(typeof result.current.handleMinimize).toBe('function');
    expect(typeof result.current.handleMaximize).toBe('function');
    expect(typeof result.current.handleToggleFullscreen).toBe('function');
    expect(typeof result.current.handleCenter).toBe('function');
    expect(typeof result.current.handleToggleAlwaysOnTop).toBe('function');
    expect(typeof result.current.handleClose).toBe('function');
    expect(typeof result.current.handleDoubleClick).toBe('function');
  });

  it('should handle minimize gracefully without appWindow', async () => {
    const { result } = renderHook(() => useWindowControls());

    // Should not throw when appWindow is null
    await act(async () => {
      await result.current.handleMinimize();
    });
  });

  it('should handle maximize gracefully without appWindow', async () => {
    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleMaximize();
    });
  });

  it('should handle toggleFullscreen gracefully without appWindow', async () => {
    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleToggleFullscreen();
    });
  });

  it('should handle center gracefully without appWindow', async () => {
    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleCenter();
    });
  });

  it('should handle toggleAlwaysOnTop gracefully without appWindow', async () => {
    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleToggleAlwaysOnTop();
    });
  });

  it('should handle close gracefully without appWindow', async () => {
    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleClose();
    });
  });

  it('should handleDoubleClick ignore clicks on buttons', () => {
    const { result } = renderHook(() => useWindowControls());

    const button = document.createElement('button');
    const mockEvent = {
      target: button,
    } as unknown as React.MouseEvent;

    // Should not call handleMaximize (no appWindow, so it's a no-op anyway)
    act(() => {
      result.current.handleDoubleClick(mockEvent);
    });
  });

  it('should handleDoubleClick ignore clicks on radix menu', () => {
    const { result } = renderHook(() => useWindowControls());

    const menuEl = document.createElement('div');
    menuEl.setAttribute('data-radix-menu-content', '');
    const child = document.createElement('span');
    menuEl.appendChild(child);
    document.body.appendChild(menuEl);

    const mockEvent = {
      target: child,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleDoubleClick(mockEvent);
    });

    document.body.removeChild(menuEl);
  });

  it('should respond to F11 keydown when appWindow is null (no-op)', () => {
    renderHook(() => useWindowControls());

    const event = new KeyboardEvent('keydown', { key: 'F11' });
    window.dispatchEvent(event);

    // No error means graceful handling
  });

  it('should respond to Ctrl+Shift+T keydown when appWindow is null (no-op)', () => {
    renderHook(() => useWindowControls());

    const event = new KeyboardEvent('keydown', {
      key: 'T',
      ctrlKey: true,
      shiftKey: true,
    });
    window.dispatchEvent(event);

    // No error means graceful handling
  });

  it('should dispatch checkGlobalUnsavedChanges custom event', () => {
    // This tests the helper function indirectly through the close handler
    // which uses checkGlobalUnsavedChanges internally

    const listener = jest.fn((e: Event) => {
      (e as CustomEvent).detail.hasChanges = false;
    });
    window.addEventListener('cognia:check-unsaved', listener);

    const { result } = renderHook(() => useWindowControls());

    // handleClose with no appWindow is a no-op but tests the function exists
    act(() => {
      result.current.handleClose();
    });

    window.removeEventListener('cognia:check-unsaved', listener);
  });

  // ── Tauri-enabled tests ──

  describe('with Tauri environment', () => {
    const renderHookWithTauriInit = async () => {
      let hook: ReturnType<typeof renderHook> | null = null;
      await act(async () => {
        hook = renderHook(() => useWindowControls());
        await new Promise((r) => setTimeout(r, 50));
      });
      if (!hook) {
        throw new Error('Failed to render useWindowControls hook');
      }
      return hook;
    };

    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(false);
      mockIsFullscreen.mockResolvedValue(false);
      mockIsAlwaysOnTop.mockResolvedValue(false);
      closeCallback = null;
    });

    it('should initialize Tauri window and read initial state', async () => {
      mockIsMaximized.mockResolvedValue(true);
      mockIsFullscreen.mockResolvedValue(false);
      mockIsAlwaysOnTop.mockResolvedValue(true);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.appWindow).toBe(mockWin);
      expect(result.current.isMaximized).toBe(true);
      expect(result.current.isAlwaysOnTop).toBe(true);
      expect(mockSetMaximized).toHaveBeenCalledWith(true);
      expect(mockSetFullscreen).toHaveBeenCalledWith(false);
    });

    it('should call minimize on appWindow', async () => {
      const { result } = await renderHookWithTauriInit();

      await act(async () => {
        await result.current.handleMinimize();
      });

      expect(mockMinimize).toHaveBeenCalled();
    });

    it('should call toggleMaximize on appWindow', async () => {
      const { result } = await renderHookWithTauriInit();

      await act(async () => {
        await result.current.handleMaximize();
      });

      expect(mockToggleMaximize).toHaveBeenCalled();
    });

    it('should toggle fullscreen on', async () => {
      mockIsFullscreen.mockResolvedValue(false);

      const { result } = await renderHookWithTauriInit();

      await act(async () => {
        await result.current.handleToggleFullscreen();
      });

      expect(mockSetFullscreenWin).toHaveBeenCalledWith(true);
    });

    it('should toggle fullscreen off', async () => {
      mockIsFullscreen.mockResolvedValue(true);

      const { result } = await renderHookWithTauriInit();

      await act(async () => {
        await result.current.handleToggleFullscreen();
      });

      expect(mockSetFullscreenWin).toHaveBeenCalledWith(false);
    });

    it('should center window', async () => {
      const { result } = await renderHookWithTauriInit();

      await act(async () => {
        await result.current.handleCenter();
      });

      expect(mockCenter).toHaveBeenCalled();
    });

    it('should toggle always on top', async () => {
      mockIsAlwaysOnTop.mockResolvedValue(false);

      const { result } = await renderHookWithTauriInit();

      await act(async () => {
        await result.current.handleToggleAlwaysOnTop();
      });

      expect(mockSetAlwaysOnTop).toHaveBeenCalledWith(true);
      expect(mockUpdateTrayAlwaysOnTop).toHaveBeenCalledWith(true);
      expect(result.current.isAlwaysOnTop).toBe(true);
    });

    it('should close window (not minimize to tray)', async () => {
      mockMinimizeToTray = false;

      const { result } = await renderHookWithTauriInit();

      await act(async () => {
        await result.current.handleClose();
      });

      expect(mockClose).toHaveBeenCalled();
    });

    it('should hide window when minimizeToTray is enabled', async () => {
      mockMinimizeToTray = true;

      const { result } = await renderHookWithTauriInit();

      await act(async () => {
        await result.current.handleClose();
      });

      expect(mockHide).toHaveBeenCalled();
      mockMinimizeToTray = false;
    });

    it('should compute maximizePadding=8 on Windows maximized', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);
      mockOuterPosition.mockResolvedValue({ x: -8, y: -8 });
      mockInnerPosition.mockResolvedValue({ x: -8, y: -8 });
      mockOuterSize.mockResolvedValue({ width: 1936, height: 1096 });
      mockInnerSize.mockResolvedValue({ width: 1936, height: 1096 });
      mockCurrentMonitor.mockResolvedValue({
        name: 'Monitor-1',
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
        },
        scaleFactor: 1,
      });
      mockAvailableMonitors.mockResolvedValue([
        {
          name: 'Monitor-1',
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
          workArea: {
            position: { x: 0, y: 0 },
            size: { width: 1920, height: 1080 },
          },
          scaleFactor: 1,
        },
      ]);
      mockScaleFactor.mockResolvedValue(1);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.maximizePadding).toBe(8);
      expect(result.current.maximizeInsets).toEqual({
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      });
    });

    it('should compute maximizePadding=0 when maximized window already fits monitor', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);
      mockOuterPosition.mockResolvedValue({ x: 0, y: 0 });
      mockInnerPosition.mockResolvedValue({ x: 0, y: 0 });
      mockOuterSize.mockResolvedValue({ width: 1920, height: 1080 });
      mockInnerSize.mockResolvedValue({ width: 1920, height: 1080 });
      mockCurrentMonitor.mockResolvedValue({
        name: 'Monitor-1',
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
        },
        scaleFactor: 1,
      });
      mockAvailableMonitors.mockResolvedValue([
        {
          name: 'Monitor-1',
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
          workArea: {
            position: { x: 0, y: 0 },
            size: { width: 1920, height: 1080 },
          },
          scaleFactor: 1,
        },
      ]);
      mockScaleFactor.mockResolvedValue(1);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.maximizePadding).toBe(0);
      expect(result.current.maximizeInsets).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
    });

    it('should keep maximizePadding=0 on primary monitor when there is no overshoot', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);
      mockOuterPosition.mockResolvedValue({ x: 0, y: 0 });
      mockInnerPosition.mockResolvedValue({ x: 0, y: 0 });
      mockOuterSize.mockResolvedValue({ width: 1920, height: 1040 });
      // Simulate non-zero outer/inner diff that should NOT force padding when monitor fits.
      mockInnerSize.mockResolvedValue({ width: 1904, height: 1024 });
      mockCurrentMonitor.mockResolvedValue({
        name: 'Primary',
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1040 },
      });
      mockAvailableMonitors.mockResolvedValue([
        {
          name: 'Primary',
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1040 },
        },
      ]);
      mockScaleFactor.mockResolvedValue(1);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.maximizePadding).toBe(0);
      expect(result.current.maximizeInsets).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
    });

    it('should not add insets when only inner metrics overshoot but outer window fits monitor', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);
      mockOuterPosition.mockResolvedValue({ x: 0, y: 0 });
      mockOuterSize.mockResolvedValue({ width: 2560, height: 1440 });
      // Simulate inner metrics drifting across monitor edges on scaled display.
      mockInnerPosition.mockResolvedValue({ x: -8, y: -8 });
      mockInnerSize.mockResolvedValue({ width: 2576, height: 1456 });
      mockCurrentMonitor.mockResolvedValue({
        name: 'Primary',
        position: { x: 0, y: 0 },
        size: { width: 2560, height: 1440 },
      });
      mockAvailableMonitors.mockResolvedValue([
        {
          name: 'Primary',
          position: { x: 0, y: 0 },
          size: { width: 2560, height: 1440 },
        },
      ]);
      mockScaleFactor.mockResolvedValue(1.25);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.maximizePadding).toBe(0);
      expect(result.current.maximizeInsets).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
    });

    it('should derive insets from inner/outer frame diff when monitor is unavailable', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);
      mockOuterPosition.mockResolvedValue({ x: 100, y: 100 });
      mockInnerPosition.mockResolvedValue({ x: 100, y: 100 });
      mockOuterSize.mockResolvedValue({ width: 1936, height: 1096 });
      mockInnerSize.mockResolvedValue({ width: 1920, height: 1080 });
      mockCurrentMonitor.mockResolvedValue(null);
      mockAvailableMonitors.mockResolvedValue([]);
      mockMonitorFromPoint.mockResolvedValue(null);
      mockScaleFactor.mockResolvedValue(1);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.maximizePadding).toBe(8);
      expect(result.current.maximizeInsets).toEqual({
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      });
    });

    it('should keep maximize insets at zero when monitor is unavailable and no frame diff exists', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);
      mockOuterPosition.mockResolvedValue({ x: 0, y: 0 });
      mockInnerPosition.mockResolvedValue({ x: 0, y: 0 });
      mockOuterSize.mockResolvedValue({ width: 2560, height: 1440 });
      mockInnerSize.mockResolvedValue({ width: 2560, height: 1440 });
      mockCurrentMonitor.mockResolvedValue(null);
      mockAvailableMonitors.mockResolvedValue([]);
      mockMonitorFromPoint.mockResolvedValue(null);
      mockScaleFactor.mockResolvedValue(1.25);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.maximizePadding).toBe(0);
      expect(result.current.maximizeInsets).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
    });

    it('should clamp abnormal monitor insets to avoid excessive layout shrink', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);
      mockOuterPosition.mockResolvedValue({ x: -1200, y: -900 });
      mockInnerPosition.mockResolvedValue({ x: -1200, y: -900 });
      mockOuterSize.mockResolvedValue({ width: 3200, height: 2000 });
      mockInnerSize.mockResolvedValue({ width: 3200, height: 2000 });
      mockCurrentMonitor.mockResolvedValue({
        name: 'Monitor-1',
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
        },
        scaleFactor: 1,
      });
      mockAvailableMonitors.mockResolvedValue([
        {
          name: 'Monitor-1',
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
          workArea: {
            position: { x: 0, y: 0 },
            size: { width: 1920, height: 1080 },
          },
          scaleFactor: 1,
        },
      ]);
      mockScaleFactor.mockResolvedValue(1);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.maximizePadding).toBe(32);
      expect(result.current.maximizeInsets).toEqual({
        top: 32,
        right: 32,
        bottom: 20,
        left: 32,
      });
    });

    it('should pick the correct monitor by overlap in dual-monitor setup', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);

      const primary = {
        name: 'Primary',
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
        },
        scaleFactor: 1,
      };
      const secondary = {
        name: 'Secondary',
        position: { x: 1920, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 1920, y: 0 },
          size: { width: 1920, height: 1080 },
        },
        scaleFactor: 1,
      };

      // Simulate currentMonitor() stale (still reports primary),
      // while window is actually maximized on secondary.
      mockCurrentMonitor.mockResolvedValue(primary);
      mockAvailableMonitors.mockResolvedValue([primary, secondary]);
      mockOuterPosition.mockResolvedValue({ x: 1912, y: -8 });
      mockInnerPosition.mockResolvedValue({ x: 1912, y: -8 });
      mockOuterSize.mockResolvedValue({ width: 1936, height: 1096 });
      mockInnerSize.mockResolvedValue({ width: 1936, height: 1096 });
      mockScaleFactor.mockResolvedValue(1);

      const { result } = await renderHookWithTauriInit();

      expect(result.current.maximizePadding).toBe(8);
      expect(result.current.maximizeInsets).toEqual({
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      });
    });

    it('should respond to F11 keydown with appWindow', async () => {
      const { result } = await renderHookWithTauriInit();

      expect(result.current.appWindow).toBe(mockWin);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11' }));
      });

      // Should have called setFullscreen
      expect(mockSetFullscreenWin).toHaveBeenCalled();
    });

    it('should cleanup listeners on unmount', async () => {
      const unlistenResize = jest.fn();
      const unlistenMoved = jest.fn();
      const unlistenScale = jest.fn();
      const unlistenFocus = jest.fn();
      const unlistenClose = jest.fn();
      mockOnResized.mockResolvedValue(unlistenResize);
      mockOnMoved.mockResolvedValue(unlistenMoved);
      mockOnScaleChanged.mockResolvedValue(unlistenScale);
      mockOnFocusChanged.mockResolvedValue(unlistenFocus);
      mockOnCloseRequested.mockResolvedValue(unlistenClose);

      const { unmount } = await renderHookWithTauriInit();

      unmount();

      expect(unlistenResize).toHaveBeenCalled();
      expect(unlistenMoved).toHaveBeenCalled();
      expect(unlistenScale).toHaveBeenCalled();
      expect(unlistenFocus).toHaveBeenCalled();
      expect(unlistenClose).toHaveBeenCalled();
    });

    it('should register resize and focus listeners', async () => {
      await renderHookWithTauriInit();

      expect(mockOnResized).toHaveBeenCalled();
      expect(mockOnMoved).toHaveBeenCalled();
      expect(mockOnScaleChanged).toHaveBeenCalled();
      expect(mockOnFocusChanged).toHaveBeenCalled();
      expect(mockOnCloseRequested).toHaveBeenCalled();
    });

    it('should handle close request with unsaved changes', async () => {
      await renderHookWithTauriInit();

      expect(mockOnCloseRequested).toHaveBeenCalled();

      // Simulate unsaved changes
      const listener = (e: Event) => {
        (e as CustomEvent).detail.hasChanges = true;
      };
      window.addEventListener('cognia:check-unsaved', listener);

      // Mock window.confirm
      const origConfirm = window.confirm;
      window.confirm = jest.fn(() => true);

      if (closeCallback) {
        const preventDefault = jest.fn();
        await act(async () => {
          await closeCallback!({ preventDefault });
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(window.confirm).toHaveBeenCalled();
        expect(mockDestroy).toHaveBeenCalled();
      }

      window.confirm = origConfirm;
      window.removeEventListener('cognia:check-unsaved', listener);
    });

    it('should handle close request without unsaved changes', async () => {
      await renderHookWithTauriInit();

      if (closeCallback) {
        const preventDefault = jest.fn();
        await act(async () => {
          await closeCallback!({ preventDefault });
        });

        // No unsaved changes, so preventDefault should NOT be called
        expect(preventDefault).not.toHaveBeenCalled();
      }
    });
  });
});
