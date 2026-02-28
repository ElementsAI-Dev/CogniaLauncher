'use client';

import { useMemo, useRef } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useLocale } from '@/components/providers/locale-provider';
import {
  MarkdownRenderer,
  DocsSidebar,
  DocsMobileSidebar,
  DocsToc,
  DocsNavFooter,
  DocsBreadcrumb,
  DocsScrollProgress,
} from '@/components/docs';
import { getDocTitle, getAdjacentDocs, arrayToSlug } from '@/lib/docs/navigation';
import { estimateReadingTime } from '@/lib/docs/reading-time';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock } from 'lucide-react';

interface DocsPageClientProps {
  contentZh: string | null;
  contentEn: string | null;
  slug?: string[];
  basePath?: string;
}

export function DocsPageClient({ contentZh, contentEn, slug, basePath }: DocsPageClientProps) {
  const { t, locale } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentSlug = arrayToSlug(slug);
  const title = getDocTitle(currentSlug, locale) ?? t('docs.title');
  const adjacent = getAdjacentDocs(currentSlug);
  const prev = adjacent.prev?.slug ? { title: adjacent.prev.title, titleEn: adjacent.prev.titleEn, slug: adjacent.prev.slug } : undefined;
  const next = adjacent.next?.slug ? { title: adjacent.next.title, titleEn: adjacent.next.titleEn, slug: adjacent.next.slug } : undefined;

  // Select content based on locale, with fallback to the other language
  const content = (locale === 'en' ? (contentEn ?? contentZh) : (contentZh ?? contentEn)) ?? '';

  const readingTime = useMemo(() => estimateReadingTime(content), [content]);

  return (
    <div className="flex h-full">
      <DocsSidebar className="border-r border-border pl-4 pt-2 hidden md:block" />
      <div className="flex-1 flex flex-col min-w-0" ref={scrollRef}>
        <DocsScrollProgress containerRef={scrollRef} />
        <ScrollArea className="flex-1">
          <main className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-2 mb-2">
              <DocsBreadcrumb slug={currentSlug} className="mb-0" />
              <DocsMobileSidebar />
            </div>
            <PageHeader
              title={title}
              description={t('docs.description')}
              actions={
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t('docs.readingTime', { count: readingTime })}
                </span>
              }
            />
            <DocsToc content={content} mode="mobile" />
            <div className="mt-6">
              <MarkdownRenderer content={content} basePath={basePath} />
            </div>
            <DocsNavFooter prev={prev} next={next} slug={currentSlug} />
          </main>
        </ScrollArea>
      </div>
      <DocsToc content={content} mode="desktop" className="border-l border-border pr-4 pt-6" />
    </div>
  );
}
