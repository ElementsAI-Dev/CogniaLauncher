import { flattenNav, type DocNavItem } from './navigation';
import type { DocSearchEntry } from './content';

export interface DocSearchResult {
  title: string;
  titleEn?: string;
  slug: string;
  anchorId?: string;
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
  const navMap = new Map<string, DocNavItem>();

  for (const item of flat) {
    if (!item.slug) continue;
    navMap.set(item.slug, item);
    const navScore = scoreNavItem(item, terms, locale);
    if (navScore > 0) {
      const title = locale === 'en' ? (item.titleEn ?? item.title) : item.title;
      results.push({
        title: item.title,
        titleEn: item.titleEn,
        slug: item.slug,
        snippet: title,
        score: navScore,
      });
    }
  }

  if (searchIndex) {
    for (const entry of searchIndex) {
      if (entry.locale !== locale) continue;
      const score = scoreSectionEntry(entry, terms);
      if (score > 0) {
        const navItem = navMap.get(entry.pageSlug);
        const fallbackTitle = entry.pageSlug;
        const displayTitle = navItem
          ? (locale === 'en' ? (navItem.titleEn ?? navItem.title) : navItem.title)
          : fallbackTitle;
        results.push({
          title: navItem?.title ?? fallbackTitle,
          titleEn: navItem?.titleEn,
          slug: entry.pageSlug,
          anchorId: entry.anchorId || undefined,
          snippet: getBestSnippet(entry, terms, displayTitle),
          score: score + (navItem ? 1 : 0),
        });
      }
    }
  }

  const deduped = new Map<string, DocSearchResult>();
  for (const result of results) {
    const key = `${result.slug}#${result.anchorId ?? ''}`;
    const existing = deduped.get(key);
    if (!existing || existing.score < result.score) {
      deduped.set(key, result);
    }
  }

  return [...deduped.values()].sort((a, b) => b.score - a.score).slice(0, 15);
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

function scoreSectionEntry(entry: DocSearchEntry, terms: string[]): number {
  const section = entry.sectionTitle.toLowerCase();
  const excerpt = entry.excerpt.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (section.includes(term)) {
      score += section === term ? 8 : 5;
    }
    if (excerpt.includes(term)) {
      score += 2;
    }
  }

  return score;
}

function getBestSnippet(entry: DocSearchEntry, terms: string[], fallback: string): string {
  const section = entry.sectionTitle;
  const lowerSection = section.toLowerCase();
  const excerpt = entry.excerpt;

  if (terms.some((term) => lowerSection.includes(term))) {
    return section;
  }

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
