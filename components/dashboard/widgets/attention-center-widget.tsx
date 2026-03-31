"use client";

import Link from "next/link";
import { AlertTriangle, BellRing, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocale } from "@/components/providers/locale-provider";
import {
  DashboardClickableRow,
  DashboardEmptyState,
  DashboardStatusBadge,
} from "@/components/dashboard/dashboard-primitives";
import type { DashboardAttentionModel } from "@/hooks/dashboard/use-dashboard-insights";

interface AttentionCenterWidgetProps {
  model: DashboardAttentionModel;
  className?: string;
}

const TONE_BY_SEVERITY = {
  danger: "danger",
  warning: "warning",
  info: "default",
} as const;

export function AttentionCenterWidget({
  model,
  className,
}: AttentionCenterWidgetProps) {
  const { t } = useLocale();
  const getSourceLabel = (source: DashboardAttentionModel["items"][number]["source"]) => {
    const key = `dashboard.widgets.source_${source}`;
    const translated = t(key);
    return translated === key ? source : translated;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.attentionCenter")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.attentionCenterDesc")}
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
              ? <ShieldAlert className="h-8 w-8 animate-pulse text-muted-foreground/70" />
              : <BellRing className="h-8 w-8 text-muted-foreground/70" />}
            message={t("dashboard.widgets.attentionCenterClear")}
          />
        ) : (
          <div className="space-y-2">
            {model.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.title}
                className="block"
              >
                <DashboardClickableRow>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <DashboardStatusBadge tone={TONE_BY_SEVERITY[item.severity]}>
                        {getSourceLabel(item.source)}
                      </DashboardStatusBadge>
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
                </DashboardClickableRow>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
