'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useLocale } from '@/components/providers/locale-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MarkdownRenderer,
  DocsSidebar,
  DocsMobileSidebar,
  DocsToc,
  DocsNavFooter,
  DocsBreadcrumb,
  DocsScrollProgress,
  DocsHomeCards,
} from '@/components/docs';
import { getDocTitle, getAdjacentDocs, arrayToSlug } from '@/lib/docs/navigation';
import { estimateReadingTime } from '@/lib/docs/reading-time';
import { extractHeadings } from '@/lib/docs/headings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Info } from 'lucide-react';
import type { DocSearchEntry } from '@/lib/docs/content';
import type { Locale } from '@/types/i18n';
import type { DocPageData } from '@/types/docs';

interface DocsPageClientProps {
  docZh: DocPageData | null;
  docEn: DocPageData | null;
  slug?: string[];
  basePath?: string;
  searchIndex?: DocSearchEntry[];
}

function getLocaleLabel(t: (key: string, params?: Record<string, string | number>) => string, locale: Locale) {
  return locale === 'en' ? t('docs.languageEnglish') : t('docs.languageChinese');
}

function formatLastUpdated(lastModified: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(lastModified));
}

export function DocsPageClient({ docZh, docEn, slug, basePath, searchIndex }: DocsPageClientProps) {
  const { t, locale } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentSlug = arrayToSlug(slug);
  const title = getDocTitle(currentSlug, locale) ?? t('docs.title');
  const adjacent = getAdjacentDocs(currentSlug);
  const prev = adjacent.prev?.slug ? { title: adjacent.prev.title, titleEn: adjacent.prev.titleEn, slug: adjacent.prev.slug } : undefined;
  const next = adjacent.next?.slug ? { title: adjacent.next.title, titleEn: adjacent.next.titleEn, slug: adjacent.next.slug } : undefined;

  const localeDoc = locale === 'en' ? docEn : docZh;
  const fallbackDoc = locale === 'en' ? docZh : docEn;
  const renderedDoc = localeDoc ?? fallbackDoc;
  const content = renderedDoc?.content ?? '';
  const effectiveLocale = renderedDoc?.locale ?? null;
  const isFallback = !!renderedDoc && effectiveLocale !== locale;

  const readingTime = useMemo(() => estimateReadingTime(content), [content]);
  const headings = useMemo(() => extractHeadings(content), [content]);
  const lastUpdatedText = renderedDoc?.lastModified && effectiveLocale
    ? formatLastUpdated(renderedDoc.lastModified, effectiveLocale)
    : null;

  const scrollToHashTarget = useCallback(() => {
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    if (!rawHash) return;

    let targetId = rawHash;
    try {
      targetId = decodeURIComponent(rawHash);
    } catch {
      // Keep raw hash when decode fails.
    }

    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const main = document.querySelector('main');
    if (main instanceof HTMLElement) {
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    scrollToHashTarget();
    window.addEventListener('hashchange', scrollToHashTarget);
    return () => window.removeEventListener('hashchange', scrollToHashTarget);
  }, [content, scrollToHashTarget]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_14rem]">
      <DocsSidebar className="hidden border-r border-border px-3 pt-2 lg:block" searchIndex={searchIndex} />
      <section className="relative flex min-h-0 min-w-0 flex-col" ref={scrollRef}>
        <DocsScrollProgress containerRef={scrollRef} />
        <ScrollArea className="flex-1">
          <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <DocsBreadcrumb slug={currentSlug} className="mb-0" />
                <DocsMobileSidebar searchIndex={searchIndex} />
              </div>
              <PageHeader
                title={title}
                description={t('docs.description')}
                actions={
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {t('docs.readingTime', { count: readingTime })}
                    </span>
                    {lastUpdatedText && renderedDoc?.lastModified && (
                      <span className="flex items-center gap-1.5">
                        <span>{t('docs.lastUpdated')}</span>
                        <time dateTime={renderedDoc.lastModified}>{lastUpdatedText}</time>
                      </span>
                    )}
                  </div>
                }
              />
            </header>
            {isFallback && effectiveLocale && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {t('docs.fallbackNotice', {
                    effectiveLanguage: getLocaleLabel(t, effectiveLocale),
                    requestedLanguage: getLocaleLabel(t, locale),
                  })}
                </AlertDescription>
              </Alert>
            )}
            <section aria-label={t('docs.toc')}>
              <DocsToc content={content} headings={headings} mode="mobile" />
            </section>
            <article className="mt-6">
              <MarkdownRenderer content={content} basePath={basePath} />
            </article>
            {currentSlug === 'index' && <DocsHomeCards />}
            <DocsNavFooter prev={prev} next={next} slug={currentSlug} sourcePath={renderedDoc?.sourcePath} />
          </main>
        </ScrollArea>
      </section>
      <aside className="hidden xl:block">
        <DocsToc content={content} headings={headings} mode="desktop" className="border-l border-border px-4 pt-6" />
      </aside>
    </div>
  );
}
