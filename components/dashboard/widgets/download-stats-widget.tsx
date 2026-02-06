"use client";

import { useMemo } from "react";
import { Bar, BarChart, XAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLocale } from "@/components/providers/locale-provider";
import { useDownloadStore } from "@/lib/stores/download";
import { Download, CheckCircle2, XCircle, Clock } from "lucide-react";

interface DownloadStatsWidgetProps {
  className?: string;
}

export function DownloadStatsWidget({ className }: DownloadStatsWidgetProps) {
  const { t } = useLocale();
  const tasks = useDownloadStore((s) => s.tasks);
  const history = useDownloadStore((s) => s.history);
  const stats = useDownloadStore((s) => s.stats);

  const { chartData, summaryStats } = useMemo(() => {
    const completed = tasks.filter((t) => t.state === "completed").length;
    const failed = tasks.filter((t) => t.state === "failed").length;
    const active = tasks.filter((t) => t.state === "downloading" || t.state === "queued").length;
    const paused = tasks.filter((t) => t.state === "paused").length;

    const summary = {
      active,
      completed: completed + (history?.filter((h) => h.status === "completed").length || 0),
      failed: failed + (history?.filter((h) => h.status === "failed").length || 0),
      paused,
    };

    const data = [
      { status: t("dashboard.widgets.dlActive"), count: active, fill: "hsl(var(--chart-1))" },
      { status: t("dashboard.widgets.dlCompleted"), count: summary.completed, fill: "hsl(var(--chart-3))" },
      { status: t("dashboard.widgets.dlFailed"), count: summary.failed, fill: "hsl(var(--chart-5))" },
      { status: t("dashboard.widgets.dlPaused"), count: paused, fill: "hsl(var(--chart-4))" },
    ].filter((d) => d.count > 0);

    return { chartData: data, summaryStats: summary };
  }, [tasks, history, t]);

  const chartConfig: ChartConfig = {
    count: { label: t("dashboard.widgets.downloadCount"), color: "hsl(var(--chart-1))" },
  };

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
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="status"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
