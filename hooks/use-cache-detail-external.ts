'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type { ExternalCacheInfo, ExternalCachePathInfo } from '@/lib/tauri';
import { formatBytes } from '@/lib/utils';
import { groupCachesByCategory } from '@/lib/constants/cache';

interface UseCacheDetailExternalOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useCacheDetailExternal({ t }: UseCacheDetailExternalOptions) {
  const initializedRef = useRef(false);

  const [caches, setCaches] = useState<ExternalCacheInfo[]>([]);
  const [pathInfos, setPathInfos] = useState<ExternalCachePathInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [useTrash, setUseTrash] = useState(true);
  const [cleanTarget, setCleanTarget] = useState<string | null>(null);
  const [cleanAllOpen, setCleanAllOpen] = useState(false);
  const [cleaning, setCleaning] = useState<string | null>(null);

  const fetchExternalCaches = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const { discoverExternalCaches, getExternalCachePaths } = await import('@/lib/tauri');
      const [discovered, paths] = await Promise.all([
        discoverExternalCaches(),
        getExternalCachePaths(),
      ]);
      setCaches(discovered);
      setPathInfos(paths);
    } catch (err) {
      console.error('Failed to fetch external caches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchExternalCaches();
    }
  }, [fetchExternalCaches]);

  // Computed
  const totalSize = caches.reduce((acc, c) => acc + c.size, 0);
  const availableCount = caches.filter((c) => c.isAvailable).length;
  const cleanableCount = caches.filter((c) => c.canClean).length;
  const grouped = groupCachesByCategory(caches, 'other');

  // Actions
  const handleCleanSingle = async (provider: string) => {
    if (!isTauri()) return;
    setCleaning(provider);
    try {
      const { cleanExternalCache } = await import('@/lib/tauri');
      const result = await cleanExternalCache(provider, useTrash);
      if (result.success) {
        toast.success(t('cache.externalCleanSuccess', {
          provider: result.displayName,
          size: result.freedHuman,
        }));
      } else {
        toast.error(t('cache.externalCleanFailed', {
          provider: result.displayName,
          error: result.error || 'Unknown error',
        }));
      }
      await fetchExternalCaches();
    } catch (err) {
      toast.error(`Clean failed: ${err}`);
    } finally {
      setCleaning(null);
      setCleanTarget(null);
    }
  };

  const handleCleanAll = async () => {
    if (!isTauri()) return;
    setCleaning('all');
    try {
      const { cleanAllExternalCaches } = await import('@/lib/tauri');
      const results = await cleanAllExternalCaches(useTrash);
      const successCount = results.filter((r) => r.success).length;
      const totalFreed = results.reduce((acc, r) => acc + r.freedBytes, 0);
      if (successCount === results.length) {
        toast.success(t('cache.externalCleanAllSuccess', {
          count: successCount,
          size: formatBytes(totalFreed),
        }));
      } else if (successCount > 0) {
        toast.warning(t('cache.externalCleanAllPartial', {
          success: successCount,
          total: results.length,
        }));
      } else {
        toast.error(t('cache.externalCleanAllFailed'));
      }
      await fetchExternalCaches();
    } catch (err) {
      toast.error(`Clean all failed: ${err}`);
    } finally {
      setCleaning(null);
      setCleanAllOpen(false);
    }
  };

  const getPathInfo = (provider: string) =>
    pathInfos.find((p) => p.provider === provider);

  return {
    // State
    caches,
    loading,
    useTrash,
    setUseTrash,
    cleanTarget,
    setCleanTarget,
    cleanAllOpen,
    setCleanAllOpen,
    cleaning,

    // Computed
    totalSize,
    availableCount,
    cleanableCount,
    grouped,

    // Actions
    fetchExternalCaches,
    handleCleanSingle,
    handleCleanAll,
    getPathInfo,
  };
}
