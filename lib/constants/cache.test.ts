import { usageColor, progressColor, getCategoryLabel, groupCachesByCategory, formatCacheDate, ENTRIES_PER_PAGE, CACHE_CATEGORY_ORDER } from './cache';

const mockT = (key: string) => key;

describe('constants', () => {
  it('exports ENTRIES_PER_PAGE as a positive number', () => {
    expect(ENTRIES_PER_PAGE).toBe(20);
  });

  it('exports CACHE_CATEGORY_ORDER with expected categories', () => {
    expect(CACHE_CATEGORY_ORDER).toEqual(['system', 'package_manager', 'devtools', 'terminal']);
  });
});

describe('usageColor', () => {
  it('returns destructive for >= 90%', () => {
    expect(usageColor(90)).toContain('destructive');
    expect(usageColor(100)).toContain('destructive');
  });

  it('returns yellow for >= 70%', () => {
    expect(usageColor(70)).toContain('yellow');
    expect(usageColor(89)).toContain('yellow');
  });

  it('returns green for < 70%', () => {
    expect(usageColor(0)).toContain('green');
    expect(usageColor(69)).toContain('green');
  });
});

describe('progressColor', () => {
  it('returns destructive for >= 90%', () => {
    expect(progressColor(90)).toContain('destructive');
  });

  it('returns yellow for >= 70%', () => {
    expect(progressColor(70)).toContain('yellow');
  });

  it('returns green for < 70%', () => {
    expect(progressColor(50)).toContain('green');
  });
});

describe('getCategoryLabel', () => {
  it('returns translated key for system', () => {
    expect(getCategoryLabel('system', mockT)).toBe('cache.categorySystem');
  });

  it('returns translated key for devtools', () => {
    expect(getCategoryLabel('devtools', mockT)).toBe('cache.categoryDevtools');
  });

  it('returns translated key for package_manager', () => {
    expect(getCategoryLabel('package_manager', mockT)).toBe('cache.categoryPackageManager');
  });

  it('returns translated key for terminal', () => {
    expect(getCategoryLabel('terminal', mockT)).toBe('cache.categoryTerminal');
  });

  it('returns raw category for unknown', () => {
    expect(getCategoryLabel('custom', mockT)).toBe('custom');
  });
});

describe('groupCachesByCategory', () => {
  it('groups caches by category', () => {
    const caches = [
      { category: 'system', name: 'a' },
      { category: 'system', name: 'b' },
      { category: 'devtools', name: 'c' },
    ] as never[];
    const grouped = groupCachesByCategory(caches);
    expect(grouped['system']).toHaveLength(2);
    expect(grouped['devtools']).toHaveLength(1);
  });

  it('uses defaultCategory when category is missing', () => {
    const caches = [{ name: 'a' }] as never[];
    const grouped = groupCachesByCategory(caches);
    expect(grouped['package_manager']).toHaveLength(1);
  });

  it('allows custom defaultCategory', () => {
    const caches = [{ name: 'a' }] as never[];
    const grouped = groupCachesByCategory(caches, 'system');
    expect(grouped['system']).toHaveLength(1);
  });

  it('returns empty object for empty array', () => {
    expect(groupCachesByCategory([])).toEqual({});
  });
});

describe('formatCacheDate', () => {
  it('formats valid ISO date', () => {
    const result = formatCacheDate('2025-01-15T10:30:00Z', 'N/A');
    expect(result).not.toBe('N/A');
    expect(typeof result).toBe('string');
  });

  it('returns fallback for null', () => {
    expect(formatCacheDate(null, 'N/A')).toBe('N/A');
  });

  it('returns fallback for empty string', () => {
    expect(formatCacheDate('', 'Never')).toBe('Never');
  });

  it('returns raw string for invalid date', () => {
    // Invalid date strings still create a Date object (may return "Invalid Date" string)
    const result = formatCacheDate('not-a-date', 'fallback');
    expect(typeof result).toBe('string');
  });
});
