import { render, screen } from "@testing-library/react";
import { DownloadStatsWidget } from "./download-stats-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

let mockTasks: Array<{ state: string }> = [];
let mockHistory: Array<{ status: string }> | null = null;
let mockStats: { overallProgress: number } | null = null;

jest.mock("@/lib/stores/download", () => ({
  useDownloadStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ tasks: mockTasks, history: mockHistory, stats: mockStats }),
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
  beforeEach(() => {
    mockTasks = [];
    mockHistory = null;
    mockStats = null;
  });

  it("renders download stats heading", () => {
    render(<DownloadStatsWidget />);
    expect(screen.getByText("dashboard.widgets.downloadStats")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<DownloadStatsWidget />);
    expect(screen.getByText("dashboard.widgets.downloadStatsDesc")).toBeInTheDocument();
  });

  it("shows zero counts when no tasks", () => {
    render(<DownloadStatsWidget />);
    // All four stats should show 0
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBe(4);
  });

  it("shows summary stats labels", () => {
    render(<DownloadStatsWidget />);
    expect(screen.getByText("dashboard.widgets.dlActive")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.dlCompleted")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.dlFailed")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.dlPaused")).toBeInTheDocument();
  });

  it("counts active tasks correctly", () => {
    mockTasks = [
      { state: "downloading" },
      { state: "queued" },
      { state: "completed" },
    ];
    render(<DownloadStatsWidget />);
    // Active = 2 (downloading + queued), completed = 1
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("combines task and history completed counts", () => {
    mockTasks = [{ state: "completed" }];
    mockHistory = [{ status: "completed" }, { status: "completed" }];
    render(<DownloadStatsWidget />);
    // Total completed = 1 (task) + 2 (history) = 3
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows overall progress when stats available", () => {
    mockStats = { overallProgress: 75 };
    render(<DownloadStatsWidget />);
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(<DownloadStatsWidget className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});
