"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Layers,
  Package,
  Settings,
  Clock,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageIcon } from "@/components/provider-management/provider-icon";
import { Kbd } from "@/components/ui/kbd";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import type { EnvironmentInfo, InstalledPackage } from "@/lib/tauri";

const SEARCH_HISTORY_KEY = "cognia-dashboard-search-history";
const MAX_HISTORY = 5;

interface QuickSearchProps {
  environments: EnvironmentInfo[];
  packages: InstalledPackage[];
  className?: string;
}

interface SearchResult {
  type: "environment" | "package" | "action";
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
}

const getInitialHistory = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export function QuickSearch({
  environments,
  packages,
  className,
}: QuickSearchProps) {
  const router = useRouter();
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searchHistory, setSearchHistory] =
    useState<string[]>(getInitialHistory);

  const quickActions: SearchResult[] = useMemo(
    () => [
      {
        type: "action",
        id: "add-environment",
        title: t("dashboard.quickActions.addEnvironment"),
        icon: <Layers className="h-4 w-4" />,
        href: "/environments",
      },
      {
        type: "action",
        id: "install-package",
        title: t("dashboard.quickActions.installPackage"),
        icon: <Package className="h-4 w-4" />,
        href: "/packages",
      },
      {
        type: "action",
        id: "settings",
        title: t("dashboard.quickActions.openSettings"),
        icon: <Settings className="h-4 w-4" />,
        href: "/settings",
      },
    ],
    [t],
  );

  const envResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return environments
      .filter(
        (env) =>
          env.env_type.toLowerCase().includes(lowerQuery) ||
          env.provider.toLowerCase().includes(lowerQuery),
      )
      .slice(0, 3)
      .map((env) => ({
        type: "environment" as const,
        id: `env-${env.env_type}`,
        title: env.env_type,
        subtitle: `${env.provider} • ${env.current_version || t("common.none")}`,
        icon: <LanguageIcon languageId={env.env_type} size={16} />,
        href: "/environments",
      }));
  }, [query, environments, t]);

  const pkgResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return packages
      .filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(lowerQuery) ||
          pkg.provider.toLowerCase().includes(lowerQuery),
      )
      .slice(0, 3)
      .map((pkg) => ({
        type: "package" as const,
        id: `pkg-${pkg.provider}-${pkg.name}`,
        title: pkg.name,
        subtitle: `${pkg.provider} • ${pkg.version}`,
        icon: <Package className="h-4 w-4" />,
        href: "/packages",
      }));
  }, [query, packages]);

  const actionResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return quickActions.filter((action) =>
      action.title.toLowerCase().includes(lowerQuery),
    );
  }, [query, quickActions]);

  const hasResults = envResults.length > 0 || pkgResults.length > 0 || actionResults.length > 0;
  const showDropdown = open && (query.trim() || searchHistory.length > 0);

  const saveToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h !== searchQuery);
      const updated = [searchQuery, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (query.trim()) {
        saveToHistory(query);
      }

      if (result.action) {
        result.action();
      } else if (result.href) {
        router.push(result.href);
      }

      setQuery("");
      setOpen(false);
    },
    [query, router, saveToHistory],
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          inputRef.current?.focus();
          setOpen(true);
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
