import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettingsStore } from '../../stores/settings';

jest.mock('../../tauri', () => ({
  isTauri: jest.fn(),
  selfCheckUpdate: jest.fn(),
  selfUpdate: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

import { useAutoUpdate } from '../use-auto-update';
import * as tauri from '../../tauri';
import { toast } from 'sonner';

const mockedTauri = jest.mocked(tauri);

const mockUpdateResponse = {
  current_version: '1.0.0',
  latest_version: '1.1.0',
  update_available: true,
  release_notes: 'New features and bug fixes',
};

describe('useAutoUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedTauri.isTauri.mockReturnValue(false);
    useSettingsStore.setState({
      appSettings: {
        checkUpdatesOnStart: false,
        autoInstallUpdates: false,
        notifyOnUpdates: true,
        minimizeToTray: true,
        startMinimized: false,
        autostart: false,
        trayClickBehavior: 'toggle_window',
        showNotifications: true,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useAutoUpdate());

    expect(result.current.currentVersion).toBeNull();
    expect(result.current.latestVersion).toBeNull();
    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.releaseNotes).toBeNull();
    expect(result.current.checking).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes checkForUpdates and performUpdate functions', () => {
    const { result } = renderHook(() => useAutoUpdate());

    expect(typeof result.current.checkForUpdates).toBe('function');
    expect(typeof result.current.performUpdate).toBe('function');
  });

  it('checkForUpdates does nothing when not in Tauri', async () => {
    mockedTauri.isTauri.mockReturnValue(false);

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockedTauri.selfCheckUpdate).not.toHaveBeenCalled();
  });

  it('checkForUpdates calls selfCheckUpdate in Tauri environment', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfCheckUpdate.mockResolvedValue(mockUpdateResponse);

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockedTauri.selfCheckUpdate).toHaveBeenCalled();
    expect(result.current.currentVersion).toBe('1.0.0');
    expect(result.current.latestVersion).toBe('1.1.0');
    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.releaseNotes).toBe('New features and bug fixes');
  });

  it('shows toast when update is available and notifyOnUpdates is true', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfCheckUpdate.mockResolvedValue(mockUpdateResponse);
    useSettingsStore.setState({
      appSettings: {
        ...useSettingsStore.getState().appSettings,
        notifyOnUpdates: true,
      },
    });

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('1.1.0'),
      expect.any(Object)
    );
  });

  it('does not show toast in silent mode', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfCheckUpdate.mockResolvedValue(mockUpdateResponse);

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(toast.info).not.toHaveBeenCalled();
  });

  it('auto-installs update when autoInstallUpdates is true', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfCheckUpdate.mockResolvedValue(mockUpdateResponse);
    mockedTauri.selfUpdate.mockResolvedValue(undefined);
    useSettingsStore.setState({
      appSettings: {
        ...useSettingsStore.getState().appSettings,
        autoInstallUpdates: true,
      },
    });

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockedTauri.selfUpdate).toHaveBeenCalled();
  });

  it('handles checkForUpdates error', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfCheckUpdate.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(toast.error).toHaveBeenCalled();
  });

  it('does not show error toast in silent mode', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfCheckUpdate.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.error).toBe('Network error');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('performUpdate does nothing when not in Tauri', async () => {
    mockedTauri.isTauri.mockReturnValue(false);

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.performUpdate();
    });

    expect(mockedTauri.selfUpdate).not.toHaveBeenCalled();
  });

  it('performUpdate calls selfUpdate in Tauri environment', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfUpdate.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.performUpdate();
    });

    expect(mockedTauri.selfUpdate).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Downloading update...');
    expect(toast.success).toHaveBeenCalledWith('Update downloaded. Restart to apply.');
  });

  it('handles performUpdate error', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfUpdate.mockRejectedValue(new Error('Download failed'));

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.performUpdate();
    });

    expect(toast.error).toHaveBeenCalledWith('Update failed: Download failed');
  });

  it('checks for updates on start when enabled', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfCheckUpdate.mockResolvedValue({
      ...mockUpdateResponse,
      update_available: false,
    });
    useSettingsStore.setState({
      appSettings: {
        ...useSettingsStore.getState().appSettings,
        checkUpdatesOnStart: true,
      },
    });

    renderHook(() => useAutoUpdate());

    // Fast-forward the 3-second delay
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(mockedTauri.selfCheckUpdate).toHaveBeenCalled();
    });
  });

  it('does not check for updates on start when disabled', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    useSettingsStore.setState({
      appSettings: {
        ...useSettingsStore.getState().appSettings,
        checkUpdatesOnStart: false,
      },
    });

    renderHook(() => useAutoUpdate());

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockedTauri.selfCheckUpdate).not.toHaveBeenCalled();
  });

  it('sets checking state during update check', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    let resolvePromise: (value: typeof mockUpdateResponse) => void;
    mockedTauri.selfCheckUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { result } = renderHook(() => useAutoUpdate());

    act(() => {
      result.current.checkForUpdates();
    });

    expect(result.current.checking).toBe(true);

    await act(async () => {
      resolvePromise!({ ...mockUpdateResponse, update_available: false });
    });

    expect(result.current.checking).toBe(false);
  });

  it('handles non-Error rejection', async () => {
    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.selfCheckUpdate.mockRejectedValue('string error');

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    expect(result.current.error).toBe('string error');
  });
});
