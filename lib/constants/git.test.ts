import {
  HEATMAP_CELL_SIZE,
  HEATMAP_CELL_GAP,
  AUTHOR_COLORS,
  LANE_COLORS,
  LANE_WIDTH,
  ROW_HEIGHT,
  NODE_RADIUS,
  GRAPH_LEFT_PADDING,
  MERGE_NODE_SIZE,
  OVERSCAN_COUNT,
  MAX_VISIBLE_REFS,
} from './git';

describe('git constants', () => {
  it('exports heatmap constants as positive numbers', () => {
    expect(HEATMAP_CELL_SIZE).toBeGreaterThan(0);
    expect(HEATMAP_CELL_GAP).toBeGreaterThanOrEqual(0);
  });

  it('AUTHOR_COLORS is a non-empty array of Tailwind bg classes', () => {
    expect(AUTHOR_COLORS.length).toBeGreaterThan(0);
    AUTHOR_COLORS.forEach((c) => expect(c).toMatch(/^bg-/));
  });

  it('LANE_COLORS is a non-empty array of hex colors', () => {
    expect(LANE_COLORS.length).toBeGreaterThan(0);
    LANE_COLORS.forEach((c) => expect(c).toMatch(/^#[0-9a-fA-F]{6}$/));
  });

  it('exports graph layout constants as positive numbers', () => {
    expect(LANE_WIDTH).toBeGreaterThan(0);
    expect(ROW_HEIGHT).toBeGreaterThan(0);
    expect(NODE_RADIUS).toBeGreaterThan(0);
    expect(GRAPH_LEFT_PADDING).toBeGreaterThanOrEqual(0);
    expect(MERGE_NODE_SIZE).toBeGreaterThan(0);
  });

  it('exports OVERSCAN_COUNT and MAX_VISIBLE_REFS as positive integers', () => {
    expect(Number.isInteger(OVERSCAN_COUNT)).toBe(true);
    expect(OVERSCAN_COUNT).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_VISIBLE_REFS)).toBe(true);
    expect(MAX_VISIBLE_REFS).toBeGreaterThan(0);
  });
});
