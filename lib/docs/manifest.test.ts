import { getDocsManifest, getDocsRouteData } from './manifest';

describe('getDocsManifest', () => {
  it('builds a docs manifest keyed by slug with locale-backed entries', () => {
    const manifest = getDocsManifest();

    expect(manifest.entries.length).toBeGreaterThan(30);
    expect(manifest.bySlug.has('index')).toBe(true);

    const root = manifest.bySlug.get('index');
    expect(root).toEqual(expect.objectContaining({
      slug: 'index',
      slugParts: [],
    }));
    expect(root?.locales.en).toEqual(expect.objectContaining({
      sourcePath: 'docs/en/index.md',
      locale: 'en',
    }));
    expect(root?.locales.zh).toEqual(expect.objectContaining({
      sourcePath: 'docs/zh/index.md',
      locale: 'zh',
    }));
  });

  it('keeps search coverage aligned with the published slug set', () => {
    const manifest = getDocsManifest();
    const indexedSlugs = new Set(manifest.searchIndex.map((entry) => entry.pageSlug));

    for (const entry of manifest.entries) {
      expect(indexedSlugs.has(entry.slug)).toBe(true);
    }
  });
});

describe('getDocsRouteData', () => {
  it('prefers the server-default English doc when it exists', () => {
    const routeData = getDocsRouteData(['guide']);

    expect(routeData.docEn).toEqual(expect.objectContaining({
      locale: 'en',
      sourcePath: 'docs/en/guide/index.md',
    }));
    expect(routeData.docZh).toEqual(expect.objectContaining({
      locale: 'zh',
      sourcePath: 'docs/zh/guide/index.md',
    }));
    expect(routeData.renderedDoc).toEqual(expect.objectContaining({
      locale: 'en',
      sourcePath: 'docs/en/guide/index.md',
    }));
    expect(routeData.basePath).toBe('guide');
  });

  it('can prefer Chinese docs and keeps the root page basePath undefined', () => {
    const routeData = getDocsRouteData([], 'zh');

    expect(routeData.docEn).toEqual(expect.objectContaining({
      sourcePath: 'docs/en/index.md',
    }));
    expect(routeData.docZh).toEqual(expect.objectContaining({
      sourcePath: 'docs/zh/index.md',
    }));
    expect(routeData.renderedDoc).toEqual(expect.objectContaining({
      locale: 'zh',
      sourcePath: 'docs/zh/index.md',
    }));
    expect(routeData.basePath).toBeUndefined();
  });

  it('returns null docs for unknown slugs while preserving the shared search index', () => {
    const routeData = getDocsRouteData(['missing-doc']);

    expect(routeData.docEn).toBeNull();
    expect(routeData.docZh).toBeNull();
    expect(routeData.renderedDoc).toBeNull();
    expect(routeData.basePath).toBeUndefined();
    expect(routeData.searchIndex.length).toBeGreaterThan(0);
  });
});

describe('getDocsManifest search fallbacks', () => {
  it('creates page-level search entries when heading extraction returns no headings', () => {
    jest.isolateModules(() => {
      jest.doMock('./headings', () => ({
        extractMarkdownHeadings: () => [],
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDocsManifest: getManifestWithoutHeadings } = require('./manifest');
      const manifest = getManifestWithoutHeadings();

      expect(
        manifest.searchIndex.some(
          (entry: { anchorId: string; sectionTitle: string; slug: string }) =>
            entry.anchorId === '' && entry.sectionTitle === entry.slug
        )
      ).toBe(true);

      jest.dontMock('./headings');
    });
  });
});
