import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitRepoActionBar } from './git-repo-action-bar';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('GitRepoActionBar', () => {
  const baseProps = {
    repoPath: '/test/repo',
    currentBranch: 'main',
    loading: false,
  };

  it('renders push button when onPush provided', () => {
    const onPush = jest.fn().mockResolvedValue('pushed');
    render(<GitRepoActionBar {...baseProps} onPush={onPush} />);
    expect(screen.getByText('git.actions.push')).toBeInTheDocument();
  });

  it('renders pull button when onPull provided', () => {
    const onPull = jest.fn().mockResolvedValue('pulled');
    render(<GitRepoActionBar {...baseProps} onPull={onPull} />);
    expect(screen.getByText('git.actions.pull')).toBeInTheDocument();
  });

  it('renders fetch button when onFetch provided', () => {
    const onFetch = jest.fn().mockResolvedValue('fetched');
    render(<GitRepoActionBar {...baseProps} onFetch={onFetch} />);
    expect(screen.getByText('git.actions.fetch')).toBeInTheDocument();
  });

  it('renders clean button when onClean provided', () => {
    const onClean = jest.fn().mockResolvedValue('cleaned');
    render(<GitRepoActionBar {...baseProps} onClean={onClean} />);
    expect(screen.getByText('git.actions.clean')).toBeInTheDocument();
  });

  it('renders refresh button when onRefresh provided', () => {
    const onRefresh = jest.fn();
    render(<GitRepoActionBar {...baseProps} onRefresh={onRefresh} />);
    expect(screen.getByText('git.refresh')).toBeInTheDocument();
  });

  it('does not render buttons when callbacks not provided', () => {
    render(<GitRepoActionBar repoPath="/test/repo" />);
    expect(screen.queryByText('git.actions.push')).not.toBeInTheDocument();
    expect(screen.queryByText('git.actions.pull')).not.toBeInTheDocument();
    expect(screen.queryByText('git.actions.fetch')).not.toBeInTheDocument();
  });

  it('disables buttons when repoPath is null', () => {
    const onPush = jest.fn().mockResolvedValue('pushed');
    render(<GitRepoActionBar repoPath={null} onPush={onPush} />);
    expect(screen.getByText('git.actions.push').closest('button')).toBeDisabled();
  });

  it('disables buttons when loading', () => {
    const onPush = jest.fn().mockResolvedValue('pushed');
    render(<GitRepoActionBar {...baseProps} loading={true} onPush={onPush} />);
    expect(screen.getByText('git.actions.push').closest('button')).toBeDisabled();
  });

  it('calls onPush when push button clicked', async () => {
    const onPush = jest.fn().mockResolvedValue('pushed');
    const onRefresh = jest.fn();
    render(<GitRepoActionBar {...baseProps} onPush={onPush} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByText('git.actions.push'));
    await waitFor(() => {
      expect(onPush).toHaveBeenCalled();
    });
  });

  it('calls onRefresh after successful action', async () => {
    const onPush = jest.fn().mockResolvedValue('pushed');
    const onRefresh = jest.fn();
    render(<GitRepoActionBar {...baseProps} onPush={onPush} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByText('git.actions.push'));
    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('shows ahead count badge on push button', () => {
    const onPush = jest.fn().mockResolvedValue('pushed');
    render(<GitRepoActionBar {...baseProps} onPush={onPush} aheadBehind={{ ahead: 5, behind: 0 }} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows behind count badge on pull button', () => {
    const onPull = jest.fn().mockResolvedValue('pulled');
    render(<GitRepoActionBar {...baseProps} onPull={onPull} aheadBehind={{ ahead: 0, behind: 3 }} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not show ahead badge when ahead is 0', () => {
    const onPush = jest.fn().mockResolvedValue('pushed');
    const { container } = render(<GitRepoActionBar {...baseProps} onPush={onPush} aheadBehind={{ ahead: 0, behind: 0 }} />);
    // Only the push button text should be there, no extra badge content
    const badges = container.querySelectorAll('[class*="text-\\[10px\\]"]');
    expect(badges.length).toBe(0);
  });

  it('shows toast error when action fails', async () => {
    const { toast } = jest.requireMock('sonner');
    const onPush = jest.fn().mockRejectedValue(new Error('push failed'));
    render(<GitRepoActionBar {...baseProps} onPush={onPush} />);
    fireEvent.click(screen.getByText('git.actions.push'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
