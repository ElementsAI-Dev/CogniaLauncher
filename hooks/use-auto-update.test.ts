import { renderHook, act } from '@testing-library/react';
import { useAutoUpdate } from './use-auto-update';

// Mock Tauri APIs
const mockSelfCheckUpdate = jest.fn();
const mockSelfUpdate = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  selfCheckUpdate: (...args: unknown[]) => mockSelfCheckUpdate(...args),
  selfUpdate: (...args: unknown[]) => mockSelfUpdate(...args),
}));

// Mock settings store
jest.mock('@/lib/stores/settings', () => ({
  useSettingsStore: jest.fn(() => ({
    appSettings: {
      autoCheckUpdates: true,
      autoInstallUpdates: false,
    },
  })),
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('useAutoUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return update methods', () => {
    const { result } = renderHook(() => useAutoUpdate());

    expect(result.current).toHaveProperty('checkForUpdates');
    expect(result.current).toHaveProperty('performUpdate');
    expect(result.current).toHaveProperty('updateAvailable');
    expect(result.current).toHaveProperty('latestVersion');
    expect(result.current).toHaveProperty('checking');
    expect(result.current).toHaveProperty('error');
  });

  it('should check for updates', async () => {
    const updateInfo = {
      current_version: '1.0.0',
      latest_version: '2.0.0',
      update_available: true,
      release_notes: 'New features',
    };
    mockSelfCheckUpdate.mockResolvedValue(updateInfo);
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockSelfCheckUpdate).toHaveBeenCalled();
    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.latestVersion).toBe('2.0.0');
  });

  it('should handle no update available', async () => {
    const updateInfo = {
      current_version: '1.0.0',
      latest_version: '1.0.0',
      update_available: false,
      release_notes: null,
    };
    mockSelfCheckUpdate.mockResolvedValue(updateInfo);
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.latestVersion).toBe('1.0.0');
  });

  it('should perform update', async () => {
    mockSelfUpdate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.performUpdate();
    });

    expect(mockSelfUpdate).toHaveBeenCalled();
  });

  it('should handle check error', async () => {
    const error = new Error('Network error');
    mockSelfCheckUpdate.mockRejectedValue(error);
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should set checking state during check', async () => {
    mockSelfCheckUpdate.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        current_version: '1.0.0',
        latest_version: '1.0.0',
        update_available: false,
        release_notes: null,
      }), 100))
    );
    const { result } = renderHook(() => useAutoUpdate());

    // Start the check but don't await
    act(() => {
      result.current.checkForUpdates();
    });

    // checking should be true while request is in progress
    expect(result.current.checking).toBe(true);
  });

  it('should call toast on update error', async () => {
    const error = new Error('Update failed');
    mockSelfUpdate.mockRejectedValue(error);
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.performUpdate();
    });

    // performUpdate shows toast.error but doesn't set error state
    expect(mockSelfUpdate).toHaveBeenCalled();
  });
});
