import { render, screen } from "@testing-library/react";
import { EnvironmentChart } from "./environment-chart";

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

describe("EnvironmentChart", () => {
  it("renders chart title", () => {
    render(<EnvironmentChart environments={[]} />);
    expect(screen.getByText("dashboard.widgets.environmentChart")).toBeInTheDocument();
  });
});
