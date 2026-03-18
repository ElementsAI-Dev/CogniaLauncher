import type { Locale } from './i18n';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface DocNavLink {
  title: string;
  titleEn?: string;
  slug: string;
}

export interface DocPageData {
  locale: Locale;
  content: string;
  sourcePath: string;
  lastModified: string | null;
}

export type DocsTocMode = 'desktop' | 'mobile' | 'both';
