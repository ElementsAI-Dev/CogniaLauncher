'use client';

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadingSkeleton } from '@/components/layout/page-loading-skeleton';
import {
  ProviderCard,
  ProviderToolbar,
  ProviderEmptyState,
  ProviderStats,
  ProviderListItem,
  ProviderGridSkeleton,
} from '@/components/provider-management';
import { usePackages } from '@/hooks/use-packages';
import { useProviderFilters } from '@/hooks/use-provider-filters';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import * as tauri from '@/lib/tauri';
import { SYSTEM_PROVIDER_IDS, isPackageManagerProvider } from '@/lib/constants/providers';
import {
  getProviderStatusSortValue,
  getProviderStatusState,
  isProviderStatusAvailable,
} from '@/lib/utils/provider';
import { emitInvalidations } from '@/lib/cache/invalidation';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const INFO_COLLAPSED_KEY = 'cognia:providers-info-collapsed';

function ProvidersPageContent() {
  const { providers, loading, error, fetchProviders } = usePackages();
  const { t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    searchQuery, setSearchQuery,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    platformFilter, setPlatformFilter,
    sortOption, setSortOption,
    viewMode, setViewMode,
    hasFilters, clearFilters,
    buildDetailHref,
  } = useProviderFilters({
    pathname,
    searchParams,
    replaceUrl: (url, opts) => router.replace(url, opts),
  });

  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<Record<string, tauri.ProviderStatusInfo>>({});
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [infoOpen, setInfoOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(INFO_COLLAPSED_KEY) !== 'true';
  });
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      void fetchProviders();
    }
  }, [fetchProviders]);

  const handleToggleProvider = useCallback(async (providerId: string, enabled: boolean) => {
    setTogglingProvider(providerId);
    setProviderStatus((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });

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
      toast.error(
        enabled
          ? t('providers.enableError', { name: providerId })
          : t('providers.disableError', { name: providerId }),
      );
    } finally {
      emitInvalidations(
        ['provider_data', 'package_data', 'environment_data'],
        'providers-page:toggle-provider',
      );
      setTogglingProvider(null);
    }
  }, [fetchProviders, t]);

  const handleCheckStatus = useCallback(async (providerId: string): Promise<tauri.ProviderStatusInfo> => {
    try {
      const status = await tauri.providerStatus(providerId);
      setProviderStatus((prev) => ({ ...prev, [providerId]: status }));
      if (isProviderStatusAvailable(status) === true) {
        toast.success(t('providers.checkSuccess', { name: providerId }));
      } else {
        toast.warning(t('providers.checkFailed', { name: providerId }));
      }
      return status;
    } catch {
      toast.error(t('providers.checkError', { name: providerId }));
      return {
        id: providerId,
        display_name: providerId,
        installed: false,
        platforms: [],
        scope_state: 'unavailable',
      };
    }
  }, [t]);

  const handleCheckAllStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const statusResults = await tauri.providerStatusAll(true);
      const newStatus: Record<string, tauri.ProviderStatusInfo> = {};
      for (const status of statusResults) {
        newStatus[status.id] = status;
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
    setProviderStatus({});
    await fetchProviders();
    emitInvalidations(
      ['provider_data', 'package_data', 'environment_data'],
      'providers-page:refresh',
    );
  }, [fetchProviders]);

  const getProviderCategory = useCallback((provider: tauri.ProviderInfo) => {
    if (provider.is_environment_provider) return 'environment';
    if (SYSTEM_PROVIDER_IDS.has(provider.id)) return 'system';
    return 'package';
  }, []);

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = provider.display_name.toLowerCase().includes(query);
        const matchesId = provider.id.toLowerCase().includes(query);
        const matchesCapabilities = provider.capabilities.some((cap) =>
          cap.toLowerCase().includes(query),
        );
        if (!matchesName && !matchesId && !matchesCapabilities) return false;
      }

      if (categoryFilter !== 'all' && getProviderCategory(provider) !== categoryFilter) return false;
      if (platformFilter !== 'all' && !provider.platforms.includes(platformFilter)) return false;

      if (statusFilter !== 'all') {
        const statusState = getProviderStatusState(providerStatus[provider.id]);
        if (statusFilter === 'available' && statusState !== 'available') return false;
        if (statusFilter === 'unavailable' && !['unavailable', 'timeout', 'unsupported'].includes(statusState)) return false;
        if (statusFilter === 'enabled' && !provider.enabled) return false;
        if (statusFilter === 'disabled' && provider.enabled) return false;
      }

      return true;
    });
  }, [providers, searchQuery, categoryFilter, platformFilter, statusFilter, providerStatus, getProviderCategory]);

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
        sorted.sort((a, b) => (
          getProviderStatusSortValue(providerStatus[b.id]) -
          getProviderStatusSortValue(providerStatus[a.id])
        ));
        break;
    }
    return sorted;
  }, [filteredProviders, sortOption, providerStatus]);

  const hasStatusData = Object.keys(providerStatus).length > 0;

  const stats = useMemo(() => {
    const total = providers.length;
    const enabled = providers.filter((p) => p.enabled).length;
    const available = Object.values(providerStatus).filter(
      (s) => getProviderStatusState(s) === 'available',
    ).length;
    const unavailable = Object.values(providerStatus).filter((s) =>
      ['unavailable', 'timeout', 'unsupported'].includes(getProviderStatusState(s)),
    ).length;
    const environmentCount = providers.filter((p) => p.is_environment_provider).length;
    const packageCount = providers.filter((p) => isPackageManagerProvider(p)).length;
    const systemCount = providers.filter((p) => SYSTEM_PROVIDER_IDS.has(p.id)).length;
    return { total, enabled, available, unavailable, environmentCount, packageCount, systemCount };
  }, [providers, providerStatus]);

  const handleEnableAll = useCallback(async () => {
    try {
      const toEnable = providers.filter((p) => !p.enabled);
      await Promise.all(toEnable.map((p) => tauri.providerEnable(p.id)));
      setProviderStatus({});
      await fetchProviders();
      emitInvalidations(
        ['provider_data', 'package_data', 'environment_data'],
        'providers-page:enable-all',
      );
      toast.success(t('providers.enableAllSuccess'));
    } catch {
      toast.error(t('providers.enableAllError'));
    }
  }, [providers, fetchProviders, t]);

  const handleDisableAll = useCallback(async () => {
    try {
      const toDisable = providers.filter((p) => p.enabled);
      await Promise.all(toDisable.map((p) => tauri.providerDisable(p.id)));
      setProviderStatus({});
      await fetchProviders();
      emitInvalidations(
        ['provider_data', 'package_data', 'environment_data'],
        'providers-page:disable-all',
      );
      toast.success(t('providers.disableAllSuccess'));
    } catch {
      toast.error(t('providers.disableAllError'));
    }
  }, [providers, fetchProviders, t]);

  const handleInfoToggle = useCallback((open: boolean) => {
    setInfoOpen(open);
    localStorage.setItem(INFO_COLLAPSED_KEY, open ? 'false' : 'true');
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6" data-hint="providers-status">
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
        platformFilter={platformFilter}
        onPlatformChange={setPlatformFilter}
        onRefresh={handleRefresh}
        onCheckAllStatus={handleCheckAllStatus}
        onEnableAll={handleEnableAll}
        onDisableAll={handleDisableAll}
        isLoading={loading}
        isCheckingStatus={isCheckingStatus}
        providerCount={sortedProviders.length}
        totalCount={providers.length}
      />

      {hasStatusData && (
        <ProviderStats
          total={stats.total}
          enabled={stats.enabled}
          available={stats.available}
          unavailable={stats.unavailable}
          environmentCount={stats.environmentCount}
          packageCount={stats.packageCount}
          systemCount={stats.systemCount}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && providers.length === 0 ? (
        <ProviderGridSkeleton />
      ) : sortedProviders.length === 0 ? (
        <ProviderEmptyState
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {sortedProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              statusInfo={providerStatus[provider.id]}
              isAvailable={providerStatus[provider.id]?.installed}
              isToggling={togglingProvider === provider.id}
              detailHref={buildDetailHref(provider.id)}
              onToggle={handleToggleProvider}
              onCheckStatus={handleCheckStatus}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedProviders.map((provider) => (
            <ProviderListItem
              key={provider.id}
              provider={provider}
              statusInfo={providerStatus[provider.id]}
              isAvailable={providerStatus[provider.id]?.installed}
              isToggling={togglingProvider === provider.id}
              detailHref={buildDetailHref(provider.id)}
              onToggle={handleToggleProvider}
              onCheckStatus={handleCheckStatus}
            />
          ))}
        </div>
      )}

      <Collapsible open={infoOpen} onOpenChange={handleInfoToggle}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('providers.infoTitle')}</CardTitle>
                  <CardDescription>{t('providers.infoDescription')}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {infoOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-0">
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
                <li>
                  <strong>{t('providers.infoWsl')}</strong>: {t('providers.infoWslDesc')}
                </li>
              </ul>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

export default function ProvidersPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="cards" />}>
      <ProvidersPageContent />
    </Suspense>
  );
}
