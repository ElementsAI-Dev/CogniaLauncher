'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/packages/search-bar';
import { PackageList } from '@/components/packages/package-list';
import { PackageDetailsDialog } from '@/components/packages/package-details-dialog';
import { BatchOperations } from '@/components/packages/batch-operations';
import { DependencyTree } from '@/components/packages/dependency-tree';
import { PackageComparisonDialog } from '@/components/packages/package-comparison-dialog';
import { usePackages } from '@/lib/hooks/use-packages';
import { usePackageStore } from '@/lib/stores/packages';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, RefreshCw, ArrowUp, GitBranch, GitCompare, History, Pin, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { PackageSummary, InstalledPackage, UpdateInfo, ResolutionResult, BatchResult } from '@/lib/tauri';

export default function PackagesPage() {
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
    getInstallHistory,
  } = usePackages();
  
  const { 
    selectedPackages, 
    clearPackageSelection,
  } = usePackageStore();
  
  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState('installed');
  const [selectedPackage, setSelectedPackage] = useState<PackageSummary | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [dependencyResolution, setDependencyResolution] = useState<ResolutionResult | null>(null);
  const [resolvingDeps, setResolvingDeps] = useState(false);
  const [installHistory, setInstallHistory] = useState<Array<{
    id: string;
    name: string;
    version: string;
    action: string;
    timestamp: string;
    provider: string;
    success: boolean;
  }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchProviders();
    fetchInstalledPackages();
  }, [fetchProviders, fetchInstalledPackages]);

  useEffect(() => {
    if (showHistory) {
      getInstallHistory(20).then(setInstallHistory);
    }
  }, [showHistory, getInstallHistory]);

  const availableUpdates = useMemo(() => 
    updates.filter(u => !pinnedPackages.includes(u.name)),
    [updates, pinnedPackages]
  );

  const pinnedUpdates = useMemo(() =>
    updates.filter(u => pinnedPackages.includes(u.name)),
    [updates, pinnedPackages]
  );

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const packageNames = installedPackages.map(p => p.name);
      const availableUpdates = await checkForUpdates(packageNames);
      setUpdates(availableUpdates);
      if (availableUpdates.length > 0) {
        toast.success(t('packages.updatesFound', { count: availableUpdates.length }));
      } else {
        toast.info(t('packages.allUpToDate'));
      }
    } catch (err) {
      toast.error(t('packages.checkUpdatesFailed', { error: String(err) }));
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleUpdatePackage = async (name: string, version: string) => {
    try {
      await installPackages([`${name}@${version}`]);
      toast.success(t('packages.updateSuccess', { name, version }));
      setUpdates(prev => prev.filter(u => u.name !== name));
      await fetchInstalledPackages();
    } catch (err) {
      toast.error(t('packages.updateFailed', { name, error: String(err) }));
    }
  };

  const handlePinPackage = async (name: string) => {
    try {
      await pinPackage(name);
      toast.success(t('packages.pinned', { name }));
    } catch (err) {
      toast.error(t('packages.pinFailed', { name, error: String(err) }));
    }
  };

  const handleUnpinPackage = async (name: string) => {
    try {
      await unpinPackage(name);
      toast.success(t('packages.unpinned', { name }));
    } catch (err) {
      toast.error(t('packages.unpinFailed', { name, error: String(err) }));
    }
  };

  const handleUpdateAll = async () => {
    const packageNames = availableUpdates.map(u => u.name);
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
    } catch (err) {
      toast.error(t('packages.batchUpdateError', { error: String(err) }));
    }
  };

  const handleInstall = async (name: string) => {
    try {
      await installPackages([name]);
      toast.success(t('packages.installSuccess', { name }));
    } catch (err) {
      toast.error(t('packages.installFailed', { error: String(err) }));
    }
  };

  const handleUninstall = async (name: string) => {
    try {
      await uninstallPackages([name]);
      toast.success(t('packages.uninstallSuccess', { name }));
    } catch (err) {
      toast.error(t('packages.uninstallFailed', { name, error: String(err) }));
    }
  };

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
    options: { providers?: string[]; installedOnly?: boolean; notInstalled?: boolean; hasUpdates?: boolean; sortBy?: string }
  ) => {
    await advancedSearch(query, {
      providers: options.providers,
      sortBy: options.sortBy,
      filters: {
        installedOnly: options.installedOnly,
        notInstalled: options.notInstalled,
        hasUpdates: options.hasUpdates,
      },
    });
    setActiveTab('search');
  }, [advancedSearch]);

  const handleBatchInstall = useCallback(async (packages: string[], options?: { dryRun?: boolean; force?: boolean }): Promise<BatchResult> => {
    const result = await batchInstall(packages, options?.dryRun, options?.force);
    if (result.successful.length > 0) {
      toast.success(t('packages.batchInstallSuccess', { count: result.successful.length }));
      await fetchInstalledPackages();
    }
    if (result.failed.length > 0) {
      toast.error(t('packages.batchInstallFailed', { count: result.failed.length }));
    }
    return result;
  }, [batchInstall, fetchInstalledPackages, t]);

  const handleBatchUninstall = useCallback(async (packages: string[], force?: boolean): Promise<BatchResult> => {
    const result = await batchUninstall(packages, force);
    if (result.successful.length > 0) {
      toast.success(t('packages.batchUninstallSuccess', { count: result.successful.length }));
      await fetchInstalledPackages();
    }
    if (result.failed.length > 0) {
      toast.error(t('packages.batchUninstallFailed', { count: result.failed.length }));
    }
    return result;
  }, [batchUninstall, fetchInstalledPackages, t]);

  const handleBatchUpdate = useCallback(async (packages?: string[]): Promise<BatchResult> => {
    const result = await batchUpdate(packages);
    if (result.successful.length > 0) {
      toast.success(t('packages.batchUpdateSuccess', { count: result.successful.length }));
      await fetchInstalledPackages();
      // Refresh updates after batch update completes
      const packageNames = installedPackages.map(p => p.name);
      const availableUpdates = await checkForUpdates(packageNames);
      setUpdates(availableUpdates);
    }
    if (result.failed.length > 0) {
      toast.error(t('packages.batchUpdateFailed', { count: result.failed.length }));
    }
    return result;
  }, [batchUpdate, fetchInstalledPackages, checkForUpdates, installedPackages, t]);

  const handleResolveDependencies = useCallback(async (packageId: string): Promise<ResolutionResult> => {
    setResolvingDeps(true);
    try {
      const result = await resolveDependencies(packageId);
      if (result) {
        setDependencyResolution(result);
        return result;
      }
      throw new Error('Failed to resolve dependencies');
    } finally {
      setResolvingDeps(false);
    }
  }, [resolveDependencies]);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header - matches design */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] font-bold text-foreground">{t('packages.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('packages.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedPackages.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComparisonOpen(true)}
            >
              <GitCompare className="h-4 w-4 mr-1" />
              Compare ({selectedPackages.length})
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <SearchBar
        providers={providers}
        onSearch={handleAdvancedSearch}
        onGetSuggestions={getSuggestions}
        loading={loading}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto bg-transparent border-b border-border rounded-none p-0 gap-0">
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
            onClick={() => setShowHistory(true)}
          >
            <History className="h-3.5 w-3.5" />
            {t('packages.history')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="mt-4">
          {loading && installedPackages.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <PackageList
              packages={installedPackages}
              type="installed"
              pinnedPackages={pinnedPackages}
              onUninstall={handleUninstall}
              onSelect={handleSelectPackage}
              onPin={handlePinPackage}
              onUnpin={handleUnpinPackage}
            />
          )}
        </TabsContent>

        <TabsContent value="updates" className="mt-4">
          <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {updates.length > 0 
                    ? t('packages.updatesAvailable', { count: availableUpdates.length })
                    : t('packages.clickToCheck')
                  }
                </p>
                {pinnedUpdates.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('packages.pinnedPackagesSkipped', { count: pinnedUpdates.length })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCheckUpdates}
                  disabled={checkingUpdates || installedPackages.length === 0}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${checkingUpdates ? 'animate-spin' : ''}`} />
                  {checkingUpdates ? t('packages.checking') : t('packages.checkForUpdates')}
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

            {checkingUpdates ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : updates.length === 0 ? (
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
            ) : (
              <div className="space-y-4">
                {/* Available Updates */}
                {availableUpdates.length > 0 && (
                  <div className="space-y-2">
                    {availableUpdates.map((update) => (
                      <Card key={update.name}>
                        <CardHeader className="py-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div>
                                <CardTitle className="text-base">{update.name}</CardTitle>
                                <CardDescription className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs">{update.current_version}</span>
                                  <ChevronRight className="h-3 w-3" />
                                  <span className="font-mono text-xs text-green-600 font-medium">{update.latest_version}</span>
                                  <Badge className="bg-muted text-muted-foreground text-xs">{update.provider}</Badge>
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handlePinPackage(update.name)}
                                title={t('packages.pinVersion')}
                              >
                                <Pin className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUpdatePackage(update.name, update.latest_version)}
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                  {update.name}
                                  <Badge variant="secondary" className="text-xs">
                                    {t('packages.pinnedAt', { version: update.current_version })}
                                  </Badge>
                                </CardTitle>
                                <CardDescription>
                                  {t('packages.availableVersion')}: {update.latest_version}
                                </CardDescription>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnpinPackage(update.name)}
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

        <TabsContent value="search" className="mt-4">
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
              onInstall={handleInstall}
              onSelect={handleSelectPackage}
              showSelectAll={false}
            />
          )}
        </TabsContent>

        <TabsContent value="dependencies" className="mt-4">
          <DependencyTree
            resolution={dependencyResolution ?? undefined}
            loading={resolvingDeps}
            onResolve={handleResolveDependencies}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
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
              </div>
            </CardHeader>
            <CardContent>
              {installHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {t('packages.noHistory')}
                </div>
              ) : (
                <div className="space-y-2">
                  {installHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        entry.success ? '' : 'border-destructive/30 bg-destructive/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
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
                        <div>
                          <div className="font-medium">{entry.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.action} • {entry.version} • {entry.provider}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
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
          const pkgWithVersion = version ? `${name}@${version}` : name;
          await installPackages([pkgWithVersion]);
        }}
        onRollback={async (name, version) => {
          try {
            await installPackages([`${name}@${version}`]);
            toast.success(t('packages.rollbackSuccess', { name, version }));
            await fetchInstalledPackages();
          } catch (err) {
            toast.error(t('packages.rollbackFailed', { error: String(err) }));
          }
        }}
        onPin={async (name) => {
          await handlePinPackage(name);
        }}
        fetchPackageInfo={fetchPackageInfo}
        isInstalled={installedPackages.some(p => p.name === selectedPackage?.name)}
        currentVersion={installedPackages.find(p => p.name === selectedPackage?.name)?.version}
      />
    </div>
  );
}
