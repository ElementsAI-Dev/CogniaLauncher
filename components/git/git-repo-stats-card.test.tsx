import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitRepoStatsCard } from './git-repo-stats-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key.replace('{count}', params?.count ?? ''),
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const { toast: mockToast } = jest.requireMock('sonner') as {
  toast: { success: jest.Mock; error: jest.Mock };
};

describe('GitRepoStatsCard', () => {
  const createProps = () => ({
    repoStats: {
      sizeOnDisk: '1 MB',
      objectCount: 10,
      packCount: 2,
      looseObjects: 1,
      commitCount: 42,
      isShallow: false,
    },
    onRefresh: jest.fn().mockResolvedValue(undefined),
    onFsck: jest.fn().mockResolvedValue(['dangling blob 123']),
    onDescribe: jest.fn().mockResolvedValue('v1.2.3'),
    onIsShallow: jest.fn().mockResolvedValue(true),
    onDeepen: jest.fn().mockResolvedValue('deepened'),
    onUnshallow: jest.fn().mockResolvedValue('unshallowed'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders repo statistics and refreshes shallow state', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitRepoStatsCard {...props} />);

    expect(screen.getByText(/git\.repoStats\.sizeOnDisk/)).toBeInTheDocument();
    expect(screen.getByText(/git\.repoStats\.commitCount/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'git.refresh' }));

    await waitFor(() => {
      expect(props.onRefresh).toHaveBeenCalled();
      expect(props.onIsShallow).toHaveBeenCalled();
    });
    expect(screen.getByText(/git\.shallow\.indicator/)).toBeInTheDocument();
  });

  it('renders empty state, fsck issues, describe output, and deepen actions', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitRepoStatsCard {...props} repoStats={null} />);
    expect(screen.getByText('git.error')).toBeInTheDocument();

    rerender(<GitRepoStatsCard {...props} />);

    await user.click(screen.getByRole('button', { name: 'git.repoStats.fsck' }));
    await waitFor(() => {
      expect(props.onFsck).toHaveBeenCalled();
    });
    expect(screen.getByText('dangling blob 123')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'git.describe.label' }));
    await waitFor(() => {
      expect(props.onDescribe).toHaveBeenCalled();
    });
    expect(screen.getByText(/v1\.2\.3/)).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('git.shallow.deepenPlaceholder'));
    await user.type(
      screen.getByPlaceholderText('git.shallow.deepenPlaceholder'),
      '25',
    );
    await user.click(screen.getByRole('button', { name: 'git.shallow.deepen' }));
    await waitFor(() => {
      expect(props.onDeepen).toHaveBeenCalledWith(25);
    });

    await user.click(screen.getByRole('button', { name: 'git.shallow.unshallow' }));
    await waitFor(() => {
      expect(props.onUnshallow).toHaveBeenCalled();
    });
  });

  it('surfaces refresh failures with a toast', async () => {
    const user = userEvent.setup();

    render(
      <GitRepoStatsCard
        {...createProps()}
        onRefresh={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'git.refresh' }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });

  it('reports clean fsck runs and refreshes shallow=false state', async () => {
    const user = userEvent.setup();

    render(
      <GitRepoStatsCard
        {...createProps()}
        onFsck={jest.fn().mockResolvedValue([])}
        onIsShallow={jest.fn().mockResolvedValue(false)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'git.refresh' }));
    await waitFor(() => {
      expect(screen.getByText(/git\.shallow\.indicator/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'git.repoStats.fsck' }));
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('git.repoStats.fsckSuccess');
    });
  });
});
