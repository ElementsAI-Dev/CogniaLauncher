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
import type { EnvironmentInfo } from "@/lib/tauri";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(330, 60%, 55%)",
  "hsl(270, 50%, 55%)",
];

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
      { name: t("dashboard.widgets.available"), value: availableCount, fill: "hsl(var(--chart-1))" },
      { name: t("dashboard.widgets.unavailable"), value: unavailableCount, fill: "hsl(var(--chart-2))" },
    ].filter((d) => d.value > 0);

    const bar = environments
      .map((env, i) => ({
        name: env.env_type,
        versions: env.installed_versions.length,
        fill: COLORS[i % COLORS.length],
      }))
      .filter((d) => d.versions > 0)
      .sort((a, b) => b.versions - a.versions)
      .slice(0, 8);

    const cfg: ChartConfig = {
      available: { label: t("dashboard.widgets.available"), color: "hsl(var(--chart-1))" },
      unavailable: { label: t("dashboard.widgets.unavailable"), color: "hsl(var(--chart-2))" },
      versions: { label: t("dashboard.widgets.installedVersions"), color: "hsl(var(--chart-1))" },
    };

    return { pieData: pie, barData: bar, chartConfig: cfg };
  }, [environments, t]);

  if (environments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {t("dashboard.widgets.environmentChart")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {t("dashboard.noEnvironments")}
          </div>
        </CardContent>
      </Card>
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
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
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
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tick={{ fontSize: 11 }}
                />
                <XAxis type="number" hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="versions" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
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
