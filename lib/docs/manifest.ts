import fs from 'fs';
import path from 'path';
import { cache } from 'react';
import type { Locale } from '@/types/i18n';
import type { DocPageData } from '@/types/docs';
import { extractMarkdownHeadings } from './headings';

export type DocLocale = Extract<Locale, 'en' | 'zh'>;

export interface DocSearchEntry {
  slug: string;
  pageSlug: string;
  anchorId: string;
  sectionTitle: string;
  locale: DocLocale;
  excerpt: string;
}

interface ManifestLocaleDoc extends DocPageData {
  filePath: string;
  basePath?: string;
  excerpt: string;
}

export interface DocsManifestEntry {
  slug: string;
  slugParts: string[];
  locales: Partial<Record<DocLocale, ManifestLocaleDoc>>;
}

export interface DocsManifest {
  entries: DocsManifestEntry[];
  bySlug: Map<string, DocsManifestEntry>;
  searchIndex: DocSearchEntry[];
}

export interface DocsRouteData {
  docEn: DocPageData | null;
  docZh: DocPageData | null;
  renderedDoc: DocPageData | null;
  basePath?: string;
  searchIndex: DocSearchEntry[];
}

const DOCS_ROOT = path.join(process.cwd(), 'docs');
const DOC_LOCALES: DocLocale[] = ['zh', 'en'];
const DEFAULT_SERVER_DOC_LOCALE: DocLocale = 'en';

function slugPartsToKey(slug?: string[]): string {
  return !slug || slug.length === 0 ? 'index' : slug.join('/');
}

function toRepoRelativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function getFileLastModified(filePath: string): string | null {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
}

export function extractDocExcerpt(content: string, maxLen = 200): string {
  const lines = content.split('\n');
  let inCode = false;
  const paragraphs: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCode = !inCode;
      continue;
    }

    if (inCode) continue;

    if (
      line.startsWith('#') ||
      line.startsWith('|') ||
      line.startsWith('---') ||
      line.startsWith('- ')
    ) {
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.length > 0) {
      paragraphs.push(trimmed);
      if (paragraphs.join(' ').length >= maxLen) break;
    }
  }

  const text = paragraphs.join(' ');
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function getDocsDir(locale: DocLocale): string {
  return path.join(DOCS_ROOT, locale);
}

function relativeDocPathToSlugParts(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, '/');
  const withoutExt = normalized.replace(/\.md$/i, '');
  const parts = withoutExt.split('/').filter(Boolean);

  if (parts.length === 1 && parts[0] === 'index') {
    return [];
  }

  if (parts[parts.length - 1] === 'index') {
    parts.pop();
  }

  return parts;
}

function relativeDocPathToBasePath(relativePath: string): string | undefined {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized === 'index.md') {
    return undefined;
  }

  if (normalized.endsWith('/index.md')) {
    const base = normalized.slice(0, -'/index.md'.length);
    return base || undefined;
  }

  const dirname = path.dirname(normalized).replace(/\\/g, '/');
  return dirname === '.' ? undefined : dirname;
}

function buildLocaleDocs(locale: DocLocale): Map<string, ManifestLocaleDoc> {
  const docsDir = getDocsDir(locale);
  const docs = new Map<string, ManifestLocaleDoc>();

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }

      const relativePath = path.relative(docsDir, fullPath);
      const slugParts = relativeDocPathToSlugParts(relativePath);
      const slug = slugPartsToKey(slugParts);
      const content = fs.readFileSync(fullPath, 'utf-8');

      docs.set(slug, {
        locale,
        content,
        sourcePath: toRepoRelativePath(fullPath),
        lastModified: getFileLastModified(fullPath),
        filePath: fullPath,
        basePath: relativeDocPathToBasePath(relativePath),
        excerpt: extractDocExcerpt(content),
      });
    }
  }

  scanDir(docsDir);
  return docs;
}

const buildDocsManifestCached = cache((): DocsManifest => {
  const localeDocs = new Map<DocLocale, Map<string, ManifestLocaleDoc>>();
  const slugSet = new Set<string>();

  for (const locale of DOC_LOCALES) {
    const docs = buildLocaleDocs(locale);
    localeDocs.set(locale, docs);
    for (const slug of docs.keys()) {
      slugSet.add(slug);
    }
  }

  const entries = [...slugSet]
    .sort((a, b) => {
      if (a === 'index') return -1;
      if (b === 'index') return 1;
      return a.localeCompare(b);
    })
    .map<DocsManifestEntry>((slug) => {
      const slugParts = slug === 'index' ? [] : slug.split('/');
      return {
        slug,
        slugParts,
        locales: {
          zh: localeDocs.get('zh')?.get(slug),
          en: localeDocs.get('en')?.get(slug),
        },
      };
    });

  const searchIndex: DocSearchEntry[] = [];
  for (const entry of entries) {
    for (const locale of DOC_LOCALES) {
      const localeDoc = entry.locales[locale];
      if (!localeDoc) continue;

      const headings = extractMarkdownHeadings(localeDoc.content, {
        minLevel: 1,
        maxLevel: 4,
      });

      if (headings.length === 0) {
        searchIndex.push({
          slug: entry.slug,
          pageSlug: entry.slug,
          anchorId: '',
          sectionTitle: entry.slug,
          locale,
          excerpt: localeDoc.excerpt,
        });
        continue;
      }

      for (const heading of headings) {
        searchIndex.push({
          slug: entry.slug,
          pageSlug: entry.slug,
          anchorId: heading.id,
          sectionTitle: heading.text,
          locale,
          excerpt: localeDoc.excerpt,
        });
      }
    }
  }

  return {
    entries,
    bySlug: new Map(entries.map((entry) => [entry.slug, entry])),
    searchIndex,
  };
});

function toDocPageData(doc?: ManifestLocaleDoc): DocPageData | null {
  if (!doc) return null;
  const { locale, content, sourcePath, lastModified } = doc;
  return { locale, content, sourcePath, lastModified };
}

const getDocsRouteDataCached = cache((slugKey: string, preferredLocale: DocLocale): DocsRouteData => {
  const manifest = getDocsManifest();
  const entry = manifest.bySlug.get(slugKey);
  const docEn = toDocPageData(entry?.locales.en);
  const docZh = toDocPageData(entry?.locales.zh);
  const renderedDoc = preferredLocale === 'en'
    ? (docEn ?? docZh)
    : (docZh ?? docEn);
  const renderedLocaleDoc = renderedDoc ? entry?.locales[renderedDoc.locale] : undefined;

  return {
    docEn,
    docZh,
    renderedDoc,
    basePath: renderedLocaleDoc?.basePath,
    searchIndex: manifest.searchIndex,
  };
});

export function getDocsManifest(): DocsManifest {
  return buildDocsManifestCached();
}

export function getDocsRouteData(slug?: string[], preferredLocale: DocLocale = DEFAULT_SERVER_DOC_LOCALE): DocsRouteData {
  return getDocsRouteDataCached(slugPartsToKey(slug), preferredLocale);
}
