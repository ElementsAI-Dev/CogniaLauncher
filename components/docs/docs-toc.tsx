'use client';

import { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/providers/locale-provider';
import { List } from 'lucide-react';
import type { TocItem, DocsTocMode } from '@/types/docs';
import { extractHeadings } from '@/lib/docs/headings';
import { useActiveHeading } from '@/hooks/use-active-heading';

interface DocsTocProps {
  content: string;
  className?: string;
  mode?: DocsTocMode;
}

function TocNav({
  headings,
  activeId,
  onItemClick,
}: {
  headings: TocItem[];
  activeId: string;
  onItemClick: (id: string) => void;
}) {
  return (
    <nav className="space-y-1">
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className={cn(
            'block text-xs leading-relaxed transition-colors hover:text-foreground',
            heading.level === 3 && 'pl-3',
            activeId === heading.id
              ? 'text-primary font-medium'
              : 'text-muted-foreground'
          )}
          onClick={(e) => {
            e.preventDefault();
            onItemClick(heading.id);
          }}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );
}

export function DocsToc({ content, className, mode = 'both' }: DocsTocProps) {
  const { t } = useLocale();
  const headings = useMemo(() => extractHeadings(content), [content]);
  const headingIds = useMemo(() => headings.map((h) => h.id), [headings]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { activeId, scrollToId } = useActiveHeading(headingIds, {
    enabled: mode !== 'mobile',
  });

  const handleItemClick = (id: string) => {
    scrollToId(id);
    setMobileOpen(false);
  };

  if (headings.length === 0) {
    return null;
  }

  const showDesktop = mode === 'desktop' || mode === 'both';
  const showMobile = mode === 'mobile' || mode === 'both';

  return (
    <>
      {/* Desktop TOC — right sidebar */}
      {showDesktop && (
        <aside className={cn('w-52 shrink-0 hidden xl:block', className)}>
          <div className="sticky top-6">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t('docs.toc')}
            </h3>
            <ScrollArea className="max-h-[calc(100vh-10rem)]">
              <TocNav headings={headings} activeId={activeId} onItemClick={handleItemClick} />
            </ScrollArea>
          </div>
        </aside>
      )}

      {/* Mobile TOC — collapsible above content */}
      {showMobile && (
        <div className="xl:hidden mb-4">
          <Collapsible open={mobileOpen} onOpenChange={setMobileOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
              <List className="h-4 w-4" />
              <span>{t('docs.toc')}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-md border border-border bg-background p-3">
                <TocNav headings={headings} activeId={activeId} onItemClick={handleItemClick} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </>
  );
}
