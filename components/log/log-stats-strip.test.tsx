import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogStatsStrip } from "./log-stats-strip";
import type {
  LogsWorkspaceOverviewMetric,
  LogsWorkspaceAttention,
  LogsWorkspaceActionSummary,
} from "@/lib/log-workspace";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "logs.showDetails": "Show details",
        "logs.hideDetails": "Hide details",
        "logs.overviewRecentActionTitle": "Latest workspace action",
      };
      return map[key] ?? key;
    },
  }),
}));

const metrics: LogsWorkspaceOverviewMetric[] = [
  { id: "runtime", label: "Runtime", value: "Desktop Release" },
  { id: "storage", label: "Storage", value: "2 files · 1.5 KB" },
  { id: "context", label: "Context", value: "Realtime monitoring" },
  { id: "session", label: "Session", value: "Current session protected" },
];

const attention: LogsWorkspaceAttention[] = [
  {
    id: "bridge",
    title: "Backend bridge needs attention",
    description: "Backend logs are not flowing.",
    tone: "warning",
  },
];

const latestAction: LogsWorkspaceActionSummary = {
  id: "delete",
  title: "Latest delete action",
  statusLabel: "Partial success",
  description: "Deleted 1 file(s), freed 512 B, protected 1, skipped 1.",
  detail: null,
  tone: "warning",
  timestamp: 123,
};

describe("LogStatsStrip", () => {
  it("renders 4 metrics", () => {
    render(
      <LogStatsStrip
        metrics={metrics}
        attention={[]}
        latestAction={null}
        loading={false}
      />,
    );

    expect(screen.getByText("Runtime")).toBeInTheDocument();
    expect(screen.getByText("Desktop Release")).toBeInTheDocument();
    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByText("Context")).toBeInTheDocument();
    expect(screen.getByText("Session")).toBeInTheDocument();
  });

  it("renders skeleton placeholders when loading", () => {
    render(
      <LogStatsStrip
        metrics={metrics}
        attention={[]}
        latestAction={null}
        loading={true}
      />,
    );

    expect(screen.queryByText("Runtime")).not.toBeInTheDocument();
  });

  it("shows collapsible details when attention items present", async () => {
    const user = userEvent.setup();
    render(
      <LogStatsStrip
        metrics={metrics}
        attention={attention}
        latestAction={null}
        loading={false}
      />,
    );

    expect(screen.getByText("Show details")).toBeInTheDocument();
    // Collapsible content is hidden initially
    expect(screen.queryByText("Backend bridge needs attention")).not.toBeInTheDocument();

    await user.click(screen.getByText("Show details"));

    expect(screen.getByText("Backend bridge needs attention")).toBeInTheDocument();
    expect(screen.getByText("Hide details")).toBeInTheDocument();
  });

  it("shows latest action summary in collapsible", async () => {
    const user = userEvent.setup();
    render(
      <LogStatsStrip
        metrics={metrics}
        attention={[]}
        latestAction={latestAction}
        loading={false}
      />,
    );

    await user.click(screen.getByText("Show details"));

    expect(screen.getByText("Latest workspace action")).toBeInTheDocument();
    expect(screen.getByText("Partial success")).toBeInTheDocument();
    expect(screen.getByText("Latest delete action")).toBeInTheDocument();
  });

  it("hides details toggle when no attention or action", () => {
    render(
      <LogStatsStrip
        metrics={metrics}
        attention={[]}
        latestAction={null}
        loading={false}
      />,
    );

    expect(screen.queryByText("Show details")).not.toBeInTheDocument();
  });
});
