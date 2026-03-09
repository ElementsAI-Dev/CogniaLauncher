import { useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import type {
  EditorCapabilityProbeResult,
  EditorOpenActionResult,
  GitRepoInfo,
  GitCommitEntry,
  GitBranchInfo,
  GitRemoteInfo,
  GitTagInfo,
  GitStashEntry,
  GitContributor,
  GitBlameEntry,
  GitConfigEntry,
  GitStatusFile,
  GitCommitDetail,
  GitGraphEntry,
  GitAheadBehind,
  GitDayActivity,
  GitHistoryQuery,
  GitHistoryQueryError,
  GitHistoryQueryState,
  GitHistorySearchType,
  GitFileStatEntry,
  GitReflogEntry,
  GitCloneOptions,
} from '@/types/tauri';
import type {
  GitConfigApplyPlanItem,
  GitConfigApplyResultItem,
  GitConfigApplySummary,
  GitConfigBatchReadResult,
  GitConfigReadBatchOptions,
  GitConfigReadFailure,
  GitConfigSnapshotResult,
  GitActionResult,
  GitHistoryState,
  GitHistoryView,
  GitRefreshScope,
} from '@/types/git';
import {
  evaluateGitGuardrail,
  executeGitOperation,
} from '@/lib/git/operation-orchestrator';

const HISTORY_VIEWS: GitHistoryView[] = [
  'log',
  'search',
  'fileHistory',
  'fileStats',
  'blame',
  'reflog',
];

const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_CONFIG_FALLBACK_CONCURRENCY = 4;

function createHistoryViewState(): GitHistoryQueryState {
  return {
    query: null,
    loading: false,
    empty: false,
    resultCount: 0,
    hasMore: false,
    error: null,
    updatedAt: null,
  };
}

function createHistoryState(): GitHistoryState {
  return HISTORY_VIEWS.reduce((acc, view) => {
    acc[view] = createHistoryViewState();
    return acc;
  }, {} as GitHistoryState);
}

function normalizeHistoryError(error: unknown): GitHistoryQueryError {
  const message = String(error);
  const lower = message.toLowerCase();
  if (
    lower.includes('outside repository')
    || lower.includes('invalid path')
    || lower.includes('path must be inside repository')
  ) {
    return {
      category: 'invalid_path',
      message,
      recoverable: true,
      nextSteps: ['Use a file path inside the current repository.'],
    };
  }
  if (lower.includes('invalid') && lower.includes('query')) {
    return {
      category: 'invalid_query',
      message,
      recoverable: true,
      nextSteps: ['Adjust the history filters and retry.'],
    };
  }
  if (lower.includes('not in tauri environment') || lower.includes('no repo')) {
    return {
      category: 'repo_unavailable',
      message,
      recoverable: true,
      nextSteps: ['Select a repository first and retry.'],
    };
  }
  if (lower.includes('[git:')) {
    return {
      category: 'command_failed',
      message,
      recoverable: true,
      nextSteps: ['Review the Git error message and retry with narrower filters.'],
    };
  }
  return {
    category: 'unknown',
    message,
    recoverable: false,
    nextSteps: [],
  };
}

function toHistoryQuery(
  query: string | GitHistoryQuery,
  searchType?: GitHistorySearchType,
  limit?: number,
): GitHistoryQuery {
  if (typeof query === 'string') {
    return { query, searchType, limit };
  }
  return query;
}

function buildConfigValueMap(entries: GitConfigEntry[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const entry of entries) {
    map[entry.key] = entry.value;
  }
  return map;
}

function normalizeConfigReadFailure(error: unknown, key: string | null): GitConfigReadFailure {
  const message = String(error);
  const lower = message.toLowerCase();
  if (lower.includes('[git:timeout]') || lower.includes('timed out') || lower.includes('timeout')) {
    return {
      key,
      category: 'timeout',
      message,
      recoverable: true,
      nextSteps: ['Retry reading Git settings.', 'Check whether Git command execution is slow on this machine.'],
    };
  }
  if (lower.includes('parse') || lower.includes('invalid') || lower.includes('malformed')) {
    return {
      key,
      category: 'parse_failed',
      message,
      recoverable: true,
      nextSteps: ['Review global Git config syntax and fix invalid entries.'],
    };
  }
  if (lower.includes('[git:execution]') || lower.includes('[git:') || lower.includes('provider error')) {
    return {
      key,
      category: 'execution_failed',
      message,
      recoverable: true,
      nextSteps: ['Retry the operation.', 'Open global Git config and verify includes/paths.'],
    };
  }
  return {
    key,
    category: 'unknown',
    message,
    recoverable: false,
    nextSteps: ['Retry the operation and inspect logs if the issue persists.'],
  };
}

export interface UseGitReturn {
  // State
  available: boolean | null;
  version: string | null;
  executablePath: string | null;
  config: GitConfigEntry[];
  repoPath: string | null;
  repoInfo: GitRepoInfo | null;
  commits: GitCommitEntry[];
  branches: GitBranchInfo[];
  remotes: GitRemoteInfo[];
  tags: GitTagInfo[];
  stashes: GitStashEntry[];
  contributors: GitContributor[];
  statusFiles: GitStatusFile[];
  loading: boolean;
  error: string | null;
  lastActionResult: GitActionResult | null;
  historyState: GitHistoryState;

  // Actions - Git tool management
  checkAvailability: () => Promise<boolean>;
  refreshVersion: () => Promise<void>;
  installGit: () => Promise<string>;
  updateGit: () => Promise<string>;

  // Actions - Config management
  refreshConfig: () => Promise<void>;
  getConfigSnapshot: () => Promise<GitConfigSnapshotResult>;
  getConfigValuesBatch: (
    keys: string[],
    options?: GitConfigReadBatchOptions,
  ) => Promise<GitConfigBatchReadResult>;
  setConfigValue: (key: string, value: string) => Promise<void>;
  removeConfigKey: (key: string) => Promise<void>;
  getConfigValue: (key: string) => Promise<string | null>;
  getConfigFilePath: () => Promise<string | null>;
  listAliases: () => Promise<GitConfigEntry[]>;
  setConfigIfUnset: (key: string, value: string) => Promise<boolean>;
  applyConfigPlan: (items: GitConfigApplyPlanItem[]) => Promise<GitConfigApplySummary>;
  probeConfigEditor: () => Promise<EditorCapabilityProbeResult>;
  openConfigInEditor: () => Promise<EditorOpenActionResult>;

  // Actions - Repository inspection
  setRepoPath: (path: string) => Promise<void>;
  refreshRepoInfo: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshRemotes: () => Promise<void>;
  refreshTags: () => Promise<void>;
  refreshStashes: () => Promise<void>;
  refreshContributors: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshByScopes: (scopes: GitRefreshScope[]) => Promise<void>;

  // Actions - History & Blame
  getLog: (options?: GitHistoryQuery) => Promise<void>;
  getFileHistory: (file: string | GitHistoryQuery, limit?: number) => Promise<GitCommitEntry[]>;
  getBlame: (file: string | GitHistoryQuery) => Promise<GitBlameEntry[]>;

  // Actions - Commit detail & graph
  getCommitDetail: (hash: string) => Promise<GitCommitDetail | null>;
  getGraphLog: (limit?: number, allBranches?: boolean, firstParent?: boolean, branch?: string) => Promise<GitGraphEntry[]>;
  getAheadBehind: (branch: string, upstream?: string) => Promise<GitAheadBehind>;

  // Actions - Branch operations
  checkoutBranch: (name: string) => Promise<string>;
  createBranch: (name: string, startPoint?: string) => Promise<string>;
  deleteBranch: (name: string, force?: boolean) => Promise<string>;

  // Actions - Stash operations
  stashApply: (stashId?: string) => Promise<string>;
  stashPop: (stashId?: string) => Promise<string>;
  stashDrop: (stashId?: string) => Promise<string>;
  stashSave: (message?: string, includeUntracked?: boolean) => Promise<string>;

  // Actions - Tag operations
  createTag: (name: string, targetRef?: string, message?: string) => Promise<string>;
  deleteTag: (name: string) => Promise<string>;

  // Actions - Activity & Stats
  getActivity: (days?: number) => Promise<GitDayActivity[]>;
  getFileStats: (file: string | GitHistoryQuery, limit?: number) => Promise<GitFileStatEntry[]>;
  searchCommits: (
    query: string | GitHistoryQuery,
    searchType?: GitHistorySearchType,
    limit?: number,
  ) => Promise<GitCommitEntry[]>;


  // Actions - Write operations
  stageFiles: (files: string[]) => Promise<string>;
  stageAll: () => Promise<string>;
  unstageFiles: (files: string[]) => Promise<string>;
  discardChanges: (files: string[]) => Promise<string>;
  commit: (message: string, amend?: boolean, allowEmpty?: boolean, signoff?: boolean, noVerify?: boolean) => Promise<string>;
  push: (
    remote?: string,
    branch?: string,
    force?: boolean,
    forceLease?: boolean,
    setUpstream?: boolean,
    confirmRisk?: boolean,
  ) => Promise<string>;
  pull: (remote?: string, branch?: string, rebase?: boolean, autostash?: boolean) => Promise<string>;
  fetch: (remote?: string, prune?: boolean, all?: boolean) => Promise<string>;
  cloneRepo: (url: string, destPath: string, options?: GitCloneOptions) => Promise<string>;
  cancelClone: () => Promise<void>;
  extractRepoName: (url: string) => Promise<string | null>;
  validateGitUrl: (url: string) => Promise<boolean>;
  initRepo: (path: string) => Promise<string>;
  getDiff: (staged?: boolean, file?: string, contextLines?: number) => Promise<string>;
  getDiffBetween: (from: string, to: string, file?: string, contextLines?: number) => Promise<string>;
  getCommitDiff: (hash: string, file?: string, contextLines?: number) => Promise<string>;
  merge: (branch: string, noFf?: boolean) => Promise<string>;
  revertCommit: (hash: string, noCommit?: boolean) => Promise<string>;
  cherryPick: (hash: string) => Promise<string>;
  resetHead: (mode?: string, target?: string, confirmRisk?: boolean) => Promise<string>;

  // Actions - Remote & branch management
  remoteAdd: (name: string, url: string) => Promise<string>;
  remoteRemove: (name: string) => Promise<string>;
  remoteRename: (oldName: string, newName: string) => Promise<string>;
  remoteSetUrl: (name: string, url: string) => Promise<string>;
  branchRename: (oldName: string, newName: string) => Promise<string>;
  branchSetUpstream: (branch: string, upstream: string) => Promise<string>;
  pushTags: (remote?: string) => Promise<string>;
  deleteRemoteBranch: (remote: string, branch: string) => Promise<string>;
  stashShowDiff: (stashId?: string) => Promise<string>;
  getReflog: (limit?: number) => Promise<GitReflogEntry[]>;
  cleanUntracked: (directories?: boolean, confirmRisk?: boolean) => Promise<string>;
  cleanDryRun: (directories?: boolean) => Promise<string[]>;
  stashPushFiles: (files: string[], message?: string, includeUntracked?: boolean) => Promise<string>;

  // Actions - Refresh all
  refreshAll: () => Promise<void>;
}

export function useGit(): UseGitReturn {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [executablePath, setExecutablePath] = useState<string | null>(null);
  const [config, setConfig] = useState<GitConfigEntry[]>([]);
  const [repoPath, setRepoPathState] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<GitRepoInfo | null>(null);
  const [commits, setCommits] = useState<GitCommitEntry[]>([]);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [remotes, setRemotes] = useState<GitRemoteInfo[]>([]);
  const [tags, setTags] = useState<GitTagInfo[]>([]);
  const [stashes, setStashes] = useState<GitStashEntry[]>([]);
  const [contributors, setContributors] = useState<GitContributor[]>([]);
  const [statusFiles, setStatusFiles] = useState<GitStatusFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] =
    useState<GitActionResult | null>(null);
  const [historyState, setHistoryState] = useState<GitHistoryState>(
    createHistoryState,
  );

  const updateHistoryViewState = useCallback(
    (
      view: GitHistoryView,
      patch:
        | Partial<GitHistoryQueryState>
        | ((prev: GitHistoryQueryState) => Partial<GitHistoryQueryState>),
    ) => {
      setHistoryState((prev) => {
        const prevView = prev[view];
        const nextPatch =
          typeof patch === 'function' ? patch(prevView) : patch;
        return {
          ...prev,
          [view]: {
            ...prevView,
            ...nextPatch,
          },
        };
      });
    },
    [],
  );

  const unwrapOperationPayload = useCallback(
    <T,>(operation: { result: GitActionResult; payload?: T }): T => {
      setLastActionResult(operation.result);
      if (operation.result.status !== 'success') {
        const nextSteps = operation.result.error?.nextSteps ?? [];
        const message =
          nextSteps.length > 0
            ? `${operation.result.message} ${nextSteps.join(' ')}`
            : operation.result.message;
        setError(message);
        throw new Error(message);
      }
      return operation.payload as T;
    },
    [],
  );

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (!tauri.isTauri()) {
      setAvailable(false);
      return false;
    }
    try {
      const result = await tauri.gitIsAvailable();
      setAvailable(result);
      return result;
    } catch {
      setAvailable(false);
      return false;
    }
  }, []);

  const refreshVersion = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      const ver = await tauri.gitGetVersion();
      setVersion(ver);
      const path = await tauri.gitGetExecutablePath();
      setExecutablePath(path);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const installGit = useCallback(async (): Promise<string> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    setLoading(true);
    setError(null);
    try {
      const msg = await tauri.gitInstall();
      await checkAvailability();
      await refreshVersion();
      return msg;
    } catch (e) {
      const errMsg = String(e);
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [checkAvailability, refreshVersion]);

  const updateGit = useCallback(async (): Promise<string> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    setLoading(true);
    setError(null);
    try {
      const msg = await tauri.gitUpdate();
      await refreshVersion();
      return msg;
    } catch (e) {
      const errMsg = String(e);
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [refreshVersion]);

  const getConfigSnapshot = useCallback(async (): Promise<GitConfigSnapshotResult> => {
    if (!tauri.isTauri()) {
      return {
        values: {},
        failures: [normalizeConfigReadFailure('Not in Tauri environment', null)],
      };
    }
    try {
      const entries = await tauri.gitGetConfig();
      setConfig(entries);
      return {
        values: buildConfigValueMap(entries),
        failures: [],
      };
    } catch (e) {
      const failure = normalizeConfigReadFailure(e, null);
      setError(failure.message);
      return {
        values: {},
        failures: [failure],
      };
    }
  }, []);

  const getConfigValuesBatch = useCallback(
    async (
      keys: string[],
      options?: GitConfigReadBatchOptions,
    ): Promise<GitConfigBatchReadResult> => {
      const values: Record<string, string | null> = {};
      for (const key of keys) {
        values[key] = null;
      }

      if (keys.length === 0) {
        return { values, failures: [] };
      }

      if (!tauri.isTauri()) {
        return {
          values,
          failures: [normalizeConfigReadFailure('Not in Tauri environment', null)],
        };
      }

      const failures: GitConfigReadFailure[] = [];
      const concurrency = Math.max(
        1,
        Math.min(options?.concurrency ?? DEFAULT_CONFIG_FALLBACK_CONCURRENCY, keys.length),
      );
      let cursor = 0;

      const workers = Array.from({ length: concurrency }, async () => {
        while (cursor < keys.length) {
          const index = cursor;
          cursor += 1;
          const key = keys[index];
          try {
            values[key] = await tauri.gitGetConfigValue(key);
          } catch (e) {
            failures.push(normalizeConfigReadFailure(e, key));
          }
        }
      });

      await Promise.all(workers);
      if (failures.length > 0) {
        setError(failures[0].message);
      }
      return { values, failures };
    },
    [],
  );

  const refreshConfig = useCallback(async () => {
    await getConfigSnapshot();
  }, [getConfigSnapshot]);

  const setConfigValue = useCallback(async (key: string, value: string) => {
    if (!tauri.isTauri()) return;
    try {
      await tauri.gitSetConfig(key, value);
      const entries = await tauri.gitGetConfig();
      setConfig(entries);
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  const removeConfigKey = useCallback(async (key: string) => {
    if (!tauri.isTauri()) return;
    try {
      await tauri.gitRemoveConfig(key);
      const entries = await tauri.gitGetConfig();
      setConfig(entries);
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  const getConfigValue = useCallback(async (key: string): Promise<string | null> => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.gitGetConfigValue(key);
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, []);

  const getConfigFilePath = useCallback(async (): Promise<string | null> => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.gitGetConfigFilePath();
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, []);

  const listAliases = useCallback(async (): Promise<GitConfigEntry[]> => {
    if (!tauri.isTauri()) return [];
    try {
      return await tauri.gitListAliases();
    } catch (e) {
      setError(String(e));
      return [];
    }
  }, []);

  const setConfigIfUnset = useCallback(async (key: string, value: string): Promise<boolean> => {
    if (!tauri.isTauri()) return false;
    try {
      const result = await tauri.gitSetConfigIfUnset(key, value);
      if (result) {
        const entries = await tauri.gitGetConfig();
        setConfig(entries);
      }
      return result;
    } catch (e) {
      setError(String(e));
      return false;
    }
  }, []);

  const applyConfigPlan = useCallback(async (items: GitConfigApplyPlanItem[]): Promise<GitConfigApplySummary> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');

    const actionableItems = items.filter((item) => item.selected);
    const results: GitConfigApplyResultItem[] = [];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (const item of actionableItems) {
      try {
        if (item.mode === 'unset') {
          await tauri.gitRemoveConfig(item.key);
          results.push({
            key: item.key,
            mode: item.mode,
            success: true,
            applied: true,
            message: 'Removed',
          });
          succeeded += 1;
          continue;
        }

        const value = item.value ?? '';
        if (item.mode === 'set_if_unset') {
          const wasSet = await tauri.gitSetConfigIfUnset(item.key, value);
          results.push({
            key: item.key,
            mode: item.mode,
            success: true,
            applied: wasSet,
            message: wasSet ? 'Applied' : 'Skipped (already set)',
          });
          succeeded += 1;
          if (!wasSet) skipped += 1;
          continue;
        }

        await tauri.gitSetConfig(item.key, value);
        results.push({
          key: item.key,
          mode: item.mode,
          success: true,
          applied: true,
          message: 'Applied',
        });
        succeeded += 1;
      } catch (e) {
        failed += 1;
        results.push({
          key: item.key,
          mode: item.mode,
          success: false,
          applied: false,
          message: String(e),
        });
      }
    }

    await refreshConfig();
    return {
      total: actionableItems.length,
      succeeded,
      failed,
      skipped,
      results,
    };
  }, [refreshConfig]);

  const probeConfigEditor = useCallback(async (): Promise<EditorCapabilityProbeResult> => {
    if (!tauri.isTauri()) {
      return {
        available: false,
        reason: 'runtime_error',
        preferredEditor: null,
        configPath: null,
        fallbackAvailable: false,
      };
    }
    try {
      return await tauri.gitProbeEditorCapability();
    } catch (e) {
      setError(String(e));
      return {
        available: false,
        reason: 'runtime_error',
        preferredEditor: null,
        configPath: null,
        fallbackAvailable: false,
      };
    }
  }, []);

  const openConfigInEditor = useCallback(async (): Promise<EditorOpenActionResult> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    try {
      return await tauri.gitOpenConfigInEditor();
    } catch (e) {
      const message = String(e);
      setError(message);
      return {
        success: false,
        kind: 'error',
        reason: 'runtime_error',
        message,
        openedWith: null,
        fallbackUsed: false,
        fallbackPath: null,
      };
    }
  }, []);

  const setRepoPath = useCallback(async (path: string) => {
    if (!tauri.isTauri()) return;
    setRepoPathState(path);
    setError(null);
    setLoading(true);
    try {
      const info = await tauri.gitGetRepoInfo(path);
      setRepoInfo(info);

      // Load repo data in parallel
      const [branchesData, remotesData, tagsData, stashesData, contributorsData, statusData, logData] =
        await Promise.all([
          tauri.gitGetBranches(path).catch(() => []),
          tauri.gitGetRemotes(path).catch(() => []),
          tauri.gitGetTags(path).catch(() => []),
          tauri.gitGetStashes(path).catch(() => []),
          tauri.gitGetContributors(path).catch(() => []),
          tauri.gitGetStatus(path).catch(() => []),
          tauri.gitGetLog(path, 50).catch(() => []),
        ]);

      setBranches(branchesData);
      setRemotes(remotesData);
      setTags(tagsData);
      setStashes(stashesData);
      setContributors(contributorsData);
      setStatusFiles(statusData);
      setCommits(logData);
    } catch (e) {
      setError(String(e));
      setRepoInfo(null);
      setBranches([]);
      setRemotes([]);
      setTags([]);
      setStashes([]);
      setContributors([]);
      setStatusFiles([]);
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRepoInfo = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      const info = await tauri.gitGetRepoInfo(repoPath);
      setRepoInfo(info);
    } catch (e) {
      setError(String(e));
    }
  }, [repoPath]);

  const refreshBranches = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      const data = await tauri.gitGetBranches(repoPath);
      setBranches(data);
    } catch (e) {
      setError(String(e));
    }
  }, [repoPath]);

  const refreshRemotes = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      const data = await tauri.gitGetRemotes(repoPath);
      setRemotes(data);
    } catch (e) {
      setError(String(e));
    }
  }, [repoPath]);

  const refreshTags = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      const data = await tauri.gitGetTags(repoPath);
      setTags(data);
    } catch (e) {
      setError(String(e));
    }
  }, [repoPath]);

  const refreshStashes = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      const data = await tauri.gitGetStashes(repoPath);
      setStashes(data);
    } catch (e) {
      setError(String(e));
    }
  }, [repoPath]);

  const refreshContributors = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      const data = await tauri.gitGetContributors(repoPath);
      setContributors(data);
    } catch (e) {
      setError(String(e));
    }
  }, [repoPath]);

  const getLog = useCallback(
    async (options?: GitHistoryQuery) => {
      if (!tauri.isTauri() || !repoPath) return;

      const append = Boolean(options?.append);
      const limit = options?.limit ?? DEFAULT_HISTORY_LIMIT;
      const query: GitHistoryQuery = {
        ...options,
        limit,
        skip: options?.skip ?? (append ? commits.length : 0),
        append,
      };

      updateHistoryViewState('log', {
        loading: true,
        error: null,
        query,
      });

      try {
        const data = await tauri.gitGetLog(repoPath, query);
        const nextCount = append ? commits.length + data.length : data.length;
        setCommits((prev) => {
          if (!append) {
            return data;
          }
          return [...prev, ...data];
        });
        updateHistoryViewState('log', {
          loading: false,
          error: null,
          empty: nextCount === 0,
          resultCount: nextCount,
          hasMore: data.length >= limit,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        const normalized = normalizeHistoryError(e);
        setError(normalized.message);
        updateHistoryViewState('log', {
          loading: false,
          error: normalized,
          empty: false,
          hasMore: false,
          updatedAt: new Date().toISOString(),
        });
      }
    },
    [repoPath, commits.length, updateHistoryViewState],
  );

  const getFileHistory = useCallback(
    async (
      file: string | GitHistoryQuery,
      limit?: number,
    ): Promise<GitCommitEntry[]> => {
      if (!tauri.isTauri() || !repoPath) return [];
      const query: GitHistoryQuery =
        typeof file === 'string'
          ? { file, limit: limit ?? DEFAULT_HISTORY_LIMIT }
          : { ...file, limit: file.limit ?? limit ?? DEFAULT_HISTORY_LIMIT };
      updateHistoryViewState('fileHistory', {
        loading: true,
        error: null,
        query,
      });
      try {
        const data = await tauri.gitGetFileHistory(repoPath, query);
        updateHistoryViewState('fileHistory', {
          loading: false,
          error: null,
          empty: data.length === 0,
          resultCount: data.length,
          hasMore: data.length >= (query.limit ?? DEFAULT_HISTORY_LIMIT),
          updatedAt: new Date().toISOString(),
        });
        return data;
      } catch (e) {
        const normalized = normalizeHistoryError(e);
        setError(normalized.message);
        updateHistoryViewState('fileHistory', {
          loading: false,
          error: normalized,
          empty: false,
          hasMore: false,
          updatedAt: new Date().toISOString(),
        });
        return [];
      }
    },
    [repoPath, updateHistoryViewState],
  );

  const getBlame = useCallback(
    async (file: string | GitHistoryQuery): Promise<GitBlameEntry[]> => {
      if (!tauri.isTauri() || !repoPath) return [];
      const query: GitHistoryQuery =
        typeof file === 'string' ? { file } : file;
      updateHistoryViewState('blame', {
        loading: true,
        error: null,
        query,
      });
      try {
        const data = await tauri.gitGetBlame(repoPath, query);
        updateHistoryViewState('blame', {
          loading: false,
          error: null,
          empty: data.length === 0,
          resultCount: data.length,
          hasMore: false,
          updatedAt: new Date().toISOString(),
        });
        return data;
      } catch (e) {
        const normalized = normalizeHistoryError(e);
        setError(normalized.message);
        updateHistoryViewState('blame', {
          loading: false,
          error: normalized,
          empty: false,
          hasMore: false,
          updatedAt: new Date().toISOString(),
        });
        return [];
      }
    },
    [repoPath, updateHistoryViewState],
  );

  const refreshStatus = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      const data = await tauri.gitGetStatus(repoPath);
      setStatusFiles(data);
    } catch (e) {
      setError(String(e));
    }
  }, [repoPath]);

  const refreshByScopes = useCallback(
    async (scopes: GitRefreshScope[]): Promise<void> => {
      if (!tauri.isTauri() || !repoPath) return;
      const uniqueScopes = [...new Set(scopes)];
      const actions: Array<Promise<unknown>> = [];

      for (const scope of uniqueScopes) {
        switch (scope) {
          case 'repoInfo':
            actions.push(refreshRepoInfo());
            break;
          case 'status':
            actions.push(refreshStatus());
            break;
          case 'branches':
            actions.push(refreshBranches());
            break;
          case 'remotes':
            actions.push(refreshRemotes());
            break;
          case 'tags':
            actions.push(refreshTags());
            break;
          case 'stashes':
            actions.push(refreshStashes());
            break;
          case 'log':
            actions.push(getLog({ limit: 50 }));
            break;
          case 'graph':
            actions.push(getLog({ limit: 200 }));
            break;
          case 'aheadBehind':
            if (repoInfo?.currentBranch) {
              actions.push(
                tauri
                  .gitGetAheadBehind(repoPath, repoInfo.currentBranch)
                  .catch(() => ({ ahead: 0, behind: 0 })),
              );
            }
            break;
          case 'advanced':
            // Advanced scope is handled by useGitAdvanced in page-level orchestration.
            break;
          default:
            break;
        }
      }

      await Promise.allSettled(actions);
    },
    [
      repoPath,
      refreshRepoInfo,
      refreshStatus,
      refreshBranches,
      refreshRemotes,
      refreshTags,
      refreshStashes,
      getLog,
      repoInfo?.currentBranch,
    ],
  );

  const getCommitDetail = useCallback(
    async (hash: string): Promise<GitCommitDetail | null> => {
      if (!tauri.isTauri() || !repoPath) return null;
      try {
        return await tauri.gitGetCommitDetail(repoPath, hash);
      } catch (e) {
        setError(String(e));
        return null;
      }
    },
    [repoPath],
  );

  const getGraphLog = useCallback(
    async (limit?: number, allBranches?: boolean, firstParent?: boolean, branch?: string): Promise<GitGraphEntry[]> => {
      if (!tauri.isTauri() || !repoPath) return [];
      try {
        return await tauri.gitGetGraphLog(repoPath, limit, allBranches, firstParent, branch);
      } catch (e) {
        setError(String(e));
        return [];
      }
    },
    [repoPath],
  );

  const getAheadBehind = useCallback(
    async (branch: string, upstream?: string): Promise<GitAheadBehind> => {
      if (!tauri.isTauri() || !repoPath) return { ahead: 0, behind: 0 };
      try {
        return await tauri.gitGetAheadBehind(repoPath, branch, upstream);
      } catch (e) {
        setError(String(e));
        return { ahead: 0, behind: 0 };
      }
    },
    [repoPath],
  );

  const checkoutBranch = useCallback(
    async (name: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitCheckoutBranch(repoPath, name);
        await refreshRepoInfo();
        await refreshBranches();
        await refreshStatus();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshRepoInfo, refreshBranches, refreshStatus],
  );

  const createBranch = useCallback(
    async (name: string, startPoint?: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitCreateBranch(repoPath, name, startPoint);
        await refreshBranches();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshBranches],
  );

  const deleteBranch = useCallback(
    async (name: string, force?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitDeleteBranch(repoPath, name, force);
        await refreshBranches();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshBranches],
  );

  const stashApply = useCallback(
    async (stashId?: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitStashApply(repoPath, stashId);
        await refreshStatus();
        await refreshRepoInfo();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshStatus, refreshRepoInfo],
  );

  const stashPop = useCallback(
    async (stashId?: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitStashPop(repoPath, stashId);
        await refreshStatus();
        await refreshRepoInfo();
        await refreshStashes();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshStatus, refreshRepoInfo, refreshStashes],
  );

  const stashDrop = useCallback(
    async (stashId?: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitStashDrop(repoPath, stashId);
        await refreshStashes();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshStashes],
  );

  const stashSave = useCallback(
    async (message?: string, includeUntracked?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitStashSave(repoPath, message, includeUntracked);
        await refreshStatus();
        await refreshStashes();
        await refreshRepoInfo();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshStatus, refreshStashes, refreshRepoInfo],
  );

  const createTag = useCallback(
    async (name: string, targetRef?: string, message?: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitCreateTag(repoPath, name, targetRef, message);
        await refreshTags();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshTags],
  );

  const deleteTag = useCallback(
    async (name: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('Not in Tauri environment');
      try {
        const msg = await tauri.gitDeleteTag(repoPath, name);
        await refreshTags();
        return msg;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [repoPath, refreshTags],
  );

  const getActivity = useCallback(
    async (days?: number): Promise<GitDayActivity[]> => {
      if (!tauri.isTauri() || !repoPath) return [];
      try {
        return await tauri.gitGetActivity(repoPath, days);
      } catch (e) {
        setError(String(e));
        return [];
      }
    },
    [repoPath],
  );

  const getFileStats = useCallback(
    async (
      file: string | GitHistoryQuery,
      limit?: number,
    ): Promise<GitFileStatEntry[]> => {
      if (!tauri.isTauri() || !repoPath) return [];
      const query: GitHistoryQuery =
        typeof file === 'string'
          ? { file, limit: limit ?? DEFAULT_HISTORY_LIMIT }
          : { ...file, limit: file.limit ?? limit ?? DEFAULT_HISTORY_LIMIT };
      updateHistoryViewState('fileStats', {
        loading: true,
        error: null,
        query,
      });
      try {
        const data = await tauri.gitGetFileStats(repoPath, query);
        updateHistoryViewState('fileStats', {
          loading: false,
          error: null,
          empty: data.length === 0,
          resultCount: data.length,
          hasMore: data.length >= (query.limit ?? DEFAULT_HISTORY_LIMIT),
          updatedAt: new Date().toISOString(),
        });
        return data;
      } catch (e) {
        const normalized = normalizeHistoryError(e);
        setError(normalized.message);
        updateHistoryViewState('fileStats', {
          loading: false,
          error: normalized,
          empty: false,
          hasMore: false,
          updatedAt: new Date().toISOString(),
        });
        return [];
      }
    },
    [repoPath, updateHistoryViewState],
  );

  const searchCommits = useCallback(
    async (
      queryInput: string | GitHistoryQuery,
      searchType?: GitHistorySearchType,
      limit?: number,
    ): Promise<GitCommitEntry[]> => {
      if (!tauri.isTauri() || !repoPath) return [];
      const query = toHistoryQuery(queryInput, searchType, limit);
      const normalizedQuery: GitHistoryQuery = {
        ...query,
        limit: query.limit ?? limit ?? DEFAULT_HISTORY_LIMIT,
      };
      updateHistoryViewState('search', {
        loading: true,
        error: null,
        query: normalizedQuery,
      });
      try {
        const data = await tauri.gitSearchCommits(repoPath, normalizedQuery);
        updateHistoryViewState('search', {
          loading: false,
          error: null,
          empty: data.length === 0,
          resultCount: data.length,
          hasMore: data.length >= (normalizedQuery.limit ?? DEFAULT_HISTORY_LIMIT),
          updatedAt: new Date().toISOString(),
        });
        return data;
      } catch (e) {
        const normalized = normalizeHistoryError(e);
        setError(normalized.message);
        updateHistoryViewState('search', {
          loading: false,
          error: normalized,
          empty: false,
          hasMore: false,
          updatedAt: new Date().toISOString(),
        });
        return [];
      }
    },
    [repoPath, updateHistoryViewState],
  );

  // Write operations
  const stageFiles = useCallback(
    async (files: string[]): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitStageFiles(repoPath, files);
      await refreshByScopes(['status', 'repoInfo']);
      return msg;
    },
    [repoPath, refreshByScopes],
  );

  const stageAll = useCallback(
    async (): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitStageAll(repoPath);
      await refreshByScopes(['status', 'repoInfo']);
      return msg;
    },
    [repoPath, refreshByScopes],
  );

  const unstageFiles = useCallback(
    async (files: string[]): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitUnstageFiles(repoPath, files);
      await refreshByScopes(['status', 'repoInfo']);
      return msg;
    },
    [repoPath, refreshByScopes],
  );

  const discardChanges = useCallback(
    async (files: string[]): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitDiscardChanges(repoPath, files);
      await refreshByScopes(['status', 'repoInfo']);
      return msg;
    },
    [repoPath, refreshByScopes],
  );

  const commit = useCallback(
    async (message: string, amend?: boolean, allowEmpty?: boolean, signoff?: boolean, noVerify?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitCommit(repoPath, message, amend, allowEmpty, signoff, noVerify);
      await refreshByScopes(['status', 'repoInfo', 'log']);
      return msg;
    },
    [repoPath, refreshByScopes],
  );

  const push = useCallback(
    async (
      remote?: string,
      branch?: string,
      force?: boolean,
      forceLease?: boolean,
      setUpstream?: boolean,
      confirmRisk?: boolean,
    ): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const guardrail = evaluateGitGuardrail('push', { force, forceLease });
      const operation = await executeGitOperation({
        operation: 'push',
        refreshByScopes,
        refreshScopes: ['repoInfo', 'status', 'branches', 'aheadBehind', 'log'],
        precheck: () => guardrail,
        allowWarning: confirmRisk,
        execute: () =>
          tauri.gitPush(
            repoPath,
            remote,
            branch,
            force,
            forceLease,
            setUpstream,
          ),
      });
      return unwrapOperationPayload(operation);
    },
    [repoPath, refreshByScopes, unwrapOperationPayload],
  );

  const pull = useCallback(
    async (remote?: string, branch?: string, rebase?: boolean, autostash?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const operation = await executeGitOperation({
        operation: 'pull',
        refreshByScopes,
        refreshScopes: ['repoInfo', 'status', 'branches', 'log', 'aheadBehind'],
        execute: () => tauri.gitPull(repoPath, remote, branch, rebase, autostash),
      });
      return unwrapOperationPayload(operation);
    },
    [repoPath, refreshByScopes, unwrapOperationPayload],
  );

  const fetchRemote = useCallback(
    async (remote?: string, prune?: boolean, all?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const operation = await executeGitOperation({
        operation: 'fetch',
        refreshByScopes,
        refreshScopes: ['branches', 'remotes', 'aheadBehind'],
        execute: () => tauri.gitFetch(repoPath, remote, prune, all),
      });
      return unwrapOperationPayload(operation);
    },
    [repoPath, refreshByScopes, unwrapOperationPayload],
  );

  const cloneRepo = useCallback(
    async (url: string, destPath: string, options?: GitCloneOptions): Promise<string> => {
      if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
      const operation = await executeGitOperation({
        operation: 'clone',
        execute: () => tauri.gitClone(url, destPath, options),
      });
      return unwrapOperationPayload(operation);
    },
    [unwrapOperationPayload],
  );

  const cancelClone = useCallback(async (): Promise<void> => {
    if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
    const operation = await executeGitOperation({
      operation: 'cancelClone',
      execute: () => tauri.gitCancelClone(),
      mapSuccessMessage: () => 'Clone cancellation requested',
    });
    unwrapOperationPayload(operation);
  }, [unwrapOperationPayload]);

  const extractRepoName = useCallback(async (url: string): Promise<string | null> => {
    if (!tauri.isTauri()) return null;
    return await tauri.gitExtractRepoName(url);
  }, []);

  const validateGitUrl = useCallback(async (url: string): Promise<boolean> => {
    if (!tauri.isTauri()) return false;
    return await tauri.gitValidateUrl(url);
  }, []);

  const initRepo = useCallback(
    async (path: string): Promise<string> => {
      if (!tauri.isTauri()) throw new Error('Not in Tauri environment');
      return await tauri.gitInit(path);
    },
    [],
  );

  const getDiff = useCallback(
    async (staged?: boolean, file?: string, contextLines?: number): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) return '';
      return await tauri.gitGetDiff(repoPath, staged, file, contextLines);
    },
    [repoPath],
  );

  const getDiffBetween = useCallback(
    async (from: string, to: string, file?: string, contextLines?: number): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) return '';
      return await tauri.gitGetDiffBetween(repoPath, from, to, file, contextLines);
    },
    [repoPath],
  );

  const getCommitDiff = useCallback(
    async (hash: string, file?: string, contextLines?: number): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) return '';
      try {
        return await tauri.gitGetCommitDiff(repoPath, hash, file, contextLines);
      } catch (e) {
        setError(String(e));
        return '';
      }
    },
    [repoPath],
  );

  const merge = useCallback(
    async (branch: string, noFf?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const operation = await executeGitOperation({
        operation: 'merge',
        refreshByScopes,
        refreshScopes: ['repoInfo', 'status', 'branches', 'log', 'advanced'],
        execute: () => tauri.gitMerge(repoPath, branch, noFf),
      });
      return unwrapOperationPayload(operation);
    },
    [repoPath, refreshByScopes, unwrapOperationPayload],
  );

  const revertCommit = useCallback(
    async (hash: string, noCommit?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const operation = await executeGitOperation({
        operation: 'revert',
        refreshByScopes,
        refreshScopes: ['repoInfo', 'status', 'log', 'advanced'],
        execute: () => tauri.gitRevert(repoPath, hash, noCommit),
      });
      return unwrapOperationPayload(operation);
    },
    [repoPath, refreshByScopes, unwrapOperationPayload],
  );

  const cherryPick = useCallback(
    async (hash: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const operation = await executeGitOperation({
        operation: 'cherryPick',
        refreshByScopes,
        refreshScopes: ['repoInfo', 'status', 'log', 'advanced'],
        execute: () => tauri.gitCherryPick(repoPath, hash),
      });
      return unwrapOperationPayload(operation);
    },
    [repoPath, refreshByScopes, unwrapOperationPayload],
  );

  const resetHead = useCallback(
    async (mode?: string, target?: string, confirmRisk?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const guardrail = evaluateGitGuardrail('reset', { mode });
      const operation = await executeGitOperation({
        operation: 'reset',
        refreshByScopes,
        refreshScopes: ['repoInfo', 'status', 'branches', 'log', 'advanced'],
        precheck: () => guardrail,
        allowWarning: confirmRisk,
        execute: () => tauri.gitReset(repoPath, mode, target),
      });
      return unwrapOperationPayload(operation);
    },
    [repoPath, refreshByScopes, unwrapOperationPayload],
  );

  // Remote & branch management
  const remoteAdd = useCallback(
    async (name: string, url: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitRemoteAdd(repoPath, name, url);
      await refreshRemotes();
      return msg;
    },
    [repoPath, refreshRemotes],
  );

  const remoteRemove = useCallback(
    async (name: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitRemoteRemove(repoPath, name);
      await refreshRemotes();
      return msg;
    },
    [repoPath, refreshRemotes],
  );

  const remoteRename = useCallback(
    async (oldName: string, newName: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitRemoteRename(repoPath, oldName, newName);
      await refreshRemotes();
      return msg;
    },
    [repoPath, refreshRemotes],
  );

  const remoteSetUrl = useCallback(
    async (name: string, url: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitRemoteSetUrl(repoPath, name, url);
      await refreshRemotes();
      return msg;
    },
    [repoPath, refreshRemotes],
  );

  const branchRename = useCallback(
    async (oldName: string, newName: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitBranchRename(repoPath, oldName, newName);
      await refreshBranches();
      return msg;
    },
    [repoPath, refreshBranches],
  );

  const branchSetUpstream = useCallback(
    async (branch: string, upstream: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitBranchSetUpstream(repoPath, branch, upstream);
      await refreshBranches();
      return msg;
    },
    [repoPath, refreshBranches],
  );

  const pushTags = useCallback(
    async (remote?: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      return await tauri.gitPushTags(repoPath, remote);
    },
    [repoPath],
  );

  const deleteRemoteBranch = useCallback(
    async (remote: string, branch: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitDeleteRemoteBranch(repoPath, remote, branch);
      await refreshBranches();
      return msg;
    },
    [repoPath, refreshBranches],
  );

  const stashShowDiff = useCallback(
    async (stashId?: string): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) return '';
      return await tauri.gitStashShow(repoPath, stashId);
    },
    [repoPath],
  );

  const getReflog = useCallback(
    async (limit?: number): Promise<GitReflogEntry[]> => {
      if (!tauri.isTauri() || !repoPath) return [];
      const query: GitHistoryQuery = { limit: limit ?? DEFAULT_HISTORY_LIMIT };
      updateHistoryViewState('reflog', {
        loading: true,
        error: null,
        query,
      });
      try {
        const data = await tauri.gitGetReflog(repoPath, limit);
        updateHistoryViewState('reflog', {
          loading: false,
          error: null,
          empty: data.length === 0,
          resultCount: data.length,
          hasMore: data.length >= (limit ?? DEFAULT_HISTORY_LIMIT),
          updatedAt: new Date().toISOString(),
        });
        return data;
      } catch (e) {
        const normalized = normalizeHistoryError(e);
        setError(normalized.message);
        updateHistoryViewState('reflog', {
          loading: false,
          error: normalized,
          empty: false,
          hasMore: false,
          updatedAt: new Date().toISOString(),
        });
        return [];
      }
    },
    [repoPath, updateHistoryViewState],
  );

  const cleanUntracked = useCallback(
    async (directories?: boolean, confirmRisk?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const guardrail = evaluateGitGuardrail('clean');
      const operation = await executeGitOperation({
        operation: 'clean',
        refreshByScopes,
        refreshScopes: ['status', 'repoInfo'],
        precheck: () => guardrail,
        allowWarning: confirmRisk,
        execute: () => tauri.gitClean(repoPath, directories),
      });
      return unwrapOperationPayload(operation);
    },
    [repoPath, refreshByScopes, unwrapOperationPayload],
  );

  const cleanDryRun = useCallback(
    async (directories?: boolean): Promise<string[]> => {
      if (!tauri.isTauri() || !repoPath) return [];
      return await tauri.gitCleanDryRun(repoPath, directories);
    },
    [repoPath],
  );

  const stashPushFiles = useCallback(
    async (files: string[], message?: string, includeUntracked?: boolean): Promise<string> => {
      if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
      const msg = await tauri.gitStashPushFiles(repoPath, files, message, includeUntracked);
      await refreshStatus();
      await refreshRepoInfo();
      await refreshStashes();
      return msg;
    },
    [repoPath, refreshStatus, refreshRepoInfo, refreshStashes],
  );

  const refreshAll = useCallback(async () => {
    if (!tauri.isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const isAvailable = await checkAvailability();
      if (!isAvailable) {
        setVersion(null);
        setExecutablePath(null);
        setConfig([]);
        return;
      }
      await refreshVersion();
      // Config loading can stall on some machines; do not block core readiness.
      void refreshConfig();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [checkAvailability, refreshVersion, refreshConfig]);

  return {
    available,
    version,
    executablePath,
    config,
    repoPath,
    repoInfo,
    commits,
    branches,
    remotes,
    tags,
    stashes,
    contributors,
    statusFiles,
    loading,
    error,
    lastActionResult,
    historyState,
    checkAvailability,
    refreshVersion,
    installGit,
    updateGit,
    refreshConfig,
    getConfigSnapshot,
    getConfigValuesBatch,
    setConfigValue,
    removeConfigKey,
    getConfigValue,
    getConfigFilePath,
    listAliases,
    setConfigIfUnset,
    applyConfigPlan,
    probeConfigEditor,
    openConfigInEditor,
    setRepoPath,
    refreshRepoInfo,
    refreshBranches,
    refreshRemotes,
    refreshTags,
    refreshStashes,
    refreshContributors,
    refreshStatus,
    refreshByScopes,
    getLog,
    getFileHistory,
    getBlame,
    getCommitDetail,
    getGraphLog,
    getAheadBehind,
    checkoutBranch,
    createBranch,
    deleteBranch,
    stashApply,
    stashPop,
    stashDrop,
    stashSave,
    createTag,
    deleteTag,
    getActivity,
    getFileStats,
    searchCommits,
    refreshAll,
    stageFiles,
    stageAll,
    unstageFiles,
    discardChanges,
    commit,
    push,
    pull,
    fetch: fetchRemote,
    cloneRepo,
    cancelClone,
    extractRepoName,
    validateGitUrl,
    initRepo,
    getDiff,
    getDiffBetween,
    getCommitDiff,
    merge,
    revertCommit,
    cherryPick,
    resetHead,
    remoteAdd,
    remoteRemove,
    remoteRename,
    remoteSetUrl,
    branchRename,
    branchSetUpstream,
    pushTags,
    deleteRemoteBranch,
    stashShowDiff,
    getReflog,
    cleanUntracked,
    cleanDryRun,
    stashPushFiles,
  };
}
