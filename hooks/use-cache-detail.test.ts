import { act, renderHook, waitFor } from '@testing-library/react';
import { useCacheDetail } from './use-cache-detail';

const mockIsTauri = jest.fn();
const mockCacheInfo = jest.fn();
const mockGetCacheAccessStats = jest.fn();
const mockListCacheEntries = jest.fn();
const mockEnsureCacheInvalidationBridge = jest.fn(() => Promise.resolve());
const mockSubscribeInvalidation = jest.fn(() => () => {});

const flushAsyncEffects = async () => {
  // Dynamic imports + mocked async calls can take multiple microtasks.
  await Promise.resolve();
  await Promise.resolve();
};

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  cacheInfo: (...args: unknown[]) => mockCacheInfo(...args),
  getCacheAccessStats: (...args: unknown[]) => mockGetCacheAccessStats(...args),
  listCacheEntries: (...args: unknown[]) => mockListCacheEntries(...args),
}));

jest.mock('@/lib/cache/invalidation', () => ({
  ensureCacheInvalidationBridge: (...args: Parameters<typeof mockEnsureCacheInvalidationBridge>) =>
    mockEnsureCacheInvalidationBridge(...args),
  subscribeInvalidation: (...args: Parameters<typeof mockSubscribeInvalidation>) =>
    mockSubscribeInvalidation(...args),
  withThrottle: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

describe('useCacheDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockCacheInfo.mockResolvedValue({
      download_cache: { entry_count: 1, size_human: '1 B' },
      metadata_cache: { entry_count: 2, size_human: '2 B' },
    });
    mockGetCacheAccessStats.mockResolvedValue({
      hit_rate: 0.5,
      hits: 1,
      misses: 1,
      total_requests: 2,
      last_reset: null,
    });
    mockListCacheEntries.mockResolvedValue({
      entries: [],
      total_count: 0,
    });
  });

  it('fetches info and entries on initialization', async () => {
    renderHook(() => useCacheDetail({ cacheType: 'download', t: (key) => key }));

    await act(async () => {
      await flushAsyncEffects();
    });

    await waitFor(() => {
      expect(mockCacheInfo).toHaveBeenCalled();
      expect(mockGetCacheAccessStats).toHaveBeenCalled();
      expect(mockListCacheEntries).toHaveBeenCalledWith(expect.objectContaining({
        entryType: 'download',
      }));
      expect(mockSubscribeInvalidation).toHaveBeenCalledTimes(1);
    });
  });

  it('refreshes with throttling when invalidation events fire', async () => {
    jest.useFakeTimers();
    try {
      let invalidationHandler: (() => void) | undefined;
      mockSubscribeInvalidation.mockImplementation((...args: unknown[]) => {
        invalidationHandler = args[1] as (() => void) | undefined;
        return () => {};
      });

      renderHook(() => useCacheDetail({ cacheType: 'metadata', t: (key) => key }));

      await act(async () => {
        await flushAsyncEffects();
      });

      await waitFor(() => {
        expect(mockSubscribeInvalidation).toHaveBeenCalledTimes(1);
      });

      mockCacheInfo.mockClear();
      mockGetCacheAccessStats.mockClear();
      mockListCacheEntries.mockClear();

      act(() => {
        invalidationHandler?.();
        invalidationHandler?.();
        invalidationHandler?.();
      });

      expect(mockCacheInfo).not.toHaveBeenCalled();
      expect(mockListCacheEntries).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(350);
        await flushAsyncEffects();
      });

      await waitFor(() => {
        expect(mockCacheInfo).toHaveBeenCalledTimes(1);
        expect(mockGetCacheAccessStats).toHaveBeenCalledTimes(1);
        expect(mockListCacheEntries).toHaveBeenCalledTimes(1);
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not initialize invalidation subscription outside tauri runtime', async () => {
    mockIsTauri.mockReturnValue(false);

    renderHook(() => useCacheDetail({ cacheType: 'download', t: (key) => key }));

    await act(async () => {});

    expect(mockCacheInfo).not.toHaveBeenCalled();
    expect(mockListCacheEntries).not.toHaveBeenCalled();
    expect(mockSubscribeInvalidation).not.toHaveBeenCalled();
  });
});
