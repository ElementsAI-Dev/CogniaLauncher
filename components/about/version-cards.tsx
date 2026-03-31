"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardStatusBadge,
} from "@/components/dashboard/dashboard-primitives";
import { Package, CloudDownload, Activity, Copy, Check } from "lucide-react";
import { APP_VERSION } from "@/lib/app-version";
import { writeClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
import type { UpdateStatus } from "@/types/about";
import type { SelfUpdateInfo } from "@/lib/tauri";

interface VersionCardsProps {
  loading: boolean;
  updateInfo: SelfUpdateInfo | null;
  updateStatus: UpdateStatus;
  t: (key: string) => string;
}

function getStatusTone(
  status: UpdateStatus,
  updateInfo: SelfUpdateInfo | null,
): "success" | "warning" | "danger" | "muted" {
  if (status === "checking") return "muted";
  if (status === "error") return "danger";
  if (status === "update_available" || status === "downloading" || status === "installing")
    return "warning";
  if (
    status === "up_to_date" ||
    status === "done" ||
    (updateInfo && updateInfo.update_available === false && !updateInfo.error_category)
  )
    return "success";
  return "muted";
}

function getStatusLabel(
  status: UpdateStatus,
  updateInfo: SelfUpdateInfo | null,
  t: (key: string) => string,
): string {
  if (status === "checking") return t("common.loading");
  if (status === "error") return t("about.errorTitle");
  if (status === "update_available" || status === "downloading" || status === "installing")
    return t("about.updateAvailable");
  if (
    status === "up_to_date" ||
    status === "done" ||
    (updateInfo && updateInfo.update_available === false && !updateInfo.error_category)
  )
    return t("about.upToDate");
  return "–";
}

export function VersionCards({
  loading,
  updateInfo,
  updateStatus,
  t,
}: VersionCardsProps) {
  const [copied, setCopied] = useState(false);
  const currentVersion = updateInfo?.current_version || APP_VERSION;
  const latestVersion =
    updateInfo?.latest_version || updateInfo?.current_version || APP_VERSION;
  const tone = getStatusTone(updateStatus, updateInfo);
  const statusLabel = getStatusLabel(updateStatus, updateInfo, t);

  const handleCopyVersion = async () => {
    try {
      await writeClipboard(`CogniaLauncher v${currentVersion}`);
      setCopied(true);
      toast.success(t("about.versionCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("about.copyFailed"));
    }
  };

  return (
    <DashboardMetricGrid
      columns={3}
      role="group"
      aria-label={t("about.versionInfo")}
    >
      <DashboardMetricItem
        label={t("about.currentVersion")}
        icon={<Package className="h-3 w-3" aria-hidden="true" />}
        value={
          loading ? (
            <Skeleton className="h-6 w-20" aria-label={t("common.loading")} />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopyVersion}
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                  aria-label={t("about.copyVersionInfo")}
                >
                  <span>v{currentVersion}</span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("about.copyVersionInfo")}</TooltipContent>
            </Tooltip>
          )
        }
      />
      <DashboardMetricItem
        label={t("about.latestVersion")}
        icon={<CloudDownload className="h-3 w-3" aria-hidden="true" />}
        value={
          loading ? (
            <Skeleton className="h-6 w-20" aria-label={t("common.loading")} />
          ) : (
            `v${latestVersion}`
          )
        }
      />
      <DashboardMetricItem
        label={t("about.updateStatus")}
        icon={<Activity className="h-3 w-3" aria-hidden="true" />}
        value={
          loading ? (
            <Skeleton className="h-6 w-20" aria-label={t("common.loading")} />
          ) : (
            <DashboardStatusBadge tone={tone}>{statusLabel}</DashboardStatusBadge>
          )
        }
      />
    </DashboardMetricGrid>
  );
}
