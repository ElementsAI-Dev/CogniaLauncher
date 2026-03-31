'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type {
  CacheInfo,
  CleanPreview,
  EnhancedCleanResult,
} from '@/lib/tauri';
import {
  emitInvalidations,
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';
import {
  isRequestWaveCurrent,
  startRequestWave,
} from '@/lib/cache/request-wave';

interface UseDefaultDownloadsDetailOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
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

export function useDefaultDownloadsDetail({
  t,
}: UseDefaultDownloadsDetailOptions) {
  const initializedRef = useRef(false);
  const readWaveRef = useRef(0);

  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [previewData, setPreviewData] = useState<CleanPreview | null>(null);
  const [readState, setReadState] = useState<ReadState>(INITIAL_READ_STATE);
  const [useTrash, setUseTrash] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<EnhancedCleanResult | null>(null);

  const fetchData = useCallback(async () => {
    if (!isTauri()) return;

    const wave = startRequestWave(readWaveRef);
    setReadState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));

    try {
      const { cacheInfo: getCacheInfo, cacheCleanPreview } = await import('@/lib/tauri');
      const [nextCacheInfo, nextPreview] = await Promise.all([
        getCacheInfo(),
        cacheCleanPreview('default_downloads'),
      ]);

      if (!isRequestWaveCurrent(readWaveRef, wave)) return;

      setCacheInfo(nextCacheInfo);
      setPreviewData(nextPreview);
      setReadState({
        status: 'ready',
        error: null,
        lastUpdatedAt: Date.now(),
      });
    } catch (err) {
      if (!isRequestWaveCurrent(readWaveRef, wave)) return;

      setReadState((prev) => ({
        status: 'error',
        error: `cache.readFailed: ${String(err)}`,
        lastUpdatedAt: prev.lastUpdatedAt,
      }));
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      void fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    if (!isTauri()) return;

    void ensureCacheInvalidationBridge();
    const dispose = subscribeInvalidation(
      ['cache_overview'],
      withThrottle(() => {
        void fetchData();
      }, 350),
    );

    return dispose;
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    await fetchData();
    toast.success(t('cache.refreshSuccess'));
  }, [fetchData, t]);

  const handleClean = useCallback(async () => {
    if (!isTauri()) return;

    setCleaning(true);
    try {
      const { cacheCleanEnhanced } = await import('@/lib/tauri');
      const result = await cacheCleanEnhanced('default_downloads', useTrash);
      setCleanResult(result);

      const method = result.use_trash
        ? t('cache.movedToTrash')
        : t('cache.permanentlyDeleted');
      toast.success(`${t('cache.freed', { size: result.freed_human })} (${method})`);

      await fetchData();
      emitInvalidations(
        ['cache_overview', 'about_cache_stats'],
        'cache-detail:default-downloads-clean',
      );
    } catch (err) {
      toast.error(`${t('cache.clearCache')}: ${err}`);
    } finally {
      setCleaning(false);
    }
  }, [fetchData, t, useTrash]);

  const defaultDownloads = cacheInfo?.default_downloads ?? null;

  return {
    cacheInfo,
    defaultDownloads,
    previewData,
    readState,
    useTrash,
    setUseTrash,
    cleaning,
    cleanResult,
    handleRefresh,
    handleClean,
  };
}
