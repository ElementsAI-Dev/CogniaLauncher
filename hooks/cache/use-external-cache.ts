'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type {
  ExternalCacheDetectionState,
  ExternalCacheCleanResult,
  ExternalCacheInfo,
  ExternalCachePathInfo,
} from '@/lib/tauri';
import { formatBytes } from '@/lib/utils';
import { CACHE_CATEGORY_ORDER, groupCachesByCategory } from '@/lib/constants/cache';
import {
  emitInvalidations,
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';
import {
  invalidateRequestWave,
  isRequestWaveCurrent,
  startRequestWave,
} from '@/lib/cache/request-wave';

interface UseExternalCacheOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
  includePathInfos?: boolean;
  autoFetch?: boolean;
  useTrash?: boolean;
  setUseTrash?: (next: boolean) => void;
  defaultUseTrash?: boolean;
}

type ReadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ReadState {
  status: ReadStatus;
  error: string | null;
  lastUpdatedAt: number | null;
}

const INITIAL_READ_STATE: ReadState = {
  status: 'idle',
  error: null,
  lastUpdatedAt: null,
};

function inferDetectionState(cache: ExternalCacheInfo): ExternalCacheDetectionState {
  if (cache.detectionState) return cache.detectionState;
  if (cache.detectionError) return 'error';
  if (!cache.isAvailable && cache.cachePath) return 'unavailable';
  if (!cache.cachePath) return 'skipped';
  return 'found';
}

function inferScopeType(cache: ExternalCacheInfo): 'external' | 'custom' {
  if (cache.scopeType) return cache.scopeType;
  if (cache.isCustom) return 'custom';
  if (cache.provider.startsWith('custom_')) return 'custom';
  return 'external';
}

function inferCleanupMode(cache: ExternalCacheInfo): 'preview_required' | 'direct_clean_only' | 'repair_first' | 'disabled' {
  if (cache.cleanupMode) return cache.cleanupMode;
  return cache.canClean ? 'direct_clean_only' : 'disabled';
}

function normalizeExternalCacheInfo(cache: ExternalCacheInfo): ExternalCacheInfo {
  const detectionState = inferDetectionState(cache);
  const scopeType = inferScopeType(cache);
  const detectionReason = cache.detectionReason ?? (
    detectionState === 'skipped' ? 'legacy_skipped' : null
  );
  return {
    ...cache,
    detectionState,
    detectionReason,
    detectionError: cache.detectionError ?? null,
    sizePending: cache.sizePending ?? false,
    probePending: cache.probePending ?? false,
    scopeType,
    cleanupMode: inferCleanupMode(cache),
    isCustom: scopeType === 'custom',
  };
}

function normalizeExternalCaches(items: ExternalCacheInfo[]): ExternalCacheInfo[] {
  return items.map(normalizeExternalCacheInfo);
}

function makeFailureResult(provider: string, error: string): ExternalCacheCleanResult {
  return {
    provider,
    displayName: provider,
    freedBytes: 0,
    freedHuman: '0 B',
    success: false,
    error,
  };
}

function createLimiter(limit: number) {
  let active = 0;
  const waiters: Array<() => void> = [];

  const acquire = async () => {
    if (active < limit) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
    active += 1;
  };

  const release = () => {
    active = Math.max(0, active - 1);
    const next = waiters.shift();
    if (next) {
      next();
    }
  };

  return async <T>(task: () => Promise<T>) => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
}

