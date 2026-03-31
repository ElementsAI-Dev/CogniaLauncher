import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogsPage from './page';
import { toast } from 'sonner';

type MockLogFile = {
  name: string;
  size: number;
  modified: number;
};

const defaultFiles: MockLogFile[] = [
  { name: '2026-02-28_14-27-30.log', size: 1024, modified: 1740000000 },
  { name: '2026-02-27_10-00-00.log', size: 512, modified: 1739900000 },
];

const buildLogFiles = (count: number): MockLogFile[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `session-${String(index + 1).padStart(3, '0')}.log`,
    size: 1000 + index,
    modified: 1740000000 - index,
  }));

const freezeBackgroundLoad = () => {
  mockLoadLogFiles.mockImplementation(() => new Promise(() => {}));
  mockGetLogDirectory.mockImplementation(() => new Promise(() => {}));
};

let mockLogFiles: MockLogFile[] = defaultFiles;
let mockSelectedLogFile: string | null = null;
let mockIsTauri = false;
let mockSearchParams = new URLSearchParams();
let mockCrashReports: Array<Record<string, unknown>> = [];
let mockObservability = {
  runtimeMode: 'desktop-release',
  backendBridgeState: 'available',
  backendBridgeError: null,
  latestCrashCapture: null,
};
let mockLatestDiagnosticAction: {
  kind: 'full_diagnostic_export';
  status: 'success' | 'failed';
  path: string | null;
  error: string | null;
  fileCount: number | null;
  sizeBytes: number | null;
  updatedAt: number;
} | null = null;

