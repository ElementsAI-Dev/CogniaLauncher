"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLocale } from "@/components/providers/locale-provider";
import {
  DashboardEmptyState,
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardStatusBadge,
} from "@/components/dashboard/dashboard-primitives";
import type { DashboardHealthMatrixModel } from "@/hooks/use-dashboard-insights";

interface ProviderHealthMatrixWidgetProps {
  model: DashboardHealthMatrixModel;
  className?: string;
}

const TONE_BY_STATUS = {
  healthy: "success",
  warning: "warning",
  error: "danger",
  unknown: "muted",
} as const;

export function ProviderHealthMatrixWidget({
  model,
  className,
}: ProviderHealthMatrixWidgetProps) {
  const { t } = useLocale();

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.providerHealthMatrix")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.providerHealthMatrixDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {model.cells.length === 0 ? (
          <DashboardEmptyState
            className="py-4"
            icon={<ShieldCheck className="h-8 w-8 text-muted-foreground/70" />}
            message={t("dashboard.widgets.providerHealthMatrixEmpty")}
          />
        ) : (
          <>
            <DashboardMetricGrid columns={4}>
              <DashboardMetricItem label={t("dashboard.widgets.healthHealthy")} value={model.totals.healthy} />
              <DashboardMetricItem label={t("dashboard.widgets.healthWarnings")} value={model.totals.warning} />
              <DashboardMetricItem label={t("dashboard.widgets.healthErrors")} value={model.totals.error} />
              <DashboardMetricItem label={t("dashboard.widgets.healthStatus_unknown")} value={model.totals.unknown} />
            </DashboardMetricGrid>

            <div className="grid gap-2 sm:grid-cols-2">
              {model.cells.map((cell) => (
                <Link
                  key={cell.id}
                  href={cell.href}
                  className="rounded-lg border p-3 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{cell.label}</span>
                    <DashboardStatusBadge tone={TONE_BY_STATUS[cell.status]}>
                      {cell.status}
                    </DashboardStatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {cell.issueCount} issue(s)
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
