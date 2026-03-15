import { renderHook, waitFor } from "@testing-library/react";
import { useDashboardInsights } from "./use-dashboard-insights";

let mockWidgets: Array<Record<string, unknown>> = [];
const mockUseDownloads = jest.fn();
const mockGetInstallHistory = jest.fn();
const mockCheckAll = jest.fn(() => Promise.resolve());

jest.mock("@/lib/stores/dashboard", () => ({
  useDashboardStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ widgets: mockWidgets }),
}));

jest.mock("@/hooks/use-downloads", () => ({
  useDownloads: (...args: unknown[]) => mockUseDownloads(...args),
}));

jest.mock("@/hooks/use-packages", () => ({
  usePackages: () => ({
    getInstallHistory: (...args: unknown[]) => mockGetInstallHistory(...args),
  }),
}));

jest.mock("@/hooks/use-health-check", () => ({
  useHealthCheck: () => ({
    systemHealth: {
      overall_status: "warning",
      environments: [
        {
          env_type: "node",
          provider_id: "nvm",
          status: "healthy",
          issues: [],
          suggestions: [],
          current_version: "20.0.0",
          installed_count: 2,
          checked_at: "2026-03-14T12:00:00.000Z",
        },
      ],
      package_managers: [
        {
          provider_id: "npm",
          display_name: "npm",
          status: "warning",
          issues: [
            {
              severity: "warning",
              category: "provider",
              message: "Registry latency detected",
              details: null,
              fix_command: null,
              fix_description: null,
            },
          ],
          install_instructions: null,
          version: "10.0.0",
          executable_path: "/usr/bin/npm",
          checked_at: "2026-03-14T12:00:00.000Z",
        },
      ],
      system_issues: [
        {
          severity: "warning",
          category: "network",
          message: "Registry checks are degraded",
          details: null,
          fix_command: null,
          fix_description: null,
          remediation_id: "retry-network",
          confidence: "verified",
          signal_source: "runtime_probe",
        },
      ],
      skipped_providers: [],
      checked_at: "2026-03-14T12:00:00.000Z",
    },
    loading: false,
    error: null,
    summary: {
      environmentCount: 1,
      healthyCount: 1,
      warningCount: 0,
      errorCount: 0,
      unavailableCount: 0,
      unavailableScopeCount: 0,
      timeoutScopeCount: 0,
      unsupportedScopeCount: 0,
      packageManagerCount: 1,
      unavailablePackageManagerCount: 0,
      issueCount: 2,
      verifiedIssueCount: 2,
      advisoryIssueCount: 0,
      actionableIssueCount: 1,
    },
    checkAll: (...args: unknown[]) => mockCheckAll(...args),
  }),
}));

jest.mock("@/hooks/use-toolbox", () => ({
  useToolbox: () => ({
    recentTools: ["builtin:uuid-generator"],
    allTools: [
      {
        id: "builtin:uuid-generator",
        name: "UUID Generator",
      },
    ],
  }),
}));

