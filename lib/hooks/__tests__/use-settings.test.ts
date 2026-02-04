import { renderHook, act } from '@testing-library/react';
import { useSettingsStore } from '../../stores/settings';

jest.mock('../../tauri', () => ({
  configList: jest.fn(),
  configSet: jest.fn(),
  configReset: jest.fn(),
  cacheInfo: jest.fn(),
  cacheClean: jest.fn(),
  cacheVerify: jest.fn(),
  cacheRepair: jest.fn(),
  getPlatformInfo: jest.fn(),
  getCogniaDir: jest.fn(),
  getCacheSettings: jest.fn(),
  setCacheSettings: jest.fn(),
}));

import { useSettings } from '../use-settings';
import * as tauri from '../../tauri';

const mockedTauri = jest.mocked(tauri);

const mockPlatformInfo = {
  os: 'windows',
  arch: 'x86_64',
  version: '10.0.19041',
};

const mockCacheInfo = {
  download_cache: {
    entry_count: 5,
    size: 512000,
    size_human: '500 KB',
    location: '/cache/downloads',
  },
  metadata_cache: {
    entry_count: 5,
    size: 512000,
    size_human: '500 KB',
    location: '/cache/metadata',
  },
  total_size: 1024000,
  total_size_human: '1 MB',
};

const mockCacheSettings = {
  max_size: 5000000000,
  max_age_days: 30,
  metadata_cache_ttl: 3600,
  auto_clean: true,
};

const mockCacheVerification = {
  valid_entries: 8,
  missing_files: 1,
  corrupted_files: 1,
  size_mismatches: 0,
  is_healthy: false,
  details: [],
};

