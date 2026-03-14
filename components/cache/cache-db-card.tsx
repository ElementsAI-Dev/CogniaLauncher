'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Database, Wrench, Eye, ArrowRight } from 'lucide-react';
import type { CacheOptimizeResult, DatabaseInfo } from '@/lib/tauri';

export interface CacheDbCardProps {
  dbInfo: DatabaseInfo | null;
  dbInfoLoading: boolean;
  optimizeResult: CacheOptimizeResult | null;
  optimizeLoading: boolean;
  isLoading: boolean;
  fetchDbInfo: () => void;
  handleOptimize: () => void;
}

export function CacheDbCard({
  dbInfo,
  dbInfoLoading,
  optimizeResult,
  optimizeLoading,
  isLoading,
  fetchDbInfo,
  handleOptimize,
}: CacheDbCardProps) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <CardTitle className="text-sm">{t('cache.dbMaintenanceTitle')}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={fetchDbInfo}
              disabled={dbInfoLoading}
            >
              <Eye className="h-3 w-3 mr-1" />
              {dbInfoLoading ? t('common.loading') : t('cache.viewDbInfo')}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleOptimize}
              disabled={optimizeLoading || isLoading}
            >
              <Wrench className={`h-3 w-3 mr-1 ${optimizeLoading ? 'animate-spin' : ''}`} />
              {optimizeLoading ? t('cache.optimizing') : t('cache.optimizeNow')}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">{t('cache.dbMaintenanceDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Optimize Result */}
        {optimizeResult && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="text-center flex-1">
              <p className="text-sm font-bold">{optimizeResult.sizeBeforeHuman}</p>
              <p className="text-[10px] text-muted-foreground">{t('cache.sizeBefore')}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-center flex-1">
              <p className="text-sm font-bold">{optimizeResult.sizeAfterHuman}</p>
              <p className="text-[10px] text-muted-foreground">{t('cache.sizeAfter')}</p>
            </div>
            <div className="h-8 w-px bg-border shrink-0" />
            <div className="text-center flex-1">
              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                -{optimizeResult.sizeSavedHuman}
              </p>
              <p className="text-[10px] text-muted-foreground">{t('cache.sizeSaved')}</p>
            </div>
          </div>
        )}

        {/* DB Info */}
        {dbInfoLoading ? (
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : dbInfo ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-muted-foreground">{t('cache.dbSize')}</p>
              <p className="font-medium text-sm">{dbInfo.dbSizeHuman}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-muted-foreground">{t('cache.walSize')}</p>
              <p className="font-medium text-sm">{dbInfo.walSizeHuman}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-muted-foreground">{t('cache.pageCount')}</p>
              <p className="font-medium text-sm">{dbInfo.pageCount.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-muted-foreground">{t('cache.freePages')}</p>
              <p className="font-medium text-sm">{dbInfo.freelistCount.toLocaleString()}</p>
            </div>
          </div>
        ) : !optimizeResult ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            {t('cache.noDataYet')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
