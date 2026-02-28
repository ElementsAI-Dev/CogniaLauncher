'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocale } from '@/components/providers/locale-provider';
import { searchDocs, type DocSearchResult } from '@/lib/docs/search';
import { slugToArray } from '@/lib/docs/navigation';
import { cn } from '@/lib/utils';
import { Search, FileText } from 'lucide-react';

interface DocsSearchProps {
  className?: string;
}

export function DocsSearch({ className }: DocsSearchProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchDocs(query, locale), [query, locale]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateToResult = useCallback((result: DocSearchResult) => {
    const slugArr = slugToArray(result.slug);
    const href = slugArr.length === 0 ? '/docs' : `/docs/${slugArr.join('/')}`;
    router.push(href);
    setQuery('');
    setOpen(false);
  }, [router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        navigateToResult(results[selectedIndex]);
        break;
      case 'Escape':
        setOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [open, results, selectedIndex, navigateToResult]);

  const getTitle = (item: DocSearchResult) =>
    locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={t('docs.searchPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
            setOpen(e.target.value.length > 0);
          }}
          onFocus={() => query.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {open && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-popover shadow-md">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t('docs.searchNoResults')}
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {results.map((result, i) => (
                  <button
                    key={result.slug}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left transition-colors',
                      i === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50'
                    )}
                    onClick={() => navigateToResult(result)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{getTitle(result)}</span>
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">
                      {result.slug}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
