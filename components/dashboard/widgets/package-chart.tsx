"use client";

import { useMemo } from "react";
import { Bar, BarChart, XAxis, CartesianGrid, Cell } from "recharts";
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
  getChartTooltipCursorStyle,
  getGradientId,
} from "@/lib/theme/chart-utils";
import type { InstalledPackage } from "@/lib/tauri";
import type { ProviderInfo } from "@/lib/tauri";
import { WidgetEmptyCard } from "@/components/dashboard/widgets/widget-empty-card";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardSectionLabel,
} from "@/components/dashboard/dashboard-primitives";

interface PackageChartProps {
  packages: InstalledPackage[];
  providers: ProviderInfo[];
  className?: string;
}

export function PackageChart({ packages, providers, className }: PackageChartProps) {
  const { t } = useLocale();
  const barGradient = getChartGradientDefinition("bar-vertical");

  const { chartData, chartConfig } = useMemo(() => {
    const byProvider = new Map<string, number>();
    packages.forEach((pkg) => {
      const current = byProvider.get(pkg.provider) || 0;
      byProvider.set(pkg.provider, current + 1);
    });

    const data = Array.from(byProvider.entries())
      .map(([provider, count], i) => ({
        provider,
        count,
        fill: `url(#${getGradientId("pkg", i)})`,
        color: getChartColor(i),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const cfg: ChartConfig = {
      count: { label: t("dashboard.widgets.packageCount"), color: "var(--chart-1)" },
    };

    data.forEach((d) => {
      cfg[d.provider] = { label: d.provider, color: d.color };
    });

    return { chartData: data, chartConfig: cfg };
  }, [packages, t]);

  if (packages.length === 0) {
    return (
      <WidgetEmptyCard
        title={t("dashboard.widgets.packageChart")}
        message={t("dashboard.noPackages")}
        className={className}
      />
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.packageChart")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.packageChartDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DashboardMetricGrid>
          <DashboardMetricItem
            label={t("dashboard.widgets.totalPackages")}
            value={packages.length}
            valueClassName="text-2xl"
          />
          <DashboardMetricItem
            label={t("dashboard.widgets.activeProviders")}
            value={providers.length}
            valueClassName="text-2xl"
          />
        </DashboardMetricGrid>

        {chartData.length > 0 && (
          <div className="space-y-2">
            <DashboardSectionLabel>{t("dashboard.widgets.packageCount")}</DashboardSectionLabel>
            <ChartContainer config={chartConfig} className="h-[180px] w-full aspect-auto">
              <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
                <defs>
                  {chartData.map((_, index) => (
                    <linearGradient
                      key={getGradientId("pkg", index)}
                      id={getGradientId("pkg", index)}
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
                <CartesianGrid vertical={false} {...getChartGridStyle()} />
                <XAxis
                  dataKey="provider"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={getChartAxisTickStyle(10)}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={getChartTooltipCursorStyle()}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
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
