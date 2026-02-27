'use client';

import { useCallback, useEffect, useState } from 'react';
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
} from '@/lib/tauri';
import * as tauri from '@/lib/tauri';
import type { CleanType, OperationType } from '@/types/cache';

interface UseCachePageOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
}

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

  const [operationLoading, setOperationLoading] = useState<OperationType | null>(null);
  const [cleaningType, setCleaningType] = useState<CleanType | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<CacheSettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);

  const [useTrash, setUseTrash] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<CleanPreview | null>(null);
  const [previewType, setPreviewType] = useState<CleanType>('all');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cleanupHistory, setCleanupHistory] = useState<CleanupRecord[]>([]);
  const [historySummary, setHistorySummary] = useState<CleanupHistorySummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [accessStats, setAccessStats] = useState<CacheAccessStats | null>(null);
  const [accessStatsLoading, setAccessStatsLoading] = useState(false);

  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserEntries, setBrowserEntries] = useState<CacheEntryItem[]>([]);
  const [browserTotalCount, setBrowserTotalCount] = useState(0);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserSearch, setBrowserSearch] = useState('');
  const [browserTypeFilter, setBrowserTypeFilter] = useState<string>('');
  const [browserSortBy, setBrowserSortBy] = useState<string>('created_desc');
  const [browserPage, setBrowserPage] = useState(0);
  const [browserSelectedKeys, setBrowserSelectedKeys] = useState<Set<string>>(new Set());

  const [hotFiles, setHotFiles] = useState<CacheEntryItem[]>([]);

  const [forceCleanLoading, setForceCleanLoading] = useState(false);
  const [monitorRefreshTrigger, setMonitorRefreshTrigger] = useState(0);

  const fetchAccessStats = useCallback(async () => {
    if (!isTauri()) return;
    setAccessStatsLoading(true);
    try {
      const stats = await tauri.getCacheAccessStats();
      setAccessStats(stats);
    } catch (err) {
      console.error('Failed to fetch access stats:', err);
    } finally {
      setAccessStatsLoading(false);
    }
  }, []);

  const fetchHotFiles = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const entries = await tauri.getTopAccessedEntries(5);
      setHotFiles(entries);
    } catch (err) {
      console.error('Failed to fetch hot files:', err);
    }
  }, []);

  useEffect(() => {
    fetchCacheInfo();
    fetchPlatformInfo();
    fetchCacheSettings();
    fetchAccessStats();
    fetchHotFiles();
  }, [fetchCacheInfo, fetchPlatformInfo, fetchCacheSettings, fetchAccessStats, fetchHotFiles]);

  useEffect(() => {
    if (cacheSettings && !localSettings) {
      setLocalSettings(cacheSettings);
    }
  }, [cacheSettings, localSettings]);

  const handleClean = async (type: CleanType) => {
    setCleaningType(type);
    setOperationLoading('clean');
    try {
      const result = await cleanCache(type);
      toast.success(t('cache.freed', { size: result.freed_human }));
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

  const fetchCleanupHistory = async () => {
    if (!isTauri()) return;
    setHistoryLoading(true);
    try {
      const { getCleanupHistory, getCleanupSummary } = await import('@/lib/tauri');
      const [history, summary] = await Promise.all([
        getCleanupHistory(10),
        getCleanupSummary(),
      ]);
      setCleanupHistory(history);
      setHistorySummary(summary);
    } catch (err) {
      console.error('Failed to fetch cleanup history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

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
      await fetchCacheInfo();
      await fetchCleanupHistory();
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

  const fetchBrowserEntries = async (resetPage = false, explicitPage?: number) => {
    if (!isTauri()) return;
    setBrowserLoading(true);
    const page = resetPage ? 0 : (explicitPage ?? browserPage);
    if (resetPage) setBrowserPage(0);
    try {
      const result = await tauri.listCacheEntries({
        entryType: browserTypeFilter || undefined,
        search: browserSearch || undefined,
        sortBy: browserSortBy,
        limit: 20,
        offset: page * 20,
      });
      setBrowserEntries(result.entries);
      setBrowserTotalCount(result.total_count);
    } catch (err) {
      console.error('Failed to fetch cache entries:', err);
    } finally {
      setBrowserLoading(false);
    }
  };

  const handleDeleteSelectedEntries = async () => {
    if (!isTauri() || browserSelectedKeys.size === 0) return;
    try {
      const keys = Array.from(browserSelectedKeys);
      const deleted = await tauri.deleteCacheEntries(keys, useTrash);
      toast.success(t('cache.entriesDeleted', { count: deleted }));
      setBrowserSelectedKeys(new Set());
      await fetchBrowserEntries();
      await fetchCacheInfo();
    } catch (err) {
      toast.error(`${t('cache.deleteEntriesFailed')}: ${err}`);
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
    } catch (err) {
      toast.error(`${t('cache.historyClearFailed')}: ${err}`);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchCacheInfo();
      setMonitorRefreshTrigger(prev => prev + 1);
      toast.success(t('cache.refreshSuccess'));
    } catch {
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
      fetchCacheInfo();
      setMonitorRefreshTrigger(prev => prev + 1);
    } catch (err) {
      toast.error(`${t('cache.forceCleanFailed')}: ${err}`);
    } finally {
      setForceCleanLoading(false);
    }
  };

  const handleVerify = async () => {
    setOperationLoading('verify');
    try {
      const result = await verifyCacheIntegrity();
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
      const result = await repairCache();
      const repairedCount = result.removed_entries + result.recovered_entries;
      toast.success(t('cache.repairSuccess', { count: repairedCount, size: result.freed_human }));
    } catch (err) {
      toast.error(`${t('cache.repairFailed')}: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

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

    // Operation state
    operationLoading,
    cleaningType,
    settingsOpen,
    setSettingsOpen,
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
    historyOpen,
    setHistoryOpen,
    cleanupHistory,
    historySummary,
    historyLoading,

    // Access stats state
    accessStats,
    accessStatsLoading,

    // Browser state
    browserOpen,
    setBrowserOpen,
    browserEntries,
    browserTotalCount,
    browserLoading,
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

    // Hot files
    hotFiles,

    // Force clean & monitor
    forceCleanLoading,
    monitorRefreshTrigger,
    setMonitorRefreshTrigger,

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
    handleResetAccessStats,
    fetchBrowserEntries,
    handleDeleteSelectedEntries,
    handleClearHistory,
    handleRefresh,
    handleForceClean,
    handleVerify,
    handleRepair,
    handleSettingsChange,
    handleSaveSettings,
    fetchCacheInfo,
  };
}
