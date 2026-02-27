import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogsPage from './page';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
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
        'common.refresh': 'Refresh',
      };
      return translations[key] || key;
    },
  }),
}));

const mockSetLogFiles = jest.fn();
const mockSetSelectedLogFile = jest.fn();

jest.mock('@/lib/stores/log', () => ({
  useLogStore: () => ({
    logFiles: [
      { name: 'app.log', size: 1024, modified: '2025-01-01T00:00:00Z' },
      { name: 'error.log', size: 512, modified: '2025-01-02T00:00:00Z' },
    ],
    setLogFiles: mockSetLogFiles,
    getLogStats: () => ({ total: 42, error: 5, warn: 10, info: 27 }),
    selectedLogFile: null,
    setSelectedLogFile: mockSetSelectedLogFile,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn().mockReturnValue(false),
  logListFiles: jest.fn().mockResolvedValue([]),
  logGetDir: jest.fn().mockResolvedValue(''),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
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

jest.mock('@/lib/utils', () => ({
  formatBytes: (size: number) => `${size} B`,
  formatDate: (date: string) => date,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
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
});
