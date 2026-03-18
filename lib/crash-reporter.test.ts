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
        source: "window.error",
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

  it("builds diagnostic context for string and unknown primitive errors", () => {
    expect(buildDiagnosticErrorContext({
      source: "string-error",
      error: "plain failure",
      extra: { ignored: undefined, keep: "yes" },
    })).toMatchObject({
      message: "plain failure",
      extra: expect.objectContaining({
        source: "string-error",
        keep: "yes",
        rawError: "plain failure",
      }),
    });

    expect(buildDiagnosticErrorContext({
      source: "unknown-error",
      error: 123,
    })).toMatchObject({
      message: "Unknown frontend error",
      extra: expect.objectContaining({
        rawError: 123,
      }),
    });
  });

  it("uses the error name when Error.message is empty and preserves object stacks", () => {
    expect(buildDiagnosticErrorContext({
      source: "named-error",
      error: Object.assign(new Error(""), { name: "NamedError" }),
    })).toMatchObject({
      message: "NamedError",
    });

    expect(buildDiagnosticErrorContext({
      source: "object-stack",
      error: { message: "boom", stack: "stack-trace" },
    })).toMatchObject({
      message: "boom",
      stack: "stack-trace",
    });
  });

  it("bounds runtime breadcrumbs before sending capture payload", async () => {
    mockIsTauri.mockReturnValue(true);
    mockDiagnosticCaptureFrontendCrash.mockResolvedValue({
      reportPath: "report.zip",
      timestamp: "2026-02-25T00:00:00Z",
      message: "ok",
    });

    const longMessage = "x".repeat(5000);
    const breadcrumbs = Array.from({ length: 120 }, (_, index) => ({
      timestamp: `2026-02-25T00:00:${String(index).padStart(2, "0")}Z`,
      level: "info",
      target: "runtime",
      message: index === 119 ? longMessage : `entry-${index}`,
    }));

    await captureFrontendCrash({
      source: "window.error",
      error: new Error("boom"),
      runtimeBreadcrumbs: breadcrumbs,
    });

    expect(mockDiagnosticCaptureFrontendCrash).toHaveBeenCalledTimes(1);
    const payload = mockDiagnosticCaptureFrontendCrash.mock.calls[0][0];
    expect(payload.runtimeBreadcrumbs).toHaveLength(100);
    expect(payload.runtimeBreadcrumbs?.[0].message).toBe("entry-20");
    expect(payload.runtimeBreadcrumbs?.[99].message.length).toBe(4096);
  });

  it("respects includeConfig overrides and omits empty breadcrumb arrays", async () => {
    mockIsTauri.mockReturnValue(true);
    mockDiagnosticCaptureFrontendCrash.mockResolvedValue({
      reportPath: "report.zip",
      timestamp: "2026-02-25T00:00:00Z",
      message: "ok",
    });

    await captureFrontendCrash({
      source: "window.error",
      error: new Error("boom"),
      includeConfig: false,
      runtimeBreadcrumbs: [],
    });

    expect(mockDiagnosticCaptureFrontendCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        includeConfig: false,
        runtimeBreadcrumbs: undefined,
      }),
    );
  });

  it("reset helper clears the session marker so a later capture can run again", async () => {
    mockIsTauri.mockReturnValue(true);
    mockDiagnosticCaptureFrontendCrash.mockResolvedValue({
      reportPath: "report.zip",
      timestamp: "2026-02-25T00:00:00Z",
      message: "ok",
    });

    await captureFrontendCrash({
      source: "window.error",
      error: new Error("boom"),
    });
    _resetFrontendCrashCaptureForTests();
    await captureFrontendCrash({
      source: "window.error",
      error: new Error("boom-again"),
    });

    expect(mockDiagnosticCaptureFrontendCrash).toHaveBeenCalledTimes(2);
  });
});
