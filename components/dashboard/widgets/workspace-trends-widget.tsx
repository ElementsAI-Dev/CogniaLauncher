"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLocale } from "@/components/providers/locale-provider";
import {
  DashboardEmptyState,
  DashboardLegendList,
  DashboardMetaRow,
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardStatusBadge,
} from "@/components/dashboard/dashboard-primitives";
import type { DashboardTrendModel } from "@/hooks/dashboard/use-dashboard-insights";
import {
  getChartAxisTickStyle,
  getChartColor,
  getChartGradientDefinition,
  getChartGridStyle,
  getGradientId,
} from "@/lib/theme/chart-utils";

interface WorkspaceTrendsWidgetProps {
  model: DashboardTrendModel;
  className?: string;
}

export function WorkspaceTrendsWidget({
  model,
  className,
}: WorkspaceTrendsWidgetProps) {
  const { t } = useLocale();
  const gradient = getChartGradientDefinition("area");
  const totalValue = model.points.reduce((sum, point) => sum + point.value, 0);
  const comparisonTotals = {
    installations: model.points.reduce((sum, point) => sum + (point.installations ?? 0), 0),
    downloads: model.points.reduce((sum, point) => sum + (point.downloads ?? 0), 0),
    updates: model.points.reduce((sum, point) => sum + (point.updates ?? 0), 0),
  };

  const chartConfig: ChartConfig = model.viewMode === "comparison"
    ? {
        installations: {
          label: t("dashboard.widgets.settingsMetric_installations"),
          color: getChartColor(0),
        },
        downloads: {
          label: t("dashboard.widgets.settingsMetric_downloads"),
          color: getChartColor(1),
        },
        updates: {
          label: t("dashboard.widgets.settingsMetric_updates"),
          color: getChartColor(2),
        },
      }
    : {
        value: {
          label: t(`dashboard.widgets.settingsMetric_${model.metric}`),
          color: getChartColor(0),
        },
      };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.workspaceTrends")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.workspaceTrendsDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DashboardMetaRow>
          <DashboardStatusBadge data-testid="workspace-trends-shared-scope" tone={model.isUsingSharedRange ? "success" : "muted"}>
            {model.isUsingSharedRange
              ? t("dashboard.widgets.sharedScope")
              : t("dashboard.widgets.localScope")}
          </DashboardStatusBadge>
          <DashboardStatusBadge tone="default">
            {t(`dashboard.widgets.settingsViewMode_${model.viewMode}`)}
          </DashboardStatusBadge>
          {model.lastUpdatedAt ? (
            <DashboardStatusBadge tone="muted">
              {t("dashboard.widgets.lastUpdated")}
            </DashboardStatusBadge>
          ) : null}
          {model.missingSources.map((source) => (
            <DashboardStatusBadge key={source} tone="warning">
              {t(`dashboard.widgets.missingSources_${source}`)}
            </DashboardStatusBadge>
          ))}
        </DashboardMetaRow>

        {model.points.length === 0 ? (
          <DashboardEmptyState
            className="py-4"
            icon={<TrendingUp className="h-8 w-8 text-muted-foreground/70" />}
            message={t("dashboard.widgets.workspaceTrendsEmpty")}
          />
        ) : (
          <>
            <DashboardMetricGrid columns={model.viewMode === "comparison" ? 4 : 2}>
              {model.viewMode === "comparison" ? (
                <>
                  <DashboardMetricItem
                    label={t("dashboard.widgets.settingsMetric_installations")}
                    value={comparisonTotals.installations}
                  />
                  <DashboardMetricItem
                    label={t("dashboard.widgets.settingsMetric_downloads")}
                    value={comparisonTotals.downloads}
                  />
                  <DashboardMetricItem
                    label={t("dashboard.widgets.settingsMetric_updates")}
                    value={comparisonTotals.updates}
                  />
                </>
              ) : (
                <DashboardMetricItem
                  label={t(`dashboard.widgets.settingsMetric_${model.metric}`)}
                  value={totalValue}
                />
              )}
              <DashboardMetricItem
                label={t("dashboard.widgets.rangeLabel")}
                value={model.range}
              />
            </DashboardMetricGrid>

            {model.viewMode === "comparison" ? (
              <DashboardLegendList
                items={[
                  {
                    key: "installations",
                    label: t("dashboard.widgets.settingsMetric_installations"),
                    value: comparisonTotals.installations,
                  },
                  {
                    key: "downloads",
                    label: t("dashboard.widgets.settingsMetric_downloads"),
                    value: comparisonTotals.downloads,
                  },
                  {
                    key: "updates",
                    label: t("dashboard.widgets.settingsMetric_updates"),
                    value: comparisonTotals.updates,
                  },
                ]}
              />
            ) : null}

            <ChartContainer config={chartConfig} className="h-48 w-full">
              <AreaChart data={model.points} margin={{ left: 0, right: 12 }}>
                <defs>
                  <linearGradient
                    id={getGradientId("workspace-trends", 0)}
                    x1={gradient.x1}
                    y1={gradient.y1}
                    x2={gradient.x2}
                    y2={gradient.y2}
                  >
                    {gradient.stops.map((stop, index) => (
                      <stop
                        key={`${stop.offset}-${index}`}
                        offset={stop.offset}
                        stopColor={getChartColor(0)}
                        stopOpacity={stop.opacity}
                      />
                    ))}
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} {...getChartGridStyle()} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={getChartAxisTickStyle(10)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  tick={getChartAxisTickStyle(11)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {model.viewMode === "comparison" ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey="installations"
                      stroke={getChartColor(0)}
                      strokeWidth={2.5}
                      fill={`url(#${getGradientId("workspace-trends", 0)})`}
                    />
                    <Area
                      type="monotone"
                      dataKey="downloads"
                      stroke={getChartColor(1)}
                      strokeWidth={2.5}
                      fillOpacity={0}
                      fill={getChartColor(1)}
                    />
                    <Area
                      type="monotone"
                      dataKey="updates"
                      stroke={getChartColor(2)}
                      strokeWidth={2.5}
                      fillOpacity={0}
                      fill={getChartColor(2)}
                    />
                  </>
                ) : (
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={getChartColor(0)}
                    strokeWidth={2.5}
                    fill={`url(#${getGradientId("workspace-trends", 0)})`}
                  />
                )}
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
