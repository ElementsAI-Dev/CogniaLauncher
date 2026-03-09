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
import {
  getChartColor,
  getChartGradientDefinition,
  getChartRadialTrackStyle,
  getChartSegmentStrokeStyle,
  getGradientId,
} from "@/lib/theme/chart-utils";
import type { CacheInfo } from "@/lib/tauri";
import { WidgetEmptyCard } from "@/components/dashboard/widgets/widget-empty-card";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardSectionLabel,
} from "@/components/dashboard/dashboard-primitives";

interface CacheChartProps {
  cacheInfo: CacheInfo | null;
  className?: string;
}

export function CacheChart({ cacheInfo, className }: CacheChartProps) {
  const { t } = useLocale();
  const pieGradient = getChartGradientDefinition("pie");

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
        fill: `url(#${getGradientId("cache", 0)})`,
      },
      {
        name: t("dashboard.widgets.metadataCache"),
        value: metadataSize,
        fill: `url(#${getGradientId("cache", 1)})`,
      },
    ].filter((d) => d.value > 0);

    const totalEntries =
      cacheInfo.download_cache.entry_count + cacheInfo.metadata_cache.entry_count;
    // Calculate actual usage ratio based on entry distribution
    const usagePercent = totalEntries > 0
      ? Math.round((cacheInfo.download_cache.entry_count / Math.max(totalEntries, 1)) * 100)
      : 0;

    const radial = [{ name: "usage", value: usagePercent, fill: `url(#${getGradientId("cache", 0)})` }];

    const cfg: ChartConfig = {
      downloadCache: { label: t("dashboard.widgets.downloadCache"), color: getChartColor(0) },
      metadataCache: { label: t("dashboard.widgets.metadataCache"), color: getChartColor(3) },
      usage: { label: t("dashboard.widgets.cacheUsage"), color: getChartColor(0) },
    };

    return { pieData: pie, radialData: radial, chartConfig: cfg };
  }, [cacheInfo, t]);

  if (!cacheInfo) {
    return (
      <WidgetEmptyCard
        title={t("dashboard.widgets.cacheUsage")}
        message={t("cache.noCacheData")}
        className={className}
      />
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
      <CardContent className="space-y-4">
        <DashboardMetricGrid columns={3}>
          <DashboardMetricItem
            label={t("cache.totalSize")}
            value={cacheInfo.total_size_human}
          />
          <DashboardMetricItem
            label={t("dashboard.widgets.downloadCache")}
            value={cacheInfo.download_cache.entry_count}
          />
          <DashboardMetricItem
            label={t("dashboard.widgets.metadataCache")}
            value={cacheInfo.metadata_cache.entry_count}
          />
        </DashboardMetricGrid>

        {pieData.length > 0 ? (
          <div className="space-y-2">
            <DashboardSectionLabel>{t("dashboard.widgets.cacheUsage")}</DashboardSectionLabel>
            <ChartContainer config={chartConfig} className="h-40 w-full aspect-auto">
              <PieChart>
                <defs>
                  {[0, 1].map((index) => (
                    <linearGradient
                      key={getGradientId("cache", index)}
                      id={getGradientId("cache", index)}
                      x1={pieGradient.x1}
                      y1={pieGradient.y1}
                      x2={pieGradient.x2}
                      y2={pieGradient.y2}
                    >
                      {pieGradient.stops.map((stop, stopIndex) => (
                        <stop
                          key={`${stop.offset}-${stopIndex}`}
                          offset={stop.offset}
                          stopColor={index === 0 ? getChartColor(0) : getChartColor(3)}
                          stopOpacity={stop.opacity}
                        />
                      ))}
                    </linearGradient>
                  ))}
                </defs>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  {...getChartSegmentStrokeStyle(2)}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="space-y-2">
            <DashboardSectionLabel>{t("dashboard.widgets.cacheUsage")}</DashboardSectionLabel>
            <ChartContainer config={chartConfig} className="h-40 w-full aspect-auto">
              <RadialBarChart
                data={radialData}
                startAngle={90}
                endAngle={-270}
                innerRadius={55}
                outerRadius={75}
                cx="50%"
                cy="50%"
              >
                <defs>
                  <linearGradient
                    id={getGradientId("cache", 0)}
                    x1={pieGradient.x1}
                    y1={pieGradient.y1}
                    x2={pieGradient.x2}
                    y2={pieGradient.y2}
                  >
                    {pieGradient.stops.map((stop, stopIndex) => (
                      <stop
                        key={`${stop.offset}-${stopIndex}`}
                        offset={stop.offset}
                        stopColor={getChartColor(0)}
                        stopOpacity={stop.opacity}
                      />
                    ))}
                  </linearGradient>
                </defs>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  background={getChartRadialTrackStyle()}
                />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-foreground">
                  {t("dashboard.widgets.empty")}
                </text>
              </RadialBarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
