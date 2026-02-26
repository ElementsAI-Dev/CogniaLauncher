import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadsPage from './page';
import { LocaleProvider } from '@/components/providers/locale-provider';
import type { DownloadTask, HistoryRecord, QueueStats } from '@/lib/stores/download';

jest.mock('@/hooks/use-downloads', () => ({
  useDownloads: jest.fn(),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockMessages = {
  en: {
    common: {
      refresh: 'Refresh',
      cancel: 'Cancel',
      loading: 'Loading...',
      add: 'Add',
      save: 'Save',
      actions: 'Actions',
    },
    downloads: {
      title: 'Downloads',
      description: 'Manage download tasks and history',
      queue: 'Download Queue',
      historyTab: 'Download History',
      noTasks: 'No active downloads',
      noTasksDesc: 'Downloads will appear here when you start installing packages',
      noHistory: 'No download history',
      noHistoryDesc: 'Completed downloads will be recorded here',
      addDownload: 'Add Download',
      url: 'URL',
      destination: 'Destination',
      name: 'Name',
      priority: 'Priority',
      checksum: 'Checksum',
      status: 'Status',
      state: {
        queued: 'Queued',
        downloading: 'Downloading',
        paused: 'Paused',
        cancelled: 'Cancelled',
        completed: 'Completed',
        failed: 'Failed',
      },
      actions: {
        pause: 'Pause',
        resume: 'Resume',
        cancel: 'Cancel',
        remove: 'Remove',
        retry: 'Retry',
        pauseAll: 'Pause All',
        resumeAll: 'Resume All',
        cancelAll: 'Cancel All',
        clearFinished: 'Clear Finished',
        retryFailed: 'Retry Failed',
      },
      progress: {
        downloaded: 'Downloaded',
        total: 'Total',
        speed: 'Speed',
        eta: 'ETA',
        percent: 'Progress',
      },
      settings: {
        speedLimit: 'Speed Limit',
        speedLimitDesc: 'Maximum download speed (0 = unlimited)',
        unlimited: 'Unlimited',
        maxConcurrent: 'Max Concurrent',
        maxConcurrentDesc: 'Maximum simultaneous downloads',
      },
      stats: {
        total: 'Total',
        queued: 'Queued',
        downloading: 'Downloading',
        paused: 'Paused',
        completed: 'Completed',
        failed: 'Failed',
        cancelled: 'Cancelled',
      },
      historyPanel: {
        title: 'Download History',
        search: 'Search history...',
        clear: 'Clear History',
        duration: 'Duration',
        averageSpeed: 'Avg Speed',
        successRate: 'Success Rate',
        totalDownloaded: 'Total Downloaded',
      },
      toolbar: {
        searchPlaceholder: 'Search downloads...',
        filterAll: 'All',
        filterDownloading: 'Downloading',
        filterQueued: 'Queued',
        filterPaused: 'Paused',
        filterCompleted: 'Completed',
        filterFailed: 'Failed',
        noResults: 'No downloads match your search',
        noResultsDesc: 'Try adjusting your search or filters',
        clearFilters: 'Clear Filters',
      },
      provider: 'Provider',
      providerPlaceholder: 'Optional: e.g., npm, github',
      selectDestination: 'Select download destination',
      manualPathRequired: 'Please enter the path manually',
      browseFolder: 'Browse',
      toast: {
        added: 'Download added',
        started: 'Download started',
        completed: 'Download completed',
        failed: 'Download failed',
        paused: 'Download paused',
        resumed: 'Download resumed',
        cancelled: 'Download cancelled',
        cleared: 'Cleared {count} downloads',
        speedLimitSet: 'Speed limit set to {speed}',
        speedLimitRemoved: 'Speed limit removed',
      },
    },
    about: {
      updateDesktopOnly: 'Desktop only',
    },
  },
  zh: {
    common: {},
    downloads: {},
    about: {},
  },
};

const mockTask: DownloadTask = {
  id: 'task-1',
  url: 'https://example.com/file.zip',
  name: 'file.zip',
  destination: '/downloads/file.zip',
  state: 'downloading',
  progress: {
    downloadedBytes: 1024,
    totalBytes: 2048,
    speed: 256,
    speedHuman: '256 KB/s',
    percent: 50,
    etaSecs: 10,
    etaHuman: '10s',
    downloadedHuman: '1 KB',
    totalHuman: '2 KB',
  },
  error: null,
  provider: 'npm',
  createdAt: '2024-01-01T10:00:00Z',
  startedAt: '2024-01-01T10:01:00Z',
  completedAt: null,
  retries: 0,
  priority: 5,
  expectedChecksum: null,
  supportsResume: true,
  metadata: {},
  serverFilename: null,
};

const mockTaskPaused: DownloadTask = {
  id: 'task-2',
  url: 'https://example.com/other.zip',
  name: 'other.zip',
  destination: '/downloads/other.zip',
  state: 'paused',
  progress: {
    downloadedBytes: 512,
    totalBytes: 2048,
    speed: 0,
    speedHuman: '0 B/s',
    percent: 25,
    etaSecs: null,
    etaHuman: null,
    downloadedHuman: '512 B',
    totalHuman: '2 KB',
  },
  error: null,
  provider: 'github',
  createdAt: '2024-01-01T10:00:00Z',
  startedAt: '2024-01-01T10:01:00Z',
  completedAt: null,
  retries: 1,
  priority: 5,
  expectedChecksum: 'abc123',
  supportsResume: false,
  metadata: { source: 'test' },
  serverFilename: null,
};

const mockHistory: HistoryRecord = {
  id: 'history-1',
  url: 'https://example.com/history.zip',
  filename: 'history.zip',
  destination: '/downloads/history.zip',
  size: 1024,
  sizeHuman: '1 KB',
  checksum: null,
  startedAt: '2024-01-01T10:00:00Z',
  completedAt: '2024-01-01T10:02:00Z',
  durationSecs: 120,
  durationHuman: '2m',
  averageSpeed: 128,
  speedHuman: '128 KB/s',
  status: 'completed',
  error: null,
  provider: null,
};

const mockStats: QueueStats = {
  totalTasks: 1,
  queued: 0,
  downloading: 1,
  paused: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  totalBytes: 2048,
  downloadedBytes: 1024,
  totalHuman: '2 KB',
  downloadedHuman: '1 KB',
  overallProgress: 50,
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <LocaleProvider messages={mockMessages as never}>{children}</LocaleProvider>;
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

function setupMocks() {
  const { useDownloads } = jest.requireMock('@/hooks/use-downloads') as {
    useDownloads: jest.Mock;
  };
  const { isTauri } = jest.requireMock('@/lib/tauri') as {
    isTauri: jest.Mock;
  };

  isTauri.mockReturnValue(true);
  useDownloads.mockReturnValue({
    tasks: [mockTask, mockTaskPaused],
    stats: { ...mockStats, totalTasks: 2, paused: 1 },
    history: [mockHistory],
    historyStats: null,
    speedLimit: 0,
    maxConcurrent: 4,
    isLoading: false,
    error: null,
    selectedTaskIds: new Set<string>(),
    showHistory: false,
    activeTasks: [mockTask],
    pausedTasks: [],
    completedTasks: [],
    failedTasks: [],
    addDownload: jest.fn(),
    pauseDownload: jest.fn(),
    resumeDownload: jest.fn(),
    cancelDownload: jest.fn(),
    removeDownload: jest.fn(),
    pauseAll: jest.fn().mockResolvedValue(0),
    resumeAll: jest.fn().mockResolvedValue(0),
    cancelAll: jest.fn().mockResolvedValue(0),
    clearFinished: jest.fn().mockResolvedValue(0),
    retryFailed: jest.fn().mockResolvedValue(0),
    setSpeedLimit: jest.fn(),
    setMaxConcurrent: jest.fn(),
    refreshTasks: jest.fn(),
    refreshStats: jest.fn(),
    refreshHistory: jest.fn(),
    searchHistory: jest.fn().mockResolvedValue([]),
    clearHistory: jest.fn(),
    removeHistoryRecord: jest.fn(),
    getDiskSpace: jest.fn(),
    checkDiskSpace: jest.fn(),
    getSpeedLimit: jest.fn(),
    getMaxConcurrent: jest.fn(),
    verifyFile: jest.fn(),
    openFile: jest.fn(),
    revealFile: jest.fn(),
    retryTask: jest.fn(),
    setPriority: jest.fn(),
    calculateChecksum: jest.fn().mockResolvedValue('sha256abc'),
    batchPause: jest.fn().mockResolvedValue(0),
    batchResume: jest.fn().mockResolvedValue(0),
    batchCancel: jest.fn().mockResolvedValue(0),
    batchRemove: jest.fn().mockResolvedValue(0),
    selectTask: jest.fn(),
    deselectTask: jest.fn(),
    selectAllTasks: jest.fn(),
    deselectAllTasks: jest.fn(),
    toggleShowHistory: jest.fn(),
    clearError: jest.fn(),
  });
}

describe('DownloadsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('renders the downloads page header', () => {
    renderWithProviders(<DownloadsPage />);

    expect(screen.getByRole('heading', { name: /downloads/i })).toBeInTheDocument();
    expect(screen.getByText(/manage download tasks/i)).toBeInTheDocument();
  });

  it('renders queue task rows', () => {
    renderWithProviders(<DownloadsPage />);

    expect(screen.getByText('file.zip')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/file.zip')).toBeInTheDocument();
    expect(screen.getAllByText('Downloading').length).toBeGreaterThan(0);
  });

  it('shows history entries when switching tabs', async () => {
    renderWithProviders(<DownloadsPage />);

    await userEvent.click(screen.getByRole('tab', { name: /download history/i }));

    await waitFor(() => {
      expect(screen.getByText('history.zip')).toBeInTheDocument();
    });
  });

  it('opens add download dialog', async () => {
    renderWithProviders(<DownloadsPage />);

    await userEvent.click(screen.getByRole('button', { name: /add download/i }));

    await waitFor(() => {
      // Check for the dialog by looking for the URL input field
      expect(screen.getByLabelText('URL')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
  });

  it('renders the download toolbar with search and filters', () => {
    renderWithProviders(<DownloadsPage />);

    expect(screen.getByPlaceholderText('Search downloads...')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /downloading/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /paused/i })).toBeInTheDocument();
  });

  it('filters tasks by search query', async () => {
    renderWithProviders(<DownloadsPage />);

    const searchInput = screen.getByPlaceholderText('Search downloads...');
    await userEvent.type(searchInput, 'file.zip');

    await waitFor(() => {
      expect(screen.getByText('file.zip')).toBeInTheDocument();
      expect(screen.queryByText('other.zip')).not.toBeInTheDocument();
    });
  });

  it('filters tasks by status', async () => {
    renderWithProviders(<DownloadsPage />);

    // Click on paused filter tab
    const pausedTab = screen.getByRole('tab', { name: /paused/i });
    await userEvent.click(pausedTab);

    await waitFor(() => {
      expect(screen.getByText('other.zip')).toBeInTheDocument();
      expect(screen.queryByText('file.zip')).not.toBeInTheDocument();
    });
  });

  it('displays provider badge for tasks with provider', () => {
    renderWithProviders(<DownloadsPage />);

    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('github')).toBeInTheDocument();
  });

  it('shows empty state when no tasks match filters', async () => {
    renderWithProviders(<DownloadsPage />);

    const searchInput = screen.getByPlaceholderText('Search downloads...');
    await userEvent.type(searchInput, 'nonexistent-file');

    await waitFor(() => {
      expect(screen.getByText('No downloads match your search')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
    });
  });

  it('clears filters when clear filters button is clicked', async () => {
    renderWithProviders(<DownloadsPage />);

    const searchInput = screen.getByPlaceholderText('Search downloads...');
    await userEvent.type(searchInput, 'nonexistent-file');

    await waitFor(() => {
      expect(screen.getByText('No downloads match your search')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));

    await waitFor(() => {
      expect(screen.getByText('file.zip')).toBeInTheDocument();
      expect(screen.getByText('other.zip')).toBeInTheDocument();
    });
  });
});
