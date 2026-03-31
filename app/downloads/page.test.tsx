import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadsPage from './page';
import { LocaleProvider } from '@/components/providers/locale-provider';
import type { DownloadTask, QueueStats } from '@/lib/stores/download';

let mockGitHubDialogProps: { open: boolean; checkDiskSpace?: unknown } | null = null;
let mockGitLabDialogProps: { open: boolean; checkDiskSpace?: unknown } | null = null;
let mockCheckDiskSpace: jest.Mock;
const mockFsExists = jest.fn();

jest.mock('@/hooks/downloads/use-downloads', () => ({
  useDownloads: jest.fn(),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(),
}));

jest.mock('@tauri-apps/plugin-fs', () => ({
  exists: (...args: unknown[]) => mockFsExists(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/stores/download', () => ({
  useDownloadStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({
      tasks: [],
      progressMap: {},
      speedHistory: [],
    })
  ),
}));

jest.mock('@/components/downloads', () => {
  const actual = jest.requireActual('@/components/downloads');
  return {
    ...actual,
    GitHubDownloadDialog: ({
      open,
      checkDiskSpace,
    }: {
      open: boolean;
      checkDiskSpace?: unknown;
    }) => {
      mockGitHubDialogProps = { open, checkDiskSpace };
      return open ? <div data-testid="mock-github-dialog">mock-github-dialog</div> : null;
    },
    GitLabDownloadDialog: ({
      open,
      checkDiskSpace,
    }: {
      open: boolean;
      checkDiskSpace?: unknown;
    }) => {
      mockGitLabDialogProps = { open, checkDiskSpace };
      return open ? <div data-testid="mock-gitlab-dialog">mock-gitlab-dialog</div> : null;
    },
  };
});

