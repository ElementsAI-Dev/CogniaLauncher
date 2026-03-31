import {
  buildLogsWorkspaceOverview,
  buildLogsWorkspaceHref,
  getLatestLogsWorkspaceAction,
  parseLogsWorkspaceRouteContext,
} from './log-workspace';
import type { LogCleanupPreviewResult } from '@/types/tauri';
import type { LogObservabilitySummary } from './stores/log';

const t = (key: string, params?: Record<string, unknown>) => {
  const translations: Record<string, string> = {
    'logs.runtimeModeDesktopDebug': 'Desktop Debug',
    'logs.runtimeModeDesktopRelease': 'Desktop Release',
    'logs.runtimeModeWeb': 'Web',
    'logs.bridgeAvailable': 'Available',
    'logs.bridgeUnavailable': 'Unavailable',
    'logs.bridgeUnsupported': 'Unsupported',
    'logs.overviewRuntime': 'Runtime',
    'logs.overviewStorage': 'Storage',
    'logs.overviewContext': 'Context',
    'logs.overviewActiveSession': 'Active Session',
    'logs.overviewCurrentSessionValue': 'Current session protected',
    'logs.overviewContextRealtime': 'Realtime monitoring',
    'logs.overviewContextFiles': 'Historical file browsing',
    'logs.overviewContextManagement': 'Management and diagnostics',
    'logs.overviewSelectedFile': 'Selected file: {name}',
    'logs.overviewNoFileSelected': 'No file selected',
    'logs.overviewBridgeAttentionTitle': 'Backend bridge needs attention',
    'logs.overviewBridgeAttentionDescription': 'Backend logs are not flowing into the in-app panel right now.',
    'logs.overviewPreviewStaleTitle': 'Cleanup preview is stale',
    'logs.overviewPreviewStaleDescription': 'Refresh preview before cleanup.',
    'logs.overviewRecentActionDelete': 'Latest delete action',
    'logs.overviewRecentActionCleanup': 'Latest cleanup action',
    'logs.overviewRecentActionDiagnostic': 'Latest diagnostic export',
    'logs.statusSuccess': 'Success',
    'logs.statusPartialSuccess': 'Partial success',
    'logs.statusFailed': 'Failed',
    'logs.overviewFileCountValue': '{count} files',
  };

  let result = translations[key] || key;
  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      result = result.replace(`{${paramKey}}`, String(value));
    }
  }
  return result;
};

describe('log workspace helpers', () => {
  const observability: LogObservabilitySummary = {
    runtimeMode: 'desktop-release',
    backendBridgeState: 'available',
    backendBridgeError: null,
    latestCrashCapture: null,
  };

  it('prefers the newest workspace action across mutation and diagnostic results', () => {
    const latest = getLatestLogsWorkspaceAction({
      lastMutationSummary: {
        mode: 'delete',
        at: 10,
        summary: {
          deletedCount: 1,
          freedBytes: 512,
          protectedCount: 0,
          skippedCount: 0,
          status: 'success',
          reasonCode: null,
          warnings: [],
          policyFingerprint: null,
          maxRetentionDays: null,
          maxTotalSizeMb: null,
        },
      },
      latestDiagnosticAction: {
        kind: 'full_diagnostic_export',
        status: 'failed',
        path: null,
        error: 'boom',
        fileCount: null,
        sizeBytes: null,
        updatedAt: 20,
      },
      t,
      formatBytes: (value: number) => `${value} B`,
    });

    expect(latest).toEqual(
      expect.objectContaining({
        title: 'Latest diagnostic export',
        statusLabel: 'Failed',
        tone: 'danger',
        timestamp: 20,
      }),
    );
  });

  it('builds overview metrics and attention items for stale preview and bridge problems', () => {
    const previewResult: LogCleanupPreviewResult = {
      deletedCount: 1,
      freedBytes: 100,
      protectedCount: 0,
      skippedCount: 0,
      status: 'success',
      reasonCode: null,
      warnings: [],
      policyFingerprint: 'v1:30:100',
      maxRetentionDays: 30,
      maxTotalSizeMb: 100,
    };

    const overview = buildLogsWorkspaceOverview({
      activeTab: 'files',
      fileCount: 3,
      totalSize: 4096,
      selectedLogFile: 'history.log',
      currentSessionFileName: 'current.log',
      observability: {
        ...observability,
        backendBridgeState: 'unavailable',
      },
      cleanupPreview: previewResult,
      isCleanupPreviewStale: true,
      t,
      formatBytes: (value: number) => `${value} B`,
    });

    expect(overview.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Runtime', value: 'Desktop Release' }),
        expect.objectContaining({ label: 'Storage', value: '3 files', detail: '4096 B' }),
        expect.objectContaining({ label: 'Context', value: 'Historical file browsing' }),
        expect.objectContaining({ label: 'Active Session', detail: 'Selected file: history.log' }),
      ]),
    );
    expect(overview.attention).toEqual([
      expect.objectContaining({ title: 'Backend bridge needs attention' }),
      expect.objectContaining({ title: 'Cleanup preview is stale' }),
    ]);
  });

  it('builds a logs workspace href with normalized route context', () => {
    const href = buildLogsWorkspaceHref({
      tab: 'files',
      search: ' panic ',
      levels: ['error', 'warn', 'error'],
      selectedFile: 'session.log',
      showBookmarksOnly: true,
    });

    expect(href).toBe(
      '/logs?tab=files&q=panic&levels=error%2Cwarn&file=session.log&bookmarks=1',
    );
  });

  it('parses route context and ignores invalid values', () => {
    const params = new URLSearchParams(
      'tab=files&q=panic&levels=error,warn,invalid&file=trace.log&bookmarks=0',
    );

    expect(parseLogsWorkspaceRouteContext(params)).toEqual({
      tab: 'files',
      search: 'panic',
      levels: ['error', 'warn'],
      selectedFile: 'trace.log',
      showBookmarksOnly: false,
    });
  });
});
