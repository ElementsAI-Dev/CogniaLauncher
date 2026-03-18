import { renderHook, act } from '@testing-library/react';
import { useSettings } from './use-settings';
import { DEFAULT_SIDEBAR_ITEM_ORDER } from '@/lib/sidebar/order';
import type { AppSettings } from '@/lib/stores/settings';

// Mock Tauri APIs
const mockIsTauri = jest.fn(() => true);
const mockConfigList = jest.fn();
const mockConfigSet = jest.fn();
const mockConfigReset = jest.fn();
const mockCacheClean = jest.fn();
const mockCacheInfo = jest.fn();
const mockGetCacheSettings = jest.fn();
const mockTauriSetCacheSettings = jest.fn();
const mockCacheVerify = jest.fn();
const mockCacheRepair = jest.fn();
const mockGetPlatformInfo = jest.fn();
const mockGetCogniaDir = jest.fn();
const mockDownloadSetMaxConcurrent = jest.fn();
const mockDownloadSetSpeedLimit = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  configList: (...args: unknown[]) => mockConfigList(...args),
  configSet: (...args: unknown[]) => mockConfigSet(...args),
  configReset: (...args: unknown[]) => mockConfigReset(...args),
  cacheClean: (...args: unknown[]) => mockCacheClean(...args),
  cacheInfo: (...args: unknown[]) => mockCacheInfo(...args),
  getCacheSettings: (...args: unknown[]) => mockGetCacheSettings(...args),
  setCacheSettings: (...args: unknown[]) => mockTauriSetCacheSettings(...args),
  cacheVerify: (...args: unknown[]) => mockCacheVerify(...args),
  cacheRepair: (...args: unknown[]) => mockCacheRepair(...args),
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
const mockStoreSetCacheSettings = jest.fn();
const mockSetCacheVerification = jest.fn();
const mockSetCogniaDir = jest.fn();
const mockSetAppSettings = jest.fn();
const defaultAppSettings: AppSettings = {
  checkUpdatesOnStart: true,
  autoInstallUpdates: false,
  notifyOnUpdates: true,
  updateSourceMode: 'official',
  updateCustomEndpoints: [],
  updateFallbackToOfficial: true,
  minimizeToTray: true,
  startMinimized: false,
  autostart: false,
  trayClickBehavior: 'toggle_window',
  showNotifications: true,
  trayNotificationLevel: 'all',
  sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER],
};

const storeState = {
  config: {} as Record<string, string>,
  appSettings: defaultAppSettings,
  loading: false,
  error: null as string | null,
  platformInfo: null,
  cacheInfo: null,
  cacheSettings: null,
  cacheVerification: null,
  setConfig: mockSetConfig,
  updateConfig: mockUpdateConfig,
  setLoading: mockSetLoading,
  setError: mockSetError,
  setPlatformInfo: mockSetPlatformInfo,
  setCacheInfo: mockSetCacheInfo,
  setCacheSettings: mockStoreSetCacheSettings,
  setCacheVerification: mockSetCacheVerification,
  setCogniaDir: mockSetCogniaDir,
  setAppSettings: mockSetAppSettings,
};

const mockUseSettingsStore = jest.fn(() => storeState);

