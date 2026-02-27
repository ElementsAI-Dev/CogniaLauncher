"use client";

import { useState } from "react";
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
  Thermometer,
  Battery,
  BatteryCharging,
  Wifi,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { useSystemInfoDisplay } from "@/hooks/use-system-info-display";
import { buildSystemInfoText } from "@/lib/about-utils";
import { formatUptime } from "@/lib/utils";
import { APP_VERSION } from "@/lib/app-version";
import type { SystemInfo } from "@/types/about";
import type { SelfUpdateInfo } from "@/lib/tauri";

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

  const {
    osDisplayName,
    memoryDisplay,
    memoryPercent,
    swapDisplay,
    swapPercent,
    cpuCoresDisplay,
    gpuDisplay,
  } = useSystemInfoDisplay(systemInfo);

  const copySystemInfo = async () => {
    const text = buildSystemInfoText({
      systemInfo,
      updateInfo,
      display: { osDisplayName, cpuCoresDisplay, memoryDisplay, swapDisplay, gpuDisplay },
      unknownText,
      t,
    });

    try {
      await writeClipboard(text);
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

        {/* Temperature Section - only shown if components detected */}
        {systemInfo?.components && systemInfo.components.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Thermometer className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
                  {t("about.temperature")}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                {systemInfo.components.slice(0, 6).map((comp, idx) => (
                  <InfoRow
                    key={idx}
                    label={comp.label}
                    value={
                      comp.temperature != null
                        ? `${comp.temperature.toFixed(1)}°C${comp.critical != null ? ` / ${comp.critical.toFixed(0)}°C` : ""}`
                        : undefined
                    }
                    isLoading={systemLoading}
                    unknownText={unknownText}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Battery Section - only shown if battery detected */}
        {systemInfo?.battery && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                {systemInfo.battery.isCharging ? (
                  <BatteryCharging className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Battery className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                )}
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
                  {t("about.battery")}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                <div className="space-y-1">
                  <InfoRow
                    label={t("about.batteryPercent")}
                    value={`${systemInfo.battery.percent}%`}
                    isLoading={systemLoading}
                    unknownText={unknownText}
                  />
                  {!systemLoading && (
                    <div className="flex items-center gap-2">
                      <Progress
                        value={systemInfo.battery.percent}
                        className={`h-1.5 flex-1 ${
                          systemInfo.battery.percent <= 20
                            ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                            : systemInfo.battery.percent <= 50
                              ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
                              : "[&>[data-slot=progress-indicator]]:bg-green-500"
                        }`}
                        aria-label={`${t("about.battery")} ${systemInfo.battery.percent}%`}
                      />
                      <span className="text-[11px] text-muted-foreground w-8 text-right">
                        {systemInfo.battery.percent}%
                      </span>
                    </div>
                  )}
                </div>
                <InfoRow
                  label={t("about.powerSource")}
                  value={
                    systemInfo.battery.isCharging
                      ? t("about.batteryCharging")
                      : systemInfo.battery.isPluggedIn
                        ? t("about.batteryPluggedIn")
                        : t("about.batteryDischarging")
                  }
                  isLoading={systemLoading}
                  unknownText={unknownText}
                />
                {systemInfo.battery.healthPercent != null && (
                  <InfoRow
                    label={t("about.batteryHealth")}
                    value={`${systemInfo.battery.healthPercent}%`}
                    isLoading={systemLoading}
                    unknownText={unknownText}
                  />
                )}
                {systemInfo.battery.technology && (
                  <InfoRow
                    label={t("about.batteryTechnology")}
                    value={systemInfo.battery.technology}
                    isLoading={systemLoading}
                    unknownText={unknownText}
                  />
                )}
                {systemInfo.battery.cycleCount != null && (
                  <InfoRow
                    label={t("about.cycleCount")}
                    value={`${systemInfo.battery.cycleCount}`}
                    isLoading={systemLoading}
                    unknownText={unknownText}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {/* Storage Section - only shown if disks detected */}
        {systemInfo?.disks && systemInfo.disks.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
                  {t("about.storage")}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                {systemInfo.disks.slice(0, 4).map((disk, idx) => (
                  <div key={idx} className="space-y-1">
                    <InfoRow
                      label={disk.mountPoint || disk.name}
                      value={`${disk.usedSpaceHuman} / ${disk.totalSpaceHuman} (${disk.diskType})`}
                      isLoading={systemLoading}
                      unknownText={unknownText}
                    />
                    {!systemLoading && (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={disk.usagePercent}
                          className={`h-1.5 flex-1 ${
                            disk.usagePercent > 90
                              ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                              : disk.usagePercent > 70
                                ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
                                : "[&>[data-slot=progress-indicator]]:bg-blue-500"
                          }`}
                          aria-label={`${disk.mountPoint} ${Math.round(disk.usagePercent)}%`}
                        />
                        <span className="text-[11px] text-muted-foreground w-8 text-right">
                          {Math.round(disk.usagePercent)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Network Section - only shown if interfaces detected */}
        {systemInfo?.networks && systemInfo.networks.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Wifi className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
                  {t("about.networkInfo")}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                {systemInfo.networks
                  .filter((n) => n.ipAddresses.length > 0 && n.macAddress !== "00:00:00:00:00:00")
                  .slice(0, 4)
                  .map((net, idx) => (
                    <InfoRow
                      key={idx}
                      label={net.name}
                      value={`${net.ipAddresses[0]}${net.mtu ? ` (MTU: ${net.mtu})` : ""}`}
                      isLoading={systemLoading}
                      unknownText={unknownText}
                    />
                  ))}
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
            {systemInfo?.bootTime ? (
              <InfoRow
                label={t("about.bootTime")}
                value={new Date(systemInfo.bootTime * 1000).toLocaleString()}
                isLoading={systemLoading}
                unknownText={unknownText}
              />
            ) : null}
            {systemInfo?.loadAverage && systemInfo.loadAverage.some((v) => v > 0) && (
              <InfoRow
                label={t("about.loadAverage")}
                value={systemInfo.loadAverage.map((v) => v.toFixed(2)).join(" / ")}
                isLoading={systemLoading}
                unknownText={unknownText}
              />
            )}
            {systemInfo?.globalCpuUsage != null && systemInfo.globalCpuUsage > 0 && (
              <InfoRow
                label={t("about.cpuUsage")}
                value={`${systemInfo.globalCpuUsage.toFixed(1)}%`}
                isLoading={systemLoading}
                unknownText={unknownText}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
