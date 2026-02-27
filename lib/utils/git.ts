/**
 * Pure utility functions for Git components.
 * Extracted from components/git/*.tsx for proper layer separation.
 */

import { AUTHOR_COLORS } from '@/lib/constants/git';
import type { GitGraphEntry } from '@/types/tauri';
import type { LaneAssignment, ParsedDiffLine } from '@/types/git';

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
 */
export function assignLanes(entries: GitGraphEntry[]): Map<string, LaneAssignment> {
  const assignments = new Map<string, LaneAssignment>();
  const activeLanes: (string | null)[] = [];
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

    activeLanes[lane] = null;

    for (let i = 0; i < entry.parents.length; i++) {
      const parent = entry.parents[i];
      if (!activeLanes.includes(parent)) {
        if (i === 0 && activeLanes[lane] === null) {
          activeLanes[lane] = parent;
        } else {
          let freeLane = activeLanes.indexOf(null);
          if (freeLane === -1) {
            freeLane = activeLanes.length;
            activeLanes.push(parent);
          } else {
            activeLanes[freeLane] = parent;
          }
        }
      }
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
