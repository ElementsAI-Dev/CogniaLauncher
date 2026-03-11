import { renderHook, act } from '@testing-library/react';
import { useGit } from './use-git';

// Mock the entire tauri module
jest.mock('@/lib/tauri', () => ({
  isTauri: () => true,
  gitIsAvailable: jest.fn().mockResolvedValue(true),
  gitGetVersion: jest.fn().mockResolvedValue('2.47.1'),
  gitGetExecutablePath: jest.fn().mockResolvedValue('/usr/bin/git'),
  gitInstall: jest.fn().mockResolvedValue('Installed via brew'),
  gitUpdate: jest.fn().mockResolvedValue('Updated via brew'),
  gitGetConfig: jest.fn().mockResolvedValue([{ key: 'user.name', value: 'Test' }]),
  gitSetConfig: jest.fn().mockResolvedValue(undefined),
  gitRemoveConfig: jest.fn().mockResolvedValue(undefined),
  gitGetRepoInfo: jest.fn().mockResolvedValue({
    rootPath: '/repo',
    currentBranch: 'main',
    isDirty: false,
    fileCountStaged: 0,
    fileCountModified: 0,
    fileCountUntracked: 0,
  }),
  gitGetLog: jest.fn().mockResolvedValue([]),
  gitGetBranches: jest.fn().mockResolvedValue([]),
  gitGetRemotes: jest.fn().mockResolvedValue([]),
  gitGetTags: jest.fn().mockResolvedValue([]),
  gitGetStashes: jest.fn().mockResolvedValue([]),
  gitGetContributors: jest.fn().mockResolvedValue([]),
  gitGetFileHistory: jest.fn().mockResolvedValue([]),
  gitGetBlame: jest.fn().mockResolvedValue([]),
  gitGetCommitDetail: jest.fn().mockResolvedValue(null),
  gitGetStatus: jest.fn().mockResolvedValue([]),
  gitGetGraphLog: jest.fn().mockResolvedValue([]),
  gitGetAheadBehind: jest.fn().mockResolvedValue({ ahead: 0, behind: 0 }),
  gitCheckoutBranch: jest.fn().mockResolvedValue('Switched'),
  gitCreateBranch: jest.fn().mockResolvedValue('Created'),
  gitDeleteBranch: jest.fn().mockResolvedValue('Deleted'),
  gitStashApply: jest.fn().mockResolvedValue('Applied'),
  gitStashPop: jest.fn().mockResolvedValue('Popped'),
  gitStashDrop: jest.fn().mockResolvedValue('Dropped'),
  gitStashSave: jest.fn().mockResolvedValue('Saved'),
  gitCreateTag: jest.fn().mockResolvedValue('Tag created'),
  gitDeleteTag: jest.fn().mockResolvedValue('Tag deleted'),
  gitGetActivity: jest.fn().mockResolvedValue([]),
  gitGetFileStats: jest.fn().mockResolvedValue([]),
  gitSearchCommits: jest.fn().mockResolvedValue([]),
  // New write operations
  gitStageFiles: jest.fn().mockResolvedValue('Staged 2 file(s)'),
  gitStageAll: jest.fn().mockResolvedValue('All changes staged'),
  gitUnstageFiles: jest.fn().mockResolvedValue('Unstaged 1 file(s)'),
  gitDiscardChanges: jest.fn().mockResolvedValue('Discarded changes'),
  gitCommit: jest.fn().mockResolvedValue('[main abc1234] my commit'),
  gitPush: jest.fn().mockResolvedValue('Push completed'),
  gitPull: jest.fn().mockResolvedValue('Already up to date'),
  gitFetch: jest.fn().mockResolvedValue('Fetch completed'),
  gitClone: jest.fn().mockResolvedValue('Repository cloned'),
  gitCancelClone: jest.fn().mockResolvedValue(undefined),
  gitInit: jest.fn().mockResolvedValue('Initialized empty Git repository'),
  gitGetDiff: jest.fn().mockResolvedValue('diff --git a/f b/f'),
  gitGetDiffBetween: jest.fn().mockResolvedValue('diff between'),
  gitMerge: jest.fn().mockResolvedValue('Merge made'),
  gitRevert: jest.fn().mockResolvedValue('Reverted'),
  gitCherryPick: jest.fn().mockResolvedValue('Cherry-picked'),
  gitReset: jest.fn().mockResolvedValue('Reset completed'),
  // Remote & branch management
  gitRemoteAdd: jest.fn().mockResolvedValue("Remote 'upstream' added"),
  gitRemoteRemove: jest.fn().mockResolvedValue("Remote 'upstream' removed"),
  gitRemoteRename: jest.fn().mockResolvedValue("Remote 'old' renamed to 'new'"),
  gitRemoteSetUrl: jest.fn().mockResolvedValue("Remote 'origin' URL updated"),
  gitBranchRename: jest.fn().mockResolvedValue("Branch renamed"),
  gitBranchSetUpstream: jest.fn().mockResolvedValue("Upstream set"),
  gitPushTags: jest.fn().mockResolvedValue('Tags pushed'),
  gitDeleteRemoteBranch: jest.fn().mockResolvedValue('Remote branch deleted'),
  gitStashShow: jest.fn().mockResolvedValue('stash diff content'),
  gitGetReflog: jest.fn().mockResolvedValue([
    { hash: 'abc1234', selector: 'HEAD@{0}', action: 'commit', message: 'commit: msg', date: '2025-01-15' },
  ]),
  gitClean: jest.fn().mockResolvedValue('Removing untracked.txt'),
  // New config management commands
  gitGetConfigValue: jest.fn().mockResolvedValue('John Doe'),
  gitGetConfigFilePath: jest.fn().mockResolvedValue('/home/user/.gitconfig'),
  gitListAliases: jest.fn().mockResolvedValue([{ key: 'co', value: 'checkout' }]),
  gitSetConfigIfUnset: jest.fn().mockResolvedValue(true),
  gitProbeEditorCapability: jest.fn().mockResolvedValue({
    available: true,
    reason: 'ok',
    preferredEditor: 'code',
    configPath: '/home/user/.gitconfig',
    fallbackAvailable: true,
  }),
  gitOpenConfigInEditor: jest.fn().mockResolvedValue({
    success: true,
    kind: 'opened_editor',
    reason: 'ok',
    message: 'Opened in code',
    openedWith: 'code',
    fallbackUsed: false,
    fallbackPath: '/home/user/.gitconfig',
  }),
}));

