"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLocale } from "@/components/providers/locale-provider";
import { isTauri, configGet, configSet } from "@/lib/tauri";
import type {
  LogActionResult,
  LogCleanupPreviewSummary,
  LogMutationSummary,
} from "@/hooks/use-logs";
import type { LogCleanupOptions, LogCleanupPolicyInput } from "@/types/tauri";
import { formatBytes } from "@/lib/utils";
import { Loader2, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface LogManagementCardProps {
  totalSize: number;
  fileCount: number;
  previewResult: LogCleanupPreviewSummary | null;
  onPreviewCleanup: (
    policy?: LogCleanupPolicyInput,
  ) => Promise<LogActionResult<LogCleanupPreviewSummary>>;
  onCleanup: (
    options: LogCleanupOptions,
  ) => Promise<LogActionResult<LogMutationSummary>>;
  onRefresh: () => void;
}

type PolicySaveState = "dirty" | "saving" | "saved" | "error";

function normalizeNumberInput(value: string, fallback: string, max?: number): string {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  const normalized = Math.max(0, max ? Math.min(parsed, max) : parsed);
  return String(normalized);
}

function toPolicyNumber(value: string, fallback: string, max: number): number {
  const normalized = normalizeNumberInput(value, fallback, max);
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function LogManagementCard({
  totalSize,
  fileCount,
  previewResult,
  onPreviewCleanup,
  onCleanup,
  onRefresh,
}: LogManagementCardProps) {
  const { t } = useLocale();
  const [cleaning, setCleaning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [retentionDays, setRetentionDays] = useState<string>("30");
  const [maxTotalSizeMb, setMaxTotalSizeMb] = useState<string>("100");
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [logLevel, setLogLevel] = useState<string>("info");
  const [policySaveState, setPolicySaveState] = useState<PolicySaveState>("saved");
  const [policySaveError, setPolicySaveError] = useState<string | null>(null);
  const [lastFailedWrite, setLastFailedWrite] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    Promise.all([
      configGet("log.max_retention_days"),
      configGet("log.max_total_size_mb"),
      configGet("log.auto_cleanup"),
      configGet("log.log_level"),
    ])
      .then(([days, size, auto, level]) => {
        if (!active) return;
        if (days) setRetentionDays(days);
        if (size) setMaxTotalSizeMb(size);
        if (auto) setAutoCleanup(auto === "true");
        if (level) setLogLevel(level);
        setPolicySaveState("saved");
        setPolicySaveError(null);
        setLastFailedWrite(null);
      })
      .catch(() => {
        if (!active) return;
        setPolicySaveState("saved");
      });
    return () => {
      active = false;
    };
  }, []);

  // Periodically refresh stats to keep size display up to date.
  useEffect(() => {
    const timer = setInterval(onRefresh, 30_000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  const effectivePolicy = useMemo<LogCleanupPolicyInput>(
    () => ({
      maxRetentionDays: toPolicyNumber(retentionDays, "30", 365),
      maxTotalSizeMb: toPolicyNumber(maxTotalSizeMb, "100", 10_000),
    }),
    [maxTotalSizeMb, retentionDays],
  );

  const isPreviewStale = useMemo(() => {
    if (!previewResult) {
      return false;
    }
    return (
      previewResult.maxRetentionDays !== effectivePolicy.maxRetentionDays ||
      previewResult.maxTotalSizeMb !== effectivePolicy.maxTotalSizeMb
    );
  }, [effectivePolicy.maxRetentionDays, effectivePolicy.maxTotalSizeMb, previewResult]);

  const markPolicyDirty = useCallback(() => {
    setPolicySaveError(null);
    setPolicySaveState((prev) => (prev === "saving" ? prev : "dirty"));
  }, []);

  const persistSetting = useCallback(
    async (key: string, value: string): Promise<boolean> => {
      if (!isTauri()) {
        setPolicySaveState("saved");
        return true;
      }
      setPolicySaveState("saving");
      setPolicySaveError(null);
      try {
        await configSet(key, value);
        setPolicySaveState("saved");
        setLastFailedWrite(null);
        return true;
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : t("logs.policySaveFailed");
        setPolicySaveState("error");
        setPolicySaveError(message);
        setLastFailedWrite({ key, value });
        return false;
      }
    },
    [t],
  );

  const handleSaveRetentionDays = useCallback(
    async (value: string) => {
      const normalized = normalizeNumberInput(value, retentionDays, 365);
      setRetentionDays(normalized);
      await persistSetting("log.max_retention_days", normalized);
    },
    [persistSetting, retentionDays],
  );

  const handleSaveMaxSize = useCallback(
    async (value: string) => {
      const normalized = normalizeNumberInput(value, maxTotalSizeMb, 10_000);
      setMaxTotalSizeMb(normalized);
      await persistSetting("log.max_total_size_mb", normalized);
    },
    [maxTotalSizeMb, persistSetting],
  );

  const handleToggleAutoCleanup = useCallback(
    async (checked: boolean) => {
      setAutoCleanup(checked);
      markPolicyDirty();
      await persistSetting("log.auto_cleanup", String(checked));
    },
    [markPolicyDirty, persistSetting],
  );

  const handleRetrySave = useCallback(async () => {
    if (lastFailedWrite) {
      await persistSetting(lastFailedWrite.key, lastFailedWrite.value);
      return;
    }
    await Promise.all([
      persistSetting("log.max_retention_days", String(effectivePolicy.maxRetentionDays ?? 0)),
      persistSetting("log.max_total_size_mb", String(effectivePolicy.maxTotalSizeMb ?? 0)),
      persistSetting("log.auto_cleanup", String(autoCleanup)),
      persistSetting("log.log_level", logLevel),
    ]);
  }, [
    autoCleanup,
    effectivePolicy.maxRetentionDays,
    effectivePolicy.maxTotalSizeMb,
    lastFailedWrite,
    logLevel,
    persistSetting,
  ]);

  const handleCleanup = useCallback(async () => {
    if (!previewResult) return;
    if (isPreviewStale) {
      toast.error(t("logs.previewStale"));
      return;
    }

    setCleaning(true);
    try {
      const result = await onCleanup({
        policy: effectivePolicy,
        expectedPolicyFingerprint: previewResult.policyFingerprint,
      });
      if (!result.ok) {
        toast.error(result.error || t("logs.deleteFailed"));
        return;
      }

      if (result.data.status === "failed") {
        toast.error(result.data.warnings[0] || t("logs.deleteFailed"));
        return;
      }

      if (result.data.deletedCount > 0) {
        toast.success(
          t("logs.cleanupSuccess", {
            count: result.data.deletedCount,
            size: formatBytes(result.data.freedBytes),
          }),
        );
      } else {
        toast.info(t("logs.cleanupNone"));
      }
      if (result.data.warnings.length > 0) {
        toast.info(t("logs.partialWarning", { count: result.data.warnings.length }));
      }
      setCleanupConfirmOpen(false);
    } catch {
      toast.error(t("logs.deleteFailed"));
    } finally {
      setCleaning(false);
    }
  }, [effectivePolicy, isPreviewStale, onCleanup, previewResult, t]);

  const handlePreviewCleanup = useCallback(async () => {
    setPreviewing(true);
    try {
      const result = await onPreviewCleanup(effectivePolicy);
      if (!result.ok) {
        toast.error(result.error || t("logs.deleteFailed"));
        return;
      }
      toast.info(
        t("logs.previewReady", {
          count: result.data.deletedCount,
          size: formatBytes(result.data.freedBytes),
        }),
      );
    } catch {
      toast.error(t("logs.deleteFailed"));
    } finally {
      setPreviewing(false);
    }
  }, [effectivePolicy, onPreviewCleanup, t]);

  const policyStateLabel =
    policySaveState === "dirty"
      ? t("logs.policyStateDirty")
      : policySaveState === "saving"
        ? t("logs.policyStateSaving")
        : policySaveState === "error"
          ? t("logs.policyStateError")
          : t("logs.policyStateSaved");

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
        <section className="grid grid-cols-2 gap-3" aria-label="Log storage status">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t("logs.totalFiles")}</p>
            <p className="text-lg font-semibold tabular-nums">{fileCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t("logs.totalSize")}</p>
            <p className="text-lg font-semibold tabular-nums">{formatBytes(totalSize)}</p>
          </div>
        </section>

        <Separator />

        <section className="space-y-3" aria-label="Log cleanup configuration">
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
              onChange={(e) => {
                setRetentionDays(e.target.value);
                markPolicyDirty();
              }}
              onBlur={() => {
                void handleSaveRetentionDays(retentionDays);
              }}
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
              onChange={(e) => {
                setMaxTotalSizeMb(e.target.value);
                markPolicyDirty();
              }}
              onBlur={() => {
                void handleSaveMaxSize(maxTotalSizeMb);
              }}
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
                markPolicyDirty();
                await persistSetting("log.log_level", value);
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
        </section>

        <section className="rounded-lg border p-3 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {t("logs.policySaveStateLabel")}
            </p>
            <p
              data-testid="log-policy-save-state"
              className={`text-xs font-medium ${
                policySaveState === "error"
                  ? "text-destructive"
                  : policySaveState === "saved"
                    ? "text-emerald-600"
                    : "text-muted-foreground"
              }`}
            >
              {policyStateLabel}
            </p>
          </div>
          {policySaveState === "error" && (
            <div className="space-y-2">
              <p className="text-xs text-destructive">
                {policySaveError || t("logs.policySaveFailed")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  void handleRetrySave();
                }}
              >
                {t("logs.retrySavePolicy")}
              </Button>
            </div>
          )}
        </section>

        {previewResult && (
          <section className="rounded-lg border border-dashed p-3 space-y-1" aria-label="Cleanup preview">
            <p className="text-xs text-muted-foreground">{t("logs.previewSummary")}</p>
            <p className="text-sm">
              {t("logs.previewReady", {
                count: previewResult.deletedCount,
                size: formatBytes(previewResult.freedBytes),
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("logs.previewProtected", { count: previewResult.protectedCount })}
            </p>
            {isPreviewStale && (
              <p className="text-xs text-amber-700" data-testid="log-preview-stale-hint">
                {t("logs.previewStale")}
              </p>
            )}
          </section>
        )}

        <section className="space-y-2" role="group" aria-label="Log cleanup actions">
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePreviewCleanup}
            disabled={previewing || cleaning || fileCount <= 1}
          >
            {previewing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {t("logs.previewCleanup")}
          </Button>

          <AlertDialog open={cleanupConfirmOpen} onOpenChange={setCleanupConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                disabled={cleaning || fileCount <= 1 || !previewResult || isPreviewStale}
              >
                {cleaning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t("logs.manualCleanupConfirm")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("logs.cleanupConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("logs.cleanupConfirmDescription", {
                    count: previewResult?.deletedCount ?? 0,
                    size: formatBytes(previewResult?.freedBytes ?? 0),
                  })}
                </AlertDialogDescription>
                {previewResult && previewResult.protectedCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("logs.previewProtected", {
                      count: previewResult.protectedCount,
                    })}
                  </p>
                )}
                {isPreviewStale && (
                  <p className="text-xs text-destructive">{t("logs.previewStale")}</p>
                )}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void handleCleanup();
                  }}
                  disabled={cleaning || isPreviewStale || !previewResult}
                >
                  {cleaning ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("logs.cleanupConfirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </CardContent>
    </Card>
  );
}
