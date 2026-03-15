import type {
  CacheAccessStats,
  CacheEntryItem,
  CacheInfo,
  CacheSizeMonitor,
  CacheVerificationResult,
  CleanupHistorySummary,
} from '@/lib/tauri';

export type CacheInsightTone = 'default' | 'success' | 'warning' | 'danger' | 'muted';
export type CacheInsightFreshnessState = 'fresh' | 'stale' | 'missing';
export type CacheScopeInsightId = 'internal' | 'default_downloads' | 'external';
export type CacheScopeInsightStatus =
  | 'available'
  | 'healthy'
  | 'watch'
  | 'unavailable'
  | 'snapshot_pending';
export type CacheScopeCoverage = 'historical' | 'snapshot';
export type CacheOverviewActionId =
  | 'repair'
  | 'clean'
  | 'entries'
  | 'history'
  | 'external'
  | 'monitor';

export interface CacheReadStateLike {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  lastUpdatedAt: number | null;
}

export interface CacheScopeInsight {
  id: CacheScopeInsightId;
  titleKey: string;
  sizeHuman: string;
  entryCount: number | null;
  status: CacheScopeInsightStatus;
  statusLabelKey: string;
  tone: CacheInsightTone;
  coverage: CacheScopeCoverage;
  coverageLabelKey: string;
}

export interface CacheOverviewAction {
  id: CacheOverviewActionId;
  titleKey: string;
  descriptionKey: string;
  ctaKey: string;
  tone: CacheInsightTone;
  targetTab: 'overview' | 'entries' | 'external' | 'history';
  targetId: string | null;
}

export interface CacheOverviewInsights {
  scopeSummaries: CacheScopeInsight[];
  primaryAction: CacheOverviewAction;
  secondaryActions: CacheOverviewAction[];
  freshness: {
    state: CacheInsightFreshnessState;
    lastUpdatedAt: number | null;
  };
}

export interface CacheOverviewInsightsInput {
  cacheInfo: CacheInfo | null;
  monitor: CacheSizeMonitor | null;
  accessStats: CacheAccessStats | null;
  accessStatsReadState: CacheReadStateLike;
  hotFiles: CacheEntryItem[];
  hotFilesReadState: CacheReadStateLike;
  historySummary: CleanupHistorySummary | null;
  historyReadState: CacheReadStateLike;
  cacheVerification: CacheVerificationResult | null;
  totalIssues: number;
  now?: number;
}

const FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000;

function internalEntryCount(cacheInfo: CacheInfo | null) {
  if (!cacheInfo) return null;
  return (cacheInfo.download_cache?.entry_count ?? 0) + (cacheInfo.metadata_cache?.entry_count ?? 0);
}

function internalSizeHuman(cacheInfo: CacheInfo | null, monitor: CacheSizeMonitor | null) {
  if (monitor?.internalSizeHuman) return monitor.internalSizeHuman;
  if (!cacheInfo) return '0 B';
  return cacheInfo.total_size_human ?? (typeof cacheInfo.total_size === 'number' ? `${cacheInfo.total_size}` : '0 B');
}

function usagePercent(cacheInfo: CacheInfo | null, monitor: CacheSizeMonitor | null) {
  if (typeof cacheInfo?.usage_percent === 'number') return cacheInfo.usage_percent;
  if (typeof monitor?.usagePercent === 'number') return monitor.usagePercent;
  if (cacheInfo?.max_size) {
    return Math.round((cacheInfo.total_size / Math.max(cacheInfo.max_size, 1)) * 100);
  }
  return 0;
}

function freshnessFromStates(
  states: CacheReadStateLike[],
  now: number,
): CacheOverviewInsights['freshness'] {
  const lastUpdatedAt = states.reduce<number | null>((latest, state) => {
    if (!state.lastUpdatedAt) return latest;
    if (latest === null || state.lastUpdatedAt > latest) return state.lastUpdatedAt;
    return latest;
  }, null);

  if (lastUpdatedAt === null) {
    return {
      state: 'missing',
      lastUpdatedAt: null,
    };
  }

  return {
    state: now - lastUpdatedAt <= FRESHNESS_THRESHOLD_MS ? 'fresh' : 'stale',
    lastUpdatedAt,
  };
}

