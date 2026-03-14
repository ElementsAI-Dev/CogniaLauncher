'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Activity, RefreshCw, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { isTauri } from '@/lib/tauri';
import type { CacheSizeMonitor, CacheSizeSnapshot } from '@/lib/tauri';
import type { CacheMonitorCardProps } from '@/types/cache';

export function CacheMonitorCard({ refreshTrigger, autoRefreshInterval = 0 }: CacheMonitorCardProps) {
  const { t } = useLocale();
  const [monitor, setMonitor] = useState<CacheSizeMonitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [sizeHistory, setSizeHistory] = useState<CacheSizeSnapshot[]>([]);
  const [, setHistoryLoading] = useState(false);

  const fetchMonitor = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const { cacheSizeMonitor } = await import('@/lib/tauri');
      const data = await cacheSizeMonitor();
      setMonitor(data);
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
      const data = await getCacheSizeHistory(30);
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

  const gradientId = useId();
  const chartData = useMemo(
    () =>
      sizeHistory.map((s) => ({
        date: new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        size: s.internalSize,
        sizeHuman: s.internalSizeHuman,
        downloads: s.downloadCount,
        metadata: s.metadataCount,
      })),
    [sizeHistory],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">{t('cache.overviewMonitorTitle')}</CardTitle>
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
        <CardDescription className="text-xs">{t('cache.overviewMonitorDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {monitor ? (
          <>
            {/* Size Trend Chart */}
            {sizeHistory.length >= 2 ? (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                            <p className="font-medium">{d.date}</p>
                            <p>{d.sizeHuman}</p>
                            <p className="text-muted-foreground">
                              {d.downloads} {t('cache.downloadCache').toLowerCase()}, {d.metadata} {t('cache.metadataCache').toLowerCase()}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey="size" stroke="hsl(var(--primary))" fill={`url(#${gradientId})`} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">{t('cache.noSizeHistory')}</p>
            )}

            {/* Size Breakdown Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-bold">{monitor.internalSizeHuman}</p>
                <p className="text-xs text-muted-foreground">{t('cache.internalCache')}</p>
              </div>
              {((monitor.defaultDownloadsSize ?? 0) > 0 || monitor.defaultDownloadsAvailable === false) && (
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-bold">{monitor.defaultDownloadsSizeHuman ?? '0 B'}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.defaultDownloads')}</p>
                </div>
              )}
              {monitor.externalSize > 0 && (
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-bold">{monitor.externalSizeHuman}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.externalTotal')}</p>
                </div>
              )}
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-bold">{monitor.totalSizeHuman}</p>
                <p className="text-xs text-muted-foreground">{t('cache.combinedTotal')}</p>
              </div>
            </div>

            {/* External Cache Breakdown */}
            {monitor.externalCaches.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t('cache.externalCaches')}</p>
                {monitor.externalCaches.map((cache) => (
                  <div key={cache.provider} className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-muted/50">
                    <span className="text-xs">{cache.displayName}</span>
                    <Badge variant="outline" className="text-xs">{cache.sizeHuman}</Badge>
                  </div>
                ))}
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
