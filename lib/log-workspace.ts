import type { LogCleanupPreviewResult, LogCleanupResult } from '@/types/tauri';
import { ALL_LEVELS } from '@/lib/constants/log';
import type { LogLevel } from '@/types/log';
import type {
  LogBackendBridgeState,
  LogDiagnosticActionResult,
  LogObservabilitySummary,
  LogRuntimeMode,
} from '@/lib/stores/log';

export type LogsWorkspaceTab = 'realtime' | 'files' | 'management';
export type LogsWorkspaceTone = 'default' | 'success' | 'warning' | 'danger';
export type LogsWorkspaceMutationMode = 'delete' | 'cleanup';

interface SearchParamsLike {
  get(name: string): string | null;
}

export interface LogsWorkspaceMutationRecord {
  mode: LogsWorkspaceMutationMode;
  summary: LogCleanupResult;
  at: number;
}

export interface LogsWorkspaceOverviewMetric {
  id: string;
  label: string;
  value: string;
  detail?: string | null;
  tone?: LogsWorkspaceTone;
}

export interface LogsWorkspaceAttention {
  id: string;
  title: string;
  description: string;
  tone: Exclude<LogsWorkspaceTone, 'default'>;
}

export interface LogsWorkspaceActionSummary {
  id: string;
  title: string;
  statusLabel: string;
  description: string;
  detail?: string | null;
  tone: Exclude<LogsWorkspaceTone, 'default'>;
  timestamp: number;
}

export interface LogsWorkspaceOverview {
  metrics: LogsWorkspaceOverviewMetric[];
  attention: LogsWorkspaceAttention[];
}

export interface LogsWorkspaceRouteContext {
  tab?: LogsWorkspaceTab;
  search?: string;
  levels?: LogLevel[];
  selectedFile?: string;
  showBookmarksOnly?: boolean;
}

interface BuildLogsWorkspaceOverviewArgs {
  activeTab: LogsWorkspaceTab;
  fileCount: number;
  totalSize: number;
  selectedLogFile: string | null;
  currentSessionFileName: string | null;
  observability: LogObservabilitySummary;
  cleanupPreview: LogCleanupPreviewResult | null;
  isCleanupPreviewStale: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatBytes: (value: number) => string;
}

interface GetLatestLogsWorkspaceActionArgs {
  lastMutationSummary: LogsWorkspaceMutationRecord | null;
  latestDiagnosticAction: LogDiagnosticActionResult | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatBytes: (value: number) => string;
}

const ACTION_STATUS_KEYS = {
  success: 'logs.statusSuccess',
  partial_success: 'logs.statusPartialSuccess',
  failed: 'logs.statusFailed',
} as const;
const LOGS_WORKSPACE_PATH = '/logs';
const ROUTE_TAB_VALUES: ReadonlySet<LogsWorkspaceTab> = new Set([
  'realtime',
  'files',
  'management',
]);
const ROUTE_LEVEL_VALUES: ReadonlySet<LogLevel> = new Set(ALL_LEVELS);

function normalizeWorkspaceTab(value: string | null): LogsWorkspaceTab | undefined {
  if (!value) {
    return undefined;
  }
  return ROUTE_TAB_VALUES.has(value as LogsWorkspaceTab)
    ? (value as LogsWorkspaceTab)
    : undefined;
}

function getActionTone(status: 'success' | 'partial_success' | 'failed'): Exclude<LogsWorkspaceTone, 'default'> {
  if (status === 'failed') return 'danger';
  if (status === 'partial_success') return 'warning';
  return 'success';
}

function normalizeRouteLevels(value: string | null): LogLevel[] | undefined {
  if (!value) {
    return undefined;
  }
  const levels = value
    .split(',')
    .map((level) => level.trim())
    .filter((level): level is LogLevel => ROUTE_LEVEL_VALUES.has(level as LogLevel));
  if (levels.length === 0) {
    return undefined;
  }
  return Array.from(new Set(levels));
}

function normalizeRouteBoolean(value: string | null): boolean | undefined {
  if (!value) {
    return undefined;
  }
  if (value === '1' || value === 'true') {
    return true;
  }
  if (value === '0' || value === 'false') {
    return false;
  }
  return undefined;
}