function scopeSummaries(
  input: CacheOverviewInsightsInput,
): CacheScopeInsight[] {
  const cacheInfo = input.cacheInfo;
  const monitor = input.monitor;
  const percent = usagePercent(cacheInfo, monitor);
  const internalTone: CacheInsightTone = percent >= 90 ? 'danger' : percent >= 80 ? 'warning' : 'success';
  const internalStatus: CacheScopeInsightStatus = percent >= 80 ? 'watch' : 'healthy';

  return [
    {
      id: 'internal',
      titleKey: 'cache.insightInternalTitle',
      sizeHuman: internalSizeHuman(cacheInfo, monitor),
      entryCount: internalEntryCount(cacheInfo),
      status: internalStatus,
      statusLabelKey:
        internalStatus === 'watch'
          ? 'cache.insightStatusWatch'
          : 'cache.insightStatusHealthy',
      tone: internalTone,
      coverage: 'historical',
      coverageLabelKey: 'cache.insightCoverageHistorical',
    },
    {
      id: 'default_downloads',
      titleKey: 'cache.defaultDownloads',
      sizeHuman: cacheInfo?.default_downloads?.size_human ?? monitor?.defaultDownloadsSizeHuman ?? '0 B',
      entryCount:
        cacheInfo?.default_downloads?.entry_count ??
        monitor?.defaultDownloadsCount ??
        0,
      status:
        cacheInfo?.default_downloads?.is_available === false ||
        monitor?.defaultDownloadsAvailable === false
          ? 'unavailable'
          : 'available',
      statusLabelKey:
        cacheInfo?.default_downloads?.is_available === false ||
        monitor?.defaultDownloadsAvailable === false
          ? 'cache.insightStatusUnavailable'
          : 'cache.insightStatusAvailable',
      tone:
        cacheInfo?.default_downloads?.is_available === false ||
        monitor?.defaultDownloadsAvailable === false
          ? 'muted'
          : 'default',
      coverage: 'snapshot',
      coverageLabelKey: 'cache.insightCoverageSnapshot',
    },
    {
      id: 'external',
      titleKey: 'cache.externalPanelTitle',
      sizeHuman: monitor?.externalSizeHuman ?? '0 B',
      entryCount: monitor?.externalCaches.length ?? null,
      status: monitor ? 'available' : 'snapshot_pending',
      statusLabelKey: monitor
        ? 'cache.insightStatusAvailable'
        : 'cache.insightStatusSnapshotPending',
      tone: !monitor
        ? 'muted'
        : (monitor.externalSize > Math.max(monitor.internalSize, 0) && monitor.externalSize > 0)
          ? 'warning'
          : monitor.externalSize > 0
            ? 'default'
            : 'muted',
      coverage: 'snapshot',
      coverageLabelKey: 'cache.insightCoverageSnapshot',
    },
  ];
}

function createAction(id: CacheOverviewActionId): CacheOverviewAction {
  switch (id) {
    case 'repair':
      return {
        id,
        titleKey: 'cache.insightActionRepairTitle',
        descriptionKey: 'cache.insightActionRepairDesc',
        ctaKey: 'cache.insightActionRepairCta',
        tone: 'danger',
        targetTab: 'overview',
        targetId: 'cache-health',
      };
    case 'clean':
      return {
        id,
        titleKey: 'cache.insightActionCleanTitle',
        descriptionKey: 'cache.insightActionCleanDesc',
        ctaKey: 'cache.insightActionCleanCta',
        tone: 'danger',
        targetTab: 'overview',
        targetId: 'cache-types',
      };
    case 'entries':
      return {
        id,
        titleKey: 'cache.insightActionEntriesTitle',
        descriptionKey: 'cache.insightActionEntriesDesc',
        ctaKey: 'cache.insightActionEntriesCta',
        tone: 'default',
        targetTab: 'entries',
        targetId: null,
      };
    case 'history':
      return {
        id,
        titleKey: 'cache.insightActionHistoryTitle',
        descriptionKey: 'cache.insightActionHistoryDesc',
        ctaKey: 'cache.insightActionHistoryCta',
        tone: 'warning',
        targetTab: 'history',
        targetId: null,
      };
    case 'external':
      return {
        id,
        titleKey: 'cache.insightActionExternalTitle',
        descriptionKey: 'cache.insightActionExternalDesc',
        ctaKey: 'cache.insightActionExternalCta',
        tone: 'warning',
        targetTab: 'external',
        targetId: null,
      };
    case 'monitor':
    default:
      return {
        id: 'monitor',
        titleKey: 'cache.insightActionMonitorTitle',
        descriptionKey: 'cache.insightActionMonitorDesc',
        ctaKey: 'cache.insightActionMonitorCta',
        tone: 'success',
        targetTab: 'overview',
        targetId: 'cache-monitor',
      };
  }
}

function primaryAction(input: CacheOverviewInsightsInput): CacheOverviewAction {
  const percent = usagePercent(input.cacheInfo, input.monitor);

  if (input.totalIssues > 0 || input.cacheVerification?.is_healthy === false) {
    return createAction('repair');
  }

  if (percent >= 90) {
    return createAction('clean');
  }

  if (input.historyReadState.status === 'error') {
    return createAction('history');
  }

  if (input.monitor && input.monitor.externalSize > Math.max(input.monitor.internalSize, 0)) {
    return createAction('external');
  }

  if (input.hotFiles.length > 0 || input.accessStats?.total_requests) {
    return createAction('entries');
  }

  return createAction('monitor');
}

export function deriveCacheOverviewInsights(
  input: CacheOverviewInsightsInput,
): CacheOverviewInsights {
  const now = input.now ?? Date.now();
  const primary = primaryAction(input);
  const freshness = freshnessFromStates(
    [
      input.accessStatsReadState,
      input.hotFilesReadState,
      input.historyReadState,
    ],
    now,
  );

  const secondaryOrder: CacheOverviewActionId[] = ['clean', 'entries', 'history', 'external', 'monitor'];
  const secondaryActions = secondaryOrder
    .filter((id) => id !== primary.id)
    .map((id) => createAction(id));

  return {
    scopeSummaries: scopeSummaries(input),
    primaryAction: primary,
    secondaryActions,
    freshness,
  };
}