export function useExternalCache({
  t,
  includePathInfos = false,
  autoFetch = false,
  useTrash,
  setUseTrash,
  defaultUseTrash = true,
}: UseExternalCacheOptions) {
  const initializedRef = useRef(false);
  const [internalUseTrash, setInternalUseTrash] = useState(defaultUseTrash);
  const [caches, setCaches] = useState<ExternalCacheInfo[]>([]);
  const [pathInfos, setPathInfos] = useState<ExternalCachePathInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [readState, setReadState] = useState<ReadState>(INITIAL_READ_STATE);
  const [cleanTarget, setCleanTarget] = useState<string | null>(null);
  const [cleanAllOpen, setCleanAllOpen] = useState(false);
  const [cleaning, setCleaning] = useState<string | null>(null);

  const resolvedUseTrash = useTrash ?? internalUseTrash;
  const handleUseTrashChange = useCallback((next: boolean) => {
    setUseTrash?.(next);
    if (useTrash === undefined) {
      setInternalUseTrash(next);
    }
  }, [setUseTrash, useTrash]);

  const abortRef = useRef(false);
  const fetchWaveRef = useRef(0);
  const fetchInFlightRef = useRef<Promise<void> | null>(null);
  const queuedRefreshRef = useRef(false);

  const fillSizesProgressively = useCallback(async (providers: string[], waveId: number) => {
    if (providers.length === 0) return;

    const { calculateExternalCacheSize } = await import('@/lib/tauri');
    const queue = [...providers];

    const CONCURRENCY = 4;
    let idx = 0;

    async function next(): Promise<void> {
      while (idx < queue.length) {
        if (abortRef.current || !isRequestWaveCurrent(fetchWaveRef, waveId)) return;
        const provId = queue[idx++];
        try {
          const size = await calculateExternalCacheSize(provId);
          setCaches((prev) =>
            !isRequestWaveCurrent(fetchWaveRef, waveId)
              ? prev
              : prev.map((c) =>
                c.provider === provId
                  ? {
                    ...c,
                    size,
                    sizeHuman: formatBytes(size),
                    sizePending: false,
                    probePending: false,
                    canClean: size > 0 || c.canClean,
                    detectionState: c.detectionState === 'skipped' && size > 0 ? 'found' : c.detectionState,
                    detectionError: null,
                  }
                  : c,
              ),
          );
        } catch (err) {
          setCaches((prev) =>
            !isRequestWaveCurrent(fetchWaveRef, waveId)
              ? prev
              : prev.map((c) =>
                c.provider === provId
                  ? {
                    ...c,
                    sizePending: false,
                    probePending: false,
                    detectionState: 'error',
                    detectionReason: c.detectionReason ?? 'size_scan_failed',
                    detectionError: String(err),
                  }
                  : c,
              ),
          );
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => next()));
  }, []);

  const runFetchWave = useCallback(async () => {
    abortRef.current = false;
    const waveId = startRequestWave(fetchWaveRef);
    setLoading(true);
    setReadState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));

    try {
      const tauri = await import('@/lib/tauri');
      const fetchPathInfos = () => {
        if (!includePathInfos) return;
        tauri.getExternalCachePaths().then((paths) => {
          if (!abortRef.current && isRequestWaveCurrent(fetchWaveRef, waveId)) {
            setPathInfos(paths);
          }
        }).catch(() => {});
      };

      const runLegacyFastFlow = async () => {
        const fast = await tauri.discoverExternalCachesFast();
        const normalizedFast = normalizeExternalCaches(fast).map((cache) => ({
          ...cache,
          probePending: false,
        }));
        if (abortRef.current || !isRequestWaveCurrent(fetchWaveRef, waveId)) return;
        setCaches(normalizedFast);
        fetchPathInfos();
        if (!abortRef.current && isRequestWaveCurrent(fetchWaveRef, waveId)) {
          setLoading(false);
          setReadState({
            status: 'ready',
            error: null,
            lastUpdatedAt: Date.now(),
          });
        }
        const pendingProviders = normalizedFast
          .filter((cache) => cache.sizePending)
          .map((cache) => cache.provider);
        await fillSizesProgressively(pendingProviders, waveId);
      };

      const supportsProgressiveProbing = (
        typeof tauri.discoverExternalCacheCandidates === 'function'
        && typeof tauri.probeExternalCacheProvider === 'function'
      );

      if (!supportsProgressiveProbing) {
        await runLegacyFastFlow();
        return;
      }

      let candidates: ExternalCacheInfo[] = [];
      try {
        candidates = await tauri.discoverExternalCacheCandidates();
      } catch (candidateErr) {
        console.warn('Falling back to legacy external cache discovery:', candidateErr);
        await runLegacyFastFlow();
        return;
      }

      const normalizedCandidates = normalizeExternalCaches(candidates).map((cache) => ({
        ...cache,
        probePending: cache.probePending ?? true,
      }));
      if (abortRef.current || !isRequestWaveCurrent(fetchWaveRef, waveId)) return;
      setCaches(normalizedCandidates);
      fetchPathInfos();
      if (!abortRef.current && isRequestWaveCurrent(fetchWaveRef, waveId)) {
        setLoading(false);
        setReadState({
          status: 'ready',
          error: null,
          lastUpdatedAt: Date.now(),
        });
      }

      const queue = normalizedCandidates.map((cache) => cache.provider);
      const runSizeLimited = createLimiter(4);
      const pendingSizeTasks: Promise<unknown>[] = [];
      const PROBE_CONCURRENCY = 4;
      let idx = 0;

      async function probeNext(): Promise<void> {
        while (idx < queue.length) {
          if (abortRef.current || !isRequestWaveCurrent(fetchWaveRef, waveId)) return;
          const provider = queue[idx++];
          try {
            const probedRaw = await tauri.probeExternalCacheProvider(provider);
            const probed = normalizeExternalCacheInfo({
              ...probedRaw,
              probePending: false,
            });
            setCaches((prev) => {
              if (!isRequestWaveCurrent(fetchWaveRef, waveId)) return prev;
              const index = prev.findIndex((item) => item.provider === provider);
              if (index === -1) {
                return [...prev, probed];
              }
              const next = [...prev];
              next[index] = {
                ...prev[index],
                ...probed,
                probePending: false,
              };
              return next;
            });

            if (probed.sizePending) {
              const sizeTask = runSizeLimited(async () => {
                await fillSizesProgressively([provider], waveId);
              });
              pendingSizeTasks.push(sizeTask);
            }
          } catch (probeErr) {
            setCaches((prev) =>
              !isRequestWaveCurrent(fetchWaveRef, waveId)
                ? prev
                : prev.map((cache) =>
                  cache.provider === provider
                    ? {
                      ...cache,
                      probePending: false,
                      sizePending: false,
                      detectionState: 'error',
                      detectionReason: cache.detectionReason ?? 'probe_failed',
                      detectionError: String(probeErr),
                    }
                    : cache,
                ),
            );
          }
        }
      }

      await Promise.all(Array.from({ length: PROBE_CONCURRENCY }, () => probeNext()));
      await Promise.allSettled(pendingSizeTasks);
    } catch (err) {
      console.error('Failed to fetch external caches:', err);
      if (!abortRef.current && isRequestWaveCurrent(fetchWaveRef, waveId)) {
        setLoading(false);
        setReadState((prev) => ({
          status: 'error',
          error: `cache.externalLoadFailed: ${String(err)}`,
          lastUpdatedAt: prev.lastUpdatedAt,
        }));
      }
    }
  }, [includePathInfos, fillSizesProgressively]);

  const fetchExternalCaches = useCallback(async () => {
    if (!isTauri()) return;

    if (fetchInFlightRef.current) {
      queuedRefreshRef.current = true;
      return fetchInFlightRef.current;
    }

    queuedRefreshRef.current = false;
    const task = (async () => {
      while (!abortRef.current) {
        await runFetchWave();
        if (!queuedRefreshRef.current) {
          break;
        }
        queuedRefreshRef.current = false;
      }
    })();

    fetchInFlightRef.current = task.finally(() => {
      fetchInFlightRef.current = null;
      queuedRefreshRef.current = false;
    });

    return fetchInFlightRef.current;
  }, [runFetchWave]);

  useEffect(() => {
    if (!autoFetch || initializedRef.current) return;
    initializedRef.current = true;
    void fetchExternalCaches();
  }, [autoFetch, fetchExternalCaches]);

  useEffect(() => {
    if (!isTauri()) return;
    void ensureCacheInvalidationBridge();
    const dispose = subscribeInvalidation(
      ['external_cache', 'cache_overview'],
      withThrottle(() => {
        void fetchExternalCaches();
      }, 450),
    );

    return () => {
      dispose();
      abortRef.current = true;
      queuedRefreshRef.current = false;
      invalidateRequestWave(fetchWaveRef);
      fetchInFlightRef.current = null;
    };
  }, [fetchExternalCaches]);

  const cleanSingleWithFallback = useCallback(async (provider: string) => {
    const { cleanExternalCache, cacheForceCleanExternal } = await import('@/lib/tauri');

    try {
      const directResult = await cleanExternalCache(provider, resolvedUseTrash);
      if (directResult.success) {
        return directResult;
      }

      try {
        return await cacheForceCleanExternal(provider, false, resolvedUseTrash);
      } catch (fallbackErr) {
        return {
          ...directResult,
          success: false,
          error: directResult.error ?? String(fallbackErr),
        };
      }
    } catch (err) {
      return makeFailureResult(provider, String(err));
    }
  }, [resolvedUseTrash]);

  const cleanAllWithFallback = useCallback(async () => {
    const { cleanAllExternalCaches, cacheForceCleanExternal } = await import('@/lib/tauri');

    let results = await cleanAllExternalCaches(resolvedUseTrash);
    const failedProviders = results
      .filter((result) => !result.success)
      .map((result) => result.provider);

    if (failedProviders.length === 0) {
      return results;
    }

    const forcedResults = await Promise.all(
      failedProviders.map(async (provider) => {
        try {
          return await cacheForceCleanExternal(provider, false, resolvedUseTrash);
        } catch (err) {
          return makeFailureResult(provider, String(err));
        }
      }),
    );

    const forcedMap = new Map(forcedResults.map((result) => [result.provider, result]));
    results = results.map((result) => {
      if (result.success) return result;
      return forcedMap.get(result.provider) ?? result;
    });

    return results;
  }, [resolvedUseTrash]);

  const handleCleanSingle = useCallback(async (provider: string) => {
    if (!isTauri()) return null;
    setCleaning(provider);
    try {
      const result = await cleanSingleWithFallback(provider);
      if (result.success) {
        toast.success(t('cache.externalCleanSuccess', {
          provider: result.displayName,
          size: result.freedHuman,
        }));
        emitInvalidations(
          ['external_cache', 'cache_overview', 'about_cache_stats'],
          'external-cache:clean-single',
        );
      } else {
        toast.error(t('cache.externalCleanFailed', {
          provider: result.displayName,
          error: result.error || 'Unknown error',
        }));
      }
      await fetchExternalCaches();
      return result;
    } finally {
      setCleaning(null);
      setCleanTarget(null);
    }
  }, [cleanSingleWithFallback, fetchExternalCaches, t]);

  const handleCleanAll = useCallback(async () => {
    if (!isTauri()) return [];
    setCleaning('all');
    try {
      const results = await cleanAllWithFallback();
      const successCount = results.filter((result) => result.success).length;
      const totalFreed = results.reduce((acc, result) => acc + result.freedBytes, 0);

      if (results.length > 0 && successCount === results.length) {
        toast.success(t('cache.externalCleanAllSuccess', {
          count: successCount,
          size: formatBytes(totalFreed),
        }));
        emitInvalidations(
          ['external_cache', 'cache_overview', 'about_cache_stats'],
          'external-cache:clean-all-success',
        );
      } else if (successCount > 0) {
        toast.warning(t('cache.externalCleanAllPartial', {
          success: successCount,
          total: results.length,
        }));
        emitInvalidations(
          ['external_cache', 'cache_overview', 'about_cache_stats'],
          'external-cache:clean-all-partial',
        );
      } else {
        toast.error(t('cache.externalCleanAllFailed'));
      }

      await fetchExternalCaches();
      return results;
    } catch (err) {
      toast.error(`${t('cache.externalCleanAllFailed')}: ${err}`);
      return [];
    } finally {
      setCleaning(null);
      setCleanAllOpen(false);
    }
  }, [cleanAllWithFallback, fetchExternalCaches, t]);

  const getPathInfo = useCallback((provider: string) => {
    return pathInfos.find((pathInfo) => pathInfo.provider === provider);
  }, [pathInfos]);

  const totalSize = useMemo(() => caches.reduce((sum, cache) => sum + cache.size, 0), [caches]);
  const availableCount = useMemo(() => caches.filter((cache) => cache.isAvailable).length, [caches]);
  const cleanableCount = useMemo(
    () => caches.filter((cache) => cache.canClean && !cache.probePending).length,
    [caches],
  );
  const grouped = useMemo(() => groupCachesByCategory(caches, 'package_manager'), [caches]);
  const orderedCategories = useMemo(
    () => CACHE_CATEGORY_ORDER.filter((category) => grouped[category]?.length > 0),
    [grouped],
  );

  return {
    caches,
    pathInfos,
    loading,
    readState,
    useTrash: resolvedUseTrash,
    setUseTrash: handleUseTrashChange,
    cleanTarget,
    setCleanTarget,
    cleanAllOpen,
    setCleanAllOpen,
    cleaning,

    totalSize,
    availableCount,
    cleanableCount,
    grouped,
    orderedCategories,

    fetchExternalCaches,
    handleCleanSingle,
    handleCleanAll,
    getPathInfo,
  };
}
