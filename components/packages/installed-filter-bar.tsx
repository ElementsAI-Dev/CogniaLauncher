"use client";

import { useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, X, Server } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type { InstalledFilterBarProps } from "@/types/packages";
export type { InstalledFilterState } from "@/types/packages";
export { useInstalledFilter } from "@/hooks/use-installed-filter";

export function InstalledFilterBar({
  packages,
  providers,
  filter,
  onFilterChange,
}: InstalledFilterBarProps) {
  const { t } = useLocale();

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    packages.forEach((pkg) => {
      counts[pkg.provider] = (counts[pkg.provider] || 0) + 1;
    });
    return counts;
  }, [packages]);

  const availableProviders = useMemo(() => {
    return providers.filter((p) => providerCounts[p.id] > 0);
  }, [providers, providerCounts]);

  const handleQueryChange = useCallback(
    (query: string) => {
      onFilterChange({ ...filter, query });
    },
    [filter, onFilterChange],
  );

  const handleProviderChange = useCallback(
    (provider: string) => {
      onFilterChange({
        ...filter,
        provider: provider === "all" ? null : provider,
      });
    },
    [filter, onFilterChange],
  );

  const handleClear = useCallback(() => {
    onFilterChange({ query: "", provider: null });
  }, [onFilterChange]);

  const hasFilters = filter.query || filter.provider;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("packages.filterInstalled")}
          value={filter.query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="h-9 pl-9 pr-9"
        />
        {filter.query && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleQueryChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                aria-label={t("common.clear")}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.clear")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={filter.provider || "all"}
          onValueChange={handleProviderChange}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <Server className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder={t("packages.allProviders")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("packages.allProviders")} ({packages.length})
            </SelectItem>
            {availableProviders.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                <span className="flex items-center gap-2">
                  {provider.display_name}
                  <Badge variant="secondary" className="text-xs ml-1">
                    {providerCounts[provider.id]}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-9 px-3"
          >
            <X className="h-4 w-4 mr-1" />
            {t("packages.clearFilters")}
          </Button>
        )}
      </div>
    </div>
  );
}
