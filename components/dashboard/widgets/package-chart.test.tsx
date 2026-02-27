import { render, screen } from "@testing-library/react";
import { PackageChart } from "./package-chart";
import type { InstalledPackage, ProviderInfo } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

const mockPackages: InstalledPackage[] = [
  { name: "typescript", version: "5.0.0", provider: "npm", install_path: "/p", installed_at: "2024-01-01", is_global: true },
  { name: "react", version: "18.2.0", provider: "npm", install_path: "/p", installed_at: "2024-01-01", is_global: true },
  { name: "flask", version: "2.0.0", provider: "pip", install_path: "/p", installed_at: "2024-01-01", is_global: true },
];

const mockProviders: ProviderInfo[] = [
  { id: "npm", display_name: "npm", capabilities: [], platforms: [], priority: 1, is_environment_provider: false, enabled: true },
  { id: "pip", display_name: "pip", capabilities: [], platforms: [], priority: 1, is_environment_provider: false, enabled: true },
];

describe("PackageChart", () => {
  it("renders chart title", () => {
    render(<PackageChart packages={[]} providers={[]} />);
    expect(screen.getByText("dashboard.widgets.packageChart")).toBeInTheDocument();
  });

  it("shows empty state when no packages", () => {
    render(<PackageChart packages={[]} providers={[]} />);
    expect(screen.getByText("dashboard.noPackages")).toBeInTheDocument();
  });

  it("renders description when packages exist", () => {
    render(<PackageChart packages={mockPackages} providers={mockProviders} />);
    expect(screen.getByText("dashboard.widgets.packageChartDesc")).toBeInTheDocument();
  });

  it("shows total packages count", () => {
    render(<PackageChart packages={mockPackages} providers={mockProviders} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.totalPackages")).toBeInTheDocument();
  });

  it("shows active providers count", () => {
    render(<PackageChart packages={mockPackages} providers={mockProviders} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.activeProviders")).toBeInTheDocument();
  });

  it("does not show empty state when packages exist", () => {
    render(<PackageChart packages={mockPackages} providers={mockProviders} />);
    expect(screen.queryByText("dashboard.noPackages")).not.toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <PackageChart packages={[]} providers={[]} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
