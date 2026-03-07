import { renderHook, act } from '@testing-library/react';
import { useSettings } from './use-settings';

// Mock Tauri APIs
const mockConfigList = jest.fn();
const mockConfigSet = jest.fn();
const mockConfigReset = jest.fn();
const mockCacheClean = jest.fn();
const mockCacheInfo = jest.fn();
const mockGetPlatformInfo = jest.fn();
const mockGetCogniaDir = jest.fn();
const mockDownloadSetMaxConcurrent = jest.fn();
const mockDownloadSetSpeedLimit = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  configList: (...args: unknown[]) => mockConfigList(...args),
  configSet: (...args: unknown[]) => mockConfigSet(...args),
  configReset: (...args: unknown[]) => mockConfigReset(...args),
  cacheClean: (...args: unknown[]) => mockCacheClean(...args),
  cacheInfo: (...args: unknown[]) => mockCacheInfo(...args),
  getPlatformInfo: (...args: unknown[]) => mockGetPlatformInfo(...args),
  getCogniaDir: (...args: unknown[]) => mockGetCogniaDir(...args),
  downloadSetMaxConcurrent: (...args: unknown[]) => mockDownloadSetMaxConcurrent(...args),
  downloadSetSpeedLimit: (...args: unknown[]) => mockDownloadSetSpeedLimit(...args),
}));

// Mock settings store
const mockSetConfig = jest.fn();
const mockUpdateConfig = jest.fn();
const mockSetLoading = jest.fn();
const mockSetError = jest.fn();
const mockSetPlatformInfo = jest.fn();
const mockSetCacheInfo = jest.fn();
const mockSetCogniaDir = jest.fn();
const mockSetAppSettings = jest.fn();
const mockUseSettingsStore = jest.fn(() => ({
  config: {},
  appSettings: {},
  isLoading: false,
  error: null,
  platformInfo: null,
  cacheInfo: null,
  setConfig: mockSetConfig,
  updateConfig: mockUpdateConfig,
  setLoading: mockSetLoading,
  setError: mockSetError,
  setPlatformInfo: mockSetPlatformInfo,
  setCacheInfo: mockSetCacheInfo,
  setCogniaDir: mockSetCogniaDir,
  setAppSettings: mockSetAppSettings,
}));

(mockUseSettingsStore as unknown as { getState?: () => unknown }).getState = jest.fn(() => ({
  config: {},
  appSettings: {},
  setAppSettings: mockSetAppSettings,
}));

jest.mock('@/lib/stores/settings', () => ({
  useSettingsStore: Object.assign(
    () => mockUseSettingsStore(),
    {
      getState: () =>
        (mockUseSettingsStore as unknown as { getState: () => unknown }).getState(),
    },
  ),
}));

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigSet.mockResolvedValue(undefined);
    mockDownloadSetMaxConcurrent.mockResolvedValue(undefined);
    mockDownloadSetSpeedLimit.mockResolvedValue(undefined);
  });

  it('should return settings methods', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current).toHaveProperty('fetchConfig');
    expect(result.current).toHaveProperty('updateConfigValue');
    expect(result.current).toHaveProperty('resetConfig');
    expect(result.current).toHaveProperty('cleanCache');
    expect(result.current).toHaveProperty('fetchPlatformInfo');
  });

  it('should fetch config', async () => {
    const configList = [['theme', 'dark'], ['language', 'en']];
    mockConfigList.mockResolvedValue(configList);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchConfig();
    });

    expect(mockConfigList).toHaveBeenCalled();
    expect(mockSetConfig).toHaveBeenCalledWith({ theme: 'dark', language: 'en' });
  });

  it('should update config value', async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateConfigValue('theme', 'light');
    });

    expect(mockConfigSet).toHaveBeenCalledWith('theme', 'light');
    expect(mockUpdateConfig).toHaveBeenCalledWith('theme', 'light');
  });

  it('normalizes appearance values before config persistence', async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateConfigValue('appearance.interface_radius', '0.74');
    });

    expect(mockConfigSet).toHaveBeenCalledWith('appearance.interface_radius', '0.75');
    expect(mockUpdateConfig).toHaveBeenCalledWith('appearance.interface_radius', '0.75');
  });

  it('should sync max concurrent downloads when parallel_downloads changes', async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateConfigValue('general.parallel_downloads', '6');
    });

    expect(mockConfigSet).toHaveBeenCalledWith('general.parallel_downloads', '6');
    expect(mockDownloadSetMaxConcurrent).toHaveBeenCalledWith(6);
  });

  it('should sync speed limit when download_speed_limit changes', async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateConfigValue('general.download_speed_limit', '1048576');
    });

    expect(mockConfigSet).toHaveBeenCalledWith('general.download_speed_limit', '1048576');
    expect(mockDownloadSetSpeedLimit).toHaveBeenCalledWith(1048576);
  });

  it('should throw for invalid parallel_downloads runtime value', async () => {
    const { result } = renderHook(() => useSettings());

    await expect(
      act(async () => {
        await result.current.updateConfigValue('general.parallel_downloads', 'invalid');
      })
    ).rejects.toThrow('Invalid value for general.parallel_downloads');

    expect(mockConfigSet).toHaveBeenCalledWith('general.parallel_downloads', 'invalid');
    expect(mockDownloadSetMaxConcurrent).not.toHaveBeenCalled();
  });

  it('should reset config', async () => {
    mockConfigReset.mockResolvedValue(undefined);
    mockConfigList.mockResolvedValue([]);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.resetConfig();
    });

    expect(mockConfigReset).toHaveBeenCalled();
  });

  it('should clean cache', async () => {
    const cleanResult = { freed: 1024, items: 5 };
    mockCacheClean.mockResolvedValue(cleanResult);
    mockCacheInfo.mockResolvedValue({ size: 0, items: 0 });
    const { result } = renderHook(() => useSettings());

    let cleaned;
    await act(async () => {
      cleaned = await result.current.cleanCache();
    });

    expect(mockCacheClean).toHaveBeenCalled();
    expect(cleaned).toEqual(cleanResult);
  });

  it('should fetch platform info', async () => {
    const platformData = { os: 'windows', arch: 'x64' };
    const cogniaDir = '/path/to/cognia';
    mockGetPlatformInfo.mockResolvedValue(platformData);
    mockGetCogniaDir.mockResolvedValue(cogniaDir);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchPlatformInfo();
    });

    expect(mockGetPlatformInfo).toHaveBeenCalled();
    expect(mockSetPlatformInfo).toHaveBeenCalledWith(platformData);
  });

  it('should handle fetch config error', async () => {
    const error = new Error('Config fetch failed');
    mockConfigList.mockRejectedValue(error);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchConfig();
    });

    expect(mockSetError).toHaveBeenCalled();
  });
});
