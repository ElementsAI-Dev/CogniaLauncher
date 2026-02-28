/**
 * Pure utility functions for Git components.
 * Extracted from components/git/*.tsx for proper layer separation.
 */

import { AUTHOR_COLORS } from '@/lib/constants/git';
import type { GitGraphEntry } from '@/types/tauri';
import type {
  DiffChange,
  DiffFileDiff,
  DiffHunk,
  LaneAssignment,
  ParsedDiff,
  ParsedDiffLine,
} from '@/types/git';

// ---------------------------------------------------------------------------
// Activity Heatmap
// ---------------------------------------------------------------------------

/**
 * Return a CSS color string for a heatmap cell based on commit count.
 */
export function getHeatColor(count: number, maxCount: number): string {
  if (count === 0) return 'var(--muted)';
  const ratio = count / Math.max(maxCount, 1);
  if (ratio > 0.75) return '#166534';
  if (ratio > 0.5) return '#16a34a';
  if (ratio > 0.25) return '#4ade80';
  return '#bbf7d0';
}

// ---------------------------------------------------------------------------
// Blame View
// ---------------------------------------------------------------------------

/**
 * Return a Tailwind background class for an author color band.
 */
export function getAuthorColor(authorIndex: number): string {
  return AUTHOR_COLORS[authorIndex % AUTHOR_COLORS.length];
}

/**
 * Return a Tailwind background class representing the age of a blame line.
 */
export function getHeatmapColor(timestamp: number, minTs: number, maxTs: number): string {
  if (maxTs === minTs) return 'bg-blue-400/30';
  const ratio = (timestamp - minTs) / (maxTs - minTs);
  if (ratio > 0.8) return 'bg-red-400/40';
  if (ratio > 0.6) return 'bg-orange-400/35';
  if (ratio > 0.4) return 'bg-yellow-400/30';
  if (ratio > 0.2) return 'bg-green-400/25';
  return 'bg-blue-400/20';
}

// ---------------------------------------------------------------------------
// Commit Graph — Lane assignment algorithm
// ---------------------------------------------------------------------------

/**
 * Assign visual lanes to commit graph entries for rendering.
 *
 * Uses a Set for O(1) parent-in-lane checks, prefers nearest free lane for
 * secondary parents to reduce crossing, and compacts trailing empty lanes.
 */
export function assignLanes(entries: GitGraphEntry[]): Map<string, LaneAssignment> {
  const assignments = new Map<string, LaneAssignment>();
  const activeLanes: (string | null)[] = [];
  const activeLaneSet = new Set<string>();
  let maxLane = 0;

  for (const entry of entries) {
    let lane = activeLanes.indexOf(entry.hash);
    if (lane === -1) {
      lane = activeLanes.indexOf(null);
      if (lane === -1) {
        lane = activeLanes.length;
        activeLanes.push(entry.hash);
      } else {
        activeLanes[lane] = entry.hash;
      }
    }

    activeLaneSet.delete(entry.hash);
    activeLanes[lane] = null;

    for (let i = 0; i < entry.parents.length; i++) {
      const parent = entry.parents[i];
      if (activeLaneSet.has(parent)) continue;

      if (i === 0 && activeLanes[lane] === null) {
        activeLanes[lane] = parent;
        activeLaneSet.add(parent);
      } else {
        // Prefer the nearest free lane to reduce edge crossings
        let bestFree = -1;
        let bestDist = Infinity;
        for (let j = 0; j < activeLanes.length; j++) {
          if (activeLanes[j] === null) {
            const dist = Math.abs(j - lane);
            if (dist < bestDist) {
              bestDist = dist;
              bestFree = j;
            }
          }
        }
        if (bestFree === -1) {
          bestFree = activeLanes.length;
          activeLanes.push(parent);
        } else {
          activeLanes[bestFree] = parent;
        }
        activeLaneSet.add(parent);
      }
    }

    // Tail compaction: trim trailing null lanes
    while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
      activeLanes.pop();
    }

    if (lane > maxLane) maxLane = lane;
    assignments.set(entry.hash, { lane, maxLane });
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Diff Viewer
// ---------------------------------------------------------------------------

/**
 * Parse a single line of unified diff output into a typed object.
 */
export function parseDiffLine(line: string): ParsedDiffLine {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return { type: 'add', content: line };
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return { type: 'del', content: line };
  }
  if (line.startsWith('@@')) {
    return { type: 'hunk', content: line };
  }
  if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
    return { type: 'meta', content: line };
  }
  return { type: 'ctx', content: line };
}

