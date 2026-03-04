import { act, renderHook, waitFor } from '@testing-library/react';
import { useExternalCache } from './use-external-cache';

const mockIsTauri = jest.fn();
const mockDiscoverExternalCachesFast = jest.fn();
const mockCalculateExternalCacheSize = jest.fn();
const mockGetExternalCachePaths = jest.fn();
const mockEnsureCacheInvalidationBridge = jest.fn(() => Promise.resolve());
const mockSubscribeInvalidation = jest.fn(() => () => {});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const makeFastCache = (provider: string, sizePending = true) => ({
  provider,
  displayName: `${provider} cache`,
  cachePath: `/tmp/${provider}`,
  size: 0,
  sizeHuman: '0 B',
  isAvailable: true,
  canClean: false,
  category: 'package_manager',
  sizePending,
});

const flushAsyncEffects = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  discoverExternalCachesFast: (...args: unknown[]) => mockDiscoverExternalCachesFast(...args),
  calculateExternalCacheSize: (...args: unknown[]) => mockCalculateExternalCacheSize(...args),
  getExternalCachePaths: (...args: unknown[]) => mockGetExternalCachePaths(...args),
}));

jest.mock('@/lib/cache/invalidation', () => ({
  ensureCacheInvalidationBridge: (...args: Parameters<typeof mockEnsureCacheInvalidationBridge>) =>
    mockEnsureCacheInvalidationBridge(...args),
  subscribeInvalidation: (...args: Parameters<typeof mockSubscribeInvalidation>) =>
    mockSubscribeInvalidation(...args),
  withThrottle: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  emitInvalidations: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('useExternalCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockDiscoverExternalCachesFast.mockResolvedValue([makeFastCache('npm')]);
    mockCalculateExternalCacheSize.mockResolvedValue(512);
    mockGetExternalCachePaths.mockResolvedValue([]);
  });

  it('coalesces overlapping fetch calls into one in-flight request', async () => {
    const discovery = deferred<ReturnType<typeof makeFastCache>[]>();
    mockDiscoverExternalCachesFast.mockReturnValueOnce(discovery.promise);

    const { result } = renderHook(() =>
      useExternalCache({
        t: (key) => key,
      }),
    );

    let p1: Promise<void> | undefined;
    let p2: Promise<void> | undefined;

    await act(async () => {
      p1 = result.current.fetchExternalCaches();
      p2 = result.current.fetchExternalCaches();
      await flushAsyncEffects();
    });

    expect(mockDiscoverExternalCachesFast).toHaveBeenCalledTimes(1);

    await act(async () => {
      discovery.resolve([makeFastCache('npm')]);
      await Promise.all([p1, p2]);
      await flushAsyncEffects();
    });

    await waitFor(() => {
      expect(mockCalculateExternalCacheSize).toHaveBeenCalledTimes(1);
      expect(result.current.caches[0]?.provider).toBe('npm');
      expect(result.current.caches[0]?.sizePending).toBe(false);
    });
  });

  it('runs a new wave only after the current in-flight refresh completes', async () => {
    const firstDiscovery = deferred<ReturnType<typeof makeFastCache>[]>();
    mockDiscoverExternalCachesFast
      .mockReturnValueOnce(firstDiscovery.promise)
      .mockResolvedValueOnce([makeFastCache('pnpm')]);

    const { result } = renderHook(() =>
      useExternalCache({
        t: (key) => key,
      }),
    );

    let p1: Promise<void> | undefined;
    let p2: Promise<void> | undefined;

    await act(async () => {
      p1 = result.current.fetchExternalCaches();
      p2 = result.current.fetchExternalCaches();
      await flushAsyncEffects();
    });

    expect(mockDiscoverExternalCachesFast).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstDiscovery.resolve([makeFastCache('npm')]);
      await Promise.all([p1, p2]);
      await flushAsyncEffects();
    });

    await act(async () => {
      await result.current.fetchExternalCaches();
      await flushAsyncEffects();
    });

    expect(mockDiscoverExternalCachesFast).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(result.current.caches[0]?.provider).toBe('pnpm');
    });
  });

  it('keeps pending states visible while background size hydration is running', async () => {
    const sizeDeferred = deferred<number>();
    mockCalculateExternalCacheSize.mockReturnValueOnce(sizeDeferred.promise);
    mockDiscoverExternalCachesFast.mockResolvedValueOnce([makeFastCache('npm', true)]);

    const { result } = renderHook(() =>
      useExternalCache({
        t: (key) => key,
      }),
    );

    let fetchPromise: Promise<void> | undefined;
    await act(async () => {
      fetchPromise = result.current.fetchExternalCaches();
      await flushAsyncEffects();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.caches[0]?.provider).toBe('npm');
      expect(result.current.caches[0]?.sizePending).toBe(true);
    });

    await act(async () => {
      sizeDeferred.resolve(1024);
      await fetchPromise;
      await flushAsyncEffects();
    });

    await waitFor(() => {
      expect(result.current.caches[0]?.sizePending).toBe(false);
      expect(result.current.caches[0]?.size).toBe(1024);
    });
  });

  it('ignores stale path info updates from older refresh waves', async () => {
    const firstPathInfos = deferred<Array<{ provider: string; hasCleanCommand: boolean }>>();
    mockDiscoverExternalCachesFast
      .mockResolvedValueOnce([makeFastCache('npm')])
      .mockResolvedValueOnce([makeFastCache('pnpm')]);
    mockGetExternalCachePaths
      .mockReturnValueOnce(firstPathInfos.promise)
      .mockResolvedValueOnce([{ provider: 'pnpm', hasCleanCommand: true }]);

    const { result } = renderHook(() =>
      useExternalCache({
        t: (key) => key,
        includePathInfos: true,
      }),
    );

    await act(async () => {
      await result.current.fetchExternalCaches();
      await result.current.fetchExternalCaches();
      await flushAsyncEffects();
    });

    await act(async () => {
      firstPathInfos.resolve([{ provider: 'npm', hasCleanCommand: true }]);
      await flushAsyncEffects();
    });

    await waitFor(() => {
      expect(result.current.caches[0]?.provider).toBe('pnpm');
      expect(result.current.pathInfos[0]?.provider).toBe('pnpm');
    });
  });
});
