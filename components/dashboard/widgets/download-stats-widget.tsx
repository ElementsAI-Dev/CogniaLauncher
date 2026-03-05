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
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 rounded-lg border p-2.5">
            <Download className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-lg font-bold">{summaryStats.active}</div>
              <div className="text-xs text-muted-foreground">{t("dashboard.widgets.dlActive")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-2.5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <div className="text-lg font-bold">{summaryStats.completed}</div>
              <div className="text-xs text-muted-foreground">{t("dashboard.widgets.dlCompleted")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-2.5">
            <XCircle className="h-4 w-4 text-red-500" />
            <div>
              <div className="text-lg font-bold">{summaryStats.failed}</div>
              <div className="text-xs text-muted-foreground">{t("dashboard.widgets.dlFailed")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-2.5">
            <Clock className="h-4 w-4 text-yellow-500" />
            <div>
              <div className="text-lg font-bold">{summaryStats.paused}</div>
              <div className="text-xs text-muted-foreground">{t("dashboard.widgets.dlPaused")}</div>
            </div>
          </div>
        </div>

        {stats && (
          <div className="text-center text-xs text-muted-foreground mb-2">
            {t("dashboard.widgets.overallProgress")}: {Math.round(stats.overallProgress)}%
          </div>
        )}

        {chartData.length > 0 && (
          <ChartContainer config={chartConfig} className="h-[120px] w-full aspect-auto">
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
          <>
            <p className="text-xs text-muted-foreground mt-4 mb-1">
              {t("dashboard.widgets.speedChart")}
            </p>
            <ChartContainer config={speedChartConfig} className="h-[80px] w-full aspect-auto">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
