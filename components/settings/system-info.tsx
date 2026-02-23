"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { formatBytes, formatUptime } from "@/lib/utils";
import type { PlatformInfo } from "@/lib/tauri";

interface SystemInfoProps {
  loading: boolean;
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  t: (key: string) => string;
}

export function SystemInfo({ loading, platformInfo, cogniaDir, t }: SystemInfoProps) {
  const unknown = t("common.unknown");

  const osDisplay = platformInfo?.os_long_version
    ? platformInfo.os_long_version
    : platformInfo?.os_version
      ? `${platformInfo.os} ${platformInfo.os_version}`
      : platformInfo?.os;

  const rows: { label: string; value: string | undefined }[] = [
    { label: t("settings.operatingSystem"), value: osDisplay },
    { label: t("settings.architecture"), value: platformInfo?.arch },
    { label: t("settings.hostname"), value: platformInfo?.hostname },
    {
      label: t("settings.cpu"),
      value: platformInfo?.cpu_model
        ? `${platformInfo.cpu_model} (${platformInfo.cpu_cores} cores)`
        : undefined,
    },
    {
      label: t("settings.memory"),
      value: platformInfo?.total_memory
        ? formatBytes(platformInfo.total_memory)
        : undefined,
    },
    {
      label: t("settings.appVersion"),
      value: platformInfo?.app_version
        ? `v${platformInfo.app_version}`
        : undefined,
    },
    { label: t("settings.dataDirectory"), value: cogniaDir || undefined },
    {
      label: t("settings.uptime"),
      value: platformInfo?.uptime
        ? formatUptime(platformInfo.uptime)
        : undefined,
    },
  ];

  return (
    <div>
        <Table>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="text-muted-foreground font-normal w-1/3">
                  {row.label}
                </TableCell>
                <TableCell className="font-medium">
                  {loading ? (
                    <Skeleton className="h-4 w-40" />
                  ) : (
                    row.value || unknown
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </div>
  );
}
