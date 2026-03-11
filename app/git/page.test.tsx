import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitPage from './page';

const mockRefreshAll = jest.fn().mockResolvedValue(undefined);
const mockSetRepoPath = jest.fn().mockResolvedValue(undefined);
const mockRefreshGitByScopes = jest.fn().mockResolvedValue(undefined);
const mockRefreshAdvancedByScopes = jest.fn().mockResolvedValue(undefined);
const mockRefreshSubmodules = jest.fn().mockResolvedValue(undefined);
const mockRefreshWorktrees = jest.fn().mockResolvedValue(undefined);
const mockRefreshHooks = jest.fn().mockResolvedValue(undefined);
const mockRefreshMergeRebaseState = jest.fn().mockResolvedValue(undefined);
const mockRefreshConflictedFiles = jest.fn().mockResolvedValue(undefined);
const mockRefreshLocalConfig = jest.fn().mockResolvedValue(undefined);
const mockRefreshRepoStats = jest.fn().mockResolvedValue(undefined);
const mockRefreshBisectState = jest.fn().mockResolvedValue(undefined);
const mockRefreshSparseCheckout = jest.fn().mockResolvedValue(undefined);
const mockLfsCheckAvailability = jest.fn().mockResolvedValue(undefined);
const mockLfsRefreshTracked = jest.fn().mockResolvedValue(undefined);
const mockLfsRefreshFiles = jest.fn().mockResolvedValue(undefined);
const mockStashShowDiff = jest.fn().mockResolvedValue('stash diff content');
const mockResetHead = jest.fn().mockResolvedValue('reset');
const mockGetAheadBehind = jest.fn().mockResolvedValue({ ahead: 0, behind: 0 });
const mockGetCommitDetail = jest.fn().mockResolvedValue(null);
const mockRefreshRepoInfo = jest.fn().mockResolvedValue(undefined);
const mockRefreshStatus = jest.fn().mockResolvedValue(undefined);
const mockRefreshBranches = jest.fn().mockResolvedValue(undefined);
const mockRefreshTags = jest.fn().mockResolvedValue(undefined);
const mockGetLog = jest.fn().mockResolvedValue(undefined);
const mockMerge = jest.fn().mockResolvedValue('merged');
const mockCommit = jest.fn().mockResolvedValue('committed');
const mockQuickRebase = jest.fn().mockResolvedValue('ok');
const mockQuickSquash = jest.fn().mockResolvedValue('ok');

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
        'git.tabs.tools': 'Tools',
        'git.tabs.advanced': 'Advanced',
        'git.tabs.operations': 'Operations',
        'git.diffView.unstaged': 'Unstaged',
        'git.diffView.staged': 'Staged',
        'git.diffView.fromCommit': 'From hash',
        'git.diffView.toCommit': 'To hash',
        'git.diffView.compare': 'Compare',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn().mockReturnValue(true),
  revealPath: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/hooks/use-git', () => ({
  useGit: () => ({
    available: true,
    version: '2.42.0',
    executablePath: '/usr/bin/git',
    loading: false,
    error: null,
    config: [],
    repoPath: '/test/repo',
    repoInfo: {
      rootPath: '/test/repo',
      currentBranch: 'main',
      isDirty: false,
      fileCountStaged: 0,
      fileCountModified: 0,
      fileCountUntracked: 0,
    },
    branches: [{ name: 'main', shortHash: 'abc1234', upstream: 'origin/main', isCurrent: true, isRemote: false }],
    remotes: [{ name: 'origin', fetchUrl: 'https://example.com/repo.git', pushUrl: 'https://example.com/repo.git' }],
    stashes: [{ id: 'stash@{0}', message: 'WIP', date: '2025-01-15T10:30:00+08:00' }],
    tags: [],
    commits: [],
    contributors: [],
    statusFiles: [],
    lastActionResult: null,
    graphReloadKey: 0,
    historyState: {
      log: { query: null, loading: false, empty: false, resultCount: 0, hasMore: false, error: null, updatedAt: null },
      search: { query: null, loading: false, empty: false, resultCount: 0, hasMore: false, error: null, updatedAt: null },
      fileHistory: { query: null, loading: false, empty: false, resultCount: 0, hasMore: false, error: null, updatedAt: null },
      fileStats: { query: null, loading: false, empty: false, resultCount: 0, hasMore: false, error: null, updatedAt: null },
      blame: { query: null, loading: false, empty: false, resultCount: 0, hasMore: false, error: null, updatedAt: null },
      reflog: { query: null, loading: false, empty: false, resultCount: 0, hasMore: false, error: null, updatedAt: null },
    },
    refreshAll: mockRefreshAll,
    refreshByScopes: mockRefreshGitByScopes,
    setRepoPath: mockSetRepoPath,
    refreshRepoInfo: mockRefreshRepoInfo,
    refreshStatus: mockRefreshStatus,
    refreshBranches: mockRefreshBranches,
    refreshRemotes: jest.fn().mockResolvedValue(undefined),
    refreshTags: mockRefreshTags,
    refreshStashes: jest.fn().mockResolvedValue(undefined),
    refreshContributors: jest.fn().mockResolvedValue(undefined),
    getAheadBehind: mockGetAheadBehind,
    getCommitDetail: mockGetCommitDetail,
    getConfigFilePath: jest.fn().mockRejectedValue(new Error('config path unavailable in test')),
    probeConfigEditor: jest.fn().mockResolvedValue({
      available: true,
      reason: 'ok',
      preferredEditor: 'code',
      configPath: '/home/user/.gitconfig',
      fallbackAvailable: true,
    }),
    openConfigInEditor: jest.fn().mockResolvedValue({
      success: true,
      kind: 'opened_editor',
      reason: 'ok',
      message: 'Opened in code',
      openedWith: 'code',
      fallbackUsed: false,
      fallbackPath: '/home/user/.gitconfig',
    }),
    getConfigValue: jest.fn().mockResolvedValue(null),
    listAliases: jest.fn().mockResolvedValue([]),
    setConfigIfUnset: jest.fn().mockResolvedValue(true),
    applyConfigPlan: jest.fn().mockResolvedValue({
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      results: [],
    }),
    setConfigValue: jest.fn().mockResolvedValue(undefined),
    removeConfigKey: jest.fn().mockResolvedValue(undefined),
    installGit: jest.fn().mockResolvedValue('installed'),
    updateGit: jest.fn().mockResolvedValue('updated'),
    initRepo: jest.fn().mockResolvedValue('initialized'),
    checkoutBranch: jest.fn().mockResolvedValue('checked'),
    createBranch: jest.fn().mockResolvedValue('created'),
    deleteBranch: jest.fn().mockResolvedValue('deleted'),
    branchRename: jest.fn().mockResolvedValue('renamed'),
    branchSetUpstream: jest.fn().mockResolvedValue('set'),
    deleteRemoteBranch: jest.fn().mockResolvedValue('deleted remote'),
    remoteAdd: jest.fn().mockResolvedValue('added'),
    remoteRemove: jest.fn().mockResolvedValue('removed'),
    remoteRename: jest.fn().mockResolvedValue('renamed'),
    remoteSetUrl: jest.fn().mockResolvedValue('set'),
    stashApply: jest.fn().mockResolvedValue('applied'),
    stashPop: jest.fn().mockResolvedValue('popped'),
    stashDrop: jest.fn().mockResolvedValue('dropped'),
    stashSave: jest.fn().mockResolvedValue('saved'),
    stashPushFiles: jest.fn().mockResolvedValue('saved files'),
    stashShowDiff: mockStashShowDiff,
    createTag: jest.fn().mockResolvedValue('tag'),
    deleteTag: jest.fn().mockResolvedValue('tag'),
    pushTags: jest.fn().mockResolvedValue('tags'),
    push: jest.fn().mockResolvedValue('pushed'),
    pull: jest.fn().mockResolvedValue('pulled'),
    fetch: jest.fn().mockResolvedValue('fetched'),
    cleanUntracked: jest.fn().mockResolvedValue('cleaned'),
    cleanDryRun: jest.fn().mockResolvedValue([]),
    cloneRepo: jest.fn().mockResolvedValue('cloned'),
    cancelClone: jest.fn().mockResolvedValue(undefined),
    extractRepoName: jest.fn().mockResolvedValue('repo'),
    validateGitUrl: jest.fn().mockResolvedValue(true),
    merge: mockMerge,
    getGraphLog: jest.fn().mockResolvedValue([]),
    getLog: mockGetLog,
    searchCommits: jest.fn().mockResolvedValue([]),
    getActivity: jest.fn().mockResolvedValue([]),
    getFileStats: jest.fn().mockResolvedValue([]),
    getFileHistory: jest.fn().mockResolvedValue([]),
    getBlame: jest.fn().mockResolvedValue([]),
    getReflog: jest.fn().mockResolvedValue([]),
    resetHead: mockResetHead,
    commit: mockCommit,
    getDiff: jest.fn().mockResolvedValue(''),
    getDiffBetween: jest.fn().mockResolvedValue(''),
    getCommitDiff: jest.fn().mockResolvedValue(''),
    cherryPick: jest.fn().mockResolvedValue('cherry'),
    revertCommit: jest.fn().mockResolvedValue('revert'),
  }),
}));

