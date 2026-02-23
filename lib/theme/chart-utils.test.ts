import { getChartColor, getGradientId } from './chart-utils';

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
