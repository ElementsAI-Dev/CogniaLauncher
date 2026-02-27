'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AlertTriangle, ChevronDown, HardDrive, Activity, RefreshCw } from 'lucide-react';
import { isTauri } from '@/lib/tauri';
import type { CacheSizeMonitor } from '@/lib/tauri';
import { usageColor, progressColor } from '@/lib/constants/cache';
import type { CacheMonitorCardProps } from '@/types/cache';

export function CacheMonitorCard({ refreshTrigger, autoRefreshInterval = 0 }: CacheMonitorCardProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(true);
  const [monitor, setMonitor] = useState<CacheSizeMonitor | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMonitor = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const { cacheSizeMonitor } = await import('@/lib/tauri');
      const data = await cacheSizeMonitor();
      setMonitor(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitor();
  }, [fetchMonitor, refreshTrigger]);

  // Auto-refresh based on monitor_interval setting
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const intervalMs = autoRefreshInterval * 1000;
    const timer = setInterval(() => {
      fetchMonitor();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchMonitor]);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle className="text-base">{t('cache.sizeMonitor')}</CardTitle>
                {monitor?.exceedsThreshold && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {Math.round(monitor.usagePercent)}%
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); fetchMonitor(); }}
                      disabled={loading}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.refresh')}</TooltipContent>
                </Tooltip>
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CollapsibleTrigger>
          <CardDescription>{t('cache.sizeMonitorDesc')}</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Separator />
            {monitor ? (
              <>
                {/* Usage Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('cache.usagePercent')}</span>
                    <span className={`font-medium ${usageColor(monitor.usagePercent)}`}>
                      {Math.round(monitor.usagePercent)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(monitor.usagePercent, 100)}
                    className={`h-2 ${progressColor(monitor.usagePercent)}`}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{monitor.internalSizeHuman} / {monitor.maxSizeHuman}</span>
                    {monitor.threshold > 0 && (
                      <span>Threshold: {monitor.threshold}%</span>
                    )}
                  </div>
                </div>

                {/* Threshold Warning */}
                {monitor.exceedsThreshold && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {t('cache.thresholdExceeded', {
                        percent: Math.round(monitor.usagePercent),
                        threshold: monitor.threshold,
                      })}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Size Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{monitor.internalSizeHuman}</p>
                    <p className="text-xs text-muted-foreground">{t('cache.internalCache')}</p>
                  </div>
                  {monitor.externalSize > 0 && (
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{monitor.externalSizeHuman}</p>
                      <p className="text-xs text-muted-foreground">{t('cache.externalTotal')}</p>
                    </div>
                  )}
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{monitor.totalSizeHuman}</p>
                    <p className="text-xs text-muted-foreground">{t('cache.combinedTotal')}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <p className="text-lg font-bold">{monitor.diskAvailableHuman}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('cache.diskAvailable')}</p>
                  </div>
                </div>

                {/* External Cache Breakdown */}
                {monitor.externalCaches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{t('cache.externalCaches')}</p>
                    <div className="space-y-1">
                      {monitor.externalCaches.map((cache) => (
                        <div key={cache.provider} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50">
                          <span>{cache.displayName}</span>
                          <Badge variant="outline">{cache.sizeHuman}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : loading ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
