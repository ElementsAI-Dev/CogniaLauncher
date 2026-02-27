'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type {
  CacheEntryItem,
  CacheInfo,
  CacheAccessStats,
} from '@/lib/tauri';
import { ENTRIES_PER_PAGE, formatCacheDate } from '@/lib/constants/cache';

interface UseCacheDetailOptions {
  cacheType: 'download' | 'metadata';
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useCacheDetail({ cacheType, t }: UseCacheDetailOptions) {
  const initializedRef = useRef(false);

  // Cache info state
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [accessStats, setAccessStats] = useState<CacheAccessStats | null>(null);

  // Entry browser state
  const [entries, setEntries] = useState<CacheEntryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
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
  const [cleanConfirmOpen, setCleanConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const titleKey = cacheType === 'download' ? 'cache.detail.downloadTitle' : 'cache.detail.metadataTitle';
  const descKey = cacheType === 'download' ? 'cache.detail.downloadDescription' : 'cache.detail.metadataDescription';
  const entryTypeFilter = cacheType === 'download' ? 'download' : 'metadata';

  // Fetch cache info
  const fetchInfo = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { cacheInfo: fetchCacheInfo, getCacheAccessStats } = await import('@/lib/tauri');
      const [info, stats] = await Promise.all([
        fetchCacheInfo(),
        getCacheAccessStats(),
      ]);
      setCacheInfo(info);
      setAccessStats(stats);
    } catch (err) {
      console.error('Failed to fetch cache info:', err);
    }
  }, []);

  // Fetch entries
  const fetchEntries = useCallback(async (resetPage = false) => {
    if (!isTauri()) return;
    setLoading(true);
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
      setEntries(result.entries);
      setTotalCount(result.total_count);
    } catch (err) {
      console.error('Failed to fetch cache entries:', err);
    } finally {
      setLoading(false);
    }
  }, [entryTypeFilter, searchQuery, sortBy, page]);

  // Initialize
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchInfo();
      fetchEntries();
    }
  }, [fetchInfo, fetchEntries]);

  // Refetch when filters change
  useEffect(() => {
    if (initializedRef.current) {
      fetchEntries(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortBy, entryTypeFilter]);

  // Refetch when page changes
  useEffect(() => {
    if (initializedRef.current) {
      fetchEntries();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
      toast.success(t('cache.freed', { size: result.freed_human }));
      setSelectedKeys(new Set());
      await Promise.all([fetchInfo(), fetchEntries(true)]);
    } catch (err) {
      toast.error(`${t('cache.clearCache')}: ${err}`);
    } finally {
      setCleaning(false);
      setCleanConfirmOpen(false);
    }
  };

  const handleVerify = async () => {
    if (!isTauri()) return;
    setVerifying(true);
    try {
      const { cacheVerify } = await import('@/lib/tauri');
      const result = await cacheVerify();
      if (result.is_healthy) {
        toast.success(t('cache.verifySuccess'));
      } else {
        const issueCount = result.missing_files + result.corrupted_files + result.size_mismatches;
        toast.warning(t('cache.verifyIssues', { count: issueCount }));
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
    entries,
    totalCount,
    loading,
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
    cleanConfirmOpen,
    setCleanConfirmOpen,
    deleteConfirmOpen,
    setDeleteConfirmOpen,

    // Computed
    titleKey,
    descKey,
    cacheStats,
    totalPages,

    // Actions
    handleRefresh,
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
