import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitBranchCard } from './git-branch-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('GitBranchCard', () => {
  const branches = [
    { name: 'main', shortHash: 'abc1234', upstream: 'origin/main', isCurrent: true, isRemote: false },
    { name: 'feature/test', shortHash: 'def5678', upstream: null, isCurrent: false, isRemote: false },
    { name: 'origin/main', shortHash: 'abc1234', upstream: null, isCurrent: false, isRemote: true },
  ];

  it('renders branches', () => {
    render(<GitBranchCard branches={branches} />);
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('feature/test')).toBeInTheDocument();
  });

  it('shows current branch badge', () => {
    render(<GitBranchCard branches={branches} />);
    expect(screen.getByText('git.repo.currentBranch')).toBeInTheDocument();
  });

  it('shows local and remote sections', () => {
    render(<GitBranchCard branches={branches} />);
    expect(screen.getByText(/git\.repo\.localBranches/)).toBeInTheDocument();
    expect(screen.getByText(/git\.repo\.remoteBranches/)).toBeInTheDocument();
  });

  it('shows branch count badge', () => {
    render(<GitBranchCard branches={branches} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows empty state when no branches', () => {
    render(<GitBranchCard branches={[]} />);
    expect(screen.getByText('No branches')).toBeInTheDocument();
  });

  it('displays upstream arrow for tracked branch', () => {
    render(<GitBranchCard branches={branches} />);
    expect(screen.getByText(/→ origin\/main/)).toBeInTheDocument();
  });

  it('renders short hashes', () => {
    render(<GitBranchCard branches={branches} />);
    expect(screen.getAllByText('abc1234').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('def5678')).toBeInTheDocument();
  });

  it('shows only local section when no remote branches', () => {
    const localOnly = branches.filter(b => !b.isRemote);
    render(<GitBranchCard branches={localOnly} />);
    expect(screen.getByText(/git\.repo\.localBranches/)).toBeInTheDocument();
    expect(screen.queryByText(/git\.repo\.remoteBranches/)).not.toBeInTheDocument();
  });

  it('shows only remote section when no local branches', () => {
    const remoteOnly = branches.filter(b => b.isRemote);
    render(<GitBranchCard branches={remoteOnly} />);
    expect(screen.queryByText(/git\.repo\.localBranches/)).not.toBeInTheDocument();
    expect(screen.getByText(/git\.repo\.remoteBranches/)).toBeInTheDocument();
  });

  it('shows ahead badge when aheadBehind.ahead > 0', () => {
    const { container } = render(<GitBranchCard branches={branches} aheadBehind={{ ahead: 5, behind: 0 }} />);
    // ahead badge renders inside the header span with text-green-600 border-green-600
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(container.querySelector('.text-green-600.border-green-600')).toBeInTheDocument();
  });

  it('shows behind badge when aheadBehind.behind > 0', () => {
    const { container } = render(<GitBranchCard branches={branches} aheadBehind={{ ahead: 0, behind: 7 }} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(container.querySelector('.text-orange-600')).toBeInTheDocument();
  });

  it('does not show ahead/behind badges when both zero', () => {
    const { container } = render(<GitBranchCard branches={branches} aheadBehind={{ ahead: 0, behind: 0 }} />);
    expect(container.querySelector('.text-orange-600')).not.toBeInTheDocument();
  });

  it('renders create branch input when onCreate provided', () => {
    const onCreate = jest.fn().mockResolvedValue('created');
    render(<GitBranchCard branches={branches} onCreate={onCreate} />);
    expect(screen.getByPlaceholderText('git.branchAction.newBranchName')).toBeInTheDocument();
    expect(screen.getByText('git.branchAction.create')).toBeInTheDocument();
  });

  it('does not render create input when onCreate not provided', () => {
    render(<GitBranchCard branches={branches} />);
    expect(screen.queryByPlaceholderText('git.branchAction.newBranchName')).not.toBeInTheDocument();
  });

  it('calls onCreate with branch name', async () => {
    const onCreate = jest.fn().mockResolvedValue('created');
    render(<GitBranchCard branches={branches} onCreate={onCreate} />);
    const input = screen.getByPlaceholderText('git.branchAction.newBranchName');
    fireEvent.change(input, { target: { value: 'new-branch' } });
    fireEvent.click(screen.getByText('git.branchAction.create'));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('new-branch');
    });
  });

  it('disables create button when input is empty', () => {
    const onCreate = jest.fn().mockResolvedValue('created');
    render(<GitBranchCard branches={branches} onCreate={onCreate} />);
    expect(screen.getByText('git.branchAction.create').closest('button')).toBeDisabled();
  });

  it('clears input after successful create', async () => {
    const onCreate = jest.fn().mockResolvedValue('created');
    render(<GitBranchCard branches={branches} onCreate={onCreate} />);
    const input = screen.getByPlaceholderText('git.branchAction.newBranchName');
    fireEvent.change(input, { target: { value: 'new-branch' } });
    fireEvent.click(screen.getByText('git.branchAction.create'));
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });
});
