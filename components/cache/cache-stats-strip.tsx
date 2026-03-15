'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardStatusBadge,
} from '@/components/dashboard/dashboard-primitives';
import type { CacheScopeInsight } from '@/lib/cache/insights';
import { Database, FolderDown, FolderOpen, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usageColor } from '@/lib/constants/cache';

export interface CacheStatsStripProps {
  totalSizeHuman: string | null;
  usagePercent: number;
  totalEntries: number | null;
  diskAvailableHuman: string | null;
  freshness: {
    state: 'fresh' | 'stale' | 'missing';
    lastUpdatedAt: number | null;
  };
  scopeSummaries: CacheScopeInsight[];
  loading: boolean;
}

const SCOPE_ICONS = {
  internal: Database,
  default_downloads: FolderDown,
  external: FolderOpen,
} as const;

const FRESHNESS_TONES = {
  fresh: 'success',
  stale: 'warning',
  missing: 'muted',
} as const;

const FRESHNESS_LABELS = {
  fresh: 'cache.insightFreshnessFresh',
  stale: 'cache.insightFreshnessStale',
  missing: 'cache.insightFreshnessMissing',
} as const;

const STATUS_TONE_CLASSES: Record<CacheScopeInsight['tone'], string> = {
  default: '',
  success: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  muted: 'border-muted bg-muted text-muted-foreground',
};

function formatFreshnessLabel(
  freshness: CacheStatsStripProps['freshness'],
  t: (key: string) => string,
) {
  const base = t(FRESHNESS_LABELS[freshness.state]);
  if (!freshness.lastUpdatedAt) return base;
  return `${base} · ${new Date(freshness.lastUpdatedAt).toLocaleTimeString()}`;
}

export function CacheStatsStrip({
  totalSizeHuman,
  usagePercent,
  totalEntries,
  diskAvailableHuman,
  freshness,
  scopeSummaries,
  loading,
}: CacheStatsStripProps) {
  const { t } = useLocale();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
      <Card className="xl:col-span-1">
        <CardContent className="space-y-4 pt-5 pb-4 px-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-2 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HardDrive className="h-4 w-4" />
                    {t('cache.statsStripTotalSize')}
                  </div>
                  <p className="text-3xl font-bold leading-none">{totalSizeHuman ?? '0 B'}</p>
                </div>
                <DashboardStatusBadge tone={FRESHNESS_TONES[freshness.state]}>
                  {formatFreshnessLabel(freshness, t)}
                </DashboardStatusBadge>
              </div>

              <div className="space-y-2">
                <Progress value={Math.min(usagePercent, 100)} className="h-2" />
                <div className="flex items-center justify-between text-xs">
                  <span className={cn('font-medium', usageColor(usagePercent))}>
                    {Math.round(usagePercent)}%
                  </span>
                  <span className="text-muted-foreground">{t('cache.insightUsageLabel')}</span>
                </div>
              </div>

              <DashboardMetricGrid columns={2}>
                <DashboardMetricItem
                  label={t('cache.statsStripEntries')}
                  value={totalEntries !== null ? totalEntries.toLocaleString() : '—'}
                />
                <DashboardMetricItem
                  label={t('cache.statsStripDiskAvailable')}
                  value={diskAvailableHuman ?? '—'}
                />
              </DashboardMetricGrid>
            </>
          )}
        </CardContent>
      </Card>

      {scopeSummaries.map((scope) => {
        const Icon = SCOPE_ICONS[scope.id];
        return (
          <Card key={scope.id}>
            <CardContent className="space-y-4 pt-5 pb-4 px-5">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-5 w-28" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        {t(scope.titleKey)}
                      </div>
                      <p className="text-2xl font-semibold leading-none">{scope.sizeHuman}</p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium',
                        STATUS_TONE_CLASSES[scope.tone],
                      )}
                    >
                      {t(scope.statusLabelKey)}
                    </span>
                  </div>

                  <DashboardMetricGrid columns={2}>
                    <DashboardMetricItem
                      label={t('cache.statsStripEntries')}
                      value={
                        scope.entryCount !== null
                          ? scope.entryCount.toLocaleString()
                          : '—'
                      }
                      valueClassName="text-base"
                    />
                    <DashboardMetricItem
                      label={t('cache.insightCoverageLabel')}
                      value={t(scope.coverageLabelKey)}
                      valueClassName="text-sm"
                    />
                  </DashboardMetricGrid>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
