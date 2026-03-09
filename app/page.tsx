'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { CustomizeDialog } from '@/components/dashboard/customize-dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEnvironments } from '@/hooks/use-environments';
import { usePackages } from '@/hooks/use-packages';
import { useSettings } from '@/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import { useDashboardStore } from '@/lib/stores/dashboard';
import { isTauri } from '@/lib/tauri';
import {
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';
import { Settings2, Pencil, Check, AlertCircle, X, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { environments, fetchEnvironments, loading: envsLoading, error: envsError } = useEnvironments();
  const {
    installedPackages,
    fetchInstalledPackages,
    fetchProviders,
    providers,
    loading: pkgsLoading,
    error: pkgsError,
  } = usePackages();
  const {
    cacheInfo,
    fetchCacheInfo,
    platformInfo,
    fetchPlatformInfo,
    cogniaDir,
    loading: settingsLoading,
    error: settingsError,
  } = useSettings();
  const { t } = useLocale();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [dismissedErrorSignature, setDismissedErrorSignature] = useState<string | null>(null);
  const initialFetchDone = useRef(false);
  const cacheRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCustomizing = useDashboardStore((s) => s.isCustomizing);
  const isEditMode = useDashboardStore((s) => s.isEditMode);
  const setIsCustomizing = useDashboardStore((s) => s.setIsCustomizing);
  const setIsEditMode = useDashboardStore((s) => s.setIsEditMode);

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    // Phased loading to avoid firing all heavy backend calls at once.
    // Phase 1 (immediate, lightweight): provider metadata + platform info
    // Phase 2 (deferred): cache info
    // Phase 3 (after Phase 1): environments + packages (heaviest — subprocess spawns)
    const loadData = async () => {
      // Phase 1: lightweight metadata (no subprocess spawns)
      await Promise.all([
        fetchProviders(),
        fetchPlatformInfo(),
      ]);

      // Phase 2: cache info (moderate I/O, deferred)
      fetchCacheInfo();

      // Phase 3: heavy scans (subprocess-intensive, run after UI has rendered)
      await Promise.all([
        fetchEnvironments(),
        fetchInstalledPackages(),
      ]);

      setLastRefreshed(new Date());
    };

    loadData();
  }, [fetchEnvironments, fetchInstalledPackages, fetchProviders, fetchCacheInfo, fetchPlatformInfo]);

  const scheduleCacheInfoRefresh = useCallback(() => {
    if (!isTauri()) return;
    if (cacheRefreshTimeoutRef.current) return;

    cacheRefreshTimeoutRef.current = setTimeout(() => {
      cacheRefreshTimeoutRef.current = null;
      void fetchCacheInfo();
    }, 350);
  }, [fetchCacheInfo]);

  useEffect(() => {
    if (!isTauri()) return;
    void ensureCacheInvalidationBridge();
    const dispose = subscribeInvalidation(
      ['cache_overview', 'about_cache_stats'],
      withThrottle(() => {
        scheduleCacheInfoRefresh();
      }, 350),
    );

    return () => {
      if (cacheRefreshTimeoutRef.current) {
        clearTimeout(cacheRefreshTimeoutRef.current);
        cacheRefreshTimeoutRef.current = null;
      }
      dispose();
    };
  }, [scheduleCacheInfoRefresh]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    setDismissedErrorSignature(null);
    try {
      await Promise.all([
        fetchEnvironments(true),
        fetchInstalledPackages(undefined, true),
        fetchProviders(),
        fetchCacheInfo(),
        fetchPlatformInfo(),
      ]);
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchEnvironments, fetchInstalledPackages, fetchProviders, fetchCacheInfo, fetchPlatformInfo]);

  const handleToggleEditMode = useCallback(() => {
    const next = !isEditMode;
    setIsEditMode(next);

    // Keep dialog/edit states coherent: closing edit mode closes dialog too.
    if (!next && isCustomizing) {
      setIsCustomizing(false);
    }
  }, [isCustomizing, isEditMode, setIsCustomizing, setIsEditMode]);

  const handleOpenCustomize = useCallback(() => {
    if (!isEditMode) {
      setIsEditMode(true);
    }
    setIsCustomizing(true);
  }, [isEditMode, setIsCustomizing, setIsEditMode]);

  const handleCustomizeDialogChange = useCallback(
    (open: boolean) => {
      if (open && !isEditMode) {
        setIsEditMode(true);
      }
      setIsCustomizing(open);
    },
    [isEditMode, setIsCustomizing, setIsEditMode],
  );

  const combinedError = envsError || pkgsError || settingsError;
  const errorSignature = [envsError ?? '', pkgsError ?? '', settingsError ?? ''].join('|');
  const activeError = combinedError && dismissedErrorSignature !== errorSignature
    ? combinedError
    : null;

  useEffect(() => {
    if (!combinedError) {
      setDismissedErrorSignature(null);
    }
  }, [combinedError]);
  const lastRefreshedText = lastRefreshed
    ? t('dashboard.lastUpdated', { time: lastRefreshed.toLocaleTimeString() })
    : null;

  const isLoading = envsLoading || pkgsLoading || settingsLoading;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5 p-4 md:space-y-6 md:p-6">
        {/* Header with Customize Controls */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <PageHeader
            title={t('dashboard.title')}
            description={t('dashboard.description')}
          />
          <div className="flex flex-wrap items-center gap-2 sm:justify-start xl:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="gap-2"
              data-testid="dashboard-header-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('dashboard.quickActions.refreshAll')}</span>
            </Button>
            <Button
              variant={isEditMode ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleEditMode}
              className="gap-2"
              data-testid="dashboard-header-edit-mode"
            >
              {isEditMode ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('dashboard.widgets.doneEditing')}</span>
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('dashboard.widgets.editLayout')}</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCustomize}
              className="gap-2"
              data-hint="dashboard-customize"
              data-testid="dashboard-header-customize"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dashboard.widgets.customize')}</span>
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {activeError && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              <span className="flex-1">{activeError}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('common.close')}
                onClick={() => setDismissedErrorSignature(errorSignature)}
                className="h-6 w-6 text-destructive/70 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Edit Mode Banner */}
        {isEditMode && (
          <Alert className="border-dashed border-primary/50 bg-primary/5 text-primary">
            <Pencil className="h-4 w-4" />
            <AlertDescription>{t('dashboard.widgets.editModeHint')}</AlertDescription>
          </Alert>
        )}

        {/* Customizable Widget Grid */}
        <WidgetGrid
          environments={environments}
          packages={installedPackages}
          providers={providers}
          cacheInfo={cacheInfo}
          platformInfo={platformInfo}
          cogniaDir={cogniaDir}
          isLoading={isLoading}
          onRefreshAll={handleRefreshAll}
          isRefreshing={isRefreshing}
        />

        {/* Last Refreshed */}
        {lastRefreshedText && (
          <div className="text-center text-xs text-muted-foreground">
            {lastRefreshedText}
          </div>
        )}

        {/* Customize Dialog */}
        <CustomizeDialog
          open={isCustomizing}
          onOpenChange={handleCustomizeDialogChange}
        />
      </div>
    </TooltipProvider>
  );
}
