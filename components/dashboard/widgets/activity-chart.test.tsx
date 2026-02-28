import { render, screen } from "@testing-library/react";
import { ActivityChart } from "./activity-chart";
import type { EnvironmentInfo, InstalledPackage } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    render(<ActivityChart environments={mockEnvironments} packages={mockPackages} />);
    expect(screen.getByText("dashboard.widgets.distributionOverview")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.distributionOverviewDesc")).toBeInTheDocument();
  });

  it("does not show empty state message when data exists", () => {
    render(<ActivityChart environments={mockEnvironments} packages={mockPackages} />);
    expect(screen.queryByText("dashboard.widgets.noActivity")).not.toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <ActivityChart environments={[]} packages={[]} className="custom" />,
    );
    expect(container.firstChild).toHaveClass("custom");
  });
});
