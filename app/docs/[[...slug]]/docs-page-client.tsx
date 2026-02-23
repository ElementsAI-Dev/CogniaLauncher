'use client';

import { PageHeader } from '@/components/layout/page-header';
import { useLocale } from '@/components/providers/locale-provider';
import { MarkdownRenderer, DocsSidebar, DocsToc, DocsNavFooter } from '@/components/docs';
import { getDocTitle, getAdjacentDocs, arrayToSlug } from '@/lib/docs/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DocsPageClientProps {
  content: string;
  slug?: string[];
  basePath?: string;
}

export function DocsPageClient({ content, slug, basePath }: DocsPageClientProps) {
  const { t, locale } = useLocale();
  const currentSlug = arrayToSlug(slug);
  const title = getDocTitle(currentSlug, locale) ?? t('docs.title');
  const adjacent = getAdjacentDocs(currentSlug);
  const prev = adjacent.prev?.slug ? { title: adjacent.prev.title, titleEn: adjacent.prev.titleEn, slug: adjacent.prev.slug } : undefined;
  const next = adjacent.next?.slug ? { title: adjacent.next.title, titleEn: adjacent.next.titleEn, slug: adjacent.next.slug } : undefined;

  return (
    <div className="flex h-full">
      <DocsSidebar className="border-r border-border pl-4 pt-2 hidden md:block" />
      <ScrollArea className="flex-1">
        <main className="p-6 max-w-4xl mx-auto">
          <PageHeader
            title={title}
            description={t('docs.description')}
          />
          <div className="mt-6">
            <MarkdownRenderer content={content} basePath={basePath} />
          </div>
          <DocsNavFooter prev={prev} next={next} />
        </main>
      </ScrollArea>
      <DocsToc content={content} className="border-l border-border pr-4 pt-6" />
    </div>
  );
}
