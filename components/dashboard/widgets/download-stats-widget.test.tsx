import { render, screen } from "@testing-library/react";
import { DownloadStatsWidget } from "./download-stats-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/stores/download", () => ({
  useDownloadStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ tasks: [], history: [], stats: { totalDownloaded: 0 } }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  CartesianGrid: () => null,
}));

jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

describe("DownloadStatsWidget", () => {
  it("renders download stats heading", () => {
    render(<DownloadStatsWidget />);
    expect(screen.getByText("dashboard.widgets.downloadStats")).toBeInTheDocument();
  });
});
