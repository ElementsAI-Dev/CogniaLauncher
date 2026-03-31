'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  ArrowLeft,
  Copy,
  Globe,
  HardDrive,
  Package,
  RefreshCw,
  AlertCircle,
  Terminal,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useCacheDetailExternal } from '@/hooks/cache/use-cache-detail-external';
import { getCategoryLabel } from '@/lib/constants/cache';
import { deriveExternalCacheMaintenanceMetadata } from '@/lib/cache/maintenance';
import { buildExternalCacheDetailHref } from '@/lib/cache/scopes';
import type { ExternalCacheCleanResult } from '@/lib/tauri';
import { writeClipboard } from '@/lib/clipboard';

interface CacheDetailExternalViewProps {
  targetId?: string | null;
  targetType?: 'external' | 'custom' | null;
}

export function CacheDetailExternalView({
  targetId = null,
  targetType = null,
}: CacheDetailExternalViewProps = {}) {
  const { t } = useLocale();
  const [resultOpen, setResultOpen] = useState(false);
  const [resultTitle, setResultTitle] = useState('');
  const [resultRows, setResultRows] = useState<ExternalCacheCleanResult[]>([]);
  const [expandedProviders, setExpandedProviders] = useState<string[]>([]);

  const {
    caches,
    loading,
    readState,
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
    orderedCategories,
    fetchExternalCaches,
    handleCleanSingle,
    handleCleanAll,
    getPathInfo,
  } = useCacheDetailExternal({ t });

  const diagHintKeyByReason: Record<string, string> = {
    probe_timeout: 'cache.externalDiag.probe_timeout',
    probe_failed: 'cache.externalDiag.probe_failed',
    path_unreadable: 'cache.externalDiag.path_unreadable',
    provider_unavailable: 'cache.externalDiag.provider_unavailable',
    legacy_skipped: 'cache.externalDiag.legacy_skipped',
  };

  const showResults = (title: string, rows: ExternalCacheCleanResult[]) => {
    setResultTitle(title);
    setResultRows(rows);
    setResultOpen(true);
  };

  const handleCleanSingleWithReport = async (provider: string) => {
    const res = await handleCleanSingle(provider);
    if (res && !res.success) {
      showResults(t('cache.externalCleanResultTitle'), [res]);
    }
  };

  const handleCleanAllWithReport = async () => {
    const res = await handleCleanAll();
    if (res.some((r) => !r.success)) {
      showResults(t('cache.externalCleanAllResultTitle'), res);
    }
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    system: <Terminal className="h-4 w-4" />,
    devtools: <Wrench className="h-4 w-4" />,
    package_manager: <Package className="h-4 w-4" />,
    other: <Globe className="h-4 w-4" />,
  };

  const getStateBadge = (cache: (typeof caches)[number]) => {
    const state = cache.detectionState ?? (cache.isAvailable ? 'found' : 'unavailable');
    switch (state) {
      case 'error':
        return { label: t('cache.detail.externalError'), variant: 'destructive' as const };
      case 'skipped':
        return { label: t('cache.detail.externalSkipped'), variant: 'secondary' as const };
      case 'unavailable':
        return { label: t('cache.detail.externalUnavailable'), variant: 'secondary' as const };
      default:
        return { label: t('cache.detail.externalAvailable'), variant: 'default' as const };
    }
  };

  const targetExists = targetId
    ? caches.some((cache) => cache.provider === targetId)
    : false;
  const missingTarget =
    !loading && targetId && caches.length > 0 && !targetExists ? targetId : null;
  const activeExpandedProviders =
    targetId && targetExists && !expandedProviders.includes(targetId)
      ? [...expandedProviders, targetId]
      : expandedProviders;

  const updateExpandedForCategory = (category: string, values: string[]) => {
    const categoryProviders = grouped[category]?.map((cache) => cache.provider) ?? [];
    setExpandedProviders((prev) => {
      const remaining = prev.filter((value) => !categoryProviders.includes(value));
      return [...remaining, ...values];
    });
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
              {t('common.refresh')}
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

      {readState.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{readState.error}</span>
            <Button variant="outline" size="sm" onClick={fetchExternalCaches}>
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {missingTarget && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('cache.detail.externalTargetMissing', { target: missingTarget })}
          </AlertDescription>
        </Alert>
      )}

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
        orderedCategories.map((category) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {categoryIcons[category] || categoryIcons.other}
                {getCategoryLabel(category, t)}
                <Badge variant="secondary" className="ml-2">{grouped[category].length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <Accordion
                  type="multiple"
                  className="space-y-2"
                  value={activeExpandedProviders.filter((provider) =>
                    grouped[category].some((cache) => cache.provider === provider),
                  )}
                  onValueChange={(values) => updateExpandedForCategory(category, values)}
                >
                  {grouped[category].map((cache) => {
                    const pathInfo = getPathInfo(cache.provider);
                    const stateBadge = getStateBadge(cache);
                    const maintenance = deriveExternalCacheMaintenanceMetadata(cache, pathInfo);
                    const isTargeted = targetId === cache.provider;
                    return (
                      <AccordionItem
                        key={cache.provider}
                        value={cache.provider}
                        className={`rounded-lg border last:border-b ${isTargeted ? 'border-primary' : ''}`}
                      >
                        <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <AccordionTrigger className="p-0 hover:no-underline [&>svg]:size-4 shrink-0 h-8 w-8 items-center justify-center" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{cache.displayName}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {cache.isCustom ? t('cache.detail.customScope') : t('cache.detail.externalScope')}
                                </Badge>
                                <Badge variant={stateBadge.variant} className="text-xs">
                                  {stateBadge.label}
                                </Badge>
                                {isTargeted && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {targetType === 'custom'
                                      ? t('cache.detail.customScope')
                                      : t('cache.detail.externalScope')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {cache.cachePath || t('cache.managedByTool')}
                              </p>
                              {(cache.detectionReason || cache.detectionError) && (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {cache.detectionReason && diagHintKeyByReason[cache.detectionReason]
                                    ? t(diagHintKeyByReason[cache.detectionReason])
                                    : cache.detectionReason || cache.detectionError}
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {t(maintenance.explanationKey)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-sm">{cache.sizePending ? (<Skeleton className="h-3 w-12 inline-block" />) : cache.sizeHuman}</span>
                            <Link
                              href={buildExternalCacheDetailHref(
                                cache.provider,
                                cache.isCustom ? 'custom' : 'external',
                              )}
                              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                            >
                              {t('cache.viewDetails')}
                            </Link>
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
                            <div className="flex gap-2">
                              <span className="text-muted-foreground shrink-0">{t('cache.detail.externalDetectionState')}:</span>
                              <span>{stateBadge.label}</span>
                            </div>
                            {cache.detectionReason && (
                              <div className="flex gap-2">
                                <span className="text-muted-foreground shrink-0">{t('cache.detail.externalDetectionReason')}:</span>
                                <span className="font-mono text-xs break-all">{cache.detectionReason}</span>
                              </div>
                            )}
                            {cache.detectionError && (
                              <div className="flex gap-2">
                                <span className="text-muted-foreground shrink-0">{t('cache.detail.externalDetectionError')}:</span>
                                <span className="font-mono text-xs break-all text-destructive">{cache.detectionError}</span>
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
                            <div className="flex gap-2">
                              <span className="text-muted-foreground shrink-0">{t('cache.detail.externalMaintenanceMode')}:</span>
                              <span>{t(maintenance.explanationKey)}</span>
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
            <AlertDialogAction onClick={() => cleanTarget && handleCleanSingleWithReport(cleanTarget)}>
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
            <AlertDialogAction onClick={handleCleanAllWithReport}>
              {t('cache.confirmClean')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{resultTitle}</DialogTitle>
            <DialogDescription>{t('cache.externalCleanResultDesc')}</DialogDescription>
          </DialogHeader>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cache.externalProvider')}</TableHead>
                  <TableHead>{t('cache.status')}</TableHead>
                  <TableHead>{t('cache.freedSize')}</TableHead>
                  <TableHead>{t('cache.error')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultRows.map((r) => (
                  <TableRow key={r.provider}>
                    <TableCell className="font-medium">
                      <Link
                        href={buildExternalCacheDetailHref(
                          r.provider,
                          caches.find((cache) => cache.provider === r.provider)?.isCustom
                            ? 'custom'
                            : 'external',
                        )}
                        className="underline-offset-4 hover:underline"
                      >
                        {r.displayName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.success ? 'default' : 'destructive'}>
                        {r.success ? t('cache.success') : t('cache.failed')}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.freedHuman}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.error ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResultOpen(false)}>{t('common.close')}</Button>
            <Button
              variant="outline"
              onClick={async () => {
                await writeClipboard(JSON.stringify(resultRows, null, 2));
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              {t('cache.copyJson')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
