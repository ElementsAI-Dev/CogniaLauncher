"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  X,
  Layers,
  Package,
  Settings,
  Clock,
  ArrowRight,
} from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [searchHistory, setSearchHistory] =
    useState<string[]>(getInitialHistory);
  const [selectedIndex, setSelectedIndex] = useState(-1);

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

  const searchResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search environments
    environments
      .filter(
        (env) =>
          env.env_type.toLowerCase().includes(lowerQuery) ||
          env.provider.toLowerCase().includes(lowerQuery),
      )
      .slice(0, 3)
      .forEach((env) => {
        results.push({
          type: "environment",
          id: `env-${env.env_type}`,
          title: env.env_type,
          subtitle: `${env.provider} • ${env.current_version || t("common.none")}`,
          icon: <Layers className="h-4 w-4" />,
          href: "/environments",
        });
      });

    // Search packages
    packages
      .filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(lowerQuery) ||
          pkg.provider.toLowerCase().includes(lowerQuery),
      )
      .slice(0, 3)
      .forEach((pkg) => {
        results.push({
          type: "package",
          id: `pkg-${pkg.provider}-${pkg.name}`,
          title: pkg.name,
          subtitle: `${pkg.provider} • ${pkg.version}`,
          icon: <Package className="h-4 w-4" />,
          href: "/packages",
        });
      });

    // Search quick actions
    quickActions
      .filter((action) => action.title.toLowerCase().includes(lowerQuery))
      .forEach((action) => results.push(action));

    return results;
  }, [query, environments, packages, quickActions, t]);

  const showDropdown = isFocused && (query.trim() || searchHistory.length > 0);

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
      setIsFocused(false);
      inputRef.current?.blur();
    },
    [query, router, saveToHistory],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const results = searchResults.length > 0 ? searchResults : quickActions;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          setIsFocused(false);
          inputRef.current?.blur();
          break;
      }
    },
    [searchResults, quickActions, selectedIndex, handleSelect],
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          inputRef.current?.focus();
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
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={t("dashboard.quickSearch.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          className="h-10 pl-9 pr-20 bg-background"
        />
        {query ? (
          <button
            onClick={() => setQuery("")}
            className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t("common.clear")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            /
          </kbd>
        </div>
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-lg border bg-popover shadow-lg">
          <ScrollArea className="max-h-[320px]">
            {searchResults.length > 0 ? (
              <div className="p-2">
                {/* Environment Results */}
                {searchResults.filter((r) => r.type === "environment").length >
                  0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {t("dashboard.quickSearch.environments")}
                    </div>
                    {searchResults
                      .filter((r) => r.type === "environment")
                      .map((result) => (
                        <SearchResultItem
                          key={result.id}
                          result={result}
                          isSelected={
                            selectedIndex === searchResults.indexOf(result)
                          }
                          onClick={() => handleSelect(result)}
                        />
                      ))}
                  </div>
                )}

                {/* Package Results */}
                {searchResults.filter((r) => r.type === "package").length >
                  0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {t("dashboard.quickSearch.packages")}
                    </div>
                    {searchResults
                      .filter((r) => r.type === "package")
                      .map((result) => (
                        <SearchResultItem
                          key={result.id}
                          result={result}
                          isSelected={
                            selectedIndex === searchResults.indexOf(result)
                          }
                          onClick={() => handleSelect(result)}
                        />
                      ))}
                  </div>
                )}

                {/* Action Results */}
                {searchResults.filter((r) => r.type === "action").length >
                  0 && (
                  <div>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {t("dashboard.quickSearch.actions")}
                    </div>
                    {searchResults
                      .filter((r) => r.type === "action")
                      .map((result) => (
                        <SearchResultItem
                          key={result.id}
                          result={result}
                          isSelected={
                            selectedIndex === searchResults.indexOf(result)
                          }
                          onClick={() => handleSelect(result)}
                        />
                      ))}
                  </div>
                )}
              </div>
            ) : query.trim() ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t("dashboard.quickSearch.noResults")}
              </div>
            ) : (
              <div className="p-2">
                {/* Recent Searches */}
                {searchHistory.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("dashboard.quickSearch.recentSearches")}
                      </span>
                      <button
                        onClick={clearHistory}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t("dashboard.quickSearch.clearRecent")}
                      </button>
                    </div>
                    {searchHistory.map((term) => (
                      <button
                        key={term}
                        onClick={() => setQuery(term)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {term}
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Actions */}
                <div>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {t("dashboard.quickSearch.actions")}
                  </div>
                  {quickActions.map((action, index) => (
                    <SearchResultItem
                      key={action.id}
                      result={action}
                      isSelected={selectedIndex === index}
                      onClick={() => handleSelect(action)}
                    />
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
}

function SearchResultItem({
  result,
  isSelected,
  onClick,
}: SearchResultItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
        isSelected ? "bg-accent" : "hover:bg-accent",
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
        {result.icon}
      </div>
      <div className="flex-1 text-left">
        <div className="font-medium">{result.title}</div>
        {result.subtitle && (
          <div className="text-xs text-muted-foreground">{result.subtitle}</div>
        )}
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
