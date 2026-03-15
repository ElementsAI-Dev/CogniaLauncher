"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardStore } from "@/lib/stores/dashboard";
import { useDownloads } from "@/hooks/use-downloads";
import { useHealthCheck } from "@/hooks/use-health-check";
import { usePackages } from "@/hooks/use-packages";
import { useToolbox } from "@/hooks/use-toolbox";
import type {
  EnvironmentInfo,
  HealthStatus,
  InstallHistoryEntry,
  PackageManagerHealthResult,
  DownloadHistoryRecord,
  SystemHealthResult,
} from "@/types/tauri";
import type {
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
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
}

export interface DashboardTrendPoint {
  label: string;
  value: number;
}

export interface DashboardTrendModel {
  range: WidgetRange;
  metric: WorkspaceTrendMetric;
  points: DashboardTrendPoint[];
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
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
  cells: DashboardHealthCell[];
  totals: Record<HealthStatus, number>;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
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
  const visibleWidgets = useMemo(
    () => widgets.filter((widget) => widget.visible),
    [widgets],
  );

  const needsHealth = visibleWidgets.some((widget) =>
    widget.type === "attention-center" || widget.type === "provider-health-matrix",
  );
  const needsDownloadHistory = visibleWidgets.some((widget) =>
    widget.type === "attention-center" ||
    widget.type === "workspace-trends" ||
    widget.type === "recent-activity-feed",
  );
  const needsInstallHistory = visibleWidgets.some((widget) =>
    widget.type === "workspace-trends" || widget.type === "recent-activity-feed",
  );

  const downloads = useDownloads({ enableRuntime: needsDownloadHistory });
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

  const latestActivityTimestamp = useMemo(
    () => getLatestTimestamp(activityItems.map((item) => item.timestamp)),
    [activityItems],
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
        const settings = (widget.settings as RecentActivityFeedSettings | undefined) ?? { limit: 5 };
        return [
          widget.id,
          {
            items: activityItems.slice(0, settings.limit),
            totalCount: activityItems.length,
            isLoading: downloads.isLoading || installHistoryState.loading,
            error: downloads.error ?? installHistoryState.error,
            lastUpdatedAt: latestActivityTimestamp,
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
    latestActivityTimestamp,
    visibleWidgets,
  ]);

  const workspaceTrends = useMemo(() => {
    const entries = visibleWidgets
      .filter((widget) => widget.type === "workspace-trends")
      .map((widget) => {
        const settings = (widget.settings as WorkspaceTrendsSettings | undefined) ?? {
          range: "7d",
          metric: "installations",
        };

        return [
          widget.id,
          {
            range: settings.range,
            metric: settings.metric,
            points: buildTrendPoints({
              range: settings.range,
              metric: settings.metric,
              installHistory: installHistoryState.items,
              downloadHistory: downloads.history,
              now,
            }),
            isLoading: downloads.isLoading || installHistoryState.loading,
            error: downloads.error ?? installHistoryState.error,
            lastUpdatedAt: getLatestTimestamp([
              ...installHistoryState.items.map((entry) => entry.timestamp),
              ...downloads.history.map((record) => record.completedAt),
            ]),
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
    visibleWidgets,
  ]);

  const providerHealthMatrix = useMemo(() => {
    const entries = visibleWidgets
      .filter((widget) => widget.type === "provider-health-matrix")
      .map((widget) => {
        const settings = (widget.settings as ProviderHealthMatrixSettings | undefined) ?? {
          groupBy: "provider",
          showHealthy: true,
        };
        const matrix = buildProviderHealthMatrix(systemHealth, settings);

        return [
          widget.id,
          {
            groupBy: settings.groupBy,
            showHealthy: settings.showHealthy,
            cells: matrix.cells,
            totals: matrix.totals,
            isLoading: healthLoading,
            error: healthError,
            lastUpdatedAt: systemHealth?.checked_at ?? null,
          } satisfies DashboardHealthMatrixModel,
        ] as const;
      });

    return Object.fromEntries(entries);
  }, [healthError, healthLoading, systemHealth, visibleWidgets]);

  return {
    attentionCenter,
    recentActivityFeed,
    workspaceTrends,
    providerHealthMatrix,
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
      timestamp: new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000) - index * 1000).toISOString(),
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
}: {
  range: WidgetRange;
  metric: WorkspaceTrendMetric;
  installHistory: InstallHistoryEntry[];
  downloadHistory: DownloadHistoryRecord[];
  now: Date;
}): DashboardTrendPoint[] {
  const dayCount = range === "30d" ? 30 : 7;
  const buckets = new Map<string, number>();

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - offset);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }

  if (metric === "downloads") {
    for (const record of downloadHistory) {
      const key = record.completedAt.slice(0, 10);
      if (!buckets.has(key)) continue;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  } else {
    const expectedAction = metric === "updates" ? "update" : "install";
    for (const entry of installHistory) {
      if (entry.action !== expectedAction) continue;
      const key = entry.timestamp.slice(0, 10);
      if (!buckets.has(key)) continue;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
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
