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

  const osDisplay = platformInfo?.osLongVersion
    ? platformInfo.osLongVersion
    : platformInfo?.osVersion
      ? `${platformInfo.os} ${platformInfo.osVersion}`
      : platformInfo?.os;

  const rows: { label: string; value: string | undefined }[] = [
    { label: t("settings.operatingSystem"), value: osDisplay },
    { label: t("settings.architecture"), value: platformInfo?.arch },
    { label: t("settings.hostname"), value: platformInfo?.hostname },
    {
      label: t("settings.cpu"),
      value: platformInfo?.cpuModel
        ? `${platformInfo.cpuModel} (${platformInfo.cpuCores} cores)`
        : undefined,
    },
    {
      label: t("settings.memory"),
      value: platformInfo?.totalMemory
        ? formatBytes(platformInfo.totalMemory)
        : undefined,
    },
    {
      label: t("settings.appVersion"),
      value: platformInfo?.appVersion
        ? `v${platformInfo.appVersion}`
        : undefined,
    },
    { label: t("settings.dataDirectory"), value: cogniaDir || undefined },
    {
      label: t("settings.uptime"),
      value: platformInfo?.uptime
        ? formatUptime(platformInfo.uptime)
        : undefined,
    },
    {
      label: t("settings.swap"),
      value: platformInfo?.totalSwap
        ? `${formatBytes(platformInfo.usedSwap)} / ${formatBytes(platformInfo.totalSwap)}`
        : undefined,
    },
    {
      label: t("settings.gpu"),
      value: platformInfo?.gpus?.length
        ? platformInfo.gpus.map((g) => g.name).join(", ")
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
