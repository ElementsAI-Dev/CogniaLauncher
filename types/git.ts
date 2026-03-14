/**
 * Git component prop interfaces and internal types.
 * Extracted from components/git/*.tsx for proper layer separation.
 */

import type {
  EditorCapabilityProbeResult,
  EditorOpenActionResult,
  GitBranchInfo,
  GitBisectState,
  GitBlameEntry,
  GitCloneOptions,
  GitCommitDetail,
  GitCommitEntry,
  GitConfigEntry,
  GitContributor,
  GitDayActivity,
  GitHistoryQuery,
  GitHistorySearchType,
  GitHistoryQueryState,
  GitFileStatEntry,
  GitGraphEntry,
  GitHookInfo,
  GitLfsFile,
  GitRebaseTodoItem,
  GitReflogEntry,
  GitRemoteInfo,
  GitRepoInfo,
  GitRepoStats,
  GitStashEntry,
  GitStatusFile,
  GitSubmoduleInfo,
  GitSupportFeature,
  GitSupportSnapshot,
  GitTagInfo,
  GitWorktreeInfo,
} from './tauri';
import type { CloneHistoryEntry } from '@/lib/stores/git';

// ---------------------------------------------------------------------------
// Component prop interfaces
// ---------------------------------------------------------------------------

export interface GitActivityHeatmapProps {
  onGetActivity: (days?: number) => Promise<GitDayActivity[]>;
}

export interface GitBlameViewProps {
  repoPath: string | null;
  onGetBlame: (file: string | GitHistoryQuery) => Promise<GitBlameEntry[]>;
  queryState?: GitHistoryQueryState;
}

export interface GitBranchCardProps {
  branches: GitBranchInfo[];
  currentBranch?: string;
  aheadBehind?: { ahead: number; behind: number };
  onCheckout?: (name: string) => Promise<string>;
  onCreate?: (name: string, startPoint?: string) => Promise<string>;
  onDelete?: (name: string, force?: boolean) => Promise<string>;
  onDeleteRemote?: (remote: string, branch: string) => Promise<string>;
  onRename?: (oldName: string, newName: string) => Promise<string>;
  onSetUpstream?: (branch: string, upstream: string) => Promise<string>;
}

export interface GitCloneDialogProps {
  onClone: (url: string, destPath: string, options?: GitCloneOptions) => Promise<string>;
  onExtractRepoName?: (url: string) => Promise<string | null>;
  onValidateUrl?: (url: string) => Promise<boolean>;
  onOpenRepo?: (path: string) => void;
  onCancelClone?: () => Promise<void>;
  cloneHistory?: CloneHistoryEntry[];
  onClearCloneHistory?: () => void;
}

export interface GitCommitDetailProps {
  hash: string | null;
  detail: GitCommitDetail | null;
  loading: boolean;
  onClose: () => void;
  onGetCommitDiff?: (hash: string, file?: string, contextLines?: number) => Promise<string>;
}

export interface GitCommitDialogProps {
  stagedCount: number;
  onCommit: (message: string, amend?: boolean, allowEmpty?: boolean, signoff?: boolean, noVerify?: boolean) => Promise<string>;
  disabled?: boolean;
}

export interface GitCommitGraphProps {
  onLoadGraph: (limit?: number, allBranches?: boolean, firstParent?: boolean, branch?: string) => Promise<GitGraphEntry[]>;
  onSelectCommit?: (hash: string) => void;
  selectedHash?: string | null;
  branches?: GitBranchInfo[];
  refreshKey?: number;
  onCopyHash?: (hash: string) => void;
  onCreateBranch?: (hash: string) => void;
  onCreateTag?: (hash: string) => void;
  onRevert?: (hash: string) => void;
  onCherryPick?: (hash: string) => void;
  onResetTo?: (hash: string) => void;
}

