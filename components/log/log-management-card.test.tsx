import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogManagementCard } from "./log-management-card";

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

describe("LogManagementCard", () => {
  const defaultProps = {
    totalSize: 5120,
    fileCount: 3,
    onCleanup: jest.fn().mockResolvedValue({ deletedCount: 0, freedBytes: 0 }),
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

  it("renders manual cleanup button", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByText("Run Cleanup Now")).toBeInTheDocument();
  });

  it("disables cleanup button when only 1 or 0 files", () => {
    render(<LogManagementCard {...defaultProps} fileCount={1} />);
    const button = screen.getByText("Run Cleanup Now").closest("button");
    expect(button).toBeDisabled();
  });

  it("enables cleanup button when more than 1 file", () => {
    render(<LogManagementCard {...defaultProps} fileCount={3} />);
    const button = screen.getByText("Run Cleanup Now").closest("button");
    expect(button).not.toBeDisabled();
  });

  it("calls onCleanup when cleanup button clicked", async () => {
    const user = userEvent.setup();
    const onCleanup = jest.fn().mockResolvedValue({ deletedCount: 2, freedBytes: 1024 });
    render(<LogManagementCard {...defaultProps} onCleanup={onCleanup} />);

    await user.click(screen.getByText("Run Cleanup Now"));

    await waitFor(() => {
      expect(onCleanup).toHaveBeenCalled();
    });
  });
});
