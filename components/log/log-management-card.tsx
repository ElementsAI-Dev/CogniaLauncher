"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/components/providers/locale-provider";
import { isTauri, configGet, configSet } from "@/lib/tauri";
import { formatBytes } from "@/lib/utils";
import { Loader2, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface LogManagementCardProps {
  totalSize: number;
  fileCount: number;
  onCleanup: () => Promise<{ deletedCount: number; freedBytes: number } | null>;
  onRefresh: () => void;
}

export function LogManagementCard({
  totalSize,
  fileCount,
  onCleanup,
  onRefresh,
}: LogManagementCardProps) {
  const { t } = useLocale();
  const [cleaning, setCleaning] = useState(false);
  const [retentionDays, setRetentionDays] = useState<string>("30");
  const [maxTotalSizeMb, setMaxTotalSizeMb] = useState<string>("100");
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Load settings from backend on first render
  if (!loaded && isTauri()) {
    setLoaded(true);
    Promise.all([
      configGet("log.max_retention_days"),
      configGet("log.max_total_size_mb"),
      configGet("log.auto_cleanup"),
    ]).then(([days, size, auto]) => {
      if (days) setRetentionDays(days);
      if (size) setMaxTotalSizeMb(size);
      if (auto) setAutoCleanup(auto === "true");
    }).catch(() => { /* use defaults */ });
  }

  const handleSaveRetentionDays = async (value: string) => {
    setRetentionDays(value);
    if (!isTauri()) return;
    try {
      await configSet("log.max_retention_days", value);
    } catch {
      /* ignore */
    }
  };

  const handleSaveMaxSize = async (value: string) => {
    setMaxTotalSizeMb(value);
    if (!isTauri()) return;
    try {
      await configSet("log.max_total_size_mb", value);
    } catch {
      /* ignore */
    }
  };

  const handleToggleAutoCleanup = async (checked: boolean) => {
    setAutoCleanup(checked);
    if (!isTauri()) return;
    try {
      await configSet("log.auto_cleanup", String(checked));
    } catch {
      /* ignore */
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const result = await onCleanup();
      if (result && result.deletedCount > 0) {
        toast.success(
          t("logs.cleanupSuccess", {
            count: result.deletedCount,
            size: formatBytes(result.freedBytes),
          }),
        );
        onRefresh();
      } else {
        toast.info(t("logs.cleanupNone"));
      }
    } catch {
      toast.error(t("logs.deleteFailed"));
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          {t("logs.management")}
        </CardTitle>
        <CardDescription>{t("logs.managementDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overview stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t("logs.totalFiles")}</p>
            <p className="text-lg font-semibold tabular-nums">{fileCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t("logs.totalSize")}</p>
            <p className="text-lg font-semibold tabular-nums">{formatBytes(totalSize)}</p>
          </div>
        </div>

        {/* Retention settings */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="retention-days" className="text-sm">
              {t("logs.retentionDays")}
            </Label>
            <Input
              id="retention-days"
              type="number"
              min="0"
              max="365"
              value={retentionDays}
              onChange={(e) => handleSaveRetentionDays(e.target.value)}
              className="h-8"
            />
            <p className="text-xs text-muted-foreground">
              {t("logs.retentionDaysDescription")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max-total-size" className="text-sm">
              {t("logs.maxTotalSize")}
            </Label>
            <Input
              id="max-total-size"
              type="number"
              min="0"
              max="10000"
              value={maxTotalSizeMb}
              onChange={(e) => handleSaveMaxSize(e.target.value)}
              className="h-8"
            />
            <p className="text-xs text-muted-foreground">
              {t("logs.maxTotalSizeDescription")}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">{t("logs.autoCleanup")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("logs.autoCleanupDescription")}
              </p>
            </div>
            <Switch checked={autoCleanup} onCheckedChange={handleToggleAutoCleanup} />
          </div>
        </div>

        {/* Manual cleanup button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleCleanup}
          disabled={cleaning || fileCount <= 1}
        >
          {cleaning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          {t("logs.manualCleanup")}
        </Button>
      </CardContent>
    </Card>
  );
}
