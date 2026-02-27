import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitPage from './page';

const mockRefreshAll = jest.fn().mockResolvedValue(undefined);
const mockGetCommitDetail = jest.fn().mockResolvedValue(null);
const mockInstallGit = jest.fn().mockResolvedValue('installed');
const mockUpdateGit = jest.fn().mockResolvedValue('updated');
const mockSetRepoPath = jest.fn().mockResolvedValue(undefined);
const mockSetConfigValue = jest.fn().mockResolvedValue(undefined);
const mockRemoveConfigKey = jest.fn().mockResolvedValue(undefined);

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'git.title': 'Git',
        'git.description': 'Git version control management',
        'git.tabs.overview': 'Overview',
        'git.tabs.repository': 'Repository',
        'git.tabs.graph': 'Graph',
        'git.tabs.history': 'History',
        'git.tabs.changes': 'Changes',
        'git.status.installSuccess': 'Git installed',
        'git.status.updateSuccess': 'Git updated',
        'git.config.saved': 'Config saved',
        'git.config.removed': 'Config removed',
        'git.repo.noRepo': 'No repository selected',
        'git.diffView.unstaged': 'Unstaged',
        'git.diffView.staged': 'Staged',
        'git.commit.success': 'Commit created',
        'git.cloneAction.success': 'Cloned',
        'git.mergeAction.success': 'Merged',
        'git.resetAction.success': 'Reset',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn().mockReturnValue(true),
}));

jest.mock('@/hooks/use-git', () => ({
  useGit: () => ({
    available: true,
    version: '2.42.0',
    executablePath: '/usr/bin/git',
    loading: false,
    error: null,
    config: { 'user.name': 'Test', 'user.email': 'test@test.com' },
    repoPath: '/test/repo',
    repoInfo: {
      currentBranch: 'main',
      isDetached: false,
      isDirty: false,
      headCommit: 'abc123',
      aheadBehind: [0, 0],
    },
    branches: ['main', 'develop'],
    remotes: [{ name: 'origin', url: 'https://github.com/test/repo.git' }],
    stashes: [],
    tags: [],
    commits: [],
    contributors: [],
    statusFiles: [],
    refreshAll: mockRefreshAll,
    refreshStatus: jest.fn().mockResolvedValue(undefined),
    getCommitDetail: mockGetCommitDetail,
    installGit: mockInstallGit,
    updateGit: mockUpdateGit,
    setRepoPath: mockSetRepoPath,
    setConfigValue: mockSetConfigValue,
    removeConfigKey: mockRemoveConfigKey,
    cloneRepo: jest.fn().mockResolvedValue('cloned'),
    extractRepoName: jest.fn(),
    validateGitUrl: jest.fn(),
    merge: jest.fn().mockResolvedValue('merged'),
    getGraphLog: jest.fn(),
    getLog: jest.fn(),
    searchCommits: jest.fn(),
    getActivity: jest.fn(),
    getFileStats: jest.fn(),
    getFileHistory: jest.fn(),
    getBlame: jest.fn(),
    getReflog: jest.fn(),
    resetHead: jest.fn().mockResolvedValue('reset'),
    commit: jest.fn().mockResolvedValue('committed'),
    getDiff: jest.fn().mockResolvedValue(''),
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/git', () => ({
  GitStatusCard: ({ available, version, onInstall, onUpdate, onRefresh }: {
    available: boolean; version: string | null;
    onInstall?: () => void; onUpdate?: () => void; onRefresh?: () => void;
  }) => (
    <div data-testid="git-status">
      {available ? `Git v${version}` : 'Not available'}
      {onInstall && <button data-testid="install-git" onClick={onInstall}>Install</button>}
      {onUpdate && <button data-testid="update-git" onClick={onUpdate}>Update</button>}
      {onRefresh && <button data-testid="refresh-git" onClick={onRefresh}>Refresh</button>}
    </div>
  ),
  GitConfigCard: ({ onSet, onRemove }: { config: Record<string, string>; onSet?: (k: string, v: string) => void; onRemove?: (k: string) => void }) => (
    <div data-testid="git-config">
      Config
      {onSet && <button data-testid="set-config" onClick={() => onSet('user.name', 'NewName')}>Set</button>}
      {onRemove && <button data-testid="remove-config" onClick={() => onRemove('user.name')}>Remove</button>}
    </div>
  ),
  GitRepoSelector: ({ onSelect }: { onSelect?: (p: string) => void }) => (
    <div data-testid="repo-selector">
      Repo Selector
      {onSelect && <button data-testid="select-repo" onClick={() => onSelect('/new/repo')}>Select</button>}
    </div>
  ),
  GitBranchCard: () => <div data-testid="branch-card">Branches</div>,
  GitRemoteCard: () => <div data-testid="remote-card">Remotes</div>,
  GitStashList: () => <div data-testid="stash-list">Stashes</div>,
  GitTagList: () => <div data-testid="tag-list">Tags</div>,
  GitCommitLog: () => <div data-testid="commit-log">Commit Log</div>,
  GitContributorsChart: () => <div data-testid="contributors">Contributors</div>,
  GitFileHistory: () => <div data-testid="file-history">File History</div>,
  GitBlameView: () => <div data-testid="blame-view">Blame</div>,
  GitEmptyState: () => <div data-testid="empty-state">Git not installed</div>,
  GitNotAvailable: () => <div data-testid="not-available">Not available in browser</div>,
  GitRepoInfoCard: () => <div data-testid="repo-info">Repo Info</div>,
  GitCommitDetail: () => <div data-testid="commit-detail">Commit Detail</div>,
  GitStatusFiles: () => <div data-testid="status-files">Status Files</div>,
  GitSearchCommits: () => <div data-testid="search-commits">Search Commits</div>,
  GitCommitGraph: () => <div data-testid="commit-graph">Commit Graph</div>,
  GitVisualFileHistory: () => <div data-testid="visual-file-history">Visual File History</div>,
  GitActivityHeatmap: () => <div data-testid="activity-heatmap">Activity Heatmap</div>,
  GitCommitDialog: () => <div data-testid="commit-dialog">Commit Dialog</div>,
  GitDiffViewer: () => <div data-testid="diff-viewer">Diff Viewer</div>,
  GitCloneDialog: () => <div data-testid="clone-dialog">Clone Dialog</div>,
  GitMergeDialog: () => <div data-testid="merge-dialog">Merge Dialog</div>,
  GitReflogCard: () => <div data-testid="reflog-card">Reflog</div>,
}));

describe('GitPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title and description', () => {
    render(<GitPage />);
    expect(screen.getByText('Git')).toBeInTheDocument();
    expect(screen.getByText('Git version control management')).toBeInTheDocument();
  });

  it('renders all 5 tabs', () => {
    render(<GitPage />);
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /repository/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /graph/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /changes/i })).toBeInTheDocument();
  });

  it('shows git status card on overview tab', () => {
    render(<GitPage />);
    expect(screen.getByTestId('git-status')).toHaveTextContent('Git v2.42.0');
  });

  it('shows config card when git is available', () => {
    render(<GitPage />);
    expect(screen.getByTestId('git-config')).toBeInTheDocument();
  });

  it('switches to repository tab', async () => {
    const user = userEvent.setup();
    render(<GitPage />);

    await user.click(screen.getByRole('tab', { name: /repository/i }));
    await waitFor(() => {
      expect(screen.getByTestId('repo-selector')).toBeInTheDocument();
      expect(screen.getByTestId('repo-info')).toBeInTheDocument();
    });
  });

  it('switches to graph tab', async () => {
    const user = userEvent.setup();
    render(<GitPage />);

    await user.click(screen.getByRole('tab', { name: /graph/i }));
    await waitFor(() => {
      expect(screen.getByTestId('commit-graph')).toBeInTheDocument();
    });
  });

  it('switches to changes tab', async () => {
    const user = userEvent.setup();
    render(<GitPage />);

    await user.click(screen.getByRole('tab', { name: /changes/i }));
    await waitFor(() => {
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      expect(screen.getByTestId('commit-dialog')).toBeInTheDocument();
    });
  });

  it('calls refreshAll on mount', () => {
    render(<GitPage />);
    expect(mockRefreshAll).toHaveBeenCalled();
  });
});

