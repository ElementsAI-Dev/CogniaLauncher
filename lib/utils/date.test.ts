import { formatCompactRelativeDate } from './date';

describe('formatCompactRelativeDate', () => {
  it('returns "today" for current date', () => {
    expect(formatCompactRelativeDate(new Date().toISOString())).toBe('today');
  });

  it('returns "1d" for yesterday', () => {
    const d = new Date(Date.now() - 86400000 * 1.5);
    expect(formatCompactRelativeDate(d.toISOString())).toBe('1d');
  });

  it('returns "Xd" for 2-6 days ago', () => {
    const d = new Date(Date.now() - 86400000 * 4);
    expect(formatCompactRelativeDate(d.toISOString())).toBe('4d');
  });

  it('returns "Xw" for 7-29 days ago', () => {
    const d = new Date(Date.now() - 86400000 * 14);
    expect(formatCompactRelativeDate(d.toISOString())).toBe('2w');
  });

  it('returns "Xmo" for 30-364 days ago', () => {
    const d = new Date(Date.now() - 86400000 * 60);
    expect(formatCompactRelativeDate(d.toISOString())).toBe('2mo');
  });

  it('returns "Xy" for 365+ days ago', () => {
    const d = new Date(Date.now() - 86400000 * 400);
    expect(formatCompactRelativeDate(d.toISOString())).toBe('1y');
  });

  it('handles invalid date gracefully', () => {
    const result = formatCompactRelativeDate('not-a-date');
    expect(typeof result).toBe('string');
  });
});
