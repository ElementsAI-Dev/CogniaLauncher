'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSettings } from '@/lib/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import { HardDrive, Trash2, AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function CachePage() {
  const { cacheInfo, loading, error, fetchCacheInfo, cleanCache, cogniaDir } = useSettings();
  const { t } = useLocale();
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  useEffect(() => {
    fetchCacheInfo();
  }, [fetchCacheInfo]);

  const handleClean = async (type?: string) => {
    setCleaning(true);
    setCleanResult(null);
    try {
      const result = await cleanCache(type);
      setCleanResult(`Freed ${result.freed_human}`);
      toast.success(`Cache cleared: ${result.freed_human} freed`);
      await fetchCacheInfo();
    } catch (err) {
      toast.error(`Failed to clean cache: ${err}`);
    } finally {
      setCleaning(false);
    }
  };

  const handleRefresh = async () => {
    await fetchCacheInfo();
    toast.success('Cache info refreshed');
  };

  const maxSize = 10 * 1024 * 1024 * 1024; // 10 GB for visualization
  const usagePercent = cacheInfo ? Math.min(100, (cacheInfo.total_size / maxSize) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t('cache.title')}</h1>
          <p className="text-muted-foreground">{t('cache.description')}</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cleanResult && (
        <Alert>
          <AlertDescription>{cleanResult}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              {t('cache.totalSize')}
            </CardTitle>
            <CardDescription>{t('cache.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && !cacheInfo ? (
              <>
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-48" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{cacheInfo?.total_size_human || '0 B'}</div>
                <Progress value={usagePercent} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {cacheInfo?.download_cache.entry_count || 0} downloads, {cacheInfo?.metadata_cache.entry_count || 0} metadata entries
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Cache Location
            </CardTitle>
            <CardDescription>Where cache files are stored</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="text-sm bg-muted px-2 py-1 rounded block overflow-x-auto">
              {cogniaDir || 'Loading...'}
            </code>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('cache.downloadCache')}</CardTitle>
            <CardDescription>{t('cache.downloadCacheDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{cacheInfo?.download_cache.size_human || '0 B'}</p>
                <p className="text-sm text-muted-foreground">{t('cache.entries', { count: cacheInfo?.download_cache.entry_count || 0 })}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClean('downloads')}
                disabled={cleaning || loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('cache.clearCache')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('cache.metadataCache')}</CardTitle>
            <CardDescription>{t('cache.metadataCacheDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{cacheInfo?.metadata_cache.size_human || '0 B'}</p>
                <p className="text-sm text-muted-foreground">{t('cache.entries', { count: cacheInfo?.metadata_cache.entry_count || 0 })}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClean('metadata')}
                disabled={cleaning || loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('cache.clearCache')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cache.clearAll')}</CardTitle>
          <CardDescription>{t('cache.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={cleaning || loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {cleaning ? t('cache.clearing') : t('cache.clearAll')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('cache.clearAll')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('cache.noCacheData')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleClean('all')}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('cache.clearAll')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
