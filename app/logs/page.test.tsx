import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogsPage from './page';

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
  mockLogListFiles.mockImplementation(() => new Promise(() => {}));
  mockLogGetDir.mockImplementation(() => new Promise(() => {}));
  mockGetTotalSize.mockImplementation(() => new Promise(() => {}));
};

let mockLogFiles: MockLogFile[] = defaultFiles;
let mockSelectedLogFile: string | null = null;
let mockIsTauri = false;

const mockSetLogFiles = jest.fn();
const mockSetSelectedLogFile = jest.fn();
const mockCleanupLogs = jest.fn().mockResolvedValue(null);
const mockDeleteLogFiles = jest.fn().mockResolvedValue(null);
const mockGetTotalSize = jest.fn().mockResolvedValue(0);
const mockClearLogs = jest.fn();
const mockLogListFiles = jest.fn().mockResolvedValue([]);
const mockLogGetDir = jest.fn().mockResolvedValue('');

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
        'logs.openDirError': 'Failed to open directory',
        'logs.viewFile': 'View File',
        'logs.currentSession': 'Current Session',
        'logs.management': 'Management',
        'logs.deleteSelected': 'Delete Selected',
        'logs.pageSize': 'Per page',
        'logs.pageInfo': 'Page {current} of {total}',
        'common.refresh': 'Refresh',
        'common.previous': 'Previous',
        'common.next': 'Next',
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
    setLogFiles: mockSetLogFiles,
    getLogStats: () => ({ total: 42, error: 5, warn: 10, info: 27 }),
    selectedLogFile: mockSelectedLogFile,
    setSelectedLogFile: mockSetSelectedLogFile,
  }),
}));

jest.mock('@/hooks/use-logs', () => ({
  useLogs: () => ({
    cleanupLogs: mockCleanupLogs,
    deleteLogFiles: mockDeleteLogFiles,
    getTotalSize: mockGetTotalSize,
    clearLogs: mockClearLogs,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri,
  logListFiles: () => mockLogListFiles(),
  logGetDir: () => mockLogGetDir(),
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
    open ? <div data-testid="log-file-viewer">{fileName}</div> : null,
}));

jest.mock('@/components/log/log-management-card', () => ({
  LogManagementCard: () => <div data-testid="log-management-card">Management</div>,
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
    mockDeleteLogFiles.mockResolvedValue(null);
    mockLogListFiles.mockResolvedValue([]);
    mockLogGetDir.mockResolvedValue('');
    mockGetTotalSize.mockResolvedValue(0);
  });

  it('renders page title', () => {
    render(<LogsPage />);
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('renders realtime and files tabs', () => {
    render(<LogsPage />);
    expect(screen.getByText('Real-time')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('renders log stats badge in realtime tab', () => {
    render(<LogsPage />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders log files count badge', () => {
    render(<LogsPage />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows desktop-only message in files tab for non-Tauri', async () => {
    const user = userEvent.setup();
    render(<LogsPage />);

    await user.click(screen.getByRole('tab', { name: /Files/ }));

    await waitFor(() => {
      expect(screen.getByText('Desktop Only')).toBeInTheDocument();
    });
  });

  it('keeps files tab content bounded to avoid competing page scroll', async () => {
    const user = userEvent.setup();
    render(<LogsPage />);

    await user.click(screen.getByRole('tab', { name: /Files/ }));

    const filesTabContent = screen.getByTestId('logs-files-tab-content');

    expect(filesTabContent).toHaveClass('min-h-0');
    expect(filesTabContent).toHaveClass('overflow-hidden');
    expect(filesTabContent).not.toHaveClass('overflow-auto');
  });

  it('renders refresh button', () => {
    render(<LogsPage />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('renders management tab (visible on mobile)', () => {
    render(<LogsPage />);
    expect(screen.getByText('Management')).toBeInTheDocument();
  });

  it('renders only the current page rows when file count exceeds page size', async () => {
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

  it('uses bounded file-list scroll area and triggers history viewer selection in Tauri mode', async () => {
    const user = userEvent.setup();
    mockIsTauri = true;
    mockLogFiles = defaultFiles;
    freezeBackgroundLoad();
    mockSetSelectedLogFile.mockImplementation((fileName: string | null) => {
      mockSelectedLogFile = fileName;
    });

    const { rerender } = render(<LogsPage />);
    await user.click(screen.getByRole('tab', { name: /Files/ }));

    const filesTabContent = screen.getByTestId('logs-files-tab-content');
    const filesListScrollArea = screen.getByTestId('logs-files-list-scroll-area');

    expect(filesTabContent).toHaveClass('min-h-0');
    expect(filesTabContent).toHaveClass('overflow-hidden');
    expect(filesListScrollArea).toHaveClass('h-full');
    expect(filesListScrollArea).toHaveClass('min-h-0');
    expect(filesListScrollArea).not.toHaveClass('max-h-[calc(100vh-320px)]');

    const rows = screen.getAllByTestId('log-file-row');
    await user.click(rows[1]);

    expect(mockSetSelectedLogFile).toHaveBeenCalledWith(defaultFiles[1].name);

    rerender(<LogsPage />);
    expect(screen.getByTestId('log-file-viewer')).toHaveTextContent(defaultFiles[1].name);
  });
});
