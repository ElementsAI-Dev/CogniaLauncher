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
import { getChartColor, getGradientId } from "@/lib/theme/chart-utils";
import type { EnvironmentInfo } from "@/lib/tauri";
import { WidgetEmptyCard } from "@/components/dashboard/widgets/widget-empty-card";

interface EnvironmentChartProps {
  environments: EnvironmentInfo[];
  className?: string;
}

export function EnvironmentChart({ environments, className }: EnvironmentChartProps) {
  const { t } = useLocale();

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
        {/* Status Pie Chart */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {t("dashboard.widgets.statusDistribution")}
          </p>
          <ChartContainer config={chartConfig} className="h-[160px] w-full aspect-auto">
            <PieChart>
              <defs>
                {pieData.map((_, index) => (
                  <linearGradient
                    key={getGradientId("envPie", index)}
                    id={getGradientId("envPie", index)}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={getChartColor(index)} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={getChartColor(index)} stopOpacity={0.7} />
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
                strokeWidth={2}
                stroke="var(--background)"
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
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t("dashboard.widgets.installedVersions")}
            </p>
            <ChartContainer config={chartConfig} className="h-[160px] w-full aspect-auto">
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <defs>
                  {barData.map((_, index) => (
                    <linearGradient
                      key={getGradientId("envBar", index)}
                      id={getGradientId("envBar", index)}
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor={getChartColor(index)} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={getChartColor(index)} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.3} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tick={{ fontSize: 11, fill: "var(--foreground)" }}
                />
                <XAxis type="number" hide />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
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
