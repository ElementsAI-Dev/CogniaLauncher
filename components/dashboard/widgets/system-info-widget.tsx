"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Monitor, Cpu, HardDrive } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import type { PlatformInfo } from "@/lib/tauri";

interface SystemInfoWidgetProps {
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  className?: string;
}

export function SystemInfoWidget({ platformInfo, cogniaDir, className }: SystemInfoWidgetProps) {
  const { t } = useLocale();

  if (!platformInfo) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {t("dashboard.widgets.systemInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        </CardContent>
      </Card>
    );
  }

  const infoItems = [
    {
      icon: <Monitor className="h-4 w-4" />,
      label: t("dashboard.widgets.operatingSystem"),
      value: platformInfo.os,
    },
    {
      icon: <Cpu className="h-4 w-4" />,
      label: t("dashboard.widgets.architecture"),
      value: platformInfo.arch,
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
        <div className="space-y-3">
          {infoItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className={cn("text-sm font-medium", item.truncate && "truncate")} title={item.value}>
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
