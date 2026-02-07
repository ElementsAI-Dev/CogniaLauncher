"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Gauge,
  Cpu,
  Zap,
  Shield,
} from "lucide-react";
import type { ProviderInfo, PackageManagerHealthResult, EnvironmentProviderInfo } from "@/types/tauri";
import { cn } from "@/lib/utils";
import { getPlatformIcon, getCapabilityColor } from "../provider-icons";

interface ProviderOverviewTabProps {
  provider: ProviderInfo;
  isAvailable: boolean | null;
  healthResult: PackageManagerHealthResult | null;
  environmentProviderInfo: EnvironmentProviderInfo | null;
  installedCount: number;
  updatesCount: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ProviderOverviewTab({
  provider,
  isAvailable,
  healthResult,
  environmentProviderInfo,
  installedCount,
  updatesCount,
  t,
}: ProviderOverviewTabProps) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            {t("providerDetail.quickStats")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold">{installedCount}</p>
              <p className="text-xs text-muted-foreground">
                {t("providerDetail.installedPackages")}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{updatesCount}</p>
              <p className="text-xs text-muted-foreground">
                {t("providerDetail.availableUpdates")}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{provider.priority}</p>
              <p className="text-xs text-muted-foreground">
                {t("providers.priority")}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                {isAvailable ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : isAvailable === false ? (
                  <XCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <span className="text-2xl font-bold">-</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("providerDetail.status")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            {t("providerDetail.systemInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {healthResult?.version && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {t("providerDetail.detectedVersion")}
              </Label>
              <p className="text-sm font-mono">{healthResult.version}</p>
            </div>
          )}
          {healthResult?.executable_path && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {t("providerDetail.executablePath")}
              </Label>
              <p className="text-sm font-mono truncate" title={healthResult.executable_path}>
                {healthResult.executable_path}
              </p>
            </div>
          )}
          {!healthResult?.version && !healthResult?.executable_path && (
            <p className="text-sm text-muted-foreground">
              {t("providerDetail.noSystemInfo")}
            </p>
          )}
          {healthResult?.install_instructions && !isAvailable && (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">
                {t("providerDetail.installInstructions")}
              </Label>
              <code className="block text-xs bg-muted p-2 rounded mt-1 whitespace-pre-wrap">
                {healthResult.install_instructions}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t("providers.capabilities")}
          </CardTitle>
          <CardDescription>
            {t("providerDetail.capabilitiesDesc", { count: provider.capabilities.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {provider.capabilities.map((cap) => (
              <Badge
                key={cap}
                variant="secondary"
                className={cn("text-sm", getCapabilityColor(cap))}
              >
                {cap.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Platforms */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("providers.platforms")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {provider.platforms.map((platform) => (
              <div
                key={platform}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50"
              >
                <span className="text-lg" aria-hidden="true">
                  {getPlatformIcon(platform)}
                </span>
                <span className="text-sm font-medium capitalize">{platform}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Environment Provider Info */}
      {environmentProviderInfo && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t("providerDetail.environmentInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t("providerDetail.envType")}
                </Label>
                <p className="text-sm font-medium capitalize">
                  {environmentProviderInfo.env_type}
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-muted-foreground">
                  {t("providerDetail.envDescription")}
                </Label>
                <p className="text-sm">{environmentProviderInfo.description}</p>
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              {t("providerDetail.environmentHint")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
