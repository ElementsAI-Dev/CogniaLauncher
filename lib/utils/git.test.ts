import {
  getHeatColor,
  getAuthorColor,
  getHeatmapColor,
  assignLanes,
  parseDiffLine,
  getStatusLabel,
  getStatusColor,
} from './git';
import type { GitGraphEntry } from '@/types/tauri';

// ---------------------------------------------------------------------------
// getHeatColor
// ---------------------------------------------------------------------------

describe('getHeatColor', () => {
  it('returns muted for zero count', () => {
    expect(getHeatColor(0, 10)).toBe('var(--muted)');
  });

  it('returns lightest green for low ratio', () => {
    expect(getHeatColor(1, 10)).toBe('#bbf7d0');
  });

  it('returns medium green for mid ratio', () => {
    expect(getHeatColor(4, 10)).toBe('#4ade80');
  });

  it('returns darker green for high ratio', () => {
    expect(getHeatColor(6, 10)).toBe('#16a34a');
  });

  it('returns darkest green for highest ratio', () => {
    expect(getHeatColor(8, 10)).toBe('#166534');
  });

  it('handles maxCount of 0 gracefully', () => {
    expect(getHeatColor(0, 0)).toBe('var(--muted)');
  });
});

// ---------------------------------------------------------------------------
// getAuthorColor
// ---------------------------------------------------------------------------

describe('getAuthorColor', () => {
  it('returns first color for index 0', () => {
    expect(getAuthorColor(0)).toBe('bg-blue-500');
  });

  it('wraps around for large index', () => {
    expect(getAuthorColor(12)).toBe('bg-blue-500');
  });

  it('returns correct color for mid index', () => {
    expect(getAuthorColor(3)).toBe('bg-orange-500');
  });
});

// ---------------------------------------------------------------------------
// getHeatmapColor
// ---------------------------------------------------------------------------

describe('getHeatmapColor', () => {
  it('returns blue for equal timestamps', () => {
    expect(getHeatmapColor(100, 100, 100)).toBe('bg-blue-400/30');
  });

  it('returns blue for oldest entries', () => {
    expect(getHeatmapColor(0, 0, 100)).toBe('bg-blue-400/20');
  });

  it('returns red for newest entries', () => {
    expect(getHeatmapColor(90, 0, 100)).toBe('bg-red-400/40');
  });

  it('returns orange for moderately recent entries', () => {
    expect(getHeatmapColor(70, 0, 100)).toBe('bg-orange-400/35');
  });

  it('returns yellow for mid-age entries', () => {
    expect(getHeatmapColor(50, 0, 100)).toBe('bg-yellow-400/30');
  });

  it('returns green for older entries', () => {
    expect(getHeatmapColor(30, 0, 100)).toBe('bg-green-400/25');
  });
});

// ---------------------------------------------------------------------------
// assignLanes
// ---------------------------------------------------------------------------

