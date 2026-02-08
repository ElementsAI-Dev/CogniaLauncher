import { render, screen } from "@testing-library/react";
import { ActivityChart } from "./activity-chart";

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

describe("ActivityChart", () => {
  it("renders chart title", () => {
    render(<ActivityChart environments={[]} packages={[]} />);
    expect(screen.getByText("dashboard.widgets.distributionOverview")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <ActivityChart environments={[]} packages={[]} className="custom" />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
