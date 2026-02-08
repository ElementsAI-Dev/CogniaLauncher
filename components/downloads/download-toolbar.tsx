"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Pause,
  Play,
  X,
  RefreshCw,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import type { QueueStats } from "@/lib/stores/download";

export type StatusFilter =
  | "all"
  | "downloading"
  | "queued"
  | "paused"
  | "completed"
  | "failed";

export interface DownloadToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onCancelAll: () => void;
  onClearFinished: () => void;
  onRetryFailed: () => void;
  stats: QueueStats;
  isLoading: boolean;
  t: (key: string) => string;
}

export function DownloadToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onPauseAll,
  onResumeAll,
  onCancelAll,
  onClearFinished,
  onRetryFailed,
  stats,
  isLoading,
  t,
}: DownloadToolbarProps) {
  const finishedCount = stats.completed + stats.cancelled + stats.failed;
  const activeCount = stats.downloading + stats.queued + stats.paused;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("downloads.toolbar.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onPauseAll}
                disabled={stats.downloading === 0 || isLoading}
                className="gap-2"
              >
                <Pause className="h-4 w-4" />
                {t("downloads.actions.pauseAll")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("downloads.actions.pauseAll")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onResumeAll}
                disabled={stats.paused === 0 || isLoading}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {t("downloads.actions.resumeAll")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("downloads.actions.resumeAll")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={onCancelAll}
                disabled={activeCount === 0 || isLoading}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                {t("downloads.actions.cancelAll")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("downloads.actions.cancelAll")}</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onRetryFailed}
                disabled={stats.failed === 0 || isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("downloads.actions.retryFailed")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onClearFinished}
                disabled={finishedCount === 0 || isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("downloads.actions.clearFinished")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator />

      <Tabs
        value={statusFilter}
        onValueChange={(value) => onStatusChange(value as StatusFilter)}
      >
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            {t("downloads.toolbar.filterAll")}
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {stats.totalTasks}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="downloading" className="gap-1.5">
            {t("downloads.toolbar.filterDownloading")}
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {stats.downloading}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="queued" className="gap-1.5">
            {t("downloads.toolbar.filterQueued")}
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {stats.queued}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="paused" className="gap-1.5">
            {t("downloads.toolbar.filterPaused")}
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {stats.paused}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            {t("downloads.toolbar.filterCompleted")}
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {stats.completed}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="failed" className="gap-1.5">
            {t("downloads.toolbar.filterFailed")}
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {stats.failed}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