// Get mocked tauri for assertions
const tauri = jest.requireMock('@/lib/tauri');

describe('useGit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tauri.gitGetConfig.mockResolvedValue([{ key: 'user.name', value: 'Test' }]);
    tauri.gitGetConfigValue.mockResolvedValue('John Doe');
    tauri.gitGetConfigFilePath.mockResolvedValue('/home/user/.gitconfig');
    tauri.gitListAliases.mockResolvedValue([{ key: 'co', value: 'checkout' }]);
    tauri.gitSetConfigIfUnset.mockResolvedValue(true);
  });

  // ===== State initialization =====
  it('initializes with null/empty state', () => {
    const { result } = renderHook(() => useGit());
    expect(result.current.available).toBeNull();
    expect(result.current.version).toBeNull();
    expect(result.current.repoPath).toBeNull();
    expect(result.current.commits).toEqual([]);
    expect(result.current.branches).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ===== Availability check =====
  it('checkAvailability sets available to true', async () => {
    const { result } = renderHook(() => useGit());
    let available: boolean;
    await act(async () => {
      available = await result.current.checkAvailability();
    });
    expect(result.current.available).toBe(true);
    expect(available!).toBe(true);
  });

  // ===== Version refresh =====
  it('refreshVersion sets version and path', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => {
      await result.current.refreshVersion();
    });
    expect(result.current.version).toBe('2.47.1');
    expect(result.current.executablePath).toBe('/usr/bin/git');
  });

  // ===== Install =====
  it('installGit calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    let msg: string;
    await act(async () => {
      msg = await result.current.installGit();
    });
    expect(msg!).toBe('Installed via brew');
    expect(tauri.gitInstall).toHaveBeenCalledTimes(1);
  });

  // ===== Config management =====
  it('refreshConfig populates config', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => {
      await result.current.refreshConfig();
    });
    expect(result.current.config).toEqual([{ key: 'user.name', value: 'Test' }]);
  });

  it('getConfigSnapshot uses gitGetConfig map as snapshot-first source', async () => {
    const { result } = renderHook(() => useGit());
    let snapshot: Awaited<ReturnType<typeof result.current.getConfigSnapshot>> | undefined;
    await act(async () => {
      snapshot = await result.current.getConfigSnapshot();
    });
    expect(tauri.gitGetConfig).toHaveBeenCalledTimes(1);
    expect(snapshot!.values['user.name']).toBe('Test');
    expect(snapshot!.failures).toEqual([]);
  });

  it('getConfigValuesBatch reads requested keys and returns value map', async () => {
    tauri.gitGetConfigValue.mockImplementation((key: string) => {
      if (key === 'user.name') return Promise.resolve('John Doe');
      if (key === 'core.autocrlf') return Promise.resolve('true');
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => useGit());
    let batch: Awaited<ReturnType<typeof result.current.getConfigValuesBatch>> | undefined;
    await act(async () => {
      batch = await result.current.getConfigValuesBatch(
        ['user.name', 'core.autocrlf'],
        { concurrency: 1 },
      );
    });
    expect(tauri.gitGetConfigValue).toHaveBeenCalledWith('user.name');
    expect(tauri.gitGetConfigValue).toHaveBeenCalledWith('core.autocrlf');
    expect(batch!.values['user.name']).toBe('John Doe');
    expect(batch!.values['core.autocrlf']).toBe('true');
    expect(batch!.failures).toEqual([]);
  });

  it('getConfigValuesBatch normalizes timeout errors', async () => {
    tauri.gitGetConfigValue.mockImplementation((key: string) => {
      if (key === 'user.name') return Promise.reject('[git:timeout] git config read timed out');
      return Promise.resolve('true');
    });
    const { result } = renderHook(() => useGit());
    let batch: Awaited<ReturnType<typeof result.current.getConfigValuesBatch>> | undefined;
    await act(async () => {
      batch = await result.current.getConfigValuesBatch(
        ['user.name', 'core.autocrlf'],
        { concurrency: 1 },
      );
    });
    expect(batch!.failures).toHaveLength(1);
    expect(batch!.failures[0]).toMatchObject({
      key: 'user.name',
      category: 'timeout',
      recoverable: true,
    });
  });

  it('getConfigValuesBatch normalizes parse errors', async () => {
    tauri.gitGetConfigValue.mockRejectedValueOnce('Provider error: invalid git config parse error');
    const { result } = renderHook(() => useGit());
    let batch: Awaited<ReturnType<typeof result.current.getConfigValuesBatch>> | undefined;
    await act(async () => {
      batch = await result.current.getConfigValuesBatch(['core.editor'], { concurrency: 1 });
    });
    expect(batch!.failures).toHaveLength(1);
    expect(batch!.failures[0]).toMatchObject({
      key: 'core.editor',
      category: 'parse_failed',
      recoverable: true,
    });
  });

  it('setConfigValue calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => {
      await result.current.setConfigValue('user.email', 'test@test.com');
    });
    expect(tauri.gitSetConfig).toHaveBeenCalledWith('user.email', 'test@test.com');
    expect(tauri.gitGetConfig).toHaveBeenCalled();
  });

  it('removeConfigKey calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => {
      await result.current.removeConfigKey('user.email');
    });
    expect(tauri.gitRemoveConfig).toHaveBeenCalledWith('user.email');
  });

  // ===== Repo path =====
  it('setRepoPath sets repo path and loads repo data', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => {
      await result.current.setRepoPath('/my/repo');
    });
    expect(result.current.repoPath).toBe('/my/repo');
    expect(tauri.gitGetRepoInfo).toHaveBeenCalledWith('/my/repo');
    expect(tauri.gitGetStatus).toHaveBeenCalledWith('/my/repo');
  });

  // ===== refreshAll =====
  it('refreshAll calls availability, version, config', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => {
      await result.current.refreshAll();
    });
    expect(tauri.gitIsAvailable).toHaveBeenCalled();
    expect(tauri.gitGetVersion).toHaveBeenCalled();
    expect(tauri.gitGetConfig).toHaveBeenCalled();
  });

  // ===== Branch operations =====
  it('checkoutBranch calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    let msg: string;
    await act(async () => {
      msg = await result.current.checkoutBranch('feature');
    });
    expect(tauri.gitCheckoutBranch).toHaveBeenCalledWith('/repo', 'feature');
    expect(tauri.gitGetStatus).toHaveBeenCalled();
    expect(msg!).toBe('Switched');
  });

  it('createBranch calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.createBranch('new-branch', 'main');
    });
    expect(tauri.gitCreateBranch).toHaveBeenCalledWith('/repo', 'new-branch', 'main');
  });

  it('deleteBranch calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.deleteBranch('old-branch', true);
    });
    expect(tauri.gitDeleteBranch).toHaveBeenCalledWith('/repo', 'old-branch', true);
  });

  // ===== Stash operations =====
  it('stashSave calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.stashSave('WIP', true);
    });
    expect(tauri.gitStashSave).toHaveBeenCalledWith('/repo', 'WIP', true);
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  it('stashApply calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.stashApply('stash@{0}');
    });
    expect(tauri.gitStashApply).toHaveBeenCalledWith('/repo', 'stash@{0}');
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  it('stashPop calls tauri and refreshes status', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.stashPop('stash@{0}');
    });
    expect(tauri.gitStashPop).toHaveBeenCalledWith('/repo', 'stash@{0}');
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  // ===== Tag operations =====
  it('createTag calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.createTag('v1.0', undefined, 'Release 1.0');
    });
    expect(tauri.gitCreateTag).toHaveBeenCalledWith('/repo', 'v1.0', undefined, 'Release 1.0');
  });

  it('deleteTag calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.deleteTag('v0.1');
    });
    expect(tauri.gitDeleteTag).toHaveBeenCalledWith('/repo', 'v0.1');
  });

  // ===== NEW: Write operations =====

  it('stageFiles calls tauri and refreshes status', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    let msg: string;
    await act(async () => {
      msg = await result.current.stageFiles(['file1.ts', 'file2.ts']);
    });
    expect(tauri.gitStageFiles).toHaveBeenCalledWith('/repo', ['file1.ts', 'file2.ts']);
    expect(msg!).toBe('Staged 2 file(s)');
    expect(tauri.gitGetStatus).toHaveBeenCalled();
    expect(tauri.gitGetRepoInfo).toHaveBeenCalled();
  });

  it('stageAll calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.stageAll();
    });
    expect(tauri.gitStageAll).toHaveBeenCalledWith('/repo');
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  it('unstageFiles calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.unstageFiles(['file1.ts']);
    });
    expect(tauri.gitUnstageFiles).toHaveBeenCalledWith('/repo', ['file1.ts']);
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  it('discardChanges calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.discardChanges(['file1.ts']);
    });
    expect(tauri.gitDiscardChanges).toHaveBeenCalledWith('/repo', ['file1.ts']);
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  it('commit calls tauri with message and amend flag', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    let msg: string;
    await act(async () => {
      msg = await result.current.commit('feat: add feature', true);
    });
    expect(tauri.gitCommit).toHaveBeenCalledWith('/repo', 'feat: add feature', true, undefined, undefined, undefined);
    expect(msg!).toBe('[main abc1234] my commit');
  });

  it('push calls tauri with remote/branch/force', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.push('origin', 'main', undefined, true, undefined, true);
    });
    expect(tauri.gitPush).toHaveBeenCalledWith('/repo', 'origin', 'main', undefined, true, undefined);
  });

  it('pull calls tauri and refreshes branch/status', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.pull('origin', 'main', true);
    });
    expect(tauri.gitPull).toHaveBeenCalledWith('/repo', 'origin', 'main', true, undefined);
    expect(tauri.gitGetBranches).toHaveBeenCalled();
  });

  it('fetch calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.fetch('origin');
    });
    expect(tauri.gitFetch).toHaveBeenCalledWith('/repo', 'origin', undefined, undefined);
  });

  it('cloneRepo calls tauri with url and path', async () => {
    const { result } = renderHook(() => useGit());
    let msg: string;
    await act(async () => {
      msg = await result.current.cloneRepo('https://github.com/user/repo', '/dest');
    });
    expect(tauri.gitClone).toHaveBeenCalledWith('https://github.com/user/repo', '/dest', undefined);
    expect(msg!).toBe('Repository cloned');
  });

  it('cancelClone calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => {
      await result.current.cancelClone();
    });
    expect(tauri.gitCancelClone).toHaveBeenCalled();
  });

  it('initRepo calls tauri with path', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => {
      await result.current.initRepo('/new/repo');
    });
    expect(tauri.gitInit).toHaveBeenCalledWith('/new/repo');
  });

  it('getDiff calls tauri with staged flag', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    let diff: string;
    await act(async () => {
      diff = await result.current.getDiff(true, 'file.ts');
    });
    expect(tauri.gitGetDiff).toHaveBeenCalledWith('/repo', true, 'file.ts', undefined);
    expect(diff!).toBe('diff --git a/f b/f');
  });

  it('getDiffBetween calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.getDiffBetween('abc', 'def', 'file.ts');
    });
    expect(tauri.gitGetDiffBetween).toHaveBeenCalledWith('/repo', 'abc', 'def', 'file.ts', undefined);
  });

  it('merge calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.merge('feature', true);
    });
    expect(tauri.gitMerge).toHaveBeenCalledWith('/repo', 'feature', true);
    expect(tauri.gitGetBranches).toHaveBeenCalled();
  });

  it('revertCommit calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.revertCommit('abc1234', false);
    });
    expect(tauri.gitRevert).toHaveBeenCalledWith('/repo', 'abc1234', false);
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  it('cherryPick calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.cherryPick('abc1234');
    });
    expect(tauri.gitCherryPick).toHaveBeenCalledWith('/repo', 'abc1234');
  });

  it('resetHead calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.resetHead('hard', 'HEAD~1', true);
    });
    expect(tauri.gitReset).toHaveBeenCalledWith('/repo', 'hard', 'HEAD~1');
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  // ===== NEW: Remote & branch management =====

  it('remoteAdd calls tauri and refreshes remotes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.remoteAdd('upstream', 'https://github.com/upstream/repo');
    });
    expect(tauri.gitRemoteAdd).toHaveBeenCalledWith('/repo', 'upstream', 'https://github.com/upstream/repo');
    expect(tauri.gitGetRemotes).toHaveBeenCalled();
  });

  it('remoteRemove calls tauri and refreshes remotes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.remoteRemove('upstream');
    });
    expect(tauri.gitRemoteRemove).toHaveBeenCalledWith('/repo', 'upstream');
    expect(tauri.gitGetRemotes).toHaveBeenCalled();
  });

  it('remoteRename calls tauri and refreshes remotes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.remoteRename('old', 'new');
    });
    expect(tauri.gitRemoteRename).toHaveBeenCalledWith('/repo', 'old', 'new');
    expect(tauri.gitGetRemotes).toHaveBeenCalled();
  });

  it('remoteSetUrl calls tauri and refreshes remotes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.remoteSetUrl('origin', 'https://new-url');
    });
    expect(tauri.gitRemoteSetUrl).toHaveBeenCalledWith('/repo', 'origin', 'https://new-url');
    expect(tauri.gitGetRemotes).toHaveBeenCalled();
  });

  it('branchRename calls tauri and refreshes branches', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.branchRename('old-name', 'new-name');
    });
    expect(tauri.gitBranchRename).toHaveBeenCalledWith('/repo', 'old-name', 'new-name');
    expect(tauri.gitGetBranches).toHaveBeenCalled();
  });

  it('branchSetUpstream calls tauri and refreshes branches', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.branchSetUpstream('main', 'origin/main');
    });
    expect(tauri.gitBranchSetUpstream).toHaveBeenCalledWith('/repo', 'main', 'origin/main');
    expect(tauri.gitGetBranches).toHaveBeenCalled();
  });

  it('pushTags calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.pushTags('origin');
    });
    expect(tauri.gitPushTags).toHaveBeenCalledWith('/repo', 'origin');
  });

  it('deleteRemoteBranch calls tauri and refreshes branches', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.deleteRemoteBranch('origin', 'feature');
    });
    expect(tauri.gitDeleteRemoteBranch).toHaveBeenCalledWith('/repo', 'origin', 'feature');
    expect(tauri.gitGetBranches).toHaveBeenCalled();
  });

  it('stashShowDiff calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    let diff: string;
    await act(async () => {
      diff = await result.current.stashShowDiff('stash@{0}');
    });
    expect(tauri.gitStashShow).toHaveBeenCalledWith('/repo', 'stash@{0}');
    expect(diff!).toBe('stash diff content');
  });

  it('getReflog calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    let entries: unknown[];
    await act(async () => {
      entries = await result.current.getReflog(20);
    });
    expect(tauri.gitGetReflog).toHaveBeenCalledWith('/repo', 20);
    expect(entries!).toHaveLength(1);
    expect((entries![0] as { hash: string }).hash).toBe('abc1234');
  });

  it('cleanUntracked calls tauri and refreshes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    await act(async () => {
      await result.current.cleanUntracked(true, true);
    });
    expect(tauri.gitClean).toHaveBeenCalledWith('/repo', true);
    expect(tauri.gitGetStatus).toHaveBeenCalled();
  });

  it('blocks force push without explicit confirmation', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    let error: unknown;
    await act(async () => {
      try {
        await result.current.push('origin', 'main', true, undefined, undefined);
      } catch (e) {
        error = e;
      }
    });
    expect(String(error)).toContain('Force push rewrites remote history');
    expect(tauri.gitPush).not.toHaveBeenCalled();
    expect(result.current.lastActionResult).toMatchObject({
      operation: 'push',
      status: 'blocked',
      guardrail: { level: 'warn' },
      error: { category: 'precondition', recoverable: true },
    });
  });

  it('stores cancelled result when clone is cancelled', async () => {
    tauri.gitClone.mockRejectedValueOnce('[git:cancelled] git clone cancelled by user');
    const { result } = renderHook(() => useGit());
    let error: unknown;
    await act(async () => {
      try {
        await result.current.cloneRepo('https://example.com/repo.git', '/dest');
      } catch (e) {
        error = e;
      }
    });
    expect(String(error)).toContain('git clone cancelled by user');
    expect(result.current.lastActionResult).toMatchObject({
      operation: 'clone',
      status: 'cancelled',
      error: { category: 'cancelled', recoverable: true },
    });
  });

  it('refreshByScopes deduplicates repeated refresh scopes', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    tauri.gitGetStatus.mockClear();
    tauri.gitGetLog.mockClear();

    await act(async () => {
      await result.current.refreshByScopes(['status', 'status', 'log']);
    });

    expect(tauri.gitGetStatus).toHaveBeenCalledTimes(1);
    expect(tauri.gitGetLog).toHaveBeenCalledTimes(1);
  });

  it('refreshByScopes graph triggers graph reload signal without reloading log', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    tauri.gitGetLog.mockClear();

    expect(result.current.graphReloadKey).toBe(0);
    await act(async () => {
      await result.current.refreshByScopes(['graph', 'graph']);
    });

    expect(result.current.graphReloadKey).toBe(1);
    expect(tauri.gitGetLog).not.toHaveBeenCalled();
  });

  it('tracks unified log query state and append pagination', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    tauri.gitGetLog.mockReset();
    tauri.gitGetLog
      .mockResolvedValueOnce([
        { hash: 'a1', parents: [], authorName: 'Dev', authorEmail: 'd@e.com', date: '2025-01-01', message: 'a1' },
      ])
      .mockResolvedValueOnce([
        { hash: 'a2', parents: [], authorName: 'Dev', authorEmail: 'd@e.com', date: '2025-01-02', message: 'a2' },
      ]);

    await act(async () => {
      await result.current.getLog({ limit: 1 });
    });
    expect(tauri.gitGetLog).toHaveBeenNthCalledWith(
      1,
      '/repo',
      expect.objectContaining({ limit: 1, skip: 0, append: false }),
    );
    expect(result.current.historyState.log.query).toEqual(
      expect.objectContaining({ limit: 1, skip: 0, append: false }),
    );
    expect(result.current.historyState.log.resultCount).toBe(1);

    await act(async () => {
      await result.current.getLog({ limit: 1, append: true });
    });
    expect(tauri.gitGetLog).toHaveBeenNthCalledWith(
      2,
      '/repo',
      expect.objectContaining({ limit: 1, skip: 1, append: true }),
    );
    expect(result.current.commits).toHaveLength(2);
    expect(result.current.historyState.log.resultCount).toBe(2);
  });

  it('marks log query failures as errors (not empty) and preserves query for retry', async () => {
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });
    tauri.gitGetLog.mockReset();
    tauri.gitGetLog.mockRejectedValueOnce('[git:timeout] git log timed out');
    tauri.gitGetLog.mockResolvedValueOnce([
      { hash: 'r1', parents: [], authorName: 'Dev', authorEmail: 'd@e.com', date: '2025-01-03', message: 'retry ok' },
    ]);

    await act(async () => {
      await result.current.getLog({ limit: 3, branch: 'main' });
    });

    expect(result.current.historyState.log.error).toMatchObject({
      category: 'command_failed',
      recoverable: true,
    });
    expect(result.current.historyState.log.empty).toBe(false);
    expect(result.current.historyState.log.query).toEqual(
      expect.objectContaining({ limit: 3, branch: 'main', skip: 0, append: false }),
    );

    await act(async () => {
      await result.current.getLog(result.current.historyState.log.query ?? undefined);
    });
    expect(tauri.gitGetLog).toHaveBeenLastCalledWith(
      '/repo',
      expect.objectContaining({ limit: 3, branch: 'main', skip: 0, append: false }),
    );
    expect(result.current.historyState.log.error).toBeNull();
    expect(result.current.historyState.log.empty).toBe(false);
  });

  it('classifies invalid path error for file history queries', async () => {
    tauri.gitGetFileHistory.mockRejectedValueOnce('[git:precondition] git: invalid path: file is outside repository');
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });

    let entries: unknown[] = [];
    await act(async () => {
      entries = await result.current.getFileHistory({ file: '/other/path/file.ts', limit: 10 });
    });

    expect(entries).toEqual([]);
    expect(result.current.historyState.fileHistory.error).toMatchObject({
      category: 'invalid_path',
      recoverable: true,
    });
  });

  it('tracks search query pagination state with unified contract', async () => {
    tauri.gitSearchCommits.mockResolvedValueOnce([
      { hash: 's1', parents: [], authorName: 'Dev', authorEmail: 'd@e.com', date: '2025-01-03', message: 'search one' },
    ]);
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });

    await act(async () => {
      await result.current.searchCommits({
        query: 'search',
        searchType: 'message',
        limit: 1,
        skip: 0,
      });
    });

    expect(tauri.gitSearchCommits).toHaveBeenCalledWith(
      '/repo',
      expect.objectContaining({
        query: 'search',
        searchType: 'message',
        limit: 1,
        skip: 0,
      }),
    );
    expect(result.current.historyState.search.query).toEqual(
      expect.objectContaining({ query: 'search', limit: 1, skip: 0 }),
    );
  });

  it('renders explicit empty-state semantics for successful zero-result history query', async () => {
    tauri.gitSearchCommits.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useGit());
    await act(async () => { await result.current.setRepoPath('/repo'); });

    await act(async () => {
      await result.current.searchCommits({ query: 'none', limit: 10 });
    });

    expect(result.current.historyState.search.error).toBeNull();
    expect(result.current.historyState.search.empty).toBe(true);
    expect(result.current.historyState.search.resultCount).toBe(0);
  });

  it('stores cancelled result for cancelClone and remains able to clone afterwards', async () => {
    tauri.gitCancelClone.mockRejectedValueOnce('[git:cancelled] clone cancellation requested');
    tauri.gitClone.mockResolvedValueOnce('Repository cloned');
    const { result } = renderHook(() => useGit());

    let cancelErr: unknown;
    await act(async () => {
      try {
        await result.current.cancelClone();
      } catch (e) {
        cancelErr = e;
      }
    });
    expect(String(cancelErr)).toContain('clone cancellation requested');
    expect(result.current.lastActionResult).toMatchObject({
      operation: 'cancelClone',
      status: 'cancelled',
      error: { category: 'cancelled', recoverable: true },
    });

    let cloneMsg = '';
    await act(async () => {
      cloneMsg = await result.current.cloneRepo('https://github.com/user/repo.git', '/dest');
    });
    expect(cloneMsg).toBe('Repository cloned');
  });

  // ===== NEW: Config value operations =====

  it('getConfigValue calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    let val: string | null;
    await act(async () => {
      val = await result.current.getConfigValue('user.name');
    });
    expect(tauri.gitGetConfigValue).toHaveBeenCalledWith('user.name');
    expect(val!).toBe('John Doe');
  });

  it('getConfigFilePath calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    let path: string | null;
    await act(async () => {
      path = await result.current.getConfigFilePath();
    });
    expect(tauri.gitGetConfigFilePath).toHaveBeenCalled();
    expect(path!).toBe('/home/user/.gitconfig');
  });

  it('listAliases calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    let aliases: { key: string; value: string }[];
    await act(async () => {
      aliases = await result.current.listAliases();
    });
    expect(tauri.gitListAliases).toHaveBeenCalled();
    expect(aliases!).toEqual([{ key: 'co', value: 'checkout' }]);
  });

  it('setConfigIfUnset calls tauri and refreshes on new set', async () => {
    const { result } = renderHook(() => useGit());
    let wasSet: boolean;
    await act(async () => {
      wasSet = await result.current.setConfigIfUnset('init.defaultBranch', 'main');
    });
    expect(tauri.gitSetConfigIfUnset).toHaveBeenCalledWith('init.defaultBranch', 'main');
    expect(wasSet!).toBe(true);
    expect(tauri.gitGetConfig).toHaveBeenCalled();
  });

  it('openConfigInEditor calls tauri', async () => {
    const { result } = renderHook(() => useGit());
    let openResult: Awaited<ReturnType<typeof result.current.openConfigInEditor>> | undefined;
    await act(async () => {
      openResult = await result.current.openConfigInEditor();
    });
    expect(tauri.gitOpenConfigInEditor).toHaveBeenCalled();
    expect(openResult!.kind).toBe('opened_editor');
  });

  it('probeConfigEditor calls tauri capability probe', async () => {
    const { result } = renderHook(() => useGit());
    let probe: Awaited<ReturnType<typeof result.current.probeConfigEditor>> | undefined;
    await act(async () => {
      probe = await result.current.probeConfigEditor();
    });
    expect(tauri.gitProbeEditorCapability).toHaveBeenCalled();
    expect(probe!.available).toBe(true);
  });

  it('applyConfigPlan maps set/remove/set_if_unset operations and summarizes results', async () => {
    const { result } = renderHook(() => useGit());
    tauri.gitSetConfigIfUnset.mockResolvedValueOnce(false);

    let summary: Awaited<ReturnType<typeof result.current.applyConfigPlan>> | undefined;
    await act(async () => {
      summary = await result.current.applyConfigPlan([
        { key: 'pull.rebase', mode: 'set', value: 'true', selected: true },
        { key: 'core.safecrlf', mode: 'set_if_unset', value: 'warn', selected: true },
        { key: 'user.signingkey', mode: 'unset', value: null, selected: true },
        { key: 'color.ui', mode: 'set', value: 'auto', selected: false },
      ]);
    });

    expect(tauri.gitSetConfig).toHaveBeenCalledWith('pull.rebase', 'true');
    expect(tauri.gitSetConfigIfUnset).toHaveBeenCalledWith('core.safecrlf', 'warn');
    expect(tauri.gitRemoveConfig).toHaveBeenCalledWith('user.signingkey');
    expect(summary!.total).toBe(3);
    expect(summary!.succeeded).toBe(3);
    expect(summary!.failed).toBe(0);
    expect(summary!.skipped).toBe(1);
  });

  // ===== Error handling =====

  it('stageFiles throws when no repo path', async () => {
    const { result } = renderHook(() => useGit());
    await expect(act(async () => {
      await result.current.stageFiles(['file.ts']);
    })).rejects.toThrow('No repo');
  });

  it('commit throws when no repo path', async () => {
    const { result } = renderHook(() => useGit());
    await expect(act(async () => {
      await result.current.commit('msg');
    })).rejects.toThrow('No repo');
  });

  it('push throws when no repo path', async () => {
    const { result } = renderHook(() => useGit());
    await expect(act(async () => {
      await result.current.push();
    })).rejects.toThrow('No repo');
  });

  it('getDiff returns empty string when no repo path', async () => {
    const { result } = renderHook(() => useGit());
    let diff: string;
    await act(async () => {
      diff = await result.current.getDiff();
    });
    expect(diff!).toBe('');
  });

  it('getReflog returns empty array when no repo path', async () => {
    const { result } = renderHook(() => useGit());
    let entries: unknown[];
    await act(async () => {
      entries = await result.current.getReflog();
    });
    expect(entries!).toEqual([]);
  });
});
