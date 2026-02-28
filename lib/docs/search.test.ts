import { searchDocs } from './search';

// Mock the navigation module to provide test data
jest.mock('./navigation', () => ({
  flattenNav: () => [
    { title: '快速开始', titleEn: 'Quick Start', slug: 'getting-started' },
    { title: '安装指南', titleEn: 'Installation Guide', slug: 'installation' },
    { title: '配置说明', titleEn: 'Configuration', slug: 'configuration' },
    { title: '缓存管理', titleEn: 'Cache Management', slug: 'cache-management' },
    { title: '环境管理', titleEn: 'Environment Management', slug: 'environment' },
    { title: '分组标题', slug: '' }, // No slug - should be skipped
  ],
}));

describe('searchDocs', () => {
  it('returns empty array for empty query', () => {
    expect(searchDocs('', 'en')).toEqual([]);
    expect(searchDocs('  ', 'en')).toEqual([]);
  });

  it('finds docs by English title', () => {
    const results = searchDocs('Quick Start', 'en');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('getting-started');
  });

  it('finds docs by Chinese title', () => {
    const results = searchDocs('快速开始', 'zh');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('getting-started');
  });

  it('finds docs by slug', () => {
    const results = searchDocs('cache-management', 'en');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.slug === 'cache-management')).toBe(true);
  });

  it('sorts results by score (higher first)', () => {
    const results = searchDocs('install', 'en');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('skips items without slug', () => {
    const results = searchDocs('分组', 'zh');
    expect(results.every((r) => r.slug !== '')).toBe(true);
  });

  it('returns empty for non-matching query', () => {
    expect(searchDocs('zzzznonexistent', 'en')).toEqual([]);
  });

  it('matches across both locale titles', () => {
    // Search in English locale but Chinese text should still boost score
    const results = searchDocs('安装', 'en');
    expect(results.length).toBeGreaterThan(0);
  });
});
