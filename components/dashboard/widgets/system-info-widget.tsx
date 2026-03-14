"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Monitor, Cpu, HardDrive, MemoryStick, Server, Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn, formatBytes } from "@/lib/utils";
import type { PlatformInfo } from "@/lib/tauri";
import {
  DashboardEmptyState,
  DashboardMetricItem,
} from "@/components/dashboard/dashboard-primitives";

interface SystemInfoWidgetProps {
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  onRecover?: () => void;
}

export function SystemInfoWidget({
  platformInfo,
  cogniaDir,
  className,
  isLoading = false,
  error = null,
  onRecover,
}: SystemInfoWidgetProps) {
  const { t } = useLocale();

  if (!platformInfo) {
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
        <CardContent className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{t("dashboard.widgets.sectionNeedsAttention")}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{error}</p>
                {onRecover && (
                  <Button variant="outline" size="sm" onClick={onRecover}>
                    {t("dashboard.widgets.retry")}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          <DashboardEmptyState
            icon={
              isLoading
                ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
                : <Monitor className="h-8 w-8 text-muted-foreground/60" />
            }
            message={isLoading ? t("dashboard.widgets.sectionLoading") : t("dashboard.widgets.systemInfoUnavailable")}
          />
        </CardContent>
      </Card>
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
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>{t("dashboard.widgets.sectionNeedsAttention")}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              {onRecover && (
                <Button variant="outline" size="sm" onClick={onRecover}>
                  {t("dashboard.widgets.retry")}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
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
