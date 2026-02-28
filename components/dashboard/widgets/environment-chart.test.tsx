import { render, screen } from "@testing-library/react";
import { EnvironmentChart } from "./environment-chart";
import type { EnvironmentInfo } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
}));

jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
  ChartLegend: () => null,
  ChartLegendContent: () => null,
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
];

describe("EnvironmentChart", () => {
  it("renders chart title", () => {
    render(<EnvironmentChart environments={[]} />);
    expect(screen.getByText("dashboard.widgets.environmentChart")).toBeInTheDocument();
  });

  it("shows empty state message when no environments", () => {
    render(<EnvironmentChart environments={[]} />);
    expect(screen.getByText("dashboard.noEnvironments")).toBeInTheDocument();
  });

  it("renders chart with environments data", () => {
    render(<EnvironmentChart environments={mockEnvironments} />);
    expect(screen.getByText("dashboard.widgets.environmentChart")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.environmentChartDesc")).toBeInTheDocument();
  });

  it("does not show empty state when environments exist", () => {
    render(<EnvironmentChart environments={mockEnvironments} />);
    expect(screen.queryByText("dashboard.noEnvironments")).not.toBeInTheDocument();
  });

  it("shows status distribution label", () => {
    render(<EnvironmentChart environments={mockEnvironments} />);
    expect(screen.getByText("dashboard.widgets.statusDistribution")).toBeInTheDocument();
  });

  it("shows installed versions section for environments with versions", () => {
    render(<EnvironmentChart environments={mockEnvironments} />);
    expect(screen.getByText("dashboard.widgets.installedVersions")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <EnvironmentChart environments={[]} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
