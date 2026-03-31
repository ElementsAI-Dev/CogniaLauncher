import { act, renderHook, waitFor } from '@testing-library/react';
import { useDefaultDownloadsDetail } from './use-default-downloads-detail';

const mockIsTauri = jest.fn(() => true);
const mockCacheInfo = jest.fn();
const mockCacheCleanPreview = jest.fn();
const mockCacheCleanEnhanced = jest.fn();
const mockEmitInvalidations = jest.fn();
const mockEnsureCacheInvalidationBridge = jest.fn(() => Promise.resolve());
const mockSubscribeInvalidation = jest.fn(() => () => undefined);
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  cacheInfo: (...args: unknown[]) => mockCacheInfo(...args),
  cacheCleanPreview: (...args: unknown[]) => mockCacheCleanPreview(...args),
  cacheCleanEnhanced: (...args: unknown[]) => mockCacheCleanEnhanced(...args),
}));

jest.mock('@/lib/cache/invalidation', () => ({
  emitInvalidations: (...args: unknown[]) => mockEmitInvalidations(...args),
  ensureCacheInvalidationBridge: (...args: unknown[]) =>
    mockEnsureCacheInvalidationBridge(...args),
  subscribeInvalidation: (...args: unknown[]) => mockSubscribeInvalidation(...args),
  withThrottle: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('useDefaultDownloadsDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockCacheInfo.mockResolvedValue({
      default_downloads: {
        size: 4096,
        size_human: '4 KB',
        file_count: 3,
      },
    });
    mockCacheCleanPreview.mockResolvedValue({
      total_size: 4096,
      total_size_human: '4 KB',
      file_count: 3,
    });
    mockCacheCleanEnhanced.mockResolvedValue({
      freed_bytes: 4096,
      freed_human: '4 KB',
      use_trash: true,
    });
  });

  it('loads cache detail on mount and subscribes to invalidation refreshes', async () => {
    let invalidationHandler: (() => void) | undefined;
    mockSubscribeInvalidation.mockImplementation((_domains, handler) => {
      invalidationHandler = handler as () => void;
      return () => undefined;
    });

    const { result } = renderHook(() =>
      useDefaultDownloadsDetail({
        t: (key) => key,
      }),
    );

    await waitFor(() => {
      expect(result.current.readState.status).toBe('ready');
    });

    expect(result.current.defaultDownloads).toEqual({
      size: 4096,
      size_human: '4 KB',
      file_count: 3,
    });
    expect(mockEnsureCacheInvalidationBridge).toHaveBeenCalled();
    expect(mockSubscribeInvalidation).toHaveBeenCalledWith(
      ['cache_overview'],
      expect.any(Function),
    );

    await act(async () => {
      invalidationHandler?.();
    });

    await waitFor(() => {
      expect(mockCacheInfo).toHaveBeenCalledTimes(2);
    });
  });

  it('marks the read state as error when loading fails', async () => {
    mockCacheInfo.mockRejectedValueOnce(new Error('cache unavailable'));

    const { result } = renderHook(() =>
      useDefaultDownloadsDetail({
        t: (key) => key,
      }),
    );

    await waitFor(() => {
      expect(result.current.readState.status).toBe('error');
    });

    expect(result.current.readState.error).toContain('cache unavailable');
    expect(result.current.cacheInfo).toBeNull();
  });

  it('cleans default downloads, refreshes the view, and emits invalidations', async () => {
    const { result } = renderHook(() =>
      useDefaultDownloadsDetail({
        t: (key, params) =>
          key === 'cache.freed' ? `${key}:${params?.size as string}` : key,
      }),
    );

    await waitFor(() => {
      expect(result.current.readState.status).toBe('ready');
    });

    await act(async () => {
      result.current.setUseTrash(false);
    });

    mockCacheCleanEnhanced.mockResolvedValueOnce({
      freed_bytes: 8192,
      freed_human: '8 KB',
      use_trash: false,
    });

    await act(async () => {
      await result.current.handleClean();
    });

    expect(mockCacheCleanEnhanced).toHaveBeenCalledWith('default_downloads', false);
    expect(result.current.cleanResult).toEqual({
      freed_bytes: 8192,
      freed_human: '8 KB',
      use_trash: false,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'cache.freed:8 KB (cache.permanentlyDeleted)',
    );
    expect(mockEmitInvalidations).toHaveBeenCalledWith(
      ['cache_overview', 'about_cache_stats'],
      'cache-detail:default-downloads-clean',
    );
    expect(result.current.cleaning).toBe(false);
  });

  it('shows refresh feedback after a manual reload', async () => {
    const { result } = renderHook(() =>
      useDefaultDownloadsDetail({
        t: (key) => key,
      }),
    );

    await waitFor(() => {
      expect(result.current.readState.status).toBe('ready');
    });

    await act(async () => {
      await result.current.handleRefresh();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('cache.refreshSuccess');
    expect(mockCacheInfo).toHaveBeenCalledTimes(2);
  });

  it('announces trash-based cleanup when the backend keeps trash mode enabled', async () => {
    mockCacheCleanEnhanced.mockResolvedValueOnce({
      freed_bytes: 2048,
      freed_human: '2 KB',
      use_trash: true,
    });

    const { result } = renderHook(() =>
      useDefaultDownloadsDetail({
        t: (key, params) =>
          key === 'cache.freed' ? `${key}:${params?.size as string}` : key,
      }),
    );

    await waitFor(() => {
      expect(result.current.readState.status).toBe('ready');
    });

    await act(async () => {
      await result.current.handleClean();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('cache.freed:2 KB (cache.movedToTrash)');
  });

  it('surfaces cleanup failures through toast error feedback', async () => {
    mockCacheCleanEnhanced.mockRejectedValueOnce(new Error('permission denied'));

    const { result } = renderHook(() =>
      useDefaultDownloadsDetail({
        t: (key) => key,
      }),
    );

    await waitFor(() => {
      expect(result.current.readState.status).toBe('ready');
    });

    await act(async () => {
      await result.current.handleClean();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'cache.clearCache: Error: permission denied',
    );
    expect(result.current.cleaning).toBe(false);
  });
});
