"use client";

import { useState, useMemo } from "react";
import { writeClipboard } from '@/lib/clipboard';
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Monitor,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Cpu,
  HardDrive,
  Server,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatUptime } from "@/lib/utils";
import type { SystemInfo } from "@/hooks/use-about-data";
import type { SelfUpdateInfo } from "@/lib/tauri";
import { APP_VERSION } from "@/lib/app-version";

interface InfoRowProps {
  label: string;
  value: string | undefined;
  isMono?: boolean;
  isLoading: boolean;
  unknownText: string;
}

function InfoRow({
  label,
  value,
  isMono = false,
  isLoading,
  unknownText,
}: InfoRowProps) {
  return (
    <div className="flex justify-between items-center min-h-[24px]">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : isMono && value && value.length > 25 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[13px] font-medium text-foreground font-mono truncate max-w-[200px] cursor-help">
              {value}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs break-all">
            {value}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span
          className={`text-[13px] font-medium text-foreground ${isMono ? "font-mono" : ""}`}
        >
          {value || unknownText}
        </span>
      )}
    </div>
  );
}

interface SystemInfoCardProps {
  systemInfo: SystemInfo | null;
  systemLoading: boolean;
  updateInfo: SelfUpdateInfo | null;
  systemError: string | null;
  onRetry: () => void;
  t: (key: string) => string;
}

