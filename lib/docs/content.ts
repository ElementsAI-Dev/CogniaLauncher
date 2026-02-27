import fs from 'fs';
import path from 'path';

const DOCS_ROOT = path.join(process.cwd(), 'docs');

export type DocLocale = 'zh' | 'en';

function getDocsDir(locale: DocLocale = 'zh'): string {
  return path.join(DOCS_ROOT, locale);
}

export function resolveDocPath(slug?: string[], locale: DocLocale = 'zh'): string {
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

export function getDocContent(slug?: string[], locale: DocLocale = 'zh'): string | null {
  const filePath = resolveDocPath(slug, locale);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function getDocContentBilingual(slug?: string[]): { zh: string | null; en: string | null } {
  return {
    zh: getDocContent(slug, 'zh'),
    en: getDocContent(slug, 'en'),
  };
}

export function getDocBasePath(slug?: string[], locale: DocLocale = 'zh'): string | undefined {
  if (!slug || slug.length === 0) return undefined;
  const docsDir = getDocsDir(locale);
  const filePath = resolveDocPath(slug, locale);
  const relative = path.relative(docsDir, filePath);
  const dir = path.dirname(relative).replace(/\\/g, '/');
  return dir === '.' ? undefined : dir;
}

export function getAllDocSlugs(): string[][] {
  const slugs: string[][] = [];
  const docsDir = getDocsDir('zh');

  function scanDir(dir: string, prefix: string[]) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        scanDir(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const name = entry.name.replace(/\.md$/, '');
        if (name === 'index' && prefix.length === 0) {
          slugs.push([]);
        } else if (name === 'index') {
          slugs.push(prefix);
        } else {
          slugs.push([...prefix, name]);
        }
      }
    }
  }

  scanDir(docsDir, []);
  return slugs;
}