export interface GitCommitLogProps {
  commits: GitCommitEntry[];
  onLoadMore?: (options?: GitHistoryQuery) => void;
  onSelectCommit?: (hash: string) => void;
  selectedHash?: string | null;
  queryState?: GitHistoryQueryState;
}

export interface GitConfigCardProps {
  config: GitConfigEntry[];
  onSet: (key: string, value: string) => Promise<void>;
  onRemove: (key: string) => Promise<void>;
  configFilePath?: string | null;
  editorCapability?: EditorCapabilityProbeResult | null;
  onOpenInEditor?: () => Promise<EditorOpenActionResult>;
  onOpenFileLocation?: () => Promise<void>;
}

export interface GitGlobalSettingsCardProps {
  onGetConfigSnapshot: () => Promise<GitConfigSnapshotResult>;
  onGetConfigValuesBatch: (
    keys: string[],
    options?: GitConfigReadBatchOptions,
  ) => Promise<GitConfigBatchReadResult>;
  onGetConfigFilePath?: () => Promise<string | null>;
  onOpenConfigLocation?: () => Promise<void>;
  onSetConfig: (key: string, value: string) => Promise<void>;
  onSetConfigIfUnset?: (key: string, value: string) => Promise<boolean>;
  onApplyConfigPlan?: (
    items: GitConfigApplyPlanItem[],
  ) => Promise<GitConfigApplySummary>;
}

export interface GitAliasCardProps {
  onListAliases: () => Promise<GitConfigEntry[]>;
  onSetAlias: (name: string, command: string) => Promise<void>;
  onRemoveAlias: (name: string) => Promise<void>;
}

export interface GitContributorsChartProps {
  contributors: GitContributor[];
}

export interface GitDiffViewerProps {
  diff: string;
  loading?: boolean;
  title?: string;
  defaultViewMode?: DiffViewMode;
  enableWordDiff?: boolean;
}

export interface GitFileHistoryProps {
  repoPath: string | null;
  onGetHistory: (file: string | GitHistoryQuery, limit?: number) => Promise<GitCommitEntry[]>;
  onGetCommitDiff?: (hash: string, file?: string, contextLines?: number) => Promise<string>;
  onSelectCommit?: (hash: string) => void;
  queryState?: GitHistoryQueryState;
}

export interface GitMergeDialogProps {
  branches: GitBranchInfo[];
  currentBranch: string;
  onMerge: (branch: string, noFf?: boolean) => Promise<string>;
}

export interface GitReflogCardProps {
  onGetReflog: (limit?: number) => Promise<GitReflogEntry[]>;
  onResetTo?: (hash: string, mode?: string) => Promise<string>;
  onSelectCommit?: (hash: string) => void;
  queryState?: GitHistoryQueryState;
}

export interface GitRemoteCardProps {
  remotes: GitRemoteInfo[];
  onAdd?: (name: string, url: string) => Promise<string>;
  onRemove?: (name: string) => Promise<string>;
  onRename?: (oldName: string, newName: string) => Promise<string>;
  onSetUrl?: (name: string, url: string) => Promise<string>;
  onPrune?: (name: string) => Promise<string>;
}

export interface GitRepoInfoCardProps {
  repoInfo: GitRepoInfo;
}

export interface GitRepoSelectorProps {
  repoPath: string | null;
  onSelect: (path: string) => Promise<void>;
  onInit?: (path: string) => Promise<string>;
  loading: boolean;
}

export interface GitSearchCommitsProps {
  onSearch: (
    query: string | GitHistoryQuery,
    searchType?: GitHistorySearchType,
    limit?: number,
  ) => Promise<GitCommitEntry[]>;
  onSelectCommit?: (hash: string) => void;
  queryState?: GitHistoryQueryState;
}

