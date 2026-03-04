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
import { useDashboardStore, type WidgetSize, type WidgetType } from "@/lib/stores/dashboard";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { StatsCard, StatsCardSkeleton } from "@/components/dashboard/stats-card";
import { QuickSearch } from "@/components/dashboard/quick-search";
import { EnvironmentList } from "@/components/dashboard/environment-list";
import { PackageList } from "@/components/dashboard/package-list";
import { EnvironmentChart } from "@/components/dashboard/widgets/environment-chart";
import { PackageChart } from "@/components/dashboard/widgets/package-chart";
import { CacheChart } from "@/components/dashboard/widgets/cache-chart";
import { ActivityChart } from "@/components/dashboard/widgets/activity-chart";
import { SystemInfoWidget } from "@/components/dashboard/widgets/system-info-widget";
import { DownloadStatsWidget } from "@/components/dashboard/widgets/download-stats-widget";
import { WslStatusWidget } from "@/components/dashboard/widgets/wsl-status-widget";
import { HealthCheckWidget } from "@/components/dashboard/widgets/health-check-widget";
import { UpdatesWidget } from "@/components/dashboard/widgets/updates-widget";
import { WelcomeWidget } from "@/components/dashboard/widgets/welcome-widget";
import { ToolboxFavoritesWidget } from "@/components/dashboard/widgets/toolbox-favorites-widget";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { useLocale } from "@/components/providers/locale-provider";
import { Layers, Package, HardDrive, Activity } from "lucide-react";
import type { EnvironmentInfo, InstalledPackage, CacheInfo, PlatformInfo, ProviderInfo } from "@/lib/tauri";

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
}

function renderStatsOverview(p: WidgetRenderProps): ReactNode {
  if (p.isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
    );
  }
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title={p.t("dashboard.environments")}
        value={p.activeEnvs}
        description={p.t("dashboard.versionsInstalled", { count: p.totalVersions })}
        icon={<Layers className="h-4 w-4" />}
        href="/environments"
      />
      <StatsCard
        title={p.t("dashboard.packages")}
        value={p.packages.length}
        description={p.t("dashboard.fromProviders", { count: p.providers.length })}
        icon={<Package className="h-4 w-4" />}
        href="/packages"
      />
      <StatsCard
        title={p.t("dashboard.cache")}
        value={p.cacheInfo?.total_size_human || "0 B"}
        description={p.t("dashboard.cachedItems", { count: p.cacheInfo?.download_cache.entry_count || 0 })}
        icon={<HardDrive className="h-4 w-4" />}
        href="/cache"
      />
      <StatsCard
        title={p.t("dashboard.platform")}
        value={p.platformInfo?.osLongVersion || (p.platformInfo?.osVersion ? `${p.platformInfo.os} ${p.platformInfo.osVersion}` : p.platformInfo?.os) || p.t("common.unknown")}
        description={p.platformInfo?.arch || ""}
        icon={<Activity className="h-4 w-4" />}
        href="/settings"
      />
    </div>
  );
}

const WIDGET_RENDERERS: Record<WidgetType, (p: WidgetRenderProps) => ReactNode> = {
  "stats-overview": renderStatsOverview,
  "quick-search": (p) => <QuickSearch environments={p.environments} packages={p.packages} />,
  "environment-chart": (p) => <EnvironmentChart environments={p.environments} />,
  "package-chart": (p) => <PackageChart packages={p.packages} providers={p.providers} />,
  "cache-usage": (p) => <CacheChart cacheInfo={p.cacheInfo} />,
  "activity-timeline": (p) => <ActivityChart environments={p.environments} packages={p.packages} />,
  "system-info": (p) => <SystemInfoWidget platformInfo={p.platformInfo} cogniaDir={p.cogniaDir} />,
  "download-stats": () => <DownloadStatsWidget />,
  "environment-list": (p) => <EnvironmentList environments={p.environments} initialLimit={4} />,
  "package-list": (p) => <PackageList packages={p.packages} initialLimit={5} />,
  "wsl-status": () => <WslStatusWidget />,
  "quick-actions": (p) => <QuickActions onRefreshAll={p.onRefreshAll} isRefreshing={p.isRefreshing} />,
  "health-check": () => <HealthCheckWidget />,
  "updates-available": () => <UpdatesWidget />,
  "welcome": (p) => <WelcomeWidget hasEnvironments={p.environments.length > 0} hasPackages={p.packages.length > 0} />,
  "toolbox-favorites": () => <ToolboxFavoritesWidget />,
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

  const activeEnvs = environments.filter((e) => e.available).length;
  const totalVersions = environments.reduce((acc, e) => acc + e.installed_versions.length, 0);

  const renderProps = useMemo<WidgetRenderProps>(
    () => ({
      environments, packages, providers, cacheInfo, platformInfo, cogniaDir,
      isLoading, onRefreshAll, isRefreshing, t, activeEnvs, totalVersions,
    }),
    [
      environments, packages, providers, cacheInfo, platformInfo, cogniaDir,
      isLoading, onRefreshAll, isRefreshing, t, activeEnvs, totalVersions,
    ],
  );

  const renderWidgetContent = useCallback(
    (widgetType: string) => {
      const renderer = WIDGET_RENDERERS[widgetType as WidgetType];
      if (renderer) return renderer(renderProps);
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
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2" data-tour="dashboard-widgets" data-hint="dashboard-drag">
          {widgets.map((widget) => (
            <WidgetWrapper
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
              onRemove={removeWidget}
              onToggleVisibility={toggleWidgetVisibility}
              onResize={handleResize}
            >
              {renderWidgetContent(widget.type)}
            </WidgetWrapper>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
