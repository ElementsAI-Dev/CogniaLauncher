import { render, screen } from '@testing-library/react';
import { GitMergeDialog } from './git-merge-dialog';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitMergeDialog', () => {
  const branches = [
    { name: 'main', shortHash: 'abc1234', upstream: 'origin/main', isCurrent: true, isRemote: false },
    { name: 'feature/a', shortHash: 'def5678', upstream: null, isCurrent: false, isRemote: false },
    { name: 'feature/b', shortHash: 'ghi9012', upstream: null, isCurrent: false, isRemote: false },
    { name: 'origin/main', shortHash: 'abc1234', upstream: null, isCurrent: false, isRemote: true },
  ];

  const mockOnMerge = jest.fn().mockResolvedValue('Merge completed');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders merge title', () => {
    render(<GitMergeDialog branches={branches} currentBranch="main" onMerge={mockOnMerge} />);
    expect(screen.getByText('git.mergeAction.title')).toBeInTheDocument();
  });

  it('renders merge button', () => {
    render(<GitMergeDialog branches={branches} currentBranch="main" onMerge={mockOnMerge} />);
    expect(screen.getByRole('button', { name: /git\.actions\.merge/i })).toBeInTheDocument();
  });

  it('disables merge button when no branch selected', () => {
    render(<GitMergeDialog branches={branches} currentBranch="main" onMerge={mockOnMerge} />);
    const mergeButton = screen.getByRole('button', { name: /git\.actions\.merge/i });
    expect(mergeButton).toBeDisabled();
  });

  it('renders no-ff checkbox', () => {
    render(<GitMergeDialog branches={branches} currentBranch="main" onMerge={mockOnMerge} />);
    expect(screen.getByText('git.mergeAction.noFf')).toBeInTheDocument();
  });

  it('renders select placeholder', () => {
    render(<GitMergeDialog branches={branches} currentBranch="main" onMerge={mockOnMerge} />);
    expect(screen.getByText('git.mergeAction.selectBranch')).toBeInTheDocument();
  });
});
