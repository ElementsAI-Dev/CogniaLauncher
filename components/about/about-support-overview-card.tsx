"use client";

import Link from "next/link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardStatusBadge,
  DashboardLegendList,
} from "@/components/dashboard/dashboard-primitives";
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldX, LoaderCircle, Clock, BookOpen, MessageSquarePlus } from "lucide-react";
import { openExternal } from "@/lib/tauri";
import { AboutBrandIcon } from "./about-brand-icon";
import { ABOUT_SUPPORT_RESOURCES } from "@/lib/constants/about";
import { useFeedbackStore } from "@/lib/stores/feedback";
import { cn } from "@/lib/utils";
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

type HealthKey = AboutSupportState["health"];
type DashboardTone = "success" | "warning" | "danger" | "muted";

const HEALTH_CONFIG: Record<HealthKey, {
  labelKey: string;
  summaryKey: string;
  icon: typeof ShieldCheck;
  tone: DashboardTone;
  borderClass: string;
}> = {
  ready: {
    labelKey: "about.supportHealthReady",
    summaryKey: "about.supportSummaryReady",
    icon: ShieldCheck,
    tone: "success",
    borderClass: "border-l-4 border-l-green-500",
  },
  attention: {
    labelKey: "about.supportHealthAttention",
    summaryKey: "about.supportSummaryAttention",
    icon: ShieldAlert,
    tone: "warning",
    borderClass: "border-l-4 border-l-amber-500",
  },
  degraded: {
    labelKey: "about.supportHealthDegraded",
    summaryKey: "about.supportSummaryDegraded",
    icon: ShieldX,
    tone: "danger",
    borderClass: "border-l-4 border-l-red-500",
  },
  loading: {
    labelKey: "about.supportHealthLoading",
    summaryKey: "about.supportSummaryLoading",
    icon: LoaderCircle,
    tone: "muted",
    borderClass: "",
  },
};

function getSectionLabel(
  sectionId: string,
  t: AboutSupportOverviewCardProps["t"],
): string {
  const MAP: Record<string, string> = {
    update: "about.supportSectionUpdate",
    system: "about.supportSectionSystem",
    platform: "about.supportSectionPlatform",
    components: "about.supportSectionComponents",
    battery: "about.supportSectionBattery",
    disks: "about.supportSectionDisks",
    networks: "about.supportSectionNetworks",
    cache: "about.supportSectionCache",
    homeDir: "about.supportSectionHomeDir",
    providers: "about.supportSectionProviders",
    logs: "about.supportSectionLogs",
  };
  return MAP[sectionId] ? t(MAP[sectionId]) : sectionId;
}

function getActionLabel(
  action: AboutSupportAction,
  t: AboutSupportOverviewCardProps["t"],
): string {
  const MAP: Record<string, string> = {
    open_changelog: "about.supportActionOpenChangelog",
    open_providers: "about.supportActionOpenProviders",
    open_logs: "about.supportActionOpenLogs",
    open_cache: "about.supportActionOpenCache",
    export_diagnostics: "about.supportActionExportDiagnostics",
    report_bug: "about.supportActionReportBug",
  };
  return MAP[action.id] ? t(MAP[action.id]) : action.id;
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
  const { openDialog } = useFeedbackStore();
  const config = HEALTH_CONFIG[supportState.health];
  const HealthIcon = config.icon;

  // Secondary resources from the constants (GitHub, Documentation, Feature Request)
  const secondaryResources = ABOUT_SUPPORT_RESOURCES.filter(
    (r) => r.id === "github" || r.id === "documentation" || r.id === "feature_request",
  );

  const freshnessItems = [
    {
      label: t("about.supportLatestActivity"),
      value: supportState.freshness.latestSuccessfulAt,
    },
    {
      label: t("about.supportUpdateCheckedAt"),
      value: supportState.freshness.updateCheckedAt,
    },
    {
      label: t("about.supportSystemRefreshedAt"),
      value: supportState.freshness.systemInfoRefreshedAt,
    },
    {
      label: t("about.supportInsightsGeneratedAt"),
      value: supportState.freshness.insightsGeneratedAt,
    },
  ];

  return (
    <Card className={cn(config.borderClass)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HealthIcon
            className={cn("h-5 w-5", supportRefreshing && "animate-spin")}
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
              className={cn("h-4 w-4", supportRefreshing && "animate-spin")}
              aria-hidden="true"
            />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health status badges */}
        <div className="flex flex-wrap items-center gap-2">
          <DashboardStatusBadge tone={config.tone}>
            {t(config.labelKey)}
          </DashboardStatusBadge>
          <DashboardStatusBadge tone={supportState.issueCount > 0 ? "warning" : "muted"}>
            {t("about.supportIssueCount", { count: supportState.issueCount })}
          </DashboardStatusBadge>
          <DashboardStatusBadge tone={supportState.diagnosticsReady ? "success" : "muted"}>
            {supportState.diagnosticsReady
              ? t("about.supportDiagnosticsReady")
              : t("about.supportDiagnosticsDegraded")}
          </DashboardStatusBadge>
        </div>

        <p className="text-sm text-muted-foreground">{t(config.summaryKey)}</p>

        {/* Freshness metrics */}
        <DashboardMetricGrid columns={4}>
          {freshnessItems.map((item) => (
            <DashboardMetricItem
              key={item.label}
              label={item.label}
              icon={<Clock className="h-3 w-3" aria-hidden="true" />}
              value={
                supportRefreshing ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <span className="text-xs">
                    {formatTimestamp(item.value, locale, t)}
                  </span>
                )
              }
              valueClassName="text-sm font-normal"
            />
          ))}
        </DashboardMetricGrid>

        {/* Degraded sections */}
        {supportState.degradedSectionIds.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("about.supportDegradedSections")}
              </p>
              <DashboardLegendList
                items={supportState.degradedSectionIds.map((sectionId) => ({
                  key: sectionId,
                  label: getSectionLabel(sectionId, t),
                  tone: "danger" as const,
                }))}
              />
            </div>
          </>
        )}

        {/* Recommended actions */}
        {supportState.recommendedActions.length > 0 && (
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
                      <Button key={action.id} size="sm" variant="outline" onClick={onOpenChangelog}>
                        {label}
                      </Button>
                    );
                  }

                  if (action.id === "export_diagnostics") {
                    return (
                      <Button key={action.id} size="sm" variant="outline" onClick={onExportDiagnostics}>
                        {label}
                      </Button>
                    );
                  }

                  if (action.id === "report_bug") {
                    return (
                      <Button key={action.id} size="sm" variant="outline" onClick={onReportBug}>
                        {label}
                      </Button>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          </>
        )}

        {/* Secondary resource links (moved from ActionsCard) */}
        {secondaryResources.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {secondaryResources.map((resource) => {
                const label = resource.displayLabel ?? t(resource.labelKey);

                if (resource.id === "feature_request") {
                  return (
                    <Button
                      key={resource.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => openDialog({ category: "feature" })}
                      className="h-8 gap-1.5 text-xs text-muted-foreground"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      {label}
                    </Button>
                  );
                }

                if (resource.url) {
                  return (
                    <Button
                      key={resource.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => void openExternal(resource.url!)}
                      className="h-8 gap-1.5 text-xs text-muted-foreground"
                      aria-label={`${label} - ${t("about.openInNewTab")}`}
                    >
                      {resource.brandIcon ? (
                        <AboutBrandIcon asset={resource.brandIcon} size={14} className="h-3.5 w-3.5" />
                      ) : resource.icon === "book-open" ? (
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : null}
                      {label}
                    </Button>
                  );
                }

                return null;
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
