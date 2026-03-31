import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadToolbar, type StatusFilter } from "./download-toolbar";
import type { QueueStats } from "@/lib/stores/download";

const mockStats: QueueStats = {
  totalTasks: 5,
  queued: 1,
  downloading: 2,
  paused: 1,
  completed: 1,
  failed: 0,
  cancelled: 0,
  totalBytes: 10240,
  downloadedBytes: 5120,
  totalHuman: "10 KB",
  downloadedHuman: "5 KB",
  overallProgress: 50,
};

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "downloads.toolbar.searchPlaceholder": "Search downloads...",
    "downloads.toolbar.filterAll": "All",
    "downloads.toolbar.filterActive": "Active",
    "downloads.toolbar.filterQueued": "Queued",
    "downloads.toolbar.filterDone": "Done",
    "downloads.toolbar.filterFailed": "Failed",
    "downloads.actions.pauseAll": "Pause All",
    "downloads.actions.resumeAll": "Resume All",
    "downloads.actions.cancelAll": "Cancel All",
    "downloads.actions.clearFinished": "Clear Finished",
    "downloads.actions.retryFailed": "Retry Failed",
    "downloads.actions.pause": "Pause",
    "downloads.actions.resume": "Resume",
    "downloads.actions.cancel": "Cancel",
    "downloads.actions.remove": "Remove",
    "downloads.settings.speedLimit": "Speed Limit",
    "common.settings": "Settings",
    "common.selected": "selected",
    "common.clear": "Clear",
  };
  return translations[key] || key;
};

describe("DownloadToolbar", () => {
  const defaultProps = {
    searchQuery: "",
    onSearchChange: jest.fn(),
    statusFilter: "all" as StatusFilter,
    onStatusChange: jest.fn(),
    selectedCount: 0,
    onBatchPause: jest.fn(),
    onBatchResume: jest.fn(),
    onBatchCancel: jest.fn(),
    onBatchRemove: jest.fn(),
    onClearSelection: jest.fn(),
    onPauseAll: jest.fn(),
    onResumeAll: jest.fn(),
    onCancelAll: jest.fn(),
    onClearFinished: jest.fn(),
    onRetryFailed: jest.fn(),
    settingsOpen: false,
    onSettingsToggle: jest.fn(),
    activeCount: 3,
    doneCount: 1,
    stats: mockStats,
    isLoading: false,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders search input", () => {
    render(<DownloadToolbar {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("Search downloads..."),
    ).toBeInTheDocument();
  });

  it("renders simplified status filter tabs with counts", () => {
    render(<DownloadToolbar {...defaultProps} />);

    expect(screen.getByRole("tab", { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /active/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /queued/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /done/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /failed/i })).toBeInTheDocument();
    // Total tasks count badge
    expect(screen.getByText("5")).toBeInTheDocument();
    // Active count
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onSearchChange when typing in search input", async () => {
    const onSearchChange = jest.fn();
    render(
      <DownloadToolbar {...defaultProps} onSearchChange={onSearchChange} />,
    );

    const searchInput = screen.getByPlaceholderText("Search downloads...");
    await userEvent.type(searchInput, "test");

    expect(onSearchChange).toHaveBeenCalledTimes(4);
  });

  it("calls onStatusChange when clicking status tabs", async () => {
    const onStatusChange = jest.fn();
    render(
      <DownloadToolbar {...defaultProps} onStatusChange={onStatusChange} />,
    );

    const activeTab = screen.getByRole("tab", { name: /active/i });
    await userEvent.click(activeTab);

    expect(onStatusChange).toHaveBeenCalledWith("active");
  });

  it("disables pause all button when no downloads are active", () => {
    const statsNoDownloading = { ...mockStats, downloading: 0 };
    render(<DownloadToolbar {...defaultProps} stats={statsNoDownloading} />);

    expect(screen.getByRole("button", { name: /pause all/i })).toBeDisabled();
  });

  it("calls onPauseAll when clicking pause all button", async () => {
    const onPauseAll = jest.fn();
    render(<DownloadToolbar {...defaultProps} onPauseAll={onPauseAll} />);

    await userEvent.click(screen.getByRole("button", { name: /pause all/i }));

    expect(onPauseAll).toHaveBeenCalled();
  });

  it("renders settings toggle button", () => {
    render(<DownloadToolbar {...defaultProps} />);

    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("calls onSettingsToggle when settings button is clicked", async () => {
    const onSettingsToggle = jest.fn();
    render(<DownloadToolbar {...defaultProps} onSettingsToggle={onSettingsToggle} />);

    await userEvent.click(screen.getByRole("button", { name: /settings/i }));

    expect(onSettingsToggle).toHaveBeenCalled();
  });

  it("disables primary action buttons when isLoading is true", () => {
    render(<DownloadToolbar {...defaultProps} isLoading={true} />);

    expect(screen.getByRole("button", { name: /pause all/i })).toBeDisabled();
  });

  it("shows batch action bar when items are selected", () => {
    render(<DownloadToolbar {...defaultProps} selectedCount={2} />);

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("calls batch callbacks when batch action buttons are clicked", async () => {
    const onBatchPause = jest.fn();
    const onBatchResume = jest.fn();
    const onBatchCancel = jest.fn();
    const onBatchRemove = jest.fn();
    const onClearSelection = jest.fn();

    render(
      <DownloadToolbar
        {...defaultProps}
        selectedCount={1}
        onBatchPause={onBatchPause}
        onBatchResume={onBatchResume}
        onBatchCancel={onBatchCancel}
        onBatchRemove={onBatchRemove}
        onClearSelection={onClearSelection}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onBatchPause).toHaveBeenCalled();
    expect(onBatchResume).toHaveBeenCalled();
    expect(onBatchCancel).toHaveBeenCalled();
    expect(onBatchRemove).toHaveBeenCalled();
    expect(onClearSelection).toHaveBeenCalled();
  });
});