jest.mock('@/hooks/use-git-advanced', () => ({
  useGitAdvanced: () => ({
    submodules: [],
    worktrees: [],
    hooks: [],
    mergeRebaseState: { state: 'none', onto: null, progress: null, total: null },
    conflictedFiles: [],
    localConfig: [],
    repoStats: null,
    bisectState: { active: false, currentHash: null, stepsTaken: 0, remainingEstimate: null },
    sparsePatterns: [],
    isSparseCheckout: false,
    lastActionResult: null,
    refreshByScopes: mockRefreshAdvancedByScopes,
    refreshSubmodules: mockRefreshSubmodules,
    addSubmodule: jest.fn().mockResolvedValue('ok'),
    updateSubmodules: jest.fn().mockResolvedValue('ok'),
    removeSubmodule: jest.fn().mockResolvedValue('ok'),
    syncSubmodules: jest.fn().mockResolvedValue('ok'),
    refreshWorktrees: mockRefreshWorktrees,
    addWorktree: jest.fn().mockResolvedValue('ok'),
    removeWorktree: jest.fn().mockResolvedValue('ok'),
    pruneWorktrees: jest.fn().mockResolvedValue('ok'),
    getGitignore: jest.fn().mockResolvedValue(''),
    setGitignore: jest.fn().mockResolvedValue(undefined),
    checkIgnore: jest.fn().mockResolvedValue([]),
    addToGitignore: jest.fn().mockResolvedValue(undefined),
    refreshHooks: mockRefreshHooks,
    getHookContent: jest.fn().mockResolvedValue(''),
    setHookContent: jest.fn().mockResolvedValue(undefined),
    toggleHook: jest.fn().mockResolvedValue(undefined),
    refreshMergeRebaseState: mockRefreshMergeRebaseState,
    refreshConflictedFiles: mockRefreshConflictedFiles,
    resolveFileOurs: jest.fn().mockResolvedValue('ok'),
    resolveFileTheirs: jest.fn().mockResolvedValue('ok'),
    resolveFileMark: jest.fn().mockResolvedValue('ok'),
    mergeAbort: jest.fn().mockResolvedValue('ok'),
    mergeContinue: jest.fn().mockResolvedValue('ok'),
    cherryPickAbort: jest.fn().mockResolvedValue('ok'),
    cherryPickContinue: jest.fn().mockResolvedValue('ok'),
    revertAbort: jest.fn().mockResolvedValue('ok'),
    rebase: mockQuickRebase,
    rebaseAbort: jest.fn().mockResolvedValue('ok'),
    rebaseContinue: jest.fn().mockResolvedValue('ok'),
    rebaseSkip: jest.fn().mockResolvedValue('ok'),
    squash: mockQuickSquash,
    getRebaseTodoPreview: jest.fn().mockResolvedValue([]),
    startInteractiveRebase: jest.fn().mockResolvedValue('ok'),
    bisectStart: jest.fn().mockResolvedValue('ok'),
    bisectGood: jest.fn().mockResolvedValue('ok'),
    bisectBad: jest.fn().mockResolvedValue('ok'),
    bisectSkip: jest.fn().mockResolvedValue('ok'),
    bisectReset: jest.fn().mockResolvedValue('ok'),
    bisectLog: jest.fn().mockResolvedValue('ok'),
    refreshBisectState: mockRefreshBisectState,
    refreshLocalConfig: mockRefreshLocalConfig,
    setLocalConfig: jest.fn().mockResolvedValue(undefined),
    removeLocalConfig: jest.fn().mockResolvedValue(undefined),
    getLocalConfigValue: jest.fn().mockResolvedValue(null),
    refreshRepoStats: mockRefreshRepoStats,
    fsck: jest.fn().mockResolvedValue([]),
    describe: jest.fn().mockResolvedValue(null),
    isShallow: jest.fn().mockResolvedValue(false),
    deepen: jest.fn().mockResolvedValue('ok'),
    unshallow: jest.fn().mockResolvedValue('ok'),
    refreshSparseCheckout: mockRefreshSparseCheckout,
    sparseCheckoutInit: jest.fn().mockResolvedValue('ok'),
    sparseCheckoutSet: jest.fn().mockResolvedValue('ok'),
    sparseCheckoutAdd: jest.fn().mockResolvedValue('ok'),
    sparseCheckoutDisable: jest.fn().mockResolvedValue('ok'),
    archive: jest.fn().mockResolvedValue('ok'),
    formatPatch: jest.fn().mockResolvedValue([]),
    applyPatch: jest.fn().mockResolvedValue('ok'),
    applyMailbox: jest.fn().mockResolvedValue('ok'),
    remotePrune: jest.fn().mockResolvedValue('ok'),
    stashBranch: jest.fn().mockResolvedValue('ok'),
    verifyCommit: jest.fn().mockResolvedValue('ok'),
    verifyTag: jest.fn().mockResolvedValue('ok'),
  }),
}));

