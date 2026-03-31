"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardStore } from "@/lib/stores/dashboard";
import { useDownloads } from "@/hooks/downloads/use-downloads";
import { useHealthCheck } from "@/hooks/health/use-health-check";
import { usePackages } from "@/hooks/packages/use-packages";
import { useToolbox } from "@/hooks/toolbox/use-toolbox";
import type {
  EnvironmentInfo,
  HealthStatus,
  InstallHistoryEntry,
  PackageManagerHealthResult,
  DownloadHistoryRecord,
  SystemHealthResult,
} from "@/types/tauri";
import type {
  ActivityTimelineSettings,
  AttentionCenterSettings,
  ProviderHealthGroupBy,
  ProviderHealthMatrixSettings,
  RecentActivityFeedSettings,
  WidgetConfig,
  WidgetRange,
  WorkspaceTrendMetric,
  WorkspaceTrendsSettings,
} from "@/lib/stores/dashboard";

type AttentionSeverity = "danger" | "warning" | "info";

export interface DashboardAttentionItem {
  id: string;
  source: "downloads" | "environments" | "health";
  severity: AttentionSeverity;
  title: string;
  description: string;
  href: string;
}

export interface DashboardAttentionModel {
  items: DashboardAttentionItem[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
}

export interface DashboardActivityItem {
  id: string;
  source: "downloads" | "packages" | "toolbox";
  title: string;
  description: string;
  timestamp: string;
  href: string;
}

export interface DashboardActivityModel {
  items: DashboardActivityItem[];
  totalCount: number;
  range: WidgetRange;
  isUsingSharedRange: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  missingSources: string[];
  isPartial: boolean;
}

export interface DashboardTrendPoint {
  label: string;
  value: number;
  installations?: number;
  downloads?: number;
  updates?: number;
}

export interface DashboardTrendModel {
  range: WidgetRange;
  metric: WorkspaceTrendMetric;
  viewMode: "single" | "comparison";
  isUsingSharedRange: boolean;
  points: DashboardTrendPoint[];
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  missingSources: string[];
  isPartial: boolean;
}

export interface DashboardHealthCell {
  id: string;
  label: string;
  status: HealthStatus;
  issueCount: number;
  href: string;
  checkedAt: string | null;
}

export interface DashboardHealthMatrixModel {
  groupBy: ProviderHealthGroupBy;
  showHealthy: boolean;
  viewMode: "status-list" | "heatmap";
  cells: DashboardHealthCell[];
  totals: Record<HealthStatus, number>;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  missingSources: string[];
  isPartial: boolean;
}

export interface DashboardActivityTimelinePoint {
  label: string;
  downloads: number;
  packages: number;
  toolbox: number;
  total: number;
}

export interface DashboardActivityTimelineModel {
  range: WidgetRange;
  viewMode: "distribution" | "intensity";
  isUsingSharedRange: boolean;
  points: DashboardActivityTimelinePoint[];
  totals: {
    downloads: number;
    packages: number;
    toolbox: number;
    total: number;
  };
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  missingSources: string[];
  isPartial: boolean;
}

interface UseDashboardInsightsOptions {
  environments: EnvironmentInfo[];
  now?: Date;
  refreshKey?: number;
  t?: (key: string, params?: Record<string, string | number>) => string;
}

export interface DashboardInsightsResult {
  attentionCenter: Record<string, DashboardAttentionModel>;
  recentActivityFeed: Record<string, DashboardActivityModel>;
  workspaceTrends: Record<string, DashboardTrendModel>;
  providerHealthMatrix: Record<string, DashboardHealthMatrixModel>;
  activityTimeline: Record<string, DashboardActivityTimelineModel>;
}

interface InstallHistoryState {
  items: InstallHistoryEntry[];
  loading: boolean;
  error: string | null;
}

const EMPTY_TOTALS: Record<HealthStatus, number> = {
  healthy: 0,
  warning: 0,
  error: 0,
  unknown: 0,
};

function translateOrFallback(
  t: UseDashboardInsightsOptions["t"],
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  if (!t) {
    return fallback;
  }

  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function useDashboardInsights({
  environments,
  now = new Date(),
  refreshKey = 0,
  t,
}: UseDashboardInsightsOptions): DashboardInsightsResult {
  const widgets = useDashboardStore((state) => state.widgets) as WidgetConfig[];
  const visualContext = useDashboardStore((state) => state.visualContext) as { range: WidgetRange };
  const visibleWidgets = useMemo(
    () => widgets.filter((widget) => widget.visible),
    [widgets],
  );

  const needsHealth = visibleWidgets.some((widget) =>
    widget.type === "attention-center" || widget.type === "provider-health-matrix",
  );
  const needsInstallHistory = visibleWidgets.some((widget) =>
    widget.type === "workspace-trends" ||
    widget.type === "recent-activity-feed" ||
    widget.type === "activity-timeline",
  );

  const downloads = useDownloads({ enableRuntime: false });
  const { getInstallHistory } = usePackages();
  const { recentTools, allTools } = useToolbox();
  const {
    systemHealth,
    loading: healthLoading,
    error: healthError,
    summary,
    checkAll,
  } = useHealthCheck();

  const [installHistoryState, setInstallHistoryState] = useState<InstallHistoryState>({
    items: [],
    loading: false,
    error: null,
  });

  const installHistoryRequestKeyRef = useRef<string | null>(null);
  const installHistoryWaveRef = useRef(0);
  const healthRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!needsInstallHistory) {
      installHistoryRequestKeyRef.current = null;
      return;
    }

    const requestKey = `${refreshKey}`;
    if (installHistoryRequestKeyRef.current === requestKey) {
      return;
    }

    installHistoryRequestKeyRef.current = requestKey;
    installHistoryWaveRef.current += 1;
    const wave = installHistoryWaveRef.current;
    setInstallHistoryState((state) => ({ ...state, loading: true, error: null }));

    void getInstallHistory({ limit: 30 })
      .then((items) => {
        if (wave !== installHistoryWaveRef.current) {
          return;
        }
        setInstallHistoryState({
          items,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (wave !== installHistoryWaveRef.current) {
          return;
        }
        setInstallHistoryState({
          items: [],
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [getInstallHistory, needsInstallHistory, refreshKey]);

  useEffect(() => {
    if (!needsHealth) {
      healthRequestKeyRef.current = null;
      return;
    }

    const requestKey = `${refreshKey}`;
    if (healthRequestKeyRef.current === requestKey) {
      return;
    }

    healthRequestKeyRef.current = requestKey;
    void checkAll();
  }, [checkAll, needsHealth, refreshKey]);

  const attentionItems = useMemo(
    () => buildAttentionItems({ environments, healthSummary: summary, downloadHistory: downloads.history, t }),
    [downloads.history, environments, summary, t],
  );

  const activityItems = useMemo(
    () => buildRecentActivityItems({
      downloadHistory: downloads.history,
      installHistory: installHistoryState.items,
      recentTools,
      allTools,
      now,
      t,
    }),
    [allTools, downloads.history, installHistoryState.items, now, recentTools, t],
  );

  const latestAttentionTimestamp = useMemo(
    () => getLatestTimestamp([
      systemHealth?.checked_at ?? null,
      ...downloads.history.map((record) => record.completedAt),
    ]),
    [downloads.history, systemHealth?.checked_at],
  );

  const attentionCenter = useMemo(() => {
    const entries = visibleWidgets
      .filter((widget) => widget.type === "attention-center")
      .map((widget) => {
        const settings = (widget.settings as AttentionCenterSettings | undefined) ?? { maxItems: 3 };
        return [
          widget.id,
          {
            items: attentionItems.slice(0, settings.maxItems),
            totalCount: attentionItems.length,
            isLoading: healthLoading || downloads.isLoading,
            error: healthError ?? downloads.error,
            lastUpdatedAt: latestAttentionTimestamp,
          } satisfies DashboardAttentionModel,
        ] as const;
      });

    return Object.fromEntries(entries);
  }, [
    attentionItems,
    downloads.error,
    downloads.isLoading,
    healthError,
    healthLoading,
    latestAttentionTimestamp,
    visibleWidgets,
  ]);

  const recentActivityFeed = useMemo(() => {
    const entries = visibleWidgets
      .filter((widget) => widget.type === "recent-activity-feed")
      .map((widget) => {
        const settings = (widget.settings as RecentActivityFeedSettings | undefined) ?? {
          limit: 5,
          useSharedRange: true,
        };
        const activeRange = settings.useSharedRange ? visualContext.range : "7d";
        const filteredItems = filterItemsByRange(activityItems, activeRange, now);
        const missingSources = collectMissingSources({
          downloadsError: downloads.error,
          installHistoryError: installHistoryState.error,
          needsDownloads: true,
          needsInstallHistory: true,
        });
        return [
          widget.id,
          {
            items: filteredItems.slice(0, settings.limit),
            totalCount: filteredItems.length,
            range: activeRange,
            isUsingSharedRange: settings.useSharedRange,
            isLoading: downloads.isLoading || installHistoryState.loading,
            error: downloads.error ?? installHistoryState.error,
            lastUpdatedAt: getLatestTimestamp(filteredItems.map((item) => item.timestamp)),
            missingSources,
            isPartial: missingSources.length > 0 && filteredItems.length > 0,
          } satisfies DashboardActivityModel,
        ] as const;
      });

    return Object.fromEntries(entries);
  }, [
    activityItems,
    downloads.error,
    downloads.isLoading,
    installHistoryState.error,
    installHistoryState.loading,
    now,
    visualContext.range,
    visibleWidgets,
  ]);

  const workspaceTrends = useMemo(() => {
    const entries = visibleWidgets
      .filter((widget) => widget.type === "workspace-trends")
      .map((widget) => {
        const settings = (widget.settings as WorkspaceTrendsSettings | undefined) ?? {
          range: "7d",
          metric: "installations",
          viewMode: "single",
          useSharedRange: true,
        };
        const activeRange = settings.useSharedRange ? visualContext.range : settings.range;
        const points = buildTrendPoints({
          range: activeRange,
          metric: settings.metric,
          installHistory: installHistoryState.items,
          downloadHistory: downloads.history,
          now,
          viewMode: settings.viewMode,
        });
        const missingSources = collectTrendMissingSources({
          metric: settings.metric,
          viewMode: settings.viewMode,
          downloadsError: downloads.error,
          installHistoryError: installHistoryState.error,
        });

        return [
          widget.id,
          {
            range: activeRange,
            metric: settings.metric,
            viewMode: settings.viewMode,
            isUsingSharedRange: settings.useSharedRange,
            points,
            isLoading: downloads.isLoading || installHistoryState.loading,
            error: downloads.error ?? installHistoryState.error,
            lastUpdatedAt: getLatestTimestamp([
              ...installHistoryState.items.map((entry) => entry.timestamp),
              ...downloads.history.map((record) => record.completedAt),
            ]),
            missingSources,
            isPartial: missingSources.length > 0 && points.length > 0,
          } satisfies DashboardTrendModel,
        ] as const;
      });

    return Object.fromEntries(entries);
  }, [
    downloads.error,
    downloads.history,
    downloads.isLoading,
    installHistoryState.error,
    installHistoryState.items,
    installHistoryState.loading,
    now,
    visualContext.range,
    visibleWidgets,
  ]);

  const providerHealthMatrix = useMemo(() => {
    const entries = visibleWidgets
      .filter((widget) => widget.type === "provider-health-matrix")
      .map((widget) => {
        const settings = (widget.settings as ProviderHealthMatrixSettings | undefined) ?? {
          groupBy: "provider",
          showHealthy: true,
          viewMode: "status-list",
        };
        const matrix = buildProviderHealthMatrix(systemHealth, settings);
        const missingSources = healthError ? ["health"] : [];

        return [
          widget.id,
          {
            groupBy: settings.groupBy,
            showHealthy: settings.showHealthy,
            viewMode: settings.viewMode,
            cells: matrix.cells,
            totals: matrix.totals,
            isLoading: healthLoading,
            error: healthError,
            lastUpdatedAt: systemHealth?.checked_at ?? null,
            missingSources,
            isPartial: missingSources.length > 0 && matrix.cells.length > 0,
          } satisfies DashboardHealthMatrixModel,
        ] as const;
      });

    return Object.fromEntries(entries);
  }, [healthError, healthLoading, systemHealth, visibleWidgets]);

  const activityTimeline = useMemo(() => {
    const entries = visibleWidgets
      .filter((widget) => widget.type === "activity-timeline")
      .map((widget) => {
        const settings = (widget.settings as ActivityTimelineSettings | undefined) ?? {
          range: "7d",
          viewMode: "distribution",
          useSharedRange: true,
        };
        const activeRange = settings.useSharedRange ? visualContext.range : settings.range;
        const points = buildActivityTimelinePoints({
          range: activeRange,
          activityItems,
          now,
        });
        const totals = points.reduce(
          (acc, point) => ({
            downloads: acc.downloads + point.downloads,
            packages: acc.packages + point.packages,
            toolbox: acc.toolbox + point.toolbox,
            total: acc.total + point.total,
          }),
          { downloads: 0, packages: 0, toolbox: 0, total: 0 },
        );
        const missingSources = collectMissingSources({
          downloadsError: downloads.error,
          installHistoryError: installHistoryState.error,
          needsDownloads: true,
          needsInstallHistory: true,
        });

        return [
          widget.id,
          {
            range: activeRange,
            viewMode: settings.viewMode,
            isUsingSharedRange: settings.useSharedRange,
            points,
            totals,
            isLoading: downloads.isLoading || installHistoryState.loading,
            error: downloads.error ?? installHistoryState.error,
            lastUpdatedAt: getLatestTimestamp(points.map((point) => point.label)),
            missingSources,
            isPartial: missingSources.length > 0 && totals.total > 0,
          } satisfies DashboardActivityTimelineModel,
        ] as const;
      });

    return Object.fromEntries(entries);
  }, [
    activityItems,
    downloads.error,
    downloads.isLoading,
    installHistoryState.error,
    installHistoryState.loading,
    now,
    visualContext.range,
    visibleWidgets,
  ]);

  return {
    attentionCenter,
    recentActivityFeed,
    workspaceTrends,
    providerHealthMatrix,
    activityTimeline,
  };
}

function buildAttentionItems({
  environments,
  healthSummary,
  downloadHistory,
  t,
}: {
  environments: EnvironmentInfo[];
  healthSummary: { actionableIssueCount: number; issueCount: number } | null;
  downloadHistory: DownloadHistoryRecord[];
  t?: UseDashboardInsightsOptions["t"];
}): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];

  if (healthSummary && healthSummary.issueCount > 0) {
    items.push({
      id: "health",
      source: "health",
      severity: healthSummary.actionableIssueCount > 0 ? "danger" : "warning",
      title: translateOrFallback(
        t,
        "dashboard.widgets.insightAttentionHealthTitle",
        "Health checks need attention",
      ),
      description: translateOrFallback(
        t,
        "dashboard.widgets.insightAttentionHealthDesc",
        `${healthSummary.issueCount} issue(s) detected across providers and environments.`,
        { count: healthSummary.issueCount },
      ),
      href: "/health",
    });
  }

  const failedDownloads = downloadHistory.filter((record) => record.status === "failed");
  if (failedDownloads.length > 0) {
    items.push({
      id: "downloads",
      source: "downloads",
      severity: "warning",
      title: translateOrFallback(
        t,
        "dashboard.widgets.insightAttentionDownloadsTitle",
        "Downloads need review",
      ),
      description: translateOrFallback(
        t,
        "dashboard.widgets.insightAttentionDownloadsDesc",
        `${failedDownloads.length} download(s) failed recently.`,
        { count: failedDownloads.length },
      ),
      href: "/downloads",
    });
  }

  const unavailableEnvironments = environments.filter((environment) => !environment.available);
  if (unavailableEnvironments.length > 0) {
    items.push({
      id: "environments",
      source: "environments",
      severity: "warning",
      title: translateOrFallback(
        t,
        "dashboard.widgets.insightAttentionEnvironmentsTitle",
        "Unavailable environments detected",
      ),
      description: translateOrFallback(
        t,
        "dashboard.widgets.insightAttentionEnvironmentsDesc",
        `${unavailableEnvironments.length} environment manager(s) are unavailable.`,
        { count: unavailableEnvironments.length },
      ),
      href: "/environments",
    });
  }

  return items.sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
}

function buildRecentActivityItems({
  downloadHistory,
  installHistory,
  recentTools,
  allTools,
  now,
  t,
}: {
  downloadHistory: DownloadHistoryRecord[];
  installHistory: InstallHistoryEntry[];
  recentTools: string[];
  allTools: Array<{ id: string; name: string }>;
  now: Date;
  t?: UseDashboardInsightsOptions["t"];
}): DashboardActivityItem[] {
  const toolNameById = new Map(allTools.map((tool) => [tool.id, tool.name]));

  const items: DashboardActivityItem[] = [
    ...downloadHistory.map((record) => ({
      id: `download:${record.id}`,
      source: "downloads" as const,
      title: record.filename,
      description: record.status === "failed"
        ? record.error || translateOrFallback(
          t,
          "dashboard.widgets.insightActivityDownloadFailed",
          "Download failed",
        )
        : translateOrFallback(
          t,
          `dashboard.widgets.insightActivityDownloadStatus_${record.status}`,
          `Download ${record.status}`,
        ),
      timestamp: record.completedAt,
      href: "/downloads",
    })),
    ...installHistory.map((entry) => ({
      id: `package:${entry.id}`,
      source: "packages" as const,
      title: `${translateOrFallback(
        t,
        `dashboard.widgets.insightActivityPackage_${entry.action}`,
        entry.action,
      )} ${entry.name}`,
      description: `${entry.provider} ${entry.version}`,
      timestamp: entry.timestamp,
      href: "/packages",
    })),
    ...recentTools.map((toolId, index) => ({
      id: `tool:${toolId}`,
      source: "toolbox" as const,
      title: toolNameById.get(toolId) ?? toolId,
      description: translateOrFallback(
        t,
        "dashboard.widgets.insightActivityToolboxRecent",
        "Recently used tool",
      ),
      // Toolbox recency only preserves ordering, so anchor synthetic timestamps
      // inside the default shared range without outranking real near-term events.
      timestamp: new Date(
        now.getTime() - (6 * 24 * 60 * 60 * 1000) - index * 1000,
      ).toISOString(),
      href: "/toolbox",
    })),
  ];

  return items.sort((left, right) => (
    new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  ));
}

function buildTrendPoints({
  range,
  metric,
  installHistory,
  downloadHistory,
  now,
  viewMode,
}: {
  range: WidgetRange;
  metric: WorkspaceTrendMetric;
  installHistory: InstallHistoryEntry[];
  downloadHistory: DownloadHistoryRecord[];
  now: Date;
  viewMode: "single" | "comparison";
}): DashboardTrendPoint[] {
  const buckets = buildTrendBuckets({
    range,
    installHistory,
    downloadHistory,
    now,
  });

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: metric === "downloads"
      ? bucket.downloads
      : metric === "updates"
        ? bucket.updates
        : bucket.installations,
    installations: viewMode === "comparison" ? bucket.installations : undefined,
    downloads: viewMode === "comparison" ? bucket.downloads : undefined,
    updates: viewMode === "comparison" ? bucket.updates : undefined,
  }));
}

function buildTrendBuckets({
  range,
  installHistory,
  downloadHistory,
  now,
}: {
  range: WidgetRange;
  installHistory: InstallHistoryEntry[];
  downloadHistory: DownloadHistoryRecord[];
  now: Date;
}): Array<{
  label: string;
  installations: number;
  downloads: number;
  updates: number;
}> {
  const dayCount = range === "30d" ? 30 : 7;
  const buckets = new Map<string, { installations: number; downloads: number; updates: number }>();

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - offset);
    buckets.set(day.toISOString().slice(0, 10), {
      installations: 0,
      downloads: 0,
      updates: 0,
    });
  }

  for (const record of downloadHistory) {
    const key = record.completedAt.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.downloads += 1;
  }

  for (const entry of installHistory) {
    const key = entry.timestamp.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (entry.action === "install") {
      bucket.installations += 1;
    }
    if (entry.action === "update") {
      bucket.updates += 1;
    }
  }

  return Array.from(buckets.entries()).map(([label, value]) => ({
    label,
    ...value,
  }));
}

