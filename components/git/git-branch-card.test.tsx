import { render, screen } from '@testing-library/react';
import { GitBranchCard } from './git-branch-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
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
});
