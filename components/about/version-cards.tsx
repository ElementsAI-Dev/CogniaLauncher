"use client";

import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="rounded-xl border bg-card">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" aria-hidden="true" />
            <span
              className="text-sm font-medium text-foreground"
              id="current-version-label"
            >
              {t("about.currentVersion")}
            </span>
          </div>
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
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30"
                  role="status"
                  aria-live="polite"
                >
                  <Check
                    className="h-3 w-3 text-green-600 dark:text-green-400"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {t("about.upToDate")}
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Latest Version Card */}
      <Card className="rounded-xl border bg-card">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CloudDownload
              className="h-5 w-5 text-purple-500"
              aria-hidden="true"
            />
            <span
              className="text-sm font-medium text-foreground"
              id="latest-version-label"
            >
              {t("about.latestVersion")}
            </span>
          </div>
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
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {t("about.updateAvailable")}
                </span>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
