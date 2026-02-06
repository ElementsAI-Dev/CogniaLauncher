"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download } from "lucide-react";
import type { SelfUpdateInfo } from "@/lib/tauri";

interface UpdateBannerProps {
  updateInfo: SelfUpdateInfo | null;
  updating: boolean;
  updateProgress: number;
  updateStatus: "idle" | "downloading" | "installing" | "done" | "error";
  isDesktop: boolean;
  onUpdate: () => void;
  t: (key: string) => string;
}

export function UpdateBanner({
  updateInfo,
  updating,
  updateProgress,
  updateStatus,
  isDesktop,
  onUpdate,
  t,
}: UpdateBannerProps) {
  if (!updateInfo?.update_available) {
    return null;
  }

  return (
    <Card
      className="rounded-xl border-blue-200 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800"
      role="alert"
      aria-live="polite"
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Download
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          <span className="font-semibold text-blue-900 dark:text-blue-100">
            {t("about.updateAvailable")} - v{updateInfo.latest_version}
          </span>
        </div>

        {updateInfo.release_notes && (
          <div
            className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700 max-h-48 overflow-y-auto"
            aria-label={t("about.releaseNotes")}
          >
            {updateInfo.release_notes}
          </div>
        )}

        {updating && (
          <div className="space-y-2">
            <Progress
              value={updateProgress}
              className="h-2"
              aria-label={t("about.downloadProgress")}
            />
            <span className="text-xs text-blue-700 dark:text-blue-300">
              {updateStatus === "installing"
                ? t("about.installing")
                : t("about.downloading")}{" "}
              {updateProgress > 0 ? `${updateProgress}%` : "..."}
            </span>
          </div>
        )}

        <Button
          onClick={onUpdate}
          disabled={updating || !isDesktop}
          className="bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-describedby="update-description"
        >
          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
          {updating ? t("about.downloading") : t("common.update")}
        </Button>
        <span id="update-description" className="sr-only">
          {isDesktop
            ? t("about.updateDescription")
            : t("about.updateDesktopOnly")}
        </span>
      </CardContent>
    </Card>
  );
}
