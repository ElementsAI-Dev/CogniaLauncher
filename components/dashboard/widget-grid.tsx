"use client";

import { useCallback } from "react";
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
import { useDashboardStore, type WidgetSize } from "@/lib/stores/dashboard";
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
import { QuickActionsInline } from "@/components/dashboard/quick-actions";
import { useLocale } from "@/components/providers/locale-provider";
import { Layers, Package, HardDrive, Activity } from "lucide-react";
import type { EnvironmentInfo, InstalledPackage, CacheInfo, PlatformInfo, ProviderInfo } from "@/lib/tauri";

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

  const renderWidgetContent = useCallback(
    (widgetType: string) => {
      switch (widgetType) {
        case "stats-overview":
          return isLoading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title={t("dashboard.environments")}
                value={activeEnvs}
                description={t("dashboard.versionsInstalled", { count: totalVersions })}
                icon={<Layers className="h-4 w-4" />}
                href="/environments"
              />
              <StatsCard
                title={t("dashboard.packages")}
                value={packages.length}
                description={t("dashboard.fromProviders", { count: providers.length })}
                icon={<Package className="h-4 w-4" />}
                href="/packages"
              />
              <StatsCard
                title={t("dashboard.cache")}
                value={cacheInfo?.total_size_human || "0 B"}
                description={t("dashboard.cachedItems", { count: cacheInfo?.download_cache.entry_count || 0 })}
                icon={<HardDrive className="h-4 w-4" />}
                href="/cache"
              />
              <StatsCard
                title={t("dashboard.platform")}
                value={platformInfo?.os_long_version || (platformInfo?.os_version ? `${platformInfo.os} ${platformInfo.os_version}` : platformInfo?.os) || t("common.unknown")}
                description={platformInfo?.arch || ""}
                icon={<Activity className="h-4 w-4" />}
                href="/settings"
              />
            </div>
          );
        case "quick-search":
          return (
            <QuickSearch
              environments={environments}
              packages={packages}
            />
          );
        case "environment-chart":
          return <EnvironmentChart environments={environments} />;
        case "package-chart":
          return <PackageChart packages={packages} providers={providers} />;
        case "cache-usage":
          return <CacheChart cacheInfo={cacheInfo} />;
        case "activity-timeline":
          return <ActivityChart environments={environments} packages={packages} />;
        case "system-info":
          return <SystemInfoWidget platformInfo={platformInfo} cogniaDir={cogniaDir} />;
        case "download-stats":
          return <DownloadStatsWidget />;
        case "environment-list":
          return <EnvironmentList environments={environments} initialLimit={4} />;
        case "package-list":
          return <PackageList packages={packages} initialLimit={5} />;
        case "wsl-status":
          return <WslStatusWidget />;
        case "quick-actions":
          return (
            <QuickActionsInline
              onRefreshAll={onRefreshAll}
              isRefreshing={isRefreshing}
            />
          );
        case "health-check":
          return <HealthCheckWidget />;
        case "updates-available":
          return <UpdatesWidget />;
        case "welcome":
          return (
            <WelcomeWidget
              hasEnvironments={environments.length > 0}
              hasPackages={packages.length > 0}
            />
          );
        default:
          return (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("dashboard.widgets.unknownWidget")}
            </div>
          );
      }
    },
    [
      isLoading, t, activeEnvs, totalVersions, packages, providers, cacheInfo,
      platformInfo, cogniaDir, environments, onRefreshAll, isRefreshing,
    ],
  );

  const widgetIds = widgets.map((w) => w.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2" data-tour="dashboard-widgets">
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
