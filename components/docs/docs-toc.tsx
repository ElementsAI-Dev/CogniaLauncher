'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/providers/locale-provider';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocsTocProps {
  content: string;
  className?: string;
}

function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Match h2 and h3 only (## and ###)
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').trim();
      // Generate ID matching rehype-slug behavior (github-slugger)
      const id = text
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fff-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+$/, '');
      headings.push({ id, text, level });
    }
  }

  return headings;
}

export function DocsToc({ content, className }: DocsTocProps) {
  const { t } = useLocale();
  const headings = useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = useState<string>('');

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setActiveId(entry.target.id);
        break;
      }
    }
  }, []);

  useEffect(() => {
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
  }, [headings, handleObserver]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <aside className={cn('w-52 shrink-0 hidden xl:block', className)}>
      <div className="sticky top-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t('docs.toc')}
        </h3>
        <ScrollArea className="max-h-[calc(100vh-10rem)]">
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
                  const element = document.getElementById(heading.id);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setActiveId(heading.id);
                  }
                }}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </ScrollArea>
      </div>
    </aside>
  );
}
