'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { slugToArray } from '@/lib/docs/navigation';
import type { DocNavLink } from '@/types/docs';

const GITHUB_REPO_URL = 'https://github.com/AstroAir/CogniaLauncher';

interface DocsNavFooterProps {
  prev?: DocNavLink;
  next?: DocNavLink;
  slug?: string;
}

export function DocsNavFooter({ prev, next, slug }: DocsNavFooterProps) {
  const { t, locale } = useLocale();

  const getTitle = (item: { title: string; titleEn?: string }) =>
    locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  const getHref = (s: string) => {
    const arr = slugToArray(s);
    return arr.length === 0 ? '/docs' : `/docs/${arr.join('/')}`;
  };

  const editUrl = slug
    ? `${GITHUB_REPO_URL}/edit/main/docs/${locale}/${slug === 'index' ? 'index' : slug}.md`
    : undefined;

  return (
    <div className="mt-12 border-t pt-6 space-y-4">
      {editUrl && (
        <div className="flex justify-end">
          <a
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
            {t('docs.editOnGithub')}
          </a>
        </div>
      )}
      {(prev || next) && (
        <div className="flex items-center justify-between">
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
      )}
    </div>
  );
}
