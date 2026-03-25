import fs from 'fs';
import path from 'path';
import {
  extractDocExcerpt,
  getDocsManifest,
  getDocsRouteData,
  type DocLocale,
  type DocSearchEntry,
} from './manifest';

const DOCS_ROOT = path.join(process.cwd(), 'docs');

function getDocsDir(locale: DocLocale = 'zh'): string {
  return path.join(DOCS_ROOT, locale);
}

function slugKey(slug?: string[]): string {
  return !slug || slug.length === 0 ? 'index' : slug.join('/');
}

export function resolveDocPath(
  slug?: string[],
  locale: DocLocale = 'zh',
): string {
  const manifestEntry = getDocsManifest().bySlug.get(slugKey(slug));
  const manifestPath = manifestEntry?.locales[locale]?.filePath;
  if (manifestPath) {
    return manifestPath;
  }

  const docsDir = getDocsDir(locale);
  if (!slug || slug.length === 0) {
    return path.join(docsDir, 'index.md');
  }

  const direct = path.join(docsDir, ...slug) + '.md';
  if (fs.existsSync(direct)) {
    return direct;
  }

  const indexPath = path.join(docsDir, ...slug, 'index.md');
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }

  return direct;
}

export function getDocContent(
  slug?: string[],
  locale: DocLocale = 'zh',
): string | null {
  return getDocsManifest().bySlug.get(slugKey(slug))?.locales[locale]?.content ?? null;
}

export function getDocContentBilingual(slug?: string[]): {
  zh: string | null;
  en: string | null;
} {
  return {
    zh: getDocContent(slug, 'zh'),
    en: getDocContent(slug, 'en'),
  };
}

export function getDocPageData(
  slug?: string[],
  locale: DocLocale = 'zh',
) {
  const routeData = getDocsRouteData(slug);
  return locale === 'en' ? routeData.docEn : routeData.docZh;
}

export function getDocPageDataBilingual(slug?: string[]) {
  const routeData = getDocsRouteData(slug);
  return {
    zh: routeData.docZh,
    en: routeData.docEn,
  };
}

export function getDocBasePath(
  slug?: string[],
  locale: DocLocale = 'zh',
): string | undefined {
  return getDocsManifest().bySlug.get(slugKey(slug))?.locales[locale]?.basePath;
}

export function buildSearchIndex(): DocSearchEntry[] {
  return getDocsManifest().searchIndex;
}

export function getAllDocSlugs(): string[][] {
  return getDocsManifest().entries.map((entry) => entry.slugParts);
}

export { extractDocExcerpt, getDocsRouteData };
export type { DocLocale, DocSearchEntry };