const mockSetSelectedLogFile = jest.fn();
const mockSetSearch = jest.fn();
const mockSetFilter = jest.fn();
const mockSetShowBookmarksOnly = jest.fn();
const mockCleanupLogs = jest.fn();
const mockDeleteLogFiles = jest.fn();
const mockDeleteLogFile = jest.fn();
const mockClearLogs = jest.fn();
const mockLoadLogFiles = jest.fn();
const mockLoadCrashReports = jest.fn();
const mockGetLogDirectory = jest.fn();
const mockClearLogFile = jest.fn();
const mockPreviewCleanupLogs = jest.fn();
const mockExportDiagnosticBundle = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'logs.title': 'Logs',
        'logs.description': 'View application logs',
        'logs.workspaceOverview': 'Workspace Overview',
        'logs.workspaceOverviewDescription': 'See runtime health, storage pressure, active context, and the latest workspace action before diving into details.',
        'logs.overviewRuntime': 'Runtime',
        'logs.overviewStorage': 'Storage',
        'logs.overviewContext': 'Context',
        'logs.overviewActiveSession': 'Active Session',
        'logs.overviewCurrentSessionValue': 'Current session protected',
        'logs.overviewFileCountValue': '{count} files',
        'logs.overviewContextRealtime': 'Realtime monitoring',
        'logs.overviewContextFiles': 'Historical file browsing',
        'logs.overviewContextManagement': 'Management and diagnostics',
        'logs.overviewSelectedFile': 'Selected file: {name}',
        'logs.overviewNoFileSelected': 'No file selected',
        'logs.overviewBridgeAttentionTitle': 'Backend bridge needs attention',
        'logs.overviewBridgeAttentionDescription': 'Backend logs are not flowing into the in-app panel right now.',
        'logs.overviewPreviewStaleTitle': 'Cleanup preview is stale',
        'logs.overviewPreviewStaleDescription': 'Refresh preview before running cleanup so the policy context stays aligned.',
        'logs.overviewRecentActionTitle': 'Latest workspace action',
        'logs.overviewNoRecentAction': 'No workspace actions yet',
        'logs.overviewRecentActionDelete': 'Latest delete action',
        'logs.overviewRecentActionCleanup': 'Latest cleanup action',
        'logs.overviewRecentActionDiagnostic': 'Latest diagnostic export',
        'logs.realtime': 'Real-time',
        'logs.files': 'Files',
        'logs.logFiles': 'Log Files',
        'logs.desktopOnly': 'Desktop Only',
        'logs.desktopOnlyDescription': 'Log files are only available in the desktop app.',
        'logs.noFiles': 'No log files found',
        'logs.loadError': 'Failed to load log files',
        'logs.openDir': 'Open Directory',
        'logs.copyDir': 'Copy Folder Path',
        'logs.copyFilePath': 'Copy File Path',
        'logs.exportFullDiagnostic': 'Export Full Diagnostic',
        'logs.openDirError': 'Failed to open directory',
        'logs.viewFile': 'View File',
        'logs.currentSession': 'Current Session',
        'logs.management': 'Management',
        'logs.runtimeMode': 'Runtime Mode',
        'logs.backendBridge': 'Backend Bridge',
        'logs.diagnostics': 'Diagnostics',
        'logs.managementDescription': 'Manage log files and cleanup policy',
        'logs.managementDesktopOnlyDescription': 'Management is available in the desktop app only.',
        'logs.diagnosticsDescription': 'Export diagnostics and inspect recent crash reports.',
        'logs.runtimeModeDesktopDebug': 'Desktop Debug',
        'logs.runtimeModeDesktopRelease': 'Desktop Release',
        'logs.runtimeModeWeb': 'Web',
        'logs.bridgeAvailable': 'Available',
        'logs.bridgeUnavailable': 'Unavailable',
        'logs.bridgeUnsupported': 'Unsupported',
        'logs.needsAttention': 'Needs attention',
        'logs.bridgeGuidanceTitle': 'Backend guidance',
        'logs.bridgeGuidanceDebug': 'Use DevTools to inspect backend activity in debug mode.',
        'logs.bridgeGuidanceRelease': 'Backend logs should be visible in the in-app workspace.',
        'logs.bridgeGuidanceUnavailable': 'Backend bridge is currently unavailable.',
        'logs.latestDiagnosticExport': 'Latest diagnostic export',
        'logs.diagnosticResultMetrics': '{files} files · {size}',
        'logs.refreshCrashReports': 'Refresh crash reports',
        'logs.recentCrashReports': 'Recent crash reports',
        'logs.noCrashReports': 'No crash reports',
        'logs.diagnosticDesktopOnlyDescription': 'Desktop only',
        'logs.webDiagnosticsUnavailable': 'Desktop-only diagnostics are unavailable in web mode.',
        'logs.pendingCrashReport': 'Pending',
        'logs.copyReportPath': 'Copy report path',
        'logs.openReportFolder': 'Open report folder',
        'logs.latestCrashCapture': 'Latest crash capture',
        'logs.statusSkipped': 'Skipped',
        'logs.deleteSelected': 'Delete Selected',
        'logs.deleteConfirmTitle': 'Confirm log deletion',
        'logs.deleteSuccess': 'Deleted {count} log file(s)',
        'logs.deleteFailed': 'Delete failed',
        'logs.cleanupSuccess': 'Cleaned up {count} files, freed {size}',
        'logs.cleanupNone': 'No log files need cleanup',
        'logs.partialWarning': '{count} warning(s) occurred',
        'logs.currentSessionProtectedNotice': 'Current session log is protected and may be skipped.',
        'logs.cleanupSummaryTitle': 'Cleanup result',
        'logs.deleteSummaryTitle': 'Delete result',
        'logs.statusSuccess': 'Success',
        'logs.statusPartialSuccess': 'Partial success',
        'logs.statusFailed': 'Failed',
        'logs.resultSummaryMetrics':
          'Deleted {deleted} file(s), freed {size}, protected {protected}, skipped {skipped}.',
        'logs.reasonCurrentSessionProtected': 'Current session log is protected.',
        'logs.reasonLogFileNotFound': 'Target log file was not found.',
        'logs.reasonLogDeleteFailed': 'Log deletion failed.',
        'logs.reasonStalePolicyContext': 'Policy changed since preview. Refresh preview and retry.',
        'logs.copyPathSuccess': 'Path copied to clipboard',
        'logs.copyPathFailed': 'Failed to copy path',
        'logs.clear': 'Clear logs',
        'logs.pageSize': 'Per page',
        'logs.pageInfo': 'Page {current} of {total}',
        'logs.searchFiles': 'Search log files...',
        'logs.sortBy': 'Sort by',
        'logs.sortNewest': 'Date (newest)',
        'logs.sortOldest': 'Date (oldest)',
        'logs.sortLargest': 'Size (largest)',
        'logs.sortSmallest': 'Size (smallest)',
        'logs.sortName': 'Name (A-Z)',
        'logs.selectAll': 'Select all',
        'logs.deselectAll': 'Deselect all',
        'logs.selectedCount': '{count} selected',
        'logs.noSearchResults': 'No files match your search',
        'common.refresh': 'Refresh',
        'common.cancel': 'Cancel',
        'common.previous': 'Previous',
        'common.next': 'Next',
        'common.delete': 'Delete',
      };
      if (params) {
        let result = translations[key] || key;
        for (const [paramKey, value] of Object.entries(params)) {
          result = result.replace(`{${paramKey}}`, String(value));
        }
        return result;
      }
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/stores/log', () => ({
  useLogStore: () => ({
    logFiles: mockLogFiles,
    getLogStats: () => ({ total: 42, byLevel: { trace: 0, debug: 0, info: 27, warn: 10, error: 5 } }),
    selectedLogFile: mockSelectedLogFile,
    setSelectedLogFile: mockSetSelectedLogFile,
    setSearch: mockSetSearch,
    setFilter: mockSetFilter,
    setShowBookmarksOnly: mockSetShowBookmarksOnly,
    filter: {
      levels: ['info', 'warn', 'error'],
      search: '',
      target: undefined,
      useRegex: false,
      maxScanLines: null,
      startTime: null,
      endTime: null,
    },
  }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/hooks/logs/use-logs', () => ({
  useLogs: () => ({
    cleanupLogs: mockCleanupLogs,
    crashReports: mockCrashReports,
    observability: mockObservability,
    latestDiagnosticAction: mockLatestDiagnosticAction,
    deleteLogFiles: mockDeleteLogFiles,
    deleteLogFile: mockDeleteLogFile,
    clearLogs: mockClearLogs,
    loadLogFiles: mockLoadLogFiles,
    loadCrashReports: mockLoadCrashReports,
    getLogDirectory: mockGetLogDirectory,
    clearLogFile: mockClearLogFile,
    previewCleanupLogs: mockPreviewCleanupLogs,
    exportDiagnosticBundle: mockExportDiagnosticBundle,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/components/log', () => ({
  LogPanel: ({ className }: { className?: string }) => (
    <div data-testid="log-panel" className={className}>
      LogPanel
    </div>
  ),
}));

