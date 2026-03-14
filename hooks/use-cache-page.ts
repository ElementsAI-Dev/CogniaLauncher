'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/hooks/use-settings';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type {
  CacheSettings,
  CleanPreview,
  CleanupRecord,
  CleanupHistorySummary,
  CacheAccessStats,
  CacheEntryItem,
  CacheOptimizeResult,
  DatabaseInfo,
} from '@/lib/tauri';
import * as tauri from '@/lib/tauri';
import type { CacheBrowserTypeFilter, CleanType, OperationType } from '@/types/cache';
import { ENTRIES_PER_PAGE } from '@/lib/constants/cache';
import { useDebounce } from '@/hooks/use-mobile';
import {
  type CacheInvalidationEvent,
  emitInvalidations,
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';
import {
  isRequestWaveCurrent,
  startRequestWave,
} from '@/lib/cache/request-wave';

interface UseCachePageOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface RefreshOverviewStateOptions {
  includeCacheInfo?: boolean;
  includeCacheSettings?: boolean;
  includeAccessStats?: boolean;
  includeHotFiles?: boolean;
  includeMonitor?: boolean;
}

export type CacheReadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CacheReadState {
  status: CacheReadStatus;
  error: string | null;
  lastUpdatedAt: number | null;
}

const INITIAL_READ_STATE: CacheReadState = {
  status: 'idle',
  error: null,
  lastUpdatedAt: null,
};

export function useCachePage({ t }: UseCachePageOptions) {
  const {
    cacheInfo,
    cacheSettings,
    cacheVerification,
    loading,
    error,
    cogniaDir,
    fetchCacheInfo,
    fetchPlatformInfo,
    fetchCacheSettings,
    cleanCache,
    verifyCacheIntegrity,
    repairCache,
    updateCacheSettings,
  } = useSettings();

  const [activeTab, setActiveTab] = useState('overview');
  const [operationLoading, setOperationLoading] = useState<OperationType | null>(null);
  const [cleaningType, setCleaningType] = useState<CleanType | null>(null);
  const [localSettings, setLocalSettings] = useState<CacheSettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);

  const [useTrash, setUseTrash] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<CleanPreview | null>(null);
  const [previewType, setPreviewType] = useState<CleanType>('all');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cleanupHistory, setCleanupHistory] = useState<CleanupRecord[]>([]);
  const [historySummary, setHistorySummary] = useState<CleanupHistorySummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReadState, setHistoryReadState] = useState<CacheReadState>(INITIAL_READ_STATE);

  const [accessStats, setAccessStats] = useState<CacheAccessStats | null>(null);
  const [accessStatsLoading, setAccessStatsLoading] = useState(false);
  const [accessStatsReadState, setAccessStatsReadState] = useState<CacheReadState>(INITIAL_READ_STATE);

  const [browserEntries, setBrowserEntries] = useState<CacheEntryItem[]>([]);
  const [browserTotalCount, setBrowserTotalCount] = useState(0);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserDeleting, setBrowserDeleting] = useState(false);
  const [browserSearch, setBrowserSearch] = useState('');
  const [browserTypeFilter, setBrowserTypeFilter] = useState<CacheBrowserTypeFilter>('all');
  const [browserSortBy, setBrowserSortBy] = useState<string>('created_desc');
  const [browserPage, setBrowserPage] = useState(0);
  const [browserSelectedKeys, setBrowserSelectedKeys] = useState<Set<string>>(new Set());
  const [browserReadState, setBrowserReadState] = useState<CacheReadState>(INITIAL_READ_STATE);
  const browserSearchRef = useRef(browserSearch);
  const browserRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hotFiles, setHotFiles] = useState<CacheEntryItem[]>([]);
  const [hotFilesReadState, setHotFilesReadState] = useState<CacheReadState>(INITIAL_READ_STATE);

  const [forceCleanLoading, setForceCleanLoading] = useState(false);
  const [monitorRefreshTrigger, setMonitorRefreshTrigger] = useState(0);

  const [optimizeResult, setOptimizeResult] = useState<CacheOptimizeResult | null>(null);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [dbInfoLoading, setDbInfoLoading] = useState(false);
  const debouncedBrowserSearch = useDebounce(browserSearch, 300);
  const accessStatsWaveRef = useRef(0);
  const hotFilesWaveRef = useRef(0);
  const historyWaveRef = useRef(0);
  const browserWaveRef = useRef(0);

  useEffect(() => {
    browserSearchRef.current = browserSearch;
  }, [browserSearch]);

  const fetchAccessStats = useCallback(async () => {
    if (!isTauri()) return;
    const wave = startRequestWave(accessStatsWaveRef);
    setAccessStatsLoading(true);
    setAccessStatsReadState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));
    try {
      const stats = await tauri.getCacheAccessStats();
      if (!isRequestWaveCurrent(accessStatsWaveRef, wave)) return;
      setAccessStats(stats);
      setAccessStatsReadState({
        status: 'ready',
        error: null,
        lastUpdatedAt: Date.now(),
      });
    } catch (err) {
      if (!isRequestWaveCurrent(accessStatsWaveRef, wave)) return;
      console.error('Failed to fetch access stats:', err);
      setAccessStatsReadState((prev) => ({
        status: 'error',
        error: t('cache.accessStatsLoadFailed', { error: String(err) }),
        lastUpdatedAt: prev.lastUpdatedAt,
      }));
    } finally {
      if (!isRequestWaveCurrent(accessStatsWaveRef, wave)) return;
      setAccessStatsLoading(false);
    }
  }, [t]);

  const fetchHotFiles = useCallback(async () => {
    if (!isTauri()) return;
    const wave = startRequestWave(hotFilesWaveRef);
    setHotFilesReadState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));
    try {
      const entries = await tauri.getTopAccessedEntries(5);
      if (!isRequestWaveCurrent(hotFilesWaveRef, wave)) return;
      setHotFiles(entries);
      setHotFilesReadState({
        status: 'ready',
        error: null,
        lastUpdatedAt: Date.now(),
      });
    } catch (err) {
      if (!isRequestWaveCurrent(hotFilesWaveRef, wave)) return;
      console.error('Failed to fetch hot files:', err);
      setHotFilesReadState((prev) => ({
        status: 'error',
        error: t('cache.hotFilesLoadFailed', { error: String(err) }),
        lastUpdatedAt: prev.lastUpdatedAt,
      }));
    }
  }, [t]);

  const refreshOverviewState = useCallback(async ({
    includeCacheInfo = true,
    includeCacheSettings = false,
    includeAccessStats = true,
    includeHotFiles = true,
    includeMonitor = true,
  }: RefreshOverviewStateOptions = {}) => {
    const tasks: Promise<unknown>[] = [];
    if (includeCacheInfo) {
      tasks.push(fetchCacheInfo());
    }
    if (includeCacheSettings) {
      tasks.push(fetchCacheSettings());
    }
    if (includeAccessStats) {
      tasks.push(fetchAccessStats());
    }
    if (includeHotFiles) {
      tasks.push(fetchHotFiles());
    }
    await Promise.all(tasks);
    if (includeMonitor) {
      setMonitorRefreshTrigger((prev) => prev + 1);
    }
  }, [fetchAccessStats, fetchCacheInfo, fetchCacheSettings, fetchHotFiles]);

  const fetchBrowserEntries = useCallback(async (
    resetPage = false,
    explicitPage?: number,
    searchOverride?: string,
  ) => {
    if (!isTauri()) return;
    const wave = startRequestWave(browserWaveRef);
    setBrowserLoading(true);
    setBrowserReadState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));
    const page = resetPage ? 0 : (explicitPage ?? browserPage);
    if (resetPage) setBrowserPage(0);
    try {
      const entryTypeFilter = browserTypeFilter === 'all' ? undefined : browserTypeFilter;
      const result = await tauri.listCacheEntries({
        entryType: entryTypeFilter,
        search: (searchOverride ?? browserSearchRef.current) || undefined,
        sortBy: browserSortBy,
        limit: ENTRIES_PER_PAGE,
        offset: page * ENTRIES_PER_PAGE,
      });
      if (!isRequestWaveCurrent(browserWaveRef, wave)) return;
      setBrowserEntries(result.entries);
      setBrowserTotalCount(result.total_count);
      setBrowserSelectedKeys(new Set());
      setBrowserReadState({
        status: 'ready',
        error: null,
        lastUpdatedAt: Date.now(),
      });
    } catch (err) {
      if (!isRequestWaveCurrent(browserWaveRef, wave)) return;
      console.error('Failed to fetch cache entries:', err);
      setBrowserReadState((prev) => ({
        status: 'error',
        error: t('cache.browserLoadFailed', { error: String(err) }),
        lastUpdatedAt: prev.lastUpdatedAt,
      }));
    } finally {
      if (!isRequestWaveCurrent(browserWaveRef, wave)) return;
      setBrowserLoading(false);
    }
  }, [browserPage, browserSortBy, browserTypeFilter, t]);

  const scheduleBrowserRefresh = useCallback(() => {
    if (activeTab !== 'entries' || !isTauri()) return;
    if (browserRefreshTimeoutRef.current) return;
    browserRefreshTimeoutRef.current = setTimeout(() => {
      browserRefreshTimeoutRef.current = null;
      void fetchBrowserEntries(false, undefined, debouncedBrowserSearch);
    }, 350);
  }, [activeTab, debouncedBrowserSearch, fetchBrowserEntries]);

  useEffect(() => {
    fetchPlatformInfo();
    void refreshOverviewState({ includeCacheSettings: true, includeMonitor: false });
  }, [fetchPlatformInfo, refreshOverviewState]);

  // Listen to unified cache invalidation bus for auto-refresh
  useEffect(() => {
    if (!isTauri()) return;
    void ensureCacheInvalidationBridge();

    const disposeOverview = subscribeInvalidation(
      ['cache_overview', 'external_cache'],
      withThrottle((event: CacheInvalidationEvent) => {
        if (event.domain === 'external_cache') {
          void refreshOverviewState({
            includeCacheInfo: true,
            includeAccessStats: false,
            includeHotFiles: false,
            includeMonitor: false,
          });
          return;
        }

        void refreshOverviewState({
          includeCacheInfo: true,
          includeAccessStats: false,
          includeHotFiles: false,
        });

        if (event.reason !== 'backend:auto-cleaned') return;
        const payload = event.payload as Partial<{
          expiredMetadataRemoved: number;
          expiredDownloadsFreed: number;
          evictedCount: number;
          stalePartialsRemoved: number;
          totalFreedHuman: string;
        }> | undefined;
        if (!payload) return;

        const hasFreed =
          (payload.expiredMetadataRemoved ?? 0) > 0 ||
          (payload.expiredDownloadsFreed ?? 0) > 0 ||
          (payload.evictedCount ?? 0) > 0 ||
          (payload.stalePartialsRemoved ?? 0) > 0;

        if (!hasFreed) return;
        toast.info(t('cache.autoCleanEvent', { size: payload.totalFreedHuman ?? '0 B' }));
      }, 350),
    );

    const disposeEntries = subscribeInvalidation(
      'cache_entries',
      withThrottle(() => {
        void refreshOverviewState({
          includeCacheInfo: true,
          includeAccessStats: false,
          includeHotFiles: true,
          includeMonitor: false,
        });
        scheduleBrowserRefresh();
      }, 350),
    );

    return () => {
      if (browserRefreshTimeoutRef.current) {
        clearTimeout(browserRefreshTimeoutRef.current);
        browserRefreshTimeoutRef.current = null;
      }
      disposeOverview();
      disposeEntries();
    };
  }, [refreshOverviewState, scheduleBrowserRefresh, t]);

  useEffect(() => {
    if (cacheSettings && (!localSettings || !settingsDirty)) {
      setLocalSettings(cacheSettings);
    }
  }, [cacheSettings, localSettings, settingsDirty]);

  const handleClean = async (type: CleanType) => {
    setCleaningType(type);
    setOperationLoading('clean');
    try {
      const result = await cleanCache(type);
      toast.success(`${t('cache.freed', { size: result.freed_human })} (${t('cache.permanentlyDeleted')})`);
      await refreshOverviewState({
        includeCacheInfo: true,
        includeAccessStats: false,
        includeHotFiles: true,
      });
      await fetchCleanupHistory();
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-page:clean',
      );
    } catch (err) {
      toast.error(`${t('cache.clearing')} ${err}`);
    } finally {
      setCleaningType(null);
      setOperationLoading(null);
    }
  };

  const handlePreview = async (type: CleanType) => {
    if (!isTauri()) return;
    setPreviewType(type);
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const { cacheCleanPreview } = await import('@/lib/tauri');
      const preview = await cacheCleanPreview(type);
      setPreviewData(preview);
    } catch (err) {
      toast.error(`${t('cache.previewFailed')}: ${err}`);
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchCleanupHistory = useCallback(async () => {
    if (!isTauri()) return;
    const wave = startRequestWave(historyWaveRef);
    setHistoryLoading(true);
    setHistoryReadState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));
    try {
      const { getCleanupHistory, getCleanupSummary } = await import('@/lib/tauri');
      const [history, summary] = await Promise.all([
        getCleanupHistory(10),
        getCleanupSummary(),
      ]);
      if (!isRequestWaveCurrent(historyWaveRef, wave)) return;
      setCleanupHistory(history);
      setHistorySummary(summary);
      setHistoryReadState({
        status: 'ready',
        error: null,
        lastUpdatedAt: Date.now(),
      });
    } catch (err) {
      if (!isRequestWaveCurrent(historyWaveRef, wave)) return;
      console.error('Failed to fetch cleanup history:', err);
      setHistoryReadState((prev) => ({
        status: 'error',
        error: t('cache.historyLoadFailed', { error: String(err) }),
        lastUpdatedAt: prev.lastUpdatedAt,
      }));
    } finally {
      if (!isRequestWaveCurrent(historyWaveRef, wave)) return;
      setHistoryLoading(false);
    }
  }, [t]);

  const handleEnhancedClean = async () => {
    if (!isTauri()) return;
    setCleaningType(previewType);
    setOperationLoading('clean');
    setPreviewOpen(false);
    try {
      const { cacheCleanEnhanced } = await import('@/lib/tauri');
      const result = await cacheCleanEnhanced(previewType, useTrash);
      const method = useTrash ? t('cache.movedToTrash') : t('cache.permanentlyDeleted');
      toast.success(`${t('cache.freed', { size: result.freed_human })} (${method})`);
      await refreshOverviewState({
        includeCacheInfo: true,
        includeAccessStats: false,
        includeHotFiles: true,
      });
      await fetchCleanupHistory();
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-page:enhanced-clean',
      );
    } catch (err) {
      toast.error(`${t('cache.clearing')}: ${err}`);
    } finally {
      setCleaningType(null);
      setOperationLoading(null);
      setPreviewData(null);
    }
  };

  const handleResetAccessStats = async () => {
    if (!isTauri()) return;
    try {
      await tauri.resetCacheAccessStats();
      await fetchAccessStats();
      toast.success(t('cache.statsReset'));
    } catch (err) {
      toast.error(`${t('cache.statsResetFailed')}: ${err}`);
    }
  };

  useEffect(() => {
    if (activeTab !== 'entries' || !isTauri()) return;
    void fetchBrowserEntries(true, 0, debouncedBrowserSearch);
  }, [activeTab, debouncedBrowserSearch, browserTypeFilter, browserSortBy, fetchBrowserEntries]);

  const handleDeleteSelectedEntries = async () => {
    if (!isTauri() || browserSelectedKeys.size === 0) return;
    setBrowserDeleting(true);
    try {
      const keys = Array.from(browserSelectedKeys);
      const deleted = await tauri.deleteCacheEntries(keys, useTrash);
      toast.success(t('cache.entriesDeleted', { count: deleted }));
      setBrowserSelectedKeys(new Set());
      await fetchBrowserEntries();
      await refreshOverviewState({
        includeCacheInfo: true,
        includeAccessStats: false,
        includeHotFiles: true,
      });
      emitInvalidations(
        ['cache_entries', 'cache_overview', 'about_cache_stats'],
        'cache-page:delete-entries',
      );
    } catch (err) {
      toast.error(`${t('cache.deleteEntriesFailed')}: ${err}`);
    } finally {
      setBrowserDeleting(false);
    }
  };

  const handleClearHistory = async () => {
    if (!isTauri()) return;
    try {
      const { clearCleanupHistory } = await import('@/lib/tauri');
      const count = await clearCleanupHistory();
      toast.success(t('cache.historyCleared', { count }));
      setCleanupHistory([]);
      setHistorySummary(null);
      emitInvalidations(
        ['cache_overview'],
        'cache-page:clear-history',
      );
    } catch (err) {
      toast.error(`${t('cache.historyClearFailed')}: ${err}`);
    }
  };

  const handleRefresh = async () => {
    const cacheInfoResult = await fetchCacheInfo();
    await refreshOverviewState({ includeCacheInfo: false, includeCacheSettings: true });
    if (cacheInfoResult) {
      toast.success(t('cache.refreshSuccess'));
    } else {
      toast.error(t('cache.refreshFailed'));
    }
  };

  const handleForceClean = async () => {
    if (!isTauri()) return;
    setForceCleanLoading(true);
    try {
      const { cacheForceClean } = await import('@/lib/tauri');
      const result = await cacheForceClean(useTrash);
      toast.success(t('cache.forceCleanSuccess', { count: result.deleted_count, size: result.freed_human }));
      await refreshOverviewState({
        includeCacheInfo: true,
        includeAccessStats: false,
        includeHotFiles: true,
      });
      await fetchCleanupHistory();
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'external_cache', 'about_cache_stats'],
        'cache-page:force-clean',
      );
    } catch (err) {
      toast.error(`${t('cache.forceCleanFailed')}: ${err}`);
    } finally {
      setForceCleanLoading(false);
    }
  };

  const handleVerify = async () => {
    setOperationLoading('verify');
    try {
      const result = await verifyCacheIntegrity('all');
      if (result.is_healthy) {
        toast.success(t('cache.verifySuccess'));
      } else {
        const issueCount = result.missing_files + result.corrupted_files + result.size_mismatches;
        toast.warning(t('cache.verifyIssues', { count: issueCount }));
      }
    } catch (err) {
      toast.error(`${t('cache.verify')}: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleRepair = async () => {
    setOperationLoading('repair');
    try {
      const result = await repairCache('all');
      const repairedCount = result.removed_entries + result.recovered_entries;
      toast.success(t('cache.repairSuccess', { count: repairedCount, size: result.freed_human }));
      await refreshOverviewState({
        includeCacheInfo: true,
        includeAccessStats: false,
        includeHotFiles: true,
      });
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-page:repair',
      );
    } catch (err) {
      toast.error(`${t('cache.repairFailed')}: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleOptimize = async () => {
    if (!isTauri()) return;
    setOptimizeLoading(true);
    try {
      const result = await tauri.cacheOptimize();
      setOptimizeResult(result);
      await refreshOverviewState();
      emitInvalidations(
        ['cache_overview', 'cache_entries', 'about_cache_stats'],
        'cache-page:optimize',
      );
      if (result.sizeSaved > 0) {
        toast.success(t('cache.optimizeSuccess', { saved: result.sizeSavedHuman }));
      } else {
        toast.info(t('cache.optimizeNoChange'));
      }
    } catch (err) {
      toast.error(`${t('cache.optimizeFailed')}: ${err}`);
    } finally {
      setOptimizeLoading(false);
    }
  };

  const fetchDbInfo = async () => {
    if (!isTauri()) return;
    setDbInfoLoading(true);
    try {
      const info = await tauri.dbGetInfo();
      setDbInfo(info);
    } catch (err) {
      console.error('Failed to fetch DB info:', err);
    } finally {
      setDbInfoLoading(false);
    }
  };

  const retryAccessStats = useCallback(() => {
    void fetchAccessStats();
  }, [fetchAccessStats]);

  const retryHotFiles = useCallback(() => {
    void fetchHotFiles();
  }, [fetchHotFiles]);

  const retryHistory = useCallback(() => {
    void fetchCleanupHistory();
  }, [fetchCleanupHistory]);

  const retryBrowser = useCallback(() => {
    void fetchBrowserEntries(false, undefined, debouncedBrowserSearch);
  }, [debouncedBrowserSearch, fetchBrowserEntries]);

  const handleSettingsChange = (key: keyof CacheSettings, value: number | boolean) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, [key]: value });
      setSettingsDirty(true);
    }
  };

  const handleSaveSettings = async () => {
    if (!localSettings) return;
    setOperationLoading('settings');
    try {
      await updateCacheSettings(localSettings);
      setSettingsDirty(false);
      toast.success(t('cache.settingsSaved'));
    } catch (err) {
      toast.error(`${t('cache.settingsFailed')}: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const maxSize = cacheInfo?.max_size ?? cacheSettings?.max_size ?? 10 * 1024 * 1024 * 1024;
  const usagePercent = cacheInfo?.usage_percent ?? (cacheInfo ? Math.min(100, (cacheInfo.total_size / maxSize) * 100) : 0);

  const isLoading = loading || operationLoading !== null;
  const isCleaning = operationLoading === 'clean';
  const isVerifying = operationLoading === 'verify';
  const isRepairing = operationLoading === 'repair';
  const isSavingSettings = operationLoading === 'settings';

  const totalIssues = cacheVerification
    ? cacheVerification.missing_files + cacheVerification.corrupted_files + cacheVerification.size_mismatches
    : 0;

  return {
    // From useSettings
    cacheInfo,
    cacheSettings,
    cacheVerification,
    loading,
    error,
    cogniaDir,

    // Tab state
    activeTab,
    setActiveTab,

    // Operation state
    operationLoading,
    cleaningType,
    localSettings,
    settingsDirty,

    // Enhanced cleaning state
    useTrash,
    setUseTrash,
    previewOpen,
    setPreviewOpen,
    previewData,
    previewType,
    previewLoading,

    // History state
    cleanupHistory,
    historySummary,
    historyLoading,
    historyReadState,

    // Access stats state
    accessStats,
    accessStatsLoading,
    accessStatsReadState,

    // Browser state
    browserEntries,
    browserTotalCount,
    browserLoading,
    browserDeleting,
    browserSearch,
    setBrowserSearch,
    browserTypeFilter,
    setBrowserTypeFilter,
    browserSortBy,
    setBrowserSortBy,
    browserPage,
    setBrowserPage,
    browserSelectedKeys,
    setBrowserSelectedKeys,
    browserReadState,

    // Hot files
    hotFiles,
    hotFilesReadState,

    // Force clean & monitor
    forceCleanLoading,
    monitorRefreshTrigger,
    setMonitorRefreshTrigger,

    // DB optimize & info
    optimizeResult,
    optimizeLoading,
    dbInfo,
    dbInfoLoading,

    // Computed
    maxSize,
    usagePercent,
    isLoading,
    isCleaning,
    isVerifying,
    isRepairing,
    isSavingSettings,
    totalIssues,

    // Actions
    handleClean,
    handlePreview,
    handleEnhancedClean,
    fetchCleanupHistory,
    retryHistory,
    handleResetAccessStats,
    retryAccessStats,
    retryHotFiles,
    fetchBrowserEntries,
    retryBrowser,
    handleDeleteSelectedEntries,
    handleClearHistory,
    handleRefresh,
    handleForceClean,
    handleVerify,
    handleRepair,
    handleSettingsChange,
    handleSaveSettings,
    handleOptimize,
    fetchDbInfo,
    fetchCacheInfo,
  };
}
