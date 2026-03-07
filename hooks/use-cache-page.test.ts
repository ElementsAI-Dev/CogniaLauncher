import { act, renderHook, waitFor } from '@testing-library/react';
import { useCachePage } from './use-cache-page';

const mockFetchCacheInfo = jest.fn();
const mockFetchPlatformInfo = jest.fn();
const mockFetchCacheSettings = jest.fn();
const mockCleanCache = jest.fn();
const mockVerifyCacheIntegrity = jest.fn();
const mockRepairCache = jest.fn();
const mockUpdateCacheSettings = jest.fn();

const mockIsTauri = jest.fn(() => true);
const mockGetCacheAccessStats = jest.fn();
const mockGetTopAccessedEntries = jest.fn();
const mockListCacheEntries = jest.fn();
const mockDeleteCacheEntries = jest.fn();
const mockCacheCleanPreview = jest.fn();
const mockCacheCleanEnhanced = jest.fn();
const mockCacheForceClean = jest.fn();
const mockCacheOptimize = jest.fn();
const mockDbGetInfo = jest.fn();
const mockResetCacheAccessStats = jest.fn();
const mockGetCleanupHistory = jest.fn();
const mockGetCleanupSummary = jest.fn();
const mockClearCleanupHistory = jest.fn();

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
const mockToastWarning = jest.fn();
const mockEmitInvalidations = jest.fn();
const mockSubscribeInvalidation = jest.fn(() => () => {});
const mockSettingsState = {
  cacheInfo: { total_size: 1024, max_size: 4096, usage_percent: 25 },
  cacheSettings: { max_size: 4096, retention_days: 7 },
  cacheVerification: { missing_files: 0, corrupted_files: 0, size_mismatches: 0 },
  loading: false,
  error: null,
  cogniaDir: '/tmp/cognia',
  fetchCacheInfo: mockFetchCacheInfo,
  fetchPlatformInfo: mockFetchPlatformInfo,
  fetchCacheSettings: mockFetchCacheSettings,
  cleanCache: mockCleanCache,
  verifyCacheIntegrity: mockVerifyCacheIntegrity,
  repairCache: mockRepairCache,
  updateCacheSettings: mockUpdateCacheSettings,
};

jest.mock('@/hooks/use-settings', () => ({
  useSettings: () => mockSettingsState,
}));

jest.mock('@/hooks/use-mobile', () => ({
  useDebounce: (v: string) => v,
}));

