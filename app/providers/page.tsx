'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import {
  ProviderCard,
  ProviderToolbar,
  ProviderEmptyState,
  ProviderStats,
  ProviderListItem,
  type CategoryFilter,
  type StatusFilter,
  type SortOption,
  type ViewMode,
} from '@/components/provider-management';
import { usePackages } from '@/lib/hooks/use-packages';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle } from 'lucide-react';
import * as tauri from '@/lib/tauri';
import { toast } from 'sonner';

const SYSTEM_PROVIDER_IDS = new Set([
  'apt', 'dnf', 'pacman', 'zypper', 'apk', 'brew', 'macports',
  'chocolatey', 'scoop', 'winget', 'flatpak', 'snap',
]);

const PACKAGE_MANAGER_IDS = new Set([
  'npm', 'pnpm', 'yarn', 'pip', 'uv', 'cargo', 'vcpkg', 'docker', 'psgallery', 'github',
]);

export default function ProvidersPage() {
  const { providers, loading, error, fetchProviders } = usePackages();
  const { t } = useLocale();
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [providerStatus, setProviderStatus] = useState<Record<string, boolean>>({});
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchProviders();
    }
  }, [fetchProviders]);

  const handleToggleProvider = useCallback(async (providerId: string, enabled: boolean) => {
    setTogglingProvider(providerId);
    try {
      if (enabled) {
        await tauri.providerEnable(providerId);
        toast.success(t('providers.enableSuccess', { name: providerId }));
      } else {
        await tauri.providerDisable(providerId);
        toast.success(t('providers.disableSuccess', { name: providerId }));
      }
      await fetchProviders();
    } catch {
      toast.error(enabled 
        ? t('providers.enableError', { name: providerId })
        : t('providers.disableError', { name: providerId })
      );
    } finally {
      setTogglingProvider(null);
    }
  }, [fetchProviders, t]);

  const handleCheckStatus = useCallback(async (providerId: string): Promise<boolean> => {
    try {
      const available = await tauri.providerCheck(providerId);
      setProviderStatus((prev) => ({ ...prev, [providerId]: available }));
      if (available) {
        toast.success(t('providers.checkSuccess', { name: providerId }));
      } else {
        toast.warning(t('providers.checkFailed', { name: providerId }));
      }
      return available;
    } catch {
      toast.error(t('providers.checkError', { name: providerId }));
      return false;
    }
  }, [t]);

  const handleCheckAllStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const statusResults = await tauri.providerStatusAll();
      const newStatus: Record<string, boolean> = {};
      for (const status of statusResults) {
        newStatus[status.id] = status.installed;
      }
      setProviderStatus(newStatus);
      toast.success(t('providers.checkAllSuccess'));
    } catch {
      toast.error(t('providers.checkAllError'));
    } finally {
      setIsCheckingStatus(false);
    }
  }, [t]);

  const handleRefresh = useCallback(async () => {
    await fetchProviders();
  }, [fetchProviders]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
  }, []);

  const getProviderCategory = useCallback((provider: tauri.ProviderInfo): CategoryFilter => {
    if (provider.is_environment_provider) return 'environment';
    if (SYSTEM_PROVIDER_IDS.has(provider.id)) return 'system';
    if (PACKAGE_MANAGER_IDS.has(provider.id)) return 'package';
    return 'package';
  }, []);

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = provider.display_name.toLowerCase().includes(query);
        const matchesId = provider.id.toLowerCase().includes(query);
        const matchesCapabilities = provider.capabilities.some((cap) =>
          cap.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesId && !matchesCapabilities) {
          return false;
        }
      }

      if (categoryFilter !== 'all') {
        const providerCategory = getProviderCategory(provider);
        if (providerCategory !== categoryFilter) {
          return false;
        }
      }

      if (statusFilter !== 'all') {
        const isAvailable = providerStatus[provider.id];
        if (statusFilter === 'available' && isAvailable === false) {
          return false;
        }
        if (statusFilter === 'unavailable' && isAvailable !== false) {
          return false;
        }
        if (statusFilter === 'enabled' && !provider.enabled) {
          return false;
        }
        if (statusFilter === 'disabled' && provider.enabled) {
          return false;
        }
      }

      return true;
    });
  }, [providers, searchQuery, categoryFilter, statusFilter, providerStatus, getProviderCategory]);

  const sortedProviders = useMemo(() => {
    const sorted = [...filteredProviders];
    switch (sortOption) {
      case 'name-asc':
        sorted.sort((a, b) => a.display_name.localeCompare(b.display_name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.display_name.localeCompare(a.display_name));
        break;
      case 'priority-asc':
        sorted.sort((a, b) => a.priority - b.priority);
        break;
      case 'priority-desc':
        sorted.sort((a, b) => b.priority - a.priority);
        break;
      case 'status':
        sorted.sort((a, b) => {
          const aAvailable = providerStatus[a.id] ? 1 : 0;
          const bAvailable = providerStatus[b.id] ? 1 : 0;
          return bAvailable - aAvailable;
        });
        break;
    }
    return sorted;
  }, [filteredProviders, sortOption, providerStatus]);

  const stats = useMemo(() => {
    const total = providers.length;
    const enabled = providers.filter((p) => p.enabled).length;
    const available = Object.values(providerStatus).filter((v) => v === true).length;
    const unavailable = Object.values(providerStatus).filter((v) => v === false).length;
    return { total, enabled, available, unavailable };
  }, [providers, providerStatus]);

  const hasFilters = searchQuery !== '' || categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title={t('providers.title')} description={t('providers.description')} />

      <ProviderToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sortOption={sortOption}
        onSortChange={setSortOption}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={handleRefresh}
        onCheckAllStatus={handleCheckAllStatus}
        isLoading={loading}
        isCheckingStatus={isCheckingStatus}
        t={t}
      />

      <ProviderStats
        total={stats.total}
        enabled={stats.enabled}
        available={stats.available}
        unavailable={stats.unavailable}
        t={t}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && providers.length === 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <div className="flex gap-1">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-14" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedProviders.length === 0 ? (
        <ProviderEmptyState
          hasFilters={hasFilters}
          onClearFilters={handleClearFilters}
          t={t}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {sortedProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isAvailable={providerStatus[provider.id]}
              isToggling={togglingProvider === provider.id}
              onToggle={handleToggleProvider}
              onCheckStatus={handleCheckStatus}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedProviders.map((provider) => (
            <ProviderListItem
              key={provider.id}
              provider={provider}
              isAvailable={providerStatus[provider.id]}
              isToggling={togglingProvider === provider.id}
              onToggle={handleToggleProvider}
              onCheckStatus={handleCheckStatus}
              t={t}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('providers.infoTitle')}</CardTitle>
          <CardDescription>{t('providers.infoDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-sm text-muted-foreground">
            {t('providers.infoText')}
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>
              <strong>{t('providers.infoEnvironment')}</strong>: {t('providers.infoEnvironmentDesc')}
            </li>
            <li>
              <strong>{t('providers.infoJsPackage')}</strong>: {t('providers.infoJsPackageDesc')}
            </li>
            <li>
              <strong>{t('providers.infoPyPackage')}</strong>: {t('providers.infoPyPackageDesc')}
            </li>
            <li>
              <strong>{t('providers.infoRustPackage')}</strong>: {t('providers.infoRustPackageDesc')}
            </li>
            <li>
              <strong>{t('providers.infoSystem')}</strong>: {t('providers.infoSystemDesc')}
            </li>
            <li>
              <strong>{t('providers.infoCpp')}</strong>: {t('providers.infoCppDesc')}
            </li>
            <li>
              <strong>{t('providers.infoContainer')}</strong>: {t('providers.infoContainerDesc')}
            </li>
            <li>
              <strong>{t('providers.infoPowershell')}</strong>: {t('providers.infoPowershellDesc')}
            </li>
            <li>
              <strong>{t('providers.infoCustom')}</strong>: {t('providers.infoCustomDesc')}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
