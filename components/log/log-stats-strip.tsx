"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/providers/locale-provider";
import type {
  LogsWorkspaceOverviewMetric,
  LogsWorkspaceAttention,
  LogsWorkspaceActionSummary,
  LogsWorkspaceTone,
} from "@/lib/log-workspace";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogStatsStripProps {
  metrics: LogsWorkspaceOverviewMetric[];
  attention: LogsWorkspaceAttention[];
  latestAction: LogsWorkspaceActionSummary | null;
  loading: boolean;
}

const TONE_CLASSES: Record<LogsWorkspaceTone, string> = {
  default: "border-border/70 bg-card",
  success: "border-emerald-500/40 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  danger: "border-destructive/40 bg-destructive/5",
};

export function LogStatsStrip({
  metrics,
  attention,
  latestAction,
  loading,
}: LogStatsStripProps) {
  const { t } = useLocale();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasDetails = attention.length > 0 || latestAction !== null;

  return (
    <div className="space-y-3" data-testid="logs-stats-strip">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border px-3 py-3 space-y-2"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
            ))
          : metrics.map((metric) => (
              <section
                key={metric.id}
                className={cn(
                  "rounded-lg border px-3 py-3",
                  TONE_CLASSES[metric.tone ?? "default"],
                )}
              >
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {metric.value}
                </p>
                {metric.detail ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {metric.detail}
                  </p>
                ) : null}
              </section>
            ))}
      </div>

      {hasDetails && !loading ? (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  detailsOpen && "rotate-180",
                )}
              />
              {detailsOpen ? t("logs.hideDetails") : t("logs.showDetails")}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-1">
            {attention.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {attention.map((item) => (
                  <section
                    key={item.id}
                    className={cn(
                      "rounded-lg border px-3 py-3",
                      TONE_CLASSES[item.tone],
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </section>
                ))}
              </div>
            ) : null}

            {latestAction ? (
              <section
                data-testid="logs-result-summary"
                className={cn(
                  "rounded-lg border px-3 py-3 text-sm",
                  TONE_CLASSES[latestAction.tone],
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">
                    {t("logs.overviewRecentActionTitle")}
                  </p>
                  <Badge variant="outline">{latestAction.statusLabel}</Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground/90">
                  {latestAction.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {latestAction.description}
                </p>
                {latestAction.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {latestAction.detail}
                  </p>
                ) : null}
              </section>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
