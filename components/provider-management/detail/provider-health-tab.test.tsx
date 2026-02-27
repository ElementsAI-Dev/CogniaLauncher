import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderHealthTab } from "./provider-health-tab";
import type { PackageManagerHealthResult } from "@/types/tauri";

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providerDetail.healthCheck": "Health Check",
    "providerDetail.healthCheckDesc": "Run health check description",
    "providerDetail.runCheck": "Run Check",
    "providerDetail.noHealthData": "No health data",
    "providerDetail.noHealthDataDesc": "Run a check to see status",
    "providerDetail.copyDiagnostics": "Copy Diagnostics",
    "providerDetail.diagnosticsCopied": "Diagnostics copied",
    "providerDetail.detectedVersion": "Detected Version",
    "providerDetail.executablePath": "Executable Path",
    "providerDetail.issues": "Issues",
    "providerDetail.noIssues": "No issues found",
    "providerDetail.installInstructions": "Install Instructions",
    "providerDetail.copyFixCommands": "Copy Fix Commands",
    "providerDetail.fixCommandsCopied": "Fix commands copied",
    "providerDetail.copyCommand": "Copy Command",
    "providerDetail.healthStatus.healthy": "Healthy",
    "providerDetail.healthStatus.warning": "Warning",
    "providerDetail.healthStatus.error": "Error",
  };
  return translations[key] || key;
};

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
    t: mockT,
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
    expect(screen.getByText("No health data")).toBeInTheDocument();
    expect(screen.getByText("Run a check to see status")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading with no result", () => {
    render(<ProviderHealthTab {...defaultProps} loadingHealth={true} />);
    // Skeleton elements render, no health data text should not appear
    expect(screen.queryByText("No health data")).not.toBeInTheDocument();
  });

  it("renders healthy status correctly", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={healthyResult} />);
    expect(screen.getByText("npm")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("10.2.0")).toBeInTheDocument();
    expect(screen.getByText("/usr/bin/npm")).toBeInTheDocument();
  });

  it("shows no issues message for healthy result", () => {
    render(<ProviderHealthTab {...defaultProps} healthResult={healthyResult} />);
    expect(screen.getByText("No issues found")).toBeInTheDocument();
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
