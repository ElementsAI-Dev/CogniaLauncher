import { render, screen } from "@testing-library/react";
import { CacheStatsStrip } from "./cache-stats-strip";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("CacheStatsStrip", () => {
  it("renders the loaded cache metrics and usage percentage", () => {
    render(
      <CacheStatsStrip
        totalSizeHuman="1.5 GB"
        usagePercent={45}
        hitRate={0.82}
        totalEntries={12345}
        diskAvailableHuman="80 GB"
        loading={false}
      />,
    );

    expect(screen.getByText("cache.statsStripTotalSize")).toBeInTheDocument();
    expect(screen.getByText("1.5 GB")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("82.0%")).toBeInTheDocument();
    expect(screen.getByText("12,345")).toBeInTheDocument();
    expect(screen.getByText("80 GB")).toBeInTheDocument();
  });

  it("falls back to placeholder values when optional metrics are missing", () => {
    render(
      <CacheStatsStrip
        totalSizeHuman={null}
        usagePercent={0}
        hitRate={null}
        totalEntries={null}
        diskAvailableHuman={null}
        loading={false}
      />,
    );

    expect(screen.getByText("0 B")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("hides the stat labels while loading", () => {
    render(
      <CacheStatsStrip
        totalSizeHuman="1.5 GB"
        usagePercent={45}
        hitRate={0.82}
        totalEntries={12345}
        diskAvailableHuman="80 GB"
        loading
      />,
    );

    expect(
      screen.queryByText("cache.statsStripTotalSize"),
    ).not.toBeInTheDocument();
  });
});
