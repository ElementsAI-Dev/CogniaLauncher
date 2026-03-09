"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import type { SelfUpdateInfo } from "@/lib/tauri";
import type { UpdateStatus } from "@/types/about";
import { getStatusLabelKey } from "@/lib/update-lifecycle";

interface UpdateBannerProps {
  updateInfo: SelfUpdateInfo | null;
  updating: boolean;
  updateProgress: number;
  updateStatus: UpdateStatus;
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
  const shouldRender =
    !!updateInfo?.update_available ||
    updating ||
    updateStatus === "downloading" ||
    updateStatus === "installing" ||
    updateStatus === "done" ||
    updateStatus === "error";

  if (!shouldRender) {
    return null;
  }

  const statusLabelKey = getStatusLabelKey(updateStatus);
  const isActiveProgress =
    updating || updateStatus === "downloading" || updateStatus === "installing";
  const description =
    updateStatus === "idle" || updateStatus === "update_available"
      ? t("about.updateBannerDesc")
      : t(statusLabelKey);

  return (
    <Card
      className="border-primary/30 bg-primary/5"
      role="alert"
      aria-live="polite"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Download
            className="h-5 w-5 text-primary"
            aria-hidden="true"
          />
          <span>
            {updateStatus === "error"
              ? t("about.errorTitle")
              : t("about.updateAvailable")}
          </span>
          <Badge variant="secondary">
            v{updateInfo?.latest_version || updateInfo?.current_version}
          </Badge>
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {updateInfo?.release_notes && (
          <ScrollArea className="max-h-48" aria-label={t("about.releaseNotes")}>
            <div className="rounded-lg border bg-background/70 p-3 text-sm">
              <MarkdownRenderer content={updateInfo.release_notes} className="prose-sm" />
            </div>
          </ScrollArea>
        )}

        {isActiveProgress && (
          <div className="flex flex-col gap-2">
            <Progress
              value={updateProgress}
              className="h-2"
              aria-label={t("about.downloadProgress")}
            />
            <span className="text-xs text-muted-foreground">
              {t(statusLabelKey)}{" "}
              {updateProgress > 0 ? `${updateProgress}%` : "..."}
            </span>
          </div>
        )}

        <Button
          variant="default"
          onClick={onUpdate}
          disabled={isActiveProgress || !isDesktop}
          aria-describedby="update-description"
          className="w-fit"
        >
          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
          {isActiveProgress ? t("about.downloading") : t("common.update")}
        </Button>
        <span id="update-description" className="sr-only">
          {isDesktop
            ? t("about.updateDescription")
            : t("about.updateDesktopOnly")}
        </span>
        {!isDesktop ? (
          <p className="text-xs text-muted-foreground">
            {t("about.updateDesktopOnly")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