function buildProviderHealthMatrix(
  systemHealth: SystemHealthResult | null,
  settings: ProviderHealthMatrixSettings,
): {
  cells: DashboardHealthCell[];
  totals: Record<HealthStatus, number>;
} {
  if (!systemHealth) {
    return {
      cells: [],
      totals: { ...EMPTY_TOTALS },
    };
  }

  const items = settings.groupBy === "provider"
    ? systemHealth.package_managers.map((entry) => toProviderHealthCell(entry))
    : systemHealth.environments.map((entry) => ({
        id: `environment:${entry.env_type}`,
        label: entry.env_type,
        status: entry.status,
        issueCount: entry.issues.length,
        href: "/health",
        checkedAt: entry.checked_at,
      }));

  const totals = items.reduce<Record<HealthStatus, number>>((acc, item) => {
    acc[item.status] += 1;
    return acc;
  }, { ...EMPTY_TOTALS });

  return {
    cells: settings.showHealthy ? items : items.filter((item) => item.status !== "healthy"),
    totals,
  };
}

function buildActivityTimelinePoints({
  range,
  activityItems,
  now,
}: {
  range: WidgetRange;
  activityItems: DashboardActivityItem[];
  now: Date;
}): DashboardActivityTimelinePoint[] {
  const filteredItems = filterItemsByRange(activityItems, range, now);
  const dayCount = range === "30d" ? 30 : 7;
  const buckets = new Map<string, DashboardActivityTimelinePoint>();

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - offset);
    const label = day.toISOString().slice(0, 10);
    buckets.set(label, {
      label,
      downloads: 0,
      packages: 0,
      toolbox: 0,
      total: 0,
    });
  }

  for (const item of filteredItems) {
    const bucket = buckets.get(item.timestamp.slice(0, 10));
    if (!bucket) {
      continue;
    }

    if (item.source === "downloads") bucket.downloads += 1;
    if (item.source === "packages") bucket.packages += 1;
    if (item.source === "toolbox") bucket.toolbox += 1;
    bucket.total += 1;
  }

  return Array.from(buckets.values());
}