export interface GitStashListProps {
  stashes: GitStashEntry[];
  onApply?: (stashId?: string) => Promise<string>;
  onPop?: (stashId?: string) => Promise<string>;
  onDrop?: (stashId?: string) => Promise<string>;
  onSave?: (message?: string, includeUntracked?: boolean) => Promise<string>;
  onBranchFromStash?: (branchName: string, stashId?: string) => Promise<string>;
  onPushFiles?: (files: string[], message?: string, includeUntracked?: boolean) => Promise<string>;
  onShowDiff?: (stashId?: string) => Promise<string>;
}

export interface GitStatusCardProps {
  available: boolean | null;
  version: string | null;
  executablePath: string | null;
  loading: boolean;
  onInstall: () => void;
  onUpdate: () => void;
  onRefresh: () => void;
}

export interface GitStatusFilesProps {
  files: GitStatusFile[];
  loading?: boolean;
  onRefresh?: () => void;
  onStage?: (files: string[]) => Promise<string>;
  onUnstage?: (files: string[]) => Promise<string>;
  onStageAll?: () => Promise<string>;
  onDiscard?: (files: string[]) => Promise<string>;
  onViewDiff?: (file: string, staged?: boolean) => void;
}

export interface GitTagListProps {
  tags: GitTagInfo[];
  onCreateTag?: (name: string, targetRef?: string, message?: string) => Promise<string>;
  onDeleteTag?: (name: string) => Promise<string>;
  onPushTags?: (remote?: string) => Promise<string>;
}

export interface GitVisualFileHistoryProps {
  repoPath: string | null;
  onGetFileStats: (file: string | GitHistoryQuery, limit?: number) => Promise<GitFileStatEntry[]>;
  queryState?: GitHistoryQueryState;
}

// ---------------------------------------------------------------------------
// Internal types used by git components
// ---------------------------------------------------------------------------

/** Lane assignment for commit graph visualization */
export interface LaneAssignment {
  lane: number;
  maxLane: number;
}

/** Parsed diff line with type classification */
export interface ParsedDiffLine {
  type: 'add' | 'del' | 'hunk' | 'meta' | 'ctx';
  content: string;
}

/** A single change line within a hunk */
export interface DiffChange {
  type: 'add' | 'del' | 'ctx';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

/** A hunk (section) within a file diff */
export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: DiffChange[];
}

/** A single file's diff data */
export interface DiffFileDiff {
  oldName: string;
  newName: string;
  isBinary: boolean;
  isRenamed: boolean;
  isNew: boolean;
  isDeleted: boolean;
  hunks: DiffHunk[];
  stats: { additions: number; deletions: number };
}

/** Full parsed diff result */
export interface ParsedDiff {
  files: DiffFileDiff[];
  stats: { filesChanged: number; additions: number; deletions: number };
}

/** View mode for the diff viewer */
export type DiffViewMode = 'unified' | 'split';

export interface GitRepoActionBarProps {
  repoPath: string | null;
  currentBranch?: string;
  remotes?: GitRemoteInfo[];
  aheadBehind?: { ahead: number; behind: number };
  loading?: boolean;
  onPush?: (
    remote?: string,
    branch?: string,
    force?: boolean,
    forceLease?: boolean,
    setUpstream?: boolean,
    confirmRisk?: boolean,
  ) => Promise<string>;
  onPull?: (
    remote?: string,
    branch?: string,
    rebase?: boolean,
    autostash?: boolean,
  ) => Promise<string>;
  onFetch?: (remote?: string, prune?: boolean, all?: boolean) => Promise<string>;
  onClean?: (directories?: boolean, confirmRisk?: boolean) => Promise<string>;
  onCleanPreview?: (directories?: boolean) => Promise<string[]>;
  onRefresh?: () => void;
}

export interface GitSubmodulesCardProps {
  submodules: GitSubmoduleInfo[];
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onAdd?: (url: string, subpath: string) => Promise<string>;
  onUpdate?: (init?: boolean, recursive?: boolean) => Promise<string>;
  onRemove?: (subpath: string) => Promise<string>;
  onSync?: () => Promise<string>;
}

