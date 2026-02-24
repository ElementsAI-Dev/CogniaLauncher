"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
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
      className="border-blue-200 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800"
      role="alert"
      aria-live="polite"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          <span className="text-blue-900 dark:text-blue-100">
            {t("about.updateAvailable")}
          </span>
          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-transparent">
            v{updateInfo.latest_version}
          </Badge>
        </CardTitle>
        <CardDescription className="text-blue-700 dark:text-blue-300">
          {t("about.updateBannerDesc")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {updateInfo.release_notes && (
          <ScrollArea className="max-h-48" aria-label={t("about.releaseNotes")}>
            <div className="text-sm text-blue-800 dark:text-blue-200 bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
              <MarkdownRenderer content={updateInfo.release_notes} className="prose-sm" />
            </div>
          </ScrollArea>
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
          variant="default"
          onClick={onUpdate}
          disabled={updating || !isDesktop}
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
