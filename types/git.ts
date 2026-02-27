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
}

export interface GitCloneDialogProps {
  onClone: (url: string, destPath: string, options?: GitCloneOptions) => Promise<string>;
  onExtractRepoName?: (url: string) => Promise<string | null>;
  onValidateUrl?: (url: string) => Promise<boolean>;
  onOpenRepo?: (path: string) => void;
}

export interface GitCommitDetailProps {
  hash: string | null;
  detail: GitCommitDetail | null;
  loading: boolean;
  onClose: () => void;
}

export interface GitCommitDialogProps {
  stagedCount: number;
  onCommit: (message: string, amend?: boolean) => Promise<string>;
  disabled?: boolean;
}

export interface GitCommitGraphProps {
  onLoadGraph: (limit?: number, allBranches?: boolean) => Promise<GitGraphEntry[]>;
  onSelectCommit?: (hash: string) => void;
  selectedHash?: string | null;
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
}

export interface GitContributorsChartProps {
  contributors: GitContributor[];
}

export interface GitDiffViewerProps {
  diff: string;
  loading?: boolean;
  title?: string;
}

export interface GitFileHistoryProps {
  repoPath: string | null;
  onGetHistory: (file: string, limit?: number) => Promise<GitCommitEntry[]>;
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
}

export interface GitRepoInfoCardProps {
  repoInfo: GitRepoInfo;
}

export interface GitRepoSelectorProps {
  repoPath: string | null;
  onSelect: (path: string) => Promise<void>;
  loading: boolean;
}

export interface GitSearchCommitsProps {
  onSearch: (query: string, searchType?: string, limit?: number) => Promise<GitCommitEntry[]>;
  onSelectCommit?: (hash: string) => void;
}

export interface GitStashListProps {
  stashes: GitStashEntry[];
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
}

export interface GitTagListProps {
  tags: GitTagInfo[];
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
