import { render, screen, waitFor } from "@testing-library/react";
import { LogProvider } from "./log-provider";
import { isTauri } from "@/lib/tauri";
import { captureFrontendCrash } from "@/lib/crash-reporter";
import { toast } from "sonner";

const createUnlistenPromise = () => Promise.resolve(jest.fn());

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(),
  listenEnvInstallProgress: jest.fn(() => createUnlistenPromise()),
  listenBatchProgress: jest.fn(() => createUnlistenPromise()),
  listenCommandOutput: jest.fn(() => createUnlistenPromise()),
  listenDownloadTaskAdded: jest.fn(() => createUnlistenPromise()),
  listenDownloadTaskStarted: jest.fn(() => createUnlistenPromise()),
  listenDownloadTaskCompleted: jest.fn(() => createUnlistenPromise()),
  listenDownloadTaskFailed: jest.fn(() => createUnlistenPromise()),
  listenDownloadTaskPaused: jest.fn(() => createUnlistenPromise()),
  listenDownloadTaskResumed: jest.fn(() => createUnlistenPromise()),
  listenDownloadTaskCancelled: jest.fn(() => createUnlistenPromise()),
  listenSelfUpdateProgress: jest.fn(() => createUnlistenPromise()),
  listenUpdateCheckProgress: jest.fn(() => createUnlistenPromise()),
}));

jest.mock("@/lib/crash-reporter", () => ({
  captureFrontendCrash: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    warning: jest.fn(),
  },
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

const mockAddLog = jest.fn();

jest.mock("@/lib/stores/log", () => ({
  useLogStore: () => ({
    addLog: mockAddLog,
  }),
}));

const mockIsTauri = isTauri as jest.MockedFunction<typeof isTauri>;
const mockCaptureFrontendCrash =
  captureFrontendCrash as jest.MockedFunction<typeof captureFrontendCrash>;
const mockToastWarning = toast.warning as jest.MockedFunction<typeof toast.warning>;

describe("LogProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockCaptureFrontendCrash.mockResolvedValue({
      captured: false,
      reason: "not-tauri",
    });
  });

  it("renders children", () => {
    render(
      <LogProvider>
        <div data-testid="child">Child content</div>
      </LogProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("captures window.error and logs runtime entry in tauri mode", async () => {
    mockIsTauri.mockReturnValue(true);
    mockCaptureFrontendCrash.mockResolvedValue({
      captured: true,
      crashInfo: {
        reportPath: "report.zip",
        timestamp: "2026-02-25T00:00:00Z",
        message: "boom",
      },
    });

    render(
      <LogProvider>
        <div>Test</div>
      </LogProvider>,
    );

    const errorEvent = new Event("error") as ErrorEvent;
    Object.defineProperties(errorEvent, {
      message: { value: "boom", configurable: true },
      filename: { value: "app/page.tsx", configurable: true },
      lineno: { value: 12, configurable: true },
      colno: { value: 4, configurable: true },
      error: { value: new Error("boom"), configurable: true },
    });
    window.dispatchEvent(errorEvent);

    await waitFor(() => {
      expect(mockCaptureFrontendCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "window.error",
          includeConfig: true,
        }),
      );
    });

    expect(mockAddLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        target: "runtime",
      }),
    );
  });

  it("shows lightweight toast only once per session", async () => {
    mockIsTauri.mockReturnValue(true);
    mockCaptureFrontendCrash
      .mockResolvedValueOnce({
        captured: true,
        crashInfo: {
          reportPath: "report.zip",
          timestamp: "2026-02-25T00:00:00Z",
          message: "first",
        },
      })
      .mockResolvedValue({
        captured: false,
        reason: "session-deduped",
      });

    render(
      <LogProvider>
        <div>Test</div>
      </LogProvider>,
    );

    const errorEvent = new Event("error") as ErrorEvent;
    Object.defineProperty(errorEvent, "message", {
      value: "first crash",
      configurable: true,
    });
    Object.defineProperty(errorEvent, "error", {
      value: new Error("first crash"),
      configurable: true,
    });
    window.dispatchEvent(errorEvent);

    const rejectionEvent = new Event(
      "unhandledrejection",
    ) as PromiseRejectionEvent;
    Object.defineProperty(rejectionEvent, "reason", {
      value: new Error("second crash"),
      configurable: true,
    });
    window.dispatchEvent(rejectionEvent);

    await waitFor(() => {
      expect(mockCaptureFrontendCrash).toHaveBeenCalledTimes(2);
    });

    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    expect(mockToastWarning).toHaveBeenCalledWith(
      "diagnostic.autoCaptureToastTitle",
      {
        description: "diagnostic.autoCaptureToastDescription",
      },
    );
  });
});
