"use client";

import Link from "next/link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldX, LoaderCircle } from "lucide-react";
import type { AboutSupportAction, AboutSupportState } from "@/types/about";

interface AboutSupportOverviewCardProps {
  supportState: AboutSupportState;
  supportRefreshing: boolean;
  locale: string;
  onRefreshAll: () => void;
  onOpenChangelog: () => void;
  onExportDiagnostics: () => void;
  onReportBug: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function formatTimestamp(
  timestamp: string | null,
  locale: string,
  t: AboutSupportOverviewCardProps["t"],
): string {
  if (!timestamp) {
    return t("common.unknown");
  }

  try {
    return new Date(timestamp).toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return timestamp;
  }
}

function getHealthCopy(
  health: AboutSupportState["health"],
  t: AboutSupportOverviewCardProps["t"],
) {
  switch (health) {
    case "ready":
      return {
        badge: t("about.supportHealthReady"),
        summary: t("about.supportSummaryReady"),
        icon: ShieldCheck,
        variant: "secondary" as const,
      };
    case "attention":
      return {
        badge: t("about.supportHealthAttention"),
        summary: t("about.supportSummaryAttention"),
        icon: ShieldAlert,
        variant: "outline" as const,
      };
    case "degraded":
      return {
        badge: t("about.supportHealthDegraded"),
        summary: t("about.supportSummaryDegraded"),
        icon: ShieldX,
        variant: "destructive" as const,
      };
    case "loading":
    default:
      return {
        badge: t("about.supportHealthLoading"),
        summary: t("about.supportSummaryLoading"),
        icon: LoaderCircle,
        variant: "outline" as const,
      };
  }
}

function getSectionLabel(
  sectionId: string,
  t: AboutSupportOverviewCardProps["t"],
): string {
  switch (sectionId) {
    case "update":
      return t("about.supportSectionUpdate");
    case "system":
      return t("about.supportSectionSystem");
    case "platform":
      return t("about.supportSectionPlatform");
    case "components":
      return t("about.supportSectionComponents");
    case "battery":
      return t("about.supportSectionBattery");
    case "disks":
      return t("about.supportSectionDisks");
    case "networks":
      return t("about.supportSectionNetworks");
    case "cache":
      return t("about.supportSectionCache");
    case "homeDir":
      return t("about.supportSectionHomeDir");
    case "providers":
      return t("about.supportSectionProviders");
    case "logs":
      return t("about.supportSectionLogs");
    default:
      return sectionId;
  }
}

function getActionLabel(
  action: AboutSupportAction,
  t: AboutSupportOverviewCardProps["t"],
): string {
  switch (action.id) {
    case "open_changelog":
      return t("about.supportActionOpenChangelog");
    case "open_providers":
      return t("about.supportActionOpenProviders");
    case "open_logs":
      return t("about.supportActionOpenLogs");
    case "open_cache":
      return t("about.supportActionOpenCache");
    case "export_diagnostics":
      return t("about.supportActionExportDiagnostics");
    case "report_bug":
      return t("about.supportActionReportBug");
    default:
      return action.id;
  }
}

export function AboutSupportOverviewCard({
  supportState,
  supportRefreshing,
  locale,
  onRefreshAll,
  onOpenChangelog,
  onExportDiagnostics,
  onReportBug,
  t,
}: AboutSupportOverviewCardProps) {
  const healthCopy = getHealthCopy(supportState.health, t);
  const HealthIcon = healthCopy.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HealthIcon
            className={`h-5 w-5 ${supportRefreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span id="about-support-overview-heading">
            {t("about.supportOverviewTitle")}
          </span>
        </CardTitle>
        <CardDescription>{t("about.supportOverviewDesc")}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshAll}
            disabled={supportRefreshing}
            aria-label={t("about.supportRefreshAll")}
          >
            <RefreshCw
              className={`h-4 w-4 ${supportRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={healthCopy.variant}>{healthCopy.badge}</Badge>
          <Badge variant="outline">
            {t("about.supportIssueCount", { count: supportState.issueCount })}
          </Badge>
          <Badge variant={supportState.diagnosticsReady ? "secondary" : "outline"}>
            {supportState.diagnosticsReady
              ? t("about.supportDiagnosticsReady")
              : t("about.supportDiagnosticsDegraded")}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">{healthCopy.summary}</p>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              {t("about.supportLatestActivity")}
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatTimestamp(supportState.freshness.latestSuccessfulAt, locale, t)}
            </p>
          </div>
          <div className="space-y-1 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              {t("about.supportUpdateCheckedAt")}
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatTimestamp(supportState.freshness.updateCheckedAt, locale, t)}
            </p>
          </div>
          <div className="space-y-1 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              {t("about.supportSystemRefreshedAt")}
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatTimestamp(supportState.freshness.systemInfoRefreshedAt, locale, t)}
            </p>
          </div>
          <div className="space-y-1 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              {t("about.supportInsightsGeneratedAt")}
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatTimestamp(supportState.freshness.insightsGeneratedAt, locale, t)}
            </p>
          </div>
        </div>

        {supportState.degradedSectionIds.length > 0 ? (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("about.supportDegradedSections")}
              </p>
              <div className="flex flex-wrap gap-2">
                {supportState.degradedSectionIds.map((sectionId) => (
                  <Badge key={sectionId} variant="outline">
                    {getSectionLabel(sectionId, t)}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {supportState.recommendedActions.length > 0 ? (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("about.supportRecommendedActions")}
              </p>
              <div className="flex flex-wrap gap-2">
                {supportState.recommendedActions.map((action) => {
                  const label = getActionLabel(action, t);

                  if (action.kind === "route" && action.href) {
                    return (
                      <Button key={action.id} size="sm" variant="outline" asChild>
                        <Link href={action.href}>{label}</Link>
                      </Button>
                    );
                  }

                  if (action.id === "open_changelog") {
                    return (
                      <Button
                        key={action.id}
                        size="sm"
                        variant="outline"
                        onClick={onOpenChangelog}
                      >
                        {label}
                      </Button>
                    );
                  }

                  if (action.id === "export_diagnostics") {
                    return (
                      <Button
                        key={action.id}
                        size="sm"
                        variant="outline"
                        onClick={onExportDiagnostics}
                      >
                        {label}
                      </Button>
                    );
                  }

                  if (action.id === "report_bug") {
                    return (
                      <Button
                        key={action.id}
                        size="sm"
                        variant="outline"
                        onClick={onReportBug}
                      >
                        {label}
                      </Button>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
