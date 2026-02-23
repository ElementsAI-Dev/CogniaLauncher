import {
  DOC_NAV,
  flattenNav,
  getDocTitle,
  getAdjacentDocs,
  slugToArray,
  arrayToSlug,
  type DocNavItem,
} from './navigation';

describe('DOC_NAV', () => {
  it('has root index entry', () => {
    expect(DOC_NAV[0]).toEqual({
      title: '首页',
      titleEn: 'Home',
      slug: 'index',
    });
  });

  it('has 8 top-level entries', () => {
    expect(DOC_NAV).toHaveLength(8);
  });

  it('every leaf node has a slug', () => {
    function checkLeaves(items: DocNavItem[]) {
      for (const item of items) {
        if (item.children) {
          checkLeaves(item.children);
        } else {
          expect(item.slug).toBeDefined();
          expect(typeof item.slug).toBe('string');
        }
      }
    }
    checkLeaves(DOC_NAV);
  });

  it('section index slugs do not contain /index suffix', () => {
    const flat = flattenNav();
    const indexSlugs = flat.filter((item) => item.slug?.endsWith('/index'));
    expect(indexSlugs).toEqual([]);
  });

  it('every item has both title and titleEn', () => {
    function checkTitles(items: DocNavItem[]) {
      for (const item of items) {
        expect(item.title).toBeTruthy();
        expect(item.titleEn).toBeTruthy();
        if (item.children) {
          checkTitles(item.children);
        }
      }
    }
    checkTitles(DOC_NAV);
  });
});

describe('flattenNav', () => {
  it('returns only items with slugs', () => {
    const flat = flattenNav();
    for (const item of flat) {
      expect(item.slug).toBeDefined();
    }
  });

  it('includes root index', () => {
    const flat = flattenNav();
    expect(flat[0].slug).toBe('index');
  });

  it('includes nested items', () => {
    const flat = flattenNav();
    const slugs = flat.map((i) => i.slug);
    expect(slugs).toContain('getting-started/installation');
    expect(slugs).toContain('guide/environments');
    expect(slugs).toContain('architecture/overview');
    expect(slugs).toContain('reference/commands');
  });

  it('excludes group headers (items without slug)', () => {
    const flat = flattenNav();
    const titles = flat.map((i) => i.title);
    // Group headers like '快速开始' have no slug and should not appear
    expect(titles).not.toContain('快速开始');
    expect(titles).not.toContain('使用指南');
  });

  it('preserves order: root first, then sections in order', () => {
    const flat = flattenNav();
    const indexOfRoot = flat.findIndex((i) => i.slug === 'index');
    const indexOfGettingStarted = flat.findIndex((i) => i.slug === 'getting-started');
    const indexOfGuide = flat.findIndex((i) => i.slug === 'guide');
    expect(indexOfRoot).toBeLessThan(indexOfGettingStarted);
    expect(indexOfGettingStarted).toBeLessThan(indexOfGuide);
  });

  it('accepts custom items array', () => {
    const custom: DocNavItem[] = [
      { title: 'A', titleEn: 'A', slug: 'a' },
      { title: 'B', titleEn: 'B', children: [{ title: 'C', titleEn: 'C', slug: 'b/c' }] },
    ];
    const flat = flattenNav(custom);
    expect(flat).toHaveLength(2);
    expect(flat[0].slug).toBe('a');
    expect(flat[1].slug).toBe('b/c');
  });
});

describe('getDocTitle', () => {
  it('returns Chinese title by default', () => {
    expect(getDocTitle('index')).toBe('首页');
  });

  it('returns Chinese title for zh locale', () => {
    expect(getDocTitle('guide/environments', 'zh')).toBe('环境管理');
  });

  it('returns English title for en locale', () => {
    expect(getDocTitle('index', 'en')).toBe('Home');
    expect(getDocTitle('guide/environments', 'en')).toBe('Environments');
  });

  it('returns undefined for non-existent slug', () => {
    expect(getDocTitle('non-existent')).toBeUndefined();
  });

  it('finds section index pages without /index suffix', () => {
    expect(getDocTitle('getting-started')).toBe('概览');
    expect(getDocTitle('guide')).toBe('概览');
    expect(getDocTitle('architecture')).toBe('概览');
  });
});

describe('getAdjacentDocs', () => {
  it('returns prev and next for middle items', () => {
    const { prev, next } = getAdjacentDocs('getting-started/installation');
    expect(prev).toBeDefined();
    expect(next).toBeDefined();
    expect(prev?.slug).toBe('getting-started');
    expect(next?.slug).toBe('getting-started/quick-start');
  });

  it('returns no prev for first item (index)', () => {
    const { prev, next } = getAdjacentDocs('index');
    expect(prev).toBeUndefined();
    expect(next).toBeDefined();
  });

  it('returns no next for last item', () => {
    const flat = flattenNav();
    const lastSlug = flat[flat.length - 1].slug!;
    const { prev, next } = getAdjacentDocs(lastSlug);
    expect(prev).toBeDefined();
    expect(next).toBeUndefined();
  });

  it('returns empty object for non-existent slug', () => {
    const result = getAdjacentDocs('non-existent');
    expect(result).toEqual({});
  });

  it('crosses section boundaries', () => {
    // Last item of getting-started section → first item of guide section
    const { next } = getAdjacentDocs('getting-started/configuration');
    expect(next?.slug).toBe('guide');
  });
});

describe('slugToArray', () => {
  it('converts "index" to empty array', () => {
    expect(slugToArray('index')).toEqual([]);
  });

  it('converts single segment', () => {
    expect(slugToArray('getting-started')).toEqual(['getting-started']);
  });

  it('converts multi-segment slug', () => {
    expect(slugToArray('guide/environments')).toEqual(['guide', 'environments']);
  });

  it('converts deeply nested slug', () => {
    expect(slugToArray('a/b/c')).toEqual(['a', 'b', 'c']);
  });
});

describe('arrayToSlug', () => {
  it('converts empty array to "index"', () => {
    expect(arrayToSlug([])).toBe('index');
  });

  it('converts undefined to "index"', () => {
    expect(arrayToSlug(undefined)).toBe('index');
  });

  it('converts single element array', () => {
    expect(arrayToSlug(['getting-started'])).toBe('getting-started');
  });

  it('converts multi-element array', () => {
    expect(arrayToSlug(['guide', 'environments'])).toBe('guide/environments');
  });

  it('is inverse of slugToArray for non-index slugs', () => {
    const slug = 'guide/environments';
    expect(arrayToSlug(slugToArray(slug))).toBe(slug);
  });

  it('is inverse of slugToArray for index', () => {
    expect(arrayToSlug(slugToArray('index'))).toBe('index');
  });
});
