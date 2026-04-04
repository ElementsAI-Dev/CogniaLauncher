'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { DashboardMetricGrid, DashboardMetricItem } from '@/components/dashboard/dashboard-primitives';
import { SearchBar } from '@/components/packages/search-bar';
import { PackageDetailsDialog } from '@/components/packages/package-details-dialog';
import { BatchOperations } from '@/components/packages/batch-operations';
import { DependencyTree } from '@/components/packages/dependency-tree';
import { PackageComparisonDialog } from '@/components/packages/package-comparison-dialog';
import { ExportImportDialog } from '@/components/packages/export-import-dialog';
import { ProviderStatusBadge } from '@/components/packages/provider-status-badge';
import { PackageOperationPanel } from '@/components/packages/shared/package-operation-panel';
import {
  PackageOperationProvider,
  type PackageOperationContextValue,
} from '@/components/packages/shared/package-operation-context';
import { InstalledTab } from '@/components/packages/tabs/installed-tab';
import { UpdatesTab } from '@/components/packages/tabs/updates-tab';
import { SearchResultsTab } from '@/components/packages/tabs/search-results-tab';
import { HistoryTab } from '@/components/packages/tabs/history-tab';
import { PageHeader } from '@/components/layout/page-header';
import { usePackages } from '@/hooks/packages/use-packages';
import { usePackageStore } from '@/lib/stores/packages';
import { useLocale } from '@/components/providers/locale-provider';
import { useKeyboardShortcuts } from '@/hooks/shared/use-keyboard-shortcuts';
import { isPackageSurfaceProvider } from '@/lib/constants/providers';
import { isTauri } from '@/lib/tauri';
import {
  AlertCircle, GitCompare,
  Package as PackageIcon, Server, ArrowUp, Pin, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PackageSummary, InstalledPackage, ResolutionResult, BatchResult } from '@/lib/tauri';
import type { ExportedPackageList } from '@/hooks/packages/use-package-export';
import type { DependencyLookupContext, DependencyResolveRequest } from '@/types/packages';
import {
  getPackageKeyFromParts,
  isPackageBookmarked,
  isPackagePinned,
} from '@/lib/packages';

