'use client';

import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  ArrowLeft,
  FileText,
  FolderDown,
  HardDrive,
  Inbox,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useDefaultDownloadsDetail } from '@/hooks/use-default-downloads-detail';
import { deriveCleanTypeMaintenanceMetadata } from '@/lib/cache/maintenance';

export function CacheDetailDefaultDownloadsView() {
  const { t } = useLocale();
  const {
    defaultDownloads,
    previewData,
    readState,
    useTrash,
    setUseTrash,
    cleaning,
    cleanResult,
    handleRefresh,
    handleClean,
  } = useDefaultDownloadsDetail({ t });

  const maintenance = deriveCleanTypeMaintenanceMetadata('default_downloads', {
    defaultDownloadsRoot: defaultDownloads?.location ?? null,
  });

  const deletedCount = cleanResult?.file_outcomes?.filter(
    (outcome) => outcome.outcome === 'deleted',
  ).length ?? cleanResult?.deleted_count ?? 0;
  const skippedCount = cleanResult?.file_outcomes?.filter(
    (outcome) => outcome.outcome === 'skipped',
  ).length ?? cleanResult?.skipped_count ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FolderDown className="h-5 w-5 text-primary" />
            </div>
            {t('cache.defaultDownloads')}
          </span>
        }
        description={t('cache.defaultDownloadsDesc')}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/cache">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('cache.detail.backToCache')}
              </Link>
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.refresh')}
            </Button>
          </div>
        )}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {defaultDownloads ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  {t('cache.detail.entryCount', { count: defaultDownloads.entry_count })}
                </div>
                <p className="text-2xl font-bold">{defaultDownloads.entry_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <HardDrive className="h-4 w-4" />
                  {t('cache.detail.totalSize')}
                </div>
                <p className="text-2xl font-bold">{defaultDownloads.size_human}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <ShieldAlert className="h-4 w-4" />
                  {t('cache.insightCoverageLabel')}
                </div>
                <p className="text-2xl font-bold">
                  {defaultDownloads.is_available
                    ? t('cache.insightStatusAvailable')
                    : t('cache.insightStatusUnavailable')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">
                  {t('cache.defaultDownloadsRoot')}
                </div>
                <p className="text-sm font-mono break-all">
                  {defaultDownloads.location ?? '—'}
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={handleClean}
          disabled={cleaning || !defaultDownloads?.is_available}
        >
          {cleaning ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          {cleaning ? t('cache.clearing') : t('cache.detail.cleanThisCache')}
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm">
          <Switch id="default-downloads-use-trash" checked={useTrash} onCheckedChange={setUseTrash} />
          <Label htmlFor="default-downloads-use-trash" className="text-muted-foreground">
            {t('cache.useTrash')}
          </Label>
        </div>
      </div>

      {readState.error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{readState.error}</span>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('cache.defaultDownloadsRoot')}</CardTitle>
          <CardDescription>{t(maintenance.explanationKey)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {defaultDownloads?.is_available ? (
            <p className="font-mono text-sm break-all">{defaultDownloads.location}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('cache.defaultDownloadsUnavailable')}</p>
              {defaultDownloads?.reason && (
                <p className="text-xs text-muted-foreground">
                  {t('cache.defaultDownloadsUnavailableReason', {
                    reason: defaultDownloads.reason,
                  })}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {cleanResult && (
        <Alert>
          <Trash2 className="h-4 w-4" />
          <AlertTitle>{t('cache.detail.defaultDownloadsResultTitle')}</AlertTitle>
          <AlertDescription className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t('cache.detail.defaultDownloadsDeletedCount')}: {deletedCount}
              </Badge>
              <Badge variant="secondary">
                {t('cache.detail.defaultDownloadsSkippedCount')}: {skippedCount}
              </Badge>
              <Badge variant="secondary">
                {t('cache.freedSize')}: {cleanResult.freed_human}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('cache.defaultDownloadsSafetyNote')}
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('cache.detail.defaultDownloadsCandidatesTitle')}</CardTitle>
          <CardDescription>{t('cache.detail.defaultDownloadsCandidatesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {readState.status === 'loading' && !previewData ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : previewData?.files.length ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{t('cache.filesToClean')}</p>
                  <p className="text-2xl font-bold">{previewData.total_count}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{t('cache.spaceToFree')}</p>
                  <p className="text-2xl font-bold">{previewData.total_size_human}</p>
                </div>
              </div>
              <div className="rounded-md border overflow-hidden">
                <ScrollArea className="h-56">
                  <div className="divide-y">
                    {previewData.files.map((file, index) => (
                      <div key={`${file.path}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="truncate" title={file.path}>
                          {file.path.split(/[/\\]/).pop() ?? file.path}
                        </span>
                        <Badge variant="outline">{file.size_human}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <Empty className="border-none py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t('cache.noFilesToClean')}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}

          {(previewData?.skipped_count ?? 0) > 0 && previewData?.skipped && (
            <div className="rounded-md border overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
                {t('cache.skippedFiles', { count: previewData.skipped_count ?? previewData.skipped.length })}
              </div>
              <div className="divide-y">
                {previewData.skipped.map((item, index) => (
                  <div key={`${item.path}-${index}`} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                    <span className="font-mono break-all flex-1">{item.path}</span>
                    <Badge variant="secondary">{item.reason}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
