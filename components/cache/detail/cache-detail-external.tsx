'use client';

import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  ArrowLeft,
  Globe,
  HardDrive,
  Package,
  RefreshCw,
  Terminal,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useCacheDetailExternal } from '@/hooks/use-cache-detail-external';
import { getCategoryLabel } from '@/lib/constants/cache';

export function CacheDetailExternalView() {
  const { t } = useLocale();

  const {
    caches,
    loading,
    useTrash,
    setUseTrash,
    cleanTarget,
    setCleanTarget,
    cleanAllOpen,
    setCleanAllOpen,
    cleaning,
    totalSize,
    availableCount,
    cleanableCount,
    grouped,
    fetchExternalCaches,
    handleCleanSingle,
    handleCleanAll,
    getPathInfo,
  } = useCacheDetailExternal({ t });

  const categoryIcons: Record<string, React.ReactNode> = {
    system: <Terminal className="h-4 w-4" />,
    devtools: <Wrench className="h-4 w-4" />,
    package_manager: <Package className="h-4 w-4" />,
    other: <Globe className="h-4 w-4" />,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            {t('cache.detail.externalTitle')}
          </span>
        }
        description={t('cache.detail.externalDescription')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/cache">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('cache.detail.backToCache')}
              </Link>
            </Button>
            <Button variant="outline" onClick={fetchExternalCaches} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('cache.refreshSuccess').split(' ')[0]}
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Package className="h-4 w-4" />
              {t('cache.detail.externalProviderCount', { count: caches.length })}
            </div>
            <p className="text-2xl font-bold">{caches.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <HardDrive className="h-4 w-4" />
              {t('cache.detail.externalTotalSize')}
            </div>
            <p className="text-2xl font-bold">{formatBytes(totalSize)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              {t('cache.detail.externalAvailable')}
            </div>
            <p className="text-2xl font-bold">{availableCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Trash2 className="h-4 w-4" />
              {t('cache.detail.externalCleanable')}
            </div>
            <p className="text-2xl font-bold">{cleanableCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => setCleanAllOpen(true)}
              disabled={cleanableCount === 0 || cleaning !== null}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('cache.cleanAll')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('cache.cleanAll')}</TooltipContent>
        </Tooltip>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm">
          <Switch id="detail-external-trash" checked={useTrash} onCheckedChange={setUseTrash} />
          <Label htmlFor="detail-external-trash" className="text-muted-foreground">{t('cache.useTrash')}</Label>
        </div>
      </div>

      {/* Cache List by Category */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : caches.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <Empty className="border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Globe />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">{t('cache.noExternalCaches')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {categoryIcons[category] || categoryIcons.other}
                {getCategoryLabel(category, t)}
                <Badge variant="secondary" className="ml-2">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <Accordion type="multiple" className="space-y-2">
                  {items.map((cache) => {
                    const pathInfo = getPathInfo(cache.provider);
                    return (
                      <AccordionItem key={cache.provider} value={cache.provider} className="rounded-lg border last:border-b">
                        <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <AccordionTrigger className="p-0 hover:no-underline [&>svg]:size-4 shrink-0 h-8 w-8 items-center justify-center" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{cache.displayName}</span>
                                {cache.isAvailable ? (
                                  <Badge variant="default" className="text-xs">{t('cache.detail.externalAvailable')}</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">{t('cache.detail.externalUnavailable')}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {cache.cachePath || t('cache.managedByTool')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-sm">{cache.sizeHuman}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!cache.canClean || cleaning === cache.provider}
                                  onClick={(e) => { e.stopPropagation(); setCleanTarget(cache.provider); }}
                                >
                                  {cleaning === cache.provider ? (
                                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Trash2 className="h-3 w-3 mr-1" />
                                  )}
                                  {t('cache.clean')}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('cache.clean')}</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <AccordionContent>
                          <div className="ml-11 px-3 pb-3 p-3 rounded-lg bg-muted/30 space-y-2 text-sm">
                            {cache.cachePath && (
                              <div className="flex gap-2">
                                <span className="text-muted-foreground shrink-0">{t('cache.detail.externalCachePath')}:</span>
                                <span className="font-mono text-xs break-all">{cache.cachePath}</span>
                              </div>
                            )}
                            {pathInfo?.hasCleanCommand && pathInfo.cleanCommand && (
                              <div className="flex gap-2">
                                <span className="text-muted-foreground shrink-0">{t('cache.detail.externalCleanCmd')}:</span>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{pathInfo.cleanCommand}</code>
                              </div>
                            )}
                            {pathInfo?.envVarsChecked && pathInfo.envVarsChecked.length > 0 && (
                              <div className="flex gap-2">
                                <span className="text-muted-foreground shrink-0">{t('cache.detail.externalEnvVars')}:</span>
                                <div className="flex flex-wrap gap-1">
                                  {pathInfo.envVarsChecked.map((v) => (
                                    <code key={v} className="text-xs bg-muted px-1.5 py-0.5 rounded">{v}</code>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <span className="text-muted-foreground shrink-0">{t('cache.detail.externalCleanable')}:</span>
                              <span>{cache.canClean ? t('cache.yes') : t('cache.no')}</span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </ScrollArea>
            </CardContent>
          </Card>
        ))
      )}

      {/* Single Clean Confirm */}
      <AlertDialog open={!!cleanTarget} onOpenChange={(open) => { if (!open) setCleanTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('cache.detail.cleanConfirmTitle', {
                type: caches.find((c) => c.provider === cleanTarget)?.displayName ?? cleanTarget ?? '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {useTrash ? t('cache.useTrashDesc') : t('cache.permanentDeleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => cleanTarget && handleCleanSingle(cleanTarget)}>
              {t('cache.confirmClean')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clean All Confirm */}
      <AlertDialog open={cleanAllOpen} onOpenChange={setCleanAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cache.externalCleanAllTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cache.externalCleanAllDesc', { count: cleanableCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanAll}>
              {t('cache.confirmClean')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
