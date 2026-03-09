"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, CloudDownload, Check } from "lucide-react";
import { APP_VERSION } from "@/lib/app-version";
import type { SelfUpdateInfo } from "@/lib/tauri";

interface VersionCardsProps {
  loading: boolean;
  updateInfo: SelfUpdateInfo | null;
  t: (key: string) => string;
}

export function VersionCards({ loading, updateInfo, t }: VersionCardsProps) {
  const currentVersion = updateInfo?.current_version || APP_VERSION;
  const latestVersion =
    updateInfo?.latest_version || updateInfo?.current_version || APP_VERSION;

  return (
    <div
      className="grid gap-4 grid-cols-1 md:grid-cols-2"
      role="group"
      aria-label={t("about.versionInfo")}
    >
      {/* Current Version Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-5 w-5 text-foreground" aria-hidden="true" />
            <span id="current-version-label">{t("about.currentVersion")}</span>
          </CardTitle>
          <CardDescription>{t("about.versionInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading ? (
            <Skeleton className="h-10 w-32" aria-label={t("common.loading")} />
          ) : (
            <>
              <span
                className="text-[32px] font-bold text-foreground block"
                aria-labelledby="current-version-label"
              >
                v{currentVersion}
              </span>
              {updateInfo?.update_available === false && (
                <Badge
                  variant="secondary"
                  role="status"
                  aria-live="polite"
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                  {t("about.upToDate")}
                </Badge>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Latest Version Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CloudDownload
              className="h-5 w-5 text-foreground"
              aria-hidden="true"
            />
            <span id="latest-version-label">{t("about.latestVersion")}</span>
          </CardTitle>
          <CardDescription>{t("about.versionInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading ? (
            <Skeleton className="h-10 w-32" aria-label={t("common.loading")} />
          ) : (
            <>
              <span
                className="text-[32px] font-bold text-foreground block"
                aria-labelledby="latest-version-label"
              >
                v{latestVersion}
              </span>
              {updateInfo?.update_available && (
                <Badge variant="secondary">
                  {t("about.updateAvailable")}
                </Badge>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
