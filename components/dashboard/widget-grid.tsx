"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useDashboardStore,
  canRemoveWidgetById,
  canToggleWidgetVisibilityById,
  getDefaultWidgetSettings,
  type WidgetConfig,
  type WidgetSize,
  type WidgetSettings,
  type WidgetType,
} from "@/lib/stores/dashboard";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { WidgetSettingsToolbar } from "@/components/dashboard/widget-settings-toolbar";
import { StatsCard } from "@/components/dashboard/stats-card";
import { QuickSearch } from "@/components/dashboard/quick-search";
import { EnvironmentList } from "@/components/dashboard/environment-list";
import { PackageList } from "@/components/dashboard/package-list";
import { EnvironmentChart } from "@/components/dashboard/widgets/environment-chart";
import { PackageChart } from "@/components/dashboard/widgets/package-chart";
import { CacheChart } from "@/components/dashboard/widgets/cache-chart";
import { ActivityChart } from "@/components/dashboard/widgets/activity-chart";
import { AttentionCenterWidget } from "@/components/dashboard/widgets/attention-center-widget";
import { RecentActivityFeedWidget } from "@/components/dashboard/widgets/recent-activity-feed-widget";
import { WorkspaceTrendsWidget } from "@/components/dashboard/widgets/workspace-trends-widget";
import { ProviderHealthMatrixWidget } from "@/components/dashboard/widgets/provider-health-matrix-widget";
import { SystemInfoWidget } from "@/components/dashboard/widgets/system-info-widget";
import { DownloadStatsWidget } from "@/components/dashboard/widgets/download-stats-widget";
import { WslStatusWidget } from "@/components/dashboard/widgets/wsl-status-widget";
import { HealthCheckWidget } from "@/components/dashboard/widgets/health-check-widget";
import { UpdatesWidget } from "@/components/dashboard/widgets/updates-widget";
import { WelcomeWidget } from "@/components/dashboard/widgets/welcome-widget";
import { ToolboxFavoritesWidget } from "@/components/dashboard/widgets/toolbox-favorites-widget";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import { Layers, Package, HardDrive, Activity } from "lucide-react";
import type { EnvironmentInfo, InstalledPackage, CacheInfo, PlatformInfo, ProviderInfo } from "@/lib/tauri";
import type {
  DashboardActivityModel,
  DashboardActivityTimelineModel,
  DashboardAttentionModel,
  DashboardHealthMatrixModel,
  DashboardInsightsResult,
  DashboardTrendModel,
} from "@/hooks/use-dashboard-insights";

interface WidgetRenderProps {
  environments: EnvironmentInfo[];
  packages: InstalledPackage[];
  providers: ProviderInfo[];
  cacheInfo: CacheInfo | null;
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  isLoading: boolean;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  activeEnvs: number;
  totalVersions: number;
  feedback: {
    environments: { isLoading: boolean; error: string | null };
    packages: { isLoading: boolean; error: string | null };
    settings: { isLoading: boolean; error: string | null };
  };
  insights: DashboardInsightsResult;
}

function renderStatsOverview(p: WidgetRenderProps): ReactNode {
  const environmentReady = p.environments.length > 0;
  const packageReady = p.packages.length > 0;
  const cacheReady = Boolean(p.cacheInfo);
  const platformReady = Boolean(p.platformInfo);

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        loading={p.feedback.environments.isLoading && !environmentReady}
        title={p.t("dashboard.environments")}
        value={p.activeEnvs}
        description={
          p.feedback.environments.error && !environmentReady
            ? p.t("dashboard.overview.sectionUnavailable")
            : p.feedback.environments.isLoading && !environmentReady
              ? p.t("dashboard.overview.sectionLoading")
              : p.t("dashboard.versionsInstalled", { count: p.totalVersions })
        }
        icon={<Layers className="h-4 w-4" />}
        href="/environments"
      />
      <StatsCard
        loading={p.feedback.packages.isLoading && !packageReady}
        title={p.t("dashboard.packages")}
        value={p.packages.length}
        description={
          p.feedback.packages.error && !packageReady
            ? p.t("dashboard.overview.sectionUnavailable")
            : p.feedback.packages.isLoading && !packageReady
              ? p.t("dashboard.overview.sectionLoading")
              : p.t("dashboard.fromProviders", { count: p.providers.length })
        }
        icon={<Package className="h-4 w-4" />}
        href="/packages"
      />
      <StatsCard
        loading={p.feedback.settings.isLoading && !cacheReady}
        title={p.t("dashboard.cache")}
        value={p.cacheInfo?.total_size_human || "0 B"}
        description={
          p.feedback.settings.error && !cacheReady
            ? p.t("dashboard.overview.sectionUnavailable")
            : p.feedback.settings.isLoading && !cacheReady
              ? p.t("dashboard.overview.sectionLoading")
              : p.t("dashboard.cachedItems", { count: p.cacheInfo?.download_cache.entry_count || 0 })
        }
        icon={<HardDrive className="h-4 w-4" />}
        href="/cache"
      />
      <StatsCard
        loading={p.feedback.settings.isLoading && !platformReady}
        title={p.t("dashboard.platform")}
        value={p.platformInfo?.osLongVersion || (p.platformInfo?.osVersion ? `${p.platformInfo.os} ${p.platformInfo.osVersion}` : p.platformInfo?.os) || p.t("common.unknown")}
        description={
          p.feedback.settings.error && !platformReady
            ? p.t("dashboard.overview.sectionUnavailable")
            : p.feedback.settings.isLoading && !platformReady
              ? p.t("dashboard.overview.sectionLoading")
              : p.platformInfo?.arch || ""
        }
        icon={<Activity className="h-4 w-4" />}
        href="/settings"
      />
    </div>
  );
}

