import { resolveDocPath, getDocContent, getDocContentBilingual, getAllDocSlugs, getDocBasePath } from './content';
import path from 'path';

// Use real filesystem — these tests run against the actual docs/ directory

const DOCS_ROOT = path.join(process.cwd(), 'docs');
const DOCS_ZH = path.join(DOCS_ROOT, 'zh');

describe('resolveDocPath', () => {
  it('resolves empty slug to docs/index.md', () => {
    expect(resolveDocPath([])).toBe(path.join(DOCS_ZH, 'index.md'));
  });

  it('resolves undefined slug to docs/index.md', () => {
    expect(resolveDocPath(undefined)).toBe(path.join(DOCS_ZH, 'index.md'));
  });

  it('resolves direct file slug', () => {
    const result = resolveDocPath(['guide', 'environments']);
    expect(result).toBe(path.join(DOCS_ZH, 'guide', 'environments.md'));
  });

  it('falls back to index.md for directory slug', () => {
    // 'getting-started' has no getting-started.md, only getting-started/index.md
    const result = resolveDocPath(['getting-started']);
    expect(result).toBe(path.join(DOCS_ZH, 'getting-started', 'index.md'));
  });

  it('returns direct path even if file does not exist', () => {
    const result = resolveDocPath(['nonexistent', 'page']);
    expect(result).toBe(path.join(DOCS_ZH, 'nonexistent', 'page.md'));
  });
});

describe('getDocContent', () => {
  it('returns zh content for root index by default', () => {
    const content = getDocContent([]);
    expect(content).not.toBeNull();
    expect(content).toContain('CogniaLauncher');
  });

  it('returns content for undefined slug (root index)', () => {
    const content = getDocContent(undefined);
    expect(content).not.toBeNull();
    expect(content).toContain('CogniaLauncher');
  });

  it('returns zh content for direct file', () => {
    const content = getDocContent(['guide', 'environments'], 'zh');
    expect(content).not.toBeNull();
    expect(content).toContain('环境管理');
  });

  it('returns en content for direct file', () => {
    const content = getDocContent(['guide', 'environments'], 'en');
    expect(content).not.toBeNull();
    expect(content).toContain('Environment Management');
  });

  it('returns content for section index via directory slug', () => {
    const content = getDocContent(['getting-started']);
    expect(content).not.toBeNull();
    expect(content).toContain('快速开始');
  });

  it('returns null for non-existent file', () => {
    const content = getDocContent(['nonexistent', 'page']);
    expect(content).toBeNull();
  });
});

describe('getDocContentBilingual', () => {
  it('returns both zh and en content for root index', () => {
    const { zh, en } = getDocContentBilingual([]);
    expect(zh).not.toBeNull();
    expect(en).not.toBeNull();
    expect(zh).toContain('CogniaLauncher');
    expect(en).toContain('CogniaLauncher');
  });

  it('returns null for non-existent slug in both locales', () => {
    const { zh, en } = getDocContentBilingual(['nonexistent', 'page']);
    expect(zh).toBeNull();
    expect(en).toBeNull();
  });
});

describe('getAllDocSlugs', () => {
  it('returns array of slug arrays', () => {
    const slugs = getAllDocSlugs();
    expect(Array.isArray(slugs)).toBe(true);
    expect(slugs.length).toBeGreaterThan(30);
  });

  it('includes root index as empty array', () => {
    const slugs = getAllDocSlugs();
    expect(slugs).toContainEqual([]);
  });

  it('includes section index pages as directory-only arrays', () => {
    const slugs = getAllDocSlugs();
    expect(slugs).toContainEqual(['getting-started']);
    expect(slugs).toContainEqual(['guide']);
    expect(slugs).toContainEqual(['architecture']);
  });

  it('includes direct file pages', () => {
    const slugs = getAllDocSlugs();
    expect(slugs).toContainEqual(['guide', 'environments']);
    expect(slugs).toContainEqual(['getting-started', 'installation']);
    expect(slugs).toContainEqual(['reference', 'commands']);
  });

  it('does not include index as explicit slug element', () => {
    const slugs = getAllDocSlugs();
    // No slug should end with 'index'
    for (const slug of slugs) {
      if (slug.length > 0) {
        expect(slug[slug.length - 1]).not.toBe('index');
      }
    }
  });

  it('every slug resolves to readable content', () => {
    const slugs = getAllDocSlugs();
    for (const slug of slugs) {
      const content = getDocContent(slug);
      expect(content).not.toBeNull();
    }
  });
});

describe('getDocBasePath', () => {
  it('returns undefined for root index (empty slug)', () => {
    expect(getDocBasePath([])).toBeUndefined();
  });

  it('returns undefined for undefined slug', () => {
    expect(getDocBasePath(undefined)).toBeUndefined();
  });

  it('returns directory for section index page', () => {
    expect(getDocBasePath(['getting-started'])).toBe('getting-started');
  });

  it('returns directory for direct file', () => {
    expect(getDocBasePath(['guide', 'environments'])).toBe('guide');
  });

  it('returns directory for nested file', () => {
    expect(getDocBasePath(['architecture', 'overview'])).toBe('architecture');
  });

  it('returns directory for en locale', () => {
    expect(getDocBasePath(['guide', 'environments'], 'en')).toBe('guide');
  });

  it('returns undefined for non-existent file at root level', () => {
    expect(getDocBasePath(['nonexistent'])).toBeUndefined();
  });
});
