import { renderHook, act } from '@testing-library/react';
import { useGitAdvanced } from './use-git-advanced';

jest.mock('@/lib/tauri', () => ({
  isTauri: () => true,
  gitListSubmodules: jest.fn().mockResolvedValue([
    { path: 'lib/vendor', hash: 'abc1234', status: 'initialized', describe: 'v1.0' },
  ]),
  gitAddSubmodule: jest.fn().mockResolvedValue("Submodule added"),
  gitUpdateSubmodules: jest.fn().mockResolvedValue("Submodules updated"),
  gitRemoveSubmodule: jest.fn().mockResolvedValue("Submodule removed"),
  gitSyncSubmodules: jest.fn().mockResolvedValue("Synced"),
  gitListWorktrees: jest.fn().mockResolvedValue([
    { path: '/project', head: 'abc1234', branch: 'main', isBare: false, isDetached: false },
  ]),
  gitAddWorktree: jest.fn().mockResolvedValue("Worktree added"),
  gitRemoveWorktree: jest.fn().mockResolvedValue("Worktree removed"),
  gitPruneWorktrees: jest.fn().mockResolvedValue("Pruned"),
  gitGetGitignore: jest.fn().mockResolvedValue("node_modules/\n.env\n"),
  gitSetGitignore: jest.fn().mockResolvedValue(undefined),
  gitCheckIgnore: jest.fn().mockResolvedValue(["node_modules/test.js"]),
  gitAddToGitignore: jest.fn().mockResolvedValue(undefined),
  gitListHooks: jest.fn().mockResolvedValue([
    { name: 'pre-commit', enabled: true, hasContent: true, fileName: 'pre-commit' },
  ]),
  gitGetHookContent: jest.fn().mockResolvedValue("#!/bin/sh\nexit 0"),
  gitSetHookContent: jest.fn().mockResolvedValue(undefined),
  gitToggleHook: jest.fn().mockResolvedValue(undefined),
  gitGetMergeRebaseState: jest.fn().mockResolvedValue({ state: 'none', onto: null, progress: null, total: null }),
  gitGetConflictedFiles: jest.fn().mockResolvedValue([]),
  gitResolveFileOurs: jest.fn().mockResolvedValue("Resolved using ours"),
  gitResolveFileTheirs: jest.fn().mockResolvedValue("Resolved using theirs"),
  gitResolveFileMark: jest.fn().mockResolvedValue("Marked as resolved"),
  gitMergeAbort: jest.fn().mockResolvedValue("Merge aborted"),
  gitMergeContinue: jest.fn().mockResolvedValue("Merge continued"),
  gitCherryPickAbort: jest.fn().mockResolvedValue("Cherry-pick aborted"),
  gitCherryPickContinue: jest.fn().mockResolvedValue("Cherry-pick continued"),
  gitRevertAbort: jest.fn().mockResolvedValue("Revert aborted"),
  gitRebase: jest.fn().mockResolvedValue("Rebased"),
  gitRebaseAbort: jest.fn().mockResolvedValue("Rebase aborted"),
  gitRebaseContinue: jest.fn().mockResolvedValue("Rebase continued"),
  gitRebaseSkip: jest.fn().mockResolvedValue("Rebase skipped"),
  gitSquash: jest.fn().mockResolvedValue("Squashed"),
  gitGetRebaseTodoPreview: jest.fn().mockResolvedValue([
    { action: 'pick', hash: 'abc1234', message: 'First commit' },
    { action: 'pick', hash: 'def5678', message: 'Second commit' },
  ]),
  gitStartInteractiveRebase: jest.fn().mockResolvedValue("Interactive rebase completed"),
  gitBisectStart: jest.fn().mockResolvedValue("Bisecting: 5 revisions left"),
  gitBisectGood: jest.fn().mockResolvedValue("Bisecting: 2 revisions left"),
  gitBisectBad: jest.fn().mockResolvedValue("Bisecting: 1 revision left"),
  gitBisectSkip: jest.fn().mockResolvedValue("Bisecting: skipped"),
  gitBisectReset: jest.fn().mockResolvedValue("Bisect session ended"),
  gitBisectLog: jest.fn().mockResolvedValue("# good: abc1234\n# bad: def5678"),
  gitGetBisectState: jest.fn().mockResolvedValue({ active: false, currentHash: null, stepsTaken: 0, remainingEstimate: null }),
  gitGetLocalConfig: jest.fn().mockResolvedValue([{ key: 'core.autocrlf', value: 'true' }]),
  gitSetLocalConfig: jest.fn().mockResolvedValue(undefined),
  gitRemoveLocalConfig: jest.fn().mockResolvedValue(undefined),
  gitGetLocalConfigValue: jest.fn().mockResolvedValue('true'),
  gitIsShallow: jest.fn().mockResolvedValue(false),
  gitDeepen: jest.fn().mockResolvedValue("Deepened"),
  gitUnshallow: jest.fn().mockResolvedValue("Unshallowed"),
  gitGetRepoStats: jest.fn().mockResolvedValue({
    sizeOnDisk: '4.50 MiB', objectCount: 1234, packCount: 2, looseObjects: 10, commitCount: 500, isShallow: false,
  }),
  gitFsck: jest.fn().mockResolvedValue([]),
  gitDescribe: jest.fn().mockResolvedValue('v1.0.0-5-gabc1234'),
  gitIsSparseCheckout: jest.fn().mockResolvedValue(false),
  gitSparseCheckoutInit: jest.fn().mockResolvedValue("Initialized"),
  gitSparseCheckoutSet: jest.fn().mockResolvedValue("Patterns set"),
  gitSparseCheckoutAdd: jest.fn().mockResolvedValue("Pattern added"),
  gitSparseCheckoutList: jest.fn().mockResolvedValue(['src/', 'docs/']),
  gitSparseCheckoutDisable: jest.fn().mockResolvedValue("Disabled"),
  gitArchive: jest.fn().mockResolvedValue("Archive created"),
  gitFormatPatch: jest.fn().mockResolvedValue(["0001-First.patch", "0002-Second.patch"]),
  gitApplyPatch: jest.fn().mockResolvedValue("Patch applied"),
  gitApplyMailbox: jest.fn().mockResolvedValue("Mailbox applied"),
  gitRemotePrune: jest.fn().mockResolvedValue("Pruned"),
  gitStashBranch: jest.fn().mockResolvedValue("Branch created from stash"),
  gitVerifyCommit: jest.fn().mockResolvedValue("Good signature"),
  gitVerifyTag: jest.fn().mockResolvedValue("Good signature"),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tauri = require('@/lib/tauri');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useGitAdvanced', () => {
  // --- Submodules ---
  describe('submodules', () => {
    it('refreshSubmodules fetches submodules', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.refreshSubmodules(); });
      expect(tauri.gitListSubmodules).toHaveBeenCalledWith('/repo');
      expect(result.current.submodules).toHaveLength(1);
      expect(result.current.submodules[0].path).toBe('lib/vendor');
    });

    it('addSubmodule calls tauri and refreshes', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => {
        await result.current.addSubmodule('https://github.com/lib/x.git', 'lib/x');
      });
      expect(tauri.gitAddSubmodule).toHaveBeenCalledWith('/repo', 'https://github.com/lib/x.git', 'lib/x');
      expect(tauri.gitListSubmodules).toHaveBeenCalled();
    });

    it('removeSubmodule calls tauri and refreshes', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.removeSubmodule('lib/vendor'); });
      expect(tauri.gitRemoveSubmodule).toHaveBeenCalledWith('/repo', 'lib/vendor');
    });

    it('syncSubmodules calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.syncSubmodules(); });
      expect(tauri.gitSyncSubmodules).toHaveBeenCalledWith('/repo');
    });
  });

  // --- Worktrees ---
  describe('worktrees', () => {
    it('refreshWorktrees fetches worktrees', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.refreshWorktrees(); });
      expect(tauri.gitListWorktrees).toHaveBeenCalledWith('/repo');
      expect(result.current.worktrees).toHaveLength(1);
    });

    it('addWorktree calls tauri and refreshes', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.addWorktree('/repo-feature', 'main'); });
      expect(tauri.gitAddWorktree).toHaveBeenCalledWith('/repo', '/repo-feature', 'main', undefined);
    });

    it('pruneWorktrees calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.pruneWorktrees(); });
      expect(tauri.gitPruneWorktrees).toHaveBeenCalledWith('/repo');
    });
  });

  // --- .gitignore ---
  describe('gitignore', () => {
    it('getGitignore returns content', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      let content = '';
      await act(async () => { content = await result.current.getGitignore(); });
      expect(content).toBe("node_modules/\n.env\n");
    });

    it('setGitignore calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.setGitignore("*.log\n"); });
      expect(tauri.gitSetGitignore).toHaveBeenCalledWith('/repo', "*.log\n");
    });

    it('checkIgnore returns ignored files', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      let ignored: string[] = [];
      await act(async () => { ignored = await result.current.checkIgnore(["node_modules/test.js"]); });
      expect(ignored).toEqual(["node_modules/test.js"]);
    });
  });

  // --- Hooks ---
  describe('hooks', () => {
    it('refreshHooks fetches hooks', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.refreshHooks(); });
      expect(result.current.hooks).toHaveLength(1);
      expect(result.current.hooks[0].name).toBe('pre-commit');
    });

    it('toggleHook calls tauri and refreshes', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.toggleHook('pre-commit', false); });
      expect(tauri.gitToggleHook).toHaveBeenCalledWith('/repo', 'pre-commit', false);
    });
  });

  // --- Merge/Rebase state ---
  describe('conflict resolution', () => {
    it('refreshMergeRebaseState fetches state', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.refreshMergeRebaseState(); });
      expect(result.current.mergeRebaseState.state).toBe('none');
    });

    it('resolveFileOurs calls tauri and refreshes conflicts', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.resolveFileOurs('file.txt'); });
      expect(tauri.gitResolveFileOurs).toHaveBeenCalledWith('/repo', 'file.txt');
      expect(tauri.gitGetConflictedFiles).toHaveBeenCalled();
    });

    it('mergeAbort calls tauri and refreshes state', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.mergeAbort(); });
      expect(tauri.gitMergeAbort).toHaveBeenCalledWith('/repo');
      expect(tauri.gitGetMergeRebaseState).toHaveBeenCalled();
    });

    it('cherryPickAbort calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.cherryPickAbort(); });
      expect(tauri.gitCherryPickAbort).toHaveBeenCalledWith('/repo');
    });

    it('revertAbort calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.revertAbort(); });
      expect(tauri.gitRevertAbort).toHaveBeenCalledWith('/repo');
    });
  });

  // --- Rebase ---
  describe('rebase', () => {
    it('rebase calls tauri and refreshes state', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.rebase('main'); });
      expect(tauri.gitRebase).toHaveBeenCalledWith('/repo', 'main');
    });

    it('squash calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.squash(3, 'Combined commit'); });
      expect(tauri.gitSquash).toHaveBeenCalledWith('/repo', 3, 'Combined commit');
    });
  });

  // --- Interactive rebase ---
  describe('interactive rebase', () => {
    it('getRebaseTodoPreview returns items', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      let items: { action: string; hash: string; message: string }[] = [];
      await act(async () => { items = await result.current.getRebaseTodoPreview('main'); });
      expect(items).toHaveLength(2);
      expect(items[0].action).toBe('pick');
    });

    it('startInteractiveRebase calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      const todo = [
        { action: 'pick' as const, hash: 'abc1234', message: 'First' },
        { action: 'squash' as const, hash: 'def5678', message: 'Second' },
      ];
      await act(async () => { await result.current.startInteractiveRebase('main', todo); });
      expect(tauri.gitStartInteractiveRebase).toHaveBeenCalledWith('/repo', 'main', todo);
    });
  });

  // --- Bisect ---
  describe('bisect', () => {
    it('bisectStart calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.bisectStart('HEAD', 'v1.0.0'); });
      expect(tauri.gitBisectStart).toHaveBeenCalledWith('/repo', 'HEAD', 'v1.0.0');
    });

    it('bisectGood/Bad call tauri and refresh state', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.bisectGood(); });
      expect(tauri.gitBisectGood).toHaveBeenCalledWith('/repo');
      await act(async () => { await result.current.bisectBad(); });
      expect(tauri.gitBisectBad).toHaveBeenCalledWith('/repo');
    });

    it('bisectReset clears state', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.bisectReset(); });
      expect(tauri.gitBisectReset).toHaveBeenCalledWith('/repo');
      expect(result.current.bisectState.active).toBe(false);
    });
  });

  // --- Local config ---
  describe('local config', () => {
    it('refreshLocalConfig fetches config', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.refreshLocalConfig(); });
      expect(result.current.localConfig).toHaveLength(1);
      expect(result.current.localConfig[0].key).toBe('core.autocrlf');
    });

    it('setLocalConfig calls tauri and refreshes', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.setLocalConfig('user.name', 'Test'); });
      expect(tauri.gitSetLocalConfig).toHaveBeenCalledWith('/repo', 'user.name', 'Test');
    });
  });

  // --- Repo stats ---
  describe('repo stats', () => {
    it('refreshRepoStats fetches stats', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.refreshRepoStats(); });
      expect(result.current.repoStats).not.toBeNull();
      expect(result.current.repoStats?.commitCount).toBe(500);
    });

    it('describe returns tag-based description', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      let desc: string | null = null;
      await act(async () => { desc = await result.current.describe(); });
      expect(desc).toBe('v1.0.0-5-gabc1234');
    });
  });

  // --- Sparse checkout ---
  describe('sparse checkout', () => {
    it('refreshSparseCheckout checks status', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.refreshSparseCheckout(); });
      expect(result.current.isSparseCheckout).toBe(false);
    });

    it('sparseCheckoutInit calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.sparseCheckoutInit(true); });
      expect(tauri.gitSparseCheckoutInit).toHaveBeenCalledWith('/repo', true);
    });

    it('sparseCheckoutSet calls tauri and refreshes', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.sparseCheckoutSet(['src/', 'docs/']); });
      expect(tauri.gitSparseCheckoutSet).toHaveBeenCalledWith('/repo', ['src/', 'docs/']);
    });
  });

  // --- Archive & Patch ---
  describe('archive and patch', () => {
    it('archive calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.archive('zip', '/out/repo.zip', 'HEAD', 'myproject'); });
      expect(tauri.gitArchive).toHaveBeenCalledWith('/repo', 'zip', '/out/repo.zip', 'HEAD', 'myproject');
    });

    it('formatPatch returns file list', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      let files: string[] = [];
      await act(async () => { files = await result.current.formatPatch('HEAD~2..HEAD', '/patches'); });
      expect(files).toEqual(["0001-First.patch", "0002-Second.patch"]);
    });

    it('applyPatch calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.applyPatch('/patches/0001.patch', true); });
      expect(tauri.gitApplyPatch).toHaveBeenCalledWith('/repo', '/patches/0001.patch', true);
    });
  });

  // --- Stash branch ---
  describe('stash branch', () => {
    it('stashBranch calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.stashBranch('new-feature', 'stash@{0}'); });
      expect(tauri.gitStashBranch).toHaveBeenCalledWith('/repo', 'new-feature', 'stash@{0}');
    });
  });

  // --- Signature verification ---
  describe('signature verification', () => {
    it('verifyCommit calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.verifyCommit('abc1234'); });
      expect(tauri.gitVerifyCommit).toHaveBeenCalledWith('/repo', 'abc1234');
    });

    it('verifyTag calls tauri', async () => {
      const { result } = renderHook(() => useGitAdvanced('/repo'));
      await act(async () => { await result.current.verifyTag('v1.0.0'); });
      expect(tauri.gitVerifyTag).toHaveBeenCalledWith('/repo', 'v1.0.0');
    });
  });

  // --- No repo path guard ---
  describe('guards', () => {
    it('returns empty when no repo path', async () => {
      const { result } = renderHook(() => useGitAdvanced(null));
      await act(async () => { await result.current.refreshSubmodules(); });
      expect(tauri.gitListSubmodules).not.toHaveBeenCalled();
    });

    it('throws when calling write action without repo', async () => {
      const { result } = renderHook(() => useGitAdvanced(null));
      await expect(
        act(async () => { await result.current.addSubmodule('url', 'path'); })
      ).rejects.toThrow('No repo');
    });
  });
});
