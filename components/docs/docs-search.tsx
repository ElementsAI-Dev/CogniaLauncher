'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchDocs(query, locale, searchIndex), [query, locale, searchIndex]);

  // Global keyboard shortcut: "/" or Ctrl/Cmd+K to focus search
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isInput)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const navigateToResult = useCallback((result: DocSearchResult) => {
    const slugArr = slugToArray(result.slug);
    const baseHref = slugArr.length === 0 ? '/docs' : `/docs/${slugArr.join('/')}`;
    const hash = result.anchorId ? `#${encodeURIComponent(result.anchorId)}` : '';
    const href = `${baseHref}${hash}`;
    router.push(href);
    setQuery('');
    setOpen(false);
  }, [router]);

  const getTitle = (item: DocSearchResult) =>
    locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-left shadow-xs transition-colors hover:bg-accent/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('docs.searchPlaceholder')}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">{t('docs.searchPlaceholder')}</span>
            <Kbd className="ml-auto hidden sm:inline-flex">/</Kbd>
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder={t('docs.searchPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(false);
                  setQuery('');
                }
              }}
            />
            <CommandList className="max-h-72">
              {query.trim().length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {t('docs.searchPlaceholder')}
                </div>
              ) : (
                <>
                  <CommandEmpty>{t('docs.searchNoResults')}</CommandEmpty>
                  {results.map((result) => {
                    const title = getTitle(result);
                    return (
                      <CommandItem
                        key={`${result.slug}#${result.anchorId ?? ''}`}
                        value={`${title} ${result.snippet} ${result.slug}`}
                        onSelect={() => navigateToResult(result)}
                        className="items-start gap-2 py-2"
                      >
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{title}</div>
                          {result.snippet !== title && (
                            <div className="truncate text-xs text-muted-foreground">{result.snippet}</div>
                          )}
                        </div>
                        <span className="mt-0.5 max-w-[120px] shrink-0 truncate text-xs text-muted-foreground">
                          {result.slug}
                        </span>
                      </CommandItem>
                    );
                  })}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </div>
    </Popover>
  );
}
