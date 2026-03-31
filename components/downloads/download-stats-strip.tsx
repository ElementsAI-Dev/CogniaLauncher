"use client";

import {
  DashboardMetricGrid,
  DashboardMetricItem,
} from "@/components/dashboard/dashboard-primitives";
import {
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  Gauge,
  HardDrive,
} from "lucide-react";
import { formatSpeed } from "@/lib/utils";
import type { QueueStats, HistoryStats } from "@/lib/stores/download";

interface DownloadStatsStripProps {
  stats: QueueStats;
  historyStats: HistoryStats | null;
  /** Current aggregate speed in bytes/sec (from speedHistory). */
  currentSpeed: number;
  t: (key: string) => string;
}

export function DownloadStatsStrip({
  stats,
  historyStats,
  currentSpeed,
  t,
}: DownloadStatsStripProps) {
  return (
    <DashboardMetricGrid columns={5}>
      <DashboardMetricItem
        label={t("downloads.toolbar.filterDownloading")}
        value={stats.downloading}
        valueClassName={stats.downloading > 0 ? "text-blue-600 dark:text-blue-400" : undefined}
        icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
      />
      <DashboardMetricItem
        label={t("downloads.toolbar.filterQueued")}
        value={stats.queued}
        icon={<Clock className="h-3.5 w-3.5" />}
      />
      <DashboardMetricItem
        label={t("downloads.toolbar.filterCompleted")}
        value={stats.completed}
        valueClassName={stats.completed > 0 ? "text-green-600 dark:text-green-400" : undefined}
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
      />
      <DashboardMetricItem
        label={t("downloads.progress.speed")}
        value={stats.downloading > 0 ? formatSpeed(currentSpeed) : "—"}
        icon={<Gauge className="h-3.5 w-3.5" />}
      />
      <DashboardMetricItem
        label={t("downloads.progress.downloaded")}
        value={historyStats?.totalBytesHuman ?? stats.downloadedHuman ?? "0 B"}
        icon={<HardDrive className="h-3.5 w-3.5" />}
      />
    </DashboardMetricGrid>
  );
}
