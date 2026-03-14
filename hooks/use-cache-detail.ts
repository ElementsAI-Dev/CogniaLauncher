'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import { useDebounce } from '@/hooks/use-mobile';
import type {
  CacheEntryItem,
  CacheInfo,
  CacheAccessStats,
  CleanPreview,
} from '@/lib/tauri';
import { ENTRIES_PER_PAGE, formatCacheDate } from '@/lib/constants/cache';
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

interface UseCacheDetailOptions {
  cacheType: 'download' | 'metadata';
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

export function useCacheDetail({ cacheType, t }: UseCacheDetailOptions) {
  const initializedRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cache info state
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [accessStats, setAccessStats] = useState<CacheAccessStats | null>(null);
  const [infoReadState, setInfoReadState] = useState<ReadState>(INITIAL_READ_STATE);

  // Entry browser state
  const [entries, setEntries] = useState<CacheEntryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entriesReadState, setEntriesReadState] = useState<ReadState>(INITIAL_READ_STATE);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');
  const [page, setPage] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Detail dialog state
  const [detailEntry, setDetailEntry] = useState<CacheEntryItem | null>(null);

  // Clean/verify state
  const [cleaning, setCleaning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [useTrash, setUseTrash] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<CleanPreview | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const infoWaveRef = useRef(0);
  const entriesWaveRef = useRef(0);
  const pendingRefreshRef = useRef<{ info: boolean; entries: boolean }>({
    info: false,
    entries: false,
  });

  const titleKey = cacheType === 'download' ? 'cache.detail.downloadTitle' : 'cache.detail.metadataTitle';
  const descKey = cacheType === 'download' ? 'cache.detail.downloadDescription' : 'cache.detail.metadataDescription';
  const entryTypeFilter = cacheType === 'download' ? 'download' : 'metadata';

  // Fetch cache info
  const fetchInfo = useCallback(async () => {
    if (!isTauri()) return;
    const wave = startRequestWave(infoWaveRef);
    setInfoReadState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));
    try {
      const { cacheInfo: fetchCacheInfo, getCacheAccessStats } = await import('@/lib/tauri');
      const [info, stats] = await Promise.all([
        fetchCacheInfo(),
        getCacheAccessStats(),
      ]);
      if (!isRequestWaveCurrent(infoWaveRef, wave)) return;
      setCacheInfo(info);
      setAccessStats(stats);
      setInfoReadState({
        status: 'ready',
        error: null,
        lastUpdatedAt: Date.now(),
      });
    } catch (err) {
      if (!isRequestWaveCurrent(infoWaveRef, wave)) return;
      console.error('Failed to fetch cache info:', err);
      setInfoReadState((prev) => ({
        status: 'error',
        error: `cache.readFailed: ${String(err)}`,
        lastUpdatedAt: prev.lastUpdatedAt,
      }));
    }
  }, []);

  // Fetch entries
  const fetchEntries = useCallback(async (resetPage = false) => {
    if (!isTauri()) return;
    const wave = startRequestWave(entriesWaveRef);
    setLoading(true);
    setEntriesReadState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));
    const currentPage = resetPage ? 0 : page;
    if (resetPage) setPage(0);

    try {
      const { listCacheEntries } = await import('@/lib/tauri');
      const result = await listCacheEntries({
        entryType: entryTypeFilter,
        search: searchQuery || undefined,
        sortBy,
        limit: ENTRIES_PER_PAGE,
        offset: currentPage * ENTRIES_PER_PAGE,
      });
      if (!isRequestWaveCurrent(entriesWaveRef, wave)) return;
      setEntries(result.entries);
      setTotalCount(result.total_count);
      setEntriesReadState({
        status: 'ready',
        error: null,
        lastUpdatedAt: Date.now(),
      });
    } catch (err) {
      if (!isRequestWaveCurrent(entriesWaveRef, wave)) return;
      console.error('Failed to fetch cache entries:', err);
      setEntriesReadState((prev) => ({
        status: 'error',
        error: `cache.browserLoadFailed: ${String(err)}`,
        lastUpdatedAt: prev.lastUpdatedAt,
      }));
    } finally {
      if (!isRequestWaveCurrent(entriesWaveRef, wave)) return;
      setLoading(false);
    }
  }, [entryTypeFilter, searchQuery, sortBy, page]);

  const scheduleRefresh = useCallback((options?: { info?: boolean; entries?: boolean }) => {
    if (!isTauri() || !initializedRef.current) return;
    pendingRefreshRef.current.info = pendingRefreshRef.current.info || options?.info !== false;
    pendingRefreshRef.current.entries = pendingRefreshRef.current.entries || options?.entries !== false;
    if (refreshTimeoutRef.current) return;

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      const next = pendingRefreshRef.current;
      pendingRefreshRef.current = { info: false, entries: false };
      const tasks: Array<Promise<unknown>> = [];
      if (next.info) tasks.push(fetchInfo());
      if (next.entries) tasks.push(fetchEntries());
      if (tasks.length > 0) {
        void Promise.all(tasks);
      }
    }, 350);
  }, [fetchEntries, fetchInfo]);

  // Initialize
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchInfo();
      fetchEntries();
    }
  }, [fetchInfo, fetchEntries]);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Refetch when filters change (search is debounced)
  useEffect(() => {
    if (initializedRef.current) {
      fetchEntries(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortBy, entryTypeFilter]);

  // Refetch when page changes
  useEffect(() => {
    if (initializedRef.current) {
      fetchEntries();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Keep detail page synchronized with cache mutations
  useEffect(() => {
    if (!isTauri()) return;
    void ensureCacheInvalidationBridge();
    const dispose = subscribeInvalidation(
      ['cache_overview', 'cache_entries'],
      withThrottle((event) => {
        if (event.domain === 'cache_overview') {
          scheduleRefresh({ info: true, entries: false });
          return;
        }
        scheduleRefresh({ info: true, entries: true });
      }, 350),
    );

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      pendingRefreshRef.current = { info: false, entries: false };
      dispose();
    };
  }, [scheduleRefresh]);

  // Computed stats
  const cacheStats = cacheInfo
    ? cacheType === 'download'
      ? cacheInfo.download_cache
      : cacheInfo.metadata_cache
    : null;

  const totalPages = Math.ceil(totalCount / ENTRIES_PER_PAGE);

  // Actions
  const handleRefresh = async () => {
    await Promise.all([fetchInfo(), fetchEntries()]);
    toast.success(t('cache.refreshSuccess'));
  };

  const handleClean = async () => {
    if (!isTauri()) return;
    setCleaning(true);
    try {
      const { cacheCleanEnhanced } = await import('@/lib/tauri');
      const cleanType = cacheType === 'download' ? 'downloads' : 'metadata';
      const result = await cacheCleanEnhanced(cleanType, useTrash);
      const method = result.use_trash ? t('cache.movedToTrash') : t('cache.permanentlyDeleted');
      toast.success(`${t('cache.freed', { size: result.freed_human })} (${method})`);
      setSelectedKeys(new Set());
      await Promise.all([fetchInfo(), fetchEntries(true)]);
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-detail:clean',
      );
    } catch (err) {
      toast.error(`${t('cache.clearCache')}: ${err}`);
    } finally {
      setCleaning(false);
      setPreviewOpen(false);
      setPreviewData(null);
    }
  };

  const handlePreviewClean = async () => {
    if (!isTauri()) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const { cacheCleanPreview } = await import('@/lib/tauri');
      const cleanType = cacheType === 'download' ? 'downloads' : 'metadata';
      const preview = await cacheCleanPreview(cleanType);
      setPreviewData(preview);
    } catch (err) {
      toast.error(`${t('cache.previewFailed')}: ${err}`);
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isTauri()) return;
    setVerifying(true);
    try {
      const { cacheVerify } = await import('@/lib/tauri');
      const result = await cacheVerify(cacheType);
      const scopeLabel = cacheType === 'download'
        ? t('cache.detail.downloadTitle')
        : t('cache.detail.metadataTitle');
      if (result.is_healthy) {
        toast.success(`${scopeLabel}: ${t('cache.verifySuccess')}`);
      } else {
        const issueCount = result.missing_files + result.corrupted_files + result.size_mismatches;
        toast.warning(`${scopeLabel}: ${t('cache.verifyIssues', { count: issueCount })}`);
      }
    } catch (err) {
      toast.error(`Verification failed: ${err}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!isTauri() || selectedKeys.size === 0) return;
    try {
      const { deleteCacheEntries } = await import('@/lib/tauri');
      const keys = Array.from(selectedKeys);
      const deleted = await deleteCacheEntries(keys, useTrash);
      toast.success(t('cache.detail.batchDeleteSuccess', { count: deleted }));
      setSelectedKeys(new Set());
      await Promise.all([fetchInfo(), fetchEntries()]);
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-detail:batch-delete',
      );
    } catch (err) {
      toast.error(`${t('cache.deleteEntriesFailed')}: ${err}`);
    } finally {
      setDeleteConfirmOpen(false);
    }
  };

  const handleDeleteSingle = async (key: string) => {
    if (!isTauri()) return;
    try {
      const { deleteCacheEntry } = await import('@/lib/tauri');
      await deleteCacheEntry(key, useTrash);
      toast.success(t('cache.detail.deleteEntrySuccess'));
      setDetailEntry(null);
      await Promise.all([fetchInfo(), fetchEntries()]);
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-detail:single-delete',
      );
    } catch (err) {
      toast.error(`${t('cache.detail.deleteEntryFailed')}: ${err}`);
    }
  };

  const handleCopyChecksum = (checksum: string) => {
    writeClipboard(checksum);
    toast.success(t('cache.detail.checksumCopied'));
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === entries.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(entries.map((e) => e.key)));
    }
  };

  const toggleSelectKey = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const formatDate = (dateStr: string | null) =>
    formatCacheDate(dateStr, t('cache.detail.neverAccessed'));

  return {
    // State
    cacheInfo,
    accessStats,
    infoReadState,
    entries,
    totalCount,
    loading,
    entriesReadState,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    page,
    setPage,
    selectedKeys,
    detailEntry,
    setDetailEntry,
    cleaning,
    verifying,
    useTrash,
    setUseTrash,
    previewOpen,
    setPreviewOpen,
    previewData,
    previewLoading,
    deleteConfirmOpen,
    setDeleteConfirmOpen,

    // Computed
    titleKey,
    descKey,
    cacheStats,
    totalPages,

    // Actions
    handleRefresh,
    fetchInfo,
    fetchEntries,
    handlePreviewClean,
    handleClean,
    handleVerify,
    handleDeleteSelected,
    handleDeleteSingle,
    handleCopyChecksum,
    toggleSelectAll,
    toggleSelectKey,
    formatDate,
  };
}
