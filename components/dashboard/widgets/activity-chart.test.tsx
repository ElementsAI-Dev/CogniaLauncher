import { render, screen } from "@testing-library/react";
import { ActivityChart } from "./activity-chart";
import type { EnvironmentInfo, InstalledPackage } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  AreaChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data?: unknown;
  }) => (
    <svg data-testid="activity-area-chart" data-chart-data={JSON.stringify(data ?? [])}>
      {children}
    </svg>
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
}));

jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

jest.mock("@/lib/theme/chart-utils", () => ({
  getChartColor: (i: number) => `color-${i}`,
  getGradientId: (prefix: string, i: number) => `${prefix}-${i}`,
  getChartGradientDefinition: jest.fn(() => ({
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
    stops: [
      { offset: "5%", opacity: 0.6 },
      { offset: "60%", opacity: 0.2 },
      { offset: "95%", opacity: 0.05 },
    ],
  })),
  getChartAxisTickStyle: jest.fn((fontSize = 11) => ({ fontSize, fill: "var(--foreground)" })),
  getChartGridStyle: jest.fn(() => ({ stroke: "var(--border)", strokeOpacity: 0.3 })),
}));

const mockEnvironments: EnvironmentInfo[] = [
  {
    env_type: "node",
    provider: "nvm",
    provider_id: "nvm",
    available: true,
    current_version: "20.0.0",
    installed_versions: [
      { version: "18.0.0", install_path: "/p", size: null, installed_at: null, is_current: false },
      { version: "20.0.0", install_path: "/p", size: null, installed_at: null, is_current: true },
    ],
    total_size: 0,
    version_count: 2,
  },
];

const mockPackages: InstalledPackage[] = [
  { name: "typescript", version: "5.0.0", provider: "npm", install_path: "/p", installed_at: "2024-01-01", is_global: true },
  { name: "react", version: "18.0.0", provider: "npm", install_path: "/p", installed_at: "2024-01-01", is_global: true },
];

describe("ActivityChart", () => {
  it("renders chart title", () => {
    render(<ActivityChart environments={[]} packages={[]} />);
    expect(screen.getByText("dashboard.widgets.distributionOverview")).toBeInTheDocument();
  });

  it("shows empty state message when no data", () => {
    render(<ActivityChart environments={[]} packages={[]} />);
    expect(screen.getByText("dashboard.widgets.noActivity")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    render(
      <ActivityChart
        environments={mockEnvironments}
        packages={mockPackages}
        model={{
          range: "30d",
          viewMode: "intensity",
          isUsingSharedRange: true,
          points: [
            { label: "2026-03-13", downloads: 1, packages: 2, toolbox: 0, total: 3 },
            { label: "2026-03-14", downloads: 2, packages: 1, toolbox: 1, total: 4 },
          ],
          totals: { downloads: 3, packages: 3, toolbox: 1, total: 7 },
          isLoading: false,
          error: null,
          lastUpdatedAt: "2026-03-14T12:00:00.000Z",
          missingSources: [],
          isPartial: false,
        }}
      />,
    );
    expect(screen.getByText("dashboard.widgets.distributionOverview")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.distributionOverviewDesc")).toBeInTheDocument();
    expect(screen.getByTestId("activity-chart-shared-scope")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.settingsViewMode_intensity")).toBeInTheDocument();
  });

  it("normalizes fallback chart data into a stable area-chart shape", () => {
    render(<ActivityChart environments={mockEnvironments} packages={mockPackages} />);

    const rawChartData = screen.getByTestId("activity-area-chart").getAttribute("data-chart-data");
    const chartData = JSON.parse(rawChartData ?? "[]") as Array<Record<string, number | string>>;

    expect(chartData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "node",
          environments: 2,
          packages: 0,
          downloads: 0,
          toolbox: 0,
          total: 0,
        }),
        expect.objectContaining({
          name: "npm",
          environments: 0,
          packages: 2,
          downloads: 0,
          toolbox: 0,
          total: 0,
        }),
      ]),
    );
  });

  it("does not show empty state message when data exists", () => {
    render(
      <ActivityChart
        environments={mockEnvironments}
        packages={mockPackages}
        model={{
          range: "30d",
          viewMode: "intensity",
          isUsingSharedRange: true,
          points: [
            { label: "2026-03-13", downloads: 1, packages: 2, toolbox: 0, total: 3 },
          ],
          totals: { downloads: 1, packages: 2, toolbox: 0, total: 3 },
          isLoading: false,
          error: null,
          lastUpdatedAt: "2026-03-14T12:00:00.000Z",
          missingSources: [],
          isPartial: false,
        }}
      />,
    );
    expect(screen.queryByText("dashboard.widgets.noActivity")).not.toBeInTheDocument();
  });

  it("uses shared chart gradient and axis/grid style helpers", () => {
    const chartUtils = jest.requireMock("@/lib/theme/chart-utils");
    render(<ActivityChart environments={mockEnvironments} packages={mockPackages} />);
    expect(chartUtils.getChartGradientDefinition).toHaveBeenCalled();
    expect(chartUtils.getChartAxisTickStyle).toHaveBeenCalled();
    expect(chartUtils.getChartGridStyle).toHaveBeenCalled();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <ActivityChart environments={[]} packages={[]} className="custom" />,
    );
    expect(container.firstChild).toHaveClass("custom");
  });
});
