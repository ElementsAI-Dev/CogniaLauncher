import {
  getChartColor,
  getChartGradientDefinition,
  getChartAxisTickStyle,
  getChartGridStyle,
  getChartTooltipCursorStyle,
  getChartSegmentStrokeStyle,
  getChartRadialTrackStyle,
  getGradientId,
} from './chart-utils';

describe('getChartColor', () => {
  it('returns correct CSS variable for index 0-4', () => {
    expect(getChartColor(0)).toBe('var(--chart-1)');
    expect(getChartColor(1)).toBe('var(--chart-2)');
    expect(getChartColor(2)).toBe('var(--chart-3)');
    expect(getChartColor(3)).toBe('var(--chart-4)');
    expect(getChartColor(4)).toBe('var(--chart-5)');
  });

  it('cycles back after index 4', () => {
    expect(getChartColor(5)).toBe('var(--chart-1)');
    expect(getChartColor(6)).toBe('var(--chart-2)');
    expect(getChartColor(10)).toBe('var(--chart-1)');
  });

  it('handles large indices', () => {
    expect(getChartColor(100)).toBe('var(--chart-1)');
    expect(getChartColor(99)).toBe('var(--chart-5)');
  });
});

describe('getGradientId', () => {
  it('generates unique gradient IDs with prefix and index', () => {
    expect(getGradientId('envPie', 0)).toBe('envPie-gradient-0');
    expect(getGradientId('envBar', 3)).toBe('envBar-gradient-3');
    expect(getGradientId('pkg', 10)).toBe('pkg-gradient-10');
  });

  it('different prefixes produce different IDs', () => {
    const id1 = getGradientId('pie', 0);
    const id2 = getGradientId('bar', 0);
    expect(id1).not.toBe(id2);
  });
});

describe('shared chart style helpers', () => {
  it('returns axis tick style using theme token', () => {
    expect(getChartAxisTickStyle(12)).toEqual({
      fontSize: 12,
      fill: 'var(--foreground)',
    });
  });

  it('returns shared grid style', () => {
    expect(getChartGridStyle()).toEqual({
      stroke: 'var(--border)',
      strokeOpacity: 0.3,
    });
  });

  it('returns shared tooltip cursor style', () => {
    expect(getChartTooltipCursorStyle()).toEqual({
      fill: 'var(--muted)',
      opacity: 0.24,
    });
  });

  it('returns shared segment stroke style', () => {
    expect(getChartSegmentStrokeStyle()).toEqual({
      stroke: 'var(--background)',
      strokeWidth: 2,
    });
  });

  it('returns shared radial track style', () => {
    expect(getChartRadialTrackStyle()).toEqual({
      fill: 'var(--muted)',
      opacity: 0.28,
    });
  });
});

describe('getChartGradientDefinition', () => {
  it('returns expected preset structure', () => {
    const definition = getChartGradientDefinition('pie');
    expect(definition).toMatchObject({
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '1',
    });
    expect(definition.stops.length).toBeGreaterThan(0);
  });

  it('returns area preset with three stops', () => {
    const definition = getChartGradientDefinition('area');
    expect(definition.stops).toHaveLength(3);
  });
});
