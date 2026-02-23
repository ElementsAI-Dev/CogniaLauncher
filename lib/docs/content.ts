import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'docs');

export function resolveDocPath(slug?: string[]): string {
  if (!slug || slug.length === 0) {
    return path.join(DOCS_DIR, 'index.md');
  }
  const direct = path.join(DOCS_DIR, ...slug) + '.md';
  if (fs.existsSync(direct)) {
    return direct;
  }
  const indexPath = path.join(DOCS_DIR, ...slug, 'index.md');
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }
  return direct;
}

export function getDocContent(slug?: string[]): string | null {
  const filePath = resolveDocPath(slug);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function getDocBasePath(slug?: string[]): string | undefined {
  if (!slug || slug.length === 0) return undefined;
  const filePath = resolveDocPath(slug);
  const relative = path.relative(DOCS_DIR, filePath);
  const dir = path.dirname(relative).replace(/\\/g, '/');
  return dir === '.' ? undefined : dir;
}

export function getAllDocSlugs(): string[][] {
  const slugs: string[][] = [];

  function scanDir(dir: string, prefix: string[]) {
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

  scanDir(DOCS_DIR, []);
  return slugs;
}