const mockMessages = {
  en: {
    common: {
      refresh: 'Refresh',
      cancel: 'Cancel',
      loading: 'Loading...',
      add: 'Add',
      save: 'Save',
      actions: 'Actions',
      clear: 'Clear',
      selected: 'selected',
      settings: 'Settings',
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
      batchImport: 'Batch Import',
      fromGitHub: 'From GitHub',
      fromGitLab: 'From GitLab',
      dropUrl: 'Drop URL to download',
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
        extracting: 'Extracting',
      },
      actions: {
        pause: 'Pause',
        resume: 'Resume',
        cancel: 'Cancel',
        remove: 'Remove',
        retry: 'Retry',
        open: 'Open',
        reveal: 'Reveal',
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
        clipboardMonitor: 'Clipboard Monitor',
        clipboardMonitorDesc: 'Auto-detect download URLs in clipboard',
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
      toolbar: {
        searchPlaceholder: 'Search downloads...',
        filterAll: 'All',
        filterActive: 'Active',
        filterDownloading: 'Downloading',
        filterQueued: 'Queued',
        filterDone: 'Done',
        filterPaused: 'Paused',
        filterCompleted: 'Completed',
        filterFailed: 'Failed',
        filterCancelled: 'Cancelled',
        filterExtracting: 'Extracting',
        noResults: 'No downloads match your search',
        noResultsDesc: 'Try adjusting your search or filters',
        clearFilters: 'Clear Filters',
      },
      preflight: {
        unknownSizeWarning: 'File size unknown, continuing with caution',
      },
      historyPanel: {
        reuse: 'Reuse Download',
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
        batchAdded: 'Added {count} downloads',
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

const mockStats: QueueStats = {
  totalTasks: 2,
  queued: 0,
  downloading: 1,
  paused: 1,
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
  const { useDownloads } = jest.requireMock('@/hooks/downloads/use-downloads') as {
    useDownloads: jest.Mock;
  };
  const { isTauri } = jest.requireMock('@/lib/tauri') as {
    isTauri: jest.Mock;
  };

  mockCheckDiskSpace = jest.fn();
  isTauri.mockReturnValue(true);
  useDownloads.mockReturnValue({
    tasks: [mockTask, mockTaskPaused],
    stats: mockStats,
    history: [],
    historyStats: null,
    speedLimit: 0,
    maxConcurrent: 4,
    isLoading: false,
    error: null,
    selectedTaskIds: new Set<string>(),
    clipboardMonitor: false,
    setClipboardMonitor: jest.fn(),
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
    checkDiskSpace: mockCheckDiskSpace,
    checkDestinationAvailability: (...args: unknown[]) => mockFsExists(...args),
    getSpeedLimit: jest.fn(),
    getMaxConcurrent: jest.fn(),
    verifyFile: jest.fn(),
    openFile: jest.fn(),
    revealFile: jest.fn(),
    retryTask: jest.fn(),
    setPriority: jest.fn(),
    setTaskSpeedLimit: jest.fn(),
    calculateChecksum: jest.fn().mockResolvedValue('sha256abc'),
    batchPause: jest.fn().mockResolvedValue(0),
    batchResume: jest.fn().mockResolvedValue(0),
    batchCancel: jest.fn().mockResolvedValue(0),
    batchRemove: jest.fn().mockResolvedValue(0),
    selectTask: jest.fn(),
    deselectTask: jest.fn(),
    selectAllTasks: jest.fn(),
    deselectAllTasks: jest.fn(),
    extractArchive: jest.fn(),
  });
}

describe('DownloadsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGitHubDialogProps = null;
    mockGitLabDialogProps = null;
    mockFsExists.mockResolvedValue(true);
    setupMocks();
  });

  it('renders the downloads page header', () => {
    renderWithProviders(<DownloadsPage />);

    expect(screen.getByRole('heading', { name: /downloads/i })).toBeInTheDocument();
    expect(screen.getByText(/manage download tasks/i)).toBeInTheDocument();
  });

  it('uses downloads hook on page without enabling a second runtime owner', () => {
    const { useDownloads } = jest.requireMock('@/hooks/downloads/use-downloads') as {
      useDownloads: jest.Mock;
    };

    renderWithProviders(<DownloadsPage />);

    expect(useDownloads).toHaveBeenCalledWith({ enableRuntime: false });
  });

  it('passes checkDiskSpace down to provider dialogs', () => {
    renderWithProviders(<DownloadsPage />);

    expect(mockGitHubDialogProps?.checkDiskSpace).toBe(mockCheckDiskSpace);
    expect(mockGitLabDialogProps?.checkDiskSpace).toBe(mockCheckDiskSpace);
  });

  it('renders task cards in grouped sections', () => {
    renderWithProviders(<DownloadsPage />);

    // Both tasks should be visible
    expect(screen.getByText('file.zip')).toBeInTheDocument();
    expect(screen.getByText('other.zip')).toBeInTheDocument();

    // Section headers should be present
    expect(screen.getByText(/Downloading \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Paused \(1\)/)).toBeInTheDocument();
  });

  it('renders stats strip with metric values', () => {
    renderWithProviders(<DownloadsPage />);

    // Stats strip shows downloading count
    const downloadingMetric = screen.getAllByText('1');
    expect(downloadingMetric.length).toBeGreaterThan(0);
  });

  it('opens add download dialog', async () => {
    renderWithProviders(<DownloadsPage />);

    await userEvent.click(screen.getByRole('button', { name: /add download/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('URL')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
  });

  it('renders the toolbar with search and simplified filter tabs', () => {
    renderWithProviders(<DownloadsPage />);

    expect(screen.getByPlaceholderText('Search downloads...')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /active/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /queued/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /done/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /failed/i })).toBeInTheDocument();
  });

  it('opens provider dialogs', async () => {
    renderWithProviders(<DownloadsPage />);

    await userEvent.click(screen.getByRole('button', { name: /from github/i }));
    await userEvent.click(screen.getByRole('button', { name: /from gitlab/i }));

    expect(screen.getByTestId('mock-github-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('mock-gitlab-dialog')).toBeInTheDocument();
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

  it('filters tasks by active status', async () => {
    renderWithProviders(<DownloadsPage />);

    // Click on active filter tab (includes downloading + extracting + paused)
    const activeTab = screen.getByRole('tab', { name: /active/i });
    await userEvent.click(activeTab);

    await waitFor(() => {
      // Both downloading and paused tasks should show under "active"
      expect(screen.getByText('file.zip')).toBeInTheDocument();
      expect(screen.getByText('other.zip')).toBeInTheDocument();
    });
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

  it('opens add dialog and prefills URL from clipboard-download-url event', async () => {
    renderWithProviders(<DownloadsPage />);

    const url = 'https://example.com/from-clipboard.zip';
    act(() => {
      window.dispatchEvent(new CustomEvent('clipboard-download-url', { detail: url }));
    });

    await waitFor(() => {
      const input = screen.getByLabelText('URL') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe(url);
    });
  });

  it('reuses a completed task from detail when its destination is unavailable', async () => {
    const { useDownloads } = jest.requireMock('@/hooks/downloads/use-downloads') as {
      useDownloads: jest.Mock;
    };
    const completedTask = {
      ...mockTask,
      id: 'task-completed',
      name: 'completed-build.zip',
      state: 'completed' as const,
      completedAt: '2024-01-01T10:02:00Z',
    };
    const existing = useDownloads();
    useDownloads.mockReturnValue({
      ...existing,
      tasks: [completedTask],
    });
    mockFsExists.mockResolvedValue(false);

    renderWithProviders(<DownloadsPage />);

    const detailCard = screen.getByText('completed-build.zip').closest('[role="button"]');
    expect(detailCard).toBeTruthy();
    await userEvent.click(detailCard as HTMLElement);

    await waitFor(() => {
      expect(mockFsExists).toHaveBeenCalledWith('/downloads/file.zip');
      expect(screen.getByText('Reuse Download')).toBeInTheDocument();
    });

    expect(screen.queryByText('Open File')).not.toBeInTheDocument();
    expect(screen.queryByText('Show in Folder')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Reuse Download'));

    await waitFor(() => {
      const input = screen.getByLabelText('URL') as HTMLInputElement;
      expect(input.value).toBe('https://example.com/file.zip');
    });
  });

  it('triggers batch actions from toolbar when tasks are selected', async () => {
    const { useDownloads } = jest.requireMock('@/hooks/downloads/use-downloads') as {
      useDownloads: jest.Mock;
    };
    const existing = useDownloads();
    const batchPause = jest.fn().mockResolvedValue(1);
    const batchResume = jest.fn().mockResolvedValue(1);
    const batchCancel = jest.fn().mockResolvedValue(1);
    const batchRemove = jest.fn().mockResolvedValue(1);

    useDownloads.mockReturnValue({
      ...existing,
      selectedTaskIds: new Set(['task-1']),
      batchPause,
      batchResume,
      batchCancel,
      batchRemove,
    });

    renderWithProviders(<DownloadsPage />);

    const selectionBar = screen.getByText('1 selected').closest('div');
    expect(selectionBar).toBeTruthy();

    await userEvent.click(within(selectionBar as HTMLElement).getByRole('button', { name: 'Pause' }));
    await userEvent.click(within(selectionBar as HTMLElement).getByRole('button', { name: 'Resume' }));
    await userEvent.click(within(selectionBar as HTMLElement).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(selectionBar as HTMLElement).getByRole('button', { name: 'Remove' }));

    expect(batchPause).toHaveBeenCalled();
    expect(batchResume).toHaveBeenCalled();
    expect(batchCancel).toHaveBeenCalled();
    expect(batchRemove).toHaveBeenCalled();
  });

  it('toggles settings panel visibility', async () => {
    renderWithProviders(<DownloadsPage />);

    const settingsBtn = screen.getByRole('button', { name: /settings/i });
    expect(settingsBtn).toBeInTheDocument();

    // Settings panel should be collapsed by default (not in DOM)
    expect(screen.queryByLabelText('Speed Limit')).not.toBeInTheDocument();

    // Click to open
    await userEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByLabelText('Speed Limit')).toBeInTheDocument();
    });
  });
});