export function SystemInfoCard({
  systemInfo,
  systemLoading,
  updateInfo,
  systemError,
  onRetry,
  t,
}: SystemInfoCardProps) {
  const [copied, setCopied] = useState(false);

  const unknownText = t("common.unknown");

  const osDisplayName = useMemo(() => {
    if (!systemInfo) return undefined;
    if (systemInfo.osLongVersion) return systemInfo.osLongVersion;
    if (systemInfo.osVersion) return `${systemInfo.os} ${systemInfo.osVersion}`;
    return systemInfo.os;
  }, [systemInfo]);

  const memoryDisplay = useMemo(() => {
    if (!systemInfo || systemInfo.totalMemory === 0) return undefined;
    return `${formatBytes(systemInfo.usedMemory)} / ${formatBytes(systemInfo.totalMemory)}`;
  }, [systemInfo]);

  const memoryPercent = useMemo(() => {
    if (!systemInfo || systemInfo.totalMemory === 0) return 0;
    return Math.round(
      (systemInfo.usedMemory / systemInfo.totalMemory) * 100
    );
  }, [systemInfo]);

  const swapDisplay = useMemo(() => {
    if (!systemInfo || systemInfo.totalSwap === 0) return undefined;
    return `${formatBytes(systemInfo.usedSwap)} / ${formatBytes(systemInfo.totalSwap)}`;
  }, [systemInfo]);

  const swapPercent = useMemo(() => {
    if (!systemInfo || systemInfo.totalSwap === 0) return 0;
    return Math.round(
      (systemInfo.usedSwap / systemInfo.totalSwap) * 100
    );
  }, [systemInfo]);

  const cpuCoresDisplay = useMemo(() => {
    if (!systemInfo || !systemInfo.cpuCores) return undefined;
    const logical = systemInfo.cpuCores;
    const physical = systemInfo.physicalCoreCount;
    if (physical && physical !== logical) {
      return `${physical}P / ${logical}L`;
    }
    return `${logical}`;
  }, [systemInfo]);

  const gpuDisplay = useMemo(() => {
    if (!systemInfo?.gpus?.length) return undefined;
    return systemInfo.gpus
      .map((g) => {
        let s = g.name;
        if (g.vramMb) s += ` (${g.vramMb >= 1024 ? `${(g.vramMb / 1024).toFixed(1)} GB` : `${g.vramMb} MB`})`;
        return s;
      })
      .join(", ");
  }, [systemInfo]);

  const copySystemInfo = async () => {
    const lines = [
      `${t("about.systemInfoTitle")}`,
      "================================",
      `${t("about.version")}: v${updateInfo?.current_version || systemInfo?.appVersion || APP_VERSION}`,
      `${t("about.operatingSystem")}: ${osDisplayName || unknownText}`,
      `${t("about.architecture")}: ${systemInfo?.cpuArch || systemInfo?.arch || unknownText}`,
      `${t("about.kernelVersion")}: ${systemInfo?.kernelVersion || unknownText}`,
      `${t("about.hostname")}: ${systemInfo?.hostname || unknownText}`,
      `${t("about.cpu")}: ${systemInfo?.cpuModel || unknownText} (${cpuCoresDisplay || 0} ${t("about.cores")})`,
      `${t("about.cpuFrequency")}: ${systemInfo?.cpuFrequency ? `${systemInfo.cpuFrequency} MHz` : unknownText}`,
      `${t("about.memory")}: ${memoryDisplay || unknownText}`,
      `${t("about.swap")}: ${swapDisplay || unknownText}`,
      `${t("about.gpu")}: ${gpuDisplay || unknownText}`,
      `${t("about.uptime")}: ${systemInfo?.uptime ? formatUptime(systemInfo.uptime) : unknownText}`,
      `${t("about.homeDirectory")}: ${systemInfo?.homeDir || "~/.cognia"}`,
      `${t("about.locale")}: ${systemInfo?.locale || "en-US"}`,
    ];

    try {
      await writeClipboard(lines.join("\n"));
      setCopied(true);
      toast.success(t("about.copiedToClipboard"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("about.copyFailed"));
    }
  };

  return (
    <Card
      role="region"
      aria-labelledby="system-info-heading"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="system-info-heading">{t("about.systemInfo")}</span>
        </CardTitle>
        <CardDescription>{t("about.systemInfoDesc")}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRetry}
                  disabled={systemLoading}
                  className="h-8 px-2"
                  aria-label={t("about.systemInfoRetry")}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${systemLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("about.systemInfoRetry")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copySystemInfo}
                  className="h-8 px-2"
                  aria-label={t("about.copySystemInfo")}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("about.copySystemInfo")}</TooltipContent>
            </Tooltip>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">

        {systemError && (
          <Alert variant="destructive" aria-live="assertive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              <span>{t("about.errorTitle")}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-7 px-2 text-destructive-foreground hover:bg-destructive/80"
              >
                <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                {t("common.retry")}
              </Button>
            </AlertTitle>
            <AlertDescription>{t("about.systemInfoFailed")}</AlertDescription>
          </Alert>
        )}

        {/* OS & Device Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Server className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
              {t("about.deviceInfo")}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <InfoRow
              label={t("about.operatingSystem")}
              value={osDisplayName}
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.architecture")}
              value={systemInfo?.arch}
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.kernelVersion")}
              value={systemInfo?.kernelVersion || undefined}
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.hostname")}
              value={systemInfo?.hostname || undefined}
              isLoading={systemLoading}
              unknownText={unknownText}
            />
          </div>
        </div>

        <Separator />

        {/* Hardware Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
              {t("about.hardwareInfo")}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <InfoRow
              label={t("about.cpu")}
              value={
                systemInfo?.cpuModel
                  ? `${systemInfo.cpuModel}`
                  : undefined
              }
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.cpuCores")}
              value={
                cpuCoresDisplay
                  ? `${cpuCoresDisplay} ${t("about.cores")}`
                  : undefined
              }
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.cpuFrequency")}
              value={
                systemInfo?.cpuFrequency
                  ? `${systemInfo.cpuFrequency} MHz`
                  : undefined
              }
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.cpuVendor")}
              value={systemInfo?.cpuVendorId || undefined}
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <div className="space-y-1">
              <InfoRow
                label={t("about.memory")}
                value={memoryDisplay}
                isLoading={systemLoading}
                unknownText={unknownText}
              />
              {!systemLoading && systemInfo && systemInfo.totalMemory > 0 && (
                <div className="flex items-center gap-2">
                  <Progress
                    value={memoryPercent}
                    className={`h-1.5 flex-1 ${
                      memoryPercent > 90
                        ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                        : memoryPercent > 70
                          ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
                          : "[&>[data-slot=progress-indicator]]:bg-green-500"
                    }`}
                    aria-label={`${t("about.memory")} ${memoryPercent}%`}
                  />
                  <span className="text-[11px] text-muted-foreground w-8 text-right">
                    {memoryPercent}%
                  </span>
                </div>
              )}
            </div>
            {systemInfo && systemInfo.totalSwap > 0 && (
              <div className="space-y-1">
                <InfoRow
                  label={t("about.swap")}
                  value={swapDisplay}
                  isLoading={systemLoading}
                  unknownText={unknownText}
                />
                {!systemLoading && (
                  <div className="flex items-center gap-2">
                    <Progress
                      value={swapPercent}
                      className={`h-1.5 flex-1 ${
                        swapPercent > 90
                          ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                          : swapPercent > 70
                            ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
                            : "[&>[data-slot=progress-indicator]]:bg-blue-500"
                      }`}
                      aria-label={`${t("about.swap")} ${swapPercent}%`}
                    />
                    <span className="text-[11px] text-muted-foreground w-8 text-right">
                      {swapPercent}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* GPU Section - only shown if GPUs detected */}
        {systemInfo?.gpus && systemInfo.gpus.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
                  {t("about.gpuInfo")}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                {systemInfo.gpus.map((gpu, idx) => (
                  <InfoRow
                    key={idx}
                    label={systemInfo.gpus.length > 1 ? `GPU ${idx + 1}` : t("about.gpu")}
                    value={gpu.name}
                    isLoading={systemLoading}
                    unknownText={unknownText}
                  />
                ))}
                {systemInfo.gpus[0]?.vramMb && (
                  <InfoRow
                    label={t("about.gpuVram")}
                    value={
                      systemInfo.gpus[0].vramMb >= 1024
                        ? `${(systemInfo.gpus[0].vramMb / 1024).toFixed(1)} GB`
                        : `${systemInfo.gpus[0].vramMb} MB`
                    }
                    isLoading={systemLoading}
                    unknownText={unknownText}
                  />
                )}
                {systemInfo.gpus[0]?.driverVersion && (
                  <InfoRow
                    label={t("about.gpuDriver")}
                    value={systemInfo.gpus[0].driverVersion}
                    isLoading={systemLoading}
                    unknownText={unknownText}
                  />
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Runtime Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
              {t("about.runtimeInfo")}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <InfoRow
              label={t("about.appVersion")}
              value={
                systemInfo?.appVersion
                  ? `v${systemInfo.appVersion}`
                  : `v${APP_VERSION}`
              }
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.homeDirectory")}
              value={systemInfo?.homeDir}
              isMono
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.uptime")}
              value={
                systemInfo?.uptime
                  ? formatUptime(systemInfo.uptime)
                  : undefined
              }
              isLoading={systemLoading}
              unknownText={unknownText}
            />
            <InfoRow
              label={t("about.locale")}
              value={systemInfo?.locale}
              isLoading={systemLoading}
              unknownText={unknownText}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
