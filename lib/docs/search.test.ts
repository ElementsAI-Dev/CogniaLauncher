import { searchDocs } from './search';
import type { DocSearchEntry } from './content';

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

const mockSearchIndex: DocSearchEntry[] = [
  {
    slug: 'getting-started',
    headingsZh: ['快速开始', '前提条件', '第一步'],
    headingsEn: ['Quick Start', 'Prerequisites', 'First Steps'],
    excerptZh: '本指南帮助你快速安装和配置 CogniaLauncher',
    excerptEn: 'This guide helps you quickly install and configure CogniaLauncher',
  },
  {
    slug: 'installation',
    headingsZh: ['安装', '系统要求', 'Tauri 运行时'],
    headingsEn: ['Installation', 'System Requirements', 'Tauri Runtime'],
    excerptZh: '支持 Windows、macOS 和 Linux 平台',
    excerptEn: 'Supports Windows, macOS and Linux platforms',
  },
  {
    slug: 'configuration',
    headingsZh: ['配置', '全局设置', '代理配置'],
    headingsEn: ['Configuration', 'Global Settings', 'Proxy Settings'],
    excerptZh: '通过设置页面或配置文件自定义应用行为',
    excerptEn: 'Customize application behavior via settings page or config file',
  },
];

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
    const results = searchDocs('安装', 'en');
    expect(results.length).toBeGreaterThan(0);
  });

  it('works without searchIndex (backward compatible)', () => {
    const results = searchDocs('Quick Start', 'en', undefined);
    expect(results.length).toBeGreaterThan(0);
  });

  it('boosts score when searchIndex headings match', () => {
    const withoutIndex = searchDocs('Prerequisites', 'en');
    const withIndex = searchDocs('Prerequisites', 'en', mockSearchIndex);
    // Without index, "Prerequisites" doesn't match any nav title
    expect(withoutIndex).toHaveLength(0);
    // With index, it matches a heading in getting-started
    expect(withIndex.length).toBeGreaterThan(0);
    expect(withIndex[0].slug).toBe('getting-started');
  });

  it('matches content excerpts from searchIndex', () => {
    const results = searchDocs('Tauri Runtime', 'en', mockSearchIndex);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.slug === 'installation')).toBe(true);
  });

  it('returns snippet from matched heading', () => {
    const results = searchDocs('Proxy', 'en', mockSearchIndex);
    expect(results.length).toBeGreaterThan(0);
    const configResult = results.find((r) => r.slug === 'configuration');
    expect(configResult).toBeDefined();
    expect(configResult!.snippet).toContain('Proxy');
  });

  it('returns snippet from excerpt when no heading matches', () => {
    const results = searchDocs('platforms', 'en', mockSearchIndex);
    expect(results.length).toBeGreaterThan(0);
    const installResult = results.find((r) => r.slug === 'installation');
    expect(installResult).toBeDefined();
    expect(installResult!.snippet).toContain('platform');
  });

  it('limits results to 15', () => {
    const results = searchDocs('a', 'en', mockSearchIndex);
    expect(results.length).toBeLessThanOrEqual(15);
  });

  it('searches Chinese headings from index', () => {
    const results = searchDocs('代理', 'zh', mockSearchIndex);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.slug === 'configuration')).toBe(true);
  });
});
