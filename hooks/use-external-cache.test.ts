import { act, renderHook, waitFor } from '@testing-library/react';
import { useExternalCache } from './use-external-cache';

const mockIsTauri = jest.fn();
const mockDiscoverExternalCacheCandidates = jest.fn();
const mockProbeExternalCacheProvider = jest.fn();
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

const makeCandidate = (provider: string) => ({
  ...makeFastCache(provider, true),
  probePending: true,
  detectionState: 'skipped',
  detectionReason: 'probe_pending',
});

const makeProbed = (provider: string, sizePending = true) => ({
  ...makeFastCache(provider, sizePending),
  probePending: false,
  detectionState: 'found',
});

const flushAsyncEffects = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  discoverExternalCacheCandidates: (...args: unknown[]) =>
    mockDiscoverExternalCacheCandidates(...args),
  probeExternalCacheProvider: (...args: unknown[]) =>
    mockProbeExternalCacheProvider(...args),
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
    mockDiscoverExternalCacheCandidates.mockResolvedValue([makeCandidate('npm')]);
    mockProbeExternalCacheProvider.mockImplementation(async (provider: string) => makeProbed(provider, true));
    mockDiscoverExternalCachesFast.mockResolvedValue([makeFastCache('npm')]);
    mockCalculateExternalCacheSize.mockResolvedValue(512);
    mockGetExternalCachePaths.mockResolvedValue([]);
  });

  it('queues one follow-up wave when a refresh is requested during in-flight wave', async () => {
    const discovery = deferred<ReturnType<typeof makeCandidate>[]>();
    mockDiscoverExternalCacheCandidates
      .mockReturnValueOnce(discovery.promise)
      .mockResolvedValueOnce([makeCandidate('pnpm')]);
    mockProbeExternalCacheProvider.mockImplementation(async (provider: string) => makeProbed(provider, false));

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

    expect(mockDiscoverExternalCacheCandidates).toHaveBeenCalledTimes(1);

    await act(async () => {
      discovery.resolve([makeCandidate('npm')]);
      await Promise.all([p1, p2]);
      await flushAsyncEffects();
    });

    await waitFor(() => {
      expect(mockDiscoverExternalCacheCandidates).toHaveBeenCalledTimes(2);
      expect(result.current.caches[0]?.provider).toBe('pnpm');
    });
  });

  it('coalesces burst refresh triggers into at most one queued follow-up wave', async () => {
    const firstDiscovery = deferred<ReturnType<typeof makeCandidate>[]>();
    mockDiscoverExternalCacheCandidates
      .mockReturnValueOnce(firstDiscovery.promise)
      .mockResolvedValueOnce([makeCandidate('pnpm')]);

    const { result } = renderHook(() =>
      useExternalCache({
        t: (key) => key,
      }),
    );

    let p1: Promise<void> | undefined;
    let p2: Promise<void> | undefined;
    let p3: Promise<void> | undefined;

    await act(async () => {
      p1 = result.current.fetchExternalCaches();
      p2 = result.current.fetchExternalCaches();
      p3 = result.current.fetchExternalCaches();
      await flushAsyncEffects();
    });

    expect(mockDiscoverExternalCacheCandidates).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstDiscovery.resolve([makeCandidate('npm')]);
      await Promise.all([p1, p2, p3]);
      await flushAsyncEffects();
    });

    expect(mockDiscoverExternalCacheCandidates).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(result.current.caches[0]?.provider).toBe('pnpm');
    });
  });

  it('keeps pending states visible while background size hydration is running', async () => {
    const sizeDeferred = deferred<number>();
    mockCalculateExternalCacheSize.mockReturnValueOnce(sizeDeferred.promise);
    mockDiscoverExternalCacheCandidates.mockResolvedValueOnce([makeCandidate('npm')]);
    mockProbeExternalCacheProvider.mockResolvedValueOnce(makeProbed('npm', true));

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
      expect(result.current.caches[0]?.probePending).toBe(false);
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

  it('marks provider as error when progressive size calculation fails', async () => {
    mockDiscoverExternalCacheCandidates.mockResolvedValueOnce([makeCandidate('npm')]);
    mockProbeExternalCacheProvider.mockResolvedValueOnce(makeProbed('npm', true));
    mockCalculateExternalCacheSize.mockRejectedValueOnce(new Error('size scan failed'));

    const { result } = renderHook(() =>
      useExternalCache({
        t: (key) => key,
      }),
    );

    await act(async () => {
      await result.current.fetchExternalCaches();
      await flushAsyncEffects();
    });

    await waitFor(() => {
      expect(result.current.caches[0]?.provider).toBe('npm');
      expect(result.current.caches[0]?.sizePending).toBe(false);
      expect(result.current.caches[0]?.detectionState).toBe('error');
      expect(result.current.caches[0]?.detectionError).toContain('size scan failed');
    });
  });

  it('shows completed providers while others remain probe-pending', async () => {
    const slowProbe = deferred<ReturnType<typeof makeProbed>>();
    mockDiscoverExternalCacheCandidates.mockResolvedValueOnce([
      makeCandidate('npm'),
      makeCandidate('pnpm'),
    ]);
    mockProbeExternalCacheProvider.mockImplementation((provider: string) => {
      if (provider === 'pnpm') {
        return slowProbe.promise;
      }
      return Promise.resolve(makeProbed(provider, true));
    });
    mockCalculateExternalCacheSize.mockResolvedValue(256);

    const { result } = renderHook(() =>
      useExternalCache({
        t: (key) => key,
      }),
    );

    await act(async () => {
      void result.current.fetchExternalCaches();
      await flushAsyncEffects();
    });

    await waitFor(() => {
      const npm = result.current.caches.find((cache) => cache.provider === 'npm');
      const pnpm = result.current.caches.find((cache) => cache.provider === 'pnpm');
      expect(result.current.loading).toBe(false);
      expect(npm?.probePending).toBe(false);
      expect(pnpm?.probePending).toBe(true);
    });

    await act(async () => {
      slowProbe.resolve(makeProbed('pnpm', true));
      await flushAsyncEffects();
    });

    await waitFor(() => {
      const pnpm = result.current.caches.find((cache) => cache.provider === 'pnpm');
      expect(pnpm?.probePending).toBe(false);
    });
  });

  it('ignores stale path info updates from older refresh waves', async () => {
    const firstPathInfos = deferred<Array<{ provider: string; hasCleanCommand: boolean }>>();
    mockDiscoverExternalCacheCandidates
      .mockResolvedValueOnce([makeCandidate('npm')])
      .mockResolvedValueOnce([makeCandidate('pnpm')]);
    mockProbeExternalCacheProvider
      .mockResolvedValueOnce(makeProbed('npm'))
      .mockResolvedValueOnce(makeProbed('pnpm'));
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