export interface GitWorktreesCardProps {
  worktrees: GitWorktreeInfo[];
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onAdd?: (dest: string, branch?: string, newBranch?: string) => Promise<string>;
  onRemove?: (dest: string, force?: boolean) => Promise<string>;
  onPrune?: () => Promise<string>;
}

export interface GitGitignoreCardProps {
  loading?: boolean;
  onGetGitignore: () => Promise<string>;
  onSetGitignore: (content: string) => Promise<void>;
  onCheckIgnore: (files: string[]) => Promise<string[]>;
  onAddToGitignore: (patterns: string[]) => Promise<void>;
}

export interface GitHooksCardProps {
  hooks: GitHookInfo[];
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onGetContent: (name: string) => Promise<string>;
  onSetContent: (name: string, content: string) => Promise<void>;
  onToggle: (name: string, enabled: boolean) => Promise<void>;
}

export interface GitLfsCardProps {
  lfsAvailable: boolean | null;
  lfsVersion: string | null;
  trackedPatterns: string[];
  lfsFiles: GitLfsFile[];
  loading?: boolean;
  onCheckAvailability: () => Promise<void>;
  onRefreshTrackedPatterns: () => Promise<void>;
  onRefreshLfsFiles: () => Promise<void>;
  onTrack: (pattern: string) => Promise<string>;
  onUntrack: (pattern: string) => Promise<string>;
  onInstall: () => Promise<string>;
}

export interface GitLocalConfigCardProps {
  config: GitConfigEntry[];
  loading?: boolean;
  onRefresh: () => Promise<void>;
  onSet: (key: string, value: string) => Promise<void>;
  onRemove: (key: string) => Promise<void>;
  onGetValue: (key: string) => Promise<string | null>;
}

export interface GitRepoStatsCardProps {
  repoStats: GitRepoStats | null;
  loading?: boolean;
  onRefresh: () => Promise<void>;
  onFsck: () => Promise<string[]>;
  onDescribe: () => Promise<string | null>;
  onIsShallow: () => Promise<boolean>;
  onDeepen: (depth: number) => Promise<string>;
  onUnshallow: () => Promise<string>;
}

export interface GitSparseCheckoutCardProps {
  isSparseCheckout: boolean;
  sparsePatterns: string[];
  loading?: boolean;
  supportReason?: string | null;
  onRefresh: () => Promise<void>;
  onInit: (cone?: boolean) => Promise<string>;
  onSet: (patterns: string[]) => Promise<string>;
  onAdd: (patterns: string[]) => Promise<string>;
  onDisable: () => Promise<string>;
}

export interface GitRemotePruneCardProps {
  remotes: GitRemoteInfo[];
  loading?: boolean;
  onPrune: (remote: string) => Promise<string>;
}

export interface GitSignatureVerifyCardProps {
  loading?: boolean;
  supportReason?: string | null;
  onVerifyCommit: (hash: string) => Promise<string>;
  onVerifyTag: (tag: string) => Promise<string>;
}

export interface GitInteractiveRebaseCardProps {
  loading?: boolean;
  supportReason?: string | null;
  onPreview: (base: string) => Promise<GitRebaseTodoItem[]>;
  onStart: (base: string, todo: GitRebaseTodoItem[]) => Promise<string>;
}

export interface GitRebaseSquashCardProps {
  loading?: boolean;
  supportReason?: string | null;
  onRebase: (onto: string, confirmRisk?: boolean) => Promise<string>;
  onSquash: (count: number, message: string, confirmRisk?: boolean) => Promise<string>;
}

export interface GitBisectCardProps {
  bisectState: GitBisectState;
  loading?: boolean;
  supportReason?: string | null;
  onRefreshState: () => Promise<void>;
  onStart: (badRef: string, goodRef: string) => Promise<string>;
  onGood: () => Promise<string>;
  onBad: () => Promise<string>;
  onSkip: () => Promise<string>;
  onReset: () => Promise<string>;
  onLog: () => Promise<string>;
}

