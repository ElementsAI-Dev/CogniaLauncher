"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLocale } from "@/components/providers/locale-provider";
import {
  DashboardEmptyState,
  DashboardMetricGrid,
  DashboardMetricItem,
} from "@/components/dashboard/dashboard-primitives";
import type { DashboardTrendModel } from "@/hooks/use-dashboard-insights";
import {
  getChartAxisTickStyle,
  getChartColor,
  getChartGradientDefinition,
  getChartGridStyle,
  getGradientId,
} from "@/lib/theme/chart-utils";

interface WorkspaceTrendsWidgetProps {
  model: DashboardTrendModel;
  className?: string;
}

export function WorkspaceTrendsWidget({
  model,
  className,
}: WorkspaceTrendsWidgetProps) {
  const { t } = useLocale();
  const gradient = getChartGradientDefinition("area");
  const totalValue = model.points.reduce((sum, point) => sum + point.value, 0);

  const chartConfig: ChartConfig = {
    value: {
      label: t(`dashboard.widgets.settingsMetric_${model.metric}`),
      color: getChartColor(0),
    },
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.workspaceTrends")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.workspaceTrendsDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {model.points.length === 0 ? (
          <DashboardEmptyState
            className="py-4"
            icon={<TrendingUp className="h-8 w-8 text-muted-foreground/70" />}
            message={t("dashboard.widgets.workspaceTrendsEmpty")}
          />
        ) : (
          <>
            <DashboardMetricGrid>
              <DashboardMetricItem
                label={t(`dashboard.widgets.settingsMetric_${model.metric}`)}
                value={totalValue}
              />
              <DashboardMetricItem
                label={t("dashboard.widgets.rangeLabel")}
                value={model.range}
              />
            </DashboardMetricGrid>

            <ChartContainer config={chartConfig} className="h-48 w-full">
              <AreaChart data={model.points} margin={{ left: 0, right: 12 }}>
                <defs>
                  <linearGradient
                    id={getGradientId("workspace-trends", 0)}
                    x1={gradient.x1}
                    y1={gradient.y1}
                    x2={gradient.x2}
                    y2={gradient.y2}
                  >
                    {gradient.stops.map((stop, index) => (
                      <stop
                        key={`${stop.offset}-${index}`}
                        offset={stop.offset}
                        stopColor={getChartColor(0)}
                        stopOpacity={stop.opacity}
                      />
                    ))}
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} {...getChartGridStyle()} />
                <XAxis
                  dataKey="label"
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
                  dataKey="value"
                  stroke={getChartColor(0)}
                  strokeWidth={2.5}
                  fill={`url(#${getGradientId("workspace-trends", 0)})`}
                />
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
