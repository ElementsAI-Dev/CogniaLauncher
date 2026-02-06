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
  // 现代渐变配色方案
  { from: "#6366F1", to: "#818CF8" },  // 靛蓝
  { from: "#3B82F6", to: "#60A5FA" },  // 蓝色
  { from: "#06B6D4", to: "#22D3EE" },  // 青色
  { from: "#10B981", to: "#34D399" },  // 绿色
  { from: "#84CC16", to: "#A3E635" },  // 黄绿
  { from: "#F59E0B", to: "#FBBF24" },  // 黄色
  { from: "#F97316", to: "#FB923C" },  // 橙色
  { from: "#EF4444", to: "#F87171" },  // 红色
  { from: "#EC4899", to: "#F472B6" },  // 粉色
  { from: "#8B5CF6", to: "#A78BFA" },  // 紫色
  { from: "#D946EF", to: "#E879F9" },  // 紫红
  { from: "#14B8A6", to: "#2DD4BF" },  // 青绿
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
        fill: `url(#pkgGradient${i})`,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const cfg: ChartConfig = {
      count: { label: t("dashboard.widgets.packageCount"), color: "hsl(var(--chart-1))" },
    };

    data.forEach((d) => {
      cfg[d.provider] = { label: d.provider, color: d.color.from };
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
              <defs>
                {chartData.map((_, index) => {
                  const color = COLORS[index % COLORS.length];
                  return (
                    <linearGradient
                      key={`pkgGradient-${index}`}
                      id={`pkgGradient${index}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={color.from} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={color.to} stopOpacity={0.75} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
              <XAxis
                dataKey="provider"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={45}>
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
