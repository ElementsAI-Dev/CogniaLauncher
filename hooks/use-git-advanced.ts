import { useState, useCallback, useEffect } from 'react';
import * as tauri from '@/lib/tauri';
import type {
  GitSubmoduleInfo,
  GitWorktreeInfo,
  GitHookInfo,
  GitMergeRebaseState,
  GitConfigEntry,
  GitRepoStats,
  GitBisectState,
  GitRebaseTodoItem,
} from '@/types/tauri';
import type { GitActionResult, GitRefreshScope } from '@/types/git';
import {
  evaluateGitGuardrail,
  executeGitOperation,
} from '@/lib/git/operation-orchestrator';

export interface UseGitAdvancedReturn {
  // State
  submodules: GitSubmoduleInfo[];
  worktrees: GitWorktreeInfo[];
  hooks: GitHookInfo[];
  mergeRebaseState: GitMergeRebaseState;
  conflictedFiles: string[];
  localConfig: GitConfigEntry[];
  repoStats: GitRepoStats | null;
  bisectState: GitBisectState;
  sparsePatterns: string[];
  isSparseCheckout: boolean;
  lastActionResult: GitActionResult | null;

  // Submodule actions
  refreshSubmodules: () => Promise<void>;
  addSubmodule: (url: string, subpath: string) => Promise<string>;
  updateSubmodules: (init?: boolean, recursive?: boolean) => Promise<string>;
  removeSubmodule: (subpath: string) => Promise<string>;
  syncSubmodules: () => Promise<string>;

  // Worktree actions
  refreshWorktrees: () => Promise<void>;
  addWorktree: (dest: string, branch?: string, newBranch?: string) => Promise<string>;
  removeWorktree: (dest: string, force?: boolean) => Promise<string>;
  pruneWorktrees: () => Promise<string>;

  // .gitignore actions
  getGitignore: () => Promise<string>;
  setGitignore: (content: string) => Promise<void>;
  checkIgnore: (files: string[]) => Promise<string[]>;
  addToGitignore: (patterns: string[]) => Promise<void>;

  // Hook actions
  refreshHooks: () => Promise<void>;
  getHookContent: (name: string) => Promise<string>;
  setHookContent: (name: string, content: string) => Promise<void>;
  toggleHook: (name: string, enabled: boolean) => Promise<void>;

  // Merge/rebase state & conflict resolution
  refreshMergeRebaseState: () => Promise<void>;
  refreshConflictedFiles: () => Promise<void>;
  refreshByScopes: (scopes: GitRefreshScope[]) => Promise<void>;
  resolveFileOurs: (file: string) => Promise<string>;
  resolveFileTheirs: (file: string) => Promise<string>;
  resolveFileMark: (file: string) => Promise<string>;
  mergeAbort: () => Promise<string>;
  mergeContinue: () => Promise<string>;
  cherryPickAbort: () => Promise<string>;
  cherryPickContinue: () => Promise<string>;
  revertAbort: () => Promise<string>;

  // Rebase & squash actions
  rebase: (onto: string, confirmRisk?: boolean) => Promise<string>;
  rebaseAbort: () => Promise<string>;
  rebaseContinue: () => Promise<string>;
  rebaseSkip: () => Promise<string>;
  squash: (count: number, message: string, confirmRisk?: boolean) => Promise<string>;

  // Interactive rebase
  getRebaseTodoPreview: (base: string) => Promise<GitRebaseTodoItem[]>;
  startInteractiveRebase: (base: string, todo: GitRebaseTodoItem[]) => Promise<string>;

  // Bisect
  bisectStart: (badRef: string, goodRef: string) => Promise<string>;
  bisectGood: () => Promise<string>;
  bisectBad: () => Promise<string>;
  bisectSkip: () => Promise<string>;
  bisectReset: () => Promise<string>;
  bisectLog: () => Promise<string>;
  refreshBisectState: () => Promise<void>;

  // Local config
  refreshLocalConfig: () => Promise<void>;
  setLocalConfig: (key: string, value: string) => Promise<void>;
  removeLocalConfig: (key: string) => Promise<void>;
  getLocalConfigValue: (key: string) => Promise<string | null>;

  // Repo stats
  refreshRepoStats: () => Promise<void>;
  fsck: () => Promise<string[]>;
  describe: () => Promise<string | null>;

  // Shallow management
  isShallow: () => Promise<boolean>;
  deepen: (depth: number) => Promise<string>;
  unshallow: () => Promise<string>;

