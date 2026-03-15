import { render, screen } from "@testing-library/react";
import { CacheStatsStrip } from "./cache-stats-strip";
import type { CacheScopeInsight } from "@/lib/cache/insights";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("CacheStatsStrip", () => {
  const scopeSummaries: CacheScopeInsight[] = [
    {
      id: "internal",
      titleKey: "cache.insightInternalTitle",
      sizeHuman: "1.2 GB",
      entryCount: 120,
      status: "healthy",
      statusLabelKey: "cache.insightStatusHealthy",
      tone: "success",
      coverage: "historical",
      coverageLabelKey: "cache.insightCoverageHistorical",
    },
    {
      id: "default_downloads",
      titleKey: "cache.defaultDownloads",
      sizeHuman: "240 MB",
      entryCount: 12,
      status: "available",
      statusLabelKey: "cache.insightStatusAvailable",
      tone: "default",
      coverage: "snapshot",
      coverageLabelKey: "cache.insightCoverageSnapshot",
    },
    {
      id: "external",
      titleKey: "cache.externalPanelTitle",
      sizeHuman: "800 MB",
      entryCount: 4,
      status: "available",
      statusLabelKey: "cache.insightStatusAvailable",
      tone: "warning",
      coverage: "snapshot",
      coverageLabelKey: "cache.insightCoverageSnapshot",
    },
  ];

  it("renders the loaded cache metrics and usage percentage", () => {
    render(
      <CacheStatsStrip
        totalSizeHuman="1.5 GB"
        usagePercent={45}
        totalEntries={12345}
        diskAvailableHuman="80 GB"
        freshness={{ state: "fresh", lastUpdatedAt: Date.now() }}
        scopeSummaries={scopeSummaries}
        loading={false}
      />,
    );

    expect(screen.getByText("cache.statsStripTotalSize")).toBeInTheDocument();
    expect(screen.getByText("1.5 GB")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("12,345")).toBeInTheDocument();
    expect(screen.getByText("80 GB")).toBeInTheDocument();
    expect(screen.getByText("cache.insightInternalTitle")).toBeInTheDocument();
    expect(screen.getByText("cache.defaultDownloads")).toBeInTheDocument();
    expect(screen.getByText("cache.externalPanelTitle")).toBeInTheDocument();
    expect(screen.getByText("cache.insightCoverageHistorical")).toBeInTheDocument();
    expect(screen.getAllByText("cache.insightCoverageSnapshot")).toHaveLength(2);
    expect(screen.getAllByText("cache.insightStatusAvailable")).toHaveLength(2);
  });

  it("falls back to placeholder values when optional metrics are missing", () => {
    render(
      <CacheStatsStrip
        totalSizeHuman={null}
        usagePercent={0}
        totalEntries={null}
        diskAvailableHuman={null}
        freshness={{ state: "missing", lastUpdatedAt: null }}
        scopeSummaries={[
          {
            id: "external",
            titleKey: "cache.externalPanelTitle",
            sizeHuman: "0 B",
            entryCount: null,
            status: "snapshot_pending",
            statusLabelKey: "cache.insightStatusSnapshotPending",
            tone: "muted",
            coverage: "snapshot",
            coverageLabelKey: "cache.insightCoverageSnapshot",
          },
        ]}
        loading={false}
      />,
    );

    expect(screen.getAllByText("0 B").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(
      screen.getByText("cache.insightStatusSnapshotPending"),
    ).toBeInTheDocument();
  });

  it("hides the stat labels while loading", () => {
    render(
      <CacheStatsStrip
        totalSizeHuman="1.5 GB"
        usagePercent={45}
        totalEntries={12345}
        diskAvailableHuman="80 GB"
        freshness={{ state: "fresh", lastUpdatedAt: Date.now() }}
        scopeSummaries={scopeSummaries}
        loading
      />,
    );

    expect(
      screen.queryByText("cache.statsStripTotalSize"),
    ).not.toBeInTheDocument();
  });
});
