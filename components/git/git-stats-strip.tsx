"use client";

import { useLocale } from "@/components/providers/locale-provider";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardStatusBadge,
} from "@/components/dashboard/dashboard-primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitBranch,
  FileEdit,
  GitCommitHorizontal,
  Archive,
  GitFork,
} from "lucide-react";
import type {
  GitRepoInfo,
  GitAheadBehind,
  GitStatusFile,
  GitCommitEntry,
  GitStashEntry,
  GitBranchInfo,
} from "@/types/tauri";

export interface GitStatsStripProps {
  repoInfo: GitRepoInfo | null;
  aheadBehind: GitAheadBehind;
  statusFiles: GitStatusFile[];
  commits: GitCommitEntry[];
  stashes: GitStashEntry[];
  branches: GitBranchInfo[];
  loading: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function GitStatsStrip({
  repoInfo,
  aheadBehind,
  statusFiles,
  commits,
  stashes,
  branches,
  loading,
}: GitStatsStripProps) {
  const { t } = useLocale();

  if (loading && !repoInfo) {
    return (
      <DashboardMetricGrid columns={5}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[62px] rounded-lg" />
        ))}
      </DashboardMetricGrid>
    );
  }

  if (!repoInfo) return null;

  const totalChanges =
    repoInfo.fileCountStaged +
    repoInfo.fileCountModified +
    repoInfo.fileCountUntracked;

  const localBranches = branches.filter((b) => !b.isRemote);
  const lastCommit = commits[0];

  const branchSuffix =
    aheadBehind.ahead > 0 || aheadBehind.behind > 0
      ? ` (${aheadBehind.ahead > 0 ? `+${aheadBehind.ahead}` : ""}${aheadBehind.ahead > 0 && aheadBehind.behind > 0 ? "/" : ""}${aheadBehind.behind > 0 ? `-${aheadBehind.behind}` : ""})`
      : "";

  return (
    <DashboardMetricGrid columns={5}>
      <DashboardMetricItem
        label={t("git.statsStrip.branch")}
        icon={<GitBranch className="h-3 w-3" />}
        value={
          <span className="flex items-center gap-1.5">
            <span className="truncate text-base">
              {truncate(repoInfo.currentBranch, 20)}
            </span>
            {branchSuffix && (
              <DashboardStatusBadge
                tone={aheadBehind.behind > 0 ? "warning" : "success"}
              >
                {branchSuffix}
              </DashboardStatusBadge>
            )}
          </span>
        }
      />
      <DashboardMetricItem
        label={t("git.statsStrip.changes")}
        icon={<FileEdit className="h-3 w-3" />}
        value={totalChanges}
        valueClassName={
          totalChanges > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-green-600 dark:text-green-400"
        }
      />
      <DashboardMetricItem
        label={t("git.statsStrip.lastCommit")}
        icon={<GitCommitHorizontal className="h-3 w-3" />}
        value={
          lastCommit ? (
            <span className="text-sm font-normal text-muted-foreground truncate block">
              {truncate(lastCommit.message, 35)}
              <span className="ml-1 text-xs opacity-60">
                {formatRelativeTime(lastCommit.date)}
              </span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )
        }
      />
      <DashboardMetricItem
        label={t("git.statsStrip.stashes")}
        icon={<Archive className="h-3 w-3" />}
        value={stashes.length}
        valueClassName={
          stashes.length > 0 ? undefined : "text-muted-foreground"
        }
      />
      <DashboardMetricItem
        label={t("git.statsStrip.branches")}
        icon={<GitFork className="h-3 w-3" />}
        value={localBranches.length}
      />
    </DashboardMetricGrid>
  );
}
