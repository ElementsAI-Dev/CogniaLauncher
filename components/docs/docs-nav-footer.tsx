'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLocale } from '@/components/providers/locale-provider';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { slugToArray } from '@/lib/docs/navigation';
import { getDocsEditUrl } from '@/lib/docs/source';
import type { DocNavLink } from '@/types/docs';

interface DocsNavFooterProps {
  prev?: DocNavLink;
  next?: DocNavLink;
  slug?: string;
  sourcePath?: string;
}

export function DocsNavFooter({ prev, next, slug, sourcePath }: DocsNavFooterProps) {
  const { t, locale } = useLocale();
  void slug;

  const getTitle = (item: { title: string; titleEn?: string }) =>
    locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  const getHref = (s: string) => {
    const arr = slugToArray(s);
    return arr.length === 0 ? '/docs' : `/docs/${arr.join('/')}`;
  };

  const editUrl = sourcePath ? getDocsEditUrl(sourcePath) : undefined;

  return (
    <footer className="mt-12 space-y-4" aria-label="Page navigation">
      <Separator />
      {editUrl && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">
            <a href={editUrl} target="_blank" rel="noopener noreferrer">
              <Pencil className="h-3 w-3" />
              {t('docs.editOnGithub')}
            </a>
          </Button>
        </div>
      )}
      {(prev || next) && (
        <nav className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center" aria-label="Adjacent pages">
          {prev ? (
            <Button variant="outline" asChild className="gap-2 max-w-full sm:max-w-[48%] justify-start">
              <Link href={getHref(prev.slug)}>
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <div className="text-left min-w-0">
                  <div className="text-xs text-muted-foreground">{t('docs.previousPage')}</div>
                  <div className="text-sm truncate" title={getTitle(prev)}>{getTitle(prev)}</div>
                </div>
              </Link>
            </Button>
          ) : (
            <span className="hidden sm:block" aria-hidden="true" />
          )}
          {next ? (
            <Button variant="outline" asChild className="gap-2 max-w-full sm:max-w-[48%] justify-end sm:ml-auto">
              <Link href={getHref(next.slug)}>
                <div className="text-right min-w-0">
                  <div className="text-xs text-muted-foreground">{t('docs.nextPage')}</div>
                  <div className="text-sm truncate" title={getTitle(next)}>{getTitle(next)}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
            </Button>
          ) : (
            <span className="hidden sm:block" aria-hidden="true" />
          )}
        </nav>
      )}
    </footer>
  );
}