export interface GitArchiveCardProps {
  loading?: boolean;
  supportReason?: string | null;
  onArchive: (format: string, outputPath: string, refName: string, prefix?: string) => Promise<string>;
}

export interface GitPatchCardProps {
  loading?: boolean;
  supportReason?: string | null;
  onFormatPatch: (range: string, outputDir: string) => Promise<string[]>;
  onApplyPatch: (patchPath: string, checkOnly?: boolean) => Promise<string>;
  onApplyMailbox: (patchPath: string) => Promise<string>;
}

export type GitConfigApplyMode = 'set' | 'unset' | 'set_if_unset';

export interface GitConfigTemplateItem {
  key: string;
  value: string | null;
  mode: GitConfigApplyMode;
}

export interface GitConfigTemplateDefinition {
  id: string;
  labelKey: string;
  descriptionKey: string;
  items: GitConfigTemplateItem[];
}

export type GitConfigPreviewAction = 'add' | 'update' | 'remove' | 'unchanged';

export interface GitConfigTemplatePreviewItem {
  key: string;
  mode: GitConfigApplyMode;
  currentValue: string | null;
  nextValue: string | null;
  action: GitConfigPreviewAction;
  selected: boolean;
  validationMessageKey: string | null;
}

export interface GitConfigApplyPlanItem {
  key: string;
  mode: GitConfigApplyMode;
  value: string | null;
  selected: boolean;
}

export interface GitConfigApplyResultItem {
  key: string;
  mode: GitConfigApplyMode;
  success: boolean;
  applied: boolean;
  message: string;
}

export interface GitConfigApplySummary {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: GitConfigApplyResultItem[];
}

export type GitConfigReadErrorCategory =
  | 'timeout'
  | 'execution_failed'
  | 'parse_failed'
  | 'unknown';

export interface GitConfigReadFailure {
  key: string | null;
  category: GitConfigReadErrorCategory;
  message: string;
  recoverable: boolean;
  nextSteps: string[];
}

export interface GitConfigSnapshotResult {
  values: Record<string, string | null>;
  failures: GitConfigReadFailure[];
}

export interface GitConfigReadBatchOptions {
  concurrency?: number;
}

export interface GitConfigBatchReadResult {
  values: Record<string, string | null>;
  failures: GitConfigReadFailure[];
}

export type GitHistoryView =
  | 'log'
  | 'search'
  | 'fileHistory'
  | 'fileStats'
  | 'blame'
  | 'reflog';

export type GitHistoryState = Record<GitHistoryView, GitHistoryQueryState>;

export type GitSupportFeatureState = GitSupportFeature;

export type GitSupportFeatureMap = Record<string, GitSupportFeatureState>;

export interface GitSupportState {
  snapshot: GitSupportSnapshot | null;
  byFeature: GitSupportFeatureMap;
}

export type GitRefreshScope =
  | 'repoInfo'
  | 'status'
  | 'branches'
  | 'remotes'
  | 'tags'
  | 'stashes'
  | 'log'
  | 'graph'
  | 'aheadBehind'
  | 'advanced';

export type GitGuardrailLevel = 'pass' | 'warn' | 'block';

export type GitActionErrorCategory =
  | 'environment'
  | 'precondition'
  | 'conflict'
  | 'execution'
  | 'cancelled'
  | 'timeout'
  | 'unknown';

export interface GitGuardrailDecision {
  level: GitGuardrailLevel;
  reason: string;
  nextSteps: string[];
}

export interface GitActionError {
  category: GitActionErrorCategory;
  recoverable: boolean;
  rawMessage: string;
  userMessage: string;
  nextSteps: string[];
}

export type GitActionStatus = 'success' | 'failed' | 'blocked' | 'cancelled';

export interface GitActionResult {
  operation: string;
  status: GitActionStatus;
  message: string;
  refreshScopes: GitRefreshScope[];
  guardrail?: GitGuardrailDecision;
  error?: GitActionError;
}
