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
import type { InstalledPackage } from "@/lib/tauri";
import type { ProviderInfo } from "@/lib/tauri";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
];

interface PackageChartProps {
  packages: InstalledPackage[];
  providers: ProviderInfo[];
  className?: string;
}

export function PackageChart({ packages, providers, className }: PackageChartProps) {
  const { t } = useLocale();

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
        fill: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const cfg: ChartConfig = {
      count: { label: t("dashboard.widgets.packageCount"), color: "hsl(var(--chart-1))" },
    };

    data.forEach((d) => {
      cfg[d.provider] = { label: d.provider, color: d.fill };
    });

    return { chartData: data, chartConfig: cfg };
  }, [packages, t]);

  if (packages.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {t("dashboard.widgets.packageChart")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {t("dashboard.noPackages")}
          </div>
        </CardContent>
      </Card>
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
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{packages.length}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.widgets.totalPackages")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{providers.length}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.widgets.activeProviders")}</div>
          </div>
        </div>

        {chartData.length > 0 && (
          <ChartContainer config={chartConfig} className="h-[180px] w-full aspect-auto">
            <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="provider"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