jest.mock('@/lib/cache/invalidation', () => ({
  ensureCacheInvalidationBridge: jest.fn(() => Promise.resolve()),
  subscribeInvalidation: (...args: unknown[]) => mockSubscribeInvalidation(...args),
  withThrottle: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  emitInvalidations: (...args: unknown[]) => mockEmitInvalidations(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  getCacheAccessStats: (...args: unknown[]) => mockGetCacheAccessStats(...args),
  getTopAccessedEntries: (...args: unknown[]) => mockGetTopAccessedEntries(...args),
  listCacheEntries: (...args: unknown[]) => mockListCacheEntries(...args),
  deleteCacheEntries: (...args: unknown[]) => mockDeleteCacheEntries(...args),
  cacheCleanPreview: (...args: unknown[]) => mockCacheCleanPreview(...args),
  cacheCleanEnhanced: (...args: unknown[]) => mockCacheCleanEnhanced(...args),
  cacheForceClean: (...args: unknown[]) => mockCacheForceClean(...args),
  cacheOptimize: (...args: unknown[]) => mockCacheOptimize(...args),
  dbGetInfo: (...args: unknown[]) => mockDbGetInfo(...args),
  resetCacheAccessStats: (...args: unknown[]) => mockResetCacheAccessStats(...args),
  getCleanupHistory: (...args: unknown[]) => mockGetCleanupHistory(...args),
  getCleanupSummary: (...args: unknown[]) => mockGetCleanupSummary(...args),
  clearCleanupHistory: (...args: unknown[]) => mockClearCleanupHistory(...args),
}));

describe('useCachePage', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${Object.values(params).join(',')}` : key;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchCacheInfo.mockResolvedValue(true);
    mockFetchPlatformInfo.mockResolvedValue(undefined);
    mockFetchCacheSettings.mockResolvedValue(undefined);
    mockCleanCache.mockResolvedValue({ freed_human: '10 MB' });
    mockVerifyCacheIntegrity.mockResolvedValue({
      is_healthy: true,
      missing_files: 0,
      corrupted_files: 0,
      size_mismatches: 0,
    });
    mockRepairCache.mockResolvedValue({ removed_entries: 1, recovered_entries: 1, freed_human: '5 MB' });
    mockUpdateCacheSettings.mockResolvedValue(undefined);
    mockGetCacheAccessStats.mockResolvedValue({ hits: 1, misses: 0, hit_rate: 1 });
    mockGetTopAccessedEntries.mockResolvedValue([]);
    mockListCacheEntries.mockResolvedValue({ entries: [], total_count: 0 });
    mockDeleteCacheEntries.mockResolvedValue(2);
    mockCacheCleanPreview.mockResolvedValue({ estimated_freed_human: '5 MB' });
    mockCacheCleanEnhanced.mockResolvedValue({ freed_human: '5 MB' });
    mockCacheForceClean.mockResolvedValue({ deleted_count: 2, freed_human: '8 MB' });
    mockCacheOptimize.mockResolvedValue({ sizeSaved: 1024, sizeSavedHuman: '1 KB' });
    mockDbGetInfo.mockResolvedValue({ path: '/tmp/db.sqlite' });
    mockResetCacheAccessStats.mockResolvedValue(undefined);
    mockGetCleanupHistory.mockResolvedValue([]);
    mockGetCleanupSummary.mockResolvedValue(null);
    mockClearCleanupHistory.mockResolvedValue(3);
  });

  it('loads overview state on mount and exposes computed fields', async () => {
    const { result } = renderHook(() => useCachePage({ t }));
    await waitFor(() => expect(mockFetchPlatformInfo).toHaveBeenCalled());
    await waitFor(() => expect(mockGetCacheAccessStats).toHaveBeenCalled());
    expect(result.current.usagePercent).toBe(25);
    expect(result.current.maxSize).toBe(4096);
  });

  it('cleans cache and emits invalidation', async () => {
    const { result } = renderHook(() => useCachePage({ t }));
    await act(async () => {
      await result.current.handleClean('all');
    });
    expect(mockCleanCache).toHaveBeenCalledWith('all');
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockEmitInvalidations).toHaveBeenCalled();
  });

  it('previews and performs enhanced clean with selection deletion path', async () => {
    const { result } = renderHook(() => useCachePage({ t }));

    await act(async () => {
      await result.current.handlePreview('all');
    });
    expect(result.current.previewOpen).toBe(true);
    expect(mockCacheCleanPreview).toHaveBeenCalledWith('all');

    await act(async () => {
      await result.current.handleEnhancedClean();
    });
    expect(mockCacheCleanEnhanced).toHaveBeenCalled();

    act(() => {
      result.current.setBrowserSelectedKeys(new Set(['a', 'b']));
    });
    await act(async () => {
      await result.current.handleDeleteSelectedEntries();
    });
    expect(mockDeleteCacheEntries).toHaveBeenCalledWith(['a', 'b'], true);
  });

  it('verifies and repairs the global cache scope from overview actions', async () => {
    const { result } = renderHook(() => useCachePage({ t }));

    await act(async () => {
      await result.current.handleVerify();
    });
    expect(mockVerifyCacheIntegrity).toHaveBeenCalledWith('all');

    await act(async () => {
      await result.current.handleRepair();
    });
    expect(mockRepairCache).toHaveBeenCalledWith('all');
  });

  it('refreshes and emits invalidation after optimize completes', async () => {
    const { result } = renderHook(() => useCachePage({ t }));
    await waitFor(() => expect(mockFetchCacheInfo).toHaveBeenCalled());
    const baselineFetches = mockFetchCacheInfo.mock.calls.length;

    await act(async () => {
      await result.current.handleOptimize();
    });

    expect(mockCacheOptimize).toHaveBeenCalled();
    expect(mockFetchCacheInfo.mock.calls.length).toBeGreaterThan(baselineFetches);
    expect(mockEmitInvalidations).toHaveBeenCalledWith(
      ['cache_overview', 'cache_entries', 'about_cache_stats'],
      'cache-page:optimize',
    );
  });
});
