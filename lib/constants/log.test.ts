import { ALL_LEVELS, LEVEL_STYLES, LEVEL_LABELS, LEVEL_COLORS } from './log';

describe('ALL_LEVELS', () => {
  it('contains exactly 5 levels', () => {
    expect(ALL_LEVELS).toHaveLength(5);
  });

  it('contains trace, debug, info, warn, error', () => {
    expect(ALL_LEVELS).toEqual(['trace', 'debug', 'info', 'warn', 'error']);
  });
});

describe('LEVEL_STYLES', () => {
  it('has entry for every level', () => {
    ALL_LEVELS.forEach((level) => {
      expect(LEVEL_STYLES[level]).toBeDefined();
    });
  });

  it('each entry has variant, className, indicator', () => {
    ALL_LEVELS.forEach((level) => {
      const style = LEVEL_STYLES[level];
      expect(style).toHaveProperty('variant');
      expect(style).toHaveProperty('className');
      expect(style).toHaveProperty('indicator');
    });
  });

  it('error level has destructive variant', () => {
    expect(LEVEL_STYLES.error.variant).toBe('destructive');
  });
});

describe('LEVEL_LABELS', () => {
  it('has short label for every level', () => {
    ALL_LEVELS.forEach((level) => {
      expect(typeof LEVEL_LABELS[level]).toBe('string');
      expect(LEVEL_LABELS[level].length).toBe(3);
    });
  });
});

describe('LEVEL_COLORS', () => {
  it('has a text color class for every level', () => {
    ALL_LEVELS.forEach((level) => {
      expect(LEVEL_COLORS[level]).toMatch(/^text-/);
    });
  });
});
