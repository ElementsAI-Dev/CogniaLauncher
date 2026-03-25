import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CacheHistoryCard } from "./cache-history-card";

const mockWriteClipboard = jest.fn();

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: (...args: Parameters<typeof mockWriteClipboard>) =>
    mockWriteClipboard(...args),
}));

jest.mock("@/lib/cache/scopes", () => ({
  formatCleanTypeLabel: (cleanType: string) => `label:${cleanType}`,
}));

const cleanupHistory = [
  {
    id: "cleanup-1",
    timestamp: "2025-01-01T00:00:00Z",
    clean_type: "downloads",
    file_count: 2,
    freed_human: "1.2 GB",
    use_trash: true,
    files_truncated: false,
    files: [
      {
        path: "C:\\cache\\downloads\\react-19.tgz",
        size_human: "1.2 MB",
      },
    ],
  },
];

const defaultDownloadsHistory = [
  {
    id: "cleanup-default-downloads",
    timestamp: "2025-01-02T00:00:00Z",
    clean_type: "default_downloads",
    file_count: 1,
    freed_human: "512 MB",
    use_trash: false,
    files_truncated: false,
    files: [
      {
        path: "C:\\Users\\test\\Downloads\\sdk.zip",
        size_human: "512 MB",
      },
    ],
  },
];

const historySummary = {
  total_cleanups: 4,
  total_freed_human: "5.0 GB",
  trash_cleanups: 3,
  permanent_cleanups: 1,
};

function createProps(
  overrides: Partial<React.ComponentProps<typeof CacheHistoryCard>> = {},
) {
  return {
    cleanupHistory,
    historySummary,
    historyLoading: false,
    historyError: null,
    defaultDownloadsRoot: "C:\\Users\\test\\Downloads",
    defaultDownloadsAvailable: true,
    defaultDownloadsReason: null,
    fetchCleanupHistory: jest.fn(),
    handleRetryHistory: jest.fn(),
    handleClearHistory: jest.fn(),
    ...overrides,
  };
}

describe("CacheHistoryCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads history on mount when there is no existing data", () => {
    const props = createProps({
      cleanupHistory: [],
      historySummary: null,
    });

    render(<CacheHistoryCard {...props} />);

    expect(props.fetchCleanupHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByText("cache.noHistory")).toBeInTheDocument();
    expect(screen.getByText("cache.noHistoryExplain")).toBeInTheDocument();
  });

  it("retries history loading from the error banner", async () => {
    const user = userEvent.setup();
    const props = createProps({ historyError: "History failed" });

    render(<CacheHistoryCard {...props} />);

    await user.click(screen.getByRole("button", { name: "common.retry" }));

    expect(props.handleRetryHistory).toHaveBeenCalledTimes(1);
  });

  it("opens a history detail dialog and copies the selected record", async () => {
    const user = userEvent.setup();

    render(<CacheHistoryCard {...createProps()} />);

    await user.click(screen.getByTestId("cleanup-record-cleanup-1"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("cache.cleanupDetailsTitle"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("C:\\cache\\downloads\\react-19.tgz"),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "cache.copyJson" }));

    expect(mockWriteClipboard).toHaveBeenCalledWith(
      JSON.stringify(cleanupHistory[0], null, 2),
    );
  });

  it("confirms clearing the stored cleanup history", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CacheHistoryCard {...props} />);

    await user.click(screen.getByRole("button", { name: "cache.clearHistory" }));
    await screen.findByText("cache.clearHistoryConfirmTitle");

    const confirmButtons = screen.getAllByRole("button", {
      name: "cache.clearHistory",
    });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(props.handleClearHistory).toHaveBeenCalledTimes(1);
  });

  it("shows default-downloads safety context in the history detail dialog", async () => {
    const user = userEvent.setup();

    render(
      <CacheHistoryCard
        {...createProps({
          cleanupHistory: defaultDownloadsHistory,
        })}
      />,
    );

    await user.click(screen.getByTestId("cleanup-record-cleanup-default-downloads"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/cache\.defaultDownloadsRoot/)).toBeInTheDocument();
    expect(within(dialog).getByText("C:\\Users\\test\\Downloads")).toBeInTheDocument();
    expect(within(dialog).getByText("cache.defaultDownloadsSafetyNote")).toBeInTheDocument();
  });
});
