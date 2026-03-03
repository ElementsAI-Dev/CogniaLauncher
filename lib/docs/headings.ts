import type { TocItem } from '@/types/docs';

export interface ExtractMarkdownHeadingsOptions {
  minLevel?: number;
  maxLevel?: number;
}

export interface MarkdownHeading {
  id: string;
  text: string;
  level: number;
}

const DEFAULT_MIN_LEVEL = 1;
const DEFAULT_MAX_LEVEL = 6;
const SLUG_REGEX = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;

class HeadingSlugger {
  private occurrences = new Map<string, number>();

  slug(value: string): string {
    const normalized = value
      .toLowerCase()
      .replace(SLUG_REGEX, '')
      .trim()
      .replace(/\s+/g, '-');

    const key = normalized;
    const count = this.occurrences.get(key) ?? 0;
    this.occurrences.set(key, count + 1);
    return count > 0 ? `${key}-${count}` : key;
  }
}

function sanitizeHeadingText(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

export function extractMarkdownHeadings(
  markdown: string,
  options: ExtractMarkdownHeadingsOptions = {}
): MarkdownHeading[] {
  const minLevel = options.minLevel ?? DEFAULT_MIN_LEVEL;
  const maxLevel = options.maxLevel ?? DEFAULT_MAX_LEVEL;
  const headings: MarkdownHeading[] = [];
  const slugger = new HeadingSlugger();
  const lines = markdown.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      if (level < minLevel || level > maxLevel) {
        continue;
      }
      const text = sanitizeHeadingText(match[2]);
      if (!text) {
        continue;
      }
      const id = slugger.slug(text);
      headings.push({ id, text, level });
    }
  }

  return headings;
}

export function extractHeadingTexts(
  markdown: string,
  options: ExtractMarkdownHeadingsOptions = {}
): string[] {
  return extractMarkdownHeadings(markdown, options).map((heading) => heading.text);
}

export function extractHeadings(markdown: string): TocItem[] {
  return extractMarkdownHeadings(markdown, { minLevel: 2, maxLevel: 3 });
}
