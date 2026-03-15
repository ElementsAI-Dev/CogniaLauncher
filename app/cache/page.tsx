'use client';

import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Trash2,
  AlertCircle,
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  FileText,
  LayoutDashboard,
  Database,
  FolderOpen,
  History,
} from 'lucide-react';
import { useCachePage } from '@/hooks/use-cache-page';
import { PageHeader } from '@/components/layout/page-header';
import { CacheStatsStrip } from '@/components/cache/cache-stats-strip';
import { CacheTypesSection } from '@/components/cache/cache-types-section';
import { CacheBrowserPanel } from '@/components/cache/cache-browser-panel';
import { CacheSidebar } from '@/components/cache/cache-sidebar';
import { ExternalCacheSection } from '@/components/cache/external-cache-section';
import { CacheMonitorCard } from '@/components/cache/cache-monitor-card';
import { CacheHealthCard } from '@/components/cache/cache-health-card';
import { CacheDbCard } from '@/components/cache/cache-db-card';
import { CacheHistoryCard } from '@/components/cache/cache-history-card';
import { CachePreviewDialog } from '@/components/cache/cache-preview-dialog';
import {
  DashboardClickableRow,
  DashboardStatusBadge,
} from '@/components/dashboard/dashboard-primitives';

export default function CachePage() {
  const { t } = useLocale();

  const {
    cacheInfo,
    cacheVerification,
    loading,
    error,
    activeTab,
    setActiveTab,
    operationLoading,
    cleaningType,
    localSettings,
    settingsDirty,
    useTrash,
    setUseTrash,
    previewOpen,
    setPreviewOpen,
    previewData,
    previewType,
    previewLoading,
    cleanupHistory,
    historySummary,
    historyLoading,
    historyReadState,
    accessStats,
    accessStatsLoading,
    accessStatsReadState,
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
    browserReadState,
    hotFiles,
    hotFilesReadState,
    monitorSnapshot,
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
    retryHistory,
    handleResetAccessStats,
    retryAccessStats,
    retryHotFiles,
    fetchBrowserEntries,
    retryBrowser,
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
    overviewInsights,
  } = useCachePage({ t });

  // Fetch browser entries when switching to entries tab
  useEffect(() => {
    if (activeTab === 'entries') {
      fetchBrowserEntries(true);
    }
  }, [activeTab, fetchBrowserEntries]);

  // Fetch cleanup history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      fetchCleanupHistory();
    }
  }, [activeTab, fetchCleanupHistory]);

  const totalEntries = cacheInfo
    ? cacheInfo.download_cache.entry_count
      + cacheInfo.metadata_cache.entry_count
      + (cacheInfo.default_downloads?.entry_count ?? 0)
    : null;

  const handleOverviewAction = (action: typeof overviewInsights.primaryAction) => {
    if (action.targetTab !== activeTab) {
      flushSync(() => {
        setActiveTab(action.targetTab);
      });
    } else {
      setActiveTab(action.targetTab);
    }

    const targetId = action.targetId;
    if (!targetId) return;
    const scrollToTarget = () => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    };
    setTimeout(scrollToTarget, 0);
  };

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

      {/* Stats Strip */}
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2" id="cache-tab-overview">
            <LayoutDashboard className="h-4 w-4" />
            {t('cache.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="entries" className="gap-2" id="cache-tab-entries">
            <Database className="h-4 w-4" />
            {t('cache.tabEntries')}
            {totalEntries !== null && (
              <span className="text-xs text-muted-foreground">({totalEntries})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="external" className="gap-2" id="cache-tab-external">
            <FolderOpen className="h-4 w-4" />
            {t('cache.tabExternal')}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" id="cache-tab-history">
            <History className="h-4 w-4" />
            {t('cache.tabHistory')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <section className="space-y-3" id="cache-summary">
            <div>
              <h2 className="text-sm font-medium">{t('cache.insightSummaryTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('cache.insightSummaryDesc')}</p>
            </div>
            <CacheStatsStrip
              totalSizeHuman={cacheInfo?.total_size_human ?? null}
              usagePercent={usagePercent}
              totalEntries={totalEntries}
              diskAvailableHuman={monitorSnapshot?.diskAvailableHuman ?? null}
              freshness={overviewInsights.freshness}
              scopeSummaries={overviewInsights.scopeSummaries}
              loading={loading && !cacheInfo}
            />
          </section>

          <section className="space-y-3" id="cache-signals">
            <div>
              <h2 className="text-sm font-medium">{t('cache.insightSignalsTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('cache.insightSignalsDesc')}</p>
            </div>
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
                  {accessStatsReadState.status === 'error' ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{accessStatsReadState.error}</span>
                        <Button variant="outline" size="sm" onClick={retryAccessStats}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {t('common.retry')}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : accessStatsLoading || !accessStats ? (
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
                  {hotFilesReadState.status === 'error' ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{hotFilesReadState.error}</span>
                        <Button variant="outline" size="sm" onClick={retryHotFiles}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {t('common.retry')}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : hotFiles.length === 0 ? (
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

            <div id="cache-monitor">
              <CacheMonitorCard
                refreshTrigger={monitorRefreshTrigger}
                autoRefreshInterval={localSettings?.monitor_interval ?? 0}
              />
            </div>
          </section>

          <section className="space-y-3" id="cache-actions">
            <div>
              <h2 className="text-sm font-medium">{t('cache.insightActionsTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('cache.insightActionsDesc')}</p>
            </div>
            <Card>
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('cache.insightPrimaryActionLabel')}
                    </p>
                    <DashboardStatusBadge tone={overviewInsights.primaryAction.tone}>
                      {t(overviewInsights.primaryAction.titleKey)}
                    </DashboardStatusBadge>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">
                      {t(overviewInsights.primaryAction.titleKey)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(overviewInsights.primaryAction.descriptionKey)}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleOverviewAction(overviewInsights.primaryAction)}
                    data-testid={`overview-action-${overviewInsights.primaryAction.id}`}
                  >
                    {t(overviewInsights.primaryAction.ctaKey)}
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('cache.insightSecondaryActionsLabel')}
                  </p>
                  {overviewInsights.secondaryActions.slice(0, 4).map((action) => (
                    <DashboardClickableRow
                      key={action.id}
                      onClick={() => handleOverviewAction(action)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t(action.titleKey)}</span>
                          <DashboardStatusBadge tone={action.tone}>
                            {t(action.ctaKey)}
                          </DashboardStatusBadge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t(action.descriptionKey)}
                        </p>
                      </div>
                    </DashboardClickableRow>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3" id="cache-detail-band">
            <div>
              <h2 className="text-sm font-medium">{t('cache.insightDetailsTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('cache.insightDetailsDesc')}</p>
            </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            {/* Left: main content */}
            <div className="space-y-6 min-w-0">
              {/* Cache Type Cards */}
              <div id="cache-types">
                <CacheTypesSection
                  cacheInfo={cacheInfo}
                  loading={loading && !cacheInfo}
                  isCleaning={isCleaning}
                  cleaningType={cleaningType}
                  onPreview={handlePreview}
                  previewLoading={previewLoading}
                />
              </div>

              {/* Cache Health */}
              <div id="cache-health">
                <CacheHealthCard
                  cacheVerification={cacheVerification}
                  isLoading={isLoading}
                  isVerifying={isVerifying}
                  isRepairing={isRepairing}
                  totalIssues={totalIssues}
                  handleVerify={handleVerify}
                  handleRepair={handleRepair}
                />
              </div>

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
            </div>

            {/* Right: sticky sidebar */}
            <div className="sticky top-6 self-start">
              <CacheSidebar
                localSettings={localSettings}
                settingsDirty={settingsDirty}
                settingsLoading={loading}
                isSavingSettings={isSavingSettings}
                handleSettingsChange={handleSettingsChange}
                handleSaveSettings={handleSaveSettings}
                pathRefreshTrigger={monitorRefreshTrigger}
                onPathChanged={() => {
                  fetchCacheInfo();
                  setMonitorRefreshTrigger((prev: number) => prev + 1);
                }}
              />
            </div>
          </div>
          </section>
        </TabsContent>

        {/* Entries Tab */}
        <TabsContent value="entries" className="space-y-6">
          <CacheBrowserPanel
            entries={browserEntries}
            totalCount={browserTotalCount}
            loading={browserLoading}
            deleting={browserDeleting}
            search={browserSearch}
            onSearchChange={setBrowserSearch}
            typeFilter={browserTypeFilter}
            onTypeFilterChange={setBrowserTypeFilter}
            sortBy={browserSortBy}
            onSortByChange={setBrowserSortBy}
            page={browserPage}
            onPageChange={setBrowserPage}
            selectedKeys={browserSelectedKeys}
            onSelectedKeysChange={setBrowserSelectedKeys}
            error={browserReadState.error}
            useTrash={useTrash}
            onUseTrashChange={setUseTrash}
            onFetchEntries={fetchBrowserEntries}
            onRetry={retryBrowser}
            onDeleteSelected={handleDeleteSelectedEntries}
          />
        </TabsContent>

        {/* External Caches Tab */}
        <TabsContent value="external" className="space-y-6">
          <ExternalCacheSection useTrash={useTrash} setUseTrash={setUseTrash} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <CacheHistoryCard
            cleanupHistory={cleanupHistory}
            historySummary={historySummary}
            historyLoading={historyLoading}
            historyError={historyReadState.error}
            fetchCleanupHistory={fetchCleanupHistory}
            handleRetryHistory={retryHistory}
            handleClearHistory={handleClearHistory}
          />
        </TabsContent>
      </Tabs>

      {/* Preview Dialog (shared) */}
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
    </div>
  );
}
