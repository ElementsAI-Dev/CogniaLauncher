'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import { useLocale } from '@/components/providers/locale-provider';
import {
  HardDrive,
  Trash2,
  AlertCircle,
  FolderOpen,
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  FileText,
} from 'lucide-react';
import { useCachePage } from '@/hooks/use-cache-page';
import { PageHeader } from '@/components/layout/page-header';
import { ExternalCacheSection } from '@/components/cache/external-cache-section';
import { CacheMonitorCard } from '@/components/cache/cache-monitor-card';
import { CachePathCard } from '@/components/cache/cache-path-card';
import { CacheHealthCard } from '@/components/cache/cache-health-card';
import { CacheDbCard } from '@/components/cache/cache-db-card';
import { CacheSettingsCard } from '@/components/cache/cache-settings-card';
import { CacheHistoryCard } from '@/components/cache/cache-history-card';
import { CachePreviewDialog } from '@/components/cache/cache-preview-dialog';
import { CacheBrowserDialog } from '@/components/cache/cache-browser-dialog';

export default function CachePage() {
  const { t } = useLocale();

  const {
    cacheInfo,
    cacheVerification,
    loading,
    error,
    cogniaDir,
    operationLoading,
    cleaningType,
    settingsOpen,
    setSettingsOpen,
    localSettings,
    settingsDirty,
    useTrash,
    setUseTrash,
    previewOpen,
    setPreviewOpen,
    previewData,
    previewType,
    previewLoading,
    historyOpen,
    setHistoryOpen,
    cleanupHistory,
    historySummary,
    historyLoading,
    accessStats,
    accessStatsLoading,
    browserOpen,
    setBrowserOpen,
    browserEntries,
    browserTotalCount,
    browserLoading,
    browserDeleting,
    browserSearch,
    setBrowserSearch,
    browserTypeFilter,
    setBrowserTypeFilter,
    browserSortBy,
    setBrowserSortBy,
    browserPage,
    setBrowserPage,
    browserSelectedKeys,
    setBrowserSelectedKeys,
    hotFiles,
    forceCleanLoading,
    monitorRefreshTrigger,
    setMonitorRefreshTrigger,
    usagePercent,
    isLoading,
    isCleaning,
    isVerifying,
    isRepairing,
    isSavingSettings,
    totalIssues,
    handlePreview,
    handleEnhancedClean,
    fetchCleanupHistory,
    handleResetAccessStats,
    fetchBrowserEntries,
    handleDeleteSelectedEntries,
    handleClearHistory,
    handleRefresh,
    handleForceClean,
    handleVerify,
    handleRepair,
    handleSettingsChange,
    handleSaveSettings,
    handleOptimize,
    fetchDbInfo,
    optimizeResult,
    optimizeLoading,
    dbInfo,
    dbInfoLoading,
    fetchCacheInfo,
  } = useCachePage({ t });

  return (
    <div className="p-4 md:p-6 space-y-6" data-hint="cache-overview">
      <PageHeader
        title={t('cache.title')}
        description={t('cache.description')}
        actions={(
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handlePreview('all')}
              disabled={isLoading || previewLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isCleaning && cleaningType === 'all' ? t('cache.clearing') : t('cache.clearAll')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreview('expired')}
              disabled={isLoading || previewLoading}
            >
              <Eye className="h-4 w-4 mr-2" />
              {isCleaning && cleaningType === 'expired' ? t('cache.clearing') : t('cache.clearExpired')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isLoading || forceCleanLoading}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {forceCleanLoading ? t('cache.clearing') : t('cache.forceClean')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('cache.forceCleanConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('cache.forceCleanConfirmDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleForceClean}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('cache.forceClean')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </Button>
          </>
        )}
      />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Cache Size Warning */}
      {usagePercent >= 80 && (
        <Alert variant={usagePercent >= 90 ? 'destructive' : 'default'} className={usagePercent >= 90 ? '' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {usagePercent >= 90
              ? t('cache.warningCritical', { percent: Math.round(usagePercent) })
              : t('cache.warningHigh', { percent: Math.round(usagePercent) })
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Cache Size Monitor */}
      <CacheMonitorCard
        refreshTrigger={monitorRefreshTrigger}
        autoRefreshInterval={localSettings?.monitor_interval ?? 0}
      />

      {/* Cache Path Management */}
      <CachePathCard
        refreshTrigger={monitorRefreshTrigger}
        onPathChanged={() => {
          fetchCacheInfo();
          setMonitorRefreshTrigger(prev => prev + 1);
        }}
      />

      {/* Hit Rate Stats + Hot Files */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('cache.hitRate')}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAccessStats}
                disabled={accessStatsLoading || !accessStats}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {t('cache.resetStats')}
              </Button>
            </CardTitle>
            <CardDescription>{t('cache.hitRateDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accessStatsLoading || !accessStats ? (
              <>
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-4 w-48" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {(accessStats.hit_rate * 100).toFixed(1)}%
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {t('cache.hits')}: {accessStats.hits.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    {t('cache.misses')}: {accessStats.misses.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('cache.totalRequests')}: {accessStats.total_requests.toLocaleString()}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {t('cache.hotFiles')}
            </CardTitle>
            <CardDescription>{t('cache.hotFilesDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {hotFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('cache.noHotFiles')}</p>
            ) : (
              <div className="space-y-2">
                {hotFiles.slice(0, 3).map((file) => (
                  <div key={file.key} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1 mr-2" title={file.key}>
                      {file.key.split('/').pop() || file.key}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {file.hit_count} {t('cache.accesses')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cache Entry Browser Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setBrowserOpen(true);
            fetchBrowserEntries(true);
          }}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          {t('cache.browseEntries')}
        </Button>
      </div>

      {/* Total Size + Cache Location */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-5 w-5" />
              {t('cache.totalSize')}
            </CardTitle>
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
                  {t('cache.entries', { count: cacheInfo?.download_cache.entry_count || 0 })} {t('cache.downloadCache').toLowerCase()}, {t('cache.entries', { count: cacheInfo?.metadata_cache.entry_count || 0 })} {t('cache.metadataCache').toLowerCase()}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5" />
              {t('cache.location')}
            </CardTitle>
            <CardDescription>{t('cache.locationDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !cogniaDir ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <code className="text-sm bg-muted px-3 py-2 rounded block overflow-x-auto whitespace-nowrap">
                {cogniaDir || t('common.loading')}
              </code>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Download Cache + Default Downloads + Metadata Cache */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('cache.downloadCache')}</CardTitle>
                <CardDescription>{t('cache.downloadCacheDesc')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/cache/download">
                  <Eye className="h-4 w-4 mr-1" />
                  {t('cache.detail.entryBrowser')}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                {loading && !cacheInfo ? (
                  <>
                    <Skeleton className="h-6 w-20 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">{cacheInfo?.download_cache.size_human || '0 B'}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('cache.entries', { count: cacheInfo?.download_cache.entry_count || 0 })}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoading || (cacheInfo?.download_cache.entry_count || 0) === 0}
                  onClick={() => handlePreview('downloads')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {isCleaning && cleaningType === 'downloads' ? t('cache.clearing') : t('cache.previewAndClean')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('cache.defaultDownloads')}</CardTitle>
                <CardDescription>{t('cache.defaultDownloadsDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-start gap-3">
              <div className="space-y-1">
                {loading && !cacheInfo ? (
                  <>
                    <Skeleton className="h-6 w-20 mb-1" />
                    <Skeleton className="h-4 w-28" />
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">{cacheInfo?.default_downloads?.size_human || '0 B'}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('cache.entries', { count: cacheInfo?.default_downloads?.entry_count || 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground break-all">
                      {cacheInfo?.default_downloads?.location || t('cache.defaultDownloadsUnavailable')}
                    </p>
                    {cacheInfo?.default_downloads && !cacheInfo.default_downloads.is_available && (
                      <p className="text-xs text-destructive">
                        {t('cache.defaultDownloadsUnavailableReason', {
                          reason: cacheInfo.default_downloads.reason || 'unknown',
                        })}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={
                    isLoading
                    || !cacheInfo?.default_downloads?.is_available
                    || (cacheInfo?.default_downloads?.entry_count || 0) === 0
                  }
                  onClick={() => handlePreview('default_downloads')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {isCleaning && cleaningType === 'default_downloads' ? t('cache.clearing') : t('cache.previewAndClean')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('cache.metadataCache')}</CardTitle>
                <CardDescription>{t('cache.metadataCacheDesc')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/cache/metadata">
                  <Eye className="h-4 w-4 mr-1" />
                  {t('cache.detail.entryBrowser')}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                {loading && !cacheInfo ? (
                  <>
                    <Skeleton className="h-6 w-20 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">{cacheInfo?.metadata_cache.size_human || '0 B'}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('cache.entries', { count: cacheInfo?.metadata_cache.entry_count || 0 })}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoading || (cacheInfo?.metadata_cache.entry_count || 0) === 0}
                  onClick={() => handlePreview('metadata')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {isCleaning && cleaningType === 'metadata' ? t('cache.clearing') : t('cache.previewAndClean')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache Health */}
      <CacheHealthCard
        cacheVerification={cacheVerification}
        isLoading={isLoading}
        isVerifying={isVerifying}
        isRepairing={isRepairing}
        totalIssues={totalIssues}
        handleVerify={handleVerify}
        handleRepair={handleRepair}
      />

      {/* Database Maintenance */}
      <CacheDbCard
        dbInfo={dbInfo}
        dbInfoLoading={dbInfoLoading}
        optimizeResult={optimizeResult}
        optimizeLoading={optimizeLoading}
        isLoading={isLoading}
        fetchDbInfo={fetchDbInfo}
        handleOptimize={handleOptimize}
      />

      {/* External Tool Caches */}
      <ExternalCacheSection useTrash={useTrash} setUseTrash={setUseTrash} />

      {/* Cache Settings */}
      <CacheSettingsCard
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        localSettings={localSettings}
        settingsDirty={settingsDirty}
        loading={loading}
        isSavingSettings={isSavingSettings}
        handleSettingsChange={handleSettingsChange}
        handleSaveSettings={handleSaveSettings}
      />

      {/* Cleanup History */}
      <CacheHistoryCard
        historyOpen={historyOpen}
        setHistoryOpen={setHistoryOpen}
        cleanupHistory={cleanupHistory}
        historySummary={historySummary}
        historyLoading={historyLoading}
        fetchCleanupHistory={fetchCleanupHistory}
        handleClearHistory={handleClearHistory}
      />

      {/* Preview Dialog */}
      <CachePreviewDialog
        previewOpen={previewOpen}
        setPreviewOpen={setPreviewOpen}
        previewData={previewData}
        previewType={previewType}
        previewLoading={previewLoading}
        defaultDownloadsRoot={cacheInfo?.default_downloads?.location ?? null}
        useTrash={useTrash}
        setUseTrash={setUseTrash}
        operationLoading={operationLoading}
        handleEnhancedClean={handleEnhancedClean}
      />

      {/* Cache Entry Browser Dialog */}
      <CacheBrowserDialog
        browserOpen={browserOpen}
        setBrowserOpen={setBrowserOpen}
        browserEntries={browserEntries}
        browserTotalCount={browserTotalCount}
        browserLoading={browserLoading}
        browserDeleting={browserDeleting}
        browserSearch={browserSearch}
        setBrowserSearch={setBrowserSearch}
        browserTypeFilter={browserTypeFilter}
        setBrowserTypeFilter={setBrowserTypeFilter}
        browserSortBy={browserSortBy}
        setBrowserSortBy={setBrowserSortBy}
        browserPage={browserPage}
        setBrowserPage={setBrowserPage}
        browserSelectedKeys={browserSelectedKeys}
        setBrowserSelectedKeys={setBrowserSelectedKeys}
        useTrash={useTrash}
        setUseTrash={setUseTrash}
        fetchBrowserEntries={fetchBrowserEntries}
        handleDeleteSelectedEntries={handleDeleteSelectedEntries}
      />
    </div>
  );
}
