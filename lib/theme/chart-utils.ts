/**
 * Shared chart color utilities for dashboard widgets.
 * All chart widgets should use these functions instead of hardcoded colors.
 */

const CHART_VAR_COUNT = 5;

type ChartGradientStop = {
  offset: string;
  opacity: number;
};

type ChartGradientDefinition = {
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  stops: ChartGradientStop[];
};

export type ChartGradientPreset =
  | "pie"
  | "bar-vertical"
  | "bar-horizontal"
  | "area"
  | "sparkline";

const CHART_GRADIENT_PRESETS: Record<ChartGradientPreset, ChartGradientDefinition> = {
  pie: {
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
    stops: [
      { offset: "0%", opacity: 0.96 },
      { offset: "100%", opacity: 0.74 },
    ],
  },
  "bar-vertical": {
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
    stops: [
      { offset: "0%", opacity: 0.94 },
      { offset: "100%", opacity: 0.72 },
    ],
  },
  "bar-horizontal": {
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "0",
    stops: [
      { offset: "0%", opacity: 0.9 },
      { offset: "100%", opacity: 0.68 },
    ],
  },
  area: {
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
    stops: [
      { offset: "5%", opacity: 0.58 },
      { offset: "60%", opacity: 0.2 },
      { offset: "95%", opacity: 0.04 },
    ],
  },
  sparkline: {
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
    stops: [
      { offset: "5%", opacity: 0.42 },
      { offset: "95%", opacity: 0 },
    ],
  },
};

const CHART_THEME_TOKENS = {
  axisTickColor: "var(--foreground)",
  gridStroke: "var(--border)",
  gridOpacity: 0.3,
  tooltipCursorFill: "var(--muted)",
  tooltipCursorOpacity: 0.24,
  segmentStroke: "var(--background)",
  segmentStrokeWidth: 2,
  radialTrackFill: "var(--muted)",
  radialTrackOpacity: 0.28,
} as const;

/**
 * Get a chart color CSS variable reference for the given index.
 * Cycles through --chart-1 to --chart-5.
 */
export function getChartColor(index: number): string {
  const varIndex = (index % CHART_VAR_COUNT) + 1;
  return `var(--chart-${varIndex})`;
}

/**
 * Shared gradient definition for chart fills across widgets.
 */
export function getChartGradientDefinition(
  preset: ChartGradientPreset,
): ChartGradientDefinition {
  return CHART_GRADIENT_PRESETS[preset];
}

/**
 * Shared axis tick text style to keep chart readability consistent across themes.
 */
export function getChartAxisTickStyle(fontSize = 11): {
  fontSize: number;
  fill: string;
} {
  return {
    fontSize,
    fill: CHART_THEME_TOKENS.axisTickColor,
  };
}

/**
 * Shared cartesian grid style for consistent contrast in dark and light themes.
 */
export function getChartGridStyle(opacity = CHART_THEME_TOKENS.gridOpacity): {
  stroke: string;
  strokeOpacity: number;
} {
  return {
    stroke: CHART_THEME_TOKENS.gridStroke,
    strokeOpacity: opacity,
  };
}

/**
 * Shared tooltip cursor style to avoid widget-specific hardcoded values.
 */
export function getChartTooltipCursorStyle(
  opacity = CHART_THEME_TOKENS.tooltipCursorOpacity,
): {
  fill: string;
  opacity: number;
} {
  return {
    fill: CHART_THEME_TOKENS.tooltipCursorFill,
    opacity,
  };
}

/**
 * Shared segment stroke style used by pie/ring charts.
 */
export function getChartSegmentStrokeStyle(
  strokeWidth = CHART_THEME_TOKENS.segmentStrokeWidth,
): {
  stroke: string;
  strokeWidth: number;
} {
  return {
    stroke: CHART_THEME_TOKENS.segmentStroke,
    strokeWidth,
  };
}

/**
 * Shared track style for radial charts.
 */
export function getChartRadialTrackStyle(
  opacity = CHART_THEME_TOKENS.radialTrackOpacity,
): {
  fill: string;
  opacity: number;
} {
  return {
    fill: CHART_THEME_TOKENS.radialTrackFill,
    opacity,
  };
}

/**
 * Generate a unique gradient ID for SVG defs to avoid collisions between widgets.
 */
export function getGradientId(prefix: string, index: number): string {
  return `${prefix}-gradient-${index}`;
}