export default function PackagesPage() {
  const { t } = useLocale();

  if (!isTauri()) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader
          title={t('packages.title')}
          description={t('packages.description')}
        />
        <Empty className="border-none py-12" data-testid="packages-web-fallback">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon />
            </EmptyMedia>
            <EmptyTitle>{t('environments.desktopOnly')}</EmptyTitle>
            <EmptyDescription>{t('environments.desktopOnlyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return <PackagesDesktopPage />;
}

function PackagesDesktopPage() {
  const router = useRouter();
  const {
    searchResults,
    installedPackages,
    providers,
    loading,
    installing,
    error,
    pinnedPackages,
    checkForUpdates,
    installPackages,
    uninstallPackages,
    fetchInstalledPackages,
    fetchProviders,
    fetchPackageInfo,
    advancedSearch,
    getSuggestions,
    batchInstall,
    batchUpdate,
    batchUninstall,
    resolveDependencies,
    resolveConflicts,
    comparePackages,
    pinPackage,
    unpinPackage,
    rollbackPackage,
    fetchPinnedPackages,
    getInstallHistory,
    clearInstallHistory,
    preflightSummary,
    preflightPackages,
    isPreflightOpen,
    confirmPreflight,
    dismissPreflight,
  } = usePackages();

  const {
    selectedPackages,
    clearPackageSelection,
    bookmarkedPackages,
    toggleBookmark,
    restoreBookmarks,
    availableUpdates: updates,
    updateCheckProgress,
    isCheckingUpdates,
    updateCheckErrors,
    updateCheckProviderOutcomes,
    updateCheckCoverage,
    lastUpdateCheck,
    searchMeta,
  } = usePackageStore();

  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState('installed');
  const [selectedPackage, setSelectedPackage] = useState<PackageSummary | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [dependencyResolution, setDependencyResolution] = useState<ResolutionResult | null>(null);
  const [resolvingDeps, setResolvingDeps] = useState(false);
  const [selectedDependencyContext, setSelectedDependencyContext] =
    useState<DependencyLookupContext | null>(null);
  const [activeDependencyRequest, setActiveDependencyRequest] =
    useState<DependencyResolveRequest | null>(null);
  const [dependencyError, setDependencyError] = useState<string | null>(null);
  const [resolvingDependencyKey, setResolvingDependencyKey] = useState<string | null>(null);
  const [searchRequest, setSearchRequest] = useState<{
    query: string;
    providers?: string[];
    installedOnly?: boolean;
    notInstalled?: boolean;
    hasUpdates?: boolean;
    license?: string[];
    minVersion?: string;
    maxVersion?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'f',
        ctrlKey: true,
        action: () => searchInputRef.current?.focus(),
        description: 'Focus search',
      },
      {
        key: 'r',
        ctrlKey: true,
        action: () => {
          fetchInstalledPackages(undefined, true);
          fetchProviders();
        },
        description: 'Refresh',
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Initial data fetch
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchProviders();
    fetchInstalledPackages();
    fetchPinnedPackages();
  }, [fetchPinnedPackages, fetchProviders, fetchInstalledPackages]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const availableUpdates = useMemo(
    () => updates.filter((u) => !isPackagePinned(pinnedPackages, u.name, u.provider)),
    [updates, pinnedPackages],
  );

  const pinnedUpdates = useMemo(
    () => updates.filter((u) => isPackagePinned(pinnedPackages, u.name, u.provider)),
    [updates, pinnedPackages],
  );

  const enabledProviderCount = useMemo(
    () => providers.filter((p) => p.enabled && isPackageSurfaceProvider(p)).length,
    [providers],
  );

  const activeSearchFilterCount = useMemo(() => {
    if (!searchRequest) return 0;
    return [
      searchRequest.installedOnly || searchRequest.notInstalled || searchRequest.hasUpdates ? 1 : 0,
      searchRequest.license?.length ? 1 : 0,
      searchRequest.minVersion || searchRequest.maxVersion ? 1 : 0,
    ].reduce((sum, c) => sum + c, 0);
  }, [searchRequest]);

  // ---------------------------------------------------------------------------
  // Toast helpers
  // ---------------------------------------------------------------------------
  const withToast = useCallback(async <T,>(
    fn: () => Promise<T>,
    successMsg: string,
    errorMsg: (e: unknown) => string,
  ): Promise<T | undefined> => {
    try {
      const result = await fn();
      toast.success(successMsg);
      return result;
    } catch (err) {
      toast.error(errorMsg(err));
      return undefined;
    }
  }, []);

  const withBatchToast = useCallback(async (
    fn: () => Promise<BatchResult>,
    successKey: string,
    failKey: string,
  ): Promise<BatchResult> => {
    const result = await fn();
    if (result.successful.length > 0) toast.success(t(successKey, { count: result.successful.length }));
    if (result.failed.length > 0) toast.error(t(failKey, { count: result.failed.length }));
    return result;
  }, [t]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCheckUpdates = useCallback(async () => {
    try {
      const foundUpdates = await checkForUpdates();
      if (foundUpdates.length > 0) {
        toast.success(t('packages.updatesFound', { count: foundUpdates.length }));
      } else {
        toast.info(t('packages.allUpToDate'));
      }
    } catch (err) {
      toast.error(t('packages.checkUpdatesFailed', { error: String(err) }));
    }
  }, [checkForUpdates, t]);

  const handleInstall = useCallback(async (name: string) => {
    await withToast(
      async () => {
        await installPackages([name]);
        if (searchRequest) await handleAdvancedSearch(searchRequest.query, searchRequest);
      },
      t('packages.installSuccess', { name }),
      (err) => t('packages.installFailed', { error: String(err) }),
    );
  }, [installPackages, searchRequest, t, withToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUninstall = useCallback(async (name: string) => {
    await withToast(
      () => uninstallPackages([name]),
      t('packages.uninstallSuccess', { name }),
      (err) => t('packages.uninstallFailed', { name, error: String(err) }),
    );
  }, [uninstallPackages, t, withToast]);

  const handleUpdatePackage = useCallback(async (name: string, version: string, provider?: string) => {
    await withToast(
      async () => {
        const packageId = provider ? `${provider}:${name}` : name;
        await installPackages([`${packageId}@${version}`]);
        await handleCheckUpdates();
      },
      t('packages.updateSuccess', { name, version }),
      (err) => t('packages.updateFailed', { name, error: String(err) }),
    );
  }, [installPackages, handleCheckUpdates, t, withToast]);

  const handlePinPackage = useCallback(async (name: string, version?: string, provider?: string) => {
    const fallbackVersion = installedPackages.find(
      (pkg) => pkg.name === name && (!provider || pkg.provider === provider),
    )?.version;
    await withToast(
      () => pinPackage(getPackageKeyFromParts(name, provider), version ?? fallbackVersion),
      t('packages.pinned', { name }),
      (err) => t('packages.pinFailed', { name, error: String(err) }),
    );
  }, [installedPackages, pinPackage, t, withToast]);

  const handleUnpinPackage = useCallback(async (name: string, provider?: string) => {
    await withToast(
      () => unpinPackage(getPackageKeyFromParts(name, provider)),
      t('packages.unpinned', { name }),
      (err) => t('packages.unpinFailed', { name, error: String(err) }),
    );
  }, [unpinPackage, t, withToast]);

  const handleUpdateAll = useCallback(async () => {
    const packageNames = availableUpdates.map((u) => `${u.provider}:${u.name}`);
    if (packageNames.length === 0) {
      return {
        successful: [],
        failed: [],
        skipped: [],
        total_time_ms: 0,
      };
    }
    return withBatchToast(
      async () => {
        const result = await batchUpdate(packageNames);
        await handleCheckUpdates();
        return result;
      },
      'packages.batchUpdateSuccess',
      'packages.batchUpdateFailed',
    );
  }, [availableUpdates, batchUpdate, handleCheckUpdates, withBatchToast]);

  const handleBatchInstall = useCallback(
    async (
      packages: string[],
      options?: { dryRun?: boolean; force?: boolean; parallel?: boolean; global?: boolean },
    ): Promise<BatchResult> =>
      withBatchToast(
        () => batchInstall(packages, options),
        'packages.batchInstallSuccess',
        'packages.batchInstallFailed',
      ),
    [batchInstall, withBatchToast],
  );

  const handleBatchUninstall = useCallback(
    async (packages: string[], force?: boolean): Promise<BatchResult> =>
      withBatchToast(
        () => batchUninstall(packages, force),
        'packages.batchUninstallSuccess',
        'packages.batchUninstallFailed',
      ),
    [batchUninstall, withBatchToast],
  );

  const handleBatchUpdate = useCallback(
    async (packages?: string[]): Promise<BatchResult> =>
      withBatchToast(
        async () => {
          const result = await batchUpdate(packages);
          await checkForUpdates();
          return result;
        },
        'packages.batchUpdateSuccess',
        'packages.batchUpdateFailed',
      ),
    [batchUpdate, checkForUpdates, withBatchToast],
  );

  const handleSelectPackage = useCallback((pkg: PackageSummary | InstalledPackage) => {
    const summary: PackageSummary = {
      name: pkg.name,
      description: 'description' in pkg ? pkg.description : null,
      latest_version: 'latest_version' in pkg ? pkg.latest_version : (pkg as InstalledPackage).version,
      provider: pkg.provider,
    };
    setSelectedPackage(summary);
    setDetailsOpen(true);
  }, []);

  const handleAdvancedSearch = useCallback(async (
    query: string,
    options: {
      providers?: string[];
      installedOnly?: boolean;
      notInstalled?: boolean;
      hasUpdates?: boolean;
      license?: string[];
      minVersion?: string;
      maxVersion?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    },
  ) => {
    const nextRequest = {
      query,
      ...options,
      limit: options.limit ?? searchMeta?.pageSize ?? 20,
      offset: options.offset ?? 0,
    };
    await advancedSearch(query, {
      providers: nextRequest.providers,
      limit: nextRequest.limit,
      offset: nextRequest.offset,
      sortBy: nextRequest.sortBy,
      sortOrder: nextRequest.sortOrder,
      filters: {
        installedOnly: nextRequest.installedOnly,
        notInstalled: nextRequest.notInstalled,
        hasUpdates: nextRequest.hasUpdates,
        license: nextRequest.license,
        minVersion: nextRequest.minVersion,
        maxVersion: nextRequest.maxVersion,
      },
    });
    setSearchRequest(nextRequest);
    setActiveTab('search');
  }, [advancedSearch, searchMeta?.pageSize]);

  const handleSearchPageChange = useCallback(async (nextPage: number) => {
    if (!searchRequest || !searchMeta) return;
    const nextOffset = nextPage * searchMeta.pageSize;
    await handleAdvancedSearch(searchRequest.query, {
      ...searchRequest,
      offset: nextOffset,
      limit: searchMeta.pageSize,
    });
  }, [handleAdvancedSearch, searchMeta, searchRequest]);

  // ---------------------------------------------------------------------------
  // Dependency resolution handlers
  // ---------------------------------------------------------------------------
  const handleResolveDependencies = useCallback(
    async (request: DependencyResolveRequest): Promise<ResolutionResult | null> => {
      const packageName = request.packageName.trim();
      if (!packageName) {
        setDependencyError(t('packages.enterPackageToResolve'));
        return null;
      }
      const normalizedRequest: DependencyResolveRequest = {
        packageName,
        providerId: request.providerId ?? null,
        version: request.version ?? null,
        source: request.source,
      };
      const dependencyLookupKey = `${normalizedRequest.source}:${normalizedRequest.providerId ?? ''}:${normalizedRequest.packageName.toLowerCase()}`;
      const packageBaseId = normalizedRequest.providerId
        ? `${normalizedRequest.providerId}:${normalizedRequest.packageName}`
        : normalizedRequest.packageName;
      const packageSpec = normalizedRequest.version
        ? `${packageBaseId}@${normalizedRequest.version}`
        : packageBaseId;

      setResolvingDeps(true);
      setDependencyError(null);
      setActiveDependencyRequest(normalizedRequest);
      setResolvingDependencyKey(dependencyLookupKey);
      setDependencyResolution(null);

      try {
        const result = await resolveDependencies(packageSpec);
        if (result) {
          setDependencyResolution(result);
          return result;
        }
        throw new Error(t('common.unknown'));
      } catch (err) {
        const hasPartialContext =
          normalizedRequest.source !== 'manual' &&
          (!normalizedRequest.providerId || !normalizedRequest.version);
        const errorMessage = hasPartialContext
          ? t('packages.dependencyResolveFailedWithManualHint', {
              name: normalizedRequest.packageName, error: String(err),
            })
          : t('packages.dependencyResolveFailedFor', {
              name: normalizedRequest.packageName, error: String(err),
            });
        setDependencyError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        setResolvingDeps(false);
        setResolvingDependencyKey(null);
      }
    },
    [resolveDependencies, t],
  );

  const handleResolveConflict = useCallback(
    async (
      conflict: import('@/lib/tauri').ConflictInfo,
      strategy: import('@/lib/tauri').ConflictResolutionStrategy,
      manualVersion?: string,
    ) =>
      resolveConflicts(
        [conflict],
        strategy,
        manualVersion ? { [conflict.package_name]: manualVersion } : undefined,
      ),
    [resolveConflicts],
  );

  const handleResolveFromPackageList = useCallback(
    async (pkg: PackageSummary | InstalledPackage, source: 'installed' | 'search') => {
      const contextVersion = source === 'installed'
        ? ('version' in pkg ? pkg.version : null)
        : ('latest_version' in pkg ? pkg.latest_version : null);
      const selectedContext: DependencyLookupContext = {
        packageName: pkg.name,
        providerId: pkg.provider,
        version: contextVersion?.trim() || null,
        source,
      };
      setSelectedDependencyContext(selectedContext);
      setActiveTab('dependencies');
      await handleResolveDependencies({
        packageName: selectedContext.packageName,
        providerId: selectedContext.providerId,
        version: selectedContext.version,
        source: selectedContext.source,
      });
    },
    [handleResolveDependencies],
  );

  const handleRetryDependencyResolution = useCallback(async () => {
    if (activeDependencyRequest) await handleResolveDependencies(activeDependencyRequest);
  }, [activeDependencyRequest, handleResolveDependencies]);

  // ---------------------------------------------------------------------------
  // Import / Bookmark handlers
  // ---------------------------------------------------------------------------
  const handleImportPackages = useCallback(async (data: ExportedPackageList) => {
    const packageIds = data.packages.map((p) => {
      if (p.provider && p.version) return `${p.provider}:${p.name}@${p.version}`;
      if (p.provider) return `${p.provider}:${p.name}`;
      if (p.version) return `${p.name}@${p.version}`;
      return p.name;
    });
    if (data.bookmarks.length > 0) {
      restoreBookmarks(data.bookmarks, [...installedPackages, ...data.packages]);
    }
    if (packageIds.length > 0) await handleBatchInstall(packageIds);
  }, [handleBatchInstall, installedPackages, restoreBookmarks]);

  const handleBookmarkToggle = useCallback((name: string, provider?: string) => {
    toggleBookmark(name, provider);
    const isBookmarked = isPackageBookmarked(bookmarkedPackages, name, provider);
    toast.success(
      isBookmarked
        ? t('packages.bookmarkRemoved', { name })
        : t('packages.bookmarkAdded', { name }),
    );
  }, [toggleBookmark, bookmarkedPackages, t]);

  const packageOperationTopContent = (
    <>
      <DashboardMetricGrid columns={5}>
        <DashboardMetricItem
          icon={<PackageIcon className="h-3.5 w-3.5" />}
          label={t('packages.totalInstalled')}
          value={installedPackages.length}
        />
        <DashboardMetricItem
          icon={<Server className="h-3.5 w-3.5" />}
          label={t('packages.activeProviders')}
          value={`${enabledProviderCount}/${providers.length}`}
        />
        <DashboardMetricItem
          icon={<ArrowUp className="h-3.5 w-3.5" />}
          label={t('packages.updatesAvailableShort')}
          value={updates.length}
          className={updates.length > 0 ? 'border-amber-200 dark:border-amber-900' : undefined}
        />
        <DashboardMetricItem
          icon={<Pin className="h-3.5 w-3.5" />}
          label={t('packages.pinnedPackages')}
          value={pinnedPackages.length}
        />
        <DashboardMetricItem
          icon={<Star className="h-3.5 w-3.5" />}
          label={t('packages.bookmarked')}
          value={bookmarkedPackages.length}
        />
      </DashboardMetricGrid>

      <div data-hint="packages-search">
        <SearchBar
          providers={providers}
          inputRef={searchInputRef}
          onSearch={handleAdvancedSearch}
          onGetSuggestions={getSuggestions}
          loading={loading}
        />
      </div>
    </>
  );

  const packageOperationContextValue: PackageOperationContextValue = {
    mode: 'full',
    providers,
    installedPackages,
    searchResults,
    availableUpdates: updates,
    selectedPackages,
    installing,
    pinnedPackages,
    bookmarkedPackages,
    loading,
    error,
    searchMeta,
    searchInputRef,
    activeSearchRequest: searchRequest
      ? {
          query: searchRequest.query,
          providers: searchRequest.providers,
          filterCount: activeSearchFilterCount,
          sortBy: searchRequest.sortBy,
        }
      : null,
    topContent: packageOperationTopContent,
    tabContentOverrides: {
      installed: (
        <InstalledTab
          packages={installedPackages}
          providers={providers}
          loading={loading}
          pinnedPackages={pinnedPackages}
          bookmarkedPackages={bookmarkedPackages}
          resolvingDependencyKey={resolvingDependencyKey}
          onUninstall={handleUninstall}
          onSelect={handleSelectPackage}
          onResolveDependencies={handleResolveFromPackageList}
          onPin={handlePinPackage}
          onUnpin={handleUnpinPackage}
          onBookmark={handleBookmarkToggle}
        />
      ),
      updates: (
        <UpdatesTab
          availableUpdates={availableUpdates}
          pinnedUpdates={pinnedUpdates}
          totalUpdates={updates.length}
          isCheckingUpdates={isCheckingUpdates}
          updateCheckProgress={updateCheckProgress}
          updateCheckErrors={updateCheckErrors}
          updateCheckCoverage={updateCheckCoverage}
          updateCheckProviderOutcomes={updateCheckProviderOutcomes}
          lastUpdateCheck={lastUpdateCheck}
          installedPackagesCount={installedPackages.length}
          onCheckUpdates={handleCheckUpdates}
          onUpdatePackage={handleUpdatePackage}
          onUpdateAll={handleUpdateAll}
          onPinPackage={handlePinPackage}
          onUnpinPackage={handleUnpinPackage}
        />
      ),
      search: (
        <SearchResultsTab
          searchResults={searchResults}
          searchMeta={searchMeta}
          searchRequest={searchRequest}
          activeFilterCount={activeSearchFilterCount}
          loading={loading}
          installing={installing}
          resolvingDependencyKey={resolvingDependencyKey}
          onInstall={handleInstall}
          onSelect={handleSelectPackage}
          onResolveDependencies={handleResolveFromPackageList}
          onPageChange={handleSearchPageChange}
        />
      ),
      dependencies: (
        <DependencyTree
          key={selectedDependencyContext
            ? `${selectedDependencyContext.source}:${selectedDependencyContext.providerId ?? ''}:${selectedDependencyContext.packageName}:${selectedDependencyContext.version ?? ''}`
            : 'dependency-manual'}
          selectedContext={selectedDependencyContext}
          activeRequest={activeDependencyRequest}
          resolution={dependencyResolution ?? undefined}
          error={dependencyError}
          loading={resolvingDeps}
          onResolve={handleResolveDependencies}
          onResolveConflict={handleResolveConflict}
          onRetry={handleRetryDependencyResolution}
        />
      ),
      history: (
        <HistoryTab
          providers={providers}
          loadHistory={getInstallHistory}
          clearHistory={clearInstallHistory}
          onOpenDetail={(name, provider) =>
            router.push(`/packages/detail?name=${encodeURIComponent(name)}&provider=${encodeURIComponent(provider)}`)}
        />
      ),
    },
    preflightSummary,
    preflightPackages,
    isPreflightOpen,
    onSearch: handleAdvancedSearch,
    onSearchPageChange: handleSearchPageChange,
    onGetSuggestions: getSuggestions,
    onInstall: handleInstall,
    onUninstall: handleUninstall,
    onSelect: handleSelectPackage,
    onResolveDependencies: handleResolveFromPackageList,
    onPin: handlePinPackage,
    onUnpin: handleUnpinPackage,
    onRollback: async (name, version, provider) => {
      if (!version) return;
      await rollbackPackage(getPackageKeyFromParts(name, provider), version);
    },
    onBookmark: handleBookmarkToggle,
    onUpdateSelected: handleBatchUpdate,
    onUpdateAll: handleUpdateAll,
    onCheckUpdates: handleCheckUpdates,
    onBatchInstall: handleBatchInstall,
    onBatchUninstall: handleBatchUninstall,
    onBatchUpdate: handleBatchUpdate,
    onClearSelection: clearPackageSelection,
    onConfirmPreflight: confirmPreflight,
    onDismissPreflight: dismissPreflight,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="h-full min-h-0 p-6 flex flex-col gap-6 min-w-0 overflow-hidden">
      <PageHeader
        title={t('packages.title')}
        description={t('packages.description')}
        actions={
          <div className="flex items-center gap-2">
            <ProviderStatusBadge
              providers={providers}
              onRefresh={() => { void fetchProviders(true); }}
            />
            <ExportImportDialog onImport={handleImportPackages} />
            {selectedPackages.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComparisonOpen(true)}
              >
                <GitCompare className="h-4 w-4 mr-1" />
                {t('packages.compare', { count: selectedPackages.length })}
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PackageOperationProvider value={packageOperationContextValue}>
        <PackageOperationPanel
          mode="full"
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </PackageOperationProvider>

      <BatchOperations
        selectedPackages={selectedPackages}
        onBatchInstall={handleBatchInstall}
        onBatchUninstall={handleBatchUninstall}
        onBatchUpdate={handleBatchUpdate}
        onClearSelection={clearPackageSelection}
      />

      <PackageComparisonDialog
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
        packageIds={selectedPackages}
        onCompare={comparePackages}
      />

      <PackageDetailsDialog
        pkg={selectedPackage}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onInstall={async (name, version) => {
          const provider = selectedPackage?.provider;
          const packageId = provider ? `${provider}:${name}` : name;
          const pkgWithVersion = version ? `${packageId}@${version}` : packageId;
          await installPackages([pkgWithVersion]);
        }}
        onRollback={async (name, version) => {
          try {
            await rollbackPackage(getPackageKeyFromParts(name, selectedPackage?.provider), version);
            toast.success(t('packages.rollbackSuccess', { name, version }));
          } catch (err) {
            toast.error(t('packages.rollbackFailed', { error: String(err) }));
          }
        }}
        onPin={async (name, version) => {
          await handlePinPackage(name, version, selectedPackage?.provider);
        }}
        fetchPackageInfo={fetchPackageInfo}
        isInstalled={installedPackages.some(
          (p) =>
            p.name === selectedPackage?.name &&
            (!selectedPackage?.provider || p.provider === selectedPackage.provider),
        )}
        currentVersion={installedPackages.find(
          (p) =>
            p.name === selectedPackage?.name &&
            (!selectedPackage?.provider || p.provider === selectedPackage.provider),
        )?.version}
      />
    </div>
  );
}
