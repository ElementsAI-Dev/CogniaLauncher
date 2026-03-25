import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadHistoryPanel } from "./download-history-panel";
import type { HistoryRecord, HistoryStats } from "@/lib/stores/download";

// ScrollArea uses ResizeObserver internally
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const mockT = (key: string) => key;

function makeRecord(overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    id: "rec-1",
    url: "https://example.com/file.zip",
    filename: "file.zip",
    destination: "/downloads/file.zip",
    status: "completed",
    startedAt: "2026-01-01T00:00:00Z",
    completedAt: "2026-01-01T00:01:00Z",
    size: 10240,
    sizeHuman: "10 KB",
    duration: 60,
    durationHuman: "1m 0s",
    speed: 170,
    speedHuman: "170 B/s",
    error: null,
    provider: null,
    ...overrides,
  } as HistoryRecord;
}

const mockStats: HistoryStats = {
  totalCount: 42,
  completedCount: 38,
  failedCount: 4,
  totalBytes: 1073741824,
  totalBytesHuman: "1.0 GB",
  averageSpeed: 5242880,
  averageSpeedHuman: "5.0 MB/s",
  successRate: 90,
} as HistoryStats;

describe("DownloadHistoryPanel", () => {
  const defaultProps = {
    history: [] as HistoryRecord[],
    historyStats: null as HistoryStats | null,
    historyQuery: "",
    onHistoryQueryChange: jest.fn(),
    onClearHistory: jest.fn<(days?: number) => void>(),
    onRemoveRecord: jest.fn(),
    onOpenRecord: jest.fn(),
    onRevealRecord: jest.fn(),
    onReuseRecord: jest.fn(),
    destinationAvailability: {} as Record<string, boolean>,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders card title", () => {
    render(<DownloadHistoryPanel {...defaultProps} />);

    expect(screen.getByText("downloads.historyPanel.title")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<DownloadHistoryPanel {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("downloads.historyPanel.search"),
    ).toBeInTheDocument();
  });

  it("renders clear button", () => {
    render(<DownloadHistoryPanel {...defaultProps} />);

    expect(
      screen.getByText("downloads.historyPanel.clear"),
    ).toBeInTheDocument();
  });

  it("disables clear button when history is empty", () => {
    render(<DownloadHistoryPanel {...defaultProps} history={[]} />);

    const clearBtn = screen.getByText("downloads.historyPanel.clear").closest("button");
    expect(clearBtn).toBeDisabled();
  });

  it("enables clear button when history has records", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord()]}
      />,
    );

    const clearBtn = screen.getByText("downloads.historyPanel.clear").closest("button");
    expect(clearBtn).not.toBeDisabled();
  });

  it("renders empty state when no history", () => {
    render(<DownloadHistoryPanel {...defaultProps} history={[]} />);

    expect(screen.getByText("downloads.noHistory")).toBeInTheDocument();
    expect(screen.getByText("downloads.noHistoryDesc")).toBeInTheDocument();
  });

  it("renders history records in table", () => {
    const records = [
      makeRecord({ id: "rec-1", filename: "alpha.zip" }),
      makeRecord({ id: "rec-2", filename: "beta.tar.gz" }),
    ];
    render(<DownloadHistoryPanel {...defaultProps} history={records} />);

    expect(screen.getByText("alpha.zip")).toBeInTheDocument();
    expect(screen.getByText("beta.tar.gz")).toBeInTheDocument();
  });

  it("renders record status badge", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord({ status: "completed" })]}
      />,
    );

    expect(screen.getByText("downloads.state.completed")).toBeInTheDocument();
  });

  it("renders record duration", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord({ durationHuman: "2m 30s" })]}
      />,
    );

    expect(screen.getByText("2m 30s")).toBeInTheDocument();
  });

  it("renders record speed", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord({ speedHuman: "5.0 MB/s" })]}
      />,
    );

    expect(screen.getByText("5.0 MB/s")).toBeInTheDocument();
  });

  it("renders record size", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord({ sizeHuman: "10 KB" })]}
      />,
    );

    expect(screen.getByText("10 KB")).toBeInTheDocument();
  });

  it("renders record error when present", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord({ error: "Network error" })]}
      />,
    );

    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("does not render error when null", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord({ error: null })]}
      />,
    );

    expect(screen.queryByText("Network error")).not.toBeInTheDocument();
  });

  it("renders stats cards when historyStats provided", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        historyStats={mockStats}
      />,
    );

    expect(screen.getByText("1.0 GB")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB/s")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("does not render stats cards when historyStats is null", () => {
    render(
      <DownloadHistoryPanel {...defaultProps} historyStats={null} />,
    );

    expect(screen.queryByText("1.0 GB")).not.toBeInTheDocument();
  });

  it("calls onClearHistory when clicking clear button", async () => {
    const onClearHistory = jest.fn<(days?: number) => void>();
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord()]}
        onClearHistory={onClearHistory}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "downloads.historyPanel.clear" }));
    const confirmDialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(confirmDialog).getAllByRole("button", { name: "downloads.historyPanel.clear" })[0],
    );

    expect(onClearHistory).toHaveBeenCalledTimes(1);
    expect(onClearHistory).toHaveBeenCalledWith(undefined);
  });

  it("calls onClearHistory with retention days when clearing older history", async () => {
    const onClearHistory = jest.fn<(days?: number) => void>();
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord()]}
        onClearHistory={onClearHistory}
      />,
    );

    await userEvent.type(
      screen.getByPlaceholderText("downloads.historyPanel.retentionDays"),
      "30",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "downloads.historyPanel.clearOlder" }),
    );

    expect(onClearHistory).toHaveBeenCalledWith(30);
  });

  it("calls onRemoveRecord when clicking remove button on a record", async () => {
    const onRemoveRecord = jest.fn();
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord({ id: "rec-42" })]}
        onRemoveRecord={onRemoveRecord}
      />,
    );

    await userEvent.click(
      screen.getByTitle("downloads.actions.remove"),
    );

    expect(onRemoveRecord).toHaveBeenCalledWith("rec-42");
  });

  it("calls onHistoryQueryChange when typing in search", async () => {
    const onHistoryQueryChange = jest.fn();
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        onHistoryQueryChange={onHistoryQueryChange}
      />,
    );

    const input = screen.getByPlaceholderText("downloads.historyPanel.search");
    await userEvent.type(input, "test");

    expect(onHistoryQueryChange).toHaveBeenCalledTimes(4);
  });

  it("renders table headers", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord()]}
      />,
    );

    expect(screen.getByText("downloads.name")).toBeInTheDocument();
    expect(screen.getByText("downloads.status")).toBeInTheDocument();
    expect(screen.getByText("downloads.historyPanel.duration")).toBeInTheDocument();
    expect(screen.getByText("downloads.historyPanel.averageSpeed")).toBeInTheDocument();
    expect(screen.getByText("downloads.progress.total")).toBeInTheDocument();
    expect(screen.getByText("common.actions")).toBeInTheDocument();
  });

  it("renders record URL", () => {
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[makeRecord({ url: "https://cdn.example.com/archive.tar.gz" })]}
      />,
    );

    expect(screen.getByText("https://cdn.example.com/archive.tar.gz")).toBeInTheDocument();
  });

  it("renders open and reveal actions for completed records with available destinations", async () => {
    const onOpenRecord = jest.fn();
    const onRevealRecord = jest.fn();
    const record = makeRecord({ id: "rec-openable", status: "completed" });
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[record]}
        destinationAvailability={{ [record.id]: true }}
        onOpenRecord={onOpenRecord}
        onRevealRecord={onRevealRecord}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "downloads.actions.open" }));
    await userEvent.click(screen.getByRole("button", { name: "downloads.actions.reveal" }));

    expect(onOpenRecord).toHaveBeenCalledWith(record);
    expect(onRevealRecord).toHaveBeenCalledWith(record);
  });

  it("offers reuse instead of file actions when destination is unavailable", async () => {
    const onReuseRecord = jest.fn();
    const record = makeRecord({ id: "rec-reuse", status: "failed" });
    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[record]}
        destinationAvailability={{ [record.id]: false }}
        onReuseRecord={onReuseRecord}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "downloads.actions.open" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "downloads.historyPanel.reuse" }));

    expect(onReuseRecord).toHaveBeenCalledWith(record);
  });

  it("shows install-aware action for completed installer records", () => {
    const record = makeRecord({
      id: "rec-installer",
      artifactProfile: {
        artifactKind: "installer",
        sourceKind: "direct_url",
        platform: "windows",
        arch: "x64",
        installIntent: "open_installer",
        suggestedFollowUps: ["install"],
      },
    });

    render(
      <DownloadHistoryPanel
        {...defaultProps}
        history={[record]}
        destinationAvailability={{ [record.id]: true }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "downloads.actions.install" }),
    ).toBeInTheDocument();
  });
});
