"use client";

import { useRef, useEffect, useCallback, type RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { Search, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SettingsSearchResult,
  UseSettingsSearchReturn,
} from "@/hooks/settings/use-settings-search";
import type { SettingsSection } from "@/lib/constants/settings-registry";
import type { TranslateFunction } from "@/types/settings";
import { isInputFocused } from "@/lib/utils/dom";

interface SettingsSearchProps {
  search: UseSettingsSearchReturn;
  onNavigateToSetting?: (section: SettingsSection, key: string, focusId?: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  t: TranslateFunction;
  className?: string;
}

export function SettingsSearch({
  search,
  onNavigateToSetting,
  inputRef,
  t,
  className,
}: SettingsSearchProps) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? internalInputRef;
  const {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch,
    totalResults,
    highlightText,
  } = search;

  // Focus input on '/' key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !isInputFocused()) {
        e.preventDefault();
        resolvedInputRef.current?.focus();
      }
      if (e.key === "Escape" && resolvedInputRef.current === document.activeElement) {
        clearSearch();
        resolvedInputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [clearSearch, resolvedInputRef]);

  const handleResultClick = useCallback(
    (result: SettingsSearchResult) => {
      if (onNavigateToSetting) {
        if (result.setting.focusId) {
          onNavigateToSetting(
            result.setting.section,
            result.setting.key,
            result.setting.focusId,
          );
          return;
        }

        onNavigateToSetting(result.setting.section, result.setting.key);
      }
    },
    [onNavigateToSetting],
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={resolvedInputRef}
          type="text"
          placeholder={t("settings.search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-20"
          aria-label={t("settings.search.label")}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isSearching && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={clearSearch}
              aria-label={t("settings.search.clear")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Kbd className="hidden sm:inline-flex">/</Kbd>
        </div>
      </div>

      {/* Search Results */}
      {isSearching && (
        <Card className="shadow-sm">
          <CardContent className="p-3">
            {totalResults > 0 ? (
              <Command
                shouldFilter={false}
                className="rounded-none border-0 bg-transparent"
              >
                <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {t("settings.search.resultsCount", { count: totalResults })}
                  </span>
                </div>
                <CommandList
                  role="listbox"
                  aria-label={t("settings.search.results")}
                  className="max-h-none overflow-visible"
                >
                  <CommandGroup className="flex flex-col gap-1 p-0">
                    {results.slice(0, 8).map((result) => (
                      <CommandItem
                        key={result.setting.key}
                        value={result.setting.key}
                        onSelect={() => handleResultClick(result)}
                        className="h-auto items-start justify-between rounded-md px-3 py-2"
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
                                {t("settings.search.advanced")}
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
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                {totalResults > 8 && (
                  <p className="px-3 py-2 text-center text-sm text-muted-foreground">
                    {t("settings.search.moreResults", {
                      count: totalResults - 8,
                    })}
                  </p>
                )}
              </Command>
            ) : (
              <Empty className="min-h-[140px] gap-3 border border-dashed p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search />
                  </EmptyMedia>
                  <EmptyTitle className="text-base">{t("settings.search.label")}</EmptyTitle>
                  <EmptyDescription>{t("settings.search.noResults")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
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
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
