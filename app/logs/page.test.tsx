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

const mockSetSelectedLogFile = jest.fn();
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
  }),
}));

jest.mock('@/hooks/use-logs', () => ({
  useLogs: () => ({
    cleanupLogs: mockCleanupLogs,
    crashReports: [],
    observability: {
      runtimeMode: 'desktop-release',
      backendBridgeState: 'available',
      backendBridgeError: null,
      latestCrashCapture: null,
    },
    latestDiagnosticAction: null,
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
    mockLogFiles = defaultFiles;
    mockSelectedLogFile = null;
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

  it('shows desktop-only message in files tab for non-Tauri', async () => {
    const user = userEvent.setup();
    render(<LogsPage />);

    await user.click(screen.getByRole('tab', { name: /Files/ }));

    await waitFor(() => {
      expect(screen.getByText('Desktop Only')).toBeInTheDocument();
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

    expect(screen.getAllByTestId('log-file-row')).toHaveLength(20);
    expect(screen.getByText('session-001.log')).toBeInTheDocument();
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

    const firstPageCheckboxes = screen.getAllByRole('checkbox');
    await user.click(firstPageCheckboxes[0]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Delete Selected/i })).toHaveTextContent('(1)');
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });

    const secondPageCheckboxes = screen.getAllByRole('checkbox');
    await user.click(secondPageCheckboxes[0]);
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
    expect(summary).toHaveTextContent('Delete result');
    expect(summary).toHaveTextContent('Partial success');
    expect(summary).toHaveTextContent('protected 1');
  });
});
