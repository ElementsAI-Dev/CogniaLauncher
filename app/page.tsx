'use client';

import { useEffect } from 'react';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useEnvironments } from '@/lib/hooks/use-environments';
import { usePackages } from '@/lib/hooks/use-packages';
import { useSettings } from '@/lib/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import { Layers, Package, HardDrive, Activity } from 'lucide-react';

export default function DashboardPage() {
  const { environments, fetchEnvironments } = useEnvironments();
  const { installedPackages, fetchInstalledPackages, fetchProviders, providers } = usePackages();
  const { cacheInfo, fetchCacheInfo, platformInfo, fetchPlatformInfo } = useSettings();
  const { t } = useLocale();

  useEffect(() => {
    fetchEnvironments();
    fetchInstalledPackages();
    fetchProviders();
    fetchCacheInfo();
    fetchPlatformInfo();
  }, [fetchEnvironments, fetchInstalledPackages, fetchProviders, fetchCacheInfo, fetchPlatformInfo]);

  const activeEnvs = environments.filter((e) => e.available).length;
  const totalVersions = environments.reduce((acc, e) => acc + e.installed_versions.length, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('dashboard.environments')}
          value={activeEnvs}
          description={t('dashboard.versionsInstalled', { count: totalVersions })}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatsCard
          title={t('dashboard.packages')}
          value={installedPackages.length}
          description={t('dashboard.fromProviders', { count: providers.length })}
          icon={<Package className="h-4 w-4" />}
        />
        <StatsCard
          title={t('dashboard.cache')}
          value={cacheInfo?.total_size_human || '0 B'}
          description={t('dashboard.cachedItems', { count: cacheInfo?.download_cache.entry_count || 0 })}
          icon={<HardDrive className="h-4 w-4" />}
        />
        <StatsCard
          title={t('dashboard.platform')}
          value={platformInfo?.os || t('common.unknown')}
          description={platformInfo?.arch || ''}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.activeEnvironments')}</CardTitle>
            <CardDescription>{t('dashboard.activeEnvironmentsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {environments.filter((e) => e.available).length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('dashboard.noEnvironments')}</p>
            ) : (
              <div className="space-y-2">
                {environments.filter((e) => e.available).map((env) => (
                  <div key={env.env_type} className="flex items-center justify-between p-2 rounded-md bg-muted">
                    <div>
                      <p className="font-medium">{env.env_type}</p>
                      <p className="text-xs text-muted-foreground">{env.provider}</p>
                    </div>
                    <span className="text-sm font-mono">{env.current_version || t('common.none')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentPackages')}</CardTitle>
            <CardDescription>{t('dashboard.recentPackagesDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {installedPackages.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('dashboard.noPackages')}</p>
            ) : (
              <div className="space-y-2">
                {installedPackages.slice(0, 5).map((pkg) => (
                  <div key={`${pkg.provider}-${pkg.name}-${pkg.version}`} className="flex items-center justify-between p-2 rounded-md bg-muted">
                    <div>
                      <p className="font-medium">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">{pkg.provider}</p>
                    </div>
                    <span className="text-sm font-mono">{pkg.version}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
