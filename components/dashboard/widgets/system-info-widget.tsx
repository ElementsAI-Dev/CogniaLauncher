"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Monitor, Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn, formatBytes } from "@/lib/utils";
import type { PlatformInfo } from "@/lib/tauri";
import { WidgetEmptyCard } from "@/components/dashboard/widgets/widget-empty-card";
import { DashboardMetricItem } from "@/components/dashboard/dashboard-primitives";

interface SystemInfoWidgetProps {
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  className?: string;
}

export function SystemInfoWidget({ platformInfo, cogniaDir, className }: SystemInfoWidgetProps) {
  const { t } = useLocale();

  if (!platformInfo) {
    return (
      <WidgetEmptyCard
        title={t("dashboard.widgets.systemInfo")}
        message={t("common.loading")}
        className={className}
      />
    );
  }

  const osDisplay = platformInfo.osLongVersion
    || (platformInfo.osVersion ? `${platformInfo.os} ${platformInfo.osVersion}` : platformInfo.os);

  const infoItems = [
    {
      icon: <Monitor className="h-4 w-4" />,
      label: t("dashboard.widgets.operatingSystem"),
      value: osDisplay,
    },
    {
      icon: <Cpu className="h-4 w-4" />,
      label: t("dashboard.widgets.cpu"),
      value: platformInfo.cpuModel
        ? `${platformInfo.cpuModel} (${platformInfo.cpuCores} cores)`
        : platformInfo.arch,
    },
    {
      icon: <MemoryStick className="h-4 w-4" />,
      label: t("dashboard.widgets.memory"),
      value: platformInfo.totalMemory
        ? formatBytes(platformInfo.totalMemory)
        : t("common.unknown"),
    },
    {
      icon: <Server className="h-4 w-4" />,
      label: t("dashboard.widgets.hostname"),
      value: platformInfo.hostname || t("common.unknown"),
    },
    {
      icon: <HardDrive className="h-4 w-4" />,
      label: t("dashboard.widgets.dataDirectory"),
      value: cogniaDir || t("common.unknown"),
      truncate: true,
    },
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.systemInfo")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.systemInfoDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {infoItems.map((item) => (
            <DashboardMetricItem
              key={item.label}
              className="py-3"
              icon={<span className="text-muted-foreground">{item.icon}</span>}
              label={item.label}
              value={<span className={cn(item.truncate && "truncate")} title={item.value}>{item.value}</span>}
              valueClassName="mt-1 text-sm font-medium"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
