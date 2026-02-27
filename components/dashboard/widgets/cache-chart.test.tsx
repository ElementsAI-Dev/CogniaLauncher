import { render, screen } from "@testing-library/react";
import { CacheChart } from "./cache-chart";
import type { CacheInfo } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Pie: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RadialBar: () => null,
  RadialBarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PolarAngleAxis: () => null,
  Label: () => null,
}));

jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

jest.mock("@/lib/theme/chart-utils", () => ({
  getChartColor: (i: number) => `color-${i}`,
  getGradientId: (prefix: string, i: number) => `${prefix}-${i}`,
}));

const mockCacheInfo: CacheInfo = {
  total_size: 1048576,
  total_size_human: "1.0 MB",
  download_cache: {
    size: 524288,
    size_human: "512 KB",
    entry_count: 10,
    location: "/cache/downloads",
  },
  metadata_cache: {
    size: 524288,
    size_human: "512 KB",
    entry_count: 20,
    location: "/cache/metadata",
  },
};

const emptyCacheInfo: CacheInfo = {
  total_size: 0,
  total_size_human: "0 B",
  download_cache: {
    size: 0,
    size_human: "0 B",
    entry_count: 0,
    location: "/cache/downloads",
  },
  metadata_cache: {
    size: 0,
    size_human: "0 B",
    entry_count: 0,
    location: "/cache/metadata",
  },
};

describe("CacheChart", () => {
  it("renders chart title when cacheInfo is null", () => {
    render(<CacheChart cacheInfo={null} />);
    expect(screen.getByText("dashboard.widgets.cacheUsage")).toBeInTheDocument();
  });

  it("shows empty state message when cacheInfo is null", () => {
    render(<CacheChart cacheInfo={null} />);
    expect(screen.getByText("cache.noCacheData")).toBeInTheDocument();
  });

  it("renders cache stats when cacheInfo is provided", () => {
    render(<CacheChart cacheInfo={mockCacheInfo} />);
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("renders description when cacheInfo is provided", () => {
    render(<CacheChart cacheInfo={mockCacheInfo} />);
    expect(screen.getByText("dashboard.widgets.cacheUsageDesc")).toBeInTheDocument();
  });

  it("renders stat labels", () => {
    render(<CacheChart cacheInfo={mockCacheInfo} />);
    expect(screen.getByText("cache.totalSize")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.downloadCache")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.metadataCache")).toBeInTheDocument();
  });

  it("renders with empty cache (zero entries)", () => {
    render(<CacheChart cacheInfo={emptyCacheInfo} />);
    expect(screen.getByText("0 B")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <CacheChart cacheInfo={null} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
