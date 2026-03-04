"use client";

import { useCallback } from "react";
import { writeClipboard } from '@/lib/clipboard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Terminal,
  MapPin,
  ClipboardCopy,
} from "lucide-react";
import type { PackageManagerHealthResult, HealthStatus } from "@/types/tauri";
import { cn } from "@/lib/utils";
import { getStatusIcon, getStatusColor, getStatusTextColor } from "@/lib/provider-utils";
import { IssueCard } from "@/components/environments/health-check-panel";
import { toast } from "sonner";

interface ProviderHealthTabProps {
  healthResult: PackageManagerHealthResult | null;
  loadingHealth: boolean;
  onRunHealthCheck: () => Promise<unknown>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function renderStatusIcon(status: HealthStatus) {
  const Icon = getStatusIcon(status);
  return <Icon className={cn("h-5 w-5", getStatusTextColor(status))} />;
}

export function ProviderHealthTab({
  healthResult,
  loadingHealth,
  onRunHealthCheck,
  t,
}: ProviderHealthTabProps) {
  const copyDiagnostics = useCallback(() => {
    if (!healthResult) return;
    const lines = [
      `Provider: ${healthResult.display_name}`,
      `Status: ${healthResult.status}`,
      `Version: ${healthResult.version || "N/A"}`,
      `Path: ${healthResult.executable_path || "N/A"}`,
      `Checked: ${new Date(healthResult.checked_at).toLocaleString()}`,
      "",
      `Issues (${healthResult.issues.length}):`,
      ...healthResult.issues.map(
        (i, idx) =>
          `  ${idx + 1}. [${i.severity}] ${i.message}${i.fix_command ? ` (fix: ${i.fix_command})` : ""}`,
      ),
    ];
    writeClipboard(lines.join("\n"));
    toast.success(t("providerDetail.diagnosticsCopied"));
  }, [healthResult, t]);

  const copyAllFixCommands = useCallback(() => {
    if (!healthResult) return;
    const commands = healthResult.issues
      .filter((i) => i.fix_command)
      .map((i) => i.fix_command!);
    if (commands.length === 0) return;
    writeClipboard(commands.join("\n"));
    toast.success(t("providerDetail.fixCommandsCopied", { count: commands.length }));
  }, [healthResult, t]);

  const fixableCount = healthResult?.issues.filter((i) => i.fix_command).length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          {t("providerDetail.healthCheck")}
        </CardTitle>
        <CardDescription>
          {t("providerDetail.healthCheckDesc")}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            {healthResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyDiagnostics}
              >
                <ClipboardCopy className="h-4 w-4 mr-2" />
                {t("providerDetail.copyDiagnostics")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRunHealthCheck()}
              disabled={loadingHealth}
            >
              {loadingHealth ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t("providerDetail.runCheck")}
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loadingHealth && !healthResult ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !healthResult ? (
          <Empty className="border-none py-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldCheck />
              </EmptyMedia>
              <EmptyTitle>{t("providerDetail.noHealthData")}</EmptyTitle>
              <EmptyDescription>{t("providerDetail.noHealthDataDesc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-4">
            {/* Overall Status */}
            <div
              className={cn(
                "p-4 rounded-lg border",
                getStatusColor(healthResult.status),
              )}
            >
              <div className="flex items-center gap-3">
                {renderStatusIcon(healthResult.status)}
                <div>
                  <span className="font-medium text-lg">
                    {healthResult.display_name}
                  </span>
                  <Badge
                    variant={
                      healthResult.status === "healthy"
                        ? "default"
                        : healthResult.status === "warning"
                          ? "secondary"
                          : "destructive"
                    }
                    className="ml-2"
                  >
                    {t(`providerDetail.healthStatus.${healthResult.status}`)}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("providerDetail.checkedAt", {
                  time: new Date(healthResult.checked_at).toLocaleString(),
                })}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {healthResult.version && (
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Terminal className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("providerDetail.detectedVersion")}
                    </p>
                    <p className="text-sm font-mono font-medium">
                      {healthResult.version}
                    </p>
                  </div>
                </div>
              )}
              {healthResult.executable_path && (
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {t("providerDetail.executablePath")}
                    </p>
                    <p
                      className="text-sm font-mono truncate"
                      title={healthResult.executable_path}
                    >
                      {healthResult.executable_path}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Issues */}
            {healthResult.issues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {t("providerDetail.issues")} ({healthResult.issues.length})
                  </h4>
                  {fixableCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyAllFixCommands}
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      {t("providerDetail.copyFixCommands", { count: fixableCount })}
                    </Button>
                  )}
                </div>
                {healthResult.issues.map((issue, idx) => (
                  <IssueCard key={idx} issue={issue} t={t} />
                ))}
              </div>
            )}

            {healthResult.issues.length === 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {t("providerDetail.noIssues")}
              </p>
            )}

            {/* Install Instructions */}
            {healthResult.install_instructions && (
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">
                  {t("providerDetail.installInstructions")}
                </p>
                <code className="text-sm font-mono whitespace-pre-wrap">
                  {healthResult.install_instructions}
                </code>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
