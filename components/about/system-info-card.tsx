"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { toast } from "sonner";
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  if (seconds === 0) return "";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "< 1m";
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
    const used = systemInfo.totalMemory - systemInfo.availableMemory;
    return `${formatBytes(used)} / ${formatBytes(systemInfo.totalMemory)}`;
  }, [systemInfo]);

  const memoryPercent = useMemo(() => {
    if (!systemInfo || systemInfo.totalMemory === 0) return 0;
    return Math.round(
      ((systemInfo.totalMemory - systemInfo.availableMemory) /
        systemInfo.totalMemory) *
        100
    );
  }, [systemInfo]);

  const copySystemInfo = async () => {
    const lines = [
      `${t("about.systemInfoTitle")}`,
      "================================",
      `${t("about.version")}: v${updateInfo?.current_version || systemInfo?.appVersion || APP_VERSION}`,
      `${t("about.operatingSystem")}: ${osDisplayName || unknownText}`,
      `${t("about.architecture")}: ${systemInfo?.arch || unknownText}`,
      `${t("about.kernelVersion")}: ${systemInfo?.kernelVersion || unknownText}`,
      `${t("about.hostname")}: ${systemInfo?.hostname || unknownText}`,
      `${t("about.cpu")}: ${systemInfo?.cpuModel || unknownText} (${systemInfo?.cpuCores || 0} ${t("about.cores")})`,
      `${t("about.memory")}: ${memoryDisplay || unknownText}`,
      `${t("about.uptime")}: ${systemInfo?.uptime ? formatUptime(systemInfo.uptime) : unknownText}`,
      `${t("about.homeDirectory")}: ${systemInfo?.homeDir || "~/.cognia"}`,
      `${t("about.locale")}: ${systemInfo?.locale || "en-US"}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast.success(t("about.copiedToClipboard"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("about.copyFailed"));
    }
  };

  return (
    <Card
      className="rounded-xl border bg-card"
      role="region"
      aria-labelledby="system-info-heading"
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-foreground" aria-hidden="true" />
            <span
              id="system-info-heading"
              className="text-base font-semibold text-foreground"
            >
              {t("about.systemInfo")}
            </span>
          </div>
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
        </div>

        {systemError && (
          <Alert
            variant="destructive"
            role="alert"
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle
                className="h-4 w-4 flex-shrink-0"
                aria-hidden="true"
              />
              <AlertDescription>{t("about.systemInfoFailed")}</AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-7 px-2 text-destructive-foreground hover:bg-destructive/80"
            >
              <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
              {t("common.retry")}
            </Button>
          </Alert>
        )}

        {/* OS & Device Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Server className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("about.deviceInfo")}
            </span>
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
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("about.hardwareInfo")}
            </span>
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
                systemInfo?.cpuCores
                  ? `${systemInfo.cpuCores} ${t("about.cores")}`
                  : undefined
              }
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
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        memoryPercent > 90
                          ? "bg-red-500"
                          : memoryPercent > 70
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${memoryPercent}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-8 text-right">
                    {memoryPercent}%
                  </span>
                </div>
              )}
            </div>
            <InfoRow
              label={t("about.totalMemory")}
              value={
                systemInfo?.totalMemory
                  ? formatBytes(systemInfo.totalMemory)
                  : undefined
              }
              isLoading={systemLoading}
              unknownText={unknownText}
            />
          </div>
        </div>

        <Separator />

        {/* Runtime Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("about.runtimeInfo")}
            </span>
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
