'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { CustomizeDialog } from '@/components/dashboard/customize-dialog';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEnvironments } from '@/hooks/use-environments';
import { usePackages } from '@/hooks/use-packages';
import { useSettings } from '@/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import { useDashboardStore } from '@/lib/stores/dashboard';
import { Settings2, Pencil, Check, AlertCircle, X } from 'lucide-react';

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
  const [dismissedError, setDismissedError] = useState(false);
  const initialFetchDone = useRef(false);
  const isCustomizing = useDashboardStore((s) => s.isCustomizing);
  const isEditMode = useDashboardStore((s) => s.isEditMode);
  const setIsCustomizing = useDashboardStore((s) => s.setIsCustomizing);
  const setIsEditMode = useDashboardStore((s) => s.setIsEditMode);

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    Promise.all([
      fetchEnvironments(),
      fetchInstalledPackages(),
      fetchProviders(),
      fetchCacheInfo(),
      fetchPlatformInfo(),
    ]).then(() => {
      setLastRefreshed(new Date());
    });
  }, [fetchEnvironments, fetchInstalledPackages, fetchProviders, fetchCacheInfo, fetchPlatformInfo]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    setDismissedError(false);
    try {
      await Promise.all([
        fetchEnvironments(),
        fetchInstalledPackages(),
        fetchProviders(),
        fetchCacheInfo(),
        fetchPlatformInfo(),
      ]);
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchEnvironments, fetchInstalledPackages, fetchProviders, fetchCacheInfo, fetchPlatformInfo]);

  const activeError = !dismissedError ? (envsError || pkgsError || settingsError) : null;
  const lastRefreshedText = lastRefreshed
    ? t('dashboard.lastUpdated', { time: lastRefreshed.toLocaleTimeString() })
    : null;

  const isLoading = envsLoading || pkgsLoading || settingsLoading;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header with Customize Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader 
            title={t('dashboard.title')} 
            description={t('dashboard.description')} 
          />
          <div className="flex items-center gap-2">
            <Button
              variant={isEditMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditMode(!isEditMode)}
              className="gap-2"
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
              onClick={() => setIsCustomizing(true)}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dashboard.widgets.customize')}</span>
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {activeError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-sm text-destructive flex-1">{activeError}</span>
            <button onClick={() => setDismissedError(true)} className="text-destructive/70 hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Edit Mode Banner */}
        {isEditMode && (
          <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3 text-center text-sm text-primary">
            {t('dashboard.widgets.editModeHint')}
          </div>
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
          onOpenChange={setIsCustomizing}
        />
      </div>
    </TooltipProvider>
  );
}
