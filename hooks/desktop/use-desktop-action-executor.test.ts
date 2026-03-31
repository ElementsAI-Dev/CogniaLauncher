import { act, renderHook } from '@testing-library/react';
import { useDesktopActionExecutor } from './use-desktop-action-executor';

const mockPush = jest.fn();
const mockToggleDrawer = jest.fn();
const mockOpenDialog = jest.fn();
const mockExecuteDesktopAction = jest.fn();
const mockIsTauri = jest.fn(() => true);
const mockWindowIsVisible = jest.fn();
const mockWindowShow = jest.fn();
const mockWindowSetFocus = jest.fn();
const mockWslLaunch = jest.fn();
const mockWslShutdown = jest.fn();
const mockWslOpenInTerminal = jest.fn();
let mockWslState = {
  status: { defaultDistribution: "Ubuntu" },
  distros: [{ name: "Ubuntu", isDefault: true }],
  launch: mockWslLaunch,
  shutdown: mockWslShutdown,
  openInTerminal: mockWslOpenInTerminal,
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/lib/stores/feedback', () => ({
  useFeedbackStore: () => ({
    openDialog: mockOpenDialog,
  }),
}));

jest.mock('@/lib/stores/log', () => ({
  useLogStore: () => ({
    toggleDrawer: mockToggleDrawer,
  }),
}));

jest.mock('@/lib/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/desktop-actions', () => ({
  executeDesktopAction: (...args: unknown[]) => mockExecuteDesktopAction(...args),
}));

jest.mock('@/hooks/wsl/use-wsl', () => ({
  useWsl: () => mockWslState,
}));

jest.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isVisible: (...args: unknown[]) => mockWindowIsVisible(...args),
    show: (...args: unknown[]) => mockWindowShow(...args),
    setFocus: (...args: unknown[]) => mockWindowSetFocus(...args),
  }),
}));

describe('useDesktopActionExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockWindowIsVisible.mockResolvedValue(false);
    mockWindowShow.mockResolvedValue(undefined);
    mockWindowSetFocus.mockResolvedValue(undefined);
    mockExecuteDesktopAction.mockResolvedValue(true);
    mockWslLaunch.mockResolvedValue(undefined);
    mockWslShutdown.mockResolvedValue(undefined);
    mockWslOpenInTerminal.mockResolvedValue(undefined);
    mockWslState = {
      status: { defaultDistribution: "Ubuntu" },
      distros: [{ name: "Ubuntu", isDefault: true }],
      launch: mockWslLaunch,
      shutdown: mockWslShutdown,
      openInTerminal: mockWslOpenInTerminal,
    };
  });

  it('forwards the action id and runtime callbacks to executeDesktopAction', async () => {
    const openCommandPalette = jest.fn();
    const openQuickSearch = jest.fn();
    const toggleWindow = jest.fn().mockResolvedValue(undefined);

    mockExecuteDesktopAction.mockImplementation(async (_actionId, context) => {
      context.navigate('/downloads');
      context.toggleLogs?.();
      context.openFeedback?.({ category: 'bug' });
      context.openCommandPalette?.();
      context.openQuickSearch?.();
      await context.toggleWindow?.();
      return true;
    });

    const { result } = renderHook(() =>
      useDesktopActionExecutor({
        openCommandPalette,
        openQuickSearch,
        toggleWindow,
      }),
    );

    let handled;
    await act(async () => {
      handled = await result.current('report_bug');
    });

    expect(handled).toBe(true);
    expect(mockExecuteDesktopAction).toHaveBeenCalledWith(
      'report_bug',
      expect.objectContaining({
        navigate: expect.any(Function),
        ensureWindowVisible: expect.any(Function),
        toggleLogs: expect.any(Function),
        openCommandPalette,
        openQuickSearch,
        toggleWindow,
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/downloads');
    expect(mockToggleDrawer).toHaveBeenCalled();
    expect(mockOpenDialog).toHaveBeenCalledWith({ category: 'bug' });
    expect(openCommandPalette).toHaveBeenCalled();
    expect(openQuickSearch).toHaveBeenCalled();
    expect(toggleWindow).toHaveBeenCalled();
  });

  it('makes the desktop window visible before focusing when tauri is active', async () => {
    mockExecuteDesktopAction.mockImplementation(async (_actionId, context) => {
      await context.ensureWindowVisible?.();
      return true;
    });

    const { result } = renderHook(() => useDesktopActionExecutor());

    await act(async () => {
      await result.current('open_settings');
    });

    expect(mockWindowIsVisible).toHaveBeenCalled();
    expect(mockWindowShow).toHaveBeenCalled();
    expect(mockWindowSetFocus).toHaveBeenCalled();
  });

  it('skips desktop window access when not running in tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    mockExecuteDesktopAction.mockImplementation(async (_actionId, context) => {
      await context.ensureWindowVisible?.();
      return true;
    });

    const { result } = renderHook(() => useDesktopActionExecutor());

    await act(async () => {
      await result.current('open_settings');
    });

    expect(mockWindowIsVisible).not.toHaveBeenCalled();
    expect(mockWindowShow).not.toHaveBeenCalled();
    expect(mockWindowSetFocus).not.toHaveBeenCalled();
  });

  it('wires WSL callbacks into executeDesktopAction and resolves them through useWsl methods', async () => {
    mockExecuteDesktopAction.mockImplementation(async (_actionId, context) => {
      await context.wslLaunchDefault?.();
      await context.wslShutdownAll?.();
      await context.wslOpenTerminal?.();
      return true;
    });

    const { result } = renderHook(() => useDesktopActionExecutor());

    await act(async () => {
      await result.current('wsl_launch_default');
    });

    expect(mockWslLaunch).toHaveBeenCalledWith('Ubuntu');
    expect(mockWslShutdown).toHaveBeenCalled();
    expect(mockWslOpenInTerminal).toHaveBeenCalledWith('Ubuntu');
  });
});
