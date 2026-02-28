import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogsPage from './page';

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
        'common.refresh': 'Refresh',
      };
      if (params) {
        let result = translations[key] || key;
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, String(v));
        }
        return result;
      }
      return translations[key] || key;
    },
  }),
}));

const mockSetLogFiles = jest.fn();
const mockSetSelectedLogFile = jest.fn();

jest.mock('@/lib/stores/log', () => ({
  useLogStore: () => ({
    logFiles: [
      { name: '2026-02-28_14-27-30.log', size: 1024, modified: 1740000000 },
      { name: '2026-02-27_10-00-00.log', size: 512, modified: 1739900000 },
    ],
    setLogFiles: mockSetLogFiles,
    getLogStats: () => ({ total: 42, error: 5, warn: 10, info: 27 }),
    selectedLogFile: null,
    setSelectedLogFile: mockSetSelectedLogFile,
  }),
}));

jest.mock('@/hooks/use-logs', () => ({
  useLogs: () => ({
    cleanupLogs: jest.fn().mockResolvedValue(null),
    deleteLogFiles: jest.fn().mockResolvedValue(null),
    getTotalSize: jest.fn().mockResolvedValue(0),
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn().mockReturnValue(false),
  logListFiles: jest.fn().mockResolvedValue([]),
  logGetDir: jest.fn().mockResolvedValue(''),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/components/log', () => ({
  LogPanel: ({ className }: { className?: string }) => (
    <div data-testid="log-panel" className={className}>LogPanel</div>
  ),
}));

jest.mock('@/components/log/log-file-viewer', () => ({
  LogFileViewer: ({ open, fileName }: { open: boolean; fileName: string | null }) => (
    open ? <div data-testid="log-file-viewer">{fileName}</div> : null
  ),
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

    const filesTab = screen.getByText('Files');
    await user.click(filesTab);

    await waitFor(() => {
      expect(screen.getByText('Desktop Only')).toBeInTheDocument();
    });
  });

  it('renders refresh button', () => {
    render(<LogsPage />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('renders management tab (visible on mobile)', () => {
    render(<LogsPage />);
    expect(screen.getByText('Management')).toBeInTheDocument();
  });
});
