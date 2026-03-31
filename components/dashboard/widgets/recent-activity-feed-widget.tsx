"use client";

import Link from "next/link";
import { Clock3, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocale } from "@/components/providers/locale-provider";
import {
  DashboardEmptyState,
  DashboardStatusBadge,
} from "@/components/dashboard/dashboard-primitives";
import type { DashboardActivityModel } from "@/hooks/dashboard/use-dashboard-insights";

interface RecentActivityFeedWidgetProps {
  model: DashboardActivityModel;
  className?: string;
}

export function RecentActivityFeedWidget({
  model,
  className,
}: RecentActivityFeedWidgetProps) {
  const { t } = useLocale();
  const getSourceLabel = (source: DashboardActivityModel["items"][number]["source"]) => {
    const key = `dashboard.widgets.source_${source}`;
    const translated = t(key);
    return translated === key ? source : translated;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.recentActivityFeed")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.recentActivityFeedDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {model.error && (
          <Alert variant="destructive">
            <AlertTitle>{t("dashboard.widgets.sectionNeedsAttention")}</AlertTitle>
            <AlertDescription>{model.error}</AlertDescription>
          </Alert>
        )}

        {model.items.length === 0 ? (
          <DashboardEmptyState
            className="py-4"
            icon={model.isLoading
              ? <Clock3 className="h-8 w-8 animate-pulse text-muted-foreground/70" />
              : <History className="h-8 w-8 text-muted-foreground/70" />}
            message={t("dashboard.widgets.recentActivityEmpty")}
          />
        ) : (
          <div className="space-y-2">
            {model.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.title}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <DashboardStatusBadge tone="muted">{getSourceLabel(item.source)}</DashboardStatusBadge>
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <time
                  dateTime={item.timestamp}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {new Date(item.timestamp).toLocaleString()}
                </time>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