jest.mock('@/components/log/log-file-viewer', () => ({
  LogFileViewer: ({ open, fileName }: { open: boolean; fileName: string | null }) =>
    open ? (
      <div
        role="dialog"
        aria-label={`Historical Log Viewer: ${fileName ?? ''}`}
        data-testid="log-file-viewer"
        className="w-[min(96vw,72rem)] max-w-5xl max-h-[85dvh] overflow-hidden"
      >
        {fileName}
      </div>
    ) : null,
}));

jest.mock('@/components/log/log-management-card', () => ({
  LogManagementCard: () => <div data-testid="log-management-card">Management</div>,
}));

jest.mock('@/components/log/log-diagnostics-card', () => ({
  LogDiagnosticsCard: () => <div data-testid="log-diagnostics-card">Diagnostics</div>,
}));

jest.mock('@/components/log/log-stats-strip', () => ({
  LogStatsStrip: ({ metrics, latestAction, loading }: {
    metrics: Array<{ id: string; label: string; value: string }>;
    latestAction: { statusLabel: string; title: string; description: string; detail?: string | null } | null;
    loading: boolean;
  }) => (
    <div data-testid="logs-stats-strip">
      {loading && <div>Loading stats...</div>}
      {metrics?.map((m) => (
        <div key={m.id}>{m.label}: {m.value}</div>
      ))}
      {latestAction && (
        <div data-testid="logs-result-summary">
          <span>Latest workspace action</span>
          <span>{latestAction.statusLabel}</span>
          <span>{latestAction.title}</span>
          <span>{latestAction.description}</span>
          {latestAction.detail && <span>{latestAction.detail}</span>}
        </div>
      )}
    </div>
  ),
}));

