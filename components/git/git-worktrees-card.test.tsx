import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitWorktreesCard } from './git-worktrees-card';

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

describe('GitWorktreesCard', () => {
  const createProps = () => ({
    worktrees: [
      {
        path: '/tmp/wt',
        head: 'abc123',
        branch: 'main',
        isBare: false,
        isDetached: false,
      },
      {
        path: '/tmp/detached',
        head: 'def456',
        branch: '',
        isBare: true,
        isDetached: true,
      },
    ],
    onRefresh: jest.fn().mockResolvedValue(undefined),
    onAdd: jest.fn().mockResolvedValue('added'),
    onRemove: jest.fn().mockResolvedValue('removed'),
    onPrune: jest.fn().mockResolvedValue('pruned'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders worktree metadata and wires remove with the selected force flag', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitWorktreesCard {...props} />);

    expect(screen.getByText('/tmp/wt')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('git.worktrees.detached')).toBeInTheDocument();
    expect(screen.getByText('git.worktrees.bare')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getAllByTitle('git.worktrees.remove')[0]);

    await waitFor(() => {
      expect(props.onRemove).toHaveBeenCalledWith('/tmp/wt', true);
    });
  });

  it('passes trimmed add inputs and prune callback parameters', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitWorktreesCard {...props} />);

    await user.click(screen.getByRole('button', { name: 'git.worktrees.prune' }));
    await waitFor(() => {
      expect(props.onPrune).toHaveBeenCalled();
    });

    await user.type(
      screen.getByPlaceholderText('git.worktrees.destination'),
      '  /tmp/new-worktree  ',
    );
    await user.type(
      screen.getByPlaceholderText('git.worktrees.branch'),
      '  feature/base  ',
    );
    await user.type(
      screen.getByPlaceholderText('git.worktrees.newBranch'),
      '  feature/new  ',
    );
    await user.click(screen.getByRole('button', { name: 'git.worktrees.add' }));

    await waitFor(() => {
      expect(props.onAdd).toHaveBeenCalledWith(
        '/tmp/new-worktree',
        'feature/base',
        'feature/new',
      );
    });
    expect(props.onRefresh).toHaveBeenCalled();
  });

  it('disables controls when loading and surfaces failures via toast', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const failingPrune = jest.fn().mockRejectedValue(new Error('boom'));

    const { rerender } = render(<GitWorktreesCard {...props} loading={true} />);

    expect(
      screen.getByRole('button', { name: 'git.worktrees.prune' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'git.refresh' })).toBeDisabled();
    expect(screen.getAllByTitle('git.worktrees.remove')[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'git.worktrees.add' })).toBeDisabled();

    rerender(<GitWorktreesCard {...props} onPrune={failingPrune} />);
    await user.click(screen.getByRole('button', { name: 'git.worktrees.prune' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});
