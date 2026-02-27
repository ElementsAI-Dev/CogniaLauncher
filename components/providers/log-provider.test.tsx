import { render, screen, waitFor, act } from "@testing-library/react";
import { LogProvider } from "./log-provider";
import {
  isTauri,
  listenEnvInstallProgress,
  listenBatchProgress,
  listenCommandOutput,
  listenDownloadTaskAdded,
  listenDownloadTaskStarted,
  listenDownloadTaskCompleted,
  listenDownloadTaskFailed,
  listenDownloadTaskPaused,
  listenDownloadTaskResumed,
  listenDownloadTaskCancelled,
  listenSelfUpdateProgress,
  listenUpdateCheckProgress,
} from "@/lib/tauri";
import { captureFrontendCrash } from "@/lib/crash-reporter";
import { toast } from "sonner";

jest.mock("@/lib/tauri", () => {
  const ml = () => jest.fn().mockImplementation(() => Promise.resolve(jest.fn()));
  return {
    isTauri: jest.fn(),
    listenEnvInstallProgress: ml(),
    listenBatchProgress: ml(),
    listenCommandOutput: ml(),
    listenDownloadTaskAdded: ml(),
    listenDownloadTaskStarted: ml(),
    listenDownloadTaskCompleted: ml(),
    listenDownloadTaskFailed: ml(),
    listenDownloadTaskPaused: ml(),
    listenDownloadTaskResumed: ml(),
    listenDownloadTaskCancelled: ml(),
    listenSelfUpdateProgress: ml(),
    listenUpdateCheckProgress: ml(),
  };
});

// Lazily-resolved map: listener name → mock function (populated after imports resolve)
let listenerMockMap: Record<string, jest.Mock>;
function ensureListenerMap() {
  if (!listenerMockMap) {
    listenerMockMap = {
      envInstallProgress: listenEnvInstallProgress as unknown as jest.Mock,
      batchProgress: listenBatchProgress as unknown as jest.Mock,
      commandOutput: listenCommandOutput as unknown as jest.Mock,
      downloadTaskAdded: listenDownloadTaskAdded as unknown as jest.Mock,
      downloadTaskStarted: listenDownloadTaskStarted as unknown as jest.Mock,
      downloadTaskCompleted: listenDownloadTaskCompleted as unknown as jest.Mock,
      downloadTaskFailed: listenDownloadTaskFailed as unknown as jest.Mock,
      downloadTaskPaused: listenDownloadTaskPaused as unknown as jest.Mock,
      downloadTaskResumed: listenDownloadTaskResumed as unknown as jest.Mock,
      downloadTaskCancelled: listenDownloadTaskCancelled as unknown as jest.Mock,
      selfUpdateProgress: listenSelfUpdateProgress as unknown as jest.Mock,
      updateCheckProgress: listenUpdateCheckProgress as unknown as jest.Mock,
    };
  }
  return listenerMockMap;
}

// Proxy that extracts the callback from mock.calls[0][0] when accessed by name
const listenerCallbacks = new Proxy({} as Record<string, (...args: unknown[]) => void>, {
  get(_target, prop: string) {
    const map = ensureListenerMap();
    const mock = map[prop];
    if (mock && mock.mock.calls.length > 0) {
      return mock.mock.calls[0][0];
    }
    return undefined;
  },
});

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
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        let result = key;
        for (const [k, v] of Object.entries(params)) {
          result += `|${k}=${v}`;
        }
        return result;
      }
      return key;
    },
  }),
}));

const mockAddLog = jest.fn();

jest.mock("@/lib/stores/log", () => ({
  useLogStore: () => ({
    addLog: mockAddLog,
  }),
}));

jest.mock("@tauri-apps/plugin-log", () => ({
  attachConsole: jest.fn(() => Promise.resolve(jest.fn())),
}));

const mockIsTauri = isTauri as jest.MockedFunction<typeof isTauri>;
const mockCaptureFrontendCrash =
  captureFrontendCrash as jest.MockedFunction<typeof captureFrontendCrash>;
