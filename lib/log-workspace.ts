import type { LogCleanupPreviewResult, LogCleanupResult } from '@/types/tauri';
import type {
  LogBackendBridgeState,
  LogDiagnosticActionResult,
  LogObservabilitySummary,
  LogRuntimeMode,
} from '@/lib/stores/log';

export type LogsWorkspaceTab = 'realtime' | 'files' | 'management';
export type LogsWorkspaceTone = 'default' | 'success' | 'warning' | 'danger';
export type LogsWorkspaceMutationMode = 'delete' | 'cleanup';

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

interface BuildLogsWorkspaceOverviewArgs {
  activeTab: LogsWorkspaceTab;
  fileCount: number;
  totalSize: number;
  selectedLogFile: string | null;
  currentSessionFileName: string | null;
  observability: LogObservabilitySummary;
  cleanupPreview: LogCleanupPreviewResult | null;
  isCleanupPreviewStale: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
  formatBytes: (value: number) => string;
}

interface GetLatestLogsWorkspaceActionArgs {
  lastMutationSummary: LogsWorkspaceMutationRecord | null;
  latestDiagnosticAction: LogDiagnosticActionResult | null;
  t: (key: string, params?: Record<string, unknown>) => string;
  formatBytes: (value: number) => string;
}

const ACTION_STATUS_KEYS = {
  success: 'logs.statusSuccess',
  partial_success: 'logs.statusPartialSuccess',
  failed: 'logs.statusFailed',
} as const;

function getActionTone(status: 'success' | 'partial_success' | 'failed'): Exclude<LogsWorkspaceTone, 'default'> {
  if (status === 'failed') return 'danger';
  if (status === 'partial_success') return 'warning';
  return 'success';
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
  t: (key: string, params?: Record<string, unknown>) => string,
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
  t: (key: string, params?: Record<string, unknown>) => string,
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
