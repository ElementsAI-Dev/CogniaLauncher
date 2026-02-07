"use client";

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
  Check,
  Globe,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Terminal,
  FileCode,
} from "lucide-react";
import type {
  EnvironmentInfo,
  DetectedEnvironment,
  HealthStatus,
} from "@/lib/tauri";
import { useHealthCheck } from "@/hooks/use-health-check";
import { formatSize } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface EnvDetailOverviewProps {
  envType: string;
  env: EnvironmentInfo | null;
  detectedVersion: DetectedEnvironment | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvDetailOverview({
  envType,
  env,
  detectedVersion,
  t,
}: EnvDetailOverviewProps) {
  const { systemHealth, loading: healthLoading, checkAll, getStatusColor } =
    useHealthCheck();

  const totalSize = env?.installed_versions.reduce(
    (acc, v) => acc + (v.size || 0),
    0,
  ) ?? 0;

  const envHealth = systemHealth?.environments.find(
    (e) => e.env_type === envType,
  );

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return <Check className="h-4 w-4 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <ShieldCheck className="h-4 w-4 text-muted-foreground" />;
    }
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

      {/* Detected Version Alert */}
      {detectedVersion && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
          <CardContent className="flex items-center gap-3 py-4">
            <FileCode className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                {t("environments.detail.detectedInProject")}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                {t("environments.detectedVersion", {
                  version: detectedVersion.version,
                  source: detectedVersion.source.replace("_", " "),
                })}
              </p>
            </div>
            <Badge
              variant="outline"
              className="font-mono border-green-300 dark:border-green-700"
            >
              {detectedVersion.version}
            </Badge>
          </CardContent>
        </Card>
      )}

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
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-medium text-sm truncate">
                      {v.version}
                    </span>
                    {v.is_current && (
                      <Badge variant="default" className="text-xs shrink-0">
                        {t("environments.currentVersion")}
                      </Badge>
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
              onClick={checkAll}
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
                {getStatusIcon(envHealth.status)}
                <span className="font-medium text-sm">
                  {t(`environments.healthCheck.status.${envHealth.status}`)}
                </span>
                <Badge variant="secondary" className="ml-auto">
                  {envHealth.issues.length}{" "}
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
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-500" />
                      {suggestion}
                    </p>
                  ))}
                </div>
              )}

              {envHealth.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-lg border text-sm",
                    issue.severity === "critical" || issue.severity === "error"
                      ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30"
                      : issue.severity === "warning"
                        ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/30"
                        : "border-border bg-muted/30",
                  )}
                >
                  <p className="font-medium">{issue.message}</p>
                  {issue.details && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {issue.details}
                    </p>
                  )}
                  {issue.fix_command && (
                    <code className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded mt-2 block font-mono">
                      {issue.fix_command}
                    </code>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
