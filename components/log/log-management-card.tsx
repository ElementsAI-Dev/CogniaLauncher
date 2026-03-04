"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function normalizeNumberInput(value: string, fallback: string, max?: number): string {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  const normalized = Math.max(0, max ? Math.min(parsed, max) : parsed);
  return String(normalized);
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
  const [logLevel, setLogLevel] = useState<string>("info");

  useEffect(() => {
    if (!isTauri()) return;
    Promise.all([
      configGet("log.max_retention_days"),
      configGet("log.max_total_size_mb"),
      configGet("log.auto_cleanup"),
      configGet("log.log_level"),
    ]).then(([days, size, auto, level]) => {
      if (days) setRetentionDays(days);
      if (size) setMaxTotalSizeMb(size);
      if (auto) setAutoCleanup(auto === "true");
      if (level) setLogLevel(level);
    }).catch(() => { /* use defaults */ });
  }, []);

  // Periodically refresh stats to keep size display up to date
  useEffect(() => {
    const timer = setInterval(onRefresh, 30_000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  const handleSaveRetentionDays = async (value: string) => {
    const normalized = normalizeNumberInput(value, retentionDays, 365);
    setRetentionDays(normalized);
    if (!isTauri()) return;
    try {
      await configSet("log.max_retention_days", normalized);
    } catch {
      /* ignore */
    }
  };

  const handleSaveMaxSize = async (value: string) => {
    const normalized = normalizeNumberInput(value, maxTotalSizeMb, 10000);
    setMaxTotalSizeMb(normalized);
    if (!isTauri()) return;
    try {
      await configSet("log.max_total_size_mb", normalized);
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
              onChange={(e) => setRetentionDays(e.target.value)}
              onBlur={() => { void handleSaveRetentionDays(retentionDays); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
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
              onChange={(e) => setMaxTotalSizeMb(e.target.value)}
              onBlur={() => { void handleSaveMaxSize(maxTotalSizeMb); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
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

          <div className="space-y-1.5">
            <Label htmlFor="log-level" className="text-sm">
              {t("logs.logLevel")}
            </Label>
            <Select
              value={logLevel}
              onValueChange={async (value) => {
                setLogLevel(value);
                if (!isTauri()) return;
                try { await configSet("log.log_level", value); } catch { /* ignore */ }
              }}
            >
              <SelectTrigger id="log-level" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trace">Trace</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("logs.logLevelDescription")}
            </p>
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
