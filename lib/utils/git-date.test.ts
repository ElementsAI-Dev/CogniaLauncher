import { formatRelativeDate, formatRelativeTimestamp } from './git-date';

describe('formatRelativeDate', () => {
  it('returns "today" for current date', () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe('today');
  });

  it('returns "yesterday" for 1 day ago', () => {
    const d = new Date(Date.now() - 86400000 * 1.5);
    expect(formatRelativeDate(d.toISOString())).toBe('yesterday');
  });

  it('returns "Xd ago" for 2-6 days', () => {
    const d = new Date(Date.now() - 86400000 * 3);
    expect(formatRelativeDate(d.toISOString())).toBe('3d ago');
  });

  it('returns "Xw ago" for 7-29 days', () => {
    const d = new Date(Date.now() - 86400000 * 14);
    expect(formatRelativeDate(d.toISOString())).toBe('2w ago');
  });

  it('returns "Xmo ago" for 30-364 days', () => {
    const d = new Date(Date.now() - 86400000 * 60);
    expect(formatRelativeDate(d.toISOString())).toBe('2mo ago');
  });

  it('returns "Xy ago" for 365+ days', () => {
    const d = new Date(Date.now() - 86400000 * 400);
    expect(formatRelativeDate(d.toISOString())).toBe('1y ago');
  });

  it('handles invalid date gracefully', () => {
    // "not-a-date" produces NaN date; result is NaN-based string, not the raw input
    const result = formatRelativeDate('not-a-date');
    expect(typeof result).toBe('string');
  });
});

describe('formatRelativeTimestamp', () => {
  it('returns "today" for current timestamp', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatRelativeTimestamp(now)).toBe('today');
  });

  it('returns "1d ago" for 1 day ago', () => {
    const ts = Math.floor(Date.now() / 1000) - 86400 * 1.5;
    expect(formatRelativeTimestamp(ts)).toBe('1d ago');
  });

  it('returns "Xd ago" for 2-6 days', () => {
    const ts = Math.floor(Date.now() / 1000) - 86400 * 4;
    expect(formatRelativeTimestamp(ts)).toBe('4d ago');
  });

  it('returns "Xw ago" for 7-29 days', () => {
    const ts = Math.floor(Date.now() / 1000) - 86400 * 21;
    expect(formatRelativeTimestamp(ts)).toBe('3w ago');
  });

  it('returns "Xmo ago" for 30-364 days', () => {
    const ts = Math.floor(Date.now() / 1000) - 86400 * 90;
    expect(formatRelativeTimestamp(ts)).toBe('3mo ago');
  });

  it('returns "Xy ago" for 365+ days', () => {
    const ts = Math.floor(Date.now() / 1000) - 86400 * 730;
    expect(formatRelativeTimestamp(ts)).toBe('2y ago');
  });
});
