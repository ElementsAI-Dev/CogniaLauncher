function loadAboutSupportModule():
  | {
      buildAboutSupportState?: (
        input: Record<string, unknown>,
      ) => Record<string, unknown>;
      getLatestTimestamp?: (...timestamps: Array<string | null | undefined>) => string | null;
    }
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./about-support");
  } catch {
    return null;
  }
}

describe("about-support", () => {
  it("exposes a support-state builder", () => {
    const loadedAboutSupport = loadAboutSupportModule();

    expect(loadedAboutSupport?.buildAboutSupportState).toBeDefined();
    expect(loadedAboutSupport?.getLatestTimestamp).toBeDefined();
  });

  it("returns the latest non-null timestamp in lexicographic order", () => {
    const loadedAboutSupport = loadAboutSupportModule();

    expect(loadedAboutSupport?.getLatestTimestamp?.(null, undefined)).toBeNull();
    expect(
      loadedAboutSupport?.getLatestTimestamp?.(
        "2026-03-14T08:00:00.000Z",
        "2026-03-14T09:00:00.000Z",
        "2026-03-14T07:00:00.000Z",
      ),
    ).toBe("2026-03-14T09:00:00.000Z");
  });

  it("derives a ready support summary for a healthy desktop state", () => {
    const loadedAboutSupport = loadAboutSupportModule();

    expect(loadedAboutSupport?.buildAboutSupportState).toBeDefined();
    if (!loadedAboutSupport?.buildAboutSupportState) return;

    const result = loadedAboutSupport.buildAboutSupportState({
      isDesktop: true,
      loading: false,
      systemLoading: false,
      insightsLoading: false,
      updateInfo: {
        current_version: "1.0.0",
        latest_version: "1.0.0",
        update_available: false,
        release_notes: null,
      },
      updateStatus: "up_to_date",
      updateErrorCategory: null,
      systemError: null,
      systemInfo: {
        sectionSummary: {
          platform: { status: "ok" },
          components: { status: "ok", itemCount: 1 },
          battery: { status: "ok" },
          disks: { status: "ok", itemCount: 1 },
          networks: { status: "ok", itemCount: 1 },
          cache: { status: "ok" },
          homeDir: { status: "ok" },
        },
      },
      aboutInsights: {
        runtimeMode: "desktop",
        providerSummary: {
          total: 2,
          installed: 2,
          supported: 2,
          unsupported: 0,
        },
        storageSummary: {
          cacheTotalSizeHuman: "3 MB",
          logTotalSizeBytes: 1024,
          logTotalSizeHuman: "1 KB",
        },
        sections: {
          providers: "ok",
          logs: "ok",
          cache: "ok",
        },
        generatedAt: "2026-03-14T08:00:00.000Z",
      },
      supportFreshness: {
        updateCheckedAt: "2026-03-14T08:00:00.000Z",
        systemInfoRefreshedAt: "2026-03-14T08:01:00.000Z",
        insightsGeneratedAt: "2026-03-14T08:02:00.000Z",
        latestSuccessfulAt: "2026-03-14T08:02:00.000Z",
      },
    });

    expect(result).toMatchObject({
      health: "ready",
      issueCount: 0,
      diagnosticsReady: true,
      degradedSectionIds: [],
      freshness: {
        latestSuccessfulAt: "2026-03-14T08:02:00.000Z",
      },
    });
  });

  it("maps degraded sections and follow-up actions for mixed support failures", () => {
    const loadedAboutSupport = loadAboutSupportModule();

    expect(loadedAboutSupport?.buildAboutSupportState).toBeDefined();
    if (!loadedAboutSupport?.buildAboutSupportState) return;

    const result = loadedAboutSupport.buildAboutSupportState({
      isDesktop: true,
      loading: false,
      systemLoading: false,
      insightsLoading: false,
      updateInfo: {
        current_version: "1.0.0",
        latest_version: "1.1.0",
        update_available: true,
        release_notes: null,
      },
      updateStatus: "error",
      updateErrorCategory: "network_error",
      systemError: "system_info_failed",
      systemInfo: {
        sectionSummary: {
          platform: { status: "ok" },
          components: { status: "ok", itemCount: 0 },
          battery: { status: "ok" },
          disks: { status: "ok", itemCount: 0 },
          networks: { status: "failed", itemCount: 0 },
          cache: { status: "ok" },
          homeDir: { status: "ok" },
        },
      },
      aboutInsights: {
        runtimeMode: "desktop",
        providerSummary: {
          total: 3,
          installed: 1,
          supported: 2,
          unsupported: 1,
        },
        storageSummary: {
          cacheTotalSizeHuman: "3 MB",
          logTotalSizeBytes: null,
          logTotalSizeHuman: null,
        },
        sections: {
          providers: "failed",
          logs: "failed",
          cache: "ok",
        },
        generatedAt: "2026-03-14T09:00:00.000Z",
      },
      supportFreshness: {
        updateCheckedAt: "2026-03-14T09:00:00.000Z",
        systemInfoRefreshedAt: null,
        insightsGeneratedAt: "2026-03-14T09:00:00.000Z",
        latestSuccessfulAt: "2026-03-14T09:00:00.000Z",
      },
    });

    expect(result).toMatchObject({
      health: "degraded",
      diagnosticsReady: false,
    });
    expect(result.degradedSectionIds).toEqual(
      expect.arrayContaining(["update", "system", "networks", "providers", "logs"]),
    );
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "open_providers" }),
        expect.objectContaining({ id: "open_logs" }),
        expect.objectContaining({ id: "export_diagnostics" }),
        expect.objectContaining({ id: "report_bug" }),
      ]),
    );
  });

  it("treats web unavailable sections as supported fallback instead of degraded state", () => {
    const loadedAboutSupport = loadAboutSupportModule();

    expect(loadedAboutSupport?.buildAboutSupportState).toBeDefined();
    if (!loadedAboutSupport?.buildAboutSupportState) return;

    const result = loadedAboutSupport.buildAboutSupportState({
      isDesktop: false,
      loading: false,
      systemLoading: false,
      insightsLoading: false,
      updateInfo: {
        current_version: "1.0.0",
        latest_version: "1.0.0",
        update_available: false,
        release_notes: null,
      },
      updateStatus: "up_to_date",
      updateErrorCategory: null,
      systemError: null,
      systemInfo: {
        sectionSummary: {
          platform: { status: "ok" },
          components: { status: "ok", itemCount: 0 },
          battery: { status: "ok" },
          disks: { status: "ok", itemCount: 0 },
          networks: { status: "ok", itemCount: 0 },
          cache: { status: "ok" },
          homeDir: { status: "ok" },
        },
      },
      aboutInsights: {
        runtimeMode: "web",
        providerSummary: {
          total: 0,
          installed: 0,
          supported: 0,
          unsupported: 0,
        },
        storageSummary: {
          cacheTotalSizeHuman: "0 B",
          logTotalSizeBytes: null,
          logTotalSizeHuman: null,
        },
        sections: {
          providers: "unavailable",
          logs: "unavailable",
          cache: "unavailable",
        },
        generatedAt: "2026-03-14T10:00:00.000Z",
      },
      supportFreshness: {
        updateCheckedAt: "2026-03-14T10:00:00.000Z",
        systemInfoRefreshedAt: "2026-03-14T10:00:00.000Z",
        insightsGeneratedAt: "2026-03-14T10:00:00.000Z",
        latestSuccessfulAt: "2026-03-14T10:00:00.000Z",
      },
    });

    expect(result).toMatchObject({
      health: "ready",
      diagnosticsReady: true,
      degradedSectionIds: [],
    });
    expect(result.recommendedActions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "install_update" })]),
    );
  });

  it("derives fallback freshness from the latest known timestamp", () => {
    const loadedAboutSupport = loadAboutSupportModule();

    expect(loadedAboutSupport?.buildAboutSupportState).toBeDefined();
    if (!loadedAboutSupport?.buildAboutSupportState) return;

    const result = loadedAboutSupport.buildAboutSupportState({
      isDesktop: true,
      loading: true,
      systemLoading: true,
      insightsLoading: true,
      updateInfo: null,
      updateStatus: "idle",
      updateErrorCategory: null,
      systemError: null,
      systemInfo: null,
      aboutInsights: null,
      supportFreshness: {
        updateCheckedAt: "2026-03-14T11:00:00.000Z",
        systemInfoRefreshedAt: "2026-03-14T11:02:00.000Z",
        insightsGeneratedAt: "2026-03-14T11:01:00.000Z",
        latestSuccessfulAt: null,
      },
    });

    expect(result).toMatchObject({
      health: "ready",
      issueCount: 0,
      diagnosticsReady: false,
      freshness: {
        latestSuccessfulAt: "2026-03-14T11:02:00.000Z",
      },
    });
  });

  it("deduplicates repeated actions and issues when multiple triggers point to the same follow-up", () => {
    const loadedAboutSupport = loadAboutSupportModule();

    expect(loadedAboutSupport?.buildAboutSupportState).toBeDefined();
    if (!loadedAboutSupport?.buildAboutSupportState) return;

    const result = loadedAboutSupport.buildAboutSupportState({
      isDesktop: true,
      loading: false,
      systemLoading: false,
      insightsLoading: false,
      updateInfo: {
        current_version: "1.0.0",
        latest_version: "1.1.0",
        update_available: true,
        release_notes: null,
      },
      updateStatus: "error",
      updateErrorCategory: "network_error",
      systemError: null,
      systemInfo: {
        sectionSummary: {
          platform: { status: "ok" },
          components: { status: "ok", itemCount: 1 },
          battery: { status: "ok" },
          disks: { status: "ok", itemCount: 1 },
          networks: { status: "ok", itemCount: 1 },
          cache: { status: "ok" },
          homeDir: { status: "ok" },
        },
      },
      aboutInsights: {
        runtimeMode: "desktop",
        providerSummary: {
          total: 2,
          installed: 1,
          supported: 1,
          unsupported: 1,
        },
        storageSummary: {
          cacheTotalSizeHuman: "1 MB",
          logTotalSizeBytes: 0,
          logTotalSizeHuman: "0 B",
        },
        sections: {
          providers: "failed",
          logs: "ok",
          cache: "failed",
        },
        generatedAt: "2026-03-14T12:00:00.000Z",
      },
      supportFreshness: {
        updateCheckedAt: "2026-03-14T12:00:00.000Z",
        systemInfoRefreshedAt: "2026-03-14T12:00:00.000Z",
        insightsGeneratedAt: "2026-03-14T12:00:00.000Z",
        latestSuccessfulAt: "2026-03-14T12:00:00.000Z",
      },
    });

    expect(result.issues.filter((issue: { id: string }) => issue.id === "update_error")).toHaveLength(1);
    expect(result.recommendedActions.filter((action: { id: string }) => action.id === "open_changelog")).toHaveLength(1);
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "open_providers" }),
        expect.objectContaining({ id: "open_cache" }),
        expect.objectContaining({ id: "export_diagnostics" }),
      ]),
    );
  });
});