// ---------------------------------------------------------------------------
// Structured Diff Parser
// ---------------------------------------------------------------------------

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse a hunk header like "@@ -10,7 +10,8 @@ function foo" into range info.
 */
export function parseHunkHeader(header: string): Pick<DiffHunk, 'oldStart' | 'oldLines' | 'newStart' | 'newLines'> | null {
  const m = HUNK_RE.exec(header);
  if (!m) return null;
  return {
    oldStart: parseInt(m[1], 10),
    oldLines: m[2] !== undefined ? parseInt(m[2], 10) : 1,
    newStart: parseInt(m[3], 10),
    newLines: m[4] !== undefined ? parseInt(m[4], 10) : 1,
  };
}

/**
 * Extract a file path from a "--- a/path" or "+++ b/path" line.
 */
function extractPath(line: string): string {
  const stripped = line.slice(4); // skip "--- " or "+++ "
  if (stripped === '/dev/null') return '/dev/null';
  // Strip "a/" or "b/" prefix
  if (stripped.startsWith('a/') || stripped.startsWith('b/')) return stripped.slice(2);
  return stripped;
}

/**
 * Parse raw unified diff text into structured file/hunk/change objects.
 */
export function parseUnifiedDiff(raw: string): ParsedDiff {
  const files: DiffFileDiff[] = [];
  const lines = raw.split('\n');
  let i = 0;

  while (i < lines.length) {
    // Look for "diff --git" header
    if (!lines[i].startsWith('diff --git')) {
      i++;
      continue;
    }

    const file: DiffFileDiff = {
      oldName: '',
      newName: '',
      isBinary: false,
      isRenamed: false,
      isNew: false,
      isDeleted: false,
      hunks: [],
      stats: { additions: 0, deletions: 0 },
    };

    // Parse "diff --git a/path b/path"
    const gitLine = lines[i];
    const gitMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(gitLine);
    if (gitMatch) {
      file.oldName = gitMatch[1];
      file.newName = gitMatch[2];
    }
    i++;

    // Parse meta lines before hunks
    while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff --git')) {
      const line = lines[i];
      if (line.startsWith('Binary files')) {
        file.isBinary = true;
      } else if (line.startsWith('rename from ')) {
        file.isRenamed = true;
      } else if (line.startsWith('new file mode')) {
        file.isNew = true;
      } else if (line.startsWith('deleted file mode')) {
        file.isDeleted = true;
      } else if (line.startsWith('--- ')) {
        const p = extractPath(line);
        if (p === '/dev/null') file.isNew = true;
        else file.oldName = p;
      } else if (line.startsWith('+++ ')) {
        const p = extractPath(line);
        if (p === '/dev/null') file.isDeleted = true;
        else file.newName = p;
      }
      i++;
    }

    // Parse hunks
    while (i < lines.length && !lines[i].startsWith('diff --git')) {
      if (!lines[i].startsWith('@@')) {
        i++;
        continue;
      }

      const headerInfo = parseHunkHeader(lines[i]);
      if (!headerInfo) { i++; continue; }

      const hunk: DiffHunk = {
        header: lines[i],
        ...headerInfo,
        changes: [],
      };
      i++;

      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;

      while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff --git')) {
        const line = lines[i];
        if (line.startsWith('+')) {
          hunk.changes.push({ type: 'add', content: line.slice(1), newLineNo: newLine });
          file.stats.additions++;
          newLine++;
        } else if (line.startsWith('-')) {
          hunk.changes.push({ type: 'del', content: line.slice(1), oldLineNo: oldLine });
          file.stats.deletions++;
          oldLine++;
        } else {
          // Context line (starts with ' ') or empty line
          const content = line.startsWith(' ') ? line.slice(1) : line;
          hunk.changes.push({ type: 'ctx', content, oldLineNo: oldLine, newLineNo: newLine });
          oldLine++;
          newLine++;
        }
        i++;
      }

      file.hunks.push(hunk);
    }

    files.push(file);
  }

  const totalAdditions = files.reduce((s, f) => s + f.stats.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.stats.deletions, 0);

  return {
    files,
    stats: { filesChanged: files.length, additions: totalAdditions, deletions: totalDeletions },
  };
}