describe('assignLanes', () => {
  it('returns empty map for empty entries', () => {
    expect(assignLanes([])).toEqual(new Map());
  });

  it('assigns lane 0 to a single commit', () => {
    const entries: GitGraphEntry[] = [
      { hash: 'a', parents: [], refs: [], authorName: 'A', date: '2025-01-01', message: 'init' },
    ];
    const result = assignLanes(entries);
    expect(result.get('a')?.lane).toBe(0);
  });

  it('assigns sequential lanes for linear history', () => {
    const entries: GitGraphEntry[] = [
      { hash: 'b', parents: ['a'], refs: [], authorName: 'A', date: '2025-01-02', message: 'second' },
      { hash: 'a', parents: [], refs: [], authorName: 'A', date: '2025-01-01', message: 'first' },
    ];
    const result = assignLanes(entries);
    expect(result.get('b')?.lane).toBe(0);
    expect(result.get('a')?.lane).toBe(0);
  });

  it('assigns different lanes for merge commits', () => {
    const entries: GitGraphEntry[] = [
      { hash: 'c', parents: ['a', 'b'], refs: [], authorName: 'A', date: '2025-01-03', message: 'merge' },
      { hash: 'b', parents: ['root'], refs: [], authorName: 'A', date: '2025-01-02', message: 'branch' },
      { hash: 'a', parents: ['root'], refs: [], authorName: 'A', date: '2025-01-01', message: 'main' },
    ];
    const result = assignLanes(entries);
    expect(result.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// parseDiffLine
// ---------------------------------------------------------------------------

describe('parseDiffLine', () => {
  it('detects addition lines', () => {
    expect(parseDiffLine('+new line')).toEqual({ type: 'add', content: '+new line' });
  });

  it('detects deletion lines', () => {
    expect(parseDiffLine('-old line')).toEqual({ type: 'del', content: '-old line' });
  });

  it('detects hunk headers', () => {
    expect(parseDiffLine('@@ -1,3 +1,4 @@')).toEqual({ type: 'hunk', content: '@@ -1,3 +1,4 @@' });
  });

  it('detects meta lines (diff --git)', () => {
    expect(parseDiffLine('diff --git a/f b/f')).toEqual({ type: 'meta', content: 'diff --git a/f b/f' });
  });

  it('detects meta lines (---)', () => {
    expect(parseDiffLine('--- a/file.ts')).toEqual({ type: 'meta', content: '--- a/file.ts' });
  });

  it('detects meta lines (+++)', () => {
    expect(parseDiffLine('+++ b/file.ts')).toEqual({ type: 'meta', content: '+++ b/file.ts' });
  });

  it('detects meta lines (index)', () => {
    expect(parseDiffLine('index abc..def 100644')).toEqual({ type: 'meta', content: 'index abc..def 100644' });
  });

  it('returns context for plain lines', () => {
    expect(parseDiffLine(' unchanged line')).toEqual({ type: 'ctx', content: ' unchanged line' });
  });

  it('returns context for empty string', () => {
    expect(parseDiffLine('')).toEqual({ type: 'ctx', content: '' });
  });
});

// ---------------------------------------------------------------------------
// getStatusLabel
// ---------------------------------------------------------------------------

describe('getStatusLabel', () => {
  it('returns Untracked for ??', () => {
    expect(getStatusLabel('?', '?')).toBe('Untracked');
  });

  it('returns Added for A index', () => {
    expect(getStatusLabel('A', ' ')).toBe('Added');
  });

  it('returns Deleted for D index', () => {
    expect(getStatusLabel('D', ' ')).toBe('Deleted');
  });

  it('returns Deleted for D worktree', () => {
    expect(getStatusLabel(' ', 'D')).toBe('Deleted');
  });

  it('returns Renamed for R index', () => {
    expect(getStatusLabel('R', ' ')).toBe('Renamed');
  });

  it('returns Modified for M index', () => {
    expect(getStatusLabel('M', ' ')).toBe('Modified');
  });

  it('returns Modified for M worktree', () => {
    expect(getStatusLabel(' ', 'M')).toBe('Modified');
  });

  it('returns Copied for C index', () => {
    expect(getStatusLabel('C', ' ')).toBe('Copied');
  });

  it('returns raw status for unknown combo', () => {
    expect(getStatusLabel('U', 'U')).toBe('UU');
  });
});

// ---------------------------------------------------------------------------
// getStatusColor
// ---------------------------------------------------------------------------

describe('getStatusColor', () => {
  it('returns muted for untracked', () => {
    expect(getStatusColor('?', '?')).toBe('text-muted-foreground');
  });

  it('returns green for added', () => {
    expect(getStatusColor('A', ' ')).toBe('text-green-600');
  });

  it('returns red for deleted index', () => {
    expect(getStatusColor('D', ' ')).toBe('text-red-600');
  });

  it('returns red for deleted worktree', () => {
    expect(getStatusColor(' ', 'D')).toBe('text-red-600');
  });

  it('returns yellow for modified', () => {
    expect(getStatusColor('M', ' ')).toBe('text-yellow-600');
  });
});