export function buildLogsWorkspaceHref(
  context: LogsWorkspaceRouteContext = {},
): string {
  const params = new URLSearchParams();

  if (context.tab && ROUTE_TAB_VALUES.has(context.tab)) {
    params.set('tab', context.tab);
  }

  const normalizedSearch = context.search?.trim();
  if (normalizedSearch) {
    params.set('q', normalizedSearch);
  }

  if (Array.isArray(context.levels) && context.levels.length > 0) {
    const levels = context.levels.filter((level): level is LogLevel =>
      ROUTE_LEVEL_VALUES.has(level),
    );
    if (levels.length > 0) {
      params.set('levels', Array.from(new Set(levels)).join(','));
    }
  }

  const normalizedFile = context.selectedFile?.trim();
  if (normalizedFile) {
    params.set('file', normalizedFile);
  }

  if (context.showBookmarksOnly === true) {
    params.set('bookmarks', '1');
  }
  if (context.showBookmarksOnly === false) {
    params.set('bookmarks', '0');
  }

  const query = params.toString();
  return query.length > 0 ? `${LOGS_WORKSPACE_PATH}?${query}` : LOGS_WORKSPACE_PATH;
}

export function parseLogsWorkspaceRouteContext(
  searchParams: SearchParamsLike | null | undefined,
): LogsWorkspaceRouteContext | null {
  if (!searchParams) {
    return null;
  }

  const tab = normalizeWorkspaceTab(searchParams.get('tab'));
  const search = searchParams.get('q')?.trim();
  const levels = normalizeRouteLevels(searchParams.get('levels'));
  const selectedFile = searchParams.get('file')?.trim();
  const showBookmarksOnly = normalizeRouteBoolean(searchParams.get('bookmarks'));

  const context: LogsWorkspaceRouteContext = {};
  if (tab) {
    context.tab = tab;
  }
  if (search) {
    context.search = search;
  }
  if (levels && levels.length > 0) {
    context.levels = levels;
  }
  if (selectedFile) {
    context.selectedFile = selectedFile;
  }
  if (typeof showBookmarksOnly === 'boolean') {
    context.showBookmarksOnly = showBookmarksOnly;
  }

  return Object.keys(context).length > 0 ? context : null;
}

export function getLogRuntimeModeLabel(
  runtimeMode: LogRuntimeMode,
  t: (key: string) => string,
): string {
  switch (runtimeMode) {
    case 'desktop-debug':
      return t('logs.runtimeModeDesktopDebug');
    case 'desktop-release':
      return t('logs.runtimeModeDesktopRelease');
    case 'web':
    default:
      return t('logs.runtimeModeWeb');
  }
}

export function getLogBridgeStateLabel(
  bridgeState: LogBackendBridgeState,
  t: (key: string) => string,
): string {
  switch (bridgeState) {
    case 'available':
      return t('logs.bridgeAvailable');
    case 'unavailable':
      return t('logs.bridgeUnavailable');
    case 'unsupported':
    default:
      return t('logs.bridgeUnsupported');
  }
}

function getContextLabel(activeTab: LogsWorkspaceTab, t: (key: string) => string): string {
  switch (activeTab) {
    case 'files':
      return t('logs.overviewContextFiles');
    case 'management':
      return t('logs.overviewContextManagement');
    case 'realtime':
    default:
      return t('logs.overviewContextRealtime');
  }
}

function formatMutationDescription(
  mode: LogsWorkspaceMutationMode,
  summary: LogCleanupResult,
  t: (key: string, params?: Record<string, string | number>) => string,
  formatBytes: (value: number) => string,
): { title: string; description: string; detail?: string | null; tone: Exclude<LogsWorkspaceTone, 'default'>; statusLabel: string } {
  const titleKey =
    mode === 'cleanup'
      ? 'logs.overviewRecentActionCleanup'
      : 'logs.overviewRecentActionDelete';
  const tone = getActionTone(summary.status);
  const statusLabel = t(ACTION_STATUS_KEYS[summary.status]);
  const description =
    mode === 'cleanup'
      ? t('logs.resultSummaryMetrics', {
          deleted: summary.deletedCount,
          size: formatBytes(summary.freedBytes),
          protected: summary.protectedCount,
          skipped: summary.skippedCount,
        })
      : t('logs.resultSummaryMetrics', {
          deleted: summary.deletedCount,
          size: formatBytes(summary.freedBytes),
          protected: summary.protectedCount,
          skipped: summary.skippedCount,
        });
  const detail =
    summary.warnings.length > 0
      ? summary.warnings.join(' | ')
      : summary.reasonCode ?? null;

  return {
    title: t(titleKey),
    description,
    detail,
    tone,
    statusLabel,
  };
}

