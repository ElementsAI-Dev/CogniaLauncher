import {
  getHeatColor,
  getAuthorColor,
  getHeatmapColor,
  assignLanes,
  parseDiffLine,
  parseHunkHeader,
  parseUnifiedDiff,
  computeWordDiff,
  pairChangesForSplit,
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

  it('reuses lanes after merge (lane compaction)', () => {
    // main: d(merge) -> a -> root, branch: b -> root
    const entries: GitGraphEntry[] = [
      { hash: 'd', parents: ['a', 'b'], refs: [], authorName: 'A', date: '4', message: 'merge' },
      { hash: 'a', parents: ['root'], refs: [], authorName: 'A', date: '3', message: 'main-1' },
      { hash: 'b', parents: ['root'], refs: [], authorName: 'A', date: '2', message: 'branch-1' },
      { hash: 'root', parents: [], refs: [], authorName: 'A', date: '1', message: 'root' },
    ];
    const result = assignLanes(entries);
    expect(result.get('d')?.lane).toBe(0);
    // After merge, freed lanes should be reusable — root should get a low lane
    expect(result.get('root')?.lane).toBeLessThanOrEqual(1);
  });

  it('handles parallel branches with separate merge points', () => {
    // Two branches merge independently: m1 merges a+b, m2 merges c+d
    const entries: GitGraphEntry[] = [
      { hash: 'm2', parents: ['c', 'd'], refs: [], authorName: 'A', date: '6', message: 'merge2' },
      { hash: 'm1', parents: ['a', 'b'], refs: [], authorName: 'A', date: '5', message: 'merge1' },
      { hash: 'd', parents: ['root'], refs: [], authorName: 'A', date: '4', message: 'branch-d' },
      { hash: 'c', parents: ['root'], refs: [], authorName: 'A', date: '3', message: 'branch-c' },
      { hash: 'b', parents: ['root'], refs: [], authorName: 'A', date: '2', message: 'branch-b' },
      { hash: 'a', parents: ['root'], refs: [], authorName: 'A', date: '1', message: 'branch-a' },
    ];
    const result = assignLanes(entries);
    expect(result.size).toBe(6);
    // All entries should have non-negative lane assignments
    for (const [, a] of result) {
      expect(a.lane).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles octopus merge (3+ parents)', () => {
    const entries: GitGraphEntry[] = [
      { hash: 'oct', parents: ['a', 'b', 'c'], refs: [], authorName: 'A', date: '4', message: 'octopus' },
      { hash: 'c', parents: ['root'], refs: [], authorName: 'A', date: '3', message: 'c' },
      { hash: 'b', parents: ['root'], refs: [], authorName: 'A', date: '2', message: 'b' },
      { hash: 'a', parents: ['root'], refs: [], authorName: 'A', date: '1', message: 'a' },
    ];
    const result = assignLanes(entries);
    expect(result.size).toBe(4);
    // Parents should be on different lanes
    const lanes = new Set([result.get('a')?.lane, result.get('b')?.lane, result.get('c')?.lane]);
    expect(lanes.size).toBeGreaterThanOrEqual(2);
  });

  it('handles disconnected graph (no common ancestor)', () => {
    const entries: GitGraphEntry[] = [
      { hash: 'b2', parents: ['b1'], refs: [], authorName: 'A', date: '4', message: 'b2' },
      { hash: 'a2', parents: ['a1'], refs: [], authorName: 'A', date: '3', message: 'a2' },
      { hash: 'b1', parents: [], refs: [], authorName: 'A', date: '2', message: 'b1' },
      { hash: 'a1', parents: [], refs: [], authorName: 'A', date: '1', message: 'a1' },
    ];
    const result = assignLanes(entries);
    expect(result.size).toBe(4);
  });

  it('handles long linear chain efficiently', () => {
    const entries: GitGraphEntry[] = Array.from({ length: 50 }, (_, i) => ({
      hash: `h${i}`,
      parents: i < 49 ? [`h${i + 1}`] : [],
      refs: [],
      authorName: 'A',
      date: String(50 - i),
      message: `commit ${i}`,
    }));
    const result = assignLanes(entries);
    // All commits in a linear chain should stay on lane 0
    for (const [, a] of result) {
      expect(a.lane).toBe(0);
    }
  });

  it('maxLane tracks highest lane seen so far', () => {
    const entries: GitGraphEntry[] = [
      { hash: 'c', parents: ['a', 'b'], refs: [], authorName: 'A', date: '3', message: 'merge' },
      { hash: 'b', parents: ['root'], refs: [], authorName: 'A', date: '2', message: 'branch' },
      { hash: 'a', parents: ['root'], refs: [], authorName: 'A', date: '1', message: 'main' },
    ];
    const result = assignLanes(entries);
    const firstEntry = result.get('c');
    expect(firstEntry?.maxLane).toBeGreaterThanOrEqual(firstEntry?.lane ?? 0);
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

// ---------------------------------------------------------------------------
// parseHunkHeader
// ---------------------------------------------------------------------------

describe('parseHunkHeader', () => {
  it('parses standard hunk header', () => {
    expect(parseHunkHeader('@@ -1,3 +1,4 @@')).toEqual({
      oldStart: 1, oldLines: 3, newStart: 1, newLines: 4,
    });
  });

  it('parses hunk header with context text', () => {
    expect(parseHunkHeader('@@ -10,7 +10,8 @@ function foo()')).toEqual({
      oldStart: 10, oldLines: 7, newStart: 10, newLines: 8,
    });
  });

  it('parses single-line hunk (no comma)', () => {
    expect(parseHunkHeader('@@ -5 +5 @@')).toEqual({
      oldStart: 5, oldLines: 1, newStart: 5, newLines: 1,
    });
  });

  it('returns null for non-hunk strings', () => {
    expect(parseHunkHeader('not a hunk')).toBeNull();
  });

  it('parses hunk with zero lines', () => {
    expect(parseHunkHeader('@@ -0,0 +1,3 @@')).toEqual({
      oldStart: 0, oldLines: 0, newStart: 1, newLines: 3,
    });
  });
});

// ---------------------------------------------------------------------------
// parseUnifiedDiff
// ---------------------------------------------------------------------------

describe('parseUnifiedDiff', () => {
  const singleFileDiff = [
    'diff --git a/file.ts b/file.ts',
    '--- a/file.ts',
    '+++ b/file.ts',
    '@@ -1,3 +1,4 @@',
    ' context',
    '-old line',
    '+new line',
    '+extra line',
    ' more context',
  ].join('\n');

  it('parses a single file diff', () => {
    const result = parseUnifiedDiff(singleFileDiff);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].oldName).toBe('file.ts');
    expect(result.files[0].newName).toBe('file.ts');
  });

  it('computes correct stats', () => {
    const result = parseUnifiedDiff(singleFileDiff);
    expect(result.stats).toEqual({ filesChanged: 1, additions: 2, deletions: 1 });
    expect(result.files[0].stats).toEqual({ additions: 2, deletions: 1 });
  });

  it('assigns correct line numbers', () => {
    const result = parseUnifiedDiff(singleFileDiff);
    const changes = result.files[0].hunks[0].changes;
    // Context: old=1, new=1
    expect(changes[0]).toMatchObject({ type: 'ctx', oldLineNo: 1, newLineNo: 1 });
    // Del: old=2
    expect(changes[1]).toMatchObject({ type: 'del', oldLineNo: 2 });
    // Add: new=2
    expect(changes[2]).toMatchObject({ type: 'add', newLineNo: 2 });
    // Add: new=3
    expect(changes[3]).toMatchObject({ type: 'add', newLineNo: 3 });
    // Context: old=3, new=4
    expect(changes[4]).toMatchObject({ type: 'ctx', oldLineNo: 3, newLineNo: 4 });
  });

  it('parses multiple files', () => {
    const multiDiff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1,1 +1,1 @@',
      '-old a',
      '+new a',
      'diff --git a/b.ts b/b.ts',
      '--- a/b.ts',
      '+++ b/b.ts',
      '@@ -1,1 +1,1 @@',
      '-old b',
      '+new b',
    ].join('\n');
    const result = parseUnifiedDiff(multiDiff);
    expect(result.files).toHaveLength(2);
    expect(result.stats.filesChanged).toBe(2);
  });

  it('detects new file', () => {
    const newFileDiff = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.ts',
      '@@ -0,0 +1,2 @@',
      '+line 1',
      '+line 2',
    ].join('\n');
    const result = parseUnifiedDiff(newFileDiff);
    expect(result.files[0].isNew).toBe(true);
    expect(result.files[0].newName).toBe('new.ts');
  });

  it('detects deleted file', () => {
    const delDiff = [
      'diff --git a/old.ts b/old.ts',
      'deleted file mode 100644',
      '--- a/old.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-line 1',
      '-line 2',
    ].join('\n');
    const result = parseUnifiedDiff(delDiff);
    expect(result.files[0].isDeleted).toBe(true);
  });

  it('detects binary files', () => {
    const binDiff = 'diff --git a/img.png b/img.png\nBinary files a/img.png and b/img.png differ';
    const result = parseUnifiedDiff(binDiff);
    expect(result.files[0].isBinary).toBe(true);
    expect(result.files[0].hunks).toHaveLength(0);
  });

  it('detects renamed files', () => {
    const renameDiff = [
      'diff --git a/old.ts b/new.ts',
      'rename from old.ts',
      'rename to new.ts',
      '--- a/old.ts',
      '+++ b/new.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');
    const result = parseUnifiedDiff(renameDiff);
    expect(result.files[0].isRenamed).toBe(true);
  });

  it('returns empty for non-diff input', () => {
    const result = parseUnifiedDiff('hello world');
    expect(result.files).toHaveLength(0);
    expect(result.stats).toEqual({ filesChanged: 0, additions: 0, deletions: 0 });
  });

  it('returns empty for empty string', () => {
    const result = parseUnifiedDiff('');
    expect(result.files).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeWordDiff
// ---------------------------------------------------------------------------

describe('computeWordDiff', () => {
  it('returns equal for identical strings', () => {
    const result = computeWordDiff('hello world', 'hello world');
    expect(result).toEqual([{ type: 'equal', value: 'hello world' }]);
  });

  it('detects word-level changes', () => {
    const result = computeWordDiff('const a = 10', 'const b = 10');
    const types = result.map(s => s.type);
    expect(types).toContain('equal');
    expect(types).toContain('del');
    expect(types).toContain('add');
  });

  it('handles fully different strings', () => {
    const result = computeWordDiff('foo', 'bar');
    expect(result.some(s => s.type === 'del')).toBe(true);
    expect(result.some(s => s.type === 'add')).toBe(true);
  });

  it('handles empty old string', () => {
    const result = computeWordDiff('', 'new text');
    expect(result.some(s => s.type === 'add' && s.value.includes('new'))).toBe(true);
  });

  it('handles empty new string', () => {
    const result = computeWordDiff('old text', '');
    expect(result.some(s => s.type === 'del' && s.value.includes('old'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pairChangesForSplit
// ---------------------------------------------------------------------------

describe('pairChangesForSplit', () => {
  it('pairs context lines on both sides', () => {
    const changes = [{ type: 'ctx' as const, content: 'line', oldLineNo: 1, newLineNo: 1 }];
    const result = pairChangesForSplit(changes);
    expect(result).toHaveLength(1);
    expect(result[0].left).toBeDefined();
    expect(result[0].right).toBeDefined();
  });

  it('pairs del+add blocks row-by-row', () => {
    const changes = [
      { type: 'del' as const, content: 'old1', oldLineNo: 1 },
      { type: 'del' as const, content: 'old2', oldLineNo: 2 },
      { type: 'add' as const, content: 'new1', newLineNo: 1 },
      { type: 'add' as const, content: 'new2', newLineNo: 2 },
    ];
    const result = pairChangesForSplit(changes);
    expect(result).toHaveLength(2);
    expect(result[0].left?.content).toBe('old1');
    expect(result[0].right?.content).toBe('new1');
    expect(result[1].left?.content).toBe('old2');
    expect(result[1].right?.content).toBe('new2');
  });

  it('handles more dels than adds', () => {
    const changes = [
      { type: 'del' as const, content: 'old1', oldLineNo: 1 },
      { type: 'del' as const, content: 'old2', oldLineNo: 2 },
      { type: 'add' as const, content: 'new1', newLineNo: 1 },
    ];
    const result = pairChangesForSplit(changes);
    expect(result).toHaveLength(2);
    expect(result[0].left?.content).toBe('old1');
    expect(result[0].right?.content).toBe('new1');
    expect(result[1].left?.content).toBe('old2');
    expect(result[1].right).toBeUndefined();
  });

  it('handles standalone adds', () => {
    const changes = [
      { type: 'add' as const, content: 'new1', newLineNo: 1 },
    ];
    const result = pairChangesForSplit(changes);
    expect(result).toHaveLength(1);
    expect(result[0].left).toBeUndefined();
    expect(result[0].right?.content).toBe('new1');
  });

  it('handles empty changes', () => {
    expect(pairChangesForSplit([])).toHaveLength(0);
  });
});