describe("useDashboardInsights", () => {
  const mockT = (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      "dashboard.widgets.insightAttentionHealthTitle": "Translated health attention",
      "dashboard.widgets.insightAttentionHealthDesc": `${params?.count ?? 0} translated health issues`,
      "dashboard.widgets.insightAttentionDownloadsTitle": "Translated downloads attention",
      "dashboard.widgets.insightAttentionDownloadsDesc": `${params?.count ?? 0} translated download failures`,
      "dashboard.widgets.insightAttentionEnvironmentsTitle": "Translated environment attention",
      "dashboard.widgets.insightAttentionEnvironmentsDesc": `${params?.count ?? 0} translated unavailable environments`,
      "dashboard.widgets.insightActivityDownloadFailed": "Translated download failed",
      "dashboard.widgets.insightActivityDownloadStatus_completed": "Translated download completed",
      "dashboard.widgets.insightActivityToolboxRecent": "Translated recent tool",
      "dashboard.widgets.insightActivityPackage_install": "Translated install",
      "dashboard.widgets.insightActivityPackage_update": "Translated update",
      "dashboard.widgets.insightActivityPackage_uninstall": "Translated uninstall",
      "dashboard.widgets.insightActivityPackage_rollback": "Translated rollback",
    };
    return translations[key] ?? key;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWidgets = [];
    mockUseDownloads.mockReturnValue({
      history: [],
      isLoading: false,
      error: null,
    });
    mockGetInstallHistory.mockResolvedValue([]);
  });

  it("does not fetch secondary insight data when no visible insight widgets need it", () => {
    mockWidgets = [
      { id: "w-stats", type: "stats-overview", visible: true, size: "full" },
    ];

    renderHook(() =>
      useDashboardInsights({
        environments: [],
        packages: [],
        now: new Date("2026-03-14T12:00:00.000Z"),
        t: mockT,
      }),
    );

    expect(mockUseDownloads).toHaveBeenCalledWith({ enableRuntime: false });
    expect(mockGetInstallHistory).not.toHaveBeenCalled();
    expect(mockCheckAll).not.toHaveBeenCalled();
  });

  it("builds widget-friendly insight models and triggers only the needed secondary fetches", async () => {
    mockWidgets = [
      {
        id: "w-attention",
        type: "attention-center",
        visible: true,
        size: "md",
        settings: { maxItems: 3 },
      },
      {
        id: "w-trends",
        type: "workspace-trends",
        visible: true,
        size: "lg",
        settings: { range: "7d", metric: "downloads" },
      },
      {
        id: "w-activity",
        type: "recent-activity-feed",
        visible: true,
        size: "md",
        settings: { limit: 5 },
      },
      {
        id: "w-health-matrix",
        type: "provider-health-matrix",
        visible: true,
        size: "md",
        settings: { groupBy: "provider", showHealthy: true },
      },
    ];

    mockUseDownloads.mockReturnValue({
      history: [
        {
          id: "dl-1",
          filename: "node-v20.zip",
          status: "failed",
          provider: "github",
          startedAt: "2026-03-14T11:40:00.000Z",
          completedAt: "2026-03-14T11:42:00.000Z",
          error: "checksum mismatch",
        },
        {
          id: "dl-2",
          filename: "python-3.12.zip",
          status: "completed",
          provider: "mirror",
          startedAt: "2026-03-14T11:10:00.000Z",
          completedAt: "2026-03-14T11:12:00.000Z",
          error: null,
        },
      ],
      isLoading: false,
      error: null,
    });
    mockGetInstallHistory.mockResolvedValue([
      {
        id: "pkg-1",
        name: "typescript",
        version: "5.9.0",
        action: "install",
        timestamp: "2026-03-14T10:00:00.000Z",
        provider: "npm",
        success: true,
        error_message: null,
      },
      {
        id: "pkg-2",
        name: "pnpm",
        version: "10.0.0",
        action: "update",
        timestamp: "2026-03-13T08:00:00.000Z",
        provider: "npm",
        success: true,
        error_message: null,
      },
    ]);

    const { result } = renderHook(() =>
      useDashboardInsights({
        environments: [
          {
            env_type: "python",
            provider: "pyenv",
            provider_id: "pyenv",
            available: false,
            current_version: null,
            installed_versions: [],
            total_size: 0,
            version_count: 0,
          },
        ],
        packages: [],
        now: new Date("2026-03-14T12:00:00.000Z"),
        t: mockT,
      }),
    );

    await waitFor(() => {
      expect(mockGetInstallHistory).toHaveBeenCalledWith({ limit: 30 });
    });

    expect(mockUseDownloads).toHaveBeenCalledWith({ enableRuntime: true });
    expect(mockCheckAll).toHaveBeenCalledTimes(1);

    expect(result.current.attentionCenter["w-attention"].items.length).toBeGreaterThan(0);
    expect(result.current.attentionCenter["w-attention"].items[0]?.source).toBe("health");
    expect(result.current.attentionCenter["w-attention"].items[0]?.title).toBe("Translated health attention");
    expect(result.current.attentionCenter["w-attention"].items[1]?.title).toBe("Translated downloads attention");

    expect(result.current.recentActivityFeed["w-activity"].items[0]?.id).toBe("download:dl-1");
    expect(result.current.recentActivityFeed["w-activity"].items[0]?.description).toBe("checksum mismatch");
    expect(result.current.recentActivityFeed["w-activity"].items[1]?.description).toBe("Translated download completed");
    expect(result.current.workspaceTrends["w-trends"].metric).toBe("downloads");
    expect(result.current.workspaceTrends["w-trends"].points.length).toBeGreaterThan(0);
    expect(result.current.providerHealthMatrix["w-health-matrix"].totals.warning).toBe(1);
  });

  it("re-fetches secondary insight data when the refresh key changes", async () => {
    mockWidgets = [
      {
        id: "w-attention",
        type: "attention-center",
        visible: true,
        size: "md",
        settings: { maxItems: 3 },
      },
      {
        id: "w-activity",
        type: "recent-activity-feed",
        visible: true,
        size: "md",
        settings: { limit: 5 },
      },
      {
        id: "w-health-matrix",
        type: "provider-health-matrix",
        visible: true,
        size: "md",
        settings: { groupBy: "provider", showHealthy: true },
      },
    ];
    mockUseDownloads.mockReturnValue({
      history: [],
      isLoading: false,
      error: null,
    });
    mockGetInstallHistory.mockResolvedValue([]);

    const options = {
      environments: [],
      packages: [],
      now: new Date("2026-03-14T12:00:00.000Z"),
      t: mockT,
      refreshKey: 0,
    };

    const { rerender } = renderHook(
      ({ currentOptions }) => useDashboardInsights(currentOptions),
      {
        initialProps: { currentOptions: options },
      },
    );

    await waitFor(() => {
      expect(mockGetInstallHistory).toHaveBeenCalledTimes(1);
      expect(mockCheckAll).toHaveBeenCalledTimes(1);
    });

    mockGetInstallHistory.mockClear();
    mockCheckAll.mockClear();

    rerender({
      currentOptions: {
        ...options,
        refreshKey: 1,
      },
    });

    await waitFor(() => {
      expect(mockGetInstallHistory).toHaveBeenCalledTimes(1);
      expect(mockCheckAll).toHaveBeenCalledTimes(1);
    });
  });
});
