'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type {
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

interface UseExternalCacheOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
  includePathInfos?: boolean;
  autoFetch?: boolean;
  useTrash?: boolean;
  setUseTrash?: (next: boolean) => void;
  defaultUseTrash?: boolean;
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

  const fetchExternalCaches = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const { discoverExternalCaches, getExternalCachePaths } = await import('@/lib/tauri');
      const [discovered, paths] = await Promise.all([
        discoverExternalCaches(),
        includePathInfos ? getExternalCachePaths() : Promise.resolve<ExternalCachePathInfo[]>([]),
      ]);
      setCaches(discovered);
      setPathInfos(paths);
    } catch (err) {
      console.error('Failed to fetch external caches:', err);
    } finally {
      setLoading(false);
    }
  }, [includePathInfos]);

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
  const cleanableCount = useMemo(() => caches.filter((cache) => cache.canClean).length, [caches]);
  const grouped = useMemo(() => groupCachesByCategory(caches, 'package_manager'), [caches]);
  const orderedCategories = useMemo(
    () => CACHE_CATEGORY_ORDER.filter((category) => grouped[category]?.length > 0),
    [grouped],
  );

  return {
    caches,
    pathInfos,
    loading,
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
