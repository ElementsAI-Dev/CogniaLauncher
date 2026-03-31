"use client";

import { useEffect, useRef } from "react";
import { writeClipboard } from '@/lib/clipboard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu,
  HardDrive,
  Download,
  Globe,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Terminal,
  Info,
} from "lucide-react";
import type {
  EnvironmentInfo,
  HealthStatus,
} from "@/lib/tauri";
import { useHealthCheck } from "@/hooks/health/use-health-check";
import { UpdateCheckerCard } from "@/components/environments/update-checker";
import { IssueCard } from "@/components/environments/health-check-panel";
import { formatSize } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getStatusIcon as getStatusIconComponent, getStatusColor, getStatusTextColor } from "@/lib/provider-utils";
import { toast } from "sonner";

interface EnvDetailOverviewProps {
  envType: string;
  env: EnvironmentInfo | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvDetailOverview({
  envType,
  env,
  t,
}: EnvDetailOverviewProps) {
  const { systemHealth, environmentHealth, loading: healthLoading, checkEnvironment } =
    useHealthCheck();

  // Auto-trigger health check on mount if no cached data for this env
  const autoCheckedRef = useRef(false);
  useEffect(() => {
    if (!autoCheckedRef.current && env?.available && !environmentHealth[envType]) {
      autoCheckedRef.current = true;
      checkEnvironment(envType);
    }
  }, [env?.available, envType, environmentHealth, checkEnvironment]);

  const totalSize = env?.total_size ?? env?.installed_versions.reduce(
    (acc, v) => acc + (v.size || 0),
    0,
  ) ?? 0;

  const envHealth = environmentHealth[envType] ?? systemHealth?.environments.find(
    (e) => e.env_type === envType,
  );

  const renderStatusIcon = (status: HealthStatus) => {
    const Icon = getStatusIconComponent(status);
    return <Icon className={cn("h-4 w-4", getStatusTextColor(status))} />;
  };

  if (!env) {
    return (
      <div className="text-center py-12">
        <Terminal className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">
          {t("environments.detail.notDetected")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("environments.detail.notDetectedDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" />
              {t("environments.details.currentVersion")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {env.current_version || t("common.none")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {t("environments.details.installedCount")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {env.installed_versions.length}
              <span className="text-sm font-normal text-muted-foreground ml-1.5">
                {t("environments.details.versions")}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              {t("environments.details.totalSize")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatSize(totalSize)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {t("environments.details.provider")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{env.provider}</p>
          </CardContent>
        </Card>
      </div>

      {/* Update Checker */}
      <UpdateCheckerCard env={env} t={t} />

      {/* Installed Versions Quick View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t("environments.installedVersions")}
          </CardTitle>
          <CardDescription>
            {t("environments.detail.installedVersionsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {env.installed_versions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {t("environments.details.noVersionsInstalled")}
            </div>
          ) : (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {env.installed_versions.map((v) => (
                <div
                  key={v.version}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    v.is_current
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/30",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm truncate">
                        {v.version}
                      </span>
                      {v.is_current && (
                        <Badge variant="default" className="text-xs shrink-0">
                          {t("environments.currentVersion")}
                        </Badge>
                      )}
                    </div>
                    {v.install_path && (
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={v.install_path}>
                        {v.install_path}
                      </p>
                    )}
                  </div>
                  {v.size != null && v.size > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatSize(v.size)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Check */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {t("environments.detail.healthStatus")}
              </CardTitle>
              <CardDescription>
                {t("environments.detail.healthStatusDesc")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkEnvironment(envType)}
              disabled={healthLoading}
              className="gap-2"
            >
              {healthLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t("environments.detail.runHealthCheck")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!envHealth ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t("environments.detail.noHealthData")}</p>
              <p className="text-xs mt-1">
                {t("environments.detail.clickRunHealth")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border",
                  getStatusColor(envHealth.status),
                )}
              >
                {renderStatusIcon(envHealth.status)}
                <span className="font-medium text-sm">
                  {t(`environments.healthCheck.status.${envHealth.status}`)}
                </span>
                <Badge variant="secondary" className="ml-auto">
                  {envHealth.issues.filter(i => i.severity !== 'info').length}{" "}
                  {t("environments.healthCheck.issues")}
                </Badge>
              </div>

              {envHealth.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  {envHealth.suggestions.map((suggestion, idx) => (
                    <p
                      key={idx}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      {suggestion}
                    </p>
                  ))}
                </div>
              )}

              {envHealth.issues.map((issue, idx) => (
                <IssueCard
                  key={idx}
                  issue={issue}
                  onCopy={(text) => {
                    writeClipboard(text).then(
                      () => toast.success(t("common.copied")),
                      () => toast.error(t("common.copyFailed")),
                    );
                  }}
                  t={(key, params) => t(`environments.healthCheck.${key}`, params)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
