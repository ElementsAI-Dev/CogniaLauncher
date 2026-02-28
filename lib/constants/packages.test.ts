import { COMPARISON_FEATURE_KEYS, VERSIONS_PER_PAGE, ACTION_ICONS, DEPTH_COLORS, SEARCH_HISTORY_KEY, MAX_SEARCH_HISTORY } from './packages';

describe('COMPARISON_FEATURE_KEYS', () => {
  it('is a non-empty array', () => {
    expect(COMPARISON_FEATURE_KEYS.length).toBeGreaterThan(0);
  });

  it('each entry has nameKey, key, type', () => {
    COMPARISON_FEATURE_KEYS.forEach((f) => {
      expect(f.nameKey).toBeTruthy();
      expect(f.key).toBeTruthy();
      expect(['string', 'size', 'array']).toContain(f.type);
    });
  });

  it('contains version and provider keys', () => {
    const keys = COMPARISON_FEATURE_KEYS.map((f) => f.key);
    expect(keys).toContain('version');
    expect(keys).toContain('provider');
  });
});

describe('VERSIONS_PER_PAGE', () => {
  it('is a positive number', () => {
    expect(VERSIONS_PER_PAGE).toBeGreaterThan(0);
  });
});

describe('ACTION_ICONS', () => {
  it('has icons for install, uninstall, update, rollback, pin, unpin', () => {
    expect(ACTION_ICONS['install']).toBeDefined();
    expect(ACTION_ICONS['uninstall']).toBeDefined();
    expect(ACTION_ICONS['update']).toBeDefined();
    expect(ACTION_ICONS['rollback']).toBeDefined();
    expect(ACTION_ICONS['pin']).toBeDefined();
    expect(ACTION_ICONS['unpin']).toBeDefined();
  });
});

describe('DEPTH_COLORS', () => {
  it('is a non-empty array of Tailwind border classes', () => {
    expect(DEPTH_COLORS.length).toBeGreaterThan(0);
    DEPTH_COLORS.forEach((c) => expect(c).toMatch(/^border-l-/));
  });
});

describe('search history constants', () => {
  it('SEARCH_HISTORY_KEY is a non-empty string', () => {
    expect(typeof SEARCH_HISTORY_KEY).toBe('string');
    expect(SEARCH_HISTORY_KEY.length).toBeGreaterThan(0);
  });

  it('MAX_SEARCH_HISTORY is a positive number', () => {
    expect(MAX_SEARCH_HISTORY).toBeGreaterThan(0);
  });
});
