"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Download,
} from "lucide-react";
import type { EnvUpdateCheckResult } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface EnvUpdatesSummaryProps {
  results: Record<string, EnvUpdateCheckResult>;
  loading: boolean;
  onCheckAll: () => Promise<unknown>;
  onUpgrade: (envType: string, version: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvUpdatesSummary({
  results,
  loading,
  onCheckAll,
  onUpgrade,
  t,
}: EnvUpdatesSummaryProps) {
  const [checking, setChecking] = useState(false);

  const outdated = Object.values(results).filter((r) => r.isOutdated);
  const hasResults = Object.keys(results).length > 0;

  const handleCheckAll = useCallback(async () => {
    setChecking(true);
    try {
      await onCheckAll();
    } finally {
      setChecking(false);
    }
  }, [onCheckAll]);

  const isLoading = loading || checking;

  if (!hasResults && !isLoading) return null;

  if (hasResults && outdated.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20">
        <CardContent className="flex items-center gap-3 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300 flex-1">
            {t("environments.updates.allUpToDate")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckAll}
            disabled={isLoading}
            className="gap-1.5 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("environments.updates.recheck")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (outdated.length === 0 && isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t("environments.updates.checkingAll")}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/30 dark:bg-yellow-950/20">
      <CardContent className="py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              {t("environments.updates.outdatedCount", { count: outdated.length })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckAll}
            disabled={isLoading}
            className="gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("environments.updates.recheck")}
          </Button>
        </div>

        <div className="space-y-1.5">
          {outdated.map((r) => (
            <div
              key={r.envType}
              className="flex items-center justify-between p-2 rounded-md border bg-background/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-sm">{r.envType}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {r.currentVersion}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="default" className="font-mono text-[10px]">
                    {r.latestVersion}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-1.5 h-7 text-xs shrink-0")}
                onClick={() => r.latestVersion && onUpgrade(r.envType, r.latestVersion)}
              >
                <Download className="h-3 w-3" />
                {t("environments.updates.upgradeToVersion")}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