jest.mock('@/hooks/use-git-lfs', () => ({
  useGitLfs: () => ({
    lfsAvailable: true,
    lfsVersion: '3.4.0',
    trackedPatterns: [],
    lfsFiles: [],
    checkAvailability: mockLfsCheckAvailability,
    refreshTrackedPatterns: mockLfsRefreshTracked,
    refreshLfsFiles: mockLfsRefreshFiles,
    track: jest.fn().mockResolvedValue('ok'),
    untrack: jest.fn().mockResolvedValue('ok'),
    install: jest.fn().mockResolvedValue('ok'),
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/git', () => ({
  GitStatusCard: () => <div data-testid="git-status">status</div>,
  GitConfigCard: () => <div data-testid="git-config">config</div>,
  GitGlobalSettingsCard: () => <div data-testid="git-global-settings">global</div>,
  GitAliasCard: () => <div data-testid="git-alias">alias</div>,
  GitRepoSelector: ({ onSelect }: { onSelect?: (path: string) => void }) => (
    <div data-testid="repo-selector">
      <button data-testid="select-repo" onClick={() => onSelect?.('/new/repo')}>select</button>
    </div>
  ),
  GitBranchCard: () => <div data-testid="branch-card">branch</div>,
  GitRemoteCard: () => <div data-testid="remote-card">remote</div>,
  GitStashList: ({ onShowDiff }: { onShowDiff?: (id?: string) => Promise<string> }) => (
    <div data-testid="stash-list">
      <button data-testid="show-stash-diff" onClick={() => void onShowDiff?.('stash@{0}')}>diff</button>
    </div>
  ),
  GitTagList: () => <div data-testid="tag-list">tag</div>,
  GitCommitLog: () => <div data-testid="commit-log">commit-log</div>,
  GitContributorsChart: () => <div data-testid="contributors">contributors</div>,
  GitFileHistory: () => <div data-testid="file-history">file-history</div>,
  GitBlameView: () => <div data-testid="blame-view">blame</div>,
  GitEmptyState: () => <div data-testid="empty-state">empty</div>,
  GitNotAvailable: () => <div data-testid="not-available">not-available</div>,
  GitRepoInfoCard: () => <div data-testid="repo-info">repo-info</div>,
  GitCommitDetail: ({ hash }: { hash?: string | null }) => (
    <div data-testid="commit-detail">{hash ?? 'commit-detail'}</div>
  ),
  GitStatusFiles: () => <div data-testid="status-files">status-files</div>,
  GitSearchCommits: () => <div data-testid="search-commits">search-commits</div>,
  GitCommitGraph: ({
    onResetTo,
    onSelectCommit,
    selectedHash,
    refreshKey,
  }: {
    onResetTo?: (hash: string) => void;
    onSelectCommit?: (hash: string) => void;
    selectedHash?: string | null;
    refreshKey?: number;
  }) => (
    <div data-testid="commit-graph">
      graph
      <div data-testid="graph-refresh">{String(refreshKey ?? '')}</div>
      <div data-testid="graph-selected">{String(selectedHash ?? '')}</div>
      <button data-testid="select-from-graph" onClick={() => onSelectCommit?.('abc1234')}>select</button>
      <button data-testid="reset-from-graph" onClick={() => onResetTo?.('abc1234')}>reset</button>
    </div>
  ),
  GitVisualFileHistory: () => <div data-testid="visual-file-history">visual-history</div>,
  GitActivityHeatmap: () => <div data-testid="activity-heatmap">activity</div>,
  GitCommitDialog: ({
    onCommit,
  }: {
    onCommit?: (
      message: string,
      amend?: boolean,
      allowEmpty?: boolean,
      signoff?: boolean,
      noVerify?: boolean,
    ) => Promise<string>;
  }) => (
    <div data-testid="commit-dialog">
      commit-dialog
      <button data-testid="commit-action" onClick={() => void onCommit?.('feat: commit', false, false, false, false)}>commit</button>
    </div>
  ),
  GitDiffViewer: () => <div data-testid="diff-viewer">diff-viewer</div>,
  GitCloneDialog: () => <div data-testid="clone-dialog">clone</div>,
  GitMergeDialog: ({
    onMerge,
  }: {
    onMerge?: (branch: string, noFf?: boolean) => Promise<string>;
  }) => (
    <div data-testid="merge-dialog">
      merge
      <button data-testid="merge-action" onClick={() => void onMerge?.('feature/demo', true)}>merge</button>
    </div>
  ),
  GitReflogCard: ({
    onResetTo,
    onSelectCommit,
  }: {
    onResetTo?: (hash: string, mode?: string) => Promise<string>;
    onSelectCommit?: (hash: string) => void;
  }) => (
    <div data-testid="reflog-card">
      reflog
      <button data-testid="reflog-reset" onClick={() => void onResetTo?.('def5678', 'hard')}>reset</button>
      <button data-testid="reflog-select" onClick={() => onSelectCommit?.('abc1234')}>select</button>
    </div>
  ),
  GitRepoActionBar: () => <div data-testid="repo-action-bar">actions</div>,
  GitConflictBanner: () => <div data-testid="conflict-banner">conflict</div>,
  GitSubmodulesCard: () => <div data-testid="submodules-card">submodules</div>,
  GitWorktreesCard: () => <div data-testid="worktrees-card">worktrees</div>,
  GitGitignoreCard: () => <div data-testid="gitignore-card">gitignore</div>,
  GitHooksCard: () => <div data-testid="hooks-card">hooks</div>,
  GitLfsCard: () => <div data-testid="lfs-card">lfs</div>,
  GitLocalConfigCard: () => <div data-testid="local-config-card">local-config</div>,
  GitRepoStatsCard: () => <div data-testid="repo-stats-card">repo-stats</div>,
  GitSparseCheckoutCard: () => <div data-testid="sparse-card">sparse</div>,
  GitRemotePruneCard: () => <div data-testid="remote-prune-card">prune</div>,
  GitSignatureVerifyCard: () => <div data-testid="signature-card">signature</div>,
  GitRebaseSquashCard: ({
    onRebase,
    onSquash,
  }: {
    onRebase?: (onto: string, confirmRisk?: boolean) => Promise<string>;
    onSquash?: (count: number, message: string, confirmRisk?: boolean) => Promise<string>;
  }) => (
    <div data-testid="rebase-squash-card">
      <button data-testid="quick-rebase" onClick={() => void onRebase?.('main')}>rebase</button>
      <button data-testid="quick-squash" onClick={() => void onSquash?.(3, 'squash message')}>squash</button>
    </div>
  ),
  GitInteractiveRebaseCard: () => <div data-testid="interactive-rebase-card">rebase</div>,
  GitBisectCard: () => <div data-testid="bisect-card">bisect</div>,
  GitArchiveCard: () => <div data-testid="archive-card">archive</div>,
  GitPatchCard: () => <div data-testid="patch-card">patch</div>,
}));

describe('GitPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderGitPage = async () => {
    await act(async () => {
      render(<GitPage />);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockRefreshAll).toHaveBeenCalled();
      expect(mockGetAheadBehind).toHaveBeenCalled();
    });
  };

  it('renders all 8 tabs', async () => {
    await renderGitPage();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /repository/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /graph/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /changes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tools/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /advanced/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /operations/i })).toBeInTheDocument();
  });

  it('calls refreshAll on mount', async () => {
    await renderGitPage();
    expect(mockRefreshAll).toHaveBeenCalled();
  });

  it('switches to tools/advanced/operations tabs', async () => {
    const user = userEvent.setup();
    await renderGitPage();

    await user.click(screen.getByRole('tab', { name: /tools/i }));
    expect(screen.getByTestId('submodules-card')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /advanced/i }));
    expect(screen.getByTestId('local-config-card')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /operations/i }));
    expect(screen.getByTestId('interactive-rebase-card')).toBeInTheDocument();
  });

  it('loads stash diff and switches to changes tab', async () => {
    const user = userEvent.setup();
    await renderGitPage();

    await user.click(screen.getByRole('tab', { name: /repository/i }));
    await user.click(screen.getByTestId('show-stash-diff'));

    await waitFor(() => {
      expect(mockStashShowDiff).toHaveBeenCalledWith('stash@{0}');
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /changes/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('refreshes advanced and lfs data after repository selection', async () => {
    const user = userEvent.setup();
    await renderGitPage();

    await user.click(screen.getByRole('tab', { name: /repository/i }));
    await user.click(screen.getByTestId('select-repo'));

    await waitFor(() => {
      expect(mockSetRepoPath).toHaveBeenCalledWith('/new/repo');
      expect(mockRefreshSubmodules).toHaveBeenCalled();
      expect(mockLfsCheckAvailability).toHaveBeenCalled();
    });
  });

  it('wires commit graph reset action to resetHead', async () => {
    const user = userEvent.setup();
    await renderGitPage();
    const prevRefreshScopes = mockRefreshGitByScopes.mock.calls.length;

    await user.click(screen.getByRole('tab', { name: /graph/i }));
    expect(screen.getByTestId('graph-refresh')).toHaveTextContent('0');
    await user.click(screen.getByTestId('reset-from-graph'));

    await waitFor(() => {
      expect(mockResetHead).toHaveBeenCalledWith('mixed', 'abc1234', true);
      expect(mockRefreshGitByScopes.mock.calls.length).toBeGreaterThan(prevRefreshScopes);
    });
    expect(mockRefreshGitByScopes).toHaveBeenCalledWith(
      expect.arrayContaining(['graph']),
    );
  });

  it('uses shared commit selection when graph entry is selected', async () => {
    const user = userEvent.setup();
    await renderGitPage();

    await user.click(screen.getByRole('tab', { name: /graph/i }));
    await user.click(screen.getByTestId('select-from-graph'));

    await waitFor(() => {
      expect(mockGetCommitDetail).toHaveBeenCalledWith('abc1234');
      expect(screen.getByTestId('graph-selected')).toHaveTextContent('abc1234');
    });
  });

  it('wires reflog reset action and refreshes graph-related data', async () => {
    const user = userEvent.setup();
    await renderGitPage();
    const prevRefreshScopes = mockRefreshGitByScopes.mock.calls.length;

    await user.click(screen.getByRole('tab', { name: /history/i }));
    await user.click(screen.getByTestId('reflog-reset'));

    await waitFor(() => {
      expect(mockResetHead).toHaveBeenCalledWith('hard', 'def5678', true);
      expect(mockRefreshGitByScopes.mock.calls.length).toBeGreaterThan(prevRefreshScopes);
    });
    expect(mockRefreshGitByScopes).toHaveBeenCalledWith(
      expect.arrayContaining(['graph']),
    );
  });

  it('uses shared commit selection when reflog entry is selected', async () => {
    const user = userEvent.setup();
    await renderGitPage();

    await user.click(screen.getByRole('tab', { name: /history/i }));
    await user.click(screen.getByTestId('reflog-select'));

    await waitFor(() => {
      expect(mockGetCommitDetail).toHaveBeenCalledWith('abc1234');
    });
  });

  it('wires quick rebase/squash actions from operations tab', async () => {
    const user = userEvent.setup();
    await renderGitPage();

    await user.click(screen.getByRole('tab', { name: /operations/i }));
    await user.click(screen.getByTestId('quick-rebase'));
    await user.click(screen.getByTestId('quick-squash'));

    await waitFor(() => {
      expect(mockQuickRebase).toHaveBeenCalledWith('main', undefined);
      expect(mockQuickSquash).toHaveBeenCalledWith(3, 'squash message', undefined);
    });
  });

  it('wires merge action and refreshes graph-related data', async () => {
    const user = userEvent.setup();
    await renderGitPage();
    const prevRefreshScopes = mockRefreshGitByScopes.mock.calls.length;
    const prevAdvancedScopes = mockRefreshAdvancedByScopes.mock.calls.length;

    await user.click(screen.getByRole('tab', { name: /repository/i }));
    await user.click(screen.getByTestId('merge-action'));

    await waitFor(() => {
      expect(mockMerge).toHaveBeenCalledWith('feature/demo', true);
      expect(mockRefreshGitByScopes.mock.calls.length).toBeGreaterThan(prevRefreshScopes);
      expect(mockRefreshAdvancedByScopes.mock.calls.length).toBeGreaterThan(prevAdvancedScopes);
    });
    expect(mockRefreshGitByScopes).toHaveBeenCalledWith(
      expect.arrayContaining(['graph']),
    );
  });

  it('wires commit action and refreshes graph-related data', async () => {
    const user = userEvent.setup();
    await renderGitPage();
    const prevRefreshScopes = mockRefreshGitByScopes.mock.calls.length;
    const prevAdvancedScopes = mockRefreshAdvancedByScopes.mock.calls.length;

    await user.click(screen.getByRole('tab', { name: /changes/i }));
    await user.click(screen.getByTestId('commit-action'));

    await waitFor(() => {
      expect(mockCommit).toHaveBeenCalledWith('feat: commit', false, false, false, false);
      expect(mockRefreshGitByScopes.mock.calls.length).toBeGreaterThan(prevRefreshScopes);
      expect(mockRefreshAdvancedByScopes.mock.calls.length).toBeGreaterThan(prevAdvancedScopes);
    });
    expect(mockRefreshGitByScopes).toHaveBeenCalledWith(
      expect.arrayContaining(['graph']),
    );
  });
});

describe('GitPage - Non-Tauri', () => {
  beforeEach(() => {
    const tauri = jest.requireMock('@/lib/tauri');
    tauri.isTauri.mockReturnValue(false);
  });

  afterEach(() => {
    const tauri = jest.requireMock('@/lib/tauri');
    tauri.isTauri.mockReturnValue(true);
  });

  it('shows not available in browser mode', () => {
    render(<GitPage />);
    expect(screen.getByTestId('not-available')).toBeInTheDocument();
  });
});
