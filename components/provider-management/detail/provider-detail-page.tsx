'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageLoadingSkeleton } from '@/components/layout/page-loading-skeleton';
import {
  ProviderDetailHeader,
  ProviderOverviewTab,
  ProviderPackagesTab,
  ProviderUpdatesTab,
  ProviderHealthTab,
  ProviderHistoryTab,
  ProviderEnvironmentTab,
} from '@/components/provider-management/detail';
import { useProviderDetail } from '@/hooks/providers/use-provider-detail';
import { useLocale } from '@/components/providers/locale-provider';
import {
  AlertCircle,
  LayoutDashboard,
  Package,
  ArrowUpCircle,
  ShieldCheck,
  History,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProviderDetailPageClientProps {
  providerId: string;
}

export function ProviderDetailPageClient({ providerId }: ProviderDetailPageClientProps) {
  const { t } = useLocale();

  const {
    provider,
    isAvailable,
    providerStatusInfo,
    loading,
    error,
    installedPackages,
    loadingPackages,
    searchResults,
    searchQuery,
    loadingSearch,
    availableUpdates,
    loadingUpdates,
    healthResult,
    loadingHealth,
    activeRemediationId,
    installHistory,
    loadingHistory,
    historyError,
    pinnedPackages,
    preflightSummary,
    preflightPackages,
    isPreflightOpen,
    environmentInfo,
    environmentProviderInfo,
    availableVersions,
    loadingEnvironment,
    initialize,
    refreshAll,
    refreshPackageSurface,
    checkAvailability,
    toggleProvider,
    setProviderPriority,
    searchPackages,
    installPackage,
    uninstallPackage,
    batchUninstallPackages,
    pinPackage,
    unpinPackage,
    rollbackToLastVersion,
    checkUpdates,
    updatePackage,
    updateAllPackages,
    runHealthCheck,
    previewHealthRemediation,
    applyHealthRemediation,
    fetchHistory,
    fetchEnvironmentInfo,
    confirmPreflight,
    dismissPreflight,
  } = useProviderDetail(providerId);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [isToggling, setIsToggling] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSavingPriority, setIsSavingPriority] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleToggle = useCallback(async (enabled: boolean) => {
    setIsToggling(true);
    try {
      await toggleProvider(enabled);
      toast.success(
        enabled
          ? t('providers.enableSuccess', { name: providerId })
          : t('providers.disableSuccess', { name: providerId }),
      );
    } catch {
      toast.error(
        enabled
          ? t('providers.enableError', { name: providerId })
          : t('providers.disableError', { name: providerId }),
      );
    } finally {
      setIsToggling(false);
    }
  }, [toggleProvider, providerId, t]);

  const handleCheckStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const available = await checkAvailability();
      if (available) {
        toast.success(t('providers.checkSuccess', { name: providerId }));
      } else {
        toast.warning(t('providers.checkFailed', { name: providerId }));
      }
    } catch {
      toast.error(t('providers.checkError', { name: providerId }));
    } finally {
      setIsCheckingStatus(false);
    }
  }, [checkAvailability, providerId, t]);

  const handleRefresh = useCallback(async () => {
    await refreshAll();
    toast.success(t('providerDetail.refreshed'));
  }, [refreshAll, t]);

  const handlePrioritySave = useCallback(async (priority: number) => {
    setIsSavingPriority(true);
    try {
      await setProviderPriority(priority);
      toast.success(t('providerDetail.prioritySaved'));
    } catch {
      toast.error(t('providerDetail.prioritySaveError'));
    } finally {
      setIsSavingPriority(false);
    }
  }, [setProviderPriority, t]);

  const handleViewPackageDetails = useCallback((name: string) => {
    router.push(`/packages/detail?name=${encodeURIComponent(name)}&provider=${encodeURIComponent(providerId)}`);
  }, [router, providerId]);

  const providersHref = (() => {
    const from = searchParams.get('from');
    return from && from.startsWith('/providers') ? from : '/providers';
  })();

  // Loading state
  if (loading && !provider) {
    return <PageLoadingSkeleton variant="detail" />;
  }

  // Error state
  if (error && !provider) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!provider) return null;

  const isEnvironmentProvider = provider.is_environment_provider;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ProviderDetailHeader
        provider={provider}
        isAvailable={isAvailable}
        statusInfo={providerStatusInfo}
        isToggling={isToggling}
        isCheckingStatus={isCheckingStatus}
        providersHref={providersHref}
        onToggle={handleToggle}
        onCheckStatus={handleCheckStatus}
        onRefresh={handleRefresh}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="h-4 w-4" />
            {t('providerDetail.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-1.5">
            <Package className="h-4 w-4" />
            {t('providerDetail.tabPackages')}
            {installedPackages.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                {installedPackages.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="updates" className="gap-1.5">
            <ArrowUpCircle className="h-4 w-4" />
            {t('providerDetail.tabUpdates')}
            {availableUpdates.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5 bg-orange-500/20 text-orange-700 dark:text-orange-300">
                {availableUpdates.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            {t('providerDetail.tabHealth')}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            {t('providerDetail.tabHistory')}
            {installHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                {installHistory.length}
              </Badge>
            )}
          </TabsTrigger>
          {isEnvironmentProvider && (
            <TabsTrigger value="environment" className="gap-1.5">
              <Layers className="h-4 w-4" />
              {t('providerDetail.tabEnvironment')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <ProviderOverviewTab
            provider={provider}
            isAvailable={isAvailable}
            providerStatusInfo={providerStatusInfo}
            healthResult={healthResult}
            environmentProviderInfo={environmentProviderInfo}
            installedCount={installedPackages.length}
            updatesCount={availableUpdates.length}
            isSavingPriority={isSavingPriority}
            onPrioritySave={handlePrioritySave}
          />
        </TabsContent>

        <TabsContent value="packages">
          <ProviderPackagesTab
            providerId={providerId}
            installedPackages={installedPackages}
            searchResults={searchResults}
            searchQuery={searchQuery}
            loadingPackages={loadingPackages}
            loadingSearch={loadingSearch}
            pinnedPackages={pinnedPackages.map(([name]) => name)}
            onSearchPackages={searchPackages}
            onInstallPackage={installPackage}
            onUninstallPackage={uninstallPackage}
            onBatchUninstall={batchUninstallPackages}
            onPinPackage={pinPackage}
            onUnpinPackage={unpinPackage}
            onRollbackPackage={rollbackToLastVersion}
            onRefreshPackages={refreshPackageSurface}
            onViewPackageDetails={handleViewPackageDetails}
            preflightSummary={preflightSummary}
            preflightPackages={preflightPackages}
            isPreflightOpen={isPreflightOpen}
            onConfirmPreflight={confirmPreflight}
            onDismissPreflight={dismissPreflight}
          />
        </TabsContent>

        <TabsContent value="updates">
          <ProviderUpdatesTab
            availableUpdates={availableUpdates}
            loadingUpdates={loadingUpdates}
            onCheckUpdates={checkUpdates}
            onUpdatePackage={updatePackage}
            onUpdateAllPackages={updateAllPackages}
          />
        </TabsContent>

        <TabsContent value="health">
          <ProviderHealthTab
            healthResult={healthResult}
            loadingHealth={loadingHealth}
            onRunHealthCheck={runHealthCheck}
            onPreviewRemediation={previewHealthRemediation}
            onApplyRemediation={applyHealthRemediation}
            activeRemediationId={activeRemediationId}
          />
        </TabsContent>

        <TabsContent value="history">
          <ProviderHistoryTab
            installHistory={installHistory}
            loadingHistory={loadingHistory}
            historyError={historyError}
            onRefreshHistory={fetchHistory}
          />
        </TabsContent>

        {isEnvironmentProvider && (
          <TabsContent value="environment">
            <ProviderEnvironmentTab
              providerId={providerId}
              environmentInfo={environmentInfo}
              environmentProviderInfo={environmentProviderInfo}
              availableVersions={availableVersions}
              loadingEnvironment={loadingEnvironment}
              onRefreshEnvironment={fetchEnvironmentInfo}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
