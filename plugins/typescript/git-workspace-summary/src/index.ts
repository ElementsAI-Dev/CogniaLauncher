import { cognia } from '@cognia/plugin-sdk';

type GitInput = {
  repoPath: string;
};

type GitStatusEntry = {
  status: string;
  path: string;
};

type GitCounts = {
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
  deleted: number;
  renamed: number;
};

type GitSummary = {
  ok: boolean;
  repoPath: string;
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  detachedHead?: boolean;
  counts?: GitCounts;
  stashCount?: number;
  lastCommit?: {
    shortSha: string;
    summary: string;
  };
  entries?: GitStatusEntry[];
  recommendations?: string[];
  errorCode?: string;
  message: string;
};

function git_workspace_summary(): number {
  const raw = Host.inputString();
  try {
    const input = parseInput(raw);
    const result = summarizeRepo(input.repoPath);
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    const result: GitSummary = {
      ok: false,
      repoPath: '',
      errorCode: 'INVALID_INPUT',
      message: error instanceof Error ? error.message : 'Input must be a path string or JSON object with repoPath.',
      recommendations: [
        'Provide a raw repository path string.',
        'Or provide JSON like {"repoPath":"D:/Project/CogniaLauncher"}.',
      ],
    };
    Host.outputString(JSON.stringify(result));
    return 1;
  }
}

function parseInput(raw: string): GitInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('A repository path is required.');
  }
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as { repoPath?: unknown };
    if (typeof parsed.repoPath !== 'string' || !parsed.repoPath.trim()) {
      throw new Error('JSON input must contain a non-empty repoPath string.');
    }
    return { repoPath: parsed.repoPath.trim() };
  }
  return { repoPath: trimmed };
}

function summarizeRepo(repoPath: string): GitSummary {
  const repoCheck = cognia.process.exec('git', ['rev-parse', '--is-inside-work-tree'], repoPath);
  if (repoCheck.exitCode !== 0 || repoCheck.stdout.trim() !== 'true') {
    return {
      ok: false,
      repoPath,
      errorCode: 'NOT_REPOSITORY',
      message: 'The provided path is not a Git repository.',
      recommendations: [
        'Verify the path points to a Git checkout.',
        'Ensure Git is installed and available on PATH.',
      ],
    };
  }

  const status = cognia.process.exec('git', ['status', '--short', '--branch'], repoPath);
  if (status.exitCode !== 0) {
    return {
      ok: false,
      repoPath,
      errorCode: 'GIT_STATUS_FAILED',
      message: firstLine(status.stderr) ?? 'git status failed.',
      recommendations: [
        'Ensure the repository is readable.',
        'Retry after resolving any repository-level lock or permission issues.',
      ],
    };
  }

  const parsed = parseStatusOutput(status.stdout);
  const stashCount = getStashCount(repoPath);
  const lastCommit = getLastCommit(repoPath);

  return {
    ok: true,
    repoPath,
    branch: parsed.branch,
    upstream: parsed.upstream,
    ahead: parsed.ahead,
    behind: parsed.behind,
    detachedHead: parsed.detachedHead,
    counts: parsed.counts,
    stashCount,
    lastCommit,
    entries: parsed.entries,
    recommendations: buildRecommendations(parsed.counts, parsed.behind, stashCount, parsed.detachedHead),
    message: 'Git workspace summary completed.',
  };
}

function parseStatusOutput(stdout: string): {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  detachedHead: boolean;
  counts: GitCounts;
  entries: GitStatusEntry[];
} {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const [branchLine, ...statusLines] = lines;
  const branchMeta = parseBranchLine(branchLine ?? '## HEAD');
  const entries = statusLines.map((line) => ({
    status: line.slice(0, 2),
    path: line.slice(3).trim(),
  }));

  const counts = entries.reduce<GitCounts>(
    (acc, entry) => {
      if (entry.status === '??') {
        acc.untracked += 1;
        return acc;
      }
      if (isConflictStatus(entry.status)) {
        acc.conflicted += 1;
        acc.unstaged += 1;
        return acc;
      }
      if (entry.status.includes('D')) {
        acc.deleted += 1;
      }
      if (entry.status.includes('R')) {
        acc.renamed += 1;
      }
      if (entry.status[0] && entry.status[0] !== ' ') {
        acc.staged += 1;
      }
      if (entry.status[1] && entry.status[1] !== ' ') {
        acc.unstaged += 1;
      }
      return acc;
    },
    { staged: 0, unstaged: 0, untracked: 0, conflicted: 0, deleted: 0, renamed: 0 },
  );

  return {
    ...branchMeta,
    counts,
    entries,
  };
}

