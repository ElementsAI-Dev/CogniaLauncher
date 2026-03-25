import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderHealthTab } from "./provider-health-tab";
import { writeClipboard } from "@/lib/clipboard";
import type { PackageManagerHealthResult } from "@/types/tauri";

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "providerDetail.noHealthData": "providerDetail.noHealthData",
        "providerDetail.noHealthDataDesc": "providerDetail.noHealthDataDesc",
        "providerDetail.copyDiagnostics": "Copy Diagnostics",
        "providerDetail.runCheck": "Run Check",
        "providerDetail.issues": "Issues",
        "providerDetail.copyFixCommands": `Copy Fix Commands${params?.count ? ` (${params.count})` : ""}`,
        "providerDetail.healthStatus.healthy": "providerDetail.healthStatus.healthy",
        "providerDetail.healthStatus.warning": "Warning",
        "providerDetail.healthStatus.error": "Error",
        "providerDetail.diagnosticsCopied": "providerDetail.diagnosticsCopied",
        "providerDetail.fixCommandsCopied": "providerDetail.fixCommandsCopied",
      };
      return translations[key] ?? key;
    },
  }),
}));

const healthyResult: PackageManagerHealthResult = {
  provider_id: "npm",
  display_name: "npm",
  status: "healthy",
  version: "10.2.0",
  executable_path: "/usr/bin/npm",
  issues: [],
  install_instructions: null,
  checked_at: new Date().toISOString(),
};

const warningResult: PackageManagerHealthResult = {
  provider_id: "npm",
  display_name: "npm",
  status: "warning",
  version: "8.0.0",
  executable_path: "/usr/bin/npm",
  issues: [
    {
      severity: "warning",
      category: "version_mismatch",
      message: "Outdated version detected",
      details: "Consider upgrading to latest",
      fix_command: "npm install -g npm@latest",
      fix_description: "Update npm globally",
    },
  ],
  install_instructions: null,
  checked_at: new Date().toISOString(),
};

const errorResult: PackageManagerHealthResult = {
  provider_id: "npm",
  display_name: "npm",
  status: "error",
  scope_state: "unavailable",
  scope_reason: "provider_executable_unavailable",
  version: null,
  executable_path: null,
  issues: [
    {
      severity: "critical",
      category: "provider_not_found",
      message: "npm not found",
      details: null,
      fix_command: null,
      fix_description: null,
    },
  ],
  install_instructions: "Install Node.js from nodejs.org",
  checked_at: new Date().toISOString(),
};

describe("ProviderHealthTab", () => {
  const defaultProps = {
    healthResult: null as PackageManagerHealthResult | null,
    loadingHealth: false,
    onRunHealthCheck: jest.fn(() => Promise.resolve(null)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<ProviderHealthTab {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("shows no health data message when result is null", () => {
    render(<ProviderHealthTab {...defaultProps} />);
    expect(screen.getByText("providerDetail.noHealthData")).toBeInTheDocument();
    expect(screen.getByText("providerDetail.noHealthDataDesc")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading with no result", () => {
    render(<ProviderHealthTab {...defaultProps} loadingHealth={true} />);
    // Skeleton elements render, no health data text should not appear
    expect(screen.queryByText("providerDetail.noHealthData")).not.toBeInTheDocument();
  });

  it("renders healthy status correctly", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={healthyResult} />);
    expect(screen.getByText("npm")).toBeInTheDocument();
    expect(screen.getByText("providerDetail.healthStatus.healthy")).toBeInTheDocument();
    expect(screen.getByText("10.2.0")).toBeInTheDocument();
    expect(screen.getByText("/usr/bin/npm")).toBeInTheDocument();
  });

  it("shows no issues message for healthy result", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={healthyResult} />);
    expect(screen.getByText("providerDetail.noIssues")).toBeInTheDocument();
  });

  it("renders issues for warning result", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={warningResult} />);
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Outdated version detected")).toBeInTheDocument();
    expect(screen.getByText("npm install -g npm@latest")).toBeInTheDocument();
    expect(screen.getByText("Update npm globally")).toBeInTheDocument();
  });

  it("shows issues count", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={warningResult} />);
    expect(screen.getByText("Issues (1)")).toBeInTheDocument();
  });

  it("renders error status with install instructions", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={errorResult} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("npm not found")).toBeInTheDocument();
    expect(screen.getByText("Install Node.js from nodejs.org")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("provider_executable_unavailable")).toBeInTheDocument();
  });

  it("includes scope context when copying diagnostics", async () => {
    const user = userEvent.setup();
    render(<ProviderHealthTab {...defaultProps} healthResult={errorResult} />);
    const copyButton = screen.getByText("Copy Diagnostics").closest("button");
    expect(copyButton).not.toBeNull();

    await user.click(copyButton!);

    expect(writeClipboard).toHaveBeenCalled();
    const payload = (writeClipboard as jest.Mock).mock.calls[0]?.[0] as string;
    expect(payload).toContain("Scope: Unavailable");
    expect(payload).toContain("Scope Reason: provider_executable_unavailable");
  });

  it("calls onRunHealthCheck when run check button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderHealthTab {...defaultProps} />);
    const runButton = screen.getByText("Run Check").closest("button")!;
    await user.click(runButton);
    expect(defaultProps.onRunHealthCheck).toHaveBeenCalled();
  });

  it("disables run check button when loading", () => {
    render(<ProviderHealthTab {...defaultProps} loadingHealth={true} healthResult={healthyResult} />);
    const runButton = screen.getByText("Run Check").closest("button")!;
    expect(runButton).toBeDisabled();
  });

  it("shows copy diagnostics button when health result exists", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={healthyResult} />);
    expect(screen.getByText("Copy Diagnostics")).toBeInTheDocument();
  });

  it("does not show copy diagnostics button when no result", () => {
    render(<ProviderHealthTab {...defaultProps} />);
    expect(screen.queryByText("Copy Diagnostics")).not.toBeInTheDocument();
  });

  it("shows copy fix commands button when fixable issues exist", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={warningResult} />);
    expect(screen.getByText(/Copy Fix Commands/)).toBeInTheDocument();
  });
});
