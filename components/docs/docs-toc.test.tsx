// Mock github-slugger (ESM-only package) with a CJS-compatible implementation
jest.mock('github-slugger', () => {
  const regex = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;
  class GithubSlugger {
    occurrences = new Map<string, number>();
    slug(value: string) {
      const result = value.toLowerCase().replace(regex, '').replace(/ /g, '-');
      const count = this.occurrences.get(result) ?? 0;
      this.occurrences.set(result, count + 1);
      if (count > 0) return `${result}-${count}`;
      return result;
    }
    reset() {
      this.occurrences.clear();
    }
  }
  return { __esModule: true, default: GithubSlugger };
});

import { extractHeadings } from './docs-toc';

describe('extractHeadings', () => {
  it('extracts h2 and h3 headings', () => {
    const md = '## Hello\n### World\n#### Ignored';
    const result = extractHeadings(md);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'hello', text: 'Hello', level: 2 });
    expect(result[1]).toEqual({ id: 'world', text: 'World', level: 3 });
  });

  it('strips bold markers', () => {
    const md = '## **Bold** heading';
    const result = extractHeadings(md);
    expect(result[0].text).toBe('Bold heading');
    expect(result[0].id).toBe('bold-heading');
  });

  it('strips inline code', () => {
    const md = '## `next.config.ts` 配置';
    const result = extractHeadings(md);
    expect(result[0].text).toBe('next.config.ts 配置');
  });

  it('strips markdown links', () => {
    const md = '## [安装指南](installation.md)';
    const result = extractHeadings(md);
    expect(result[0].text).toBe('安装指南');
  });

  it('handles CJK headings', () => {
    const md = '## 核心功能\n### 版本安装\n## Provider 系统';
    const result = extractHeadings(md);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('核心功能');
    expect(result[1].id).toBe('版本安装');
    expect(result[2].id).toBe('provider-系统');
  });

  it('handles duplicate headings with github-slugger deduplication', () => {
    const md = '## 概览\n## 概览\n## 概览';
    const result = extractHeadings(md);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('概览');
    expect(result[1].id).toBe('概览-1');
    expect(result[2].id).toBe('概览-2');
  });

  it('skips headings inside fenced code blocks', () => {
    const md = '## Real heading\n```\n## Fake heading\n```\n## Another real';
    const result = extractHeadings(md);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Real heading');
    expect(result[1].text).toBe('Another real');
  });

  it('skips headings inside code blocks with language', () => {
    const md = '## Before\n```typescript\n## Inside code\n```\n## After';
    const result = extractHeadings(md);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Before');
    expect(result[1].text).toBe('After');
  });

  it('handles special characters like CI/CD', () => {
    const md = '## CI/CD';
    const result = extractHeadings(md);
    expect(result[0].text).toBe('CI/CD');
    expect(result[0].id).toBe('cicd');
  });

  it('handles mixed English and Chinese', () => {
    const md = '## Zustand Stores\n### CSS 变量\n## React Hooks';
    const result = extractHeadings(md);
    expect(result[0].id).toBe('zustand-stores');
    expect(result[1].id).toBe('css-变量');
    expect(result[2].id).toBe('react-hooks');
  });

  it('returns empty array for content with no headings', () => {
    const md = 'Just a paragraph\n\nAnother paragraph';
    expect(extractHeadings(md)).toEqual([]);
  });

  it('ignores h1 headings', () => {
    const md = '# Title\n## Subtitle';
    const result = extractHeadings(md);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Subtitle');
  });

  it('resets slugger between calls (no cross-call dedup)', () => {
    const md = '## Test';
    const r1 = extractHeadings(md);
    const r2 = extractHeadings(md);
    expect(r1[0].id).toBe('test');
    expect(r2[0].id).toBe('test');
  });
});
