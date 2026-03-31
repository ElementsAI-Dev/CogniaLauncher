import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadDetailDialog } from './download-detail-dialog';
import { LocaleProvider } from '@/components/providers/locale-provider';
import type { DownloadTask } from '@/types/tauri';

const mockStoreState: {
  tasks: DownloadTask[];
  progressMap: Record<string, DownloadTask['progress']>;
} = {
  tasks: [],
  progressMap: {},
};

jest.mock('@/lib/stores/download', () => ({
  useDownloadStore: (
    selector: (state: typeof mockStoreState) => unknown
  ) => selector(mockStoreState),
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
      yes: 'Yes',
      no: 'No',
      created: 'Created',
      started: 'Started',
      completed: 'Completed',
      actions: 'Actions',
      save: 'Save',
    },
    downloads: {
      state: {
        queued: 'Queued',
        downloading: 'Downloading',
        paused: 'Paused',
        cancelled: 'Cancelled',
        completed: 'Completed',
        failed: 'Failed',
      },
      detail: {
        title: 'Download Details',
        url: 'Source URL',
        destination: 'Destination',
        retries: 'Retry Attempts',
        priority: 'Priority',
        checksum: 'Expected Checksum',
        supportsResume: 'Resume Support',
        metadata: 'Metadata',
        timestamps: 'Timestamps',
        copyUrl: 'Copy URL',
        urlCopied: 'Copied to clipboard',
        calculateChecksum: 'Calculate Checksum',
        verifyFile: 'Verify File',
        verifySuccess: 'Verification passed',
        verifyResult: 'Verification Result',
        verifyValid: 'Valid',
        actualChecksum: 'Actual Checksum',
        extractedFiles: 'Extracted files: {count}',
        checksumResult: 'Checksum: {checksum}',
        calculating: 'Calculating...',
        taskSpeedLimit: 'Task Speed Limit',
        taskSpeedLimitSaved: 'Task speed limit saved',
      },
      actions: {
        retryTask: 'Retry This Task',
        setPriority: 'Set Priority',
        install: 'Install',
        open: 'Open File',
        reveal: 'Show in Folder',
        extract: 'Extract Archive',
      },
      historyPanel: {
        reuse: 'Reuse Download',
      },
      toast: {
        started: 'Download started',
        extracted: 'Archive extracted successfully',
      },
      priorityCritical: 'Critical',
      priorityHigh: 'High',
      priorityNormal: 'Normal',
      priorityLow: 'Low',
    },
  },
  zh: {
    common: {},
    downloads: {},
  },
};

const baseTask: DownloadTask = {
  id: 'task-1',
  url: 'https://example.com/file.zip',
  name: 'file.zip',
  destination: '/downloads/file.zip',
  state: 'completed',
  progress: {
    downloadedBytes: 2048,
    totalBytes: 2048,
    speed: 0,
    speedHuman: '0 B/s',
    percent: 100,
    etaSecs: null,
    etaHuman: null,
    downloadedHuman: '2 KB',
    totalHuman: '2 KB',
  },
  error: null,
  provider: 'npm',
  createdAt: '2024-01-01T10:00:00Z',
  startedAt: '2024-01-01T10:01:00Z',
  completedAt: '2024-01-01T10:02:00Z',
  retries: 0,
  priority: 5,
  expectedChecksum: 'sha256abc',
  supportsResume: true,
  metadata: { version: '1.0.0' },
  serverFilename: null,
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <LocaleProvider messages={mockMessages as never}>{children}</LocaleProvider>;
}

function renderDialog(props: Partial<React.ComponentProps<typeof DownloadDetailDialog>> = {}) {
  const task = props.task ?? baseTask;
  return render(
    <TestWrapper>
      <DownloadDetailDialog
        task={task}
        open={true}
        onOpenChange={jest.fn()}
        destinationAvailable={props.destinationAvailable ?? task.state === 'completed'}
        {...props}
      />
    </TestWrapper>
  );
}