describe('GitPage - Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles install git button click', async () => {
    const user = userEvent.setup();
    render(<GitPage />);
    await user.click(screen.getByTestId('install-git'));
    await waitFor(() => {
      expect(mockInstallGit).toHaveBeenCalled();
    });
  });

  it('handles update git button click', async () => {
    const user = userEvent.setup();
    render(<GitPage />);
    await user.click(screen.getByTestId('update-git'));
    await waitFor(() => {
      expect(mockUpdateGit).toHaveBeenCalled();
    });
  });

  it('handles refresh git button click', async () => {
    const user = userEvent.setup();
    render(<GitPage />);
    await user.click(screen.getByTestId('refresh-git'));
    await waitFor(() => {
      expect(mockRefreshAll).toHaveBeenCalled();
    });
  });

  it('handles set config', async () => {
    const user = userEvent.setup();
    render(<GitPage />);
    await user.click(screen.getByTestId('set-config'));
    await waitFor(() => {
      expect(mockSetConfigValue).toHaveBeenCalledWith('user.name', 'NewName');
    });
  });

  it('handles remove config', async () => {
    const user = userEvent.setup();
    render(<GitPage />);
    await user.click(screen.getByTestId('remove-config'));
    await waitFor(() => {
      expect(mockRemoveConfigKey).toHaveBeenCalledWith('user.name');
    });
  });

  it('handles select repo on repository tab', async () => {
    const user = userEvent.setup();
    render(<GitPage />);
    await user.click(screen.getByRole('tab', { name: /repository/i }));
    await waitFor(() => {
      expect(screen.getByTestId('select-repo')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('select-repo'));
    await waitFor(() => {
      expect(mockSetRepoPath).toHaveBeenCalledWith('/new/repo');
    });
  });

  it('switches to history tab', async () => {
    const user = userEvent.setup();
    render(<GitPage />);
    await user.click(screen.getByRole('tab', { name: /history/i }));
    await waitFor(() => {
      expect(screen.getByTestId('commit-log')).toBeInTheDocument();
      expect(screen.getByTestId('search-commits')).toBeInTheDocument();
    });
  });
});

describe('GitPage - Non-Tauri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const tauri = jest.requireMock('@/lib/tauri');
    tauri.isTauri.mockReturnValue(false);
  });

  afterEach(() => {
    const tauri = jest.requireMock('@/lib/tauri');
    tauri.isTauri.mockReturnValue(true);
  });

  it('shows not-available state in browser mode', () => {
    render(<GitPage />);
    expect(screen.getByTestId('not-available')).toBeInTheDocument();
  });
});
