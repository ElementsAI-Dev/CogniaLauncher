"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLocale } from "@/components/providers/locale-provider";
import {
  getChartColor,
  getChartGradientDefinition,
  getChartAxisTickStyle,
  getChartGridStyle,
  getChartSegmentStrokeStyle,
  getChartTooltipCursorStyle,
  getGradientId,
} from "@/lib/theme/chart-utils";
import type { EnvironmentInfo } from "@/lib/tauri";
import { WidgetEmptyCard } from "@/components/dashboard/widgets/widget-empty-card";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardSectionLabel,
} from "@/components/dashboard/dashboard-primitives";

interface EnvironmentChartProps {
  environments: EnvironmentInfo[];
  className?: string;
}

export function EnvironmentChart({ environments, className }: EnvironmentChartProps) {
  const { t } = useLocale();
  const pieGradient = getChartGradientDefinition("pie");
  const barGradient = getChartGradientDefinition("bar-horizontal");

  const { pieData, barData, chartConfig } = useMemo(() => {
    const availableCount = environments.filter((e) => e.available).length;
    const unavailableCount = environments.length - availableCount;

    const pie = [
      { name: t("dashboard.widgets.available"), value: availableCount, fill: getChartColor(0) },
      { name: t("dashboard.widgets.unavailable"), value: unavailableCount, fill: getChartColor(1) },
    ].filter((d) => d.value > 0);

    const bar = environments
      .map((env, i) => ({
        name: env.env_type,
        versions: env.installed_versions.length,
        fill: getChartColor(i),
      }))
      .filter((d) => d.versions > 0)
      .sort((a, b) => b.versions - a.versions)
      .slice(0, 8);

    const cfg: ChartConfig = {
      available: { label: t("dashboard.widgets.available"), color: getChartColor(0) },
      unavailable: { label: t("dashboard.widgets.unavailable"), color: getChartColor(1) },
      versions: { label: t("dashboard.widgets.installedVersions"), color: getChartColor(0) },
    };

    return { pieData: pie, barData: bar, chartConfig: cfg };
  }, [environments, t]);

  if (environments.length === 0) {
    return (
      <WidgetEmptyCard
        title={t("dashboard.widgets.environmentChart")}
        message={t("dashboard.noEnvironments")}
        className={className}
      />
    );
  }

  const availableCount = environments.filter((env) => env.available).length;
  const unavailableCount = environments.length - availableCount;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.environmentChart")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.environmentChartDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DashboardMetricGrid>
          <DashboardMetricItem
            label={t("dashboard.widgets.available")}
            value={availableCount}
          />
          <DashboardMetricItem
            label={t("dashboard.widgets.unavailable")}
            value={unavailableCount}
          />
        </DashboardMetricGrid>

        {/* Status Pie Chart */}
        <div>
          <DashboardSectionLabel>
            {t("dashboard.widgets.statusDistribution")}
          </DashboardSectionLabel>
          <ChartContainer config={chartConfig} className="h-[160px] w-full aspect-auto">
            <PieChart>
              <defs>
                {pieData.map((_, index) => (
                  <linearGradient
                    key={getGradientId("envPie", index)}
                    id={getGradientId("envPie", index)}
                    x1={pieGradient.x1}
                    y1={pieGradient.y1}
                    x2={pieGradient.x2}
                    y2={pieGradient.y2}
                  >
                    {pieGradient.stops.map((stop, stopIndex) => (
                      <stop
                        key={`${stop.offset}-${stopIndex}`}
                        offset={stop.offset}
                        stopColor={getChartColor(index)}
                        stopOpacity={stop.opacity}
                      />
                    ))}
                  </linearGradient>
                ))}
              </defs>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                {...getChartSegmentStrokeStyle(2)}
                dataKey="value"
                nameKey="name"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#${getGradientId("envPie", index)})`} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </div>

        {/* Versions Bar Chart */}
        {barData.length > 0 && (
          <div>
            <DashboardSectionLabel>
              {t("dashboard.widgets.installedVersions")}
            </DashboardSectionLabel>
            <ChartContainer config={chartConfig} className="h-[160px] w-full aspect-auto">
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <defs>
                  {barData.map((_, index) => (
                    <linearGradient
                      key={getGradientId("envBar", index)}
                      id={getGradientId("envBar", index)}
                      x1={barGradient.x1}
                      y1={barGradient.y1}
                      x2={barGradient.x2}
                      y2={barGradient.y2}
                    >
                      {barGradient.stops.map((stop, stopIndex) => (
                        <stop
                          key={`${stop.offset}-${stopIndex}`}
                          offset={stop.offset}
                          stopColor={getChartColor(index)}
                          stopOpacity={stop.opacity}
                        />
                      ))}
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid horizontal={false} {...getChartGridStyle()} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tick={getChartAxisTickStyle(11)}
                />
                <XAxis type="number" hide />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={getChartTooltipCursorStyle()}
                />
                <Bar dataKey="versions" radius={[0, 6, 6, 0]} barSize={20}>
                  {barData.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={`url(#${getGradientId("envBar", index)})`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
