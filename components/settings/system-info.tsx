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
  cogniaDir: string | null;
  t: (key: string) => string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

function InfoItem({
  label,
  value,
  loading,
  unknown,
}: {
  label: string;
  value: string | undefined;
  loading: boolean;
  unknown: string;
}) {
  if (loading) return <Skeleton className="h-12 w-full" />;
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value || unknown}</p>
    </div>
  );
}

export function SystemInfo({ loading, platformInfo, cogniaDir, t }: SystemInfoProps) {
  const unknown = t("common.unknown");

  const osDisplay = platformInfo?.os_long_version
    ? platformInfo.os_long_version
    : platformInfo?.os_version
      ? `${platformInfo.os} ${platformInfo.os_version}`
      : platformInfo?.os;

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <InfoItem
            label={t("settings.operatingSystem")}
            value={osDisplay}
            loading={loading}
            unknown={unknown}
          />
          <InfoItem
            label={t("settings.architecture")}
            value={platformInfo?.arch}
            loading={loading}
            unknown={unknown}
          />
          <InfoItem
            label={t("settings.hostname")}
            value={platformInfo?.hostname}
            loading={loading}
            unknown={unknown}
          />
          <InfoItem
            label={t("settings.cpu")}
            value={
              platformInfo?.cpu_model
                ? `${platformInfo.cpu_model} (${platformInfo.cpu_cores} cores)`
                : undefined
            }
            loading={loading}
            unknown={unknown}
          />
          <InfoItem
            label={t("settings.memory")}
            value={
              platformInfo?.total_memory
                ? formatBytes(platformInfo.total_memory)
                : undefined
            }
            loading={loading}
            unknown={unknown}
          />
          <InfoItem
            label={t("settings.appVersion")}
            value={platformInfo?.app_version ? `v${platformInfo.app_version}` : undefined}
            loading={loading}
            unknown={unknown}
          />
          <InfoItem
            label={t("settings.dataDirectory")}
            value={cogniaDir || undefined}
            loading={loading}
            unknown={unknown}
          />
          <InfoItem
            label={t("settings.uptime")}
            value={
              platformInfo?.uptime
                ? formatUptime(platformInfo.uptime)
                : undefined
            }
            loading={loading}
            unknown={unknown}
          />
        </div>
      </CardContent>
    </Card>
  );
}
