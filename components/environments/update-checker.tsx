"use client";

import { useState, useCallback } from "react";
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
  ArrowUpCircle,
  Loader2,
  RefreshCw,
  Check,
  ArrowRight,
} from "lucide-react";
import type { EnvironmentInfo, VersionInfo } from "@/lib/tauri";
import { useEnvironments } from "@/hooks/use-environments";
import { cn } from "@/lib/utils";

export interface EnvUpdateInfo {
  envType: string;
  currentVersion: string;
  latestVersion: string;
  latestStable: string | null;
  availableCount: number;
}

interface UpdateCheckerCardProps {
  env: EnvironmentInfo;
  compact?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function UpdateCheckerCard({
  env,
  compact = false,
  t,
}: UpdateCheckerCardProps) {
  const { fetchAvailableVersions } = useEnvironments();
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<EnvUpdateInfo | null>(null);
  const [checked, setChecked] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (!env.current_version) return;
    setChecking(true);
    try {
      const versions = await fetchAvailableVersions(env.env_type);
      if (versions.length > 0) {
        const stableVersions = versions.filter(
          (v) => !v.deprecated && !v.yanked
        );
        const latestVersion = stableVersions[0]?.version || versions[0].version;
        const latestStable = findLatestStable(stableVersions);

        const newerCount = stableVersions.filter(
          (v) => compareVersions(v.version, env.current_version!) > 0
        ).length;

        setUpdateInfo({
          envType: env.env_type,
          currentVersion: env.current_version,
          latestVersion,
          latestStable,
          availableCount: newerCount,
        });
      }
      setChecked(true);
    } catch {
      setChecked(true);
    } finally {
      setChecking(false);
    }
  }, [env, fetchAvailableVersions]);

  const hasUpdate =
    updateInfo &&
    updateInfo.latestVersion !== updateInfo.currentVersion &&
    updateInfo.availableCount > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {!checked ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={checkForUpdates}
            disabled={checking || !env.current_version}
            className="gap-1.5 h-7 text-xs"
          >
            {checking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowUpCircle className="h-3 w-3" />
            )}
            {t("environments.updates.check")}
          </Button>
        ) : hasUpdate ? (
          <Badge
            variant="outline"
            className="gap-1 text-xs border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/30"
          >
            <ArrowUpCircle className="h-3 w-3" />
            {updateInfo.latestVersion}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 text-xs border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
          >
            <Check className="h-3 w-3" />
            {t("environments.updates.upToDate")}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        hasUpdate &&
          "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/30"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              {t("environments.updates.title")}
            </CardTitle>
            <CardDescription>
              {t("environments.updates.description")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkForUpdates}
            disabled={checking || !env.current_version}
            className="gap-1.5"
          >
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("environments.updates.check")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!checked && !checking && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("environments.updates.clickToCheck")}
          </p>
        )}

        {checking && (
          <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("environments.updates.checking")}
          </div>
        )}

        {checked && !checking && !hasUpdate && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {t("environments.updates.upToDate")}
            </span>
            <span className="text-xs text-green-600 dark:text-green-400 ml-auto font-mono">
              {env.current_version}
            </span>
          </div>
        )}

        {checked && !checking && hasUpdate && updateInfo && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50/50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
              <ArrowUpCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  {t("environments.updates.available", {
                    count: updateInfo.availableCount,
                  })}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {updateInfo.currentVersion}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-xs font-medium">
                    {updateInfo.latestVersion}
                  </span>
                </div>
              </div>
            </div>
            {updateInfo.latestStable &&
              updateInfo.latestStable !== updateInfo.latestVersion && (
                <p className="text-xs text-muted-foreground">
                  {t("environments.updates.latestStable")}:{" "}
                  <span className="font-mono font-medium">
                    {updateInfo.latestStable}
                  </span>
                </p>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function findLatestStable(versions: VersionInfo[]): string | null {
  for (const v of versions) {
    if (!v.deprecated && !v.yanked && isStableVersion(v.version)) {
      return v.version;
    }
  }
  return null;
}

function isStableVersion(version: string): boolean {
  const lower = version.toLowerCase();
  return (
    !lower.includes("alpha") &&
    !lower.includes("beta") &&
    !lower.includes("rc") &&
    !lower.includes("dev") &&
    !lower.includes("preview") &&
    !lower.includes("nightly") &&
    !lower.includes("canary")
  );
}

function compareVersions(a: string, b: string): number {
  const aParts = a.replace(/^v/, "").split(".").map(Number);
  const bParts = b.replace(/^v/, "").split(".").map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (isNaN(aVal) || isNaN(bVal)) return 0;
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  return 0;
}