describe('DownloadDetailDialog', () => {
  beforeEach(() => {
    mockStoreState.tasks = [];
    mockStoreState.progressMap = {};
  });

  it('renders task name and state badge', () => {
    renderDialog();

    expect(screen.getByText('file.zip')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders provider badge', () => {
    renderDialog();

    expect(screen.getByText('npm')).toBeInTheDocument();
  });

  it('displays URL and destination', () => {
    renderDialog();

    expect(screen.getByText('https://example.com/file.zip')).toBeInTheDocument();
    expect(screen.getByText('/downloads/file.zip')).toBeInTheDocument();
  });

  it('shows expected checksum when present', () => {
    renderDialog();

    expect(screen.getByText('sha256abc')).toBeInTheDocument();
  });

  it('shows resume support badge', () => {
    renderDialog();

    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('shows metadata entries', () => {
    renderDialog();

    expect(screen.getByText('version')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('shows retry button for failed task', () => {
    const failedTask = { ...baseTask, state: 'failed' as const, error: 'Network error' };
    const onRetry = jest.fn().mockResolvedValue(undefined);
    renderDialog({ task: failedTask, onRetry });

    expect(screen.getByText('Retry This Task')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('does not show retry button for completed task', () => {
    renderDialog();

    expect(screen.queryByText('Retry This Task')).not.toBeInTheDocument();
  });

  it('shows open and reveal buttons for completed task', () => {
    renderDialog({
      onOpenFile: jest.fn(),
      onRevealFile: jest.fn(),
    });

    expect(screen.getByText('Open File')).toBeInTheDocument();
    expect(screen.getByText('Show in Folder')).toBeInTheDocument();
  });

  it('shows reuse instead of file actions when the completed destination is unavailable', async () => {
    const onReuseTask = jest.fn();
    renderDialog({
      onOpenFile: jest.fn(),
      onRevealFile: jest.fn(),
      onReuseTask,
      destinationAvailable: false,
    });

    expect(screen.queryByText('Open File')).not.toBeInTheDocument();
    expect(screen.queryByText('Show in Folder')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Reuse Download'));

    expect(onReuseTask).toHaveBeenCalledWith(baseTask);
  });

  it('shows calculate checksum button for completed task', () => {
    renderDialog({
      onCalculateChecksum: jest.fn().mockResolvedValue('abc123'),
    });

    expect(screen.getByText('Calculate Checksum')).toBeInTheDocument();
  });

  it('calculates checksum when button clicked', async () => {
    const onCalc = jest.fn().mockResolvedValue('deadbeef1234');
    renderDialog({ onCalculateChecksum: onCalc });

    await userEvent.click(screen.getByText('Calculate Checksum'));

    await waitFor(() => {
      expect(onCalc).toHaveBeenCalledWith('/downloads/file.zip');
      expect(screen.getByText('deadbeef1234')).toBeInTheDocument();
    });
  });

  it('verifies checksum when verify button is clicked', async () => {
    const onVerify = jest.fn().mockResolvedValue({
      valid: true,
      actualChecksum: 'sha256abc',
      expectedChecksum: 'sha256abc',
      error: null,
    });
    renderDialog({ onVerifyFile: onVerify });

    await userEvent.click(screen.getByText('Verify File'));

    await waitFor(() => {
      expect(onVerify).toHaveBeenCalledWith('/downloads/file.zip', 'sha256abc');
      expect(screen.getByText('Verification Result')).toBeInTheDocument();
      expect(screen.getByText(/Valid/)).toBeInTheDocument();
      expect(screen.getByText(/Actual Checksum/)).toBeInTheDocument();
    });
  });

  it('extracts archive when extract button is clicked', async () => {
    const onExtract = jest.fn().mockResolvedValue(['/downloads/out/file.txt']);
    renderDialog({
      task: {
        ...baseTask,
        artifactProfile: {
          artifactKind: 'archive',
          sourceKind: 'direct_url',
          platform: 'windows',
          arch: 'x64',
          installIntent: 'extract_then_continue',
          suggestedFollowUps: ['extract'],
        },
      } as DownloadTask,
      onExtractArchive: onExtract,
    });

    await userEvent.click(screen.getByText('Extract Archive'));

    await waitFor(() => {
      expect(onExtract).toHaveBeenCalled();
      expect(screen.getByText('Extracted files: 1')).toBeInTheDocument();
    });
  });

  it('renders nothing when task is null', () => {
    const { container } = renderDialog({ task: null });
    // Dialog should not render any dialog content
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('shows retries count', () => {
    renderDialog();

    const retriesLabel = screen.getByText('Retry Attempts');
    expect(retriesLabel).toBeInTheDocument();
    expect(retriesLabel.closest('div')).toHaveTextContent('0');
  });

  it('shows timestamps', () => {
    renderDialog();

    // Should show created, started, completed timestamps
    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(screen.getByText(/Started/)).toBeInTheDocument();
  });

  it('shows error box for failed tasks', () => {
    const failedTask = {
      ...baseTask,
      state: 'failed' as const,
      error: 'Connection timeout',
    };
    renderDialog({ task: failedTask });

    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('hides retry button for unrecoverable failed tasks', () => {
    const failedTask = {
      ...baseTask,
      state: 'failed' as const,
      error: 'Checksum mismatch',
      recoverable: false,
    };
    const onRetry = jest.fn().mockResolvedValue(undefined);

    renderDialog({ task: failedTask, onRetry });

    expect(screen.queryByText('Retry This Task')).not.toBeInTheDocument();
  });

  it('uses live progress from store when available', () => {
    const queuedTask: DownloadTask = {
      ...baseTask,
      state: 'queued',
      progress: {
        downloadedBytes: 0,
        totalBytes: 100,
        speed: 0,
        speedHuman: '0 B/s',
        percent: 0,
        etaSecs: null,
        etaHuman: null,
        downloadedHuman: '0 B',
        totalHuman: '100 B',
      },
    };

    mockStoreState.tasks = [queuedTask];
    mockStoreState.progressMap = {
      [queuedTask.id]: {
        downloadedBytes: 50,
        totalBytes: 100,
        speed: 10,
        speedHuman: '10 B/s',
        percent: 50,
        etaSecs: 5,
        etaHuman: '5s',
        downloadedHuman: '50 B',
        totalHuman: '100 B',
      },
    };

    renderDialog({ task: queuedTask });

    expect(screen.getByText('50 B / 100 B')).toBeInTheDocument();
    expect(screen.getByText(/10 B\/s/)).toBeInTheDocument();
  });

  it('applies per-task speed limit from detail dialog', async () => {
    const onSetTaskSpeedLimit = jest.fn().mockResolvedValue(undefined);
    renderDialog({ onSetTaskSpeedLimit });

    const speedInput = screen.getByRole('textbox');
    await userEvent.clear(speedInput);
    await userEvent.type(speedInput, '1024');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSetTaskSpeedLimit).toHaveBeenCalledWith('task-1', 1024);
    });
  });

  it('shows install-aware action for completed installer tasks', () => {
    renderDialog({
      task: {
        ...baseTask,
        artifactProfile: {
          artifactKind: 'installer',
          sourceKind: 'direct_url',
          platform: 'windows',
          arch: 'x64',
          installIntent: 'open_installer',
          suggestedFollowUps: ['install'],
        },
      } as DownloadTask,
      onOpenFile: jest.fn(),
    });

    expect(screen.getByText('Install')).toBeInTheDocument();
  });
});
