import { renderHook, act } from '@testing-library/react';
import { usePackages } from './use-packages';

// Mock Tauri APIs
const mockPackageSearch = jest.fn();
const mockPackageInstall = jest.fn();
const mockPackageUninstall = jest.fn();
const mockPackageList = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  packageSearch: (...args: unknown[]) => mockPackageSearch(...args),
  packageInstall: (...args: unknown[]) => mockPackageInstall(...args),
  packageUninstall: (...args: unknown[]) => mockPackageUninstall(...args),
  packageList: (...args: unknown[]) => mockPackageList(...args),
}));

// Mock package store
const mockSetPackages = jest.fn();
const mockSetSearchResults = jest.fn();
const mockSetLoading = jest.fn();
const mockSetError = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockAddInstalling = jest.fn();
const mockRemoveInstalling = jest.fn();

jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: jest.fn(() => ({
    installedPackages: [],
    searchResults: [],
    bookmarkedPackages: [],
    isLoading: false,
    error: null,
    setInstalledPackages: mockSetPackages,
    setSearchResults: mockSetSearchResults,
    setLoading: mockSetLoading,
    setError: mockSetError,
    setSearchQuery: mockSetSearchQuery,
    addInstalling: mockAddInstalling,
    removeInstalling: mockRemoveInstalling,
  })),
}));

// Mock error formatter
jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => err instanceof Error ? err.message : String(err),
}));

describe('usePackages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
