import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogManagementCard } from "./log-management-card";
import { configSet, isTauri } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "common.cancel": "Cancel",
        "logs.management": "Log Management",
        "logs.managementDescription": "Manage log files and cleanup policy",
        "logs.totalFiles": "Total Files",
        "logs.totalSize": "Total Size",
        "logs.retentionDays": "Retention Days",
        "logs.retentionDaysDescription": "Auto delete logs older than this",
        "logs.maxTotalSize": "Max Total Size (MB)",
        "logs.maxTotalSizeDescription":
          "Auto delete oldest logs when total exceeds this",
        "logs.autoCleanup": "Auto Cleanup",
        "logs.autoCleanupDescription": "Clean old logs on startup",
        "logs.previewCleanup": "Preview Cleanup",
        "logs.manualCleanupConfirm": "Confirm Cleanup",
        "logs.cleanupConfirmTitle": "Confirm manual cleanup",
        "logs.cleanupConfirmDescription":
          "This will delete up to {count} file(s) and free about {size}.",
        "logs.cleanupConfirmAction": "Run Cleanup",
        "logs.previewReady": "Will clean {count} files and free {size}",
        "logs.previewSummary": "Cleanup preview",
        "logs.previewProtected": "{count} current-session file(s) protected",
        "logs.previewStale":
          "Cleanup preview is stale. Refresh preview before confirming cleanup.",
        "logs.cleanupSuccess": "Cleaned up {count} files, freed {size}",
        "logs.cleanupNone": "No log files need cleanup",
        "logs.deleteFailed": "Failed to delete",
        "logs.partialWarning": "{count} warning(s) occurred",
        "logs.logLevel": "Log Level",
        "logs.logLevelDescription":
          "Backend log verbosity. Changes take effect after restarting the app.",
        "logs.policySaveStateLabel": "Policy save state",
        "logs.policyStateDirty": "Unsaved changes",
        "logs.policyStateSaving": "Saving...",
        "logs.policyStateSaved": "Saved",
        "logs.policyStateError": "Save failed",
        "logs.policySaveFailed": "Failed to save cleanup policy",
        "logs.retrySavePolicy": "Retry Save",
      };
      if (!params) {
        return translations[key] || key;
      }
      let result = translations[key] || key;
      for (const [paramKey, value] of Object.entries(params)) {
        result = result.replace(`{${paramKey}}`, String(value));
      }
      return result;
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
  const previewResult = {
    deletedCount: 2,
    freedBytes: 1024,
    protectedCount: 1,
    skippedCount: 1,
    status: "success" as const,
    reasonCode: null,
    warnings: [],
    policyFingerprint: "v1:30:100",
    maxRetentionDays: 30,
    maxTotalSizeMb: 100,
  };

  const cleanupResult = {
    deletedCount: 2,
    freedBytes: 1024,
    protectedCount: 1,
    skippedCount: 1,
    status: "success" as const,
    reasonCode: null,
    warnings: [],
    policyFingerprint: "v1:30:100",
    maxRetentionDays: 30,
    maxTotalSizeMb: 100,
  };

  const defaultProps = {
    totalSize: 5120,
    fileCount: 3,
    previewResult: null,
    onPreviewCleanup: jest.fn().mockResolvedValue({
      ok: true,
      data: previewResult,
    }),
    onCleanup: jest.fn().mockResolvedValue({
      ok: true,
      data: cleanupResult,
    }),
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  it("renders management title and actions", () => {
    render(<LogManagementCard {...defaultProps} />);
    expect(screen.getByText("Log Management")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview Cleanup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Cleanup" })).toBeDisabled();
  });

  it("saves retention days and reports saved state", async () => {
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
    expect(screen.getByTestId("log-policy-save-state")).toHaveTextContent("Saved");
  });

  it("shows save error state and supports retry", async () => {
    const user = userEvent.setup();
    mockIsTauri.mockReturnValue(true);
    mockConfigSet.mockRejectedValueOnce(new Error("write failed"));
    render(<LogManagementCard {...defaultProps} />);

    const input = screen.getByLabelText("Retention Days");
    await user.clear(input);
    await user.type(input, "60");
    input.blur();

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
      expect(screen.getByText("write failed")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Retry Save" }));

    await waitFor(() => {
      expect(mockConfigSet).toHaveBeenLastCalledWith("log.max_retention_days", "60");
    });
  });

  it("marks preview as stale when policy changes and blocks cleanup", async () => {
    const user = userEvent.setup();
    render(<LogManagementCard {...defaultProps} previewResult={previewResult} />);

    const input = screen.getByLabelText("Retention Days");
    await user.clear(input);
    await user.type(input, "31");

    expect(screen.getByTestId("log-preview-stale-hint")).toHaveTextContent(
      "Cleanup preview is stale",
    );
    expect(screen.getByRole("button", { name: "Confirm Cleanup" })).toBeDisabled();
  });

  it("passes explicit policy to preview request", async () => {
    const user = userEvent.setup();
    const onPreviewCleanup = jest.fn().mockResolvedValue({
      ok: true,
      data: previewResult,
    });
    render(
      <LogManagementCard
        {...defaultProps}
        onPreviewCleanup={onPreviewCleanup}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Preview Cleanup" }));

    await waitFor(() => {
      expect(onPreviewCleanup).toHaveBeenCalledWith({
        maxRetentionDays: 30,
        maxTotalSizeMb: 100,
      });
    });
  });

  it("requires confirmation and passes policy fingerprint to cleanup", async () => {
    const user = userEvent.setup();
    const onCleanup = jest.fn().mockResolvedValue({
      ok: true,
      data: cleanupResult,
    });
    render(
      <LogManagementCard
        {...defaultProps}
        previewResult={previewResult}
        onCleanup={onCleanup}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Confirm Cleanup" }));
    expect(onCleanup).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm manual cleanup")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Run Cleanup" }));

    await waitFor(() => {
      expect(onCleanup).toHaveBeenCalledWith({
        policy: {
          maxRetentionDays: 30,
          maxTotalSizeMb: 100,
        },
        expectedPolicyFingerprint: "v1:30:100",
      });
    });
  });
});
