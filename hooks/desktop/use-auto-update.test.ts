import { renderHook, act } from '@testing-library/react';
import { useAutoUpdate } from './use-auto-update';

const mockSelfCheckUpdate = jest.fn();
const mockSelfUpdate = jest.fn();
const mockListenSelfUpdateProgress = jest.fn();

let progressCallback:
  | ((event: { status: 'downloading' | 'installing' | 'done' | 'error'; progress: number | null }) => void)
  | null = null;

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  selfCheckUpdate: (...args: unknown[]) => mockSelfCheckUpdate(...args),
  selfUpdate: (...args: unknown[]) => mockSelfUpdate(...args),
  listenSelfUpdateProgress: (...args: unknown[]) => mockListenSelfUpdateProgress(...args),
}));

jest.mock('@/lib/stores/settings', () => ({
  useSettingsStore: jest.fn(() => ({
    appSettings: {
      checkUpdatesOnStart: false,
      autoInstallUpdates: false,
      notifyOnUpdates: true,
      updateSourceMode: 'official',
      updateCustomEndpoints: [],
      updateFallbackToOfficial: true,
    },
  })),
}));

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
    progressCallback = null;
    mockListenSelfUpdateProgress.mockImplementation(async (callback) => {
      progressCallback = callback as (event: {
        status: 'downloading' | 'installing' | 'done' | 'error';
        progress: number | null;
      }) => void;
      return () => {
        progressCallback = null;
      };
    });
  });

  it('returns update lifecycle state and actions', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {});

    expect(result.current).toHaveProperty('checkForUpdates');
    expect(result.current).toHaveProperty('performUpdate');
    expect(result.current).toHaveProperty('updateAvailable');
    expect(result.current).toHaveProperty('latestVersion');
    expect(result.current).toHaveProperty('checking');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('errorCategory');
    expect(result.current).toHaveProperty('progress');
  });

  it('checks updates and sets update_available status', async () => {
    mockSelfCheckUpdate.mockResolvedValue({
      current_version: '1.0.0',
      latest_version: '2.0.0',
      update_available: true,
      release_notes: 'New features',
    });
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockSelfCheckUpdate).toHaveBeenCalled();
    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.latestVersion).toBe('2.0.0');
    expect(result.current.status).toBe('update_available');
  });

  it('handles no update with up_to_date status', async () => {
    mockSelfCheckUpdate.mockResolvedValue({
      current_version: '1.0.0',
      latest_version: '1.0.0',
      update_available: false,
      release_notes: null,
    });
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.latestVersion).toBe('1.0.0');
    expect(result.current.status).toBe('up_to_date');
  });

  it('marks source diagnostic failures as error instead of up_to_date', async () => {
    mockSelfCheckUpdate.mockResolvedValue({
      current_version: '1.0.0',
      latest_version: null,
      update_available: false,
      release_notes: null,
      selected_source: null,
      attempted_sources: ['mirror', 'official'],
      error_category: 'source_unavailable',
      error_message: 'mirror unavailable',
    });
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCategory).toBe('source_unavailable_error');
  });

  it('performs update and enters installing state', async () => {
    mockSelfUpdate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.performUpdate();
    });

    expect(mockSelfUpdate).toHaveBeenCalled();
    expect(result.current.status).toBe('installing');
  });

  it('handles check error with categorized error state', async () => {
    const error = new Error('Network error');
    mockSelfCheckUpdate.mockRejectedValue(error);
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.errorCategory).toBe('network_error');
    expect(result.current.status).toBe('error');
  });

  it('sets checking state during update check', async () => {
    mockSelfCheckUpdate.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                current_version: '1.0.0',
                latest_version: '1.0.0',
                update_available: false,
                release_notes: null,
              }),
            100,
          ),
        ),
    );
    const { result } = renderHook(() => useAutoUpdate());

    act(() => {
      result.current.checkForUpdates();
    });

    expect(result.current.checking).toBe(true);
    expect(result.current.status).toBe('checking');
  });

  it('reacts to self-update progress events from shared lifecycle listener', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {});

    act(() => {
      progressCallback?.({ status: 'downloading', progress: 42 });
    });

    expect(result.current.status).toBe('downloading');
    expect(result.current.progress).toBe(42);

    act(() => {
      progressCallback?.({ status: 'done', progress: null });
    });

    expect(result.current.status).toBe('done');
    expect(result.current.progress).toBe(100);
  });
});
