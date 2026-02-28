import { flattenNav, type DocNavItem } from './navigation';

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
 * Build a lightweight search index from DOC_NAV titles.
 * For client-side search we match against nav item titles only
 * (content search would require pre-built index at build time).
 */
export function searchDocs(query: string, locale: string): DocSearchResult[] {
  if (!query.trim()) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const terms = normalizedQuery.split(/\s+/);
  const flat = flattenNav();
  const results: DocSearchResult[] = [];

  for (const item of flat) {
    if (!item.slug) continue;
    const score = scoreItem(item, terms, locale);
    if (score > 0) {
      const title = locale === 'en' ? (item.titleEn ?? item.title) : item.title;
      results.push({
        title: item.title,
        titleEn: item.titleEn,
        slug: item.slug,
        snippet: title,
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

function scoreItem(item: DocNavItem, terms: string[], locale: string): number {
  const title = (locale === 'en' ? (item.titleEn ?? item.title) : item.title).toLowerCase();
  const slug = (item.slug ?? '').toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) {
      score += title === term ? 10 : 5;
    } else if (slug.includes(term)) {
      score += 2;
    }
    // Also check the other locale title
    const altTitle = (locale === 'en' ? item.title : (item.titleEn ?? '')).toLowerCase();
    if (altTitle.includes(term)) {
      score += 3;
    }
  }

  return score;
}
