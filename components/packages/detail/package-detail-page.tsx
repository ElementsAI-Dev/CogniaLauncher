'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/layout/page-header';
import { PackageOverviewCard } from '@/components/packages/detail/package-overview-card';
import { PackageVersionList } from '@/components/packages/detail/package-version-list';
import { PackageDependencyView } from '@/components/packages/detail/package-dependency-view';
import { PackageHistoryList } from '@/components/packages/detail/package-history-list';
import { usePackages } from '@/hooks/use-packages';
import { usePackageStore } from '@/lib/stores/packages';
import { useLocale } from '@/components/providers/locale-provider';
import {
  ArrowLeft,
  LayoutDashboard,
  Layers,
  GitBranch,
  History,
  AlertCircle,
  RefreshCw,
  Package,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PackageInfo, ResolutionResult, InstallHistoryEntry } from '@/lib/tauri';

interface PackageDetailPageProps {
  packageName: string;
  providerId?: string;
}

export function PackageDetailPage({ packageName, providerId }: PackageDetailPageProps) {
  const router = useRouter();
  const { t } = useLocale();

  const {
    fetchPackageInfo,
    fetchInstalledPackages,
    installPackages,
    uninstallPackages,
    rollbackPackage,
    pinPackage,
    unpinPackage,
    resolveDependencies,
    getPackageHistory,
    installedPackages,
    pinnedPackages,
    installing,
    error,
  } = usePackages();

  const { bookmarkedPackages, toggleBookmark } = usePackageStore();

  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Dependency resolution state
  const [resolution, setResolution] = useState<ResolutionResult | null>(null);
  const [resolvingDeps, setResolvingDeps] = useState(false);

  // History state
  const [history, setHistory] = useState<InstallHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Derived state
  const installedPkg = useMemo(() =>
    installedPackages.find(
      (p) => p.name === packageName && (!providerId || p.provider === providerId)
    ),
    [installedPackages, packageName, providerId]
  );

  const isInstalled = !!installedPkg;
  const isPinned = pinnedPackages.includes(packageName);
  const isBookmarked = bookmarkedPackages.includes(packageName);
  const isInstalling = installing.includes(
    providerId ? `${providerId}:${packageName}` : packageName
  );

  const latestVersion = packageInfo?.versions?.[0]?.version ?? null;
  const hasUpdate = isInstalled && latestVersion && installedPkg?.version !== latestVersion;

  // Load package info
  const loadPackageInfo = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const info = await fetchPackageInfo(packageName, providerId);
      if (info) {
        setPackageInfo(info);
      } else {
        setLoadError(t('packages.detail.failedToLoad'));
      }
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }, [packageName, providerId, fetchPackageInfo, t]);

  // Load history when tab is activated
  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const entries = await getPackageHistory(packageName);
      setHistory(entries);
      setHistoryLoaded(true);
    } catch {
      // History load failure is non-critical
    }
  }, [packageName, getPackageHistory, historyLoaded]);

  useEffect(() => {
    loadPackageInfo();
    fetchInstalledPackages();
  }, [loadPackageInfo, fetchInstalledPackages]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Action handlers
  const handleInstall = useCallback(async (version?: string) => {
    const pkgId = providerId ? `${providerId}:${packageName}` : packageName;
    const pkgWithVersion = version ? `${pkgId}@${version}` : pkgId;
    try {
      await installPackages([pkgWithVersion]);
      toast.success(t('packages.detail.installSuccessDetail', { name: packageName, version: version || 'latest' }));
      await fetchInstalledPackages();
      await loadPackageInfo();
    } catch (err) {
      toast.error(t('packages.installFailed', { error: String(err) }));
    }
  }, [packageName, providerId, installPackages, fetchInstalledPackages, loadPackageInfo, t]);

  const handleUninstall = useCallback(async () => {
    const pkgId = providerId ? `${providerId}:${packageName}` : packageName;
    try {
      await uninstallPackages([pkgId]);
      toast.success(t('packages.detail.uninstallSuccessDetail', { name: packageName }));
      await fetchInstalledPackages();
    } catch (err) {
      toast.error(t('packages.uninstallFailed', { name: packageName, error: String(err) }));
    }
  }, [packageName, providerId, uninstallPackages, fetchInstalledPackages, t]);

  const handleRollback = useCallback(async (version: string) => {
    try {
      await rollbackPackage(packageName, version);
      toast.success(t('packages.rollbackSuccess', { name: packageName, version }));
      await fetchInstalledPackages();
      setHistoryLoaded(false); // Refresh history
    } catch (err) {
      toast.error(t('packages.rollbackFailed', { error: String(err) }));
    }
  }, [packageName, rollbackPackage, fetchInstalledPackages, t]);

  const handlePin = useCallback(async () => {
    try {
      await pinPackage(packageName, installedPkg?.version);
      toast.success(t('packages.pinned', { name: packageName }));
    } catch (err) {
      toast.error(t('packages.pinFailed', { name: packageName, error: String(err) }));
    }
  }, [packageName, installedPkg, pinPackage, t]);

  const handleUnpin = useCallback(async () => {
    try {
      await unpinPackage(packageName);
      toast.success(t('packages.unpinned', { name: packageName }));
    } catch (err) {
      toast.error(t('packages.unpinFailed', { name: packageName, error: String(err) }));
    }
  }, [packageName, unpinPackage, t]);

  const handleResolveDeps = useCallback(async () => {
    setResolvingDeps(true);
    try {
      const pkgId = providerId ? `${providerId}:${packageName}` : packageName;
      const result = await resolveDependencies(pkgId);
      if (result) {
        setResolution(result);
      }
    } catch {
      toast.error(t('packages.resolutionFailed'));
    } finally {
      setResolvingDeps(false);
    }
  }, [packageName, providerId, resolveDependencies, t]);

  const handleBookmark = useCallback(() => {
    toggleBookmark(packageName);
    toast.success(
      isBookmarked
        ? t('packages.bookmarkRemoved', { name: packageName })
        : t('packages.bookmarkAdded', { name: packageName })
    );
  }, [packageName, isBookmarked, toggleBookmark, t]);

  const handleRefresh = useCallback(async () => {
    setHistoryLoaded(false);
    await loadPackageInfo();
    await fetchInstalledPackages();
    toast.success(t('providers.refreshed'));
  }, [loadPackageInfo, fetchInstalledPackages, t]);

  // Loading state
  if (loading && !packageInfo) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  // Error state
  if (loadError && !packageInfo) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/packages')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('packages.detail.backToPackages')}
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <Button onClick={loadPackageInfo}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('packages.detail.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push('/packages')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <PageHeader
            title={
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-muted-foreground" />
                <span className="truncate">{packageInfo?.display_name || packageName}</span>
                {isInstalled ? (
                  <Badge variant="default" className="gap-1 shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    {installedPkg?.version}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <XCircle className="h-3 w-3" />
                    {t('packages.detail.notInstalled')}
                  </Badge>
                )}
                {hasUpdate && (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 shrink-0">
                    {t('packages.detail.updateAvailable', { current: installedPkg!.version, latest: latestVersion! })}
                  </Badge>
                )}
                {isPinned && (
                  <Badge variant="outline" className="shrink-0">📌 {t('packages.pinnedAt', { version: installedPkg?.version || '' })}</Badge>
                )}
              </div>
            }
            description={packageInfo?.description || t('packages.detail.noDescription')}
            actions={
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('packages.detail.refreshData')}
              </Button>
            }
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t('packages.detail.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {t('packages.detail.tabVersions')}
            {packageInfo?.versions?.length ? (
              <Badge variant="secondary" className="ml-1 rounded px-1.5 py-0 text-xs h-5">
                {packageInfo.versions.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            {t('packages.detail.tabDependencies')}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            {t('packages.detail.tabHistory')}
            {history.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded px-1.5 py-0 text-xs h-5">
                {history.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PackageOverviewCard
            packageInfo={packageInfo}
            installedPkg={installedPkg ?? null}
            isInstalled={isInstalled}
            isPinned={isPinned}
            isBookmarked={isBookmarked}
            isInstalling={isInstalling}
            hasUpdate={!!hasUpdate}
            latestVersion={latestVersion}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
            onPin={handlePin}
            onUnpin={handleUnpin}
            onBookmark={handleBookmark}
            onRollback={handleRollback}
          />
        </TabsContent>

        <TabsContent value="versions">
          <PackageVersionList
            versions={packageInfo?.versions ?? []}
            currentVersion={installedPkg?.version ?? null}
            isInstalled={isInstalled}
            isInstalling={isInstalling}
            onInstall={handleInstall}
            onRollback={handleRollback}
          />
        </TabsContent>

        <TabsContent value="dependencies">
          <PackageDependencyView
            resolution={resolution}
            loading={resolvingDeps}
            onResolve={handleResolveDeps}
          />
        </TabsContent>

        <TabsContent value="history">
          <PackageHistoryList
            history={history}
            loading={!historyLoaded}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
