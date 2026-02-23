/**
 * Shared chart color utilities for dashboard widgets.
 * All chart widgets should use these functions instead of hardcoded colors.
 */

const CHART_VAR_COUNT = 5;

/**
 * Get a chart color CSS variable reference for the given index.
 * Cycles through --chart-1 to --chart-5.
 */
export function getChartColor(index: number): string {
  const varIndex = (index % CHART_VAR_COUNT) + 1;
  return `var(--chart-${varIndex})`;
}

/**
 * Generate a unique gradient ID for SVG defs to avoid collisions between widgets.
 */
export function getGradientId(prefix: string, index: number): string {
  return `${prefix}-gradient-${index}`;
}
