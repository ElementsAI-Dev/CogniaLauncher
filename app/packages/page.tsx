'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { AlertCircle, RefreshCw, ArrowUp, GitBranch, GitCompare } from 'lucide-react';
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

  useEffect(() => {
    fetchProviders();
    fetchInstalledPackages();
  }, [fetchProviders, fetchInstalledPackages]);

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const packageNames = installedPackages.map(p => p.name);
      const availableUpdates = await checkForUpdates(packageNames);
      setUpdates(availableUpdates);
      if (availableUpdates.length > 0) {
        toast.success(`Found ${availableUpdates.length} updates available`);
      } else {
        toast.info('All packages are up to date');
      }
    } catch (err) {
      toast.error(`Failed to check updates: ${err}`);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleUpdatePackage = async (name: string, version: string) => {
    try {
      await installPackages([`${name}@${version}`]);
      toast.success(`Updated ${name} to ${version}`);
      setUpdates(prev => prev.filter(u => u.name !== name));
      await fetchInstalledPackages();
    } catch (err) {
      toast.error(`Failed to update ${name}: ${err}`);
    }
  };

  const handleInstall = async (name: string) => {
    try {
      await installPackages([name]);
      toast.success(`Successfully installed ${name}`);
    } catch (err) {
      toast.error(`Install failed: ${err}`);
    }
  };

  const handleUninstall = async (name: string) => {
    try {
      await uninstallPackages([name]);
      toast.success(`Successfully uninstalled ${name}`);
    } catch (err) {
      toast.error(`Uninstall failed: ${err}`);
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
      toast.success(`Successfully installed ${result.successful.length} package(s)`);
      await fetchInstalledPackages();
    }
    if (result.failed.length > 0) {
      toast.error(`${result.failed.length} package(s) failed to install`);
    }
    return result;
  }, [batchInstall, fetchInstalledPackages]);

  const handleBatchUninstall = useCallback(async (packages: string[], force?: boolean): Promise<BatchResult> => {
    const result = await batchUninstall(packages, force);
    if (result.successful.length > 0) {
      toast.success(`Successfully uninstalled ${result.successful.length} package(s)`);
      await fetchInstalledPackages();
    }
    if (result.failed.length > 0) {
      toast.error(`${result.failed.length} package(s) failed to uninstall`);
    }
    return result;
  }, [batchUninstall, fetchInstalledPackages]);

  const handleBatchUpdate = useCallback(async (packages?: string[]): Promise<BatchResult> => {
    const result = await batchUpdate(packages);
    if (result.successful.length > 0) {
      toast.success(`Successfully updated ${result.successful.length} package(s)`);
      await fetchInstalledPackages();
      // Refresh updates after batch update completes
      const packageNames = installedPackages.map(p => p.name);
      const availableUpdates = await checkForUpdates(packageNames);
      setUpdates(availableUpdates);
    }
    if (result.failed.length > 0) {
      toast.error(`${result.failed.length} package(s) failed to update`);
    }
    return result;
  }, [batchUpdate, fetchInstalledPackages, checkForUpdates, installedPackages]);

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
        </TabsList>

        <TabsContent value="installed">
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
              onUninstall={handleUninstall}
              onSelect={handleSelectPackage}
            />
          )}
        </TabsContent>

        <TabsContent value="updates">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {updates.length > 0 
                  ? t('packages.updatesAvailable', { count: updates.length })
                  : t('packages.clickToCheck')
                }
              </p>
              <Button 
                variant="outline" 
                onClick={handleCheckUpdates}
                disabled={checkingUpdates || installedPackages.length === 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checkingUpdates ? 'animate-spin' : ''}`} />
                {checkingUpdates ? t('packages.checking') : t('packages.checkForUpdates')}
              </Button>
            </div>

            {checkingUpdates ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : updates.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t('packages.noUpdates')}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {updates.map((update) => (
                  <Card key={update.name}>
                    <CardHeader className="py-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{update.name}</CardTitle>
                          <CardDescription className="flex items-center gap-2 flex-wrap">
                            <span>{update.current_version}</span>
                            <ArrowUp className="h-3 w-3" />
                            <span className="text-green-600 font-medium">{update.latest_version}</span>
                            <Badge variant="secondary">{update.provider}</Badge>
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleUpdatePackage(update.name, update.latest_version)}
                        >
                          <ArrowUp className="h-4 w-4 mr-1" />
                          {t('common.update')}
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="search">
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
            />
          )}
        </TabsContent>

        <TabsContent value="dependencies">
          <DependencyTree
            resolution={dependencyResolution ?? undefined}
            loading={resolvingDeps}
            onResolve={handleResolveDependencies}
          />
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
        fetchPackageInfo={fetchPackageInfo}
      />
    </div>
  );
}
