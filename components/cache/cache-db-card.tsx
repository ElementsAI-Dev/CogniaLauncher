'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HardDrive, Eye, Wrench, ChevronDown } from 'lucide-react';
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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            <CardTitle className="text-base">{t('cache.optimize')}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fetchDbInfo(); }}
              disabled={dbInfoLoading}
            >
              <Eye className="h-4 w-4 mr-2" />
              {dbInfoLoading ? t('common.loading') : t('cache.dbInfo')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleOptimize}
              disabled={optimizeLoading || isLoading}
            >
              <Wrench className={`h-4 w-4 mr-2 ${optimizeLoading ? 'animate-spin' : ''}`} />
              {optimizeLoading ? t('cache.optimizing') : t('cache.optimize')}
            </Button>
          </div>
        </div>
        <CardDescription>{t('cache.optimizeDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {optimizeResult && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-bold">{optimizeResult.sizeBeforeHuman}</p>
                <p className="text-xs text-muted-foreground">{t('cache.sizeBefore')}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-bold">{optimizeResult.sizeAfterHuman}</p>
                <p className="text-xs text-muted-foreground">{t('cache.sizeAfter')}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <p className="text-sm font-bold text-green-600 dark:text-green-400">{optimizeResult.sizeSavedHuman}</p>
                <p className="text-xs text-muted-foreground">{t('cache.sizeSaved')}</p>
              </div>
            </div>
          )}
          {dbInfo && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  {t('cache.dbInfo')}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('cache.dbSize')}</p>
                    <p className="font-medium">{dbInfo.dbSizeHuman}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('cache.walSize')}</p>
                    <p className="font-medium">{dbInfo.walSizeHuman}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('cache.pageCount')}</p>
                    <p className="font-medium">{dbInfo.pageCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('cache.freePages')}</p>
                    <p className="font-medium">{dbInfo.freelistCount.toLocaleString()}</p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
