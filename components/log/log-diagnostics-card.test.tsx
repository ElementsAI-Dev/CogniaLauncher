import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogDiagnosticsCard } from "./log-diagnostics-card";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "logs.diagnostics": "Diagnostics",
        "logs.diagnosticsDescription": "Export diagnostics and inspect recent crash reports.",
        "logs.runtimeMode": "Runtime Mode",
        "logs.runtimeModeDesktopDebug": "Desktop Debug",
        "logs.runtimeModeDesktopRelease": "Desktop Release",
        "logs.runtimeModeWeb": "Web",
        "logs.backendBridge": "Backend Bridge",
        "logs.bridgeAvailable": "Available",
        "logs.bridgeUnavailable": "Unavailable",
        "logs.bridgeUnsupported": "Unsupported",
        "logs.needsAttention": "Needs attention",
        "logs.bridgeGuidanceTitle": "Backend guidance",
        "logs.bridgeGuidanceDebug": "Use DevTools to inspect backend activity in debug mode.",
        "logs.bridgeGuidanceRelease": "Backend logs should be visible in the in-app workspace.",
        "logs.bridgeGuidanceUnavailable": "Backend bridge is currently unavailable.",
        "logs.exportFullDiagnostic": "Export Full Diagnostic",
        "logs.refreshCrashReports": "Refresh crash reports",
        "logs.recentCrashReports": "Recent crash reports",
        "logs.noCrashReports": "No crash reports",
        "logs.diagnosticDesktopOnlyDescription": "Desktop only",
        "logs.webDiagnosticsUnavailable": "Desktop-only diagnostics are unavailable in web mode.",
        "logs.pendingCrashReport": "Pending",
        "logs.copyReportPath": "Copy report path",
        "logs.openReportFolder": "Open report folder",
        "logs.latestCrashCapture": "Latest crash capture",
        "logs.latestDiagnosticExport": "Latest diagnostic export",
        "logs.statusSuccess": "Success",
        "logs.statusFailed": "Failed",
        "logs.statusSkipped": "Skipped",
      };
      let result = translations[key] || key;
      if (params) {
        for (const [paramKey, value] of Object.entries(params)) {
          result = result.replace(`{${paramKey}}`, String(value));
        }
      }
      return result;
    },
  }),
}));

jest.mock("@/lib/utils", () => ({
  formatBytes: (value: number) => `${value} B`,
  formatDate: (value: number | string) => String(value),
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

describe("LogDiagnosticsCard", () => {
  const baseProps = {
    observability: {
      runtimeMode: "desktop-release" as const,
      backendBridgeState: "available" as const,
      backendBridgeError: null,
      latestCrashCapture: null,
    },
    crashReports: [],
    latestDiagnosticAction: null,
    onExportDiagnostic: jest.fn(),
    onRefreshCrashReports: jest.fn(),
    onCopyPath: jest.fn(),
    onRevealPath: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders desktop diagnostics summary and actions", async () => {
    const user = userEvent.setup();
    render(<LogDiagnosticsCard {...baseProps} isDesktopRuntime />);

    expect(screen.getByText("Diagnostics")).toBeInTheDocument();
    expect(screen.getByText("Desktop Release")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("No crash reports")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export Full Diagnostic" }));
    await user.click(screen.getByRole("button", { name: "Refresh crash reports" }));

    expect(baseProps.onExportDiagnostic).toHaveBeenCalledTimes(1);
    expect(baseProps.onRefreshCrashReports).toHaveBeenCalledTimes(1);
  });

  it("shows desktop-only guidance and disables actions in web mode", () => {
    render(
      <LogDiagnosticsCard
        {...baseProps}
        isDesktopRuntime={false}
        observability={{
          ...baseProps.observability,
          runtimeMode: "web",
          backendBridgeState: "unsupported",
        }}
      />,
    );

    expect(screen.getByText("Web")).toBeInTheDocument();
    expect(screen.getByText("Desktop-only diagnostics are unavailable in web mode.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Full Diagnostic" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh crash reports" })).toBeDisabled();
  });

  it("renders latest diagnostic result and crash report actions", async () => {
    const user = userEvent.setup();
    render(
      <LogDiagnosticsCard
        {...baseProps}
        isDesktopRuntime
        latestDiagnosticAction={{
          kind: "full_diagnostic_export",
          status: "success",
          path: "D:/Diagnostics/cognia-diagnostic.zip",
          error: null,
          fileCount: 3,
          sizeBytes: 1024,
          updatedAt: 1,
        }}
        crashReports={[
          {
            id: "runtime-1",
            source: "frontend-runtime",
            reportPath: "D:/Crash/report.zip",
            timestamp: "2026-02-25T00:00:00Z",
            message: "boom",
            size: 2048,
            pending: true,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("logs-diagnostic-result")).toHaveTextContent(
      "Latest diagnostic export",
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy report path" }));
    await user.click(screen.getByRole("button", { name: "Open report folder" }));

    expect(baseProps.onCopyPath).toHaveBeenCalledWith("D:/Crash/report.zip");
    expect(baseProps.onRevealPath).toHaveBeenCalledWith("D:/Crash/report.zip");
  });
});
