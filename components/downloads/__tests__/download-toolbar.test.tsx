import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadToolbar, type StatusFilter } from '../download-toolbar';
import type { QueueStats } from '@/lib/stores/download';

const mockStats: QueueStats = {
  totalTasks: 5,
  queued: 1,
  downloading: 2,
  paused: 1,
  completed: 1,
  failed: 0,
  cancelled: 0,
  totalBytes: 10240,
  downloadedBytes: 5120,
  totalHuman: '10 KB',
  downloadedHuman: '5 KB',
  overallProgress: 50,
};

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'downloads.toolbar.searchPlaceholder': 'Search downloads...',
    'downloads.toolbar.filterAll': 'All',
    'downloads.toolbar.filterDownloading': 'Downloading',
    'downloads.toolbar.filterQueued': 'Queued',
    'downloads.toolbar.filterPaused': 'Paused',
    'downloads.toolbar.filterCompleted': 'Completed',
    'downloads.toolbar.filterFailed': 'Failed',
    'downloads.actions.pauseAll': 'Pause All',
    'downloads.actions.resumeAll': 'Resume All',
    'downloads.actions.cancelAll': 'Cancel All',
    'downloads.actions.clearFinished': 'Clear Finished',
    'downloads.actions.retryFailed': 'Retry Failed',
  };
  return translations[key] || key;
};

describe('DownloadToolbar', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: jest.fn(),
    statusFilter: 'all' as StatusFilter,
    onStatusChange: jest.fn(),
    onPauseAll: jest.fn(),
    onResumeAll: jest.fn(),
    onCancelAll: jest.fn(),
    onClearFinished: jest.fn(),
    onRetryFailed: jest.fn(),
    stats: mockStats,
    isLoading: false,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input', () => {
    render(<DownloadToolbar {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Search downloads...')).toBeInTheDocument();
  });

  it('renders status filter tabs with counts', () => {
    render(<DownloadToolbar {...defaultProps} />);
    
    expect(screen.getByRole('tab', { name: /all \(5\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /downloading \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /paused \(1\)/i })).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search input', async () => {
    const onSearchChange = jest.fn();
    render(<DownloadToolbar {...defaultProps} onSearchChange={onSearchChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search downloads...');
    await userEvent.type(searchInput, 'test');
    
    expect(onSearchChange).toHaveBeenCalledTimes(4); // Once per character
  });

  it('calls onStatusChange when clicking status tabs', async () => {
    const onStatusChange = jest.fn();
    render(<DownloadToolbar {...defaultProps} onStatusChange={onStatusChange} />);
    
    const pausedTab = screen.getByRole('tab', { name: /paused/i });
    await userEvent.click(pausedTab);
    
    expect(onStatusChange).toHaveBeenCalledWith('paused');
  });

  it('disables pause all button when no downloads are active', () => {
    const statsNoDownloading = { ...mockStats, downloading: 0 };
    render(<DownloadToolbar {...defaultProps} stats={statsNoDownloading} />);
    
    expect(screen.getByRole('button', { name: /pause all/i })).toBeDisabled();
  });

  it('disables resume all button when no downloads are paused', () => {
    const statsNoPaused = { ...mockStats, paused: 0 };
    render(<DownloadToolbar {...defaultProps} stats={statsNoPaused} />);
    
    expect(screen.getByRole('button', { name: /resume all/i })).toBeDisabled();
  });

  it('calls onPauseAll when clicking pause all button', async () => {
    const onPauseAll = jest.fn();
    render(<DownloadToolbar {...defaultProps} onPauseAll={onPauseAll} />);
    
    await userEvent.click(screen.getByRole('button', { name: /pause all/i }));
    
    expect(onPauseAll).toHaveBeenCalled();
  });

  it('calls onResumeAll when clicking resume all button', async () => {
    const onResumeAll = jest.fn();
    render(<DownloadToolbar {...defaultProps} onResumeAll={onResumeAll} />);
    
    await userEvent.click(screen.getByRole('button', { name: /resume all/i }));
    
    expect(onResumeAll).toHaveBeenCalled();
  });

  it('disables all buttons when isLoading is true', () => {
    render(<DownloadToolbar {...defaultProps} isLoading={true} />);
    
    expect(screen.getByRole('button', { name: /pause all/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /resume all/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel all/i })).toBeDisabled();
  });
});
