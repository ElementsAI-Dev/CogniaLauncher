import { render, screen, fireEvent } from '@testing-library/react';
import { GitConflictBanner } from './git-conflict-banner';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        'git.conflict.title': 'Conflict Resolution',
        'git.conflict.merging': 'Merging',
        'git.conflict.rebasing': 'Rebasing',
        'git.conflict.cherryPicking': 'Cherry-picking',
        'git.conflict.reverting': 'Reverting',
        'git.conflict.progress': `Step ${params?.current} of ${params?.total}`,
        'git.conflict.conflictedFiles': 'Conflicted Files',
        'git.conflict.noConflicts': 'No conflicts',
        'git.conflict.resolveOurs': 'Use Ours',
        'git.conflict.resolveTheirs': 'Use Theirs',
        'git.conflict.markResolved': 'Mark Resolved',
        'git.conflict.abort': 'Abort',
        'git.conflict.continue': 'Continue',
        'git.conflict.skip': 'Skip',
      };
      return map[key] || key;
    },
  }),
}));

const defaultProps = {
  repoPath: '/repo',
  mergeRebaseState: { state: 'none' as const, onto: null, progress: null, total: null },
  conflictedFiles: [] as string[],
  onRefreshState: jest.fn().mockResolvedValue(undefined),
  onRefreshConflicts: jest.fn().mockResolvedValue(undefined),
  onResolveOurs: jest.fn().mockResolvedValue('Resolved'),
  onResolveTheirs: jest.fn().mockResolvedValue('Resolved'),
  onMarkResolved: jest.fn().mockResolvedValue('Resolved'),
  onAbort: jest.fn().mockResolvedValue('Aborted'),
  onContinue: jest.fn().mockResolvedValue('Continued'),
  onSkip: jest.fn().mockResolvedValue('Skipped'),
};

beforeEach(() => jest.clearAllMocks());

describe('GitConflictBanner', () => {
  it('renders nothing when state is none', () => {
    const { container } = render(<GitConflictBanner {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders merging state', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'merging', onto: null, progress: null, total: null }}
      />
    );
    expect(screen.getByText('Conflict Resolution')).toBeInTheDocument();
    expect(screen.getByText('Merging')).toBeInTheDocument();
  });

  it('renders rebasing state with progress', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'rebasing', onto: 'abc1234', progress: 3, total: 7 }}
      />
    );
    expect(screen.getByText('Rebasing')).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 7')).toBeInTheDocument();
  });

  it('renders cherry-picking state', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'cherry_picking', onto: null, progress: null, total: null }}
      />
    );
    expect(screen.getByText('Cherry-picking')).toBeInTheDocument();
  });

  it('renders reverting state', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'reverting', onto: null, progress: null, total: null }}
      />
    );
    expect(screen.getByText('Reverting')).toBeInTheDocument();
  });

  it('renders conflicted files with resolution buttons', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'merging', onto: null, progress: null, total: null }}
        conflictedFiles={['src/main.rs', 'README.md']}
      />
    );
    expect(screen.getByText('src/main.rs')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getAllByText('Use Ours')).toHaveLength(2);
    expect(screen.getAllByText('Use Theirs')).toHaveLength(2);
    expect(screen.getAllByText('Mark Resolved')).toHaveLength(2);
  });

  it('shows no conflicts message when list is empty', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'merging', onto: null, progress: null, total: null }}
        conflictedFiles={[]}
      />
    );
    expect(screen.getByText('No conflicts')).toBeInTheDocument();
  });

  it('calls onAbort when abort button clicked', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'merging', onto: null, progress: null, total: null }}
      />
    );
    fireEvent.click(screen.getByText('Abort'));
    expect(defaultProps.onAbort).toHaveBeenCalled();
  });

  it('calls onContinue when continue button clicked', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'merging', onto: null, progress: null, total: null }}
      />
    );
    fireEvent.click(screen.getByText('Continue'));
    expect(defaultProps.onContinue).toHaveBeenCalled();
  });

  it('shows skip button only for rebasing state', () => {
    const { rerender } = render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'merging', onto: null, progress: null, total: null }}
      />
    );
    expect(screen.queryByText('Skip')).not.toBeInTheDocument();

    rerender(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'rebasing', onto: null, progress: null, total: null }}
      />
    );
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('calls resolve callbacks with file name', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'merging', onto: null, progress: null, total: null }}
        conflictedFiles={['file.txt']}
      />
    );
    fireEvent.click(screen.getByText('Use Ours'));
    expect(defaultProps.onResolveOurs).toHaveBeenCalledWith('file.txt');

    fireEvent.click(screen.getByText('Use Theirs'));
    expect(defaultProps.onResolveTheirs).toHaveBeenCalledWith('file.txt');

    fireEvent.click(screen.getByText('Mark Resolved'));
    expect(defaultProps.onMarkResolved).toHaveBeenCalledWith('file.txt');
  });

  it('refreshes state and conflicts on mount', () => {
    render(
      <GitConflictBanner
        {...defaultProps}
        mergeRebaseState={{ state: 'merging', onto: null, progress: null, total: null }}
      />
    );
    expect(defaultProps.onRefreshState).toHaveBeenCalled();
    expect(defaultProps.onRefreshConflicts).toHaveBeenCalled();
  });
});