  // Sparse-checkout
  refreshSparseCheckout: () => Promise<void>;
  sparseCheckoutInit: (cone?: boolean) => Promise<string>;
  sparseCheckoutSet: (patterns: string[]) => Promise<string>;
  sparseCheckoutAdd: (patterns: string[]) => Promise<string>;
  sparseCheckoutDisable: () => Promise<string>;

  // Archive & Patch
  archive: (format: string, outputPath: string, refName: string, prefix?: string) => Promise<string>;
  formatPatch: (range: string, outputDir: string) => Promise<string[]>;
  applyPatch: (patchPath: string, checkOnly?: boolean) => Promise<string>;
  applyMailbox: (patchPath: string) => Promise<string>;

  // Remote prune
  remotePrune: (remote: string) => Promise<string>;

  // Stash branch
  stashBranch: (branchName: string, stashId?: string) => Promise<string>;

  // Signature verification
  verifyCommit: (hash: string) => Promise<string>;
  verifyTag: (tag: string) => Promise<string>;
}

export function useGitAdvanced(repoPath: string | null): UseGitAdvancedReturn {
  const [submodules, setSubmodules] = useState<GitSubmoduleInfo[]>([]);
  const [worktrees, setWorktrees] = useState<GitWorktreeInfo[]>([]);
  const [hooks, setHooks] = useState<GitHookInfo[]>([]);
  const [mergeRebaseState, setMergeRebaseState] = useState<GitMergeRebaseState>({
    state: 'none',
    onto: null,
    progress: null,
    total: null,
  });
  const [conflictedFiles, setConflictedFiles] = useState<string[]>([]);
  const [localConfig, setLocalConfig] = useState<GitConfigEntry[]>([]);
  const [repoStats, setRepoStats] = useState<GitRepoStats | null>(null);
  const [bisectState, setBisectState] = useState<GitBisectState>({
    active: false,
    currentHash: null,
    stepsTaken: 0,
    remainingEstimate: null,
  });
  const [sparsePatterns, setSparsePatterns] = useState<string[]>([]);
  const [isSparseCheckoutState, setIsSparseCheckout] = useState(false);
  const [lastActionResult, setLastActionResult] =
    useState<GitActionResult | null>(null);

  const unwrapOperationPayload = useCallback(
    <T,>(operation: { result: GitActionResult; payload?: T }): T => {
      setLastActionResult(operation.result);
      if (operation.result.status !== 'success') {
        const nextSteps = operation.result.error?.nextSteps ?? [];
        const message =
          nextSteps.length > 0
            ? `${operation.result.message} ${nextSteps.join(' ')}`
            : operation.result.message;
        throw new Error(message);
      }
      return operation.payload as T;
    },
    [],
  );

  useEffect(() => {
    if (repoPath) return;
    setSubmodules([]);
    setWorktrees([]);
    setHooks([]);
    setMergeRebaseState({
      state: 'none',
      onto: null,
      progress: null,
      total: null,
    });
    setConflictedFiles([]);
    setLocalConfig([]);
    setRepoStats(null);
    setBisectState({
      active: false,
      currentHash: null,
      stepsTaken: 0,
      remainingEstimate: null,
    });
    setSparsePatterns([]);
    setIsSparseCheckout(false);
  }, [repoPath]);

  // --- Submodule actions ---
  const refreshSubmodules = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setSubmodules(await tauri.gitListSubmodules(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const addSubmodule = useCallback(async (url: string, subpath: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitAddSubmodule(repoPath, url, subpath);
    await refreshSubmodules();
    return msg;
  }, [repoPath, refreshSubmodules]);

  const updateSubmodules = useCallback(async (init?: boolean, recursive?: boolean) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitUpdateSubmodules(repoPath, init, recursive);
    await refreshSubmodules();
    return msg;
  }, [repoPath, refreshSubmodules]);

  const removeSubmodule = useCallback(async (subpath: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitRemoveSubmodule(repoPath, subpath);
    await refreshSubmodules();
    return msg;
  }, [repoPath, refreshSubmodules]);

  const syncSubmodules = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitSyncSubmodules(repoPath);
  }, [repoPath]);

  // --- Worktree actions ---
  const refreshWorktrees = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setWorktrees(await tauri.gitListWorktrees(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const addWorktree = useCallback(async (dest: string, branch?: string, newBranch?: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitAddWorktree(repoPath, dest, branch, newBranch);
    await refreshWorktrees();
    return msg;
  }, [repoPath, refreshWorktrees]);

  const removeWorktree = useCallback(async (dest: string, force?: boolean) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitRemoveWorktree(repoPath, dest, force);
    await refreshWorktrees();
    return msg;
  }, [repoPath, refreshWorktrees]);

  const pruneWorktrees = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitPruneWorktrees(repoPath);
    await refreshWorktrees();
    return msg;
  }, [repoPath, refreshWorktrees]);

  // --- .gitignore actions ---
  const getGitignore = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return '';
    return await tauri.gitGetGitignore(repoPath);
  }, [repoPath]);

  const setGitignore = useCallback(async (content: string) => {
    if (!tauri.isTauri() || !repoPath) return;
    await tauri.gitSetGitignore(repoPath, content);
  }, [repoPath]);

  const checkIgnore = useCallback(async (files: string[]) => {
    if (!tauri.isTauri() || !repoPath) return [];
    return await tauri.gitCheckIgnore(repoPath, files);
  }, [repoPath]);

  const addToGitignore = useCallback(async (patterns: string[]) => {
    if (!tauri.isTauri() || !repoPath) return;
    await tauri.gitAddToGitignore(repoPath, patterns);
  }, [repoPath]);

  // --- Hook actions ---
  const refreshHooks = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setHooks(await tauri.gitListHooks(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const getHookContent = useCallback(async (name: string) => {
    if (!tauri.isTauri() || !repoPath) return '';
    return await tauri.gitGetHookContent(repoPath, name);
  }, [repoPath]);

  const setHookContent = useCallback(async (name: string, content: string) => {
    if (!tauri.isTauri() || !repoPath) return;
    await tauri.gitSetHookContent(repoPath, name, content);
    await refreshHooks();
  }, [repoPath, refreshHooks]);

  const toggleHook = useCallback(async (name: string, enabled: boolean) => {
    if (!tauri.isTauri() || !repoPath) return;
    await tauri.gitToggleHook(repoPath, name, enabled);
    await refreshHooks();
  }, [repoPath, refreshHooks]);

  // --- Merge/rebase state & conflict resolution ---
  const refreshMergeRebaseState = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setMergeRebaseState(await tauri.gitGetMergeRebaseState(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const refreshConflictedFiles = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setConflictedFiles(await tauri.gitGetConflictedFiles(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const refreshByScopes = useCallback(
    async (scopes: GitRefreshScope[]): Promise<void> => {
      if (!tauri.isTauri() || !repoPath) return;
      const uniqueScopes = [...new Set(scopes)];
      const actions: Array<Promise<unknown>> = [];

      for (const scope of uniqueScopes) {
        switch (scope) {
          case 'advanced':
            actions.push(refreshMergeRebaseState());
            actions.push(refreshConflictedFiles());
            break;
          case 'status':
            actions.push(refreshConflictedFiles());
            break;
          case 'repoInfo':
          case 'branches':
          case 'remotes':
          case 'tags':
          case 'stashes':
          case 'log':
          case 'graph':
          case 'aheadBehind':
            // Managed by useGit (repository-level state).
            break;
          default:
            break;
        }
      }

      await Promise.allSettled(actions);
    },
    [repoPath, refreshMergeRebaseState, refreshConflictedFiles],
  );

  const resolveFileOurs = useCallback(async (file: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitResolveFileOurs(repoPath, file);
    await refreshConflictedFiles();
    return msg;
  }, [repoPath, refreshConflictedFiles]);

  const resolveFileTheirs = useCallback(async (file: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitResolveFileTheirs(repoPath, file);
    await refreshConflictedFiles();
    return msg;
  }, [repoPath, refreshConflictedFiles]);

  const resolveFileMark = useCallback(async (file: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitResolveFileMark(repoPath, file);
    await refreshConflictedFiles();
    return msg;
  }, [repoPath, refreshConflictedFiles]);

  const mergeAbort = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'mergeAbort',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitMergeAbort(repoPath),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  const mergeContinue = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'mergeContinue',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitMergeContinue(repoPath),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  const cherryPickAbort = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'cherryPickAbort',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitCherryPickAbort(repoPath),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  const cherryPickContinue = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'cherryPickContinue',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitCherryPickContinue(repoPath),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  const revertAbort = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'revertAbort',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitRevertAbort(repoPath),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  // --- Rebase & squash ---
  const rebase = useCallback(async (onto: string, confirmRisk?: boolean) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const guardrail = evaluateGitGuardrail('rebase');
    const operation = await executeGitOperation({
      operation: 'rebase',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      precheck: () => guardrail,
      allowWarning: confirmRisk,
      execute: () => tauri.gitRebase(repoPath, onto),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  const rebaseAbort = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'rebaseAbort',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitRebaseAbort(repoPath),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  const rebaseContinue = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'rebaseContinue',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitRebaseContinue(repoPath),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  const rebaseSkip = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'rebaseSkip',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitRebaseSkip(repoPath),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  const squash = useCallback(async (count: number, message: string, confirmRisk?: boolean) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const guardrail = evaluateGitGuardrail('squash');
    const operation = await executeGitOperation({
      operation: 'squash',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      precheck: () => guardrail,
      allowWarning: confirmRisk,
      execute: () => tauri.gitSquash(repoPath, count, message),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  // --- Interactive rebase ---
  const getRebaseTodoPreview = useCallback(async (base: string) => {
    if (!tauri.isTauri() || !repoPath) return [];
    return await tauri.gitGetRebaseTodoPreview(repoPath, base);
  }, [repoPath]);

  const startInteractiveRebase = useCallback(async (base: string, todo: GitRebaseTodoItem[]) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const operation = await executeGitOperation({
      operation: 'interactiveRebase',
      refreshByScopes,
      refreshScopes: ['advanced', 'status'],
      execute: () => tauri.gitStartInteractiveRebase(repoPath, base, todo),
    });
    return unwrapOperationPayload(operation);
  }, [repoPath, refreshByScopes, unwrapOperationPayload]);

  // --- Bisect ---
  const bisectStart = useCallback(async (badRef: string, goodRef: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitBisectStart(repoPath, badRef, goodRef);
    await refreshBisectState();
    return msg;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  const bisectGood = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitBisectGood(repoPath);
    await refreshBisectState();
    return msg;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  const bisectBad = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitBisectBad(repoPath);
    await refreshBisectState();
    return msg;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  const bisectSkip = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitBisectSkip(repoPath);
    await refreshBisectState();
    return msg;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  const bisectReset = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitBisectReset(repoPath);
    setBisectState({ active: false, currentHash: null, stepsTaken: 0, remainingEstimate: null });
    return msg;
  }, [repoPath]);

  const bisectLog = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return '';
    return await tauri.gitBisectLog(repoPath);
  }, [repoPath]);

  const refreshBisectState = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setBisectState(await tauri.gitGetBisectState(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  // --- Local config ---
  const refreshLocalConfig = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setLocalConfig(await tauri.gitGetLocalConfig(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const setLocalConfigValue = useCallback(async (key: string, value: string) => {
    if (!tauri.isTauri() || !repoPath) return;
    await tauri.gitSetLocalConfig(repoPath, key, value);
    await refreshLocalConfig();
  }, [repoPath, refreshLocalConfig]);

  const removeLocalConfigKey = useCallback(async (key: string) => {
    if (!tauri.isTauri() || !repoPath) return;
    await tauri.gitRemoveLocalConfig(repoPath, key);
    await refreshLocalConfig();
  }, [repoPath, refreshLocalConfig]);

  const getLocalConfigValue = useCallback(async (key: string) => {
    if (!tauri.isTauri() || !repoPath) return null;
    return await tauri.gitGetLocalConfigValue(repoPath, key);
  }, [repoPath]);

  // --- Repo stats ---
  const refreshRepoStats = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setRepoStats(await tauri.gitGetRepoStats(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const fsck = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return [];
    return await tauri.gitFsck(repoPath);
  }, [repoPath]);

  const describeRepo = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return null;
    return await tauri.gitDescribe(repoPath);
  }, [repoPath]);

  // --- Shallow management ---
  const isShallowCheck = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return false;
    return await tauri.gitIsShallow(repoPath);
  }, [repoPath]);

  const deepen = useCallback(async (depth: number) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitDeepen(repoPath, depth);
  }, [repoPath]);

  const unshallow = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitUnshallow(repoPath);
  }, [repoPath]);

  // --- Sparse-checkout ---
  const refreshSparseCheckout = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      const isSparse = await tauri.gitIsSparseCheckout(repoPath);
      setIsSparseCheckout(isSparse);
      if (isSparse) {
        setSparsePatterns(await tauri.gitSparseCheckoutList(repoPath));
      } else {
        setSparsePatterns([]);
      }
    } catch { /* ignore */ }
  }, [repoPath]);

  const sparseCheckoutInit = useCallback(async (cone?: boolean) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitSparseCheckoutInit(repoPath, cone);
    await refreshSparseCheckout();
    return msg;
  }, [repoPath, refreshSparseCheckout]);

  const sparseCheckoutSet = useCallback(async (patterns: string[]) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitSparseCheckoutSet(repoPath, patterns);
    await refreshSparseCheckout();
    return msg;
  }, [repoPath, refreshSparseCheckout]);

  const sparseCheckoutAdd = useCallback(async (patterns: string[]) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitSparseCheckoutAdd(repoPath, patterns);
    await refreshSparseCheckout();
    return msg;
  }, [repoPath, refreshSparseCheckout]);

  const sparseCheckoutDisable = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitSparseCheckoutDisable(repoPath);
    await refreshSparseCheckout();
    return msg;
  }, [repoPath, refreshSparseCheckout]);

  // --- Archive & Patch ---
  const archive = useCallback(async (format: string, outputPath: string, refName: string, prefix?: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitArchive(repoPath, format, outputPath, refName, prefix);
  }, [repoPath]);

  const formatPatch = useCallback(async (range: string, outputDir: string) => {
    if (!tauri.isTauri() || !repoPath) return [];
    return await tauri.gitFormatPatch(repoPath, range, outputDir);
  }, [repoPath]);

  const applyPatch = useCallback(async (patchPath: string, checkOnly?: boolean) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitApplyPatch(repoPath, patchPath, checkOnly);
  }, [repoPath]);

  const applyMailbox = useCallback(async (patchPath: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitApplyMailbox(repoPath, patchPath);
  }, [repoPath]);

  // --- Remote prune ---
  const remotePrune = useCallback(async (remote: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitRemotePrune(repoPath, remote);
  }, [repoPath]);

  // --- Stash branch ---
  const stashBranch = useCallback(async (branchName: string, stashId?: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitStashBranch(repoPath, branchName, stashId);
  }, [repoPath]);

  // --- Signature verification ---
  const verifyCommit = useCallback(async (hash: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitVerifyCommit(repoPath, hash);
  }, [repoPath]);

  const verifyTag = useCallback(async (tag: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitVerifyTag(repoPath, tag);
  }, [repoPath]);

  return {
    submodules,
    worktrees,
    hooks,
    mergeRebaseState,
    conflictedFiles,
    localConfig,
    repoStats,
    bisectState,
    sparsePatterns,
    isSparseCheckout: isSparseCheckoutState,
    lastActionResult,
    refreshSubmodules,
    addSubmodule,
    updateSubmodules,
    removeSubmodule,
    syncSubmodules,
    refreshWorktrees,
    addWorktree,
    removeWorktree,
    pruneWorktrees,
    getGitignore,
    setGitignore,
    checkIgnore,
    addToGitignore,
    refreshHooks,
    getHookContent,
    setHookContent,
    toggleHook,
    refreshMergeRebaseState,
    refreshConflictedFiles,
    refreshByScopes,
    resolveFileOurs,
    resolveFileTheirs,
    resolveFileMark,
    mergeAbort,
    mergeContinue,
    cherryPickAbort,
    cherryPickContinue,
    revertAbort,
    rebase,
    rebaseAbort,
    rebaseContinue,
    rebaseSkip,
    squash,
    getRebaseTodoPreview,
    startInteractiveRebase,
    bisectStart,
    bisectGood,
    bisectBad,
    bisectSkip,
    bisectReset,
    bisectLog,
    refreshBisectState,
    refreshLocalConfig,
    setLocalConfig: setLocalConfigValue,
    removeLocalConfig: removeLocalConfigKey,
    getLocalConfigValue,
    refreshRepoStats,
    fsck,
    describe: describeRepo,
    isShallow: isShallowCheck,
    deepen,
    unshallow,
    refreshSparseCheckout,
    sparseCheckoutInit,
    sparseCheckoutSet,
    sparseCheckoutAdd,
    sparseCheckoutDisable,
    archive,
    formatPatch,
    applyPatch,
    applyMailbox,
    remotePrune,
    stashBranch,
    verifyCommit,
    verifyTag,
  };
}