const EMPTY_ATTENTION_MODEL: DashboardAttentionModel = {
  items: [],
  totalCount: 0,
  isLoading: false,
  error: null,
  lastUpdatedAt: null,
};

const EMPTY_ACTIVITY_MODEL: DashboardActivityModel = {
  items: [],
  totalCount: 0,
  range: "7d",
  isUsingSharedRange: true,
  isLoading: false,
  error: null,
  lastUpdatedAt: null,
  missingSources: [],
  isPartial: false,
};

const EMPTY_TREND_MODEL: DashboardTrendModel = {
  range: "7d",
  metric: "installations",
  viewMode: "single",
  isUsingSharedRange: true,
  points: [],
  isLoading: false,
  error: null,
  lastUpdatedAt: null,
  missingSources: [],
  isPartial: false,
};

const EMPTY_HEALTH_MATRIX_MODEL: DashboardHealthMatrixModel = {
  groupBy: "provider",
  showHealthy: true,
  viewMode: "status-list",
  cells: [],
  totals: {
    healthy: 0,
    warning: 0,
    error: 0,
    unknown: 0,
  },
  isLoading: false,
  error: null,
  lastUpdatedAt: null,
  missingSources: [],
  isPartial: false,
};

const EMPTY_ACTIVITY_TIMELINE_MODEL: DashboardActivityTimelineModel = {
  range: "7d",
  viewMode: "distribution",
  isUsingSharedRange: true,
  points: [],
  totals: {
    downloads: 0,
    packages: 0,
    toolbox: 0,
    total: 0,
  },
  isLoading: false,
  error: null,
  lastUpdatedAt: null,
  missingSources: [],
  isPartial: false,
};

const WIDGET_RENDERERS: Record<WidgetType, (p: WidgetRenderProps, widget: WidgetConfig) => ReactNode> = {
  "stats-overview": renderStatsOverview,
  "quick-search": (p) => <QuickSearch environments={p.environments} packages={p.packages} />,
  "environment-chart": (p) => <EnvironmentChart environments={p.environments} />,
  "package-chart": (p) => <PackageChart packages={p.packages} providers={p.providers} />,
  "cache-usage": (p) => <CacheChart cacheInfo={p.cacheInfo} />,
  "activity-timeline": (p, widget) => (
    <ActivityChart
      environments={p.environments}
      packages={p.packages}
      model={p.insights.activityTimeline[widget.id] ?? EMPTY_ACTIVITY_TIMELINE_MODEL}
    />
  ),
  "system-info": (p) => (
    <SystemInfoWidget
      platformInfo={p.platformInfo}
      cogniaDir={p.cogniaDir}
      isLoading={p.feedback.settings.isLoading}
      error={p.feedback.settings.error}
      onRecover={p.onRefreshAll}
    />
  ),
  "download-stats": () => <DownloadStatsWidget />,
  "environment-list": (p) => (
    <EnvironmentList
      environments={p.environments}
      initialLimit={4}
      isLoading={p.feedback.environments.isLoading}
      error={p.feedback.environments.error}
      onRecover={p.onRefreshAll}
    />
  ),
  "package-list": (p) => (
    <PackageList
      packages={p.packages}
      initialLimit={5}
      isLoading={p.feedback.packages.isLoading}
      error={p.feedback.packages.error}
      onRecover={p.onRefreshAll}
    />
  ),
  "wsl-status": () => <WslStatusWidget />,
  "quick-actions": (p) => <QuickActions onRefreshAll={p.onRefreshAll} isRefreshing={p.isRefreshing} />,
  "health-check": () => <HealthCheckWidget />,
  "updates-available": () => <UpdatesWidget />,
  "welcome": (p) => <WelcomeWidget hasEnvironments={p.environments.length > 0} hasPackages={p.packages.length > 0} />,
  "toolbox-favorites": () => <ToolboxFavoritesWidget />,
  "attention-center": (p, widget) => (
    <AttentionCenterWidget model={p.insights.attentionCenter[widget.id] ?? EMPTY_ATTENTION_MODEL} />
  ),
  "recent-activity-feed": (p, widget) => (
    <RecentActivityFeedWidget model={p.insights.recentActivityFeed[widget.id] ?? EMPTY_ACTIVITY_MODEL} />
  ),
  "workspace-trends": (p, widget) => (
    <WorkspaceTrendsWidget model={p.insights.workspaceTrends[widget.id] ?? EMPTY_TREND_MODEL} />
  ),
  "provider-health-matrix": (p, widget) => (
    <ProviderHealthMatrixWidget model={p.insights.providerHealthMatrix[widget.id] ?? EMPTY_HEALTH_MATRIX_MODEL} />
  ),
};

