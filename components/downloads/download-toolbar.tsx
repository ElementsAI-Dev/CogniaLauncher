"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Pause, Play, X, RefreshCw, Trash2 } from "lucide-react";
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
          <Button
            variant="outline"
            size="sm"
            onClick={onRetryFailed}
            disabled={stats.failed === 0 || isLoading}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t("downloads.actions.retryFailed")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFinished}
            disabled={finishedCount === 0 || isLoading}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {t("downloads.actions.clearFinished")}
          </Button>
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
        </div>
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(value) => onStatusChange(value as StatusFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">
            {t("downloads.toolbar.filterAll")} ({stats.totalTasks})
          </TabsTrigger>
          <TabsTrigger value="downloading">
            {t("downloads.toolbar.filterDownloading")} ({stats.downloading})
          </TabsTrigger>
          <TabsTrigger value="queued">
            {t("downloads.toolbar.filterQueued")} ({stats.queued})
          </TabsTrigger>
          <TabsTrigger value="paused">
            {t("downloads.toolbar.filterPaused")} ({stats.paused})
          </TabsTrigger>
          <TabsTrigger value="completed">
            {t("downloads.toolbar.filterCompleted")} ({stats.completed})
          </TabsTrigger>
          <TabsTrigger value="failed">
            {t("downloads.toolbar.filterFailed")} ({stats.failed})
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
