import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogManagementCard } from "./log-management-card";
import { isTauri, configSet } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "logs.management": "Log Management",
        "logs.managementDescription": "Manage log files and cleanup policy",
        "logs.totalFiles": "Total Files",
        "logs.totalSize": "Total Size",
        "logs.retentionDays": "Retention Days",
        "logs.retentionDaysDescription": "Auto delete logs older than this",
        "logs.maxTotalSize": "Max Total Size (MB)",
        "logs.maxTotalSizeDescription": "Auto delete oldest logs when total exceeds this",
        "logs.autoCleanup": "Auto Cleanup",
        "logs.autoCleanupDescription": "Clean old logs on startup",
        "logs.manualCleanup": "Run Cleanup Now",
        "logs.manualCleanupConfirm": "Confirm Cleanup",
        "logs.previewCleanup": "Preview Cleanup",
        "logs.previewReady": "Will clean {count} files and free {size}",
        "logs.previewSummary": "Cleanup preview",
        "logs.previewProtected": "{count} current-session file(s) protected",
        "logs.cleanupSuccess": "Cleaned up {count} files, freed {size}",
        "logs.cleanupNone": "No log files need cleanup",
        "logs.deleteFailed": "Failed to delete",
      };
      if (params) {
        let result = translations[key] || key;
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, String(v));
        }
        return result;
      }
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => false),
  configGet: jest.fn().mockResolvedValue(null),
  configSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/lib/utils", () => ({
  formatBytes: (size: number) => `${size} B`,
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const mockIsTauri = isTauri as jest.MockedFunction<typeof isTauri>;
const mockConfigSet = configSet as jest.MockedFunction<typeof configSet>;

describe("LogManagementCard", () => {
  const defaultProps = {
    totalSize: 5120,
    fileCount: 3,
    previewResult: null,
    onPreviewCleanup: jest.fn().mockResolvedValue({ ok: true, data: { deletedCount: 1, freedBytes: 512, protectedCount: 1, status: 'success', warnings: [] } }),
    onCleanup: jest.fn().mockResolvedValue({ ok: true, data: { deletedCount: 0, freedBytes: 0, status: 'success', warnings: [] } }),
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  it("renders title and description", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByText("Log Management")).toBeInTheDocument();
    expect(screen.getByText("Manage log files and cleanup policy")).toBeInTheDocument();
  });

  it("displays file count", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("displays total size", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByText("5120 B")).toBeInTheDocument();
  });

  it("renders retention days input", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByLabelText("Retention Days")).toBeInTheDocument();
  });

  it("renders max total size input", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByLabelText("Max Total Size (MB)")).toBeInTheDocument();
  });

  it("renders auto cleanup switch", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByText("Auto Cleanup")).toBeInTheDocument();
  });

  it("renders preview and confirm cleanup buttons", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByText("Preview Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Confirm Cleanup")).toBeInTheDocument();
  });

  it("disables cleanup button when only 1 or 0 files", () => {
    render(<LogManagementCard {...defaultProps} fileCount={1} />);
    const previewButton = screen.getByText("Preview Cleanup").closest("button");
    const confirmButton = screen.getByText("Confirm Cleanup").closest("button");
    expect(previewButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
  });

  it("enables preview button when more than 1 file", () => {
    render(<LogManagementCard {...defaultProps} fileCount={3} />);
    const previewButton = screen.getByText("Preview Cleanup").closest("button");
    expect(previewButton).not.toBeDisabled();
  });

  it("calls onPreviewCleanup when preview button clicked", async () => {
    const user = userEvent.setup();
    const onPreviewCleanup = jest.fn().mockResolvedValue({ ok: true, data: { deletedCount: 2, freedBytes: 1024, protectedCount: 1, status: 'success', warnings: [] } });
    render(<LogManagementCard {...defaultProps} onPreviewCleanup={onPreviewCleanup} />);

    await user.click(screen.getByText("Preview Cleanup"));

    await waitFor(() => {
      expect(onPreviewCleanup).toHaveBeenCalled();
    });
  });

  it("calls onCleanup when confirm button clicked and preview exists", async () => {
    const user = userEvent.setup();
    const onCleanup = jest.fn().mockResolvedValue({ ok: true, data: { deletedCount: 2, freedBytes: 1024, status: 'success', warnings: [] } });
    render(
      <LogManagementCard
        {...defaultProps}
        previewResult={{ deletedCount: 2, freedBytes: 1024, protectedCount: 1, status: 'success', warnings: [] }}
        onCleanup={onCleanup}
      />,
    );

    await user.click(screen.getByText("Confirm Cleanup"));

    await waitFor(() => {
      expect(onCleanup).toHaveBeenCalled();
    });
  });

  it("saves retention days on blur in tauri mode", async () => {
    const user = userEvent.setup();
    mockIsTauri.mockReturnValue(true);
    render(<LogManagementCard {...defaultProps} />);

    const input = screen.getByLabelText("Retention Days");
    await user.clear(input);
    await user.type(input, "45");
    input.blur();

    await waitFor(() => {
      expect(mockConfigSet).toHaveBeenCalledWith("log.max_retention_days", "45");
    });
  });
});