// ---------------------------------------------------------------------------
// Word-level diff
// ---------------------------------------------------------------------------

export interface WordDiffSegment {
  type: 'equal' | 'add' | 'del';
  value: string;
}

/**
 * Compute word-level diff between two strings.
 * Returns segments with type equal/add/del for fine-grained highlighting.
 */
export function computeWordDiff(oldStr: string, newStr: string): WordDiffSegment[] {
  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);
  const segments: WordDiffSegment[] = [];

  // Simple LCS-based word diff using a DP approach
  const m = oldWords.length;
  const n = newWords.length;

  // For performance, if strings are identical just return equal
  if (oldStr === newStr) return [{ type: 'equal', value: oldStr }];

  // Build edit script using Myers-like approach (simplified)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce segments
  let oi = m, ni = n;
  const ops: WordDiffSegment[] = [];
  while (oi > 0 || ni > 0) {
    if (oi > 0 && ni > 0 && oldWords[oi - 1] === newWords[ni - 1]) {
      ops.push({ type: 'equal', value: oldWords[oi - 1] });
      oi--; ni--;
    } else if (ni > 0 && (oi === 0 || dp[oi][ni - 1] >= dp[oi - 1][ni])) {
      ops.push({ type: 'add', value: newWords[ni - 1] });
      ni--;
    } else {
      ops.push({ type: 'del', value: oldWords[oi - 1] });
      oi--;
    }
  }

  ops.reverse();

  // Merge consecutive segments of the same type
  for (const op of ops) {
    if (segments.length > 0 && segments[segments.length - 1].type === op.type) {
      segments[segments.length - 1].value += op.value;
    } else {
      segments.push({ ...op });
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Split view line pairing
// ---------------------------------------------------------------------------

export interface SplitLine {
  left?: DiffChange;
  right?: DiffChange;
}

/**
 * Pair changes for side-by-side display.
 * Context lines appear on both sides, del on left, add on right.
 * Adjacent del+add blocks are paired row-by-row.
 */
export function pairChangesForSplit(changes: DiffChange[]): SplitLine[] {
  const result: SplitLine[] = [];
  let i = 0;

  while (i < changes.length) {
    const change = changes[i];

    if (change.type === 'ctx') {
      result.push({ left: change, right: change });
      i++;
    } else if (change.type === 'del') {
      // Collect consecutive del block
      const dels: DiffChange[] = [];
      while (i < changes.length && changes[i].type === 'del') {
        dels.push(changes[i]);
        i++;
      }
      // Collect consecutive add block
      const adds: DiffChange[] = [];
      while (i < changes.length && changes[i].type === 'add') {
        adds.push(changes[i]);
        i++;
      }
      // Pair them row-by-row
      const maxLen = Math.max(dels.length, adds.length);
      for (let j = 0; j < maxLen; j++) {
        result.push({
          left: j < dels.length ? dels[j] : undefined,
          right: j < adds.length ? adds[j] : undefined,
        });
      }
    } else {
      // Standalone add (no preceding del)
      result.push({ left: undefined, right: change });
      i++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Status Files
// ---------------------------------------------------------------------------

/**
 * Return a human-readable label for a git file status pair.
 */
export function getStatusLabel(indexStatus: string, worktreeStatus: string): string {
  if (indexStatus === '?' && worktreeStatus === '?') return 'Untracked';
  if (indexStatus === 'A') return 'Added';
  if (indexStatus === 'D' || worktreeStatus === 'D') return 'Deleted';
  if (indexStatus === 'R') return 'Renamed';
  if (indexStatus === 'M' || worktreeStatus === 'M') return 'Modified';
  if (indexStatus === 'C') return 'Copied';
  return `${indexStatus}${worktreeStatus}`.trim();
}

/**
 * Return a Tailwind text color class for a git file status pair.
 */
export function getStatusColor(indexStatus: string, worktreeStatus: string): string {
  if (indexStatus === '?' && worktreeStatus === '?') return 'text-muted-foreground';
  if (indexStatus === 'A') return 'text-green-600';
  if (indexStatus === 'D' || worktreeStatus === 'D') return 'text-red-600';
  return 'text-yellow-600';
}
