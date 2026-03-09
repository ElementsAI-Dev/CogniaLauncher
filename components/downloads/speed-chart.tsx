"use client";

import { useMemo } from "react";
import { Area, AreaChart, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatBytes } from "@/lib/utils";
import { useDownloadStore } from "@/lib/stores/download";

const chartConfig: ChartConfig = {
  speed: { label: "Speed", color: "var(--chart-2)" },
};

interface SpeedChartProps {
  className?: string;
  t: (key: string) => string;
}

export function SpeedChart({ className, t }: SpeedChartProps) {
  const speedHistory = useDownloadStore((s) => s.speedHistory);

  const data = useMemo(
    () => (speedHistory ?? []).map((s, i) => ({ idx: i, speed: s })),
    [speedHistory]
  );

  if (data.length < 2) return null;

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1">
        {t("downloads.settings.speedChart")}
      </p>
      <ChartContainer config={chartConfig} className="h-20 w-full aspect-auto">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="dlSpeedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, "auto"]} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => `${formatBytes(Number(value))}/s`}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="speed"
            stroke="var(--chart-2)"
            fill="url(#dlSpeedFill)"
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
