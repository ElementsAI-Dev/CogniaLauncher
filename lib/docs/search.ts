import { flattenNav, type DocNavItem } from './navigation';
import type { DocSearchEntry } from './content';

export interface DocSearchResult {
  title: string;
  titleEn?: string;
  slug: string;
  /** Matched text snippet */
  snippet: string;
  /** Match score (higher = better) */
  score: number;
}

/**
 * Search docs by matching against nav titles, headings, and content excerpts.
 * When searchIndex is provided, also searches headings and excerpts from each doc.
 */
export function searchDocs(query: string, locale: string, searchIndex?: DocSearchEntry[]): DocSearchResult[] {
  if (!query.trim()) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const terms = normalizedQuery.split(/\s+/);
  const flat = flattenNav();
  const results: DocSearchResult[] = [];
  const seen = new Set<string>();

  // Build a map from slug to search entry for quick lookup
  const indexMap = new Map<string, DocSearchEntry>();
  if (searchIndex) {
    for (const entry of searchIndex) {
      indexMap.set(entry.slug, entry);
    }
  }

  for (const item of flat) {
    if (!item.slug) continue;
    const navScore = scoreNavItem(item, terms, locale);
    const entry = indexMap.get(item.slug);
    const contentScore = entry ? scoreContentEntry(entry, terms, locale) : 0;
    const totalScore = navScore + contentScore;

    if (totalScore > 0) {
      const title = locale === 'en' ? (item.titleEn ?? item.title) : item.title;
      const snippet = entry ? getBestSnippet(entry, terms, locale, title) : title;
      results.push({
        title: item.title,
        titleEn: item.titleEn,
        slug: item.slug,
        snippet,
        score: totalScore,
      });
      seen.add(item.slug);
    }
  }

  // Also check index entries that may not be in nav (unlikely but safe)
  if (searchIndex) {
    for (const entry of searchIndex) {
      if (seen.has(entry.slug)) continue;
      const score = scoreContentEntry(entry, terms, locale);
      if (score > 0) {
        results.push({
          title: entry.slug,
          slug: entry.slug,
          snippet: getBestSnippet(entry, terms, locale, entry.slug),
          score,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 15);
}

function scoreNavItem(item: DocNavItem, terms: string[], locale: string): number {
  const title = (locale === 'en' ? (item.titleEn ?? item.title) : item.title).toLowerCase();
  const slug = (item.slug ?? '').toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) {
      score += title === term ? 10 : 5;
    } else if (slug.includes(term)) {
      score += 2;
    }
    const altTitle = (locale === 'en' ? item.title : (item.titleEn ?? '')).toLowerCase();
    if (altTitle.includes(term)) {
      score += 3;
    }
  }

  return score;
}

function scoreContentEntry(entry: DocSearchEntry, terms: string[], locale: string): number {
  const headings = (locale === 'en' ? entry.headingsEn : entry.headingsZh).map(h => h.toLowerCase());
  const excerpt = (locale === 'en' ? entry.excerptEn : entry.excerptZh).toLowerCase();
  let score = 0;

  for (const term of terms) {
    for (const heading of headings) {
      if (heading.includes(term)) {
        score += heading === term ? 8 : 4;
        break;
      }
    }
    if (excerpt.includes(term)) {
      score += 2;
    }
  }

  return score;
}

function getBestSnippet(entry: DocSearchEntry, terms: string[], locale: string, fallback: string): string {
  const headings = locale === 'en' ? entry.headingsEn : entry.headingsZh;
  const excerpt = locale === 'en' ? entry.excerptEn : entry.excerptZh;

  // Find matching heading
  for (const heading of headings) {
    const lower = heading.toLowerCase();
    if (terms.some(t => lower.includes(t))) {
      return heading;
    }
  }

  // Find matching excerpt fragment
  if (excerpt) {
    const lower = excerpt.toLowerCase();
    for (const term of terms) {
      const idx = lower.indexOf(term);
      if (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(excerpt.length, idx + term.length + 50);
        const fragment = (start > 0 ? '...' : '') + excerpt.slice(start, end) + (end < excerpt.length ? '...' : '');
        return fragment;
      }
    }
  }

  return fallback;
}
