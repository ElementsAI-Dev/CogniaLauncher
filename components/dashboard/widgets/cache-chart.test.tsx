import { render, screen } from "@testing-library/react";
import { CacheChart } from "./cache-chart";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Pie: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Label: () => null,
}));

jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

describe("CacheChart", () => {
  it("renders chart title", () => {
    render(<CacheChart cacheInfo={null} />);
    expect(screen.getByText("dashboard.widgets.cacheUsage")).toBeInTheDocument();
  });
});
