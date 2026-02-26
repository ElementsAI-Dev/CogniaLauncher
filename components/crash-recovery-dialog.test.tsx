import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrashRecoveryDialog } from "./crash-recovery-dialog";

// Mock platform
jest.mock("@/lib/platform", () => ({
  isTauri: jest.fn(() => true),
}));

// Mock tauri
const mockCheckLastCrash = jest.fn();
const mockDismissCrash = jest.fn();

jest.mock("@/lib/tauri", () => ({
  diagnosticCheckLastCrash: (...args: unknown[]) => mockCheckLastCrash(...args),
  diagnosticDismissCrash: (...args: unknown[]) => mockDismissCrash(...args),
}));

// Mock @tauri-apps/plugin-opener
jest.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: jest.fn(),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "diagnostic.crashDetected": "Application Crash Detected",
    "diagnostic.crashDescription": "CogniaLauncher crashed during the last session.",
    "diagnostic.crashReportSaved": "Report saved to",
    "diagnostic.dismiss": "Dismiss",
    "diagnostic.openFolder": "Open Folder",
  };
  return translations[key] || key;
};

describe("CrashRecoveryDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not render when no crash is detected", async () => {
    mockCheckLastCrash.mockResolvedValue(null);

    render(<CrashRecoveryDialog t={mockT} />);

    // Advance timer to trigger the check
    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(mockCheckLastCrash).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("Application Crash Detected")).not.toBeInTheDocument();
  });

  it("shows dialog when crash is detected", async () => {
    mockCheckLastCrash.mockResolvedValue({
      reportPath: "C:\\Users\\test\\.CogniaLauncher\\crash-reports\\crash-2026.zip",
      timestamp: "2026-02-25T19:00:00",
      message: "test panic message",
    });

    render(<CrashRecoveryDialog t={mockT} />);

    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText("Application Crash Detected")).toBeInTheDocument();
    });

    expect(screen.getByText("test panic message")).toBeInTheDocument();
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
    expect(screen.getByText("Open Folder")).toBeInTheDocument();
  });

  it("dismisses crash on Dismiss click", async () => {
    mockCheckLastCrash.mockResolvedValue({
      reportPath: "/tmp/crash.zip",
      timestamp: "2026-02-25",
      message: null,
    });
    mockDismissCrash.mockResolvedValue(undefined);

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CrashRecoveryDialog t={mockT} />);

    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText("Application Crash Detected")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(mockDismissCrash).toHaveBeenCalledTimes(1);
    });
  });

  it("does not render when not in Tauri environment", async () => {
    const platform = jest.requireMock<{ isTauri: jest.Mock }>("@/lib/platform");
    platform.isTauri.mockReturnValue(false);

    render(<CrashRecoveryDialog t={mockT} />);

    jest.advanceTimersByTime(2000);

    // Should not call backend at all
    expect(mockCheckLastCrash).not.toHaveBeenCalled();
    expect(screen.queryByText("Application Crash Detected")).not.toBeInTheDocument();

    // Restore
    platform.isTauri.mockReturnValue(true);
  });
});
