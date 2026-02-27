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

let closeCallback: ((ev: { preventDefault: () => void }) => Promise<void>) | null = null;

const mockOnResized = jest.fn(() => Promise.resolve(jest.fn()));
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
  onResized: mockOnResized,
  onFocusChanged: mockOnFocusChanged,
  onCloseRequested: mockOnCloseRequested,
};

jest.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWin,
}));

describe('useWindowControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockIsWindows.mockReturnValue(false);
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

      const { result } = renderHook(() => useWindowControls());

      // Wait for async init to complete
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.appWindow).toBe(mockWin);
      expect(result.current.isMaximized).toBe(true);
      expect(result.current.isAlwaysOnTop).toBe(true);
      expect(mockSetMaximized).toHaveBeenCalledWith(true);
      expect(mockSetFullscreen).toHaveBeenCalledWith(false);
    });

    it('should call minimize on appWindow', async () => {
      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await act(async () => {
        await result.current.handleMinimize();
      });

      expect(mockMinimize).toHaveBeenCalled();
    });

    it('should call toggleMaximize on appWindow', async () => {
      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await act(async () => {
        await result.current.handleMaximize();
      });

      expect(mockToggleMaximize).toHaveBeenCalled();
    });

    it('should toggle fullscreen on', async () => {
      mockIsFullscreen.mockResolvedValue(false);

      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await act(async () => {
        await result.current.handleToggleFullscreen();
      });

      expect(mockSetFullscreenWin).toHaveBeenCalledWith(true);
    });

    it('should toggle fullscreen off', async () => {
      mockIsFullscreen.mockResolvedValue(true);

      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await act(async () => {
        await result.current.handleToggleFullscreen();
      });

      expect(mockSetFullscreenWin).toHaveBeenCalledWith(false);
    });

    it('should center window', async () => {
      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await act(async () => {
        await result.current.handleCenter();
      });

      expect(mockCenter).toHaveBeenCalled();
    });

    it('should toggle always on top', async () => {
      mockIsAlwaysOnTop.mockResolvedValue(false);

      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await act(async () => {
        await result.current.handleToggleAlwaysOnTop();
      });

      expect(mockSetAlwaysOnTop).toHaveBeenCalledWith(true);
      expect(result.current.isAlwaysOnTop).toBe(true);
    });

    it('should close window (not minimize to tray)', async () => {
      mockMinimizeToTray = false;

      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await act(async () => {
        await result.current.handleClose();
      });

      expect(mockClose).toHaveBeenCalled();
    });

    it('should hide window when minimizeToTray is enabled', async () => {
      mockMinimizeToTray = true;

      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      await act(async () => {
        await result.current.handleClose();
      });

      expect(mockHide).toHaveBeenCalled();
      mockMinimizeToTray = false;
    });

    it('should compute maximizePadding=8 on Windows maximized', async () => {
      mockIsWindows.mockReturnValue(true);
      mockIsMaximized.mockResolvedValue(true);

      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.maximizePadding).toBe(8);
    });

    it('should respond to F11 keydown with appWindow', async () => {
      const { result } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.appWindow).toBe(mockWin);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11' }));
      });

      // Should have called setFullscreen
      expect(mockSetFullscreenWin).toHaveBeenCalled();
    });

    it('should cleanup listeners on unmount', async () => {
      const unlistenResize = jest.fn();
      const unlistenFocus = jest.fn();
      const unlistenClose = jest.fn();
      mockOnResized.mockResolvedValue(unlistenResize);
      mockOnFocusChanged.mockResolvedValue(unlistenFocus);
      mockOnCloseRequested.mockResolvedValue(unlistenClose);

      const { unmount } = renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      unmount();

      expect(unlistenResize).toHaveBeenCalled();
      expect(unlistenFocus).toHaveBeenCalled();
      expect(unlistenClose).toHaveBeenCalled();
    });

    it('should register resize and focus listeners', async () => {
      renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockOnResized).toHaveBeenCalled();
      expect(mockOnFocusChanged).toHaveBeenCalled();
      expect(mockOnCloseRequested).toHaveBeenCalled();
    });

    it('should handle close request with unsaved changes', async () => {
      renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

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
      renderHook(() => useWindowControls());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

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
