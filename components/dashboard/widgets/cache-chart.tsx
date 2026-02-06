"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLocale } from "@/components/providers/locale-provider";
import type { CacheInfo } from "@/lib/tauri";

interface CacheChartProps {
  cacheInfo: CacheInfo | null;
  className?: string;
}

export function CacheChart({ cacheInfo, className }: CacheChartProps) {
  const { t } = useLocale();

  const { pieData, radialData, chartConfig } = useMemo(() => {
    if (!cacheInfo) {
      return { pieData: [], radialData: [], chartConfig: {} as ChartConfig };
    }

    const downloadSize = cacheInfo.download_cache.size || 0;
    const metadataSize = cacheInfo.metadata_cache.size || 0;

    const pie = [
      {
        name: t("dashboard.widgets.downloadCache"),
        value: downloadSize,
        fill: "hsl(var(--chart-1))",
      },
      {
        name: t("dashboard.widgets.metadataCache"),
        value: metadataSize,
        fill: "hsl(var(--chart-3))",
      },
    ].filter((d) => d.value > 0);

    const totalEntries =
      cacheInfo.download_cache.entry_count + cacheInfo.metadata_cache.entry_count;
    const hitRate = cacheInfo.download_cache.entry_count > 0 ? 75 : 0;

    const radial = [{ name: "usage", value: hitRate, fill: "hsl(var(--chart-1))" }];

    const cfg: ChartConfig = {
      downloadCache: { label: t("dashboard.widgets.downloadCache"), color: "hsl(var(--chart-1))" },
      metadataCache: { label: t("dashboard.widgets.metadataCache"), color: "hsl(var(--chart-3))" },
      usage: { label: t("dashboard.widgets.cacheUsage"), color: "hsl(var(--chart-1))" },
    };

    return { pieData: pie, radialData: radial, chartConfig: cfg, totalEntries };
  }, [cacheInfo, t]);

  if (!cacheInfo) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {t("dashboard.widgets.cacheUsage")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {t("cache.noCacheData")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.widgets.cacheUsage")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.widgets.cacheUsageDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold">{cacheInfo.total_size_human}</div>
            <div className="text-xs text-muted-foreground">{t("cache.totalSize")}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{cacheInfo.download_cache.entry_count}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.widgets.downloadCache")}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{cacheInfo.metadata_cache.entry_count}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.widgets.metadataCache")}</div>
          </div>
        </div>

        {pieData.length > 0 ? (
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
            </PieChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={chartConfig} className="h-[160px] w-full aspect-auto">
            <RadialBarChart
              data={radialData}
              startAngle={90}
              endAngle={-270}
              innerRadius={55}
              outerRadius={75}
              cx="50%"
              cy="50%"
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={8} background />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-foreground">
                {t("dashboard.widgets.empty")}
              </text>
            </RadialBarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
