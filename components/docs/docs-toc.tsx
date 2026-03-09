'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/providers/locale-provider';
import { ChevronRight, List } from 'lucide-react';
import type { TocItem, DocsTocMode } from '@/types/docs';
import { extractHeadings } from '@/lib/docs/headings';
import { useActiveHeading } from '@/hooks/use-active-heading';

interface DocsTocProps {
  content: string;
  headings?: TocItem[];
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
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeId]);

  return (
    <nav className="space-y-0.5 relative">
      {headings.map((heading) => {
        const isActive = activeId === heading.id;
        return (
          <a
            key={heading.id}
            ref={isActive ? activeRef : undefined}
            href={`#${heading.id}`}
            aria-current={isActive ? 'location' : undefined}
            className={cn(
              'block text-xs leading-relaxed transition-colors hover:text-foreground border-l-2 py-0.5',
              heading.level === 3 ? 'pl-4' : 'pl-3',
              isActive
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground'
            )}
            onClick={(e) => {
              e.preventDefault();
              onItemClick(heading.id);
            }}
          >
            {heading.text}
          </a>
        );
      })}
    </nav>
  );
}

export function DocsToc({ content, headings: headingsProp, className, mode = 'both' }: DocsTocProps) {
  const { t } = useLocale();
  const headings = useMemo(
    () => headingsProp ?? extractHeadings(content),
    [content, headingsProp]
  );
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
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="h-9 w-full justify-start gap-2 bg-muted/30 text-sm font-medium hover:bg-muted/50">
                <List className="h-4 w-4" />
                <span>{t('docs.toc')}</span>
                <ChevronRight className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200', mobileOpen && 'rotate-90')} />
              </Button>
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
