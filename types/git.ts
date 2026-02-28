/**
 * Git component prop interfaces and internal types.
 * Extracted from components/git/*.tsx for proper layer separation.
 */

import type {
  GitBranchInfo,
  GitBlameEntry,
  GitCloneOptions,
  GitCommitDetail,
  GitCommitEntry,
  GitConfigEntry,
  GitContributor,
  GitDayActivity,
  GitFileStatEntry,
  GitGraphEntry,
  GitReflogEntry,
  GitRemoteInfo,
  GitRepoInfo,
  GitStashEntry,
  GitStatusFile,
  GitTagInfo,
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
  onGetBlame: (file: string) => Promise<GitBlameEntry[]>;
}

export interface GitBranchCardProps {
  branches: GitBranchInfo[];
  currentBranch?: string;
  aheadBehind?: { ahead: number; behind: number };
  onCheckout?: (name: string) => Promise<string>;
  onCreate?: (name: string, startPoint?: string) => Promise<string>;
  onDelete?: (name: string, force?: boolean) => Promise<string>;
  onRename?: (oldName: string, newName: string) => Promise<string>;
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
  onCommit: (message: string, amend?: boolean) => Promise<string>;
  disabled?: boolean;
}

export interface GitCommitGraphProps {
  onLoadGraph: (limit?: number, allBranches?: boolean, firstParent?: boolean, branch?: string) => Promise<GitGraphEntry[]>;
  onSelectCommit?: (hash: string) => void;
  selectedHash?: string | null;
  branches?: GitBranchInfo[];
  onCopyHash?: (hash: string) => void;
  onCreateBranch?: (hash: string) => void;
  onCreateTag?: (hash: string) => void;
  onRevert?: (hash: string) => void;
  onCherryPick?: (hash: string) => void;
  onResetTo?: (hash: string) => void;
}

export interface GitCommitLogProps {
  commits: GitCommitEntry[];
  onLoadMore?: (options?: {
    limit?: number;
    author?: string;
    since?: string;
    until?: string;
  }) => void;
  onSelectCommit?: (hash: string) => void;
  selectedHash?: string | null;
}

export interface GitConfigCardProps {
  config: GitConfigEntry[];
  onSet: (key: string, value: string) => Promise<void>;
  onRemove: (key: string) => Promise<void>;
  configFilePath?: string | null;
  onOpenInEditor?: () => Promise<string>;
}

export interface GitGlobalSettingsCardProps {
  onGetConfigValue: (key: string) => Promise<string | null>;
  onSetConfig: (key: string, value: string) => Promise<void>;
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
  onGetHistory: (file: string, limit?: number) => Promise<GitCommitEntry[]>;
  onGetCommitDiff?: (hash: string, file?: string, contextLines?: number) => Promise<string>;
}

export interface GitMergeDialogProps {
  branches: GitBranchInfo[];
  currentBranch: string;
  onMerge: (branch: string, noFf?: boolean) => Promise<string>;
}

export interface GitReflogCardProps {
  onGetReflog: (limit?: number) => Promise<GitReflogEntry[]>;
  onResetTo?: (hash: string, mode?: string) => Promise<string>;
}

export interface GitRemoteCardProps {
  remotes: GitRemoteInfo[];
  onAdd?: (name: string, url: string) => Promise<string>;
  onRemove?: (name: string) => Promise<string>;
  onRename?: (oldName: string, newName: string) => Promise<string>;
  onSetUrl?: (name: string, url: string) => Promise<string>;
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
  onSearch: (query: string, searchType?: string, limit?: number) => Promise<GitCommitEntry[]>;
  onSelectCommit?: (hash: string) => void;
}

export interface GitStashListProps {
  stashes: GitStashEntry[];
  onApply?: (stashId?: string) => Promise<string>;
  onPop?: (stashId?: string) => Promise<string>;
  onDrop?: (stashId?: string) => Promise<string>;
  onSave?: (message?: string, includeUntracked?: boolean) => Promise<string>;
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
  onGetFileStats: (file: string, limit?: number) => Promise<GitFileStatEntry[]>;
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
  aheadBehind?: { ahead: number; behind: number };
  loading?: boolean;
  onPush?: (remote?: string, branch?: string, forceLease?: boolean) => Promise<string>;
  onPull?: (remote?: string, branch?: string, rebase?: boolean) => Promise<string>;
  onFetch?: (remote?: string) => Promise<string>;
  onClean?: (directories?: boolean) => Promise<string>;
  onRefresh?: () => void;
}
