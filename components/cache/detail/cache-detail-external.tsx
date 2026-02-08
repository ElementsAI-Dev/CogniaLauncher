'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ArrowLeft,
  ChevronDown,
  Globe,
  HardDrive,
  Package,
  RefreshCw,
  Terminal,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type { ExternalCacheInfo, ExternalCachePathInfo } from '@/lib/tauri';

export function CacheDetailExternalView() {
  const { t } = useLocale();
  const initializedRef = useRef(false);

  const [caches, setCaches] = useState<ExternalCacheInfo[]>([]);
  const [pathInfos, setPathInfos] = useState<ExternalCachePathInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [useTrash, setUseTrash] = useState(true);
  const [cleanTarget, setCleanTarget] = useState<string | null>(null);
  const [cleanAllOpen, setCleanAllOpen] = useState(false);
  const [cleaning, setCleaning] = useState<string | null>(null);

  const fetchExternalCaches = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const { discoverExternalCaches, getExternalCachePaths } = await import('@/lib/tauri');
      const [discovered, paths] = await Promise.all([
        discoverExternalCaches(),
        getExternalCachePaths(),
      ]);
      setCaches(discovered);
      setPathInfos(paths);
    } catch (err) {
      console.error('Failed to fetch external caches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchExternalCaches();
    }
  }, [fetchExternalCaches]);

  // Computed
  const totalSize = caches.reduce((acc, c) => acc + c.size, 0);
  const availableCount = caches.filter((c) => c.isAvailable).length;
  const cleanableCount = caches.filter((c) => c.canClean).length;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  // Group caches by category
  const grouped = caches.reduce<Record<string, ExternalCacheInfo[]>>((acc, cache) => {
    const cat = cache.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cache);
    return acc;
  }, {});

  const categoryIcons: Record<string, React.ReactNode> = {
    system: <Terminal className="h-4 w-4" />,
    devtools: <Wrench className="h-4 w-4" />,
    package_manager: <Package className="h-4 w-4" />,
    other: <Globe className="h-4 w-4" />,
  };

  const categoryLabels: Record<string, string> = {
    system: t('cache.categorySystem'),
    devtools: t('cache.categoryDevtools'),
    package_manager: t('cache.categoryPackageManager'),
    other: 'Other',
  };

  // Actions
  const handleCleanSingle = async (provider: string) => {
    if (!isTauri()) return;
    setCleaning(provider);
    try {
      const { cleanExternalCache } = await import('@/lib/tauri');
      const result = await cleanExternalCache(provider, useTrash);
      if (result.success) {
        toast.success(t('cache.externalCleanSuccess', {
          provider: result.displayName,
          size: result.freedHuman,
        }));
      } else {
        toast.error(t('cache.externalCleanFailed', {
          provider: result.displayName,
          error: result.error || 'Unknown error',
        }));
      }
      await fetchExternalCaches();
    } catch (err) {
      toast.error(`Clean failed: ${err}`);
    } finally {
      setCleaning(null);
      setCleanTarget(null);
    }
  };

  const handleCleanAll = async () => {
    if (!isTauri()) return;
    setCleaning('all');
    try {
      const { cleanAllExternalCaches } = await import('@/lib/tauri');
      const results = await cleanAllExternalCaches(useTrash);
      const successCount = results.filter((r) => r.success).length;
      const totalFreed = results.reduce((acc, r) => acc + r.freedBytes, 0);
      if (successCount === results.length) {
        toast.success(t('cache.externalCleanAllSuccess', {
          count: successCount,
          size: formatSize(totalFreed),
        }));
      } else if (successCount > 0) {
        toast.warning(t('cache.externalCleanAllPartial', {
          success: successCount,
          total: results.length,
        }));
      } else {
        toast.error(t('cache.externalCleanAllFailed'));
      }
      await fetchExternalCaches();
    } catch (err) {
      toast.error(`Clean all failed: ${err}`);
    } finally {
      setCleaning(null);
      setCleanAllOpen(false);
    }
  };

  const getPathInfo = (provider: string) =>
    pathInfos.find((p) => p.provider === provider);

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
            <p className="text-2xl font-bold">{formatSize(totalSize)}</p>
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
        <Button
          variant="outline"
          onClick={() => setCleanAllOpen(true)}
          disabled={cleanableCount === 0 || cleaning !== null}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t('cache.cleanAll')}
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm">
          <Switch checked={useTrash} onCheckedChange={setUseTrash} />
          <span className="text-muted-foreground">{t('cache.useTrash')}</span>
        </div>
      </div>

      {/* Cache List by Category */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin inline-block mr-2" />
            Loading...
          </CardContent>
        </Card>
      ) : caches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('cache.noExternalCaches')}
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {categoryIcons[category] || categoryIcons.other}
                {categoryLabels[category] || category}
                <Badge variant="secondary" className="ml-2">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-2">
                  {items.map((cache) => {
                    const pathInfo = getPathInfo(cache.provider);
                    return (
                      <Collapsible key={cache.provider}>
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                              </Button>
                            </CollapsibleTrigger>
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
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!cache.canClean || cleaning === cache.provider}
                              onClick={() => setCleanTarget(cache.provider)}
                            >
                              {cleaning === cache.provider ? (
                                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Trash2 className="h-3 w-3 mr-1" />
                              )}
                              {t('cache.clean')}
                            </Button>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="ml-11 mt-2 mb-3 p-3 rounded-lg bg-muted/30 space-y-2 text-sm">
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
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
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