function formatDiagnosticDescription(
  result: LogDiagnosticActionResult,
  t: (key: string, params?: Record<string, string | number>) => string,
  formatBytes: (value: number) => string,
): { title: string; description: string; detail?: string | null; tone: Exclude<LogsWorkspaceTone, 'default'>; statusLabel: string } {
  const tone: Exclude<LogsWorkspaceTone, 'default'> =
    result.status === 'failed' ? 'danger' : 'success';
  const statusLabel = t(result.status === 'failed' ? 'logs.statusFailed' : 'logs.statusSuccess');
  const description =
    result.fileCount != null && result.sizeBytes != null
      ? t('logs.diagnosticResultMetrics', {
          files: result.fileCount,
          size: formatBytes(result.sizeBytes),
        })
      : result.error ?? statusLabel;
  const detail = result.path ?? result.error;

  return {
    title: t('logs.overviewRecentActionDiagnostic'),
    description,
    detail,
    tone,
    statusLabel,
  };
}

export function getLatestLogsWorkspaceAction({
  lastMutationSummary,
  latestDiagnosticAction,
  t,
  formatBytes,
}: GetLatestLogsWorkspaceActionArgs): LogsWorkspaceActionSummary | null {
  const mutationTimestamp = lastMutationSummary?.at ?? -1;
  const diagnosticTimestamp = latestDiagnosticAction?.updatedAt ?? -1;

  if (!lastMutationSummary && !latestDiagnosticAction) {
    return null;
  }

  if (diagnosticTimestamp > mutationTimestamp && latestDiagnosticAction) {
    const derived = formatDiagnosticDescription(latestDiagnosticAction, t, formatBytes);
    return {
      id: 'diagnostic-action',
      timestamp: latestDiagnosticAction.updatedAt,
      ...derived,
    };
  }

  if (lastMutationSummary) {
    const derived = formatMutationDescription(
      lastMutationSummary.mode,
      lastMutationSummary.summary,
      t,
      formatBytes,
    );
    return {
      id: `${lastMutationSummary.mode}-action`,
      timestamp: lastMutationSummary.at,
      ...derived,
    };
  }

  return null;
}

export function buildLogsWorkspaceOverview({
  activeTab,
  fileCount,
  totalSize,
  selectedLogFile,
  currentSessionFileName,
  observability,
  cleanupPreview,
  isCleanupPreviewStale,
  t,
  formatBytes,
}: BuildLogsWorkspaceOverviewArgs): LogsWorkspaceOverview {
  const metrics: LogsWorkspaceOverviewMetric[] = [
    {
      id: 'runtime',
      label: t('logs.overviewRuntime'),
      value: getLogRuntimeModeLabel(observability.runtimeMode, t),
      detail: getLogBridgeStateLabel(observability.backendBridgeState, t),
      tone: observability.backendBridgeState === 'unavailable' ? 'warning' : 'default',
    },
    {
      id: 'storage',
      label: t('logs.overviewStorage'),
      value: t('logs.overviewFileCountValue', { count: fileCount }),
      detail: formatBytes(totalSize),
      tone: fileCount > 0 ? 'default' : 'warning',
    },
    {
      id: 'context',
      label: t('logs.overviewContext'),
      value: getContextLabel(activeTab, t),
      detail:
        selectedLogFile != null
          ? t('logs.overviewSelectedFile', { name: selectedLogFile })
          : t('logs.overviewNoFileSelected'),
    },
    {
      id: 'session',
      label: t('logs.overviewActiveSession'),
      value:
        currentSessionFileName != null
          ? t('logs.overviewCurrentSessionValue')
          : t('logs.overviewNoFileSelected'),
      detail:
        selectedLogFile != null
          ? t('logs.overviewSelectedFile', { name: selectedLogFile })
          : currentSessionFileName,
      tone: currentSessionFileName != null ? 'success' : 'default',
    },
  ];

  const attention: LogsWorkspaceAttention[] = [];

  if (observability.backendBridgeState === 'unavailable') {
    attention.push({
      id: 'backend-bridge',
      title: t('logs.overviewBridgeAttentionTitle'),
      description: t('logs.overviewBridgeAttentionDescription'),
      tone: 'warning',
    });
  }

  if (cleanupPreview && isCleanupPreviewStale) {
    attention.push({
      id: 'cleanup-preview-stale',
      title: t('logs.overviewPreviewStaleTitle'),
      description: t('logs.overviewPreviewStaleDescription'),
      tone: 'warning',
    });
  }

  return {
    metrics,
    attention,
  };
}
