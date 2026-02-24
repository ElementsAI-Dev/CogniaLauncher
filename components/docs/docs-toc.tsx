'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import GithubSlugger from 'github-slugger';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/providers/locale-provider';
import { List } from 'lucide-react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocsTocProps {
  content: string;
  className?: string;
  mode?: 'desktop' | 'mobile' | 'both';
}

export function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const slugger = new GithubSlugger();
  const lines = markdown.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Match h2 and h3 only (## and ###)
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2]
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
      const id = slugger.slug(text);
      headings.push({ id, text, level });
    }
  }

  return headings;
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
  const [activeId, setActiveId] = useState<string>('');
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    if (isScrollingRef.current) return;
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setActiveId(entry.target.id);
        break;
      }
    }
  }, []);

  useEffect(() => {
    // Only track active heading for desktop mode (mobile collapses after click)
    if (mode === 'mobile') return;

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: '-80px 0px -70% 0px',
      threshold: 0,
    });

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [headings, handleObserver, mode]);

  const handleItemClick = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    // Suppress observer updates during programmatic scroll
    isScrollingRef.current = true;
    setActiveId(id);
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);

    // Re-enable observer after scroll settles
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 1000);

    setMobileOpen(false);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

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
