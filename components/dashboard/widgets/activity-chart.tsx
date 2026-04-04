"use client";

import { useMemo } from "react";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLocale } from "@/components/providers/locale-provider";
import {
  getChartColor,
  getChartGradientDefinition,
  getChartAxisTickStyle,
  getChartGridStyle,
  getGradientId,
} from "@/lib/theme/chart-utils";
import type { EnvironmentInfo, InstalledPackage } from "@/lib/tauri";
import type { DashboardActivityTimelineModel } from "@/hooks/dashboard/use-dashboard-insights";
import { WidgetEmptyCard } from "@/components/dashboard/widgets/widget-empty-card";
import {
  DashboardLegendList,
  DashboardMetaRow,
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardStatusBadge,
} from "@/components/dashboard/dashboard-primitives";

interface ActivityChartProps {
  environments: EnvironmentInfo[];
  packages: InstalledPackage[];
  model?: DashboardActivityTimelineModel;
  className?: string;
}

interface ActivityChartPoint {
  name: string;
  environments: number;
  packages: number;
  downloads: number;
  toolbox: number;
  total: number;
}

export function ActivityChart({ environments, packages, model, className }: ActivityChartProps) {
  const { t } = useLocale();
  const areaGradient = getChartGradientDefinition("area");

  const chartData = useMemo<ActivityChartPoint[]>(() => {
    if (model) {
      return model.points.map((point) => ({
        name: point.label,
        environments: 0,
        downloads: point.downloads,
        packages: point.packages,
        toolbox: point.toolbox,
        total: point.total,
      }));
    }

    const envsByType = new Map<string, number>();
    environments.forEach((env) => {
      envsByType.set(env.env_type, env.installed_versions.length);
    });

    const providerCounts = new Map<string, number>();
    packages.forEach((pkg) => {
      const count = providerCounts.get(pkg.provider) || 0;
      providerCounts.set(pkg.provider, count + 1);
    });

    const allLabels = new Set<string>();
    envsByType.forEach((_, key) => allLabels.add(key));
    providerCounts.forEach((_, key) => allLabels.add(key));

    const labels = Array.from(allLabels).slice(0, 8);

    return labels.map((label) => ({
      name: label,
      environments: envsByType.get(label) || 0,
      packages: providerCounts.get(label) || 0,
      downloads: 0,
      toolbox: 0,
      total: 0,
    }));
  }, [environments, model, packages]);

  const chartConfig: ChartConfig = model
    ? {
        downloads: {
          label: t("dashboard.widgets.settingsMetric_downloads"),
          color: getChartColor(0),
        },
        packages: {
          label: t("dashboard.widgets.settingsMetric_installations"),
          color: getChartColor(1),
        },
        toolbox: {
          label: t("dashboard.widgets.toolboxFavorites"),
          color: getChartColor(2),
        },
      }
    : {
        environments: {
          label: t("dashboard.widgets.environments"),
          color: getChartColor(0),
        },
        packages: {
          label: t("dashboard.widgets.packages"),
          color: getChartColor(1),
        },
      };

  if (chartData.length === 0) {
    return (
      <WidgetEmptyCard
        title={t("dashboard.widgets.distributionOverview")}
        message={t("dashboard.widgets.noActivity")}
        className={className}
      />
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.distributionOverview")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.distributionOverviewDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {model ? (
          <DashboardMetaRow>
            <DashboardStatusBadge data-testid="activity-chart-shared-scope" tone={model.isUsingSharedRange ? "success" : "muted"}>
              {model.isUsingSharedRange
                ? t("dashboard.widgets.sharedScope")
                : t("dashboard.widgets.localScope")}
            </DashboardStatusBadge>
            <DashboardStatusBadge tone="default">
              {t(`dashboard.widgets.settingsViewMode_${model.viewMode}`)}
            </DashboardStatusBadge>
            {model.missingSources.map((source) => (
              <DashboardStatusBadge key={source} tone="warning">
                {t(`dashboard.widgets.missingSources_${source}`)}
              </DashboardStatusBadge>
            ))}
          </DashboardMetaRow>
        ) : null}

        <DashboardMetricGrid>
          {model ? (
            <>
              <DashboardMetricItem
                label={t("dashboard.widgets.settingsMetric_downloads")}
                value={model.totals.downloads}
              />
              <DashboardMetricItem
                label={t("dashboard.widgets.settingsMetric_installations")}
                value={model.totals.packages}
              />
            </>
          ) : (
            <>
              <DashboardMetricItem
                label={t("dashboard.widgets.environments")}
                value={chartData.reduce((sum, item) => sum + item.environments, 0)}
              />
              <DashboardMetricItem
                label={t("dashboard.widgets.packages")}
                value={chartData.reduce((sum, item) => sum + (item.packages ?? 0), 0)}
              />
            </>
          )}
        </DashboardMetricGrid>
        {model ? (
          <DashboardLegendList
            items={[
              {
                key: "downloads",
                label: t("dashboard.widgets.settingsMetric_downloads"),
                value: model.totals.downloads,
              },
              {
                key: "packages",
                label: t("dashboard.widgets.settingsMetric_installations"),
                value: model.totals.packages,
              },
              {
                key: "toolbox",
                label: t("dashboard.widgets.toolboxFavorites"),
                value: model.totals.toolbox,
              },
            ]}
          />
        ) : null}
        <ChartContainer config={chartConfig} className="h-50 w-full aspect-auto">
          <AreaChart data={chartData} margin={{ left: 0, right: 12 }}>
            {!model ? (
              <defs>
                <linearGradient
                  id={getGradientId("actEnv", 0)}
                  x1={areaGradient.x1}
                  y1={areaGradient.y1}
                  x2={areaGradient.x2}
                  y2={areaGradient.y2}
                >
                  {areaGradient.stops.map((stop, index) => (
                    <stop
                      key={`${stop.offset}-${index}`}
                      offset={stop.offset}
                      stopColor={getChartColor(0)}
                      stopOpacity={stop.opacity}
                    />
                  ))}
                </linearGradient>
                <linearGradient
                  id={getGradientId("actPkg", 0)}
                  x1={areaGradient.x1}
                  y1={areaGradient.y1}
                  x2={areaGradient.x2}
                  y2={areaGradient.y2}
                >
                  {areaGradient.stops.map((stop, index) => (
                    <stop
                      key={`${stop.offset}-${index}`}
                      offset={stop.offset}
                      stopColor={getChartColor(1)}
                      stopOpacity={stop.opacity}
                    />
                  ))}
                </linearGradient>
              </defs>
            ) : null}
            <CartesianGrid vertical={false} {...getChartGridStyle()} />
            <XAxis
              dataKey="name"
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
            {model ? (
              <>
                <Area
                  type="monotone"
                  dataKey="downloads"
                  stroke={getChartColor(0)}
                  strokeWidth={2.5}
                  fillOpacity={model.viewMode === "intensity" ? 0.25 : 0.15}
                  fill={getChartColor(0)}
                />
                <Area
                  type="monotone"
                  dataKey="packages"
                  stroke={getChartColor(1)}
                  strokeWidth={2.5}
                  fillOpacity={model.viewMode === "intensity" ? 0.2 : 0.1}
                  fill={getChartColor(1)}
                />
                <Area
                  type="monotone"
                  dataKey="toolbox"
                  stroke={getChartColor(2)}
                  strokeWidth={2.5}
                  fillOpacity={model.viewMode === "intensity" ? 0.15 : 0.05}
                  fill={getChartColor(2)}
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="environments"
                  stroke={getChartColor(0)}
                  strokeWidth={2.5}
                  fill={`url(#${getGradientId("actEnv", 0)})`}
                />
                <Area
                  type="monotone"
                  dataKey="packages"
                  stroke={getChartColor(1)}
                  strokeWidth={2.5}
                  fill={`url(#${getGradientId("actPkg", 0)})`}
                />
              </>
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
