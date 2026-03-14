/**
 * Git repository operations module.
 *
 * Provides read-only access to Git repository information such as
 * status, branches, commits, diffs, and contributors.
 * Limited write operations: stage files, commit.
 *
 * Requires: `git_read` and/or `git_write` permissions.
 */
import { callHostJson } from './host';
import type {
  GitRepoInfo,
  GitStatus,
  GitBranch,
  GitTag,
  GitCommit,
  GitCommitDetail,
  GitBlameEntry,
  GitRemote,
  GitStash,
  GitContributor,
  GitAheadBehind,
} from './types';

/** Check if git is available on the system. Requires: git_read */
export function isAvailable(): boolean {
  return callHostJson<boolean>('cognia_git_is_available', '');
}

/** Get git version string. Requires: git_read */
export function getVersion(): string {
  return callHostJson<string>('cognia_git_get_version', '');
}

/** Get repository information. Requires: git_read */
export function getRepoInfo(path: string): GitRepoInfo {
  return callHostJson<GitRepoInfo>(
    'cognia_git_get_repo_info',
    JSON.stringify({ path }),
  );
}

/** Get repository working tree status. Requires: git_read */
export function getStatus(path: string): GitStatus {
  return callHostJson<GitStatus>(
    'cognia_git_get_status',
    JSON.stringify({ path }),
  );
}

/** List branches. Requires: git_read */
export function getBranches(path: string): GitBranch[] {
  return callHostJson<GitBranch[]>(
    'cognia_git_get_branches',
    JSON.stringify({ path }),
  );
}

/** Get the current branch name. Requires: git_read */
export function getCurrentBranch(path: string): string | null {
  return callHostJson<string | null>(
    'cognia_git_get_current_branch',
    JSON.stringify({ path }),
  );
}

/** List tags. Requires: git_read */
export function getTags(path: string): GitTag[] {
  return callHostJson<GitTag[]>(
    'cognia_git_get_tags',
    JSON.stringify({ path }),
  );
}

/** Get commit history. Requires: git_read */
export function getLog(path: string, limit?: number, branch?: string): GitCommit[] {
  return callHostJson<GitCommit[]>(
    'cognia_git_get_log',
    JSON.stringify({ path, limit: limit ?? null, branch: branch ?? null }),
  );
}

/** Get detailed commit information. Requires: git_read */
export function getCommitDetail(path: string, hash: string): GitCommitDetail {
  return callHostJson<GitCommitDetail>(
    'cognia_git_get_commit_detail',
    JSON.stringify({ path, hash }),
  );
}

/** Get blame information for a file. Requires: git_read */
export function getBlame(path: string, file: string): GitBlameEntry[] {
  return callHostJson<GitBlameEntry[]>(
    'cognia_git_get_blame',
    JSON.stringify({ path, file }),
  );
}

/** Get working tree diff. Requires: git_read */
export function getDiff(path: string): string {
  return callHostJson<string>(
    'cognia_git_get_diff',
    JSON.stringify({ path }),
  );
}

/** Get diff between two revisions. Requires: git_read */
export function getDiffBetween(path: string, from: string, to: string): string {
  return callHostJson<string>(
    'cognia_git_get_diff_between',
    JSON.stringify({ path, from, to }),
  );
}

/** List remote repositories. Requires: git_read */
export function getRemotes(path: string): GitRemote[] {
  return callHostJson<GitRemote[]>(
    'cognia_git_get_remotes',
    JSON.stringify({ path }),
  );
}

/** List stashed changes. Requires: git_read */
export function getStashes(path: string): GitStash[] {
  return callHostJson<GitStash[]>(
    'cognia_git_get_stashes',
    JSON.stringify({ path }),
  );
}

/** Get repository contributors. Requires: git_read */
export function getContributors(path: string): GitContributor[] {
  return callHostJson<GitContributor[]>(
    'cognia_git_get_contributors',
    JSON.stringify({ path }),
  );
}

/** Search commits by query. Requires: git_read */
export function searchCommits(path: string, query: string): GitCommit[] {
  return callHostJson<GitCommit[]>(
    'cognia_git_search_commits',
    JSON.stringify({ path, query }),
  );
}

/** Get file commit history. Requires: git_read */
export function getFileHistory(path: string, file: string): GitCommit[] {
  return callHostJson<GitCommit[]>(
    'cognia_git_get_file_history',
    JSON.stringify({ path, file }),
  );
}

/** Get ahead/behind count relative to upstream. Requires: git_read */
export function getAheadBehind(path: string, branch?: string): GitAheadBehind {
  return callHostJson<GitAheadBehind>(
    'cognia_git_get_ahead_behind',
    JSON.stringify({ path, branch: branch ?? null }),
  );
}

/** Stage specific files. Requires: git_write */
export function stageFiles(path: string, files: string[]): void {
  callHostJson<{ ok: boolean }>(
    'cognia_git_stage_files',
    JSON.stringify({ path, files }),
  );
}

/** Create a commit. Requires: git_write */
export function commit(path: string, message: string): string {
  return callHostJson<string>(
    'cognia_git_commit',
    JSON.stringify({ path, message }),
  );
}
