import { renderHook, act } from '@testing-library/react';
import { useProviderDetail } from './use-provider-detail';

const mockProviderList = jest.fn();
const mockProviderCheck = jest.fn();
const mockProviderEnable = jest.fn();
const mockProviderDisable = jest.fn();
const mockPackageList = jest.fn();
const mockPackageSearch = jest.fn();
const mockPackageInstall = jest.fn();
const mockPackageUninstall = jest.fn();
const mockBatchUninstall = jest.fn();
const mockPackageInfo = jest.fn();
const mockPackageVersions = jest.fn();
const mockResolveDependencies = jest.fn();
const mockPackagePin = jest.fn();
const mockPackageUnpin = jest.fn();
const mockGetPinnedPackages = jest.fn();
const mockPackageRollback = jest.fn();
const mockGetPackageHistory = jest.fn();
const mockCheckUpdates = jest.fn();
const mockBatchUpdate = jest.fn();
const mockHealthCheckPackageManager = jest.fn();
const mockGetInstallHistory = jest.fn();
const mockEnvListProviders = jest.fn();
const mockEnvGet = jest.fn();
const mockEnvAvailableVersions = jest.fn();

jest.mock('@/lib/tauri', () => ({
  providerList: (...args: unknown[]) => mockProviderList(...args),
  providerCheck: (...args: unknown[]) => mockProviderCheck(...args),
  providerEnable: (...args: unknown[]) => mockProviderEnable(...args),
  providerDisable: (...args: unknown[]) => mockProviderDisable(...args),
  packageList: (...args: unknown[]) => mockPackageList(...args),
  packageSearch: (...args: unknown[]) => mockPackageSearch(...args),
  packageInstall: (...args: unknown[]) => mockPackageInstall(...args),
  packageUninstall: (...args: unknown[]) => mockPackageUninstall(...args),
  batchUninstall: (...args: unknown[]) => mockBatchUninstall(...args),
  packageInfo: (...args: unknown[]) => mockPackageInfo(...args),
  packageVersions: (...args: unknown[]) => mockPackageVersions(...args),
  resolveDependencies: (...args: unknown[]) => mockResolveDependencies(...args),
  packagePin: (...args: unknown[]) => mockPackagePin(...args),
  packageUnpin: (...args: unknown[]) => mockPackageUnpin(...args),
  getPinnedPackages: (...args: unknown[]) => mockGetPinnedPackages(...args),
  packageRollback: (...args: unknown[]) => mockPackageRollback(...args),
  getPackageHistory: (...args: unknown[]) => mockGetPackageHistory(...args),
  checkUpdates: (...args: unknown[]) => mockCheckUpdates(...args),
  batchUpdate: (...args: unknown[]) => mockBatchUpdate(...args),
  healthCheckPackageManager: (...args: unknown[]) => mockHealthCheckPackageManager(...args),
  getInstallHistory: (...args: unknown[]) => mockGetInstallHistory(...args),
  envListProviders: (...args: unknown[]) => mockEnvListProviders(...args),
  envGet: (...args: unknown[]) => mockEnvGet(...args),
  envAvailableVersions: (...args: unknown[]) => mockEnvAvailableVersions(...args),
}));

jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const PROVIDER_ID = 'npm';

