import {
  parseSessionTimeFromFileName,
  formatSessionLabel,
  escapeRegExp,
  formatLogTimestamp,
  formatDateTimeInput,
  parseDateTimeInput,
  normalizeLevel,
  parseTimestamp,
} from './log';

describe('parseSessionTimeFromFileName', () => {
  it('parses valid session file name', () => {
    const date = parseSessionTimeFromFileName('2026-02-28_14-27-30.log');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(1); // 0-indexed
    expect(date!.getDate()).toBe(28);
    expect(date!.getHours()).toBe(14);
    expect(date!.getMinutes()).toBe(27);
    expect(date!.getSeconds()).toBe(30);
  });

  it('returns null for non-session file names', () => {
    expect(parseSessionTimeFromFileName('app.log')).toBeNull();
    expect(parseSessionTimeFromFileName('CogniaLauncher.log')).toBeNull();
    expect(parseSessionTimeFromFileName('error.log')).toBeNull();
  });

  it('returns null for partial timestamp names', () => {
    expect(parseSessionTimeFromFileName('2026-02-28.log')).toBeNull();
    expect(parseSessionTimeFromFileName('2026-02-28_14-27.log')).toBeNull();
  });

  it('returns null for wrong extension', () => {
    expect(parseSessionTimeFromFileName('2026-02-28_14-27-30.txt')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSessionTimeFromFileName('')).toBeNull();
  });

  it('handles midnight correctly', () => {
    const date = parseSessionTimeFromFileName('2026-01-01_00-00-00.log');
    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(0);
    expect(date!.getMinutes()).toBe(0);
    expect(date!.getSeconds()).toBe(0);
  });

  it('handles end of day correctly', () => {
    const date = parseSessionTimeFromFileName('2026-12-31_23-59-59.log');
    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(23);
    expect(date!.getMinutes()).toBe(59);
    expect(date!.getSeconds()).toBe(59);
  });
});

describe('formatSessionLabel', () => {
  it('formats valid session file name', () => {
    expect(formatSessionLabel('2026-02-28_14-27-30.log')).toBe('2026-02-28 14:27:30');
  });

  it('formats with zero-padded values', () => {
    expect(formatSessionLabel('2026-01-05_09-03-07.log')).toBe('2026-01-05 09:03:07');
  });

  it('returns null for non-session file names', () => {
    expect(formatSessionLabel('app.log')).toBeNull();
    expect(formatSessionLabel('CogniaLauncher.log')).toBeNull();
  });
});

describe('escapeRegExp', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegExp('hello.world')).toBe('hello\\.world');
    expect(escapeRegExp('a+b*c')).toBe('a\\+b\\*c');
    expect(escapeRegExp('[test]')).toBe('\\[test\\]');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeRegExp('hello')).toBe('hello');
  });
});

describe('formatLogTimestamp', () => {
  it('formats timestamp to time string', () => {
    const result = formatLogTimestamp(1709136450000);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
  });
});

describe('formatDateTimeInput', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatDateTimeInput(null)).toBe('');
    expect(formatDateTimeInput(undefined)).toBe('');
    expect(formatDateTimeInput(0)).toBe('');
  });

  it('formats a timestamp to datetime-local input value', () => {
    const result = formatDateTimeInput(1709136450000);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('parseDateTimeInput', () => {
  it('returns null for empty string', () => {
    expect(parseDateTimeInput('')).toBeNull();
  });

  it('parses valid datetime string', () => {
    const result = parseDateTimeInput('2026-02-28T14:30');
    expect(result).toBeGreaterThan(0);
  });

  it('returns null for invalid datetime', () => {
    expect(parseDateTimeInput('not-a-date')).toBeNull();
  });
});

describe('normalizeLevel', () => {
  it('normalizes known levels', () => {
    expect(normalizeLevel('TRACE')).toBe('trace');
    expect(normalizeLevel('DEBUG')).toBe('debug');
    expect(normalizeLevel('INFO')).toBe('info');
    expect(normalizeLevel('WARN')).toBe('warn');
    expect(normalizeLevel('ERROR')).toBe('error');
  });

  it('normalizes mixed case', () => {
    expect(normalizeLevel('Info')).toBe('info');
    expect(normalizeLevel('Warning')).toBe('info'); // unknown → info
  });

  it('falls back to info for unknown levels', () => {
    expect(normalizeLevel('unknown')).toBe('info');
    expect(normalizeLevel('FATAL')).toBe('info');
  });
});

describe('parseTimestamp', () => {
  it('parses ISO date strings', () => {
    const result = parseTimestamp('2026-02-28T14:30:00.000Z');
    expect(result).toBeGreaterThan(0);
  });

  it('parses numeric timestamps (seconds)', () => {
    const result = parseTimestamp('1709136450');
    expect(result).toBe(1709136450000);
  });

  it('parses numeric timestamps (milliseconds)', () => {
    const result = parseTimestamp('1709136450000');
    expect(result).toBe(1709136450000);
  });

  it('returns now for unparseable strings', () => {
    const before = Date.now();
    const result = parseTimestamp('totally-invalid');
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});