const defaultStoreState = {
  config: {},
  cacheInfo: null,
  cacheSettings: null,
  cacheVerification: null,
  platformInfo: null,
  cogniaDir: null,
  loading: false,
  error: null,
  appSettings: {
    checkUpdatesOnStart: true,
    autoInstallUpdates: false,
    notifyOnUpdates: true,
    minimizeToTray: true,
    startMinimized: false,
    autostart: false,
    trayClickBehavior: 'toggle_window' as const,
    showNotifications: true,
  },
};

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState(defaultStoreState);
  });

  describe('fetchConfig', () => {
    it('fetches config from tauri and updates store', async () => {
      mockedTauri.configList.mockResolvedValue([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.fetchConfig();
      });

      expect(mockedTauri.configList).toHaveBeenCalled();
      expect(useSettingsStore.getState().config).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: [string, string][]) => void;
      mockedTauri.configList.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.fetchConfig();
      });

      expect(useSettingsStore.getState().loading).toBe(true);

      await act(async () => {
        resolvePromise!([]);
      });

      expect(useSettingsStore.getState().loading).toBe(false);
    });

    it('handles fetch error', async () => {
      mockedTauri.configList.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.fetchConfig();
      });

      expect(useSettingsStore.getState().error).toBe('Network error');
    });
  });

  describe('updateConfigValue', () => {
    it('updates config value via tauri', async () => {
      mockedTauri.configSet.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.updateConfigValue('test.key', 'test-value');
      });

      expect(mockedTauri.configSet).toHaveBeenCalledWith('test.key', 'test-value');
      expect(useSettingsStore.getState().config['test.key']).toBe('test-value');
    });

    it('handles update error', async () => {
      mockedTauri.configSet.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useSettings());

      await expect(
        act(async () => {
          await result.current.updateConfigValue('test.key', 'test-value');
        })
      ).rejects.toThrow('Update failed');

      expect(useSettingsStore.getState().error).toBe('Update failed');
    });
  });

  describe('resetConfig', () => {
    it('resets config and refetches', async () => {
      mockedTauri.configReset.mockResolvedValue(undefined);
      mockedTauri.configList.mockResolvedValue([['default.key', 'default-value']]);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.resetConfig();
      });

      expect(mockedTauri.configReset).toHaveBeenCalled();
      expect(mockedTauri.configList).toHaveBeenCalled();
    });

    it('handles reset error', async () => {
      mockedTauri.configReset.mockRejectedValue(new Error('Reset failed'));

      const { result } = renderHook(() => useSettings());

      await expect(
        act(async () => {
          await result.current.resetConfig();
        })
      ).rejects.toThrow('Reset failed');

      expect(useSettingsStore.getState().error).toBe('Reset failed');
    });
  });

  describe('fetchCacheInfo', () => {
    it('fetches cache info and updates store', async () => {
      mockedTauri.cacheInfo.mockResolvedValue(mockCacheInfo);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.fetchCacheInfo();
      });

      expect(mockedTauri.cacheInfo).toHaveBeenCalled();
      expect(useSettingsStore.getState().cacheInfo).toEqual(mockCacheInfo);
    });

    it('handles fetch error', async () => {
      mockedTauri.cacheInfo.mockRejectedValue(new Error('Cache error'));

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.fetchCacheInfo();
      });

      expect(useSettingsStore.getState().error).toBe('Cache error');
    });
  });

  describe('cleanCache', () => {
    it('cleans cache and refreshes info', async () => {
      mockedTauri.cacheClean.mockResolvedValue({ freed_bytes: 1024, freed_human: '1 KB' });
      mockedTauri.cacheInfo.mockResolvedValue(mockCacheInfo);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.cleanCache('all');
      });

      expect(mockedTauri.cacheClean).toHaveBeenCalledWith('all');
      expect(mockedTauri.cacheInfo).toHaveBeenCalled();
    });

    it('handles clean error', async () => {
      mockedTauri.cacheClean.mockRejectedValue(new Error('Clean failed'));

      const { result } = renderHook(() => useSettings());

      await expect(
        act(async () => {
          await result.current.cleanCache();
        })
      ).rejects.toThrow('Clean failed');
    });
  });

  describe('fetchPlatformInfo', () => {
    it('fetches platform info and cognia dir', async () => {
      mockedTauri.getPlatformInfo.mockResolvedValue(mockPlatformInfo);
      mockedTauri.getCogniaDir.mockResolvedValue('/home/user/.cognia');

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.fetchPlatformInfo();
      });

      expect(mockedTauri.getPlatformInfo).toHaveBeenCalled();
      expect(mockedTauri.getCogniaDir).toHaveBeenCalled();
      expect(useSettingsStore.getState().platformInfo).toEqual(mockPlatformInfo);
      expect(useSettingsStore.getState().cogniaDir).toBe('/home/user/.cognia');
    });

    it('handles fetch error', async () => {
      mockedTauri.getPlatformInfo.mockRejectedValue(new Error('Platform error'));

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.fetchPlatformInfo();
      });

      expect(useSettingsStore.getState().error).toBe('Platform error');
    });
  });

  describe('fetchCacheSettings', () => {
    it('fetches cache settings', async () => {
      mockedTauri.getCacheSettings.mockResolvedValue(mockCacheSettings);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.fetchCacheSettings();
      });

      expect(mockedTauri.getCacheSettings).toHaveBeenCalled();
      expect(useSettingsStore.getState().cacheSettings).toEqual(mockCacheSettings);
    });

    it('handles fetch error', async () => {
      mockedTauri.getCacheSettings.mockRejectedValue(new Error('Settings error'));

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.fetchCacheSettings();
      });

      expect(useSettingsStore.getState().error).toBe('Settings error');
    });
  });

  describe('updateCacheSettings', () => {
    it('updates cache settings', async () => {
      mockedTauri.setCacheSettings.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.updateCacheSettings(mockCacheSettings);
      });

      expect(mockedTauri.setCacheSettings).toHaveBeenCalledWith(mockCacheSettings);
      expect(useSettingsStore.getState().cacheSettings).toEqual(mockCacheSettings);
    });

    it('handles update error', async () => {
      mockedTauri.setCacheSettings.mockRejectedValue(new Error('Update error'));

      const { result } = renderHook(() => useSettings());

      await expect(
        act(async () => {
          await result.current.updateCacheSettings(mockCacheSettings);
        })
      ).rejects.toThrow('Update error');
    });
  });

  describe('verifyCacheIntegrity', () => {
    it('verifies cache integrity', async () => {
      mockedTauri.cacheVerify.mockResolvedValue(mockCacheVerification);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.verifyCacheIntegrity();
      });

      expect(mockedTauri.cacheVerify).toHaveBeenCalled();
      expect(useSettingsStore.getState().cacheVerification).toEqual(mockCacheVerification);
    });

    it('handles verify error', async () => {
      mockedTauri.cacheVerify.mockRejectedValue(new Error('Verify error'));

      const { result } = renderHook(() => useSettings());

      await expect(
        act(async () => {
          await result.current.verifyCacheIntegrity();
        })
      ).rejects.toThrow('Verify error');
    });
  });

  describe('repairCache', () => {
    it('repairs cache and refreshes info', async () => {
      mockedTauri.cacheRepair.mockResolvedValue({
        removed_entries: 2,
        recovered_entries: 0,
        freed_bytes: 1024,
        freed_human: '1 KB',
      });
      mockedTauri.cacheInfo.mockResolvedValue(mockCacheInfo);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.repairCache();
      });

      expect(mockedTauri.cacheRepair).toHaveBeenCalled();
      expect(mockedTauri.cacheInfo).toHaveBeenCalled();
      expect(useSettingsStore.getState().cacheVerification).toBeNull();
    });

    it('handles repair error', async () => {
      mockedTauri.cacheRepair.mockRejectedValue(new Error('Repair error'));

      const { result } = renderHook(() => useSettings());

      await expect(
        act(async () => {
          await result.current.repairCache();
        })
      ).rejects.toThrow('Repair error');
    });
  });

  it('exposes store state', () => {
    useSettingsStore.setState({ config: { foo: 'bar' }, loading: true });

    const { result } = renderHook(() => useSettings());

    expect(result.current.config).toEqual({ foo: 'bar' });
    expect(result.current.loading).toBe(true);
  });
});