function filterItemsByRange<T extends { timestamp: string }>(
  items: T[],
  range: WidgetRange,
  now: Date,
): T[] {
  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - (range === "30d" ? 29 : 6));

  return items.filter((item) => new Date(item.timestamp).getTime() >= cutoff.getTime());
}

function collectMissingSources({
  downloadsError,
  installHistoryError,
  needsDownloads,
  needsInstallHistory,
}: {
  downloadsError: string | null;
  installHistoryError: string | null;
  needsDownloads: boolean;
  needsInstallHistory: boolean;
}): string[] {
  const missing: string[] = [];
  if (needsDownloads && downloadsError) {
    missing.push("downloads");
  }
  if (needsInstallHistory && installHistoryError) {
    missing.push("packages");
  }
  return missing;
}

function collectTrendMissingSources({
  metric,
  viewMode,
  downloadsError,
  installHistoryError,
}: {
  metric: WorkspaceTrendMetric;
  viewMode: "single" | "comparison";
  downloadsError: string | null;
  installHistoryError: string | null;
}): string[] {
  if (viewMode === "comparison") {
    return collectMissingSources({
      downloadsError,
      installHistoryError,
      needsDownloads: true,
      needsInstallHistory: true,
    });
  }

  return collectMissingSources({
    downloadsError,
    installHistoryError,
    needsDownloads: metric === "downloads",
    needsInstallHistory: metric !== "downloads",
  });
}

function toProviderHealthCell(entry: PackageManagerHealthResult): DashboardHealthCell {
  return {
    id: `provider:${entry.provider_id}`,
    label: entry.display_name,
    status: entry.status,
    issueCount: entry.issues.length,
    href: "/health",
    checkedAt: entry.checked_at,
  };
}

function getLatestTimestamp(values: Array<string | null | undefined>): string | null {
  const timestamps = values.filter((value): value is string => Boolean(value));
  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.sort((left, right) => (
    new Date(right).getTime() - new Date(left).getTime()
  ))[0] ?? null;
}

function severityRank(severity: AttentionSeverity): number {
  switch (severity) {
    case "danger":
      return 3;
    case "warning":
      return 2;
    case "info":
    default:
      return 1;
  }
}
