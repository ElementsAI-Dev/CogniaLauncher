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
import { WidgetEmptyCard } from "@/components/dashboard/widgets/widget-empty-card";

interface ActivityChartProps {
  environments: EnvironmentInfo[];
  packages: InstalledPackage[];
  className?: string;
}

export function ActivityChart({ environments, packages, className }: ActivityChartProps) {
  const { t } = useLocale();
  const areaGradient = getChartGradientDefinition("area");

  const chartData = useMemo(() => {
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
    }));
  }, [environments, packages]);

  const chartConfig: ChartConfig = {
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
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full aspect-auto">
          <AreaChart data={chartData} margin={{ left: 0, right: 12 }}>
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
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
