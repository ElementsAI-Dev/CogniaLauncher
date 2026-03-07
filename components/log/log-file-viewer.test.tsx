import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogFileViewer } from "./log-file-viewer";
import { useLogStore } from "@/lib/stores/log";
import { toast } from "sonner";

const mockQueryLogFile = jest.fn();
const mockExportLogFile = jest.fn();

jest.mock("@/hooks/use-logs", () => ({
  useLogs: () => ({
    queryLogFile: mockQueryLogFile,
    exportLogFile: mockExportLogFile,
  }),
}));

const mockT = jest.fn((key: string, params?: Record<string, unknown>) => {
  const map: Record<string, string> = {
    "logs.fileViewerTitle": "Log File Viewer",
    "logs.noFileEntries": "No entries found",
    "logs.loadMore": "Load More",
    "logs.loadEntriesError": "Failed to load entries",
    "logs.exportSuccess": "Export successful",
    "logs.exportError": "Export failed",
    "logs.searchPlaceholder": "Search logs...",
    "logs.filter": "Filter",
    "logs.logLevels": "Log Levels",
    "logs.pause": "Pause",
    "logs.resume": "Resume",
    "logs.autoScrollOn": "Auto-scroll enabled",
    "logs.autoScrollOff": "Auto-scroll disabled",
    "logs.export": "Export logs",
    "logs.exportTxt": "Export TXT",
    "logs.exportJson": "Export JSON",
    "logs.exportCsv": "Export CSV",
    "logs.clear": "Clear logs",
    "logs.total": "Total",
    "logs.paused": "Paused",
    "logs.entries": "entries",
    "logs.expand": "Expand",
    "logs.collapse": "Collapse",
    "logs.copyEntry": "Copy log entry",
    "logs.regex": "Regex",
    "logs.maxLogs": "Max logs",
    "logs.maxScanLines": "Max scan lines",
    "logs.scanAll": "All",
    "logs.timeRange": "Time range",
    "logs.timeRangeAll": "All time",
    "logs.timeRangeLastHour": "Last hour",
    "logs.timeRangeLast24Hours": "Last 24 hours",
    "logs.timeRangeLast7Days": "Last 7 days",
    "logs.timeRangeCustom": "Custom range",
    "logs.timeRangeStart": "Start time",
    "logs.timeRangeEnd": "End time",
    "logs.clearSearch": "Clear search",
    "logs.advanced": "Advanced",
    "common.refresh": "Refresh",
    "logs.follow": "Follow",
  };
  if (key === "logs.fileEntries") return `${params?.count ?? 0} entries`;
  return map[key] || key;
});

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: mockT }),
}));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

const resetStore = () =>
  useLogStore.setState({
    logs: [],
    maxLogs: 1000,
    filter: {
      levels: ["info", "warn", "error"],
      search: "",
      useRegex: false,
      target: undefined,
      maxScanLines: null,
      startTime: null,
      endTime: null,
    },
    autoScroll: true,
    paused: false,
    drawerOpen: false,
    logFiles: [
      { name: "app.log", path: "app.log", size: 1000, modified: 100 },
      { name: "history.log", path: "history.log", size: 500, modified: 90 },
    ],
    selectedLogFile: null,
    filterPresets: [],
    bookmarkedIds: [],
    showBookmarksOnly: false,
  });

const sampleEntries = [
  { timestamp: "2026-02-02T12:00:00Z", level: "INFO", target: "app", message: "First log entry", lineNumber: 1 },
  { timestamp: "2026-02-02T12:01:00Z", level: "WARN", target: "net", message: "Second log entry", lineNumber: 2 },
  { timestamp: "2026-02-02T12:02:00Z", level: "ERROR", target: "", message: "Third log entry", lineNumber: 3 },
];

const getViewerViewport = () => {
  const scrollArea = screen.getByTestId("log-file-viewer-scroll-area");
  const viewport = scrollArea.querySelector("[data-slot='scroll-area-viewport']") as HTMLDivElement | null;

  if (!viewport) {
    throw new Error("Expected log file viewer viewport to be present");
  }

  return viewport;
};

