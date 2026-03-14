'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';
import { Database, HardDrive, Target, Disc } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usageColor } from '@/lib/constants/cache';

export interface CacheStatsStripProps {
  totalSizeHuman: string | null;
  usagePercent: number;
  hitRate: number | null;
  totalEntries: number | null;
  diskAvailableHuman: string | null;
  loading: boolean;
}

export function CacheStatsStrip({
  totalSizeHuman,
  usagePercent,
  hitRate,
  totalEntries,
  diskAvailableHuman,
  loading,
}: CacheStatsStripProps) {
  const { t } = useLocale();

  const stats = [
    {
      icon: HardDrive,
      label: t('cache.statsStripTotalSize'),
      value: totalSizeHuman ?? '0 B',
      extra: (
        <div className="mt-2 space-y-1">
          <Progress value={Math.min(usagePercent, 100)} className="h-1.5" />
          <p className={cn('text-xs font-medium', usageColor(usagePercent))}>
            {Math.round(usagePercent)}%
          </p>
        </div>
      ),
    },
    {
      icon: Target,
      label: t('cache.statsStripHitRate'),
      value: hitRate !== null ? `${(hitRate * 100).toFixed(1)}%` : '—',
      valueColor: hitRate !== null && hitRate >= 0.7 ? 'text-green-600 dark:text-green-400' : hitRate !== null && hitRate < 0.3 ? 'text-red-600 dark:text-red-400' : '',
    },
    {
      icon: Database,
      label: t('cache.statsStripEntries'),
      value: totalEntries !== null ? totalEntries.toLocaleString() : '—',
    },
    {
      icon: Disc,
      label: t('cache.statsStripDiskAvailable'),
      value: diskAvailableHuman ?? '—',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-5 pb-4 px-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <stat.icon className="h-4 w-4" />
                  {stat.label}
                </div>
                <p className={cn('text-2xl font-bold', stat.valueColor)}>
                  {stat.value}
                </p>
                {stat.extra}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