function parseBranchLine(line: string): { branch: string; upstream?: string; ahead: number; behind: number; detachedHead: boolean } {
  if (/^##\s+HEAD(?:\s+\(no branch\))?/.test(line)) {
    return { branch: 'HEAD', ahead: 0, behind: 0, detachedHead: true };
  }

  const match = line.match(/^##\s+([^\s.]+)(?:\.\.\.([^\s]+))?(?:\s+\[(.*)\])?$/);
  if (!match) {
    return { branch: 'HEAD', ahead: 0, behind: 0, detachedHead: true };
  }

  const divergence = match[3] ?? '';
  const aheadMatch = divergence.match(/ahead (\d+)/);
  const behindMatch = divergence.match(/behind (\d+)/);

  return {
    branch: match[1],
    upstream: match[2],
    ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
    behind: behindMatch ? Number(behindMatch[1]) : 0,
    detachedHead: false,
  };
}

function buildRecommendations(
  counts: GitCounts,
  behind: number,
  stashCount = 0,
  detachedHead = false,
): string[] {
  const items: string[] = [];
  if (behind > 0) {
    items.push(`Repository is behind its upstream by ${behind} commit(s). Consider pulling before release work.`);
  }
  if (counts.conflicted > 0) {
    items.push(`Repository has ${counts.conflicted} conflicted file(s); resolve merge conflicts before packaging or release work.`);
  }
  if (counts.deleted > 0) {
    items.push(`Repository has ${counts.deleted} deleted file(s); confirm deletions are intentional before release work.`);
  }
  if (counts.renamed > 0) {
    items.push(`Repository has ${counts.renamed} renamed file(s); verify downstream tooling tracks the new paths.`);
  }
  if (counts.untracked > 0) {
    items.push('Review untracked files before packaging or release operations.');
  }
  if (stashCount > 0) {
    items.push(`Repository has ${stashCount} stash entrie(s); review whether any unfinished work should be restored or dropped.`);
  }
  if (detachedHead) {
    items.push('Repository is in detached HEAD state; confirm you are working on the intended commit before release work.');
  }
  if (counts.staged === 0
    && counts.unstaged === 0
    && counts.untracked === 0
    && counts.conflicted === 0
    && stashCount === 0) {
    items.push('Working tree is clean.');
  }
  return items;
}

function isConflictStatus(status: string): boolean {
  return ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(status);
}

function getStashCount(repoPath: string): number {
  const stash = cognia.process.exec('git', ['rev-list', '--walk-reflogs', '--count', 'refs/stash'], repoPath);
  if (stash.exitCode !== 0) {
    return 0;
  }
  const parsed = Number(firstLine(stash.stdout) ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLastCommit(repoPath: string): { shortSha: string; summary: string } | undefined {
  const commit = cognia.process.exec('git', ['log', '-1', '--pretty=format:%h%n%s'], repoPath);
  if (commit.exitCode !== 0) {
    return undefined;
  }
  const lines = commit.stdout.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }
  return {
    shortSha: lines[0],
    summary: lines[1] ?? '',
  };
}

function firstLine(value: string): string | null {
  return value.split(/\r?\n/).map((item) => item.trim()).find(Boolean) ?? null;
}

declare const module: { exports: unknown };

module.exports = {
  git_workspace_summary,
  __test: {
    parseInput,
    summarizeRepo,
    parseBranchLine,
    parseStatusOutput,
    buildRecommendations,
  },
};
