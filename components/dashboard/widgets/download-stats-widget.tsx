"use client";

import { useMemo } from "react";
import { Bar, BarChart, Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLocale } from "@/components/providers/locale-provider";
import { useDownloadStore } from "@/lib/stores/download";
import { formatBytes } from "@/lib/utils";
import {
  getChartColor,
  getChartGradientDefinition,
  getChartAxisTickStyle,
  getChartGridStyle,
  getChartTooltipCursorStyle,
  getGradientId,
} from "@/lib/theme/chart-utils";
import { Download, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardSectionLabel,
} from "@/components/dashboard/dashboard-primitives";

interface DownloadStatsWidgetProps {
  className?: string;
}

export function DownloadStatsWidget({ className }: DownloadStatsWidgetProps) {
  const { t } = useLocale();
  const sparklineGradient = getChartGradientDefinition("sparkline");
  const tasks = useDownloadStore((s) => s.tasks);
  const history = useDownloadStore((s) => s.history);
  const stats = useDownloadStore((s) => s.stats);
  const speedHistory = useDownloadStore((s) => s.speedHistory);

  const { chartData, summaryStats } = useMemo(() => {
    const taskList = tasks ?? [];
    const historyList = history ?? [];
    const completed = taskList.filter((t) => t.state === "completed").length;
    const failed = taskList.filter((t) => t.state === "failed").length;
    const active = taskList.filter((t) => t.state === "downloading" || t.state === "queued").length;
    const paused = taskList.filter((t) => t.state === "paused").length;

    const summary = {
      active,
      completed: completed + historyList.filter((h) => h.status === "completed").length,
      failed: failed + historyList.filter((h) => h.status === "failed").length,
      paused,
    };

    const data = [
      { status: t("dashboard.widgets.dlActive"), count: active, fill: getChartColor(0) },
      { status: t("dashboard.widgets.dlCompleted"), count: summary.completed, fill: getChartColor(2) },
      { status: t("dashboard.widgets.dlFailed"), count: summary.failed, fill: getChartColor(4) },
      { status: t("dashboard.widgets.dlPaused"), count: paused, fill: getChartColor(3) },
    ].filter((d) => d.count > 0);

    return { chartData: data, summaryStats: summary };
  }, [tasks, history, t]);

  const chartConfig: ChartConfig = {
    count: { label: t("dashboard.widgets.downloadCount"), color: getChartColor(0) },
  };

  const speedChartConfig: ChartConfig = {
    speed: { label: t("dashboard.widgets.speedChart"), color: getChartColor(1) },
  };

  const speedChartData = useMemo(
    () => (speedHistory ?? []).map((s, i) => ({ idx: i, speed: s })),
    [speedHistory]
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.downloadStats")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.downloadStatsDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DashboardMetricGrid columns={4}>
          <DashboardMetricItem
            label={t("dashboard.widgets.dlActive")}
            value={summaryStats.active}
            icon={<Download className="h-3.5 w-3.5 text-blue-500" />}
          />
          <DashboardMetricItem
            label={t("dashboard.widgets.dlCompleted")}
            value={summaryStats.completed}
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          />
          <DashboardMetricItem
            label={t("dashboard.widgets.dlFailed")}
            value={summaryStats.failed}
            icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
          />
          <DashboardMetricItem
            label={t("dashboard.widgets.dlPaused")}
            value={summaryStats.paused}
            icon={<Clock className="h-3.5 w-3.5 text-yellow-500" />}
          />
        </DashboardMetricGrid>

        {stats && (
          <div className="text-center text-xs text-muted-foreground">
            {t("dashboard.widgets.overallProgress")}: {Math.round(stats.overallProgress)}%
          </div>
        )}

        {chartData.length > 0 && (
          <ChartContainer config={chartConfig} className="h-30 w-full aspect-auto">
            <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
              <CartesianGrid vertical={false} {...getChartGridStyle()} />
              <XAxis
                dataKey="status"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={getChartAxisTickStyle(10)}
              />
              <ChartTooltip content={<ChartTooltipContent />} cursor={getChartTooltipCursorStyle()} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}

        {speedChartData.length > 1 && (
          <div className="space-y-2">
            <DashboardSectionLabel>
              {t("dashboard.widgets.speedChart")}
            </DashboardSectionLabel>
            <ChartContainer config={speedChartConfig} className="h-20 w-full aspect-auto">
              <AreaChart data={speedChartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient
                    id={getGradientId("speed", 0)}
                    x1={sparklineGradient.x1}
                    y1={sparklineGradient.y1}
                    x2={sparklineGradient.x2}
                    y2={sparklineGradient.y2}
                  >
                    {sparklineGradient.stops.map((stop, index) => (
                      <stop
                        key={`${stop.offset}-${index}`}
                        offset={stop.offset}
                        stopColor={getChartColor(1)}
                        stopOpacity={stop.opacity}
                      />
                    ))}
                  </linearGradient>
                </defs>
                <YAxis
                  hide
                  domain={[0, "auto"]}
                />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(value) => `${formatBytes(Number(value))}/s`} />}
                />
                <Area
                  type="monotone"
                  dataKey="speed"
                  stroke={getChartColor(1)}
                  fill={`url(#${getGradientId("speed", 0)})`}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
