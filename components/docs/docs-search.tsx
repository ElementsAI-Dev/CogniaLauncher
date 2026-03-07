'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocale } from '@/components/providers/locale-provider';
import { searchDocs, type DocSearchResult } from '@/lib/docs/search';
import type { DocSearchEntry } from '@/lib/docs/content';
import { slugToArray } from '@/lib/docs/navigation';
import { cn } from '@/lib/utils';
import { Search, FileText } from 'lucide-react';

interface DocsSearchProps {
  className?: string;
  searchIndex?: DocSearchEntry[];
}

export function DocsSearch({ className, searchIndex }: DocsSearchProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchDocs(query, locale, searchIndex), [query, locale, searchIndex]);

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

  // Global keyboard shortcut: "/" or Ctrl/Cmd+K to focus search
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isInput)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const navigateToResult = useCallback((result: DocSearchResult) => {
    const slugArr = slugToArray(result.slug);
    const baseHref = slugArr.length === 0 ? '/docs' : `/docs/${slugArr.join('/')}`;
    const hash = result.anchorId ? `#${encodeURIComponent(result.anchorId)}` : '';
    const href = `${baseHref}${hash}`;
    router.push(href);
    setQuery('');
    setOpen(false);
    setSelectedIndex(0);
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
        setSelectedIndex(0);
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
          className="pl-8 pr-10 h-8 text-sm"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          /
        </kbd>
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
                    key={`${result.slug}#${result.anchorId ?? ''}`}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-sm text-left transition-colors',
                      i === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50'
                    )}
                    onClick={() => navigateToResult(result)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{getTitle(result)}</div>
                      {result.snippet !== getTitle(result) && (
                        <div className="truncate text-xs text-muted-foreground">{result.snippet}</div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[100px] shrink-0 mt-0.5">
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
