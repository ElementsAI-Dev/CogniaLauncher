'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { slugToArray } from '@/lib/docs/navigation';

interface DocsNavFooterProps {
  prev?: { title: string; titleEn?: string; slug: string };
  next?: { title: string; titleEn?: string; slug: string };
}

export function DocsNavFooter({ prev, next }: DocsNavFooterProps) {
  const { t, locale } = useLocale();

  if (!prev && !next) return null;

  const getTitle = (item: { title: string; titleEn?: string }) =>
    locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  const getHref = (slug: string) => {
    const arr = slugToArray(slug);
    return arr.length === 0 ? '/docs' : `/docs/${arr.join('/')}`;
  };

  return (
    <div className="mt-12 flex items-center justify-between border-t pt-6">
      {prev ? (
        <Button variant="outline" asChild className="gap-2">
          <Link href={getHref(prev.slug)}>
            <ChevronLeft className="h-4 w-4" />
            <div className="text-left">
              <div className="text-xs text-muted-foreground">{t('docs.previousPage')}</div>
              <div className="text-sm">{getTitle(prev)}</div>
            </div>
          </Link>
        </Button>
      ) : (
        <div />
      )}
      {next ? (
        <Button variant="outline" asChild className="gap-2">
          <Link href={getHref(next.slug)}>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t('docs.nextPage')}</div>
              <div className="text-sm">{getTitle(next)}</div>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <div />
      )}
    </div>
  );
}