const mockToastWarning = toast.warning as jest.MockedFunction<typeof toast.warning>;

describe("LogProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsTauri.mockReturnValue(false);
    mockCaptureFrontendCrash.mockResolvedValue({
      captured: false,
      reason: "not-tauri",
    });
    // Re-setup listener mock implementations after clearAllMocks
    const map = ensureListenerMap();
    Object.values(map).forEach((mock) => {
      mock.mockImplementation(() => Promise.resolve(jest.fn()));
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders children", () => {
    render(
      <LogProvider>
        <div data-testid="child">Child content</div>
      </LogProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  describe("console interception", () => {
    it("intercepts console.warn and adds log entry", async () => {
      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      // The interceptor uses setTimeout(0), so we need to flush
      console.warn("test warning message");

      act(() => {
        jest.runAllTimers();
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "warn",
          message: "test warning message",
          target: "webview",
        }),
      );
    });

    it("intercepts console.error and adds log entry", async () => {
      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      console.error("test error message");

      act(() => {
        jest.runAllTimers();
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "error",
          message: "test error message",
          target: "webview",
        }),
      );
    });

    it("formats object arguments as JSON in console interception", async () => {
      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      console.info("data:", { key: "value" });

      act(() => {
        jest.runAllTimers();
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          message: expect.stringContaining('{"key":"value"}'),
          target: "webview",
        }),
      );
    });
  });

  describe("window.error handling", () => {
    it("captures window.error and logs runtime entry in tauri mode", async () => {
      jest.useRealTimers();
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

    it("handles window.error without filename", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(true);
      mockCaptureFrontendCrash.mockResolvedValue({
        captured: false,
        reason: "session-deduped",
      });

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      const errorEvent = new Event("error") as ErrorEvent;
      Object.defineProperties(errorEvent, {
        message: { value: "no file", configurable: true },
        filename: { value: "", configurable: true },
        error: { value: new Error("no file"), configurable: true },
      });
      window.dispatchEvent(errorEvent);

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          expect.objectContaining({
            level: "error",
            message: expect.not.stringContaining("("),
            target: "runtime",
          }),
        );
      });
    });

    it("handles window.error with string message instead of Error object", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(true);
      mockCaptureFrontendCrash.mockResolvedValue({
        captured: false,
        reason: "session-deduped",
      });

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      const errorEvent = new Event("error") as ErrorEvent;
      Object.defineProperties(errorEvent, {
        message: { value: "plain string error", configurable: true },
        error: { value: null, configurable: true },
      });
      window.dispatchEvent(errorEvent);

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          expect.objectContaining({
            level: "error",
            message: expect.stringContaining("plain string error"),
            target: "runtime",
          }),
        );
      });
    });
  });

  describe("unhandled promise rejection", () => {
    it("logs unhandled promise rejection with Error", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(true);
      mockCaptureFrontendCrash.mockResolvedValue({
        captured: false,
        reason: "session-deduped",
      });

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      const rejectionEvent = new Event(
        "unhandledrejection",
      ) as PromiseRejectionEvent;
      Object.defineProperty(rejectionEvent, "reason", {
        value: new Error("promise failed"),
        configurable: true,
      });
      window.dispatchEvent(rejectionEvent);

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          expect.objectContaining({
            level: "error",
            message: expect.stringContaining("promise failed"),
            target: "runtime",
          }),
        );
      });
    });

    it("logs unhandled promise rejection with undefined reason", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(true);
      mockCaptureFrontendCrash.mockResolvedValue({
        captured: false,
        reason: "session-deduped",
      });

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      const rejectionEvent = new Event(
        "unhandledrejection",
      ) as PromiseRejectionEvent;
      Object.defineProperty(rejectionEvent, "reason", {
        value: undefined,
        configurable: true,
      });
      window.dispatchEvent(rejectionEvent);

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          expect.objectContaining({
            level: "error",
            message: expect.stringContaining("Unknown runtime error"),
            target: "runtime",
          }),
        );
      });
    });
  });

  describe("capture-failed path", () => {
    it("logs warning when capture fails", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(true);
      mockCaptureFrontendCrash.mockResolvedValue({
        captured: false,
        reason: "capture-failed",
      });

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      const errorEvent = new Event("error") as ErrorEvent;
      Object.defineProperties(errorEvent, {
        message: { value: "crash", configurable: true },
        error: { value: new Error("crash"), configurable: true },
      });
      window.dispatchEvent(errorEvent);

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          expect.objectContaining({
            level: "warn",
            message: "Automatic frontend crash diagnostic capture failed",
            target: "runtime",
          }),
        );
      });
    });
  });

  it("shows lightweight toast only once per session", async () => {
    jest.useRealTimers();
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

  describe("tauri event listeners", () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
    });

    it("registers all event listeners in tauri mode", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenCommandOutput).toHaveBeenCalled();
        expect(listenEnvInstallProgress).toHaveBeenCalled();
        expect(listenBatchProgress).toHaveBeenCalled();
        expect(listenDownloadTaskAdded).toHaveBeenCalled();
        expect(listenDownloadTaskStarted).toHaveBeenCalled();
        expect(listenDownloadTaskCompleted).toHaveBeenCalled();
        expect(listenDownloadTaskFailed).toHaveBeenCalled();
        expect(listenDownloadTaskPaused).toHaveBeenCalled();
        expect(listenDownloadTaskResumed).toHaveBeenCalled();
        expect(listenDownloadTaskCancelled).toHaveBeenCalled();
        expect(listenSelfUpdateProgress).toHaveBeenCalled();
        expect(listenUpdateCheckProgress).toHaveBeenCalled();
      });
    });

    it("does not register listeners in non-tauri mode", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(false);

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      // Give time for any async registration
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(listenCommandOutput).not.toHaveBeenCalled();
      expect(listenEnvInstallProgress).not.toHaveBeenCalled();
    });

    it("logs command output events", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["commandOutput"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["commandOutput"]({
          timestamp: 1000,
          data: "build succeeded",
          commandId: "cmd-1",
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: 1000,
          level: "info",
          message: "build succeeded",
          target: "command:cmd-1",
        }),
      );
    });

    it("logs env install progress - fetching step", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "fetching",
          progress: 0,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "env-install",
        }),
      );
    });

    it("logs env install progress - downloading with speed", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "downloading",
          progress: 50,
          speed: 1048576, // 1 MB/s
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          message: expect.stringContaining("node"),
          target: "env-install",
        }),
      );
    });

    it("logs env install progress - downloading without speed", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "python",
          version: "3.12",
          step: "downloading",
          progress: 30,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "env-install",
        }),
      );
    });

    it("logs env install progress - error step", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "error",
          progress: 0,
          error: "download timeout",
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "error",
          target: "env-install",
        }),
      );
    });

    it("logs env install progress - done step", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "done",
          progress: 100,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "env-install",
        }),
      );
    });

    it("logs env install progress - extracting step", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "extracting",
          progress: 80,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "env-install",
        }),
      );
    });

    it("logs env install progress - configuring step", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "configuring",
          progress: 90,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "env-install",
        }),
      );
    });

    it("logs batch progress - starting", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["batchProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["batchProgress"]({
          type: "starting",
          total: 5,
          current: 0,
          package: "",
          progress: 0,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "batch",
        }),
      );
    });

    it("logs batch progress - item_completed success", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["batchProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["batchProgress"]({
          type: "item_completed",
          total: 5,
          current: 3,
          package: "lodash",
          progress: 60,
          success: true,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "batch",
        }),
      );
    });

    it("logs batch progress - item_completed failure", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["batchProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["batchProgress"]({
          type: "item_completed",
          total: 5,
          current: 2,
          package: "broken-pkg",
          progress: 40,
          success: false,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "error",
          target: "batch",
        }),
      );
    });

    it("logs batch progress - completed with failures", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["batchProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["batchProgress"]({
          type: "completed",
          total: 5,
          current: 5,
          package: "",
          progress: 100,
          result: { successful: ["a", "b"], failed: ["c"] },
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "warn",
          target: "batch",
        }),
      );
    });

    it("logs batch progress - completed all successful", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["batchProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["batchProgress"]({
          type: "completed",
          total: 3,
          current: 3,
          package: "",
          progress: 100,
          result: { successful: ["a", "b", "c"], failed: [] },
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "batch",
        }),
      );
    });

    it("logs batch progress - resolving", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["batchProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["batchProgress"]({
          type: "resolving",
          total: 5,
          current: 1,
          package: "react",
          progress: 20,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "batch",
        }),
      );
    });

    it("logs batch progress - downloading", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["batchProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["batchProgress"]({
          type: "downloading",
          total: 5,
          current: 2,
          package: "react",
          progress: 40,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "batch",
        }),
      );
    });

    it("logs batch progress - installing", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["batchProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["batchProgress"]({
          type: "installing",
          total: 5,
          current: 3,
          package: "react",
          progress: 60,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "batch",
        }),
      );
    });

    it("logs download task added", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["downloadTaskAdded"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["downloadTaskAdded"]("task-123");
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "download",
        }),
      );
    });

    it("logs download task failed", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["downloadTaskFailed"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["downloadTaskFailed"]("task-456", "connection refused");
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "error",
          target: "download",
        }),
      );
    });

    it("logs download task paused", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["downloadTaskPaused"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["downloadTaskPaused"]("task-789");
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "download",
        }),
      );
    });

    it("logs download task cancelled", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["downloadTaskCancelled"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["downloadTaskCancelled"]("task-abc");
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "warn",
          target: "download",
        }),
      );
    });

    it("logs self-update progress - downloading", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["selfUpdateProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["selfUpdateProgress"]({
          status: "downloading",
          progress: 50,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "self-update",
        }),
      );
    });

    it("logs self-update progress - installing", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["selfUpdateProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["selfUpdateProgress"]({
          status: "installing",
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "self-update",
        }),
      );
    });

    it("logs self-update progress - done", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["selfUpdateProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["selfUpdateProgress"]({
          status: "done",
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "self-update",
        }),
      );
    });

    it("logs self-update progress - error", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["selfUpdateProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["selfUpdateProgress"]({
          status: "error",
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "error",
          target: "self-update",
        }),
      );
    });

    it("logs update check progress", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["updateCheckProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["updateCheckProgress"]({
          phase: "checking",
          current: 3,
          total: 10,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          target: "update-check",
        }),
      );
    });

    it("logs update check progress - done phase as info", async () => {
      jest.useRealTimers();

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["updateCheckProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["updateCheckProgress"]({
          phase: "done",
          current: 10,
          total: 10,
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          target: "update-check",
        }),
      );
    });
  });

  describe("formatSpeed", () => {
    it("formats speed in bytes per second", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(true);

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "downloading",
          progress: 50,
          speed: 500, // 500 bytes/s
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("logs.messages.speedBps"),
        }),
      );
    });

    it("formats speed in KB per second", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(true);

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "downloading",
          progress: 50,
          speed: 51200, // 50 KB/s
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("logs.messages.speedKBps"),
        }),
      );
    });

    it("formats speed in MB per second", async () => {
      jest.useRealTimers();
      mockIsTauri.mockReturnValue(true);

      render(
        <LogProvider>
          <div>Test</div>
        </LogProvider>,
      );

      await waitFor(() => {
        expect(listenerCallbacks["envInstallProgress"]).toBeDefined();
      });

      act(() => {
        listenerCallbacks["envInstallProgress"]({
          envType: "node",
          version: "20.0.0",
          step: "downloading",
          progress: 50,
          speed: 5242880, // 5 MB/s
        });
      });

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("logs.messages.speedMBps"),
        }),
      );
    });
  });
});
