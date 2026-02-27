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

export type DocsTocMode = 'desktop' | 'mobile' | 'both';