describe('useProviderDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    expect(result.current.provider).toBeNull();
    expect(result.current.isAvailable).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.installedPackages).toEqual([]);
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.availableUpdates).toEqual([]);
    expect(result.current.healthResult).toBeNull();
    expect(result.current.installHistory).toEqual([]);
    expect(result.current.pinnedPackages).toEqual([]);
    expect(result.current.environmentInfo).toBeNull();
    expect(result.current.environmentProviderInfo).toBeNull();
    expect(result.current.availableVersions).toEqual([]);
  });

  it('should fetch provider info', async () => {
    const providerInfo = { id: PROVIDER_ID, name: 'npm', is_environment_provider: false };
    mockProviderList.mockResolvedValue([providerInfo]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let found;
    await act(async () => {
      found = await result.current.fetchProvider();
    });

    expect(found).toEqual(providerInfo);
    expect(result.current.provider).toEqual(providerInfo);
  });

  it('should set error if provider not found', async () => {
    mockProviderList.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.fetchProvider();
    });

    expect(result.current.error).toContain('not found');
  });

  it('should check availability', async () => {
    mockProviderCheck.mockResolvedValue(true);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let available;
    await act(async () => {
      available = await result.current.checkAvailability();
    });

    expect(available).toBe(true);
    expect(result.current.isAvailable).toBe(true);
    expect(mockProviderCheck).toHaveBeenCalledWith(PROVIDER_ID);
  });

  it('should handle availability check failure', async () => {
    mockProviderCheck.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let available;
    await act(async () => {
      available = await result.current.checkAvailability();
    });

    expect(available).toBe(false);
    expect(result.current.isAvailable).toBe(false);
  });

  it('should toggle provider enabled', async () => {
    mockProviderEnable.mockResolvedValue(undefined);
    mockProviderList.mockResolvedValue([{ id: PROVIDER_ID, enabled: true }]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.toggleProvider(true);
    });

    expect(mockProviderEnable).toHaveBeenCalledWith(PROVIDER_ID);
  });

  it('should toggle provider disabled', async () => {
    mockProviderDisable.mockResolvedValue(undefined);
    mockProviderList.mockResolvedValue([{ id: PROVIDER_ID, enabled: false }]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.toggleProvider(false);
    });

    expect(mockProviderDisable).toHaveBeenCalledWith(PROVIDER_ID);
  });

  it('should fetch installed packages', async () => {
    const packages = [{ name: 'express', version: '4.18.0' }];
    mockPackageList.mockResolvedValue(packages);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let fetched;
    await act(async () => {
      fetched = await result.current.fetchInstalledPackages();
    });

    expect(fetched).toEqual(packages);
    expect(result.current.installedPackages).toEqual(packages);
  });

  it('should search packages', async () => {
    const results = [{ name: 'react', description: 'UI library' }];
    mockPackageSearch.mockResolvedValue(results);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let found;
    await act(async () => {
      found = await result.current.searchPackages('react');
    });

    expect(found).toEqual(results);
    expect(result.current.searchResults).toEqual(results);
    expect(result.current.searchQuery).toBe('react');
    expect(mockPackageSearch).toHaveBeenCalledWith('react', PROVIDER_ID);
  });

  it('should clear search results for empty query', async () => {
    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let found;
    await act(async () => {
      found = await result.current.searchPackages('');
    });

    expect(found).toEqual([]);
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchQuery).toBe('');
  });

  it('should install package', async () => {
    mockPackageInstall.mockResolvedValue(undefined);
    mockPackageList.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.installPackage('express', '4.18.0');
    });

    expect(mockPackageInstall).toHaveBeenCalledWith(['npm:express@4.18.0']);
  });

  it('should install package without version', async () => {
    mockPackageInstall.mockResolvedValue(undefined);
    mockPackageList.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.installPackage('express');
    });

    expect(mockPackageInstall).toHaveBeenCalledWith(['npm:express']);
  });

  it('should uninstall package', async () => {
    mockPackageUninstall.mockResolvedValue(undefined);
    mockPackageList.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.uninstallPackage('express');
    });

    expect(mockPackageUninstall).toHaveBeenCalledWith(['npm:express']);
  });

  it('should batch uninstall packages', async () => {
    const batchResult = { success: 2, failed: 0 };
    mockBatchUninstall.mockResolvedValue(batchResult);
    mockPackageList.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let res;
    await act(async () => {
      res = await result.current.batchUninstallPackages(['express', 'lodash']);
    });

    expect(res).toEqual(batchResult);
    expect(mockBatchUninstall).toHaveBeenCalledWith(['npm:express', 'npm:lodash']);
  });

  it('should fetch package info', async () => {
    const info = { name: 'express', version: '4.18.0', description: 'Web framework' };
    mockPackageInfo.mockResolvedValue(info);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let fetched;
    await act(async () => {
      fetched = await result.current.fetchPackageInfo('express');
    });

    expect(fetched).toEqual(info);
    expect(mockPackageInfo).toHaveBeenCalledWith('express', PROVIDER_ID);
  });

  it('should fetch package versions', async () => {
    const versions = [{ version: '4.18.0' }, { version: '4.17.0' }];
    mockPackageVersions.mockResolvedValue(versions);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let fetched;
    await act(async () => {
      fetched = await result.current.fetchPackageVersions('express');
    });

    expect(fetched).toEqual(versions);
  });

  it('should resolve dependencies', async () => {
    const depResult = { packages: ['express', 'body-parser'] };
    mockResolveDependencies.mockResolvedValue(depResult);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let resolved;
    await act(async () => {
      resolved = await result.current.fetchDependencies(['express']);
    });

    expect(resolved).toEqual(depResult);
    expect(mockResolveDependencies).toHaveBeenCalledWith(['npm:express']);
  });

  it('should pin and unpin packages', async () => {
    mockPackagePin.mockResolvedValue(undefined);
    mockPackageUnpin.mockResolvedValue(undefined);
    mockGetPinnedPackages.mockResolvedValue([['express', '4.18.0']]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.pinPackage('express', '4.18.0');
    });

    expect(mockPackagePin).toHaveBeenCalledWith('express', '4.18.0');
    expect(result.current.pinnedPackages).toEqual([['express', '4.18.0']]);

    mockGetPinnedPackages.mockResolvedValue([]);

    await act(async () => {
      await result.current.unpinPackage('express');
    });

    expect(mockPackageUnpin).toHaveBeenCalledWith('express');
    expect(result.current.pinnedPackages).toEqual([]);
  });

  it('should rollback package', async () => {
    mockPackageRollback.mockResolvedValue(undefined);
    mockPackageList.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.rollbackPackage('express', '4.17.0');
    });

    expect(mockPackageRollback).toHaveBeenCalledWith('express', '4.17.0');
  });

  it('should fetch package history', async () => {
    const history = [{ action: 'install', version: '4.18.0' }];
    mockGetPackageHistory.mockResolvedValue(history);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let fetched;
    await act(async () => {
      fetched = await result.current.fetchPackageHistory('express');
    });

    expect(fetched).toEqual(history);
  });

  it('should check updates filtered by provider', async () => {
    const summary = {
      updates: [
        { name: 'express', provider: 'npm', current: '4.17.0', latest: '4.18.0' },
        { name: 'flask', provider: 'pip', current: '2.0', latest: '3.0' },
      ],
    };
    mockCheckUpdates.mockResolvedValue(summary);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let updates;
    await act(async () => {
      updates = await result.current.checkUpdates();
    });

    expect(updates).toHaveLength(1);
    expect(updates![0].name).toBe('express');
    expect(result.current.availableUpdates).toHaveLength(1);
  });

  it('should update package', async () => {
    const updateResult = { success: 1 };
    mockBatchUpdate.mockResolvedValue(updateResult);
    mockPackageList.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let res;
    await act(async () => {
      res = await result.current.updatePackage('express');
    });

    expect(res).toEqual(updateResult);
    expect(mockBatchUpdate).toHaveBeenCalledWith(['npm:express']);
  });

  it('should update all packages', async () => {
    const updateResult = { success: 2 };
    mockBatchUpdate.mockResolvedValue(updateResult);
    mockPackageList.mockResolvedValue([]);
    mockCheckUpdates.mockResolvedValue({ updates: [] });

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let res;
    await act(async () => {
      res = await result.current.updateAllPackages(['express', 'lodash']);
    });

    expect(res).toEqual(updateResult);
    expect(mockBatchUpdate).toHaveBeenCalledWith(['npm:express', 'npm:lodash']);
  });

  it('should run health check', async () => {
    const health = { status: 'healthy', checks: [] };
    mockHealthCheckPackageManager.mockResolvedValue(health);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let res;
    await act(async () => {
      res = await result.current.runHealthCheck();
    });

    expect(res).toEqual(health);
    expect(result.current.healthResult).toEqual(health);
    expect(mockHealthCheckPackageManager).toHaveBeenCalledWith(PROVIDER_ID);
  });

  it('should fetch history filtered by provider', async () => {
    const history = [
      { provider: 'npm', action: 'install', name: 'express' },
      { provider: 'pip', action: 'install', name: 'flask' },
    ];
    mockGetInstallHistory.mockResolvedValue(history);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let fetched;
    await act(async () => {
      fetched = await result.current.fetchHistory();
    });

    expect(fetched).toHaveLength(1);
    expect(fetched![0].name).toBe('express');
  });

  it('should fetch environment info for env provider', async () => {
    const envProviders = [{ id: 'npm', env_type: 'node' }];
    const envInfo = { version: '18.0.0', path: '/nvm/18' };
    const versions = [{ version: '18.0.0' }, { version: '20.0.0' }];

    mockEnvListProviders.mockResolvedValue(envProviders);
    mockEnvGet.mockResolvedValue(envInfo);
    mockEnvAvailableVersions.mockResolvedValue(versions);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.fetchEnvironmentInfo();
    });

    expect(result.current.environmentProviderInfo).toEqual(envProviders[0]);
    expect(result.current.environmentInfo).toEqual(envInfo);
    expect(result.current.availableVersions).toEqual(versions);
  });

  it('should handle non-env provider in fetchEnvironmentInfo', async () => {
    mockEnvListProviders.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.fetchEnvironmentInfo();
    });

    expect(result.current.environmentProviderInfo).toBeNull();
    expect(result.current.environmentInfo).toBeNull();
  });

  it('should initialize all data', async () => {
    const providerInfo = { id: PROVIDER_ID, name: 'npm', is_environment_provider: false };
    mockProviderList.mockResolvedValue([providerInfo]);
    mockProviderCheck.mockResolvedValue(true);
    mockPackageList.mockResolvedValue([]);
    mockHealthCheckPackageManager.mockResolvedValue(null);
    mockGetInstallHistory.mockResolvedValue([]);
    mockCheckUpdates.mockResolvedValue({ updates: [] });
    mockGetPinnedPackages.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.provider).toEqual(providerInfo);
    expect(result.current.isAvailable).toBe(true);
  });

  it('should not initialize twice (init guard)', async () => {
    const providerInfo = { id: PROVIDER_ID, name: 'npm', is_environment_provider: false };
    mockProviderList.mockResolvedValue([providerInfo]);
    mockProviderCheck.mockResolvedValue(true);
    mockPackageList.mockResolvedValue([]);
    mockHealthCheckPackageManager.mockResolvedValue(null);
    mockGetInstallHistory.mockResolvedValue([]);
    mockCheckUpdates.mockResolvedValue({ updates: [] });
    mockGetPinnedPackages.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.initialize();
    });

    const callCount = mockProviderList.mock.calls.length;

    await act(async () => {
      await result.current.initialize();
    });

    // Should not call again
    expect(mockProviderList.mock.calls.length).toBe(callCount);
  });

  it('should refreshAll bypass init guard', async () => {
    const providerInfo = { id: PROVIDER_ID, name: 'npm', is_environment_provider: false };
    mockProviderList.mockResolvedValue([providerInfo]);
    mockProviderCheck.mockResolvedValue(true);
    mockPackageList.mockResolvedValue([]);
    mockHealthCheckPackageManager.mockResolvedValue(null);
    mockGetInstallHistory.mockResolvedValue([]);
    mockCheckUpdates.mockResolvedValue({ updates: [] });
    mockGetPinnedPackages.mockResolvedValue([]);

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(mockProviderList).toHaveBeenCalled();
    expect(mockProviderCheck).toHaveBeenCalled();
  });

  it('should handle error in fetchInstalledPackages', async () => {
    mockPackageList.mockRejectedValue(new Error('List failed'));

    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    let packages;
    await act(async () => {
      packages = await result.current.fetchInstalledPackages();
    });

    expect(packages).toEqual([]);
    expect(result.current.error).toBe('List failed');
  });

  it('should set and clear error and searchQuery', () => {
    const { result } = renderHook(() => useProviderDetail(PROVIDER_ID));

    act(() => {
      result.current.setError('test error');
    });
    expect(result.current.error).toBe('test error');

    act(() => {
      result.current.setError(null);
    });
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.setSearchQuery('react');
    });
    expect(result.current.searchQuery).toBe('react');
  });
});