jest.mock('@/lib/utils', () => ({
  formatBytes: (size: number) => `${size} B`,
  formatDate: (date: number | string) => String(date),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/log', () => ({
  formatSessionLabel: (name: string) => {
    if (name === '2026-02-28_14-27-30.log') return '2026-02-28 14:27:30';
    if (name === '2026-02-27_10-00-00.log') return '2026-02-27 10:00:00';
    return null;
  },
}));

describe('LogsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = false;
    mockSearchParams = new URLSearchParams();
    mockLogFiles = defaultFiles;
    mockSelectedLogFile = null;
    mockCrashReports = [];
    mockObservability = {
      runtimeMode: 'desktop-release',
      backendBridgeState: 'available',
      backendBridgeError: null,
      latestCrashCapture: null,
    };
    mockLatestDiagnosticAction = null;
    mockSetSearch.mockReset();
    mockSetFilter.mockReset();
    mockSetShowBookmarksOnly.mockReset();
    mockLoadLogFiles.mockResolvedValue({ ok: true, data: defaultFiles });
    mockGetLogDirectory.mockResolvedValue({ ok: true, data: '' });
    mockLoadCrashReports.mockResolvedValue({ ok: true, data: [] });
    mockDeleteLogFiles.mockResolvedValue({
      ok: true,
      data: {
        deletedCount: 0,
        freedBytes: 0,
        protectedCount: 0,
        skippedCount: 0,
        status: 'success',
        reasonCode: null,
        warnings: [],
        policyFingerprint: null,
        maxRetentionDays: null,
        maxTotalSizeMb: null,
      },
    });
    mockDeleteLogFile.mockResolvedValue({
      ok: true,
      data: {
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
    });
    mockClearLogFile.mockResolvedValue({
      ok: true,
      data: {
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
    });
    mockCleanupLogs.mockResolvedValue({
      ok: true,
      data: {
        deletedCount: 1,
        freedBytes: 512,
        protectedCount: 0,
        skippedCount: 0,
        status: 'success',
        reasonCode: null,
        warnings: [],
        policyFingerprint: 'v1:30:100',
        maxRetentionDays: 30,
        maxTotalSizeMb: 100,
      },
    });
    mockPreviewCleanupLogs.mockResolvedValue({
      ok: true,
      data: {
        deletedCount: 1,
        freedBytes: 512,
        protectedCount: 1,
        skippedCount: 1,
        status: 'success',
        reasonCode: null,
        warnings: [],
        policyFingerprint: 'v1:30:100',
        maxRetentionDays: 30,
        maxTotalSizeMb: 100,
      },
    });
    mockExportDiagnosticBundle.mockResolvedValue({
      ok: true,
      data: {
        path: 'D:/Diagnostics/cognia-diagnostic.zip',
        size: 2,
        fileCount: 1,
      },
    });
  });

  it('renders page title and tabs', () => {
    render(<LogsPage />);
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Real-time/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Files/ })).toBeInTheDocument();
  });

  it('renders status-first hierarchy in realtime and files tabs', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;

    render(<LogsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Real-time');
    await user.click(screen.getByRole('tab', { name: /Files/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Log Files');
  });

  it('renders a stats strip before tab content and surfaces the latest workspace action', () => {
    mockIsTauri = true;
    mockLatestDiagnosticAction = {
      kind: 'full_diagnostic_export',
      status: 'success',
      path: 'D:/Diagnostics/cognia-diagnostic.zip',
      error: null,
      fileCount: 4,
      sizeBytes: 2048,
      updatedAt: 123,
    };

    render(<LogsPage />);

    expect(screen.getByTestId('logs-stats-strip')).toBeInTheDocument();
    expect(screen.getByText('Latest workspace action')).toBeInTheDocument();
    expect(screen.getByText('Latest diagnostic export')).toBeInTheDocument();

    const overview = screen.getByTestId('logs-workspace-overview');
    const tabs = screen.getByRole('tablist');
    expect(
      overview.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps contextual diagnostics and management visible on desktop realtime', () => {
    mockIsTauri = true;

    render(<LogsPage />);

    const realtimeTab = screen.getByRole('tab', { name: /Real-time/ });
    expect(realtimeTab).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('log-diagnostics-card')).toBeInTheDocument();
    expect(screen.getByTestId('log-management-card')).toBeInTheDocument();
  });

  it('shows desktop-only message in files tab for non-Tauri', async () => {
    const user = userEvent.setup();
    render(<LogsPage />);

    await user.click(screen.getByRole('tab', { name: /Files/ }));

    await waitFor(() => {
      expect(
        screen.getByText('Log files are only available in the desktop app.'),
      ).toBeInTheDocument();
    });
  });

  it('shows explicit management unavailable guidance in non-Tauri mode', async () => {
    const user = userEvent.setup();
    render(<LogsPage />);

    await user.click(screen.getByRole('tab', { name: /Management/ }));

    expect(
      screen.getByText('Management is available in the desktop app only.'),
    ).toBeInTheDocument();
  });

  it('hydrates logs workspace context from route search params', async () => {
    mockSearchParams = new URLSearchParams(
      'tab=files&q=panic&levels=error,warn&bookmarks=1&file=2026-02-27_10-00-00.log',
    );

    render(<LogsPage />);

    await waitFor(() => {
      expect(mockSetSearch).toHaveBeenCalledWith('panic');
      expect(mockSetFilter).toHaveBeenCalledWith({ levels: ['error', 'warn'] });
      expect(mockSetShowBookmarksOnly).toHaveBeenCalledWith(true);
      expect(mockSetSelectedLogFile).toHaveBeenCalledWith('2026-02-27_10-00-00.log');
    });
  });

  it('shows explicit error feedback when manual refresh fails', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;

    render(<LogsPage />);
    await waitFor(() => expect(mockLoadLogFiles).toHaveBeenCalled());

    mockLoadLogFiles.mockResolvedValueOnce({ ok: false, error: 'Failed to load log files' });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load log files');
    });
  });

  it('renders only current page rows when file count exceeds page size', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;
    mockLogFiles = buildLogFiles(25);
    freezeBackgroundLoad();

    render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId('log-file-row');
    expect(rows).toHaveLength(20);
    expect(within(rows[0]).getByText('session-001.log')).toBeInTheDocument();
    expect(screen.queryByText('session-021.log')).not.toBeInTheDocument();
  });

  it('supports page navigation and page-size changes', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;
    mockLogFiles = buildLogFiles(25);
    freezeBackgroundLoad();

    render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('log-file-row')).toHaveLength(5);
    expect(screen.getByText('session-021.log')).toBeInTheDocument();

    const pageSizeInput = screen.getByLabelText('Per page');
    await user.clear(pageSizeInput);
    await user.type(pageSizeInput, '10{enter}');

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('log-file-row')).toHaveLength(10);
  });

  it('keeps selected file count across pages', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;
    mockLogFiles = buildLogFiles(25);
    freezeBackgroundLoad();

    render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    // Skip the select-all checkbox (index 0) and click the first file checkbox
    const firstPageCheckboxes = screen.getAllByRole('checkbox');
    await user.click(firstPageCheckboxes[1]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Delete Selected/i })).toHaveTextContent('(1)');
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });

    const secondPageCheckboxes = screen.getAllByRole('checkbox');
    await user.click(secondPageCheckboxes[1]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Delete Selected/i })).toHaveTextContent('(2)');
    });
  });

  it('shows clear-history action in tauri file management view', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;

    render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    expect(await screen.findByRole('button', { name: 'Clear logs' })).toBeInTheDocument();
  });

  it('requests opening the historical viewer when a log file row is activated', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;

    render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    const rows = await screen.findAllByTestId('log-file-row');
    await user.click(within(rows[1]).getByTitle('View File'));

    expect(mockSetSelectedLogFile).toHaveBeenCalledWith(defaultFiles[1].name);
  });

  it('preserves the bounded historical viewer contract when a file is selected', () => {
    mockIsTauri = true;
    mockSelectedLogFile = defaultFiles[1].name;

    render(<LogsPage />);

    const viewer = screen.getByRole('dialog', {
      name: `Historical Log Viewer: ${defaultFiles[1].name}`,
    });

    expect(viewer).toHaveClass('max-w-5xl');
    expect(viewer).toHaveClass('max-h-[85dvh]');
    expect(viewer).toHaveClass('overflow-hidden');
    expect(viewer).toHaveTextContent(defaultFiles[1].name);
  });

  it('requires confirmation before single-file delete', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;

    render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    const rows = await screen.findAllByTestId('log-file-row');
    const deleteBtn = within(rows[1]).getByTitle('Delete');
    await user.click(deleteBtn);
    expect(screen.getByText('Confirm log deletion')).toBeInTheDocument();

    const confirmDialog = await screen.findByRole('alertdialog');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteLogFile).toHaveBeenCalledWith(defaultFiles[1].name);
      expect(toast.success).toHaveBeenCalledWith('Deleted 1 log file(s)');
    });
  });

  it('shows explicit failure feedback when batch delete fails', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;
    mockDeleteLogFiles.mockResolvedValue({ ok: false, error: 'Delete failed' });

    render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    const checkboxes = await screen.findAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: /Delete Selected/i }));
    expect(screen.getByText('Current session log is protected and may be skipped.')).toBeInTheDocument();
    const confirmDialog = await screen.findByRole('alertdialog');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Delete failed');
    });

    const summary = screen.getByTestId('logs-result-summary');
    expect(summary).toHaveTextContent('Failed');
    expect(summary).toHaveTextContent('Latest delete action');
  });

  it('surfaces partial-success delete feedback in persistent summary', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;
    mockDeleteLogFiles.mockResolvedValue({
      ok: true,
      data: {
        deletedCount: 1,
        freedBytes: 512,
        protectedCount: 1,
        skippedCount: 1,
        status: 'partial_success',
        reasonCode: 'current_session_protected',
        warnings: ['Skipped current session log file: app.log'],
        policyFingerprint: null,
        maxRetentionDays: null,
        maxTotalSizeMb: null,
      },
    });

    render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    const checkboxes = await screen.findAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: /Delete Selected/i }));

    const confirmDialog = await screen.findByRole('alertdialog');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteLogFiles).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Deleted 1 log file(s)');
      expect(toast.info).toHaveBeenCalledWith('1 warning(s) occurred');
    });

    const summary = screen.getByTestId('logs-result-summary');
    expect(summary).toHaveTextContent('Latest workspace action');
    expect(summary).toHaveTextContent('Partial success');
    expect(summary).toHaveTextContent('Latest delete action');
    expect(summary).toHaveTextContent('protected 1');
  });
});
