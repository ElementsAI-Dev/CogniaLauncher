import { render, screen, waitFor } from "@testing-library/react";
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

// Use a stable reference for t to avoid infinite useEffect re-fires
// (LogFileViewer's loadEntries useCallback depends on t)
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
    "logs.clear": "Clear logs",
    "logs.total": "Total",
    "logs.paused": "Paused",
    "logs.entries": "entries",
    "logs.expand": "Expand",
    "logs.collapse": "Collapse",
    "logs.copyEntry": "Copy log entry",
    "logs.regex": "Regex",
    "logs.maxLogs": "Max logs",
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
  };
  if (key === "logs.fileEntries") return `${params?.count ?? 0} entries`;
  return map[key] || key;
});

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: mockT }),
}));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

global.URL.createObjectURL = jest.fn(() => "blob:mock");
global.URL.revokeObjectURL = jest.fn();

const resetStore = () =>
  useLogStore.setState({
    logs: [],
    maxLogs: 1000,
    filter: { levels: ["info", "warn", "error"], search: "", useRegex: false, startTime: null, endTime: null },
    autoScroll: true,
    paused: false,
    drawerOpen: false,
    logFiles: [],
    selectedLogFile: null,
  });

const sampleEntries = [
  { timestamp: "2026-02-02T12:00:00Z", level: "INFO", target: "app", message: "First log entry", lineNumber: 1 },
  { timestamp: "2026-02-02T12:01:00Z", level: "WARN", target: "net", message: "Second log entry", lineNumber: 2 },
  { timestamp: "2026-02-02T12:02:00Z", level: "ERROR", target: "", message: "Third log entry", lineNumber: 3 },
];

describe("LogFileViewer", () => {
  beforeEach(() => {
    mockQueryLogFile.mockReset();
    mockExportLogFile.mockReset();
    (toast.error as jest.Mock).mockReset();
    (toast.success as jest.Mock).mockReset();
    resetStore();
  });

  it("does not query when open is false", () => {
    render(<LogFileViewer open={false} fileName="app.log" onOpenChange={() => undefined} />);
    expect(mockQueryLogFile).not.toHaveBeenCalled();
  });

  it("does not query when fileName is null", () => {
    render(<LogFileViewer open fileName={null} onOpenChange={() => undefined} />);
    expect(mockQueryLogFile).not.toHaveBeenCalled();
  });

  it("calls queryLogFile when opened with valid fileName", async () => {
    mockQueryLogFile.mockResolvedValue({ entries: sampleEntries, totalCount: 3, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => {
      expect(mockQueryLogFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: "app.log", limit: 200, offset: 0 }));
    });
  });

  it("renders entries after successful query", async () => {
    mockQueryLogFile.mockResolvedValue({ entries: sampleEntries, totalCount: 3, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("First log entry")).toBeInTheDocument());
    expect(screen.getByText("Second log entry")).toBeInTheDocument();
    expect(screen.getByText("Third log entry")).toBeInTheDocument();
  });

  it("shows empty state when query returns no entries", async () => {
    mockQueryLogFile.mockResolvedValue({ entries: [], totalCount: 0, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("No entries found")).toBeInTheDocument());
  });

  it("shows empty state when query returns null", async () => {
    mockQueryLogFile.mockResolvedValue(null);
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("No entries found")).toBeInTheDocument());
  });

  it("shows loading skeleton while loading", async () => {
    // The query never resolves, so loading remains true after the effect fires
    mockQueryLogFile.mockReturnValue(new Promise(() => {}));
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    // Dialog renders in a portal, so query the whole document
    await waitFor(() => {
      const skeletons = document.querySelectorAll("[data-slot='skeleton']");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it("shows Load More button when hasMore is true", async () => {
    mockQueryLogFile.mockResolvedValue({ entries: sampleEntries, totalCount: 50, hasMore: true });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Load More")).toBeInTheDocument());
  });

  it("does not show Load More when hasMore is false", async () => {
    mockQueryLogFile.mockResolvedValue({ entries: sampleEntries, totalCount: 3, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("First log entry")).toBeInTheDocument());
    expect(screen.queryByText("Load More")).not.toBeInTheDocument();
  });

  it("loads more entries on Load More click", async () => {
    const user = userEvent.setup();
    mockQueryLogFile
      .mockResolvedValueOnce({ entries: sampleEntries, totalCount: 50, hasMore: true })
      .mockResolvedValueOnce({ entries: [{ timestamp: "2026-02-02T13:00:00Z", level: "INFO", target: "", message: "Extra", lineNumber: 4 }], totalCount: 50, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Load More")).toBeInTheDocument());
    await user.click(screen.getByText("Load More"));
    await waitFor(() => expect(mockQueryLogFile).toHaveBeenCalledTimes(2));
  });

  it("refreshes on Refresh button click", async () => {
    const user = userEvent.setup();
    mockQueryLogFile.mockResolvedValue({ entries: sampleEntries, totalCount: 3, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("First log entry")).toBeInTheDocument());
    await user.click(screen.getByText("Refresh"));
    await waitFor(() => expect(mockQueryLogFile).toHaveBeenCalledTimes(2));
  });

  it("shows toast error when query fails", async () => {
    mockQueryLogFile.mockRejectedValue(new Error("fail"));
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to load entries"));
  });

  it("displays dialog title and fileName", async () => {
    mockQueryLogFile.mockResolvedValue({ entries: [], totalCount: 0, hasMore: false });
    render(<LogFileViewer open fileName="my-app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Log File Viewer")).toBeInTheDocument());
    expect(screen.getByText("my-app.log")).toBeInTheDocument();
  });

  it("displays total entry count", async () => {
    mockQueryLogFile.mockResolvedValue({ entries: sampleEntries, totalCount: 42, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("42 entries")).toBeInTheDocument());
  });

  it("normalizes unknown log levels to info", async () => {
    mockQueryLogFile.mockResolvedValue({
      entries: [{ timestamp: "2026-02-02T12:00:00Z", level: "UNKNOWN", target: "", message: "Unknown level", lineNumber: 1 }],
      totalCount: 1,
      hasMore: false,
    });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Unknown level")).toBeInTheDocument());
    expect(screen.getByText("INF")).toBeInTheDocument();
  });

  it("passes filter levels as uppercase to queryLogFile", async () => {
    useLogStore.setState({ ...useLogStore.getState(), filter: { ...useLogStore.getState().filter, levels: ["error", "warn"] } });
    mockQueryLogFile.mockResolvedValue({ entries: [], totalCount: 0, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={() => undefined} />);
    await waitFor(() => {
      expect(mockQueryLogFile).toHaveBeenCalledWith(expect.objectContaining({ levelFilter: ["ERROR", "WARN"] }));
    });
  });

  it("calls onOpenChange when dialog is closed", async () => {
    const onOpenChange = jest.fn();
    mockQueryLogFile.mockResolvedValue({ entries: [], totalCount: 0, hasMore: false });
    render(<LogFileViewer open fileName="app.log" onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Log File Viewer")).toBeInTheDocument());
    // The close button triggers onOpenChange
    const closeBtn = screen.getByRole("button", { name: /close/i });
    await userEvent.setup().click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
