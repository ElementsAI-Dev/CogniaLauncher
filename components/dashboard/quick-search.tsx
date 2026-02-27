"use client";

import { useRef } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Clock,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import { useDashboardSearch } from "@/hooks/use-dashboard-search";
import type { EnvironmentInfo, InstalledPackage } from "@/lib/tauri";

interface QuickSearchProps {
  environments: EnvironmentInfo[];
  packages: InstalledPackage[];
  className?: string;
}

export function QuickSearch({
  environments,
  packages,
  className,
}: QuickSearchProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    setQuery,
    setOpen,
    searchHistory,
    quickActions,
    envResults,
    pkgResults,
    actionResults,
    hasResults,
    showDropdown,
    clearHistory,
    handleSelect,
  } = useDashboardSearch({ environments, packages, containerRef, inputRef });

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Command
        className="rounded-lg border bg-background shadow-none"
      >
        <div className="relative">
          <CommandInput
            ref={inputRef}
            placeholder={t("dashboard.quickSearch.placeholder")}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="h-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setQuery("")}
                aria-label={t("common.clear")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <Kbd>/</Kbd>
          </div>
        </div>

        {showDropdown && (
          <CommandList className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border bg-popover shadow-lg max-h-[320px]">
            {query.trim() ? (
              <>
                {!hasResults && (
                  <CommandEmpty>
                    {t("dashboard.quickSearch.noResults")}
                  </CommandEmpty>
                )}

                {envResults.length > 0 && (
                  <CommandGroup heading={t("dashboard.quickSearch.environments")}>
                    {envResults.map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.id}
                        onSelect={() => handleSelect(result)}
                        className="gap-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{result.title}</div>
                          {result.subtitle && (
                            <div className="text-xs text-muted-foreground">
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {pkgResults.length > 0 && (
                  <CommandGroup heading={t("dashboard.quickSearch.packages")}>
                    {pkgResults.map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.id}
                        onSelect={() => handleSelect(result)}
                        className="gap-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{result.title}</div>
                          {result.subtitle && (
                            <div className="text-xs text-muted-foreground">
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {actionResults.length > 0 && (
                  <CommandGroup heading={t("dashboard.quickSearch.actions")}>
                    {actionResults.map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.id}
                        onSelect={() => handleSelect(result)}
                        className="gap-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{result.title}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            ) : (
              <>
                {/* Recent Searches */}
                {searchHistory.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-2 pt-3 pb-1.5">
                      <span className="text-xs font-medium text-muted-foreground tracking-wide">
                        {t("dashboard.quickSearch.recentSearches")}
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                        onClick={clearHistory}
                      >
                        {t("dashboard.quickSearch.clearRecent")}
                      </Button>
                    </div>
                    <CommandGroup>
                      {searchHistory.map((term) => (
                        <CommandItem
                          key={term}
                          value={`history-${term}`}
                          onSelect={() => setQuery(term)}
                          className="gap-2"
                        >
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {term}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

                {/* Quick Actions */}
                <CommandGroup heading={t("dashboard.quickSearch.actions")}>
                  {quickActions.map((action) => (
                    <CommandItem
                      key={action.id}
                      value={action.id}
                      onSelect={() => handleSelect(action)}
                      className="gap-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        {action.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{action.title}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
