import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadDetailDialog } from './download-detail-dialog';
import { LocaleProvider } from '@/components/providers/locale-provider';
import type { DownloadTask } from '@/types/tauri';

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
        checksumResult: 'Checksum: {checksum}',
        calculating: 'Calculating...',
      },
      actions: {
        retryTask: 'Retry This Task',
        setPriority: 'Set Priority',
        open: 'Open File',
        reveal: 'Show in Folder',
      },
      toast: {
        started: 'Download started',
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
  return render(
    <TestWrapper>
      <DownloadDetailDialog
        task={baseTask}
        open={true}
        onOpenChange={jest.fn()}
        {...props}
      />
    </TestWrapper>
  );
}

describe('DownloadDetailDialog', () => {
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

  it('renders nothing when task is null', () => {
    const { container } = renderDialog({ task: null });
    // Dialog should not render any dialog content
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('shows retries count', () => {
    renderDialog();

    expect(screen.getByText(/0 \/ 3/)).toBeInTheDocument();
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
});