const setViewportMetrics = (
  viewport: HTMLDivElement,
  { clientHeight = 180, scrollTop = 0 }: { clientHeight?: number; scrollTop?: number } = {},
) => {
  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(viewport, "scrollTop", {
    configurable: true,
    writable: true,
    value: scrollTop,
  });
  fireEvent.scroll(viewport, { target: { scrollTop } });
};

describe("LogFileViewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it("does not query when open is false", () => {
    render(<LogFileViewer open={false} fileName="app.log" onOpenChange={() => undefined} />);
    expect(mockQueryLogFile).not.toHaveBeenCalled();
  });

  it("queries file when opened with structured result", async () => {
    mockQueryLogFile.mockResolvedValue({
      ok: true,
      data: { entries: sampleEntries, totalCount: 3, hasMore: false },
    });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => {
      expect(mockQueryLogFile).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "app.log", limit: 200, offset: 0 }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("3 entries")).toBeInTheDocument();
      expect(
        document.querySelectorAll("[data-testid='log-file-viewer-virtual-row']").length,
      ).toBeGreaterThan(0);
    });
  });

  it("shows empty state when no entries returned", async () => {
    mockQueryLogFile.mockResolvedValue({
      ok: true,
      data: { entries: [], totalCount: 0, hasMore: false },
    });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => expect(screen.getByText("No entries found")).toBeInTheDocument());
  });

  it("shows explicit error feedback for query failure result", async () => {
    mockQueryLogFile.mockResolvedValue({ ok: false, error: "query failed" });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("query failed");
    });
  });

  it("loads more entries on demand", async () => {
    const user = userEvent.setup();
    mockQueryLogFile
      .mockResolvedValueOnce({
        ok: true,
        data: { entries: sampleEntries, totalCount: 50, hasMore: true },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          entries: [{ timestamp: "2026-02-02T13:00:00Z", level: "INFO", target: "", message: "Extra", lineNumber: 4 }],
          totalCount: 50,
          hasMore: false,
        },
      });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => expect(screen.getByText("Load More")).toBeInTheDocument());
    await user.click(screen.getByText("Load More"));

    await waitFor(() => expect(mockQueryLogFile).toHaveBeenCalledTimes(2));
  });

  it("preserves the reader viewport when older entries are prepended", async () => {
    const user = userEvent.setup();
    mockQueryLogFile
      .mockResolvedValueOnce({
        ok: true,
        data: { entries: sampleEntries, totalCount: 4, hasMore: true },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          entries: [
            {
              timestamp: "2026-02-02T11:59:00Z",
              level: "INFO",
              target: "app",
              message: "Older prepended entry",
              lineNumber: 0,
            },
          ],
          totalCount: 4,
          hasMore: false,
        },
      });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => expect(screen.getByText("First log entry")).toBeInTheDocument());

    setViewportMetrics(getViewerViewport(), { clientHeight: 120, scrollTop: 84 });

    await user.click(screen.getByRole("button", { name: "Load More" }));

    await waitFor(() => expect(mockQueryLogFile).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getViewerViewport().scrollTop).toBeGreaterThan(84));
  });

  it("keeps the current-session viewer anchored to the latest tail only when follow is enabled", async () => {
    jest.useFakeTimers();
    mockQueryLogFile
      .mockResolvedValueOnce({
        ok: true,
        data: { entries: sampleEntries, totalCount: 3, hasMore: false },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          entries: [
            ...sampleEntries,
            {
              timestamp: "2026-02-02T12:03:00Z",
              level: "INFO",
              target: "app",
              message: "Newest followed entry",
              lineNumber: 4,
            },
          ],
          totalCount: 4,
          hasMore: false,
        },
      });

    try {
      render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

      await waitFor(() => expect(screen.getByText("First log entry")).toBeInTheDocument());

      setViewportMetrics(getViewerViewport(), { clientHeight: 112, scrollTop: 0 });

      fireEvent.click(screen.getByRole("button", { name: "Follow" }));

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => expect(mockQueryLogFile).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(getViewerViewport().scrollTop).toBeGreaterThan(0));
    } finally {
      jest.useRealTimers();
    }
  });

  it("exports CSV without downgrading format", async () => {
    const user = userEvent.setup();
    mockQueryLogFile.mockResolvedValue({
      ok: true,
      data: { entries: sampleEntries, totalCount: 3, hasMore: false },
    });
    mockExportLogFile.mockResolvedValue({
      ok: true,
      data: { content: "timestamp,level,target,message\n1,INFO,app,msg", fileName: "app.csv" },
    });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => expect(screen.getByText("First log entry")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /export logs/i }));
    await user.click(screen.getByText("Export CSV"));

    await waitFor(() => {
      expect(mockExportLogFile).toHaveBeenCalledWith(
        expect.objectContaining({ format: "csv" }),
      );
      expect(toast.success).toHaveBeenCalledWith("Export successful");
    });
  });

  it("shows explicit error feedback for export failure", async () => {
    const user = userEvent.setup();
    mockQueryLogFile.mockResolvedValue({
      ok: true,
      data: { entries: sampleEntries, totalCount: 3, hasMore: false },
    });
    mockExportLogFile.mockResolvedValue({ ok: false, error: "export failed" });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => expect(screen.getByText("First log entry")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /export logs/i }));
    await user.click(screen.getByText("Export JSON"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("export failed");
    });
  });

  it("keeps historical filter isolated from realtime store filter", async () => {
    const user = userEvent.setup();
    useLogStore.setState({
      ...useLogStore.getState(),
      filter: {
        ...useLogStore.getState().filter,
        search: "realtime-only",
      },
    });

    mockQueryLogFile.mockResolvedValue({
      ok: true,
      data: { entries: sampleEntries, totalCount: 3, hasMore: false },
    });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => expect(mockQueryLogFile).toHaveBeenCalled());

    const searchInput = screen.getByPlaceholderText("Search logs...");
    await user.clear(searchInput);
    await user.type(searchInput, "history-only");

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(mockQueryLogFile).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "history-only" }),
      );
    });
    expect(useLogStore.getState().filter.search).toBe("realtime-only");
  });

  it("hides bookmarks toggle in historical viewer toolbar", async () => {
    mockQueryLogFile.mockResolvedValue({
      ok: true,
      data: { entries: sampleEntries, totalCount: 3, hasMore: false },
    });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => expect(screen.getByText("First log entry")).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole("button", { name: /advanced/i }));

    expect(screen.queryByLabelText(/bookmarks only/i)).not.toBeInTheDocument();
  });

  it("renders bounded dialog regions with live status before the primary log content region", async () => {
    mockQueryLogFile.mockResolvedValue({
      ok: true,
      data: { entries: sampleEntries, totalCount: 3, hasMore: false },
    });

    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);

    await waitFor(() => expect(screen.getByText("3 entries")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    const statusRegion = screen.getByRole("status");
    const contentRegion = screen.getByRole("region", { name: "Log File Viewer: app.log" });
    const searchInput = screen.getByPlaceholderText("Search logs...");

    expect(dialog).toHaveClass("max-w-5xl");
    expect(dialog).toHaveClass("max-h-[85dvh]");
    expect(dialog).toHaveClass("overflow-hidden");
    expect(statusRegion).toHaveAttribute("aria-live", "polite");
    expect(statusRegion).toHaveTextContent("3 entries");
    expect(contentRegion).toContainElement(screen.getByTestId("log-file-viewer-scroll-area"));
    expect(
      searchInput.compareDocumentPosition(contentRegion) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("calls onOpenChange when dialog is closed", async () => {
    const onOpenChange = jest.fn();
    mockQueryLogFile.mockResolvedValue({
      ok: true,
      data: { entries: [], totalCount: 0, hasMore: false },
    });

    render(<LogFileViewer open fileName="app.log" onOpenChange={onOpenChange} />);

    await waitFor(() => expect(screen.getByText("Log File Viewer")).toBeInTheDocument());
    const closeBtn = screen.getByRole("button", { name: /close/i });
    await userEvent.setup().click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