jest.mock('@/lib/stores/settings', () => ({
  useSettingsStore: Object.assign(
    () => mockUseSettingsStore(),
    {
      getState: () => storeState,
    },
  ),
}));

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockIsTauri.mockReturnValue(true);
    mockConfigSet.mockResolvedValue(undefined);
    mockDownloadSetMaxConcurrent.mockResolvedValue(undefined);
    mockDownloadSetSpeedLimit.mockResolvedValue(undefined);
    mockGetCacheSettings.mockResolvedValue({
      max_size: 100,
      max_age_days: 30,
      metadata_cache_ttl: 3600,
      auto_clean: true,
    });
    mockTauriSetCacheSettings.mockResolvedValue(undefined);
    mockCacheVerify.mockResolvedValue({ is_healthy: true, details: [] });
    mockCacheRepair.mockResolvedValue({ removed_entries: 1, recovered_entries: 0 });
    storeState.config = {};
    storeState.appSettings = {
      ...defaultAppSettings,
      sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER],
    };
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

  it('applies backend-backed app settings after fetching config in desktop runtime', async () => {
    mockConfigList.mockResolvedValue([
      ['updates.check_on_start', 'false'],
      ['tray.notification_level', 'none'],
    ]);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchConfig();
    });

    expect(mockSetAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        checkUpdatesOnStart: false,
        trayNotificationLevel: 'none',
      }),
    );
  });

  it('should update config value', async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateConfigValue('theme', 'light');
    });

    expect(mockConfigSet).toHaveBeenCalledWith('theme', 'light');
    expect(mockUpdateConfig).toHaveBeenCalledWith('theme', 'light');
  });

  it('applies app settings after desktop config updates', async () => {
    storeState.config = { 'updates.check_on_start': 'true' };
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateConfigValue('updates.check_on_start', 'false');
    });

    expect(mockSetAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        checkUpdatesOnStart: false,
      }),
    );
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

  it('skips desktop-only runtime sync and app settings updates in web runtime', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateConfigValue('general.parallel_downloads', '6');
    });

    expect(mockConfigSet).toHaveBeenCalledWith('general.parallel_downloads', '6');
    expect(mockDownloadSetMaxConcurrent).not.toHaveBeenCalled();
    expect(mockSetAppSettings).not.toHaveBeenCalled();
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

  it('surfaces config update failures', async () => {
    mockConfigSet.mockRejectedValue(new Error('save failed'));
    const { result } = renderHook(() => useSettings());

    await expect(
      act(async () => {
        await result.current.updateConfigValue('theme', 'dark');
      }),
    ).rejects.toThrow('save failed');

    expect(mockSetError).toHaveBeenCalledWith('save failed');
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

  it('surfaces reset failures', async () => {
    mockConfigReset.mockRejectedValue(new Error('reset failed'));
    const { result } = renderHook(() => useSettings());

    await expect(
      act(async () => {
        await result.current.resetConfig();
      }),
    ).rejects.toThrow('reset failed');

    expect(mockSetError).toHaveBeenCalledWith('reset failed');
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

  it('surfaces cache clean failures', async () => {
    mockCacheClean.mockRejectedValue(new Error('clean failed'));
    const { result } = renderHook(() => useSettings());

    await expect(
      act(async () => {
        await result.current.cleanCache();
      }),
    ).rejects.toThrow('clean failed');

    expect(mockSetError).toHaveBeenCalledWith('clean failed');
  });

  it('returns null when fetching cache info fails', async () => {
    mockCacheInfo.mockRejectedValue(new Error('cache info failed'));
    const { result } = renderHook(() => useSettings());

    let info = 'not-null';
    await act(async () => {
      info = await result.current.fetchCacheInfo();
    });

    expect(info).toBeNull();
    expect(mockSetError).toHaveBeenCalledWith('cache info failed');
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

  it('returns null when fetching platform info fails', async () => {
    mockGetPlatformInfo.mockRejectedValue(new Error('platform failed'));
    const { result } = renderHook(() => useSettings());

    let platform = 'not-null';
    await act(async () => {
      platform = await result.current.fetchPlatformInfo();
    });

    expect(platform).toBeNull();
    expect(mockSetError).toHaveBeenCalledWith('platform failed');
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

  it('migrates legacy desktop app settings into backend config on fetch', async () => {
    mockConfigList.mockResolvedValue([]);
    window.localStorage.setItem(
      'cognia-settings',
      JSON.stringify({
        state: {
          appSettings: {
            checkUpdatesOnStart: false,
            updateSourceMode: 'mirror',
          },
        },
      }),
    );

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchConfig();
    });

    expect(mockConfigSet).toHaveBeenCalledWith('updates.check_on_start', 'false');
    expect(mockConfigSet).toHaveBeenCalledWith('updates.source_mode', 'mirror');
    expect(window.localStorage.getItem('cognia-settings-desktop-migrated-v1')).toBe('1');
  });

  it('marks desktop migration complete when no legacy app settings are present', async () => {
    mockConfigList.mockResolvedValue([]);
    window.localStorage.removeItem('cognia-settings');
    window.localStorage.removeItem('cognia-settings-desktop-migrated-v1');

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchConfig();
    });

    expect(mockConfigSet).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('cognia-settings-desktop-migrated-v1')).toBe('1');
  });

  it('marks desktop migration complete when legacy app settings produce no backend entries', async () => {
    mockConfigList.mockResolvedValue([]);
    window.localStorage.setItem(
      'cognia-settings',
      JSON.stringify({
        state: {
          appSettings: {},
        },
      }),
    );
    window.localStorage.removeItem('cognia-settings-desktop-migrated-v1');

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchConfig();
    });

    expect(mockConfigSet).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('cognia-settings-desktop-migrated-v1')).toBe('1');
  });

  it('skips app settings migration in web runtime', async () => {
    mockIsTauri.mockReturnValue(false);
    mockConfigList.mockResolvedValue([['theme', 'dark']]);
    window.localStorage.setItem(
      'cognia-settings',
      JSON.stringify({
        appSettings: { checkUpdatesOnStart: false },
      }),
    );

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchConfig();
    });

    expect(mockConfigSet).not.toHaveBeenCalledWith('updates.check_on_start', 'false');
    expect(mockSetAppSettings).not.toHaveBeenCalled();
  });

  it('fetches cache settings and stores them', async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.fetchCacheSettings();
    });

    expect(mockGetCacheSettings).toHaveBeenCalled();
    expect(mockStoreSetCacheSettings).toHaveBeenCalledWith({
      max_size: 100,
      max_age_days: 30,
      metadata_cache_ttl: 3600,
      auto_clean: true,
    });
  });

  it('returns null when fetching cache settings fails', async () => {
    mockGetCacheSettings.mockRejectedValue(new Error('cache settings failed'));
    const { result } = renderHook(() => useSettings());

    let cacheSettings = 'not-null';
    await act(async () => {
      cacheSettings = await result.current.fetchCacheSettings();
    });

    expect(cacheSettings).toBeNull();
    expect(mockSetError).toHaveBeenCalledWith('cache settings failed');
  });

  it('updates cache settings through the backend bridge', async () => {
    const nextSettings = {
      max_size: 200,
      max_age_days: 60,
      metadata_cache_ttl: 1800,
      auto_clean: false,
    };
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateCacheSettings(nextSettings);
    });

    expect(mockTauriSetCacheSettings).toHaveBeenCalledWith(nextSettings);
    expect(mockStoreSetCacheSettings).toHaveBeenCalledWith(nextSettings);
  });

  it('surfaces cache settings update failures', async () => {
    mockTauriSetCacheSettings.mockRejectedValue(new Error('cache update failed'));
    const { result } = renderHook(() => useSettings());

    await expect(
      act(async () => {
        await result.current.updateCacheSettings({
          max_size: 200,
          max_age_days: 60,
          metadata_cache_ttl: 1800,
          auto_clean: false,
        });
      }),
    ).rejects.toThrow('cache update failed');

    expect(mockSetError).toHaveBeenCalledWith('cache update failed');
  });

  it('verifies cache integrity and stores the result', async () => {
    mockCacheVerify.mockResolvedValue({
      is_healthy: false,
      details: [{ entry_key: 'abc', issue_type: 'missing', description: 'Missing file' }],
    });
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.verifyCacheIntegrity('metadata');
    });

    expect(mockCacheVerify).toHaveBeenCalledWith('metadata');
    expect(mockSetCacheVerification).toHaveBeenCalledWith({
      is_healthy: false,
      details: [{ entry_key: 'abc', issue_type: 'missing', description: 'Missing file' }],
    });
  });

  it('surfaces cache verification failures', async () => {
    mockCacheVerify.mockRejectedValue(new Error('verify failed'));
    const { result } = renderHook(() => useSettings());

    await expect(
      act(async () => {
        await result.current.verifyCacheIntegrity();
      }),
    ).rejects.toThrow('verify failed');

    expect(mockSetError).toHaveBeenCalledWith('verify failed');
  });

  it('repairs cache and refreshes cache info', async () => {
    mockCacheInfo.mockResolvedValue({ total_size: 0, total_size_human: '0 B' });
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.repairCache('download');
    });

    expect(mockCacheRepair).toHaveBeenCalledWith('download');
    expect(mockSetCacheVerification).toHaveBeenCalledWith(null);
    expect(mockCacheInfo).toHaveBeenCalled();
  });

  it('surfaces cache repair failures', async () => {
    mockCacheRepair.mockRejectedValue(new Error('repair failed'));
    const { result } = renderHook(() => useSettings());

    await expect(
      act(async () => {
        await result.current.repairCache();
      }),
    ).rejects.toThrow('repair failed');

    expect(mockSetError).toHaveBeenCalledWith('repair failed');
  });
});