interface WidgetGridProps {
  environments: EnvironmentInfo[];
  packages: InstalledPackage[];
  providers: ProviderInfo[];
  cacheInfo: CacheInfo | null;
  platformInfo: PlatformInfo | null;
  cogniaDir: string | null;
  isLoading: boolean;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  feedback: {
    environments: { isLoading: boolean; error: string | null };
    packages: { isLoading: boolean; error: string | null };
    settings: { isLoading: boolean; error: string | null };
  };
  insights: DashboardInsightsResult;
}

export function WidgetGrid({
  environments,
  packages,
  providers,
  cacheInfo,
  platformInfo,
  cogniaDir,
  isLoading,
  onRefreshAll,
  isRefreshing,
  feedback,
  insights,
}: WidgetGridProps) {
  const { t } = useLocale();
  const widgets = useDashboardStore((s) => s.widgets);
  const isEditMode = useDashboardStore((s) => s.isEditMode);
  const reorderWidgets = useDashboardStore((s) => s.reorderWidgets);
  const removeWidget = useDashboardStore((s) => s.removeWidget);
  const toggleWidgetVisibility = useDashboardStore((s) => s.toggleWidgetVisibility);
  const updateWidget = useDashboardStore((s) => s.updateWidget);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = widgets.findIndex((w) => w.id === active.id);
        const newIndex = widgets.findIndex((w) => w.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderWidgets(oldIndex, newIndex);
        }
      }
    },
    [widgets, reorderWidgets],
  );

  const handleResize = useCallback(
    (id: string, size: WidgetSize) => {
      updateWidget(id, { size });
    },
    [updateWidget],
  );

  const handleUpdateSettings = useCallback(
    (id: string, settings: WidgetSettings) => {
      updateWidget(id, { settings });
    },
    [updateWidget],
  );

  const handleResetSettings = useCallback(
    (id: string) => {
      const widget = widgets.find((entry) => entry.id === id);
      if (!widget) {
        return;
      }

      updateWidget(id, { settings: getDefaultWidgetSettings(widget.type) });
    },
    [widgets, updateWidget],
  );

  const handleRemove = useCallback(
    (id: string) => {
      if (!canRemoveWidgetById(widgets, id)) {
        return;
      }
      removeWidget(id);
    },
    [widgets, removeWidget],
  );

  const handleToggleVisibility = useCallback(
    (id: string) => {
      if (!canToggleWidgetVisibilityById(widgets, id)) {
        return;
      }
      toggleWidgetVisibility(id);
    },
    [widgets, toggleWidgetVisibility],
  );

  const activeEnvs = environments.filter((e) => e.available).length;
  const totalVersions = environments.reduce((acc, e) => acc + e.installed_versions.length, 0);

  const renderProps = useMemo<WidgetRenderProps>(
    () => ({
      environments, packages, providers, cacheInfo, platformInfo, cogniaDir,
      isLoading, onRefreshAll, isRefreshing, t, activeEnvs, totalVersions, feedback, insights,
    }),
    [
      environments, packages, providers, cacheInfo, platformInfo, cogniaDir,
      isLoading, onRefreshAll, isRefreshing, t, activeEnvs, totalVersions, feedback, insights,
    ],
  );

  const renderWidgetContent = useCallback(
    (widget: WidgetConfig) => {
      const widgetType = widget.type;
      const renderer = WIDGET_RENDERERS[widgetType as WidgetType];
      if (renderer) return renderer(renderProps, widget);
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {t("dashboard.widgets.unknownWidget")}
        </div>
      );
    },
    [renderProps, t],
  );

  const widgetIds = widgets.map((w) => w.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
        <div
          className={cn(
            "grid grid-cols-1 gap-4 lg:grid-cols-2",
            isEditMode && "rounded-xl border border-dashed border-primary/40 bg-primary/2 p-2",
          )}
          data-tour="dashboard-widgets"
          data-hint="dashboard-drag"
          role="list"
          aria-label={t("dashboard.title")}
          aria-live={isEditMode ? "polite" : "off"}
        >
          {widgets.map((widget) => (
            <WidgetWrapper
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
              canRemove={canRemoveWidgetById(widgets, widget.id)}
              canToggleVisibility={canToggleWidgetVisibilityById(widgets, widget.id)}
              onRemove={handleRemove}
              onToggleVisibility={handleToggleVisibility}
              onResize={handleResize}
              toolbarExtras={(
                <WidgetSettingsToolbar
                  widget={widget}
                  onUpdateSettings={handleUpdateSettings}
                  onResetSettings={handleResetSettings}
                />
              )}
            >
              {renderWidgetContent(widget)}
            </WidgetWrapper>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
