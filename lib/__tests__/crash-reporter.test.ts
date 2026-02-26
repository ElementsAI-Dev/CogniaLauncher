import { isTauri } from "@/lib/platform";
import { diagnosticCaptureFrontendCrash } from "@/lib/tauri";
import {
  _resetFrontendCrashCaptureForTests,
  buildDiagnosticErrorContext,
  captureFrontendCrash,
} from "@/lib/crash-reporter";

jest.mock("@/lib/platform", () => ({
  isTauri: jest.fn(),
}));

jest.mock("@/lib/tauri", () => ({
  diagnosticCaptureFrontendCrash: jest.fn(),
}));

const mockIsTauri = isTauri as jest.MockedFunction<typeof isTauri>;
const mockDiagnosticCaptureFrontendCrash =
  diagnosticCaptureFrontendCrash as jest.MockedFunction<
    typeof diagnosticCaptureFrontendCrash
  >;

describe("crash-reporter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetFrontendCrashCaptureForTests();
    window.sessionStorage.clear();
  });

  it("returns not-tauri without calling backend command", async () => {
    mockIsTauri.mockReturnValue(false);

    const result = await captureFrontendCrash({
      source: "window.error",
      error: new Error("boom"),
    });

    expect(result).toEqual({ captured: false, reason: "not-tauri" });
    expect(mockDiagnosticCaptureFrontendCrash).not.toHaveBeenCalled();
  });

  it("captures frontend crash with includeConfig defaulted to true", async () => {
    mockIsTauri.mockReturnValue(true);
    mockDiagnosticCaptureFrontendCrash.mockResolvedValue({
      reportPath: "D:/Project/CogniaLauncher/.CogniaLauncher/crash-reports/x.zip",
      timestamp: "2026-02-25T00:00:00Z",
      message: "boom",
    });

    const result = await captureFrontendCrash({
      source: "window.error",
      error: new Error("boom"),
      extra: { digest: "abc123" },
    });

    expect(mockDiagnosticCaptureFrontendCrash).toHaveBeenCalledTimes(1);
    expect(mockDiagnosticCaptureFrontendCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        includeConfig: true,
        errorContext: expect.objectContaining({
          message: "boom",
          component: "frontend:window.error",
        }),
      }),
    );
    expect(result.captured).toBe(true);
    expect(result.crashInfo?.reportPath).toContain("crash-reports");
  });

  it("deduplicates automatic capture to once per session", async () => {
    mockIsTauri.mockReturnValue(true);
    mockDiagnosticCaptureFrontendCrash.mockResolvedValue({
      reportPath: "report.zip",
      timestamp: "2026-02-25T00:00:00Z",
      message: "first",
    });

    const first = await captureFrontendCrash({
      source: "window.error",
      error: new Error("first"),
    });
    const second = await captureFrontendCrash({
      source: "window.unhandledrejection",
      error: new Error("second"),
    });

    expect(first.captured).toBe(true);
    expect(second).toEqual({ captured: false, reason: "session-deduped" });
    expect(mockDiagnosticCaptureFrontendCrash).toHaveBeenCalledTimes(1);
  });

  it("degrades gracefully when backend capture fails", async () => {
    mockIsTauri.mockReturnValue(true);
    mockDiagnosticCaptureFrontendCrash.mockRejectedValue(new Error("ipc failed"));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await captureFrontendCrash({
      source: "window.error",
      error: new Error("boom"),
    });

    expect(result).toEqual({ captured: false, reason: "capture-failed" });
    expect(consoleErrorSpy).toHaveBeenCalled();

    const second = await captureFrontendCrash({
      source: "window.error",
      error: new Error("boom again"),
    });
    expect(second).toEqual({ captured: false, reason: "session-deduped" });

    consoleErrorSpy.mockRestore();
  });

  it("builds serializable context for non-error rejections", () => {
    const context = buildDiagnosticErrorContext({
      source: "window.unhandledrejection",
      error: { reason: "network timeout", code: 504 },
    });

    expect(context.message).toBe("network timeout");
    expect(context.component).toBe("frontend:window.unhandledrejection");
    expect(context.extra).toEqual(
      expect.objectContaining({
        source: "window.unhandledrejection",
      }),
    );
  });
});
