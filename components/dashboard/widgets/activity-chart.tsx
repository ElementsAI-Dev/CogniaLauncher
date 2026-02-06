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
import type { EnvironmentInfo, InstalledPackage } from "@/lib/tauri";

interface ActivityChartProps {
  environments: EnvironmentInfo[];
  packages: InstalledPackage[];
  className?: string;
}

export function ActivityChart({ environments, packages, className }: ActivityChartProps) {
  const { t } = useLocale();

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
      color: "hsl(var(--chart-1))",
    },
    packages: {
      label: t("dashboard.widgets.packages"),
      color: "hsl(var(--chart-2))",
    },
  };

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {t("dashboard.widgets.activityTimeline")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {t("dashboard.widgets.noActivity")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.activityTimeline")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.activityTimelineDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full aspect-auto">
          <AreaChart data={chartData} margin={{ left: 0, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10 }}
            />
            <YAxis tickLine={false} axisLine={false} width={30} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <defs>
              <linearGradient id="fillEnv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillPkg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="environments"
              stroke="hsl(var(--chart-1))"
              fill="url(#fillEnv)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="packages"
              stroke="hsl(var(--chart-2))"
              fill="url(#fillPkg)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
