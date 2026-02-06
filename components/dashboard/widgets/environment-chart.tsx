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
  // 主色调 - 现代渐变配色
  "hsl(220, 90%, 60%)",   // 主蓝色
  "hsl(160, 80%, 45%)",   // 翠绿色
  "hsl(30, 95%, 55%)",    // 活力橙
  "hsl(340, 85%, 60%)",   // 玫瑰红
  "hsl(270, 75%, 60%)",   // 紫罗兰
  "hsl(190, 85%, 50%)",   // 青蓝色
  "hsl(45, 90%, 55%)",    // 金黄色
  "hsl(300, 70%, 55%)",   // 品红色
  "hsl(140, 70%, 50%)",   // 草绿色
  "hsl(15, 85%, 60%)",    // 珊瑚色
  "hsl(240, 70%, 65%)",   // 靛蓝色
  "hsl(180, 70%, 45%)",   // 青色
];

// 渐变色定义
const GRADIENTS = [
  { from: "#3B82F6", to: "#60A5FA" },    // 蓝色渐变
  { from: "#10B981", to: "#34D399" },    // 绿色渐变
  { from: "#F59E0B", to: "#FBBF24" },    // 橙色渐变
  { from: "#EF4444", to: "#F87171" },    // 红色渐变
  { from: "#8B5CF6", to: "#A78BFA" },    // 紫色渐变
  { from: "#06B6D4", to: "#22D3EE" },    // 青色渐变
  { from: "#F97316", to: "#FB923C" },    // 橙红渐变
  { from: "#EC4899", to: "#F472B6" },    // 粉色渐变
  { from: "#84CC16", to: "#A3E635" },    // 黄绿渐变
  { from: "#14B8A6", to: "#2DD4BF" },    // 青绿渐变
  { from: "#6366F1", to: "#818CF8" },    // 靛蓝渐变
  { from: "#D946EF", to: "#E879F9" },    // 紫红渐变
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
              <defs>
                {pieData.map((_, index) => {
                  const gradient = GRADIENTS[index % GRADIENTS.length];
                  return (
                    <linearGradient
                      key={`pieGradient-${index}`}
                      id={`pieColor${index}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={gradient.from} />
                      <stop offset="100%" stopColor={gradient.to} />
                    </linearGradient>
                  );
                })}
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
                stroke="hsl(var(--background))"
                dataKey="value"
                nameKey="name"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#pieColor${index})`} />
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
                  {barData.map((_, index) => {
                    const gradient = GRADIENTS[index % GRADIENTS.length];
                    return (
                      <linearGradient
                        key={`barGradient-${index}`}
                        id={`barColor${index}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor={gradient.from} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={gradient.to} stopOpacity={0.7} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                />
                <XAxis type="number" hide />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                />
                <Bar dataKey="versions" radius={[0, 6, 6, 0]} barSize={20}>
                  {barData.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={`url(#barColor${index})`} />
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
