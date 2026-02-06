"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Server } from "lucide-react";
import type { PlatformInfo } from "@/lib/tauri";

interface SystemInfoProps {
  loading: boolean;
  platformInfo: PlatformInfo | null;
  t: (key: string) => string;
}

export function SystemInfo({ loading, platformInfo, t }: SystemInfoProps) {
  return (
    <Card role="region" aria-labelledby="system-info-heading">
      <CardHeader>
        <CardTitle id="system-info-heading" className="flex items-center gap-2">
          <Server className="h-5 w-5" aria-hidden="true" />
          {t("settings.systemInfo")}
        </CardTitle>
        <CardDescription>{t("settings.systemInfoDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">
                {t("settings.operatingSystem")}
              </p>
              <p className="font-medium">
                {platformInfo?.os || t("common.unknown")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t("settings.architecture")}
              </p>
              <p className="font-medium">
                {platformInfo?.arch || t("common.unknown")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
