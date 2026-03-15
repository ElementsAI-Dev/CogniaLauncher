'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardSectionLabel,
  DashboardStatusBadge,
} from '@/components/dashboard/dashboard-primitives';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Activity, RefreshCw, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { isTauri } from '@/lib/tauri';
import type { CacheSizeMonitor, CacheSizeSnapshot } from '@/lib/tauri';
import type { CacheMonitorCardProps } from '@/types/cache';

const TREND_WINDOW_DAYS = 30;
const FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000;

const chartConfig: ChartConfig = {
  size: {
    label: 'Cache Size',
    color: 'var(--chart-1)',
  },
};

function freshnessLabelKey(lastUpdatedAt: number | null) {
  if (!lastUpdatedAt) return 'cache.insightFreshnessMissing';
  return Date.now() - lastUpdatedAt <= FRESHNESS_THRESHOLD_MS
    ? 'cache.insightFreshnessFresh'
    : 'cache.insightFreshnessStale';
}

export function CacheMonitorCard({ refreshTrigger, autoRefreshInterval = 0 }: CacheMonitorCardProps) {
  const { t } = useLocale();
  const [monitor, setMonitor] = useState<CacheSizeMonitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [sizeHistory, setSizeHistory] = useState<CacheSizeSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const gradientId = useId();

  const fetchMonitor = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const { cacheSizeMonitor } = await import('@/lib/tauri');
      const data = await cacheSizeMonitor();
      setMonitor(data);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      console.error('Failed to fetch cache monitor:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSizeHistory = useCallback(async () => {
    if (!isTauri()) return;
    setHistoryLoading(true);
    try {
      const { getCacheSizeHistory } = await import('@/lib/tauri');
      const data = await getCacheSizeHistory(TREND_WINDOW_DAYS);
      setSizeHistory(data);
    } catch (err) {
      console.error('Failed to fetch cache size history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitor();
    fetchSizeHistory();
  }, [fetchMonitor, fetchSizeHistory, refreshTrigger]);

  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const intervalMs = autoRefreshInterval * 1000;
    const timer = setInterval(() => {
      fetchMonitor();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchMonitor]);

  const chartData = sizeHistory.map((snapshot) => ({
    date: new Date(snapshot.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    size: snapshot.internalSize,
    sizeHuman: snapshot.internalSizeHuman,
    downloads: snapshot.downloadCount,
    metadata: snapshot.metadataCount,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">{t('cache.overviewMonitorTitle')}</CardTitle>
            </div>
            <CardDescription className="text-xs">{t('cache.overviewMonitorDesc')}</CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={fetchMonitor}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.refresh')}</TooltipContent>
          </Tooltip>
        </div>
        {!loading && (
          <div className="flex flex-wrap gap-2">
            <DashboardStatusBadge tone="default">
              {t('cache.insightCoverageHistorical')}
            </DashboardStatusBadge>
            <DashboardStatusBadge tone="muted">
              {t('cache.insightTrendWindowDays', { days: TREND_WINDOW_DAYS })}
            </DashboardStatusBadge>
            <DashboardStatusBadge tone={lastUpdatedAt ? 'success' : 'muted'}>
              {t(freshnessLabelKey(lastUpdatedAt))}
            </DashboardStatusBadge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {monitor ? (
          <>
            {sizeHistory.length >= 2 ? (
              <div className="space-y-2">
                <DashboardSectionLabel>{t('cache.sizeHistory')}</DashboardSectionLabel>
                <ChartContainer config={chartConfig} className="h-44 w-full aspect-auto">
                  <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-size)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--color-size)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <ChartTooltip
                      content={(
                        <ChartTooltipContent
                          formatter={(value, _name, item) => (
                            <>
                              <span className="text-muted-foreground">
                                {item.payload.date}
                              </span>
                              <span className="font-medium">
                                {item.payload.sizeHuman}
                              </span>
                            </>
                          )}
                        />
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="size"
                      stroke="var(--color-size)"
                      fill={`url(#${gradientId})`}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            ) : historyLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <div className="rounded-lg border border-dashed p-4">
                <div className="flex flex-wrap gap-2">
                  <DashboardStatusBadge tone="muted">
                    {t('cache.insightCoverageSnapshot')}
                  </DashboardStatusBadge>
                  <DashboardStatusBadge tone="muted">
                    {t('cache.insightFreshnessMissing')}
                  </DashboardStatusBadge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t('cache.noSizeHistory')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('cache.insightSnapshotOnlyDesc')}</p>
              </div>
            )}

            <DashboardMetricGrid columns={4}>
              <DashboardMetricItem
                label={t('cache.internalCache')}
                value={monitor.internalSizeHuman}
              />
              {((monitor.defaultDownloadsSize ?? 0) > 0 || monitor.defaultDownloadsAvailable === false) && (
                <DashboardMetricItem
                  label={t('cache.defaultDownloads')}
                  value={monitor.defaultDownloadsSizeHuman ?? '0 B'}
                />
              )}
              {monitor.externalSize > 0 && (
                <DashboardMetricItem
                  label={t('cache.externalTotal')}
                  value={monitor.externalSizeHuman}
                />
              )}
              <DashboardMetricItem
                label={t('cache.combinedTotal')}
                value={monitor.totalSizeHuman}
              />
            </DashboardMetricGrid>

            {monitor.externalCaches.length > 0 && (
              <div className="space-y-2">
                <DashboardSectionLabel>{t('cache.externalCaches')}</DashboardSectionLabel>
                <div className="space-y-2">
                  {monitor.externalCaches.map((cache) => (
                    <div
                      key={cache.provider}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <span>{cache.displayName}</span>
                      <DashboardStatusBadge tone="default">
                        {cache.sizeHuman}
                      </DashboardStatusBadge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : loading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ) : (
          <Empty className="border-none py-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Activity />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">{t('cache.noCacheData')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
