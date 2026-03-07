import { renderHook, act } from '@testing-library/react';
import { usePackages } from './use-packages';

// Mock Tauri APIs
const mockPackageSearch = jest.fn();
const mockPackageInstall = jest.fn();
const mockPackageUninstall = jest.fn();
const mockPackageList = jest.fn();
const mockProviderList = jest.fn();
const mockGetPinnedPackages = jest.fn();
const mockPluginDispatchEvent = jest.fn(() => Promise.resolve());

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  packageSearch: (...args: Parameters<typeof mockPackageSearch>) => mockPackageSearch(...args),
  packageInstall: (...args: Parameters<typeof mockPackageInstall>) => mockPackageInstall(...args),
  packageUninstall: (...args: Parameters<typeof mockPackageUninstall>) => mockPackageUninstall(...args),
  packageList: (...args: Parameters<typeof mockPackageList>) => mockPackageList(...args),
  providerList: (...args: Parameters<typeof mockProviderList>) => mockProviderList(...args),
  getPinnedPackages: (...args: Parameters<typeof mockGetPinnedPackages>) => mockGetPinnedPackages(...args),
  pluginDispatchEvent: (...args: Parameters<typeof mockPluginDispatchEvent>) => mockPluginDispatchEvent(...args),
}));

// Mock package store
const mockSetPackages = jest.fn();
const mockSetSearchResults = jest.fn();
const mockSetLoading = jest.fn();
const mockSetError = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockAddInstalling = jest.fn();
const mockRemoveInstalling = jest.fn();
const mockSetLastScanTimestamp = jest.fn();
const mockIsScanFresh = jest.fn(() => false);
const mockSetProviders = jest.fn();
const mockSetPinnedPackages = jest.fn();

interface MockInstalledPackage {
  name: string;
  version: string;
  [key: string]: unknown;
}

interface MockProvider {
  id: string;
  display_name?: string;
  [key: string]: unknown;
}

interface MockStoreState {
  installedPackages: MockInstalledPackage[];
  searchResults: unknown[];
  bookmarkedPackages: string[];
  providers: MockProvider[];
  pinnedPackages: string[];
  isLoading: boolean;
  error: string | null;
}

const mockStoreState: MockStoreState = {
  installedPackages: [],
  searchResults: [],
  bookmarkedPackages: [],
  providers: [],
  pinnedPackages: [],
  isLoading: false,
  error: null,
};

const mockStoreActions = {
  setInstalledPackages: (packages: MockInstalledPackage[]) => {
    mockSetPackages(packages);
    mockStoreState.installedPackages = packages ?? [];
  },
  setSearchResults: (results: unknown[]) => {
    mockSetSearchResults(results);
    mockStoreState.searchResults = results ?? [];
  },
  setLoading: (...args: unknown[]) => mockSetLoading(...args),
  setError: (...args: unknown[]) => mockSetError(...args),
  setSearchQuery: (...args: unknown[]) => mockSetSearchQuery(...args),
  addInstalling: (...args: unknown[]) => mockAddInstalling(...args),
  removeInstalling: (...args: unknown[]) => mockRemoveInstalling(...args),
  setLastScanTimestamp: (...args: unknown[]) => mockSetLastScanTimestamp(...args),
  isScanFresh: mockIsScanFresh,
  setProviders: (providers: MockProvider[]) => {
    mockSetProviders(providers);
    mockStoreState.providers = providers ?? [];
  },
  setPinnedPackages: (pinnedPackages: string[]) => {
    mockSetPinnedPackages(pinnedPackages);
    mockStoreState.pinnedPackages = pinnedPackages ?? [];
  },
};

jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: Object.assign(
    jest.fn((selector?: (state: Record<string, unknown>) => unknown) => {
      const fullState = { ...mockStoreState, ...mockStoreActions };
      if (typeof selector === 'function') {
        return selector(fullState);
      }
      return fullState;
    }),
    {
      getState: () => ({ ...mockStoreState, ...mockStoreActions }),
    },
  ),
}));

// Mock error formatter
jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => err instanceof Error ? err.message : String(err),
}));

