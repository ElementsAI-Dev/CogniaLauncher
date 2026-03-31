import { renderHook } from '@testing-library/react';
import { useGlobalShortcuts } from './use-global-shortcuts';
import { isTauri } from '@/lib/platform';
import { useSettings } from '@/hooks/settings/use-settings';

jest.mock('@/lib/platform', () => ({
  isTauri: jest.fn(() => false),
}));

const mockIsTauri = jest.mocked(isTauri);

jest.mock('@/hooks/settings/use-settings', () => ({
  useSettings: jest.fn(() => ({
    config: {
      'shortcuts.enabled': 'true',
      'shortcuts.toggle_window': 'CmdOrCtrl+Shift+Space',
      'shortcuts.command_palette': 'CmdOrCtrl+Shift+K',
      'shortcuts.quick_search': 'CmdOrCtrl+Shift+F',
    },
    fetchConfig: jest.fn(),
  })),
}));

const mockUseSettings = jest.mocked(useSettings);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRegister = jest.fn<any, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUnregister = jest.fn<any, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockIsRegistered = jest.fn<any, any>(() => Promise.resolve(false));

jest.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: (...args: unknown[]) => mockRegister(...args),
  unregister: (...args: unknown[]) => mockUnregister(...args),
  isRegistered: (...args: unknown[]) => mockIsRegistered(...args),
  unregisterAll: jest.fn(),
}));

describe('useGlobalShortcuts', () => {
  const defaultCallbacks = {
    onToggleWindow: jest.fn(() => Promise.resolve()),
    onCommandPalette: jest.fn(),
    onQuickSearch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  it('does nothing in non-Tauri environment', () => {
    renderHook(() => useGlobalShortcuts(defaultCallbacks));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers shortcuts in Tauri environment', async () => {
    mockIsTauri.mockReturnValue(true);

    renderHook(() => useGlobalShortcuts(defaultCallbacks));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockRegister).toHaveBeenCalledTimes(3);
  });

  it('does not register when shortcuts are disabled', async () => {
    mockIsTauri.mockReturnValue(true);
    mockUseSettings.mockReturnValue({
      config: {
        'shortcuts.enabled': 'false',
        'shortcuts.toggle_window': 'CmdOrCtrl+Shift+Space',
        'shortcuts.command_palette': 'CmdOrCtrl+Shift+K',
        'shortcuts.quick_search': 'CmdOrCtrl+Shift+F',
      },
      fetchConfig: jest.fn(),
    } as unknown as ReturnType<typeof useSettings>);

    renderHook(() => useGlobalShortcuts(defaultCallbacks));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('skips registration when shortcut is already registered', async () => {
    mockIsTauri.mockReturnValue(true);
    mockUseSettings.mockReturnValue({
      config: {
        'shortcuts.enabled': 'true',
        'shortcuts.toggle_window': 'CmdOrCtrl+Shift+Space',
        'shortcuts.command_palette': '',
        'shortcuts.quick_search': '',
      },
      fetchConfig: jest.fn(),
    } as unknown as ReturnType<typeof useSettings>);

    mockIsRegistered.mockResolvedValue(true);

    renderHook(() => useGlobalShortcuts(defaultCallbacks));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('does not register when all shortcut keys are empty', async () => {
    mockIsTauri.mockReturnValue(true);
    mockUseSettings.mockReturnValue({
      config: {
        'shortcuts.enabled': 'true',
        'shortcuts.toggle_window': '',
        'shortcuts.command_palette': '',
        'shortcuts.quick_search': '',
      },
      fetchConfig: jest.fn(),
    } as unknown as ReturnType<typeof useSettings>);

    renderHook(() => useGlobalShortcuts(defaultCallbacks));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('only registers non-empty shortcuts', async () => {
    mockIsTauri.mockReturnValue(true);
    mockUseSettings.mockReturnValue({
      config: {
        'shortcuts.enabled': 'true',
        'shortcuts.toggle_window': 'CmdOrCtrl+Shift+Space',
        'shortcuts.command_palette': '',
        'shortcuts.quick_search': '',
      },
      fetchConfig: jest.fn(),
    } as unknown as ReturnType<typeof useSettings>);

    mockIsRegistered.mockResolvedValue(false);

    renderHook(() => useGlobalShortcuts(defaultCallbacks));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister.mock.calls[0][0]).toBe('CmdOrCtrl+Shift+Space');
  });

  it('handles registration error gracefully', async () => {
    mockIsTauri.mockReturnValue(true);
    mockUseSettings.mockReturnValue({
      config: {
        'shortcuts.enabled': 'true',
        'shortcuts.toggle_window': 'InvalidShortcut',
        'shortcuts.command_palette': '',
        'shortcuts.quick_search': '',
      },
      fetchConfig: jest.fn(),
    } as unknown as ReturnType<typeof useSettings>);

    mockIsRegistered.mockResolvedValue(false);
    mockRegister.mockRejectedValue(new Error('Invalid shortcut format'));

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    renderHook(() => useGlobalShortcuts(defaultCallbacks));

    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[global-shortcut] Failed to register'),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });

  it('passes the correct shortcut string to register', async () => {
    mockIsTauri.mockReturnValue(true);
    mockUseSettings.mockReturnValue({
      config: {
        'shortcuts.enabled': 'true',
        'shortcuts.toggle_window': 'Alt+Space',
        'shortcuts.command_palette': 'CmdOrCtrl+Shift+P',
        'shortcuts.quick_search': '',
      },
      fetchConfig: jest.fn(),
    } as unknown as ReturnType<typeof useSettings>);

    mockIsRegistered.mockResolvedValue(false);

    renderHook(() => useGlobalShortcuts(defaultCallbacks));

    await new Promise((r) => setTimeout(r, 100));

    expect(mockRegister).toHaveBeenCalledTimes(2);
    const registeredKeys = mockRegister.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(registeredKeys).toContain('Alt+Space');
    expect(registeredKeys).toContain('CmdOrCtrl+Shift+P');
  });
});
