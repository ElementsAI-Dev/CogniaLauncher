"use client";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { RefreshCw, CircleGauge } from "lucide-react";
import type { AboutInsightGroupState, AboutInsights } from "@/types/about";

interface AboutInsightsCardProps {
  insights: AboutInsights | null;
  insightsLoading: boolean;
  locale?: string;
  lastGeneratedAt?: string | null;
  onRetry: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function formatTimestamp(
  timestamp: string | null | undefined,
  locale: string,
  t: AboutInsightsCardProps["t"],
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

function statusLabel(
  state: AboutInsightGroupState,
  t: AboutInsightsCardProps["t"],
): string {
  switch (state) {
    case "loading":
      return t("about.insightsStatusLoading");
    case "ok":
      return t("about.insightsStatusOk");
    case "failed":
      return t("about.insightsStatusFailed");
    case "unavailable":
      return t("about.insightsStatusUnavailable");
    default:
      return t("common.unknown");
  }
}

function statusVariant(state: AboutInsightGroupState): "default" | "secondary" | "destructive" | "outline" {
  if (state === "ok") return "secondary";
  if (state === "failed") return "destructive";
  if (state === "loading") return "outline";
  return "outline";
}

function ValueRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-[24px]">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="text-[13px] font-medium text-foreground">{value}</span>
      )}
    </div>
  );
}

export function AboutInsightsCard({
  insights,
  insightsLoading,
  locale = "en-US",
  lastGeneratedAt = null,
  onRetry,
  t,
}: AboutInsightsCardProps) {
  const runtimeMode =
    insights?.runtimeMode === "desktop"
      ? t("about.insightsRuntimeDesktop")
      : t("about.insightsRuntimeWeb");

  const providerSummaryValue =
    insights?.sections.providers === "ok"
      ? `${insights.providerSummary.installed}/${insights.providerSummary.total}`
      : statusLabel(insights?.sections.providers ?? "unavailable", t);

  const logSummaryValue =
    insights?.sections.logs === "ok"
      ? (insights.storageSummary.logTotalSizeHuman ?? t("common.unknown"))
      : statusLabel(insights?.sections.logs ?? "unavailable", t);

  const cacheSummaryValue =
    insights?.sections.cache === "ok"
      ? insights.storageSummary.cacheTotalSizeHuman
      : statusLabel(insights?.sections.cache ?? "unavailable", t);

  return (
    <Card role="region" aria-labelledby="about-insights-heading">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CircleGauge className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="about-insights-heading">{t("about.insightsTitle")}</span>
        </CardTitle>
        <CardDescription>{t("about.insightsDesc")}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={insightsLoading}
            aria-label={t("about.insightsRetry")}
          >
            <RefreshCw className={`h-4 w-4 ${insightsLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {lastGeneratedAt ? (
          <p className="text-xs text-muted-foreground">
            {t("about.lastGeneratedAt")}: {formatTimestamp(lastGeneratedAt, locale, t)}
          </p>
        ) : null}
        {!insightsLoading && !insights ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleGauge className="h-5 w-5" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("about.insightsTitle")}</EmptyTitle>
              <EmptyDescription>{t("about.insightsStatusUnavailable")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                {t("about.insightsRetry")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
        <ValueRow
          label={t("about.insightsRuntimeMode")}
          value={runtimeMode}
          loading={insightsLoading}
        />
        <ValueRow
          label={t("about.insightsProviderSummary")}
          value={providerSummaryValue}
          loading={insightsLoading}
        />
        <ValueRow
          label={t("about.insightsLogsSize")}
          value={logSummaryValue}
          loading={insightsLoading}
        />
        <ValueRow
          label={t("about.insightsCacheSize")}
          value={cacheSummaryValue}
          loading={insightsLoading}
        />

        {!insightsLoading && insights && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t("about.insightsGroupProviders")}</Badge>
              <Badge variant={statusVariant(insights.sections.providers)}>
                {statusLabel(insights.sections.providers, t)}
              </Badge>
              <Badge variant="outline">{t("about.insightsGroupLogs")}</Badge>
              <Badge variant={statusVariant(insights.sections.logs)}>
                {statusLabel(insights.sections.logs, t)}
              </Badge>
              <Badge variant="outline">{t("about.insightsGroupCache")}</Badge>
              <Badge variant={statusVariant(insights.sections.cache)}>
                {statusLabel(insights.sections.cache, t)}
              </Badge>
            </div>
          </>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