describe('usePackages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.installedPackages = [];
    mockStoreState.searchResults = [];
    mockStoreState.bookmarkedPackages = [];
    mockStoreState.providers = [];
    mockStoreState.pinnedPackages = [];
    mockStoreState.isLoading = false;
    mockStoreState.error = null;
    mockIsScanFresh.mockReturnValue(false);
  });

  it('should return package methods', () => {
    const { result } = renderHook(() => usePackages());

    expect(result.current).toHaveProperty('searchPackages');
    expect(result.current).toHaveProperty('installPackages');
    expect(result.current).toHaveProperty('uninstallPackages');
    expect(result.current).toHaveProperty('fetchInstalledPackages');
  });

  it('should search packages', async () => {
    const results = [
      { name: 'react', version: '18.0.0', description: 'React library' },
    ];
    mockPackageSearch.mockResolvedValue(results);
    const { result } = renderHook(() => usePackages());

    await act(async () => {
      await result.current.searchPackages('react');
    });

    expect(mockPackageSearch).toHaveBeenCalledWith('react', undefined);
    expect(mockSetSearchResults).toHaveBeenCalledWith(results);
  });

  it('should install packages', async () => {
    mockPackageInstall.mockResolvedValue([]);
    mockPackageList.mockResolvedValue([]);
    const { result } = renderHook(() => usePackages());

    await act(async () => {
      await result.current.installPackages(['react']);
    });

    expect(mockPackageInstall).toHaveBeenCalledWith(['react']);
  });

  it('should uninstall packages', async () => {
    mockPackageUninstall.mockResolvedValue(undefined);
    mockPackageList.mockResolvedValue([]);
    const { result } = renderHook(() => usePackages());

    await act(async () => {
      await result.current.uninstallPackages(['react']);
    });

    expect(mockPackageUninstall).toHaveBeenCalledWith(['react']);
  });

  it('should fetch installed packages', async () => {
    const packages = [
      { name: 'react', version: '18.0.0' },
      { name: 'typescript', version: '5.0.0' },
    ];
    mockPackageList.mockResolvedValue(packages);
    const { result } = renderHook(() => usePackages());

    await act(async () => {
      await result.current.fetchInstalledPackages();
    });

    expect(mockPackageList).toHaveBeenCalled();
    expect(mockSetPackages).toHaveBeenCalledWith(packages);
  });

  it('should use cached installed packages when scan is fresh', async () => {
    const cachedPackages = [{ name: 'cached-pkg', version: '1.0.0' }];
    mockStoreState.installedPackages = cachedPackages;
    mockIsScanFresh.mockReturnValue(true);
    const { result } = renderHook(() => usePackages());

    let returned;
    await act(async () => {
      returned = await result.current.fetchInstalledPackages();
    });

    expect(mockPackageList).not.toHaveBeenCalled();
    expect(returned).toEqual(cachedPackages);
  });

  it('should deduplicate concurrent installed package fetches', async () => {
    let resolveList!: (packages: { name: string; version: string }[]) => void;
    const listPromise = new Promise<{ name: string; version: string }[]>((resolve) => {
      resolveList = (packages) => resolve(packages);
    });
    mockPackageList.mockReturnValue(listPromise);
    const { result } = renderHook(() => usePackages());

    const p1 = result.current.fetchInstalledPackages();
    const p2 = result.current.fetchInstalledPackages();
    expect(mockPackageList).toHaveBeenCalledTimes(1);

    resolveList([{ name: 'react', version: '19.0.0' }]);
    await act(async () => {
      await Promise.all([p1, p2]);
    });
  });

  it('should cache providers between calls', async () => {
    const providers = [{ id: 'npm', display_name: 'npm' }];
    mockProviderList.mockResolvedValue(providers);
    const { result } = renderHook(() => usePackages());

    await act(async () => {
      await result.current.fetchProviders();
      await result.current.fetchProviders();
    });

    expect(mockProviderList).toHaveBeenCalledTimes(1);
  });

  it('should bypass provider cache when force refresh is requested', async () => {
    const firstProviders = [{ id: 'npm', display_name: 'npm' }];
    const refreshedProviders = [{ id: 'pip', display_name: 'pip' }];
    mockProviderList
      .mockResolvedValueOnce(firstProviders)
      .mockResolvedValueOnce(refreshedProviders);
    const { result } = renderHook(() => usePackages());

    await act(async () => {
      await result.current.fetchProviders();
    });
    await act(async () => {
      await result.current.fetchProviders(true);
    });

    expect(mockProviderList).toHaveBeenCalledTimes(2);
    expect(mockSetProviders).toHaveBeenLastCalledWith(refreshedProviders);
  });

  it('hydrates pinned packages from backend truth', async () => {
    mockGetPinnedPackages.mockResolvedValue([
      ['npm:lodash', '4.17.21'],
      ['requests', '2.0.0'],
    ]);
    const { result } = renderHook(() => usePackages());

    await act(async () => {
      await result.current.fetchPinnedPackages();
    });

    expect(mockGetPinnedPackages).toHaveBeenCalledTimes(1);
    expect(mockSetPinnedPackages).toHaveBeenCalledWith(['npm:lodash', 'requests']);
  });

  it('should handle search error', async () => {
    const error = new Error('Search failed');
    mockPackageSearch.mockRejectedValue(error);
    const { result } = renderHook(() => usePackages());

    await act(async () => {
      await result.current.searchPackages('react');
    });

    expect(mockSetError).toHaveBeenCalled();
  });

  it('should return store state', () => {
    const { result } = renderHook(() => usePackages());

    expect(result.current).toHaveProperty('installedPackages');
    expect(result.current).toHaveProperty('searchResults');
    expect(result.current).toHaveProperty('isLoading');
  });
});
