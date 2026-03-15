'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { SearchBar } from '@/components/packages/search-bar';
import { PackageList } from '@/components/packages/package-list';
import { PackageDetailsDialog } from '@/components/packages/package-details-dialog';
import { BatchOperations } from '@/components/packages/batch-operations';
import { DependencyTree } from '@/components/packages/dependency-tree';
import { PackageComparisonDialog } from '@/components/packages/package-comparison-dialog';
import { InstalledFilterBar, useInstalledFilter } from '@/components/packages/installed-filter-bar';
import { ExportImportDialog } from '@/components/packages/export-import-dialog';
import { ProviderStatusBadge } from '@/components/packages/provider-status-badge';
import { StatsOverview } from '@/components/packages/stats-overview';
import { PageHeader } from '@/components/layout/page-header';
import { usePackages } from '@/hooks/use-packages';
import { usePackageStore } from '@/lib/stores/packages';
import { useLocale } from '@/components/providers/locale-provider';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { isTauri } from '@/lib/tauri';
import { AlertCircle, RefreshCw, ArrowUp, GitBranch, GitCompare, History, Pin, ChevronRight, Package as PackageIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { PackageSummary, InstalledPackage, ResolutionResult, BatchResult } from '@/lib/tauri';
import type { ExportedPackageList } from '@/hooks/use-package-export';
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
    comparePackages,
    pinPackage,
    unpinPackage,
    rollbackPackage,
    fetchPinnedPackages,
    getInstallHistory,
    clearInstallHistory,
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
  const [installHistory, setInstallHistory] = useState<Array<{
    id: string;
    name: string;
    version: string;
    action: string;
    timestamp: string;
    provider: string;
    success: boolean;
    error_message?: string | null;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<{
    name: string;
    provider: string;
    action: string;
    success: 'all' | 'success' | 'failed';
  }>({
    name: '',
    provider: 'all',
    action: 'all',
    success: 'all',
  });
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
  const historyDirtyRef = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Installed packages filter
  const { filter: installedFilter, setFilter: setInstalledFilter, filteredPackages: filteredInstalledPackages } = useInstalledFilter(installedPackages);

  // Keyboard shortcuts
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

  const loadInstallHistory = useCallback(async (filtersOverride?: Partial<typeof historyFilters>) => {
    const effectiveFilters = { ...historyFilters, ...(filtersOverride ?? {}) };
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const entries = await getInstallHistory({
        limit: 200,
        name: effectiveFilters.name.trim() || undefined,
        provider: effectiveFilters.provider !== 'all' ? effectiveFilters.provider : undefined,
        action: effectiveFilters.action !== 'all' ? effectiveFilters.action : undefined,
        success:
          effectiveFilters.success === 'all'
            ? undefined
            : effectiveFilters.success === 'success',
      });
      setInstallHistory(entries);
      historyDirtyRef.current = false;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, [getInstallHistory, historyFilters]);

  useEffect(() => {
    fetchProviders();
    fetchInstalledPackages();
    fetchPinnedPackages();
  }, [fetchPinnedPackages, fetchProviders, fetchInstalledPackages]);

  useEffect(() => {
    if (activeTab === 'history' && historyDirtyRef.current) {
      void loadInstallHistory();
    }
  }, [activeTab, loadInstallHistory]);

  const availableUpdates = useMemo(() => 
    updates.filter((u) => !isPackagePinned(pinnedPackages, u.name, u.provider)),
    [updates, pinnedPackages]
  );

  const pinnedUpdates = useMemo(() =>
    updates.filter((u) => isPackagePinned(pinnedPackages, u.name, u.provider)),
    [updates, pinnedPackages]
  );

  const unsupportedProviderOutcomes = useMemo(
    () => (updateCheckProviderOutcomes ?? []).filter((o) => o.status === 'unsupported'),
    [updateCheckProviderOutcomes]
  );
  const partialProviderOutcomes = useMemo(
    () => (updateCheckProviderOutcomes ?? []).filter((o) => o.status === 'partial'),
    [updateCheckProviderOutcomes]
  );

  const describeProviderOutcomeReason = useCallback((outcome: {
    reason: string | null;
    reason_code?: string | null;
  }) => {
    if (outcome.reason) {
      return outcome.reason;
    }

    switch (outcome.reason_code) {
      case 'platform_unsupported':
        return t('packages.updateReasonPlatformUnsupported');
      case 'missing_update_capability':
        return t('packages.updateReasonCapabilityMissing');
      case 'provider_executable_unavailable':
        return t('packages.updateReasonProviderUnavailable');
      case 'no_matching_installed_packages':
        return t('packages.updateReasonNoMatchingInstalled');
      case 'native_update_check_failed_with_fallback':
        return t('packages.updateReasonNativeFallback');
      case 'native_update_check_failed':
        return t('packages.updateReasonNativeFailed');
      case 'installed_package_enumeration_failed':
        return t('packages.updateReasonInstalledEnumerationFailed');
      default:
        return t('common.unknown');
    }
  }, [t]);

  const refreshHistoryIfVisible = useCallback(async () => {
    historyDirtyRef.current = true;
    if (activeTab === 'history') {
      await loadInstallHistory();
    }
  }, [activeTab, loadInstallHistory]);

  const handleCheckUpdates = async () => {
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
  };

  const handleUpdatePackage = async (name: string, version: string, provider?: string) => {
    try {
      const packageId = provider ? `${provider}:${name}` : name;
      await installPackages([`${packageId}@${version}`]);
      toast.success(t('packages.updateSuccess', { name, version }));
      await handleCheckUpdates();
      await refreshHistoryIfVisible();
    } catch (err) {
      toast.error(t('packages.updateFailed', { name, error: String(err) }));
    }
  };

  const handlePinPackage = async (name: string, version?: string, provider?: string) => {
    const fallbackVersion = installedPackages.find(
      (pkg) => pkg.name === name && (!provider || pkg.provider === provider),
    )?.version;
    const pinVersion = version ?? fallbackVersion;
    try {
      await pinPackage(getPackageKeyFromParts(name, provider), pinVersion);
      toast.success(t('packages.pinned', { name }));
    } catch (err) {
      toast.error(t('packages.pinFailed', { name, error: String(err) }));
    }
  };

  const handleUnpinPackage = async (name: string, provider?: string) => {
    try {
      await unpinPackage(getPackageKeyFromParts(name, provider));
      toast.success(t('packages.unpinned', { name }));
    } catch (err) {
      toast.error(t('packages.unpinFailed', { name, error: String(err) }));
    }
  };

  const handleUpdateAll = async () => {
    const packageNames = availableUpdates.map(u => `${u.provider}:${u.name}`);
    if (packageNames.length === 0) return;
    
    try {
      const result = await batchUpdate(packageNames);
      if (result.successful.length > 0) {
        toast.success(t('packages.batchUpdateSuccess', { count: result.successful.length }));
      }
      if (result.failed.length > 0) {
        toast.error(t('packages.batchUpdateFailed', { count: result.failed.length }));
      }
      await handleCheckUpdates();
      await refreshHistoryIfVisible();
    } catch (err) {
      toast.error(t('packages.batchUpdateError', { error: String(err) }));
    }
  };

  const handleInstall = async (name: string) => {
    try {
      await installPackages([name]);
      toast.success(t('packages.installSuccess', { name }));
      await refreshHistoryIfVisible();
    } catch (err) {
      toast.error(t('packages.installFailed', { error: String(err) }));
    }
  };

  const handleUninstall = async (name: string) => {
    try {
      await uninstallPackages([name]);
      toast.success(t('packages.uninstallSuccess', { name }));
      await refreshHistoryIfVisible();
    } catch (err) {
      toast.error(t('packages.uninstallFailed', { name, error: String(err) }));
    }
  };

  const handleClearHistory = useCallback(async () => {
    setClearingHistory(true);
    try {
      await clearInstallHistory();
      setInstallHistory([]);
      setHistoryError(null);
      historyDirtyRef.current = false;
      toast.success(t('packages.historyCleared'));
    } catch (err) {
      toast.error(t('packages.historyClearFailed', { error: String(err) }));
    } finally {
      setClearingHistory(false);
    }
  }, [clearInstallHistory, t]);

  const handleSelectPackage = (pkg: PackageSummary | InstalledPackage) => {
    const summary: PackageSummary = {
      name: pkg.name,
      description: 'description' in pkg ? pkg.description : null,
      latest_version: 'latest_version' in pkg ? pkg.latest_version : (pkg as InstalledPackage).version,
      provider: pkg.provider,
    };
    setSelectedPackage(summary);
    setDetailsOpen(true);
  };

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
    }
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

  const handleBatchInstall = useCallback(
    async (
      packages: string[],
      options?: { dryRun?: boolean; force?: boolean; parallel?: boolean; global?: boolean },
    ): Promise<BatchResult> => {
    const result = await batchInstall(packages, options);
    if (result.successful.length > 0) {
      toast.success(t('packages.batchInstallSuccess', { count: result.successful.length }));
      await refreshHistoryIfVisible();
    }
    if (result.failed.length > 0) {
      toast.error(t('packages.batchInstallFailed', { count: result.failed.length }));
    }
    return result;
  }, [batchInstall, refreshHistoryIfVisible, t]);

  const handleBatchUninstall = useCallback(async (packages: string[], force?: boolean): Promise<BatchResult> => {
    const result = await batchUninstall(packages, force);
    if (result.successful.length > 0) {
      toast.success(t('packages.batchUninstallSuccess', { count: result.successful.length }));
      await refreshHistoryIfVisible();
    }
    if (result.failed.length > 0) {
      toast.error(t('packages.batchUninstallFailed', { count: result.failed.length }));
    }
    return result;
  }, [batchUninstall, refreshHistoryIfVisible, t]);

  const handleBatchUpdate = useCallback(async (packages?: string[]): Promise<BatchResult> => {
    const result = await batchUpdate(packages);
    if (result.successful.length > 0) {
      toast.success(t('packages.batchUpdateSuccess', { count: result.successful.length }));
      await checkForUpdates();
      await refreshHistoryIfVisible();
    }
    if (result.failed.length > 0) {
      toast.error(t('packages.batchUpdateFailed', { count: result.failed.length }));
    }
    return result;
  }, [batchUpdate, checkForUpdates, refreshHistoryIfVisible, t]);

  const handleResolveDependencies = useCallback(
    async (request: DependencyResolveRequest): Promise<ResolutionResult | null> => {
      const packageName = request.packageName.trim();
      if (!packageName) {
        const emptyInputError = t('packages.enterPackageToResolve');
        setDependencyError(emptyInputError);
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
              name: normalizedRequest.packageName,
              error: String(err),
            })
          : t('packages.dependencyResolveFailedFor', {
              name: normalizedRequest.packageName,
              error: String(err),
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

  const handleResolveFromPackageList = useCallback(
    async (pkg: PackageSummary | InstalledPackage, source: 'installed' | 'search') => {
      const contextVersion = source === 'installed'
        ? ('version' in pkg ? pkg.version : null)
        : ('latest_version' in pkg ? pkg.latest_version : null);
      const normalizedVersion = contextVersion?.trim() ? contextVersion.trim() : null;

      const selectedContext: DependencyLookupContext = {
        packageName: pkg.name,
        providerId: pkg.provider,
        version: normalizedVersion,
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
    if (!activeDependencyRequest) {
      return;
    }
    await handleResolveDependencies(activeDependencyRequest);
  }, [activeDependencyRequest, handleResolveDependencies]);

  const handleImportPackages = useCallback(async (data: ExportedPackageList) => {
    const packageIds = data.packages.map((p) => {
      if (p.provider && p.version) {
        return `${p.provider}:${p.name}@${p.version}`;
      } else if (p.provider) {
        return `${p.provider}:${p.name}`;
      } else if (p.version) {
        return `${p.name}@${p.version}`;
      }
      return p.name;
    });

    if (data.bookmarks.length > 0) {
      restoreBookmarks(data.bookmarks, [...installedPackages, ...data.packages]);
    }

    if (packageIds.length > 0) {
      await handleBatchInstall(packageIds);
    }
  }, [handleBatchInstall, installedPackages, restoreBookmarks]);

  const handleBookmarkToggle = useCallback((name: string, provider?: string) => {
    toggleBookmark(name, provider);
    const isBookmarked = isPackageBookmarked(bookmarkedPackages, name, provider);
    toast.success(
      isBookmarked
        ? t('packages.bookmarkRemoved', { name })
        : t('packages.bookmarkAdded', { name })
    );
  }, [toggleBookmark, bookmarkedPackages, t]);

  return (
    <div className="h-full min-h-0 p-6 flex flex-col gap-6 min-w-0 overflow-hidden">
      <PageHeader
        title={t('packages.title')}
        description={t('packages.description')}
        actions={
          <div className="flex items-center gap-2">
            <ProviderStatusBadge
              providers={providers}
              onRefresh={() => {
                void fetchProviders(true);
              }}
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

      <StatsOverview
        installedPackages={installedPackages}
        providers={providers}
        updates={updates}
        pinnedCount={pinnedPackages.length}
        bookmarkedCount={bookmarkedPackages.length}
      />

      <div data-hint="packages-search">
        <SearchBar
          providers={providers}
          inputRef={searchInputRef}
          onSearch={handleAdvancedSearch}
          onGetSuggestions={getSuggestions}
          loading={loading}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 flex-1">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-transparent border-b border-border rounded-none p-0 gap-0">
          <TabsTrigger 
            value="installed" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
          >
            {t('packages.installed')} ({installedPackages.length})
          </TabsTrigger>
          <TabsTrigger 
            value="updates"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 gap-2"
          >
            {t('packages.updates')}
            {updates.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                {updates.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="search"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
          >
            {t('packages.searchResults')} ({searchResults.length})
          </TabsTrigger>
          <TabsTrigger 
            value="dependencies" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 flex items-center gap-1.5"
          >
            <GitBranch className="h-3.5 w-3.5" />
            {t('packages.dependencies')}
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 flex items-center gap-1.5"
          >
            <History className="h-3.5 w-3.5" />
            {t('packages.history')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="mt-4 flex min-h-0 flex-col">
          <InstalledFilterBar
            packages={installedPackages}
            providers={providers}
            filter={installedFilter}
            onFilterChange={setInstalledFilter}
          />
          {loading && installedPackages.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <PackageList
              packages={filteredInstalledPackages}
              type="installed"
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
          )}
        </TabsContent>

        <TabsContent value="updates" className="mt-4 flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6">
            {/* Header with actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {updates.length > 0 
                    ? t('packages.updatesAvailable', { count: availableUpdates.length })
                    : t('packages.clickToCheck')
                  }
                </p>
                {updateCheckCoverage && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('packages.updateCheckCoverage', {
                      supported: updateCheckCoverage.supported,
                      partial: updateCheckCoverage.partial,
                      unsupported: updateCheckCoverage.unsupported,
                      error: updateCheckCoverage.error,
                    })}
                  </p>
                )}
                {pinnedUpdates.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('packages.pinnedPackagesSkipped', { count: pinnedUpdates.length })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {lastUpdateCheck && !isCheckingUpdates && (
                  <span className="text-xs text-muted-foreground">
                    {t('packages.lastChecked', { time: new Date(lastUpdateCheck).toLocaleTimeString() })}
                  </span>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCheckUpdates}
                  disabled={isCheckingUpdates || installedPackages.length === 0}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                  {isCheckingUpdates ? t('packages.checking') : t('packages.checkForUpdates')}
                </Button>
                {availableUpdates.length > 0 && (
                  <Button 
                    size="sm"
                    onClick={handleUpdateAll}
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    {t('packages.updateAll')}
                  </Button>
                )}
              </div>
            </div>

            {isCheckingUpdates ? (
              <Card>
                <CardContent className="py-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {updateCheckProgress?.phase === 'collecting'
                        ? t('packages.updateCheckCollecting')
                        : updateCheckProgress?.phase === 'checking' && updateCheckProgress.current_package
                          ? t('packages.updateCheckChecking', {
                              current: updateCheckProgress.current,
                              total: updateCheckProgress.total,
                              package: updateCheckProgress.current_package,
                            })
                          : t('packages.checking')}
                    </span>
                    {updateCheckProgress?.phase === 'checking' && updateCheckProgress.total > 0 && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {Math.round((updateCheckProgress.current / updateCheckProgress.total) * 100)}%
                      </span>
                    )}
                  </div>
                  <Progress
                    value={
                      updateCheckProgress?.phase === 'collecting'
                        ? undefined
                        : updateCheckProgress?.total
                          ? (updateCheckProgress.current / updateCheckProgress.total) * 100
                          : 0
                    }
                    className="h-2"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {updateCheckProgress?.found_updates
                        ? t('packages.updatesFound', { count: updateCheckProgress.found_updates })
                        : t('packages.updateCheckProgress', {
                            current: updateCheckProgress?.current ?? 0,
                            total: updateCheckProgress?.total ?? 0,
                          })}
                    </span>
                    {(updateCheckProgress?.errors ?? 0) > 0 && (
                      <span className="text-yellow-600">
                        {t('packages.updateCheckErrors', { count: updateCheckProgress?.errors ?? 0 })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : updates.length === 0 ? (
              <div className="space-y-4">
                {partialProviderOutcomes.length > 0 && (
                  <Alert className="border-yellow-500/40 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t('packages.updateCheckPartial', { count: partialProviderOutcomes.length })}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs">{t('common.details')}</summary>
                        <ul className="mt-1 text-xs space-y-0.5 list-disc pl-4">
                          {partialProviderOutcomes.slice(0, 5).map((outcome, i) => (
                            <li key={i}>
                              {outcome.provider}: {describeProviderOutcomeReason(outcome)}
                            </li>
                          ))}
                          {partialProviderOutcomes.length > 5 && (
                            <li>...{partialProviderOutcomes.length - 5} more</li>
                          )}
                        </ul>
                      </details>
                    </AlertDescription>
                  </Alert>
                )}
                {unsupportedProviderOutcomes.length > 0 && (
                  <Alert className="border-muted-foreground/30 bg-muted/40">
                    <AlertDescription>
                      {t('packages.updateCheckUnsupported', { count: unsupportedProviderOutcomes.length })}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs">{t('common.details')}</summary>
                        <ul className="mt-1 text-xs space-y-0.5 list-disc pl-4">
                          {unsupportedProviderOutcomes.slice(0, 5).map((outcome, i) => (
                            <li key={i}>
                              {outcome.provider}: {describeProviderOutcomeReason(outcome)}
                            </li>
                          ))}
                          {unsupportedProviderOutcomes.length > 5 && (
                            <li>...{unsupportedProviderOutcomes.length - 5} more</li>
                          )}
                        </ul>
                      </details>
                    </AlertDescription>
                  </Alert>
                )}
                {updateCheckErrors.length > 0 && (
                  <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t('packages.updateCheckErrors', { count: updateCheckErrors.length })}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs">{t('common.details')}</summary>
                        <ul className="mt-1 text-xs space-y-0.5 list-disc pl-4">
                          {updateCheckErrors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err.provider}{err.package ? ` / ${err.package}` : ''}: {err.message}</li>
                          ))}
                          {updateCheckErrors.length > 5 && <li>...{updateCheckErrors.length - 5} more</li>}
                        </ul>
                      </details>
                    </AlertDescription>
                  </Alert>
                )}
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="p-3 bg-green-500/10 rounded-full inline-block mb-4">
                      <RefreshCw className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="font-medium mb-1">{t('packages.allUpToDate')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('packages.noUpdates')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
                {/* Available Updates */}
                {availableUpdates.length > 0 && (
                  <div className="space-y-2">
                    {availableUpdates.map((update) => (
                      <Card key={`${update.provider}:${update.name}`}>
                        <CardHeader className="py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="min-w-0">
                                <CardTitle className="text-base break-all sm:truncate" title={update.name}>
                                  {update.name}
                                </CardTitle>
                                <CardDescription className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs break-all">{update.current_version}</span>
                                  <ChevronRight className="h-3 w-3" />
                                  <span className="font-mono text-xs text-green-600 font-medium break-all">{update.latest_version}</span>
                                  <Badge className="bg-muted text-muted-foreground text-xs shrink-0">{update.provider}</Badge>
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handlePinPackage(update.name, update.current_version, update.provider)}
                                title={t('packages.pinVersion')}
                              >
                                <Pin className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUpdatePackage(update.name, update.latest_version, update.provider)}
                              >
                                <ArrowUp className="h-4 w-4 mr-1" />
                                {t('common.update')}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Pinned Packages Section */}
                {pinnedUpdates.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Pin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('packages.pinnedPackages')}</span>
                      <Badge variant="secondary">{pinnedUpdates.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {pinnedUpdates.map((update) => (
                        <Card key={update.name} className="bg-muted/30">
                          <CardHeader className="py-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <CardTitle className="text-base flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="min-w-0 break-all sm:truncate" title={update.name}>
                                    {update.name}
                                  </span>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {t('packages.pinnedAt', { version: update.current_version })}
                                  </Badge>
                                </CardTitle>
                                <CardDescription className="break-all">
                                  {t('packages.availableVersion')}: {update.latest_version}
                                </CardDescription>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 self-start sm:self-center"
                                onClick={() => handleUnpinPackage(update.name, update.provider)}
                              >
                                {t('packages.unpin')}
                              </Button>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="search" className="mt-4 flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {searchMeta && searchMeta.total > 0 ? (
              <Card>
                <CardContent className="flex flex-col gap-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      {t('packages.searchSummary', {
                        from: searchMeta.page * searchMeta.pageSize + 1,
                        to: Math.min(
                          searchMeta.total,
                          searchMeta.page * searchMeta.pageSize + searchResults.length,
                        ),
                        total: searchMeta.total,
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSearchPageChange(Math.max(0, searchMeta.page - 1))}
                        disabled={loading || searchMeta.page <= 0}
                      >
                        {t('packages.searchPrevPage')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSearchPageChange(searchMeta.page + 1)}
                        disabled={
                          loading ||
                          (searchMeta.page + 1) * searchMeta.pageSize >= searchMeta.total
                        }
                      >
                        {t('packages.searchNextPage')}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        {t('packages.searchFacetProviders')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(searchMeta.facets.providers).map(([provider, count]) => (
                          <Badge key={provider} variant="secondary">
                            {provider} ({count})
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        {t('packages.searchFacetLicenses')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(searchMeta.facets.licenses).map(([license, count]) => (
                          <Badge key={license} variant="secondary">
                            {license} ({count})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <PackageList
                packages={searchResults}
                type="search"
                installing={installing}
                resolvingDependencyKey={resolvingDependencyKey}
                onInstall={handleInstall}
                onSelect={handleSelectPackage}
                onResolveDependencies={handleResolveFromPackageList}
                showSelectAll={false}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="dependencies" className="mt-4">
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
            onRetry={handleRetryDependencyResolution}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4 flex min-h-0 flex-col">
            <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      {t('packages.installHistory')}
                    </CardTitle>
                    <CardDescription>
                      {t('packages.installHistoryDesc')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        historyDirtyRef.current = true;
                        void loadInstallHistory();
                      }}
                      disabled={historyLoading || clearingHistory}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
                      {t('providers.refresh')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleClearHistory()}
                      disabled={historyLoading || clearingHistory || installHistory.length === 0}
                    >
                      {t('packages.clearHistory')}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto_auto]">
                    <Input
                      placeholder={t('packages.historyNameFilter')}
                      value={historyFilters.name}
                      onChange={(event) =>
                        setHistoryFilters((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                    <Select
                      value={historyFilters.provider}
                      onValueChange={(value) =>
                        setHistoryFilters((current) => ({ ...current, provider: value }))
                      }
                    >
                      <SelectTrigger aria-label={t('packages.providers')}>
                        <SelectValue placeholder={t('packages.providers')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('packages.allProviders')}</SelectItem>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={historyFilters.action}
                      onValueChange={(value) =>
                        setHistoryFilters((current) => ({ ...current, action: value }))
                      }
                    >
                      <SelectTrigger aria-label={t('packages.historyActionFilter')}>
                        <SelectValue placeholder={t('packages.historyActionFilter')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('packages.historyActionFilter')}</SelectItem>
                        {['install', 'uninstall', 'update', 'rollback'].map((action) => (
                          <SelectItem key={action} value={action}>
                            {action}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={historyFilters.success}
                      onValueChange={(value: 'all' | 'success' | 'failed') =>
                        setHistoryFilters((current) => ({ ...current, success: value }))
                      }
                    >
                      <SelectTrigger aria-label={t('packages.historyStatusFilter')}>
                        <SelectValue placeholder={t('packages.historyStatusFilter')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('packages.historyStatusAll')}</SelectItem>
                        <SelectItem value="success">{t('packages.historyStatusSuccess')}</SelectItem>
                        <SelectItem value="failed">{t('packages.historyStatusFailed')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => {
                        historyDirtyRef.current = true;
                        void loadInstallHistory();
                      }}
                    >
                      {t('packages.historyApplyFilters')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const nextFilters = {
                          name: '',
                          provider: 'all',
                          action: 'all',
                          success: 'all' as const,
                        };
                        setHistoryFilters(nextFilters);
                        historyDirtyRef.current = true;
                        void loadInstallHistory(nextFilters);
                      }}
                    >
                      {t('packages.historyResetFilters')}
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              {historyError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{historyError}</AlertDescription>
                </Alert>
              ) : historyLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : installHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {t('packages.noHistory')}
                </div>
              ) : (
                <ScrollArea className="h-full min-h-0 pr-2">
                  <div className="space-y-2">
                    {installHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className={`flex flex-col gap-2 p-3 border rounded-lg sm:flex-row sm:items-center sm:justify-between ${
                          entry.success ? '' : 'border-destructive/30 bg-destructive/5'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`p-2 rounded ${
                            entry.success ? 'bg-green-500/10' : 'bg-destructive/10'
                          }`}>
                            {entry.action === 'install' ? (
                              <ArrowUp className={`h-4 w-4 ${
                                entry.success ? 'text-green-500' : 'text-destructive'
                              }`} />
                            ) : (
                              <RefreshCw className={`h-4 w-4 ${
                                entry.success ? 'text-green-500' : 'text-destructive'
                              }`} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium break-all sm:truncate" title={entry.name}>
                              {entry.name}
                            </div>
                            <div className="text-xs text-muted-foreground break-all">
                              {entry.action} • {entry.version} • {entry.provider}
                            </div>
                            {entry.error_message && (
                              <div className="text-xs text-destructive break-all">
                                {entry.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 sm:text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/packages/detail?name=${encodeURIComponent(entry.name)}&provider=${encodeURIComponent(entry.provider)}`,
                              )
                            }
                          >
                            {t('packages.historyOpenDetails')}
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Batch Operations */}
      <BatchOperations
        selectedPackages={selectedPackages}
        onBatchInstall={handleBatchInstall}
        onBatchUninstall={handleBatchUninstall}
        onBatchUpdate={handleBatchUpdate}
        onClearSelection={clearPackageSelection}
      />

      {/* Package Comparison Dialog */}
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
          await refreshHistoryIfVisible();
        }}
        onRollback={async (name, version) => {
          try {
            await rollbackPackage(getPackageKeyFromParts(name, selectedPackage?.provider), version);
            toast.success(t('packages.rollbackSuccess', { name, version }));
            await refreshHistoryIfVisible();
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
