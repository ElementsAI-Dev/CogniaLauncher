'use client';

import { useEffect, useCallback, useState } from 'react';
import { StatsCard, StatsCardSkeleton } from '@/components/dashboard/stats-card';
import { QuickSearch } from '@/components/dashboard/quick-search';
import { QuickActionsInline } from '@/components/dashboard/quick-actions';
import { EnvironmentList } from '@/components/dashboard/environment-list';
import { PackageList } from '@/components/dashboard/package-list';
import { PageHeader } from '@/components/layout/page-header';
import { useEnvironments } from '@/hooks/use-environments';
import { usePackages } from '@/hooks/use-packages';
import { useSettings } from '@/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import { Layers, Package, HardDrive, Activity } from 'lucide-react';

export default function DashboardPage() {
  const { environments, fetchEnvironments, loading: envsLoading } = useEnvironments();
  const { 
    installedPackages, 
    fetchInstalledPackages, 
    fetchProviders, 
    providers,
    loading: pkgsLoading 
  } = usePackages();
  const { 
    cacheInfo, 
    fetchCacheInfo, 
    platformInfo, 
    fetchPlatformInfo,
    loading: settingsLoading 
  } = useSettings();
  const { t } = useLocale();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchEnvironments();
    fetchInstalledPackages();
    fetchProviders();
    fetchCacheInfo();
    fetchPlatformInfo();
  }, [fetchEnvironments, fetchInstalledPackages, fetchProviders, fetchCacheInfo, fetchPlatformInfo]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchEnvironments(),
        fetchInstalledPackages(),
        fetchProviders(),
        fetchCacheInfo(),
        fetchPlatformInfo(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchEnvironments, fetchInstalledPackages, fetchProviders, fetchCacheInfo, fetchPlatformInfo]);

  const activeEnvs = environments.filter((e) => e.available).length;
  const totalVersions = environments.reduce((acc, e) => acc + e.installed_versions.length, 0);
  
  const isLoading = envsLoading || pkgsLoading || settingsLoading;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with Search and Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader 
          title={t('dashboard.title')} 
          description={t('dashboard.description')} 
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-row-reverse">
          <QuickActionsInline 
            onRefreshAll={handleRefreshAll}
            isRefreshing={isRefreshing}
          />
        </div>
      </div>

      {/* Quick Search */}
      <QuickSearch 
        environments={environments}
        packages={installedPackages}
        className="max-w-2xl"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title={t('dashboard.environments')}
              value={activeEnvs}
              description={t('dashboard.versionsInstalled', { count: totalVersions })}
              icon={<Layers className="h-4 w-4" />}
              href="/environments"
            />
            <StatsCard
              title={t('dashboard.packages')}
              value={installedPackages.length}
              description={t('dashboard.fromProviders', { count: providers.length })}
              icon={<Package className="h-4 w-4" />}
              href="/packages"
            />
            <StatsCard
              title={t('dashboard.cache')}
              value={cacheInfo?.total_size_human || '0 B'}
              description={t('dashboard.cachedItems', { count: cacheInfo?.download_cache.entry_count || 0 })}
              icon={<HardDrive className="h-4 w-4" />}
              href="/cache"
            />
            <StatsCard
              title={t('dashboard.platform')}
              value={platformInfo?.os || t('common.unknown')}
              description={platformInfo?.arch || ''}
              icon={<Activity className="h-4 w-4" />}
              href="/settings"
            />
          </>
        )}
      </div>

      {/* Main Content - Environment and Package Lists */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <EnvironmentList 
          environments={environments}
          initialLimit={4}
        />
        <PackageList 
          packages={installedPackages}
          initialLimit={5}
        />
      </div>
    </div>
  );
}
