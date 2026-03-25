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
});
