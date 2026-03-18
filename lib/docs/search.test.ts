import { searchDocs } from './search';
import type { DocSearchEntry } from './content';

jest.mock('./navigation', () => ({
  flattenNav: () => [
    { title: '快速开始', titleEn: 'Quick Start', slug: 'getting-started' },
    { title: '安装指南', titleEn: 'Installation Guide', slug: 'installation' },
    { title: '配置说明', titleEn: 'Configuration', slug: 'configuration' },
    { title: '缓存管理', titleEn: 'Cache Management', slug: 'cache-management' },
    { title: '环境管理', titleEn: 'Environment Management', slug: 'environment' },
    { title: '分组标题', slug: '' },
  ],
}));

const mockSearchIndex: DocSearchEntry[] = [
  {
    slug: 'getting-started',
    pageSlug: 'getting-started',
    anchorId: 'quick-start',
    sectionTitle: 'Quick Start',
    locale: 'en',
    excerpt: 'This guide helps you quickly install and configure CogniaLauncher',
  },
  {
    slug: 'getting-started',
    pageSlug: 'getting-started',
    anchorId: 'prerequisites',
    sectionTitle: 'Prerequisites',
    locale: 'en',
    excerpt: 'Prepare environment before the first run',
  },
  {
    slug: 'getting-started',
    pageSlug: 'getting-started',
    anchorId: '前提条件',
    sectionTitle: '前提条件',
    locale: 'zh',
    excerpt: '开始前请准备依赖项',
  },
  {
    slug: 'installation',
    pageSlug: 'installation',
    anchorId: 'tauri-runtime',
    sectionTitle: 'Tauri Runtime',
    locale: 'en',
    excerpt: 'Supports Windows, macOS and Linux platforms',
  },
  {
    slug: 'configuration',
    pageSlug: 'configuration',
    anchorId: 'proxy-settings',
    sectionTitle: 'Proxy Settings',
    locale: 'en',
    excerpt: 'Customize application behavior via settings page or config file',
  },
  {
    slug: 'configuration',
    pageSlug: 'configuration',
    anchorId: '代理配置',
    sectionTitle: '代理配置',
    locale: 'zh',
    excerpt: '通过设置页面或配置文件自定义应用行为',
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
    const results = searchDocs('install', 'en', mockSearchIndex);
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

  it('works without searchIndex', () => {
    const results = searchDocs('Quick Start', 'en', undefined);
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns section result with anchorId from searchIndex', () => {
    const results = searchDocs('Prerequisites', 'en', mockSearchIndex);
    const match = results.find((r) => r.anchorId === 'prerequisites');
    expect(match).toBeDefined();
    expect(match?.slug).toBe('getting-started');
  });

  it('uses locale-specific section entries only', () => {
    const enResults = searchDocs('前提条件', 'en', mockSearchIndex);
    const zhResults = searchDocs('前提条件', 'zh', mockSearchIndex);
    expect(enResults).toEqual([]);
    expect(zhResults.length).toBeGreaterThan(0);
  });

  it('returns snippet from matched section title', () => {
    const results = searchDocs('Proxy', 'en', mockSearchIndex);
    const configResult = results.find((r) => r.anchorId === 'proxy-settings');
    expect(configResult).toBeDefined();
    expect(configResult?.snippet).toContain('Proxy');
  });

  it('returns snippet from excerpt when section title does not match', () => {
    const results = searchDocs('platforms', 'en', mockSearchIndex);
    const installResult = results.find((r) => r.anchorId === 'tauri-runtime');
    expect(installResult).toBeDefined();
    expect(installResult?.snippet.toLowerCase()).toContain('platform');
  });

  it('deduplicates slug/anchor pairs by highest score and falls back to page slug for unknown nav entries', () => {
    const results = searchDocs('fallback', 'en', [
      {
        slug: 'unknown-page',
        pageSlug: 'unknown-page',
        anchorId: 'dup-anchor',
        sectionTitle: 'Fallback title',
        locale: 'en',
        excerpt: 'fallback excerpt',
      },
      {
        slug: 'unknown-page',
        pageSlug: 'unknown-page',
        anchorId: 'dup-anchor',
        sectionTitle: 'Fallback title',
        locale: 'en',
        excerpt: 'fallback excerpt with extra fallback terms',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      slug: 'unknown-page',
      title: 'unknown-page',
      snippet: 'Fallback title',
    });
  });

  it('does not emit section hits when neither section title nor excerpt match the query', () => {
    const results = searchDocs('configuration', 'en', [
      {
        slug: 'configuration',
        pageSlug: 'configuration',
        anchorId: 'deep-link',
        sectionTitle: 'Advanced topics',
        locale: 'en',
        excerpt: '',
      },
    ]);

    expect(results.find((result) => result.anchorId === 'deep-link')).toBeUndefined();
  });

  it('limits results to 15', () => {
    const results = searchDocs('a', 'en', mockSearchIndex);
    expect(results.length).toBeLessThanOrEqual(15);
  });

  it('searches Chinese section entries from index', () => {
    const results = searchDocs('代理', 'zh', mockSearchIndex);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.slug === 'configuration')).toBe(true);
  });

  it('matches multi-term queries across title and excerpt text', () => {
    const results = searchDocs('quick configure', 'en', mockSearchIndex);
    expect(results.some((result) => result.slug === 'getting-started')).toBe(true);
  });
});
