'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { CustomizeDialog } from '@/components/dashboard/customize-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEnvironments } from '@/hooks/environments/use-environments';
import { usePackages } from '@/hooks/packages/use-packages';
import { useSettings } from '@/hooks/settings/use-settings';
import { useDashboardInsights } from '@/hooks/dashboard/use-dashboard-insights';
import { useLocale } from '@/components/providers/locale-provider';
import { DASHBOARD_STYLE_PRESETS, useDashboardStore } from '@/lib/stores/dashboard';
import { DashboardStatusBadge } from '@/components/dashboard/dashboard-primitives';
import { isTauri } from '@/lib/tauri';
import {
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';
import { Settings2, Pencil, Check, CheckCircle2, AlertCircle, X, RefreshCw, Sparkles } from 'lucide-react';

const DEFAULT_STARTUP_SCAN_FLAGS = {
  scanEnvironments: true,
  scanPackages: true,
} as const;

function resolveStartupScanFlags(config: Record<string, string> | null | undefined) {
  const readFlag = (
    key: 'startup.scan_environments' | 'startup.scan_packages',
    fallback: boolean,
  ) => {
    const value = config?.[key];
    if (typeof value !== 'string') {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }

    return fallback;
  };

  return {
    scanEnvironments: readFlag(
      'startup.scan_environments',
      DEFAULT_STARTUP_SCAN_FLAGS.scanEnvironments,
    ),
    scanPackages: readFlag(
      'startup.scan_packages',
      DEFAULT_STARTUP_SCAN_FLAGS.scanPackages,
    ),
  };
}

async function yieldToBrowser() {
  await new Promise<void>((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    setTimeout(resolve, 0);
  });
}

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
    config,
    fetchConfig,
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
  const insights = useDashboardInsights({
    environments,
    refreshKey: lastRefreshed?.getTime() ?? 0,
    t,
  });
  const isCustomizing = useDashboardStore((s) => s.isCustomizing);
  const isEditMode = useDashboardStore((s) => s.isEditMode);
  const visualContext = useDashboardStore((s) => s.visualContext);
  const activeStylePresetId = useDashboardStore((s) => s.activeStylePresetId);
  const hasActiveStylePresetDiverged = useDashboardStore((s) => s.hasActiveStylePresetDiverged);
  const setIsCustomizing = useDashboardStore((s) => s.setIsCustomizing);
  const setIsEditMode = useDashboardStore((s) => s.setIsEditMode);
  const setVisualContext = useDashboardStore((s) => s.setVisualContext);
  const applyStylePreset = useDashboardStore((s) => s.applyStylePreset);

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    let cancelled = false;

    // Phased loading to avoid firing all heavy backend calls at once.
    // Phase 1 (immediate, lightweight): provider metadata + platform info
    // Phase 2 (deferred): cache info
    // Phase 3 (after config): environments + packages (heaviest — subprocess spawns)
    const loadData = async () => {
      const [loadedConfig] = await Promise.all([
        Object.keys(config).length > 0 ? Promise.resolve(config) : fetchConfig(),
        fetchProviders(),
        fetchPlatformInfo(),
      ]);

      // Phase 2: cache info (moderate I/O, deferred)
      void fetchCacheInfo();

      const startupFlags = resolveStartupScanFlags(loadedConfig);

      // Phase 3: heavy scans (subprocess-intensive, run after UI has rendered).
      // Keep them serialized so startup does not trigger both global scans at once.
      if (startupFlags.scanEnvironments) {
        await yieldToBrowser();
        await fetchEnvironments();
      }

      if (startupFlags.scanPackages) {
        await yieldToBrowser();
        await fetchInstalledPackages();
      }

      if (!cancelled) {
        setLastRefreshed(new Date());
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [config, fetchConfig, fetchEnvironments, fetchInstalledPackages, fetchProviders, fetchCacheInfo, fetchPlatformInfo]);

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

  const handleSetRange = useCallback((range: "7d" | "30d") => {
    setVisualContext({ range });
  }, [setVisualContext]);

  const handleApplyStylePreset = useCallback((presetId: keyof typeof DASHBOARD_STYLE_PRESETS) => {
    applyStylePreset(presetId);
  }, [applyStylePreset]);

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
  const isPresetDiverged = hasActiveStylePresetDiverged();
  const activeStylePresetLabel = activeStylePresetId === 'custom'
    ? t('dashboard.stylePresets.custom.title')
    : t(DASHBOARD_STYLE_PRESETS[activeStylePresetId].titleKey);
  const sectionStates = [
    {
      id: 'environments',
      label: t('dashboard.overview.sections.environments'),
      isLoading: envsLoading && environments.length === 0,
      error: envsError,
    },
    {
      id: 'packages',
      label: t('dashboard.overview.sections.packages'),
      isLoading: pkgsLoading && installedPackages.length === 0,
      error: pkgsError,
    },
    {
      id: 'system',
      label: t('dashboard.overview.sections.system'),
      isLoading: settingsLoading && !platformInfo,
      error: settingsError,
    },
  ];
  const pendingSections = sectionStates.filter((section) => section.isLoading);
  const degradedSections = sectionStates.filter((section) => section.error);
  const readySectionCount = sectionStates.length - pendingSections.length - degradedSections.length;
  const overviewTitle = degradedSections.length > 0
    ? t('dashboard.overview.attentionTitle', { count: degradedSections.length })
    : pendingSections.length > 0 || isRefreshing
      ? t('dashboard.overview.loadingTitle', { count: Math.max(pendingSections.length, 1) })
      : t('dashboard.overview.readyTitle');
  const overviewDescription = degradedSections.length > 0
    ? t('dashboard.overview.attentionDesc')
    : pendingSections.length > 0 || isRefreshing
      ? t('dashboard.overview.loadingDesc')
      : t('dashboard.overview.readyDesc', { ready: readySectionCount, total: sectionStates.length });
  const overviewIcon = degradedSections.length > 0
    ? <AlertCircle className="h-4 w-4" />
    : pendingSections.length > 0 || isRefreshing
      ? <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      : <CheckCircle2 className="h-4 w-4" />;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5 p-4 md:space-y-6 md:p-6">
        {/* Header with Customize Controls */}
        <div className="space-y-4 rounded-3xl border bg-card/60 p-4 shadow-sm backdrop-blur-sm md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <PageHeader
              title={t('dashboard.title')}
              description={t('dashboard.description')}
            />
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-start xl:justify-end">
              <div
                className="flex items-center gap-1 rounded-full border border-border/70 bg-background/80 p-1"
                data-testid="dashboard-analytics-controls"
              >
                <Button
                  variant={visualContext.range === "7d" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-xs"
                  onClick={() => handleSetRange("7d")}
                  data-testid="dashboard-analytics-range-7d"
                >
                  7d
                </Button>
                <Button
                  variant={visualContext.range === "30d" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-xs"
                  onClick={() => handleSetRange("30d")}
                  data-testid="dashboard-analytics-range-30d"
                >
                  30d
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between gap-2 sm:w-auto"
                    data-testid="dashboard-style-preset-trigger"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span>{activeStylePresetLabel}</span>
                    </span>
                    {isPresetDiverged && (
                      <DashboardStatusBadge tone="warning">
                        {t('dashboard.stylePresets.diverged')}
                      </DashboardStatusBadge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>{t('dashboard.stylePresets.currentLabel')}</DropdownMenuLabel>
                  {Object.values(DASHBOARD_STYLE_PRESETS).map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      onClick={() => handleApplyStylePreset(preset.id)}
                      className="flex items-start justify-between gap-3"
                      data-testid={`dashboard-style-preset-option-${preset.id}`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{t(preset.titleKey)}</div>
                        <div className="text-xs text-muted-foreground">{t(preset.descriptionKey)}</div>
                      </div>
                      {activeStylePresetId === preset.id && !isPresetDiverged ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleOpenCustomize}>
                    {t('dashboard.stylePresets.customizeShortcut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                className="w-full gap-2 sm:w-auto"
                data-testid="dashboard-header-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{t('dashboard.quickActions.refreshAll')}</span>
              </Button>
              <Button
                variant={isEditMode ? 'default' : 'outline'}
                size="sm"
                onClick={handleToggleEditMode}
                className="w-full gap-2 sm:w-auto"
                data-testid="dashboard-header-edit-mode"
              >
                {isEditMode ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{t('dashboard.widgets.doneEditing')}</span>
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    <span>{t('dashboard.widgets.editLayout')}</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenCustomize}
                className="w-full gap-2 sm:w-auto"
                data-hint="dashboard-customize"
                data-testid="dashboard-header-customize"
              >
                <Settings2 className="h-4 w-4" />
                <span>{t('dashboard.widgets.customize')}</span>
              </Button>
            </div>
          </div>

          <Alert
            data-testid="dashboard-workspace-status"
            variant={degradedSections.length > 0 ? 'destructive' : 'default'}
            className={degradedSections.length > 0 ? '' : 'border-primary/15 bg-primary/5'}
          >
            {overviewIcon}
            <AlertTitle>{overviewTitle}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{overviewDescription}</p>
              <div className="flex flex-wrap gap-2">
                {sectionStates.map((section) => (
                  <DashboardStatusBadge
                    key={section.id}
                    tone={section.error ? 'danger' : section.isLoading ? 'warning' : 'success'}
                  >
                    {section.label}
                  </DashboardStatusBadge>
                ))}
              </div>
              {lastRefreshedText && (
                <p className="text-xs text-muted-foreground">
                  {lastRefreshedText}
                </p>
              )}
            </AlertDescription>
          </Alert>
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
          <Alert
            data-testid="dashboard-edit-mode-banner"
            className="border-dashed border-primary/50 bg-primary/5 text-primary"
          >
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
          feedback={{
            environments: { isLoading: envsLoading, error: envsError },
            packages: { isLoading: pkgsLoading, error: pkgsError },
            settings: { isLoading: settingsLoading, error: settingsError },
          }}
          insights={insights}
        />

        {/* Customize Dialog */}
        <CustomizeDialog
          open={isCustomizing}
          onOpenChange={handleCustomizeDialogChange}
        />
      </div>
    </TooltipProvider>
  );
}
