/**
 * Shared constants for Git components.
 * Extracted from components/git/*.tsx for proper layer separation.
 */

// ---------------------------------------------------------------------------
// Activity Heatmap
// ---------------------------------------------------------------------------

export const HEATMAP_CELL_SIZE = 12;
export const HEATMAP_CELL_GAP = 2;

// ---------------------------------------------------------------------------
// Blame View — Author color bands
// ---------------------------------------------------------------------------

export const AUTHOR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-rose-500',
];

// ---------------------------------------------------------------------------
// Commit Graph
// ---------------------------------------------------------------------------

export const LANE_COLORS = [
  '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899',
  '#06b6d4', '#eab308', '#ef4444', '#6366f1', '#14b8a6',
];

export const LANE_WIDTH = 16;
export const ROW_HEIGHT = 28;
export const NODE_RADIUS = 4;
export const GRAPH_LEFT_PADDING = 8;
export const MERGE_NODE_SIZE = 5;
export const OVERSCAN_COUNT = 15;
export const MAX_VISIBLE_REFS = 3;
