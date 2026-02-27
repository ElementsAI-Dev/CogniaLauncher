"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  RefreshCw,
  Activity,
  LayoutGrid,
  List,
  ArrowUpDown,
  Power,
  PowerOff,
} from "lucide-react";
import type {
  CategoryFilter,
  StatusFilter,
  SortOption,
  ViewMode,
  PlatformFilter,
} from "@/types/provider";

export interface ProviderToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryFilter: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  platformFilter?: PlatformFilter;
  onPlatformChange?: (platform: PlatformFilter) => void;
  onRefresh: () => void;
  onCheckAllStatus: () => void;
  onEnableAll?: () => void;
  onDisableAll?: () => void;
  isLoading: boolean;
  isCheckingStatus: boolean;
  providerCount?: number;
  t: (key: string) => string;
}

export function ProviderToolbar({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  sortOption,
  onSortChange,
  viewMode,
  onViewModeChange,
  platformFilter,
  onPlatformChange,
  onRefresh,
  onCheckAllStatus,
  onEnableAll,
  onDisableAll,
  isLoading,
  isCheckingStatus,
  providerCount,
  t,
}: ProviderToolbarProps) {
  // Debounced search
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 300);
    },
    [onSearchChange],
  );

  // Sync external searchQuery changes
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("providers.search")}
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="pl-9"
          />
          {providerCount !== undefined && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {providerCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onEnableAll && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEnableAll}
                  disabled={isLoading}
                  className="gap-1"
                >
                  <Power className="h-4 w-4" />
                  {t("providers.enableAll")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("providers.enableAll")}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {onDisableAll && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDisableAll}
                  disabled={isLoading}
                  className="gap-1"
                >
                  <PowerOff className="h-4 w-4" />
                  {t("providers.disableAll")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("providers.disableAll")}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onCheckAllStatus}
                disabled={isCheckingStatus}
                className="gap-2"
              >
                <Activity
                  className={`h-4 w-4 ${isCheckingStatus ? "animate-pulse" : ""}`}
                />
                {isCheckingStatus
                  ? t("providers.checking")
                  : t("providers.checkStatus")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("providers.checkStatusDesc")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                {t("providers.refresh")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("providers.refreshDesc")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={categoryFilter}
          onValueChange={(value) => onCategoryChange(value as CategoryFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">{t("providers.filterAll")}</TabsTrigger>
            <TabsTrigger value="environment">
              {t("providers.filterEnvironment")}
            </TabsTrigger>
            <TabsTrigger value="package">
              {t("providers.filterPackage")}
            </TabsTrigger>
            <TabsTrigger value="system">
              {t("providers.filterSystem")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => onStatusChange(value as StatusFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t("providers.filterAll")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("providers.filterAll")}</SelectItem>
              <SelectItem value="available">
                {t("providers.filterAvailable")}
              </SelectItem>
              <SelectItem value="unavailable">
                {t("providers.filterUnavailable")}
              </SelectItem>
              <SelectItem value="enabled">
                {t("providers.filterEnabled")}
              </SelectItem>
              <SelectItem value="disabled">
                {t("providers.filterDisabled")}
              </SelectItem>
            </SelectContent>
          </Select>

          {onPlatformChange && (
            <Select
              value={platformFilter ?? "all"}
              onValueChange={(value) => onPlatformChange(value as PlatformFilter)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("providers.platformAll")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("providers.platformAll")}</SelectItem>
                <SelectItem value="windows">Windows</SelectItem>
                <SelectItem value="linux">Linux</SelectItem>
                <SelectItem value="macos">macOS</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={sortOption}
            onValueChange={(value) => onSortChange(value as SortOption)}
          >
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t("providers.sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">
                {t("providers.sortNameAsc")}
              </SelectItem>
              <SelectItem value="name-desc">
                {t("providers.sortNameDesc")}
              </SelectItem>
              <SelectItem value="priority-asc">
                {t("providers.sortPriorityAsc")}
              </SelectItem>
              <SelectItem value="priority-desc">
                {t("providers.sortPriorityDesc")}
              </SelectItem>
              <SelectItem value="status">
                {t("providers.sortStatus")}
              </SelectItem>
            </SelectContent>
          </Select>

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) =>
              value && onViewModeChange(value as ViewMode)
            }
            className="border rounded-md"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="grid"
                  aria-label={t("providers.viewGrid")}
                  className="h-8 px-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("providers.viewGrid")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="list"
                  aria-label={t("providers.viewList")}
                  className="h-8 px-2"
                >
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("providers.viewList")}</p>
              </TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}
