"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/components/providers/locale-provider";
import type {
  LogDiagnosticActionResult,
  LogObservabilitySummary,
} from "@/lib/stores/log";
import {
  getLogBridgeStateLabel,
  getLogRuntimeModeLabel,
} from "@/lib/log-workspace";
import type { CrashReportInfo } from "@/types/tauri";
import { formatBytes, formatDate } from "@/lib/utils";
import { AlertTriangle, Bug, Copy, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";

interface LogDiagnosticsCardProps {
  isDesktopRuntime: boolean;
  observability: LogObservabilitySummary;
  crashReports: CrashReportInfo[];
  latestDiagnosticAction: LogDiagnosticActionResult | null;
  onExportDiagnostic: () => void | Promise<void>;
  onRefreshCrashReports: () => void | Promise<void>;
  onCopyPath: (path: string) => void | Promise<void>;
  onRevealPath: (path: string) => void | Promise<void>;
  className?: string;
}

function formatCrashTimestamp(timestamp: string): string {
  const numeric = Number(timestamp);
  if (Number.isFinite(numeric)) {
    const seconds = numeric > 1_000_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
    return formatDate(seconds);
  }

  const parsedMs = Date.parse(timestamp);
  if (Number.isNaN(parsedMs)) {
    return timestamp;
  }
  return formatDate(Math.floor(parsedMs / 1000));
}

function getBridgeGuidance(
  observability: LogObservabilitySummary,
  isDesktopRuntime: boolean,
  t: (key: string) => string,
): string {
  if (!isDesktopRuntime) {
    return t("logs.diagnosticDesktopOnlyDescription");
  }

  if (observability.runtimeMode === "desktop-debug") {
    return t("logs.bridgeGuidanceDebug");
  }

  if (observability.backendBridgeState === "available") {
    return t("logs.bridgeGuidanceRelease");
  }

  return t("logs.bridgeGuidanceUnavailable");
}

export function LogDiagnosticsCard({
  isDesktopRuntime,
  observability,
  crashReports,
  latestDiagnosticAction,
  onExportDiagnostic,
  onRefreshCrashReports,
  onCopyPath,
  onRevealPath,
  className,
}: LogDiagnosticsCardProps) {
  const { t } = useLocale();
  const latestCrashCapture = observability.latestCrashCapture;

  return (
    <Card className={className ?? "h-fit"}>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          {t("logs.diagnostics")}
        </CardTitle>
        <CardDescription>{t("logs.diagnosticsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("logs.runtimeMode")}</p>
            <p className="text-sm font-medium">
              {getLogRuntimeModeLabel(observability.runtimeMode, t)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("logs.backendBridge")}</p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {getLogBridgeStateLabel(observability.backendBridgeState, t)}
              </p>
              {observability.backendBridgeState !== "available" ? (
                <Badge variant="outline">{t("logs.needsAttention")}</Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground/90">{t("logs.bridgeGuidanceTitle")}</p>
          <p className="mt-1">{getBridgeGuidance(observability, isDesktopRuntime, t)}</p>
          {observability.backendBridgeError ? (
            <p className="mt-1 text-destructive">{observability.backendBridgeError}</p>
          ) : null}
        </div>

        {latestCrashCapture ? (
          <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground/90">{t("logs.latestCrashCapture")}</p>
              <Badge variant="outline">
                {latestCrashCapture.status === "captured"
                  ? t("logs.statusSuccess")
                  : latestCrashCapture.status === "capture_failed"
                    ? t("logs.statusFailed")
                    : t("logs.statusSkipped")}
              </Badge>
            </div>
            {latestCrashCapture.crashInfo?.reportPath ? (
              <p className="mt-1 break-all">{latestCrashCapture.crashInfo.reportPath}</p>
            ) : null}
            {latestCrashCapture.reason ? (
              <p className="mt-1">{latestCrashCapture.reason}</p>
            ) : null}
          </div>
        ) : null}

        {latestDiagnosticAction ? (
          <div
            data-testid="logs-diagnostic-result"
            className={`rounded-lg border px-3 py-2 text-xs ${
              latestDiagnosticAction.status === "success"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{t("logs.latestDiagnosticExport")}</p>
              <Badge variant="outline">
                {latestDiagnosticAction.status === "success"
                  ? t("logs.statusSuccess")
                  : t("logs.statusFailed")}
              </Badge>
            </div>
            {latestDiagnosticAction.path ? (
              <p className="mt-1 break-all text-muted-foreground">
                {latestDiagnosticAction.path}
              </p>
            ) : null}
            {latestDiagnosticAction.fileCount != null && latestDiagnosticAction.sizeBytes != null ? (
              <p className="mt-1 text-muted-foreground">
                {t("logs.diagnosticResultMetrics", {
                  files: latestDiagnosticAction.fileCount,
                  size: formatBytes(latestDiagnosticAction.sizeBytes),
                })}
              </p>
            ) : null}
            {latestDiagnosticAction.error ? (
              <p className="mt-1 text-destructive">{latestDiagnosticAction.error}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void onExportDiagnostic();
            }}
            disabled={!isDesktopRuntime}
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            {t("logs.exportFullDiagnostic")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void onRefreshCrashReports();
            }}
            disabled={!isDesktopRuntime}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("logs.refreshCrashReports")}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{t("logs.recentCrashReports")}</p>
            <Badge variant="secondary">{crashReports.length}</Badge>
          </div>

          {!isDesktopRuntime ? (
            <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {t("logs.diagnosticDesktopOnlyDescription")}
            </div>
          ) : crashReports.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {t("logs.noCrashReports")}
            </div>
          ) : (
            <div className="space-y-2">
              {crashReports.slice(0, 5).map((report) => (
                <div
                  key={`${report.id}-${report.reportPath}`}
                  className="rounded-lg border px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{report.source}</p>
                      {report.pending ? (
                        <Badge variant="outline">{t("logs.pendingCrashReport")}</Badge>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(report.size)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCrashTimestamp(report.timestamp)}
                  </p>
                  {report.message ? (
                    <p className="mt-1 text-sm text-muted-foreground">{report.message}</p>
                  ) : null}
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {report.reportPath}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void onCopyPath(report.reportPath);
                      }}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      {t("logs.copyReportPath")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void onRevealPath(report.reportPath);
                      }}
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      {t("logs.openReportFolder")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isDesktopRuntime ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t("logs.webDiagnosticsUnavailable")}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
