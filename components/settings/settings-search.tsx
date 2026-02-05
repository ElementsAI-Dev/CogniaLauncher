'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SettingsSearchResult, UseSettingsSearchReturn } from '@/hooks/use-settings-search';
import type { SettingsSection } from '@/lib/constants/settings-registry';

type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;

interface SettingsSearchProps {
  search: UseSettingsSearchReturn;
  onNavigateToSetting?: (section: SettingsSection, key: string) => void;
  t: TranslateFunction;
  className?: string;
}

export function SettingsSearch({
  search,
  onNavigateToSetting,
  t,
  className,
}: SettingsSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, results, isSearching, clearSearch, totalResults, highlightText } = search;

  // Focus input on '/' key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && inputRef.current === document.activeElement) {
        clearSearch();
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearSearch]);

  const handleResultClick = useCallback(
    (result: SettingsSearchResult) => {
      if (onNavigateToSetting) {
        onNavigateToSetting(result.setting.section, result.setting.key);
      }
    },
    [onNavigateToSetting]
  );

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={t('settings.search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-20"
          aria-label={t('settings.search.label')}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isSearching && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={clearSearch}
              aria-label={t('settings.search.clear')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            /
          </kbd>
        </div>
      </div>

      {/* Search Results */}
      {isSearching && (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          {totalResults > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {t('settings.search.resultsCount', { count: totalResults })}
                </span>
              </div>
              <ul className="space-y-1" role="listbox" aria-label={t('settings.search.results')}>
                {results.slice(0, 8).map((result) => (
                  <li key={result.setting.key}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            <HighlightedText
                              text={t(result.setting.labelKey)}
                              highlightText={highlightText}
                            />
                          </span>
                          {result.setting.advanced && (
                            <Badge variant="outline" className="text-xs">
                              {t('settings.search.advanced')}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          <HighlightedText
                            text={t(result.setting.descKey)}
                            highlightText={highlightText}
                          />
                        </p>
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {t(`settings.sections.${result.setting.section}`)}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  </li>
                ))}
                {totalResults > 8 && (
                  <li className="px-3 py-2 text-center text-sm text-muted-foreground">
                    {t('settings.search.moreResults', { count: totalResults - 8 })}
                  </li>
                )}
              </ul>
            </>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {t('settings.search.noResults')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface HighlightedTextProps {
  text: string;
  highlightText: (text: string) => { text: string; highlighted: boolean }[];
}

function HighlightedText({ text, highlightText }: HighlightedTextProps) {
  const parts = highlightText(text);
  return (
    <>
      {parts.map((part, index) =>
        part.highlighted ? (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  const tagName = activeElement.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    (activeElement as HTMLElement).isContentEditable
  );
}
