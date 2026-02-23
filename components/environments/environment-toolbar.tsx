"use client";

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
import { Search, X, RefreshCw, ArrowUpDown, Filter, LayoutGrid, List, ArrowUpCircle } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  EnvironmentStatusFilter,
  EnvironmentSortBy,
  EnvironmentViewMode,
} from "@/lib/stores/environment";

interface EnvironmentToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: EnvironmentStatusFilter;
  onStatusChange: (status: EnvironmentStatusFilter) => void;
  sortBy: EnvironmentSortBy;
  onSortChange: (sort: EnvironmentSortBy) => void;
  onRefresh: () => void;
  onCheckAllUpdates?: () => void;
  onClearFilters: () => void;
  isLoading: boolean;
  totalCount: number;
  filteredCount: number;
  viewMode: EnvironmentViewMode;
  onViewModeChange: (mode: EnvironmentViewMode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvironmentToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  onRefresh,
  onCheckAllUpdates,
  onClearFilters,
  isLoading,
  totalCount,
  filteredCount,
  viewMode,
  onViewModeChange,
  t,
}: EnvironmentToolbarProps) {
  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all";
  const isFiltered = filteredCount !== totalCount;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("environments.toolbar.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-9 pr-9 bg-background"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
              title={t("common.clear")}
              aria-label={t("common.clear")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusChange(v as EnvironmentStatusFilter)}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("environments.toolbar.statusAll")}
            </SelectItem>
            <SelectItem value="available">
              {t("environments.toolbar.statusAvailable")}
            </SelectItem>
            <SelectItem value="unavailable">
              {t("environments.toolbar.statusUnavailable")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Sort By */}
        <Select
          value={sortBy}
          onValueChange={(v) => onSortChange(v as EnvironmentSortBy)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">
              {t("environments.toolbar.sortName")}
            </SelectItem>
            <SelectItem value="installed_count">
              {t("environments.toolbar.sortInstalled")}
            </SelectItem>
            <SelectItem value="provider">
              {t("environments.toolbar.sortProvider")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* View Mode Toggle */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && onViewModeChange(v as EnvironmentViewMode)}
          className="h-9"
        >
          <ToggleGroupItem value="grid" className="h-9 w-9 px-0" aria-label={t("environments.toolbar.viewGrid")}>
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" className="h-9 w-9 px-0" aria-label={t("environments.toolbar.viewList")}>
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Check All Updates Button */}
        {onCheckAllUpdates && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCheckAllUpdates}
            disabled={isLoading}
            className="h-9 gap-2"
          >
            <ArrowUpCircle className="h-4 w-4" />
            {t("environments.updates.checkAll")}
          </Button>
        )}

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-9 gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Active Filters & Results Count */}
      {(hasActiveFilters || isFiltered) && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          {isFiltered && (
            <span className="text-muted-foreground">
              {t("environments.toolbar.showingResults", {
                filtered: filteredCount,
                total: totalCount,
              })}
            </span>
          )}

          {hasActiveFilters && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {t("environments.toolbar.activeFilters")}:
              </span>

              {searchQuery && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => onSearchChange("")}
                >
                  &quot;{searchQuery}&quot;
                  <X className="h-3 w-3" />
                </Badge>
              )}

              {statusFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => onStatusChange("all")}
                >
                  {statusFilter === "available"
                    ? t("environments.toolbar.statusAvailable")
                    : t("environments.toolbar.statusUnavailable")}
                  <X className="h-3 w-3" />
                </Badge>
              )}

              <Button
                variant="link"
                size="sm"
                className="text-xs text-destructive h-auto p-0"
                onClick={onClearFilters}
              >
                {t("environments.toolbar.clearAll")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
