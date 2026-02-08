"use client";

import { useState, useCallback, useRef, useEffect, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  X,
  Loader2,
  Clock,
  Sparkles,
  Filter,
  ArrowUpDown,
  Package,
  Server,
  ChevronDown,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type {
  ProviderInfo,
  SearchSuggestion,
  SearchFilters,
} from "@/lib/tauri";
import { useDebounce } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SearchBarProps {
  providers: ProviderInfo[];
  onSearch: (
    query: string,
    options: {
      providers?: string[];
      installedOnly?: boolean;
      notInstalled?: boolean;
      hasUpdates?: boolean;
      sortBy?: string;
    },
  ) => void;
  onGetSuggestions: (query: string) => Promise<SearchSuggestion[]>;
  loading?: boolean;
}

const SEARCH_HISTORY_KEY = "cognia-search-history";
const MAX_HISTORY = 10;

const getInitialHistory = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export function SearchBar({
  providers,
  onSearch,
  onGetSuggestions,
  loading,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] =
    useState<string[]>(getInitialHistory);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortBy, setSortBy] = useState<string>("relevance");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();

  const debouncedQuery = useDebounce(query, 300);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      let isCancelled = false;

      onGetSuggestions(debouncedQuery).then((result) => {
        if (!isCancelled) {
          startTransition(() => {
            setSuggestions(result);
          });
        }
      });

      return () => {
        isCancelled = true;
      };
    } else {
      startTransition(() => {
        setSuggestions([]);
      });
    }
    return undefined;
  }, [debouncedQuery, onGetSuggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveToHistory = useCallback(
    (searchQuery: string) => {
      try {
        const newHistory = [
          searchQuery,
          ...searchHistory.filter((h) => h !== searchQuery),
        ].slice(0, MAX_HISTORY);
        setSearchHistory(newHistory);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      } catch {
        // Ignore localStorage errors
      }
    },
    [searchHistory],
  );

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed) {
      saveToHistory(trimmed);
      onSearch(trimmed, {
        providers: selectedProviders.length > 0 ? selectedProviders : undefined,
        installedOnly: filters.installedOnly,
        notInstalled: filters.notInstalled,
        hasUpdates: filters.hasUpdates,
        sortBy: sortBy !== "relevance" ? sortBy : undefined,
      });
      setShowDropdown(false);
    }
  }, [query, selectedProviders, filters, sortBy, onSearch, saveToHistory]);

  const handleSuggestionClick = useCallback(
    (suggestion: SearchSuggestion) => {
      setQuery(suggestion.text);
      setShowDropdown(false);

      // Auto-select provider if suggestion has one
      if (suggestion.provider && suggestion.suggestion_type === "package") {
        setSelectedProviders([suggestion.provider]);
      }

      // Trigger search
      onSearch(suggestion.text, {
        providers: suggestion.provider ? [suggestion.provider] : undefined,
      });
    },
    [onSearch],
  );

  const handleHistoryClick = useCallback(
    (historyQuery: string) => {
      setQuery(historyQuery);
      setShowDropdown(false);
      onSearch(historyQuery, {
        providers: selectedProviders.length > 0 ? selectedProviders : undefined,
      });
    },
    [selectedProviders, onSearch],
  );

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const toggleProvider = useCallback((providerId: string) => {
    setSelectedProviders((prev) =>
      prev.includes(providerId)
        ? prev.filter((p) => p !== providerId)
        : [...prev, providerId],
    );
  }, []);

  const toggleFilter = useCallback(
    (key: keyof SearchFilters, value: boolean) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value || undefined,
      }));
    },
    [],
  );

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length +
    (selectedProviders.length > 0 ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {/* Main Search Input */}
        <div className="flex-1 relative" ref={dropdownRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={t("packages.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              } else if (e.key === "Escape") {
                setShowDropdown(false);
              }
            }}
            onFocus={() => setShowDropdown(true)}
            className="h-10 pl-9 pr-9 bg-background border-border"
          />
          {query && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                  aria-label={t("common.clear")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.clear")}</TooltipContent>
            </Tooltip>
          )}

          {/* Suggestions & History Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50">
            <ScrollArea className="max-h-[400px]">
              {/* Suggestions */}
              {isPending && (
                <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("packages.loadingSuggestions")}
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="border-b">
                  <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {t("packages.suggestions")}
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                    >
                      {suggestion.suggestion_type === "package" ? (
                        <Package className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Server className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="flex-1">{suggestion.text}</span>
                      {suggestion.provider && (
                        <Badge variant="outline" className="text-xs">
                          {suggestion.provider}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Search History */}
              {searchHistory.length > 0 &&
                !isPending &&
                suggestions.length === 0 && (
                  <div>
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t("packages.recentSearches")}
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={clearHistory}
                        className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t("common.clear")}
                      </Button>
                    </div>
                    <div className="py-1">
                      {searchHistory.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleHistoryClick(item)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                        >
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </ScrollArea>
            </div>
          )}
        </div>

        {/* Provider Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              {selectedProviders.length > 0 ? (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {selectedProviders.length}
                </Badge>
              ) : (
                <span>{t("packages.providers")}</span>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              {t("packages.filterByProvider")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {providers
              .filter((p) => p.capabilities.includes("Search"))
              .map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={selectedProviders.includes(p.id)}
                  onCheckedChange={() => toggleProvider(p.id)}
                >
                  {p.display_name}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("packages.filters")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={filters.installedOnly}
              onCheckedChange={(checked) =>
                toggleFilter("installedOnly", checked)
              }
            >
              {t("packages.installedOnly")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.notInstalled}
              onCheckedChange={(checked) =>
                toggleFilter("notInstalled", checked)
              }
            >
              {t("packages.notInstalledFilter")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.hasUpdates}
              onCheckedChange={(checked) => toggleFilter("hasUpdates", checked)}
            >
              {t("packages.hasUpdatesFilter")}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-10 w-[140px]">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">
              {t("packages.sortRelevance")}
            </SelectItem>
            <SelectItem value="name">{t("packages.sortName")}</SelectItem>
            <SelectItem value="provider">
              {t("packages.sortProvider")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="h-10 w-10 p-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Active Filters Display */}
      {(selectedProviders.length > 0 ||
        Object.keys(filters).some(
          (k) => filters[k as keyof SearchFilters],
        )) && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">
            {t("packages.activeFilters")}:
          </span>
          {selectedProviders.map((p) => (
            <Badge
              key={p}
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => toggleProvider(p)}
            >
              {providers.find((pr) => pr.id === p)?.display_name || p}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {filters.installedOnly && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => toggleFilter("installedOnly", false)}
            >
              {t("packages.installedOnly")} <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.notInstalled && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => toggleFilter("notInstalled", false)}
            >
              {t("packages.notInstalledFilter")} <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.hasUpdates && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => toggleFilter("hasUpdates", false)}
            >
              {t("packages.hasUpdatesFilter")} <X className="h-3 w-3" />
            </Badge>
          )}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelectedProviders([]);
              setFilters({});
            }}
          >
            {t("packages.clearAllFilters")}
          </Button>
        </div>
      )}
    </div>
  );
}
