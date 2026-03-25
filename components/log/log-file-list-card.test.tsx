import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogFileListCard } from "./log-file-list-card";
import type { LogFileInfo } from "@/types/log";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "logs.logFiles": "Log Files",
        "logs.searchFiles": "Search log files...",
        "logs.sortBy": "Sort by",
        "logs.sortNewest": "Date (newest)",
        "logs.sortOldest": "Date (oldest)",
        "logs.sortLargest": "Size (largest)",
        "logs.sortSmallest": "Size (smallest)",
        "logs.sortName": "Name (A-Z)",
        "logs.selectAll": "Select all",
        "logs.deselectAll": "Deselect all",
        "logs.selectedCount": "{count} selected",
        "logs.noSearchResults": "No files match your search",
        "logs.noFiles": "No log files found",
        "logs.desktopOnly": "Desktop Only",
        "logs.desktopOnlyDescription": "Log files are only available in the desktop app.",
        "logs.currentSession": "Current Session",
        "logs.viewFile": "View File",
        "logs.copyFilePath": "Copy File Path",
        "logs.deleteSelected": "Delete Selected",
        "logs.clear": "Clear logs",
        "logs.pageSize": "Per page",
        "logs.pageInfo": "Page {current} of {total}",
        "common.previous": "Previous",
        "common.next": "Next",
        "common.delete": "Delete",
      };
      if (params) {
        let result = map[key] ?? key;
        for (const [paramKey, value] of Object.entries(params)) {
          result = result.replace(`{${paramKey}}`, String(value));
        }
        return result;
      }
      return map[key] ?? key;
    },
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => true,
}));

jest.mock("@/lib/utils", () => ({
  formatBytes: (size: number) => `${size} B`,
  formatDate: (date: number) => String(date),
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

jest.mock("@/lib/log", () => ({
  formatSessionLabel: () => null,
}));

const buildFiles = (count: number): LogFileInfo[] =>
  Array.from({ length: count }, (_, i) => ({
    name: `session-${String(i + 1).padStart(3, "0")}.log`,
    path: `/logs/session-${String(i + 1).padStart(3, "0")}.log`,
    size: 1000 + i * 100,
    modified: 1740000000 - i * 1000,
  }));

const defaultProps = {
  logFiles: buildFiles(5),
  logDir: "/logs",
  loading: false,
  currentSessionFileName: "session-001.log",
  selectedFiles: new Set<string>(),
  onToggleFileSelection: jest.fn(),
  onSelectFiles: jest.fn(),
  onDeselectFiles: jest.fn(),
  onViewFile: jest.fn(),
  onDeleteRequest: jest.fn(),
  onDeleteSelectedRequest: jest.fn(),
  onClearHistory: jest.fn(),
  onCopyPath: jest.fn(),
};

describe("LogFileListCard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders file rows", () => {
    render(<LogFileListCard {...defaultProps} />);
    const rows = screen.getAllByTestId("log-file-row");
    expect(rows).toHaveLength(5);
  });

  it("shows loading skeletons when no files present", () => {
    render(<LogFileListCard {...defaultProps} logFiles={[]} loading={true} />);
    expect(screen.queryAllByTestId("log-file-row")).toHaveLength(0);
  });

  it("shows file rows even during refresh when files exist", () => {
    render(<LogFileListCard {...defaultProps} loading={true} />);
    expect(screen.getAllByTestId("log-file-row")).toHaveLength(5);
  });

  it("shows empty state when no files", () => {
    render(<LogFileListCard {...defaultProps} logFiles={[]} />);
    expect(screen.getByText("No log files found")).toBeInTheDocument();
  });

  it("filters files by search input", async () => {
    const user = userEvent.setup();
    render(<LogFileListCard {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText("Search log files...");
    await user.type(searchInput, "003");

    await waitFor(() => {
      expect(screen.getAllByTestId("log-file-row")).toHaveLength(1);
      expect(screen.getByText("session-003.log")).toBeInTheDocument();
    });
  });

  it("paginates when file count exceeds page size", () => {
    render(<LogFileListCard {...defaultProps} logFiles={buildFiles(25)} />);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getAllByTestId("log-file-row")).toHaveLength(20);
  });

  it("navigates between pages", async () => {
    const user = userEvent.setup();
    render(<LogFileListCard {...defaultProps} logFiles={buildFiles(25)} />);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getAllByTestId("log-file-row")).toHaveLength(5);
  });

  it("marks current session file with badge", () => {
    render(<LogFileListCard {...defaultProps} />);
    expect(screen.getByText("Current Session")).toBeInTheDocument();
  });

  it("calls onViewFile when file row is clicked", async () => {
    const user = userEvent.setup();
    render(<LogFileListCard {...defaultProps} />);

    const rows = screen.getAllByTestId("log-file-row");
    await user.click(rows[1]);
    expect(defaultProps.onViewFile).toHaveBeenCalledWith("session-002.log");
  });

  it("shows select-all checkbox for selectable files", () => {
    render(<LogFileListCard {...defaultProps} />);
    expect(screen.getByLabelText("Select all")).toBeInTheDocument();
  });

  it("calls onSelectFiles when select-all is clicked", async () => {
    const user = userEvent.setup();
    render(<LogFileListCard {...defaultProps} />);

    await user.click(screen.getByLabelText("Select all"));
    expect(defaultProps.onSelectFiles).toHaveBeenCalledWith([
      "session-002.log",
      "session-003.log",
      "session-004.log",
      "session-005.log",
    ]);
  });

  it("shows no search results message", async () => {
    const user = userEvent.setup();
    render(<LogFileListCard {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Search log files..."), "nonexistent");

    await waitFor(() => {
      expect(screen.getByText("No files match your search")).toBeInTheDocument();
    });
  });
});
