import { renderHook, act } from '@testing-library/react';

// Mock the tauri module
jest.mock('../../tauri', () => ({
  packageSearch: jest.fn(),
  packageInfo: jest.fn(),
  packageList: jest.fn(),
  providerList: jest.fn(),
  packageInstall: jest.fn(),
  packageUninstall: jest.fn(),
  batchInstall: jest.fn(),
  batchUninstall: jest.fn(),
  checkUpdates: jest.fn(),
  packagePin: jest.fn(),
  packageUnpin: jest.fn(),
  packageRollback: jest.fn(),
  getInstallHistory: jest.fn(),
  resolveDependencies: jest.fn(),
}));

// Import after mocking
import { usePackages } from '../use-packages';
import * as tauri from '../../tauri';

const mockedTauri = jest.mocked(tauri);

describe('usePackages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('searchPackages', () => {
    it('should search packages and update store', async () => {
      const mockResults = [
        { name: 'lodash', description: 'Utility library', latest_version: '4.17.21', provider: 'npm' },
        { name: 'lodash-es', description: 'ES module version', latest_version: '4.17.21', provider: 'npm' },
      ];
      mockedTauri.packageSearch.mockResolvedValue(mockResults);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const results = await result.current.searchPackages('lodash');
        expect(results).toEqual(mockResults);
      });

      expect(tauri.packageSearch).toHaveBeenCalledWith('lodash', undefined);
    });

    it('should handle search errors gracefully', async () => {
      mockedTauri.packageSearch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const results = await result.current.searchPackages('test');
        expect(results).toEqual([]);
      });
    });

    it('should search with specific provider', async () => {
      mockedTauri.packageSearch.mockResolvedValue([]);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        await result.current.searchPackages('express', 'npm');
      });

      expect(tauri.packageSearch).toHaveBeenCalledWith('express', 'npm');
    });
  });

  describe('fetchPackageInfo', () => {
    it('should fetch package info and update selected package', async () => {
      const mockInfo = {
        name: 'lodash',
        display_name: 'Lodash',
        description: 'A modern JavaScript utility library',
        homepage: 'https://lodash.com',
        license: 'MIT',
        repository: 'https://github.com/lodash/lodash',
        versions: [{ version: '4.17.21', release_date: '2021-02-20', deprecated: false, yanked: false }],
        provider: 'npm',
      };
      mockedTauri.packageInfo.mockResolvedValue(mockInfo);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const info = await result.current.fetchPackageInfo('lodash');
        expect(info).toEqual(mockInfo);
      });

      expect(tauri.packageInfo).toHaveBeenCalledWith('lodash', undefined);
    });

    it('should handle package info errors', async () => {
      mockedTauri.packageInfo.mockRejectedValue(new Error('Package not found'));

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const info = await result.current.fetchPackageInfo('nonexistent');
        expect(info).toBeNull();
      });
    });
  });

  describe('fetchInstalledPackages', () => {
    it('should fetch installed packages', async () => {
      const mockInstalled = [
        { name: 'lodash', version: '4.17.21', provider: 'npm', install_path: '/usr/local/lib', installed_at: '2024-01-01', is_global: true },
      ];
      mockedTauri.packageList.mockResolvedValue(mockInstalled);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const packages = await result.current.fetchInstalledPackages();
        expect(packages).toEqual(mockInstalled);
      });
    });
  });

  describe('installPackages', () => {
    it('should install packages and refresh list', async () => {
      mockedTauri.packageInstall.mockResolvedValue(['lodash']);
      mockedTauri.packageList.mockResolvedValue([]);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const installed = await result.current.installPackages(['lodash']);
        expect(installed).toEqual(['lodash']);
      });

      expect(tauri.packageInstall).toHaveBeenCalledWith(['lodash']);
      expect(tauri.packageList).toHaveBeenCalled();
    });

    it('should handle install errors', async () => {
      mockedTauri.packageInstall.mockRejectedValue(new Error('Installation failed'));

      const { result } = renderHook(() => usePackages());

      await expect(
        act(async () => {
          await result.current.installPackages(['broken-package']);
        })
      ).rejects.toThrow('Installation failed');
    });
  });

  describe('uninstallPackages', () => {
    it('should uninstall packages and refresh list', async () => {
      mockedTauri.packageUninstall.mockResolvedValue(undefined);
      mockedTauri.packageList.mockResolvedValue([]);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        await result.current.uninstallPackages(['lodash']);
      });

      expect(tauri.packageUninstall).toHaveBeenCalledWith(['lodash']);
    });
  });

  describe('fetchProviders', () => {
    it('should fetch available providers', async () => {
      const mockProviders = [
        {
          id: 'npm',
          display_name: 'npm',
          capabilities: ['install'],
          platforms: ['windows', 'macos', 'linux'],
          priority: 100,
          is_environment_provider: false,
          enabled: true,
        },
        {
          id: 'cargo',
          display_name: 'Cargo',
          capabilities: ['install'],
          platforms: ['windows', 'macos', 'linux'],
          priority: 80,
          is_environment_provider: false,
          enabled: true,
        },
      ];
      mockedTauri.providerList.mockResolvedValue(mockProviders);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const providers = await result.current.fetchProviders();
        expect(providers).toEqual(mockProviders);
      });
    });
  });

  describe('checkForUpdates', () => {
    it('should check for available updates', async () => {
      const mockUpdates = [
        { name: 'lodash', current_version: '4.17.20', latest_version: '4.17.21', provider: 'npm', update_type: 'patch' },
      ];
      mockedTauri.checkUpdates.mockResolvedValue(mockUpdates);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const updates = await result.current.checkForUpdates();
        expect(updates).toEqual(mockUpdates);
      });
    });
  });

  describe('pinPackage / unpinPackage', () => {
    it('should pin a package', async () => {
      mockedTauri.packagePin.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        await result.current.pinPackage('lodash', '4.17.21');
      });

      expect(tauri.packagePin).toHaveBeenCalledWith('lodash', '4.17.21');
    });

    it('should unpin a package', async () => {
      mockedTauri.packageUnpin.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        await result.current.unpinPackage('lodash');
      });

      expect(tauri.packageUnpin).toHaveBeenCalledWith('lodash');
    });
  });

  describe('rollbackPackage', () => {
    it('should rollback a package to a specific version', async () => {
      mockedTauri.packageRollback.mockResolvedValue(undefined);
      mockedTauri.packageList.mockResolvedValue([]);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        await result.current.rollbackPackage('lodash', '4.17.20');
      });

      expect(tauri.packageRollback).toHaveBeenCalledWith('lodash', '4.17.20');
    });
  });

  describe('fetchInstallHistory', () => {
    it('should fetch installation history', async () => {
      const mockHistory = [
        { id: '1', name: 'lodash', version: '4.17.21', action: 'install', timestamp: '2024-01-01T00:00:00Z', provider: 'npm', success: true, error_message: null },
      ];
      mockedTauri.getInstallHistory.mockResolvedValue(mockHistory);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const history = await result.current.getInstallHistory(10);
        expect(history).toEqual(mockHistory);
      });

      expect(tauri.getInstallHistory).toHaveBeenCalledWith(10);
    });
  });

  describe('resolveDependencies', () => {
    it('should resolve package dependencies', async () => {
      const mockResolution = {
        packages: [{ name: 'lodash', version: '4.17.21', provider: 'npm' }],
        tree: [],
        conflicts: [],
        success: true,
        install_order: ['lodash'],
        total_packages: 1,
        total_size: null,
      };
      mockedTauri.resolveDependencies.mockResolvedValue(mockResolution);

      const { result } = renderHook(() => usePackages());

      await act(async () => {
        const resolution = await result.current.resolveDependencies('lodash');
        expect(resolution).toEqual(mockResolution);
      });
    });
  });
});
