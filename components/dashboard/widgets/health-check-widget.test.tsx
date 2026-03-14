import { render, screen, fireEvent } from "@testing-library/react";
import { HealthCheckWidget } from "./health-check-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

let mockSystemHealth: Record<string, unknown> | null = null;
let mockLoading = false;
let mockError: string | null = null;
const mockCheckAll = jest.fn();
let mockCheckAllImpl = mockCheckAll;
const mockIsTauri = jest.fn(() => false);
const mockSummary = {
  environmentCount: 0,
  healthyCount: 0,
  warningCount: 0,
  errorCount: 0,
  unavailableCount: 0,
  unavailableScopeCount: 0,
  timeoutScopeCount: 0,
  unsupportedScopeCount: 0,
  packageManagerCount: 0,
  unavailablePackageManagerCount: 0,
  issueCount: 0,
  verifiedIssueCount: 0,
  advisoryIssueCount: 0,
  actionableIssueCount: 0,
};

jest.mock("@/hooks/use-health-check", () => ({
  useHealthCheck: () => ({
    systemHealth: mockSystemHealth,
    loading: mockLoading,
    error: mockError,
    summary: mockSummary,
    checkAll: mockCheckAllImpl,
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("HealthCheckWidget", () => {
  beforeEach(() => {
    mockSystemHealth = null;
    mockLoading = false;
    mockError = null;
    mockCheckAllImpl = mockCheckAll;
    mockIsTauri.mockReturnValue(false);
    mockSummary.environmentCount = 0;
    mockSummary.healthyCount = 0;
    mockSummary.warningCount = 0;
    mockSummary.errorCount = 0;
    mockSummary.unavailableCount = 0;
    mockSummary.unavailableScopeCount = 0;
    mockSummary.timeoutScopeCount = 0;
    mockSummary.unsupportedScopeCount = 0;
    mockSummary.packageManagerCount = 0;
    mockSummary.unavailablePackageManagerCount = 0;
    mockSummary.issueCount = 0;
    mockSummary.verifiedIssueCount = 0;
    mockSummary.advisoryIssueCount = 0;
    mockSummary.actionableIssueCount = 0;
    jest.clearAllMocks();
  });

  it("renders health check title", () => {
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthCheck")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthCheckDesc")).toBeInTheDocument();
  });

  it("shows prompt state when systemHealth is null", () => {
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthCheckPrompt")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "dashboard.widgets.healthCheckRun" }).length).toBeGreaterThan(0);
  });

  it("shows healthy status", () => {
    mockSystemHealth = {
      overall_status: "healthy",
      environments: [{ status: "healthy" }, { status: "healthy" }],
      system_issues: [],
    };
    mockSummary.environmentCount = 2;
    mockSummary.healthyCount = 2;
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthStatus_healthy")).toBeInTheDocument();
  });

  it("shows warning status", () => {
    mockSystemHealth = {
      overall_status: "warning",
      environments: [{ status: "healthy" }, { status: "warning" }],
      system_issues: [],
    };
    mockSummary.environmentCount = 2;
    mockSummary.healthyCount = 1;
    mockSummary.warningCount = 1;
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthStatus_warning")).toBeInTheDocument();
  });

  it("shows error status with destructive alert", () => {
    mockSystemHealth = {
      overall_status: "error",
      environments: [{ status: "error" }],
      system_issues: [],
    };
    mockSummary.environmentCount = 1;
    mockSummary.errorCount = 1;
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthStatus_error")).toBeInTheDocument();
  });

  it("displays environment breakdown counts", () => {
    mockSystemHealth = {
      overall_status: "warning",
      environments: [
        { status: "healthy" },
        { status: "healthy" },
        { status: "warning" },
        { status: "error" },
      ],
      system_issues: [],
    };
    mockSummary.environmentCount = 4;
    mockSummary.healthyCount = 2;
    mockSummary.warningCount = 1;
    mockSummary.errorCount = 1;
    mockSummary.unavailableCount = 0;
    render(<HealthCheckWidget />);
    // healthy: 2, warning: 1, error: 1
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.healthHealthy")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.healthWarnings")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.healthErrors")).toBeInTheDocument();
  });

  it("displays system issues with severity badges", () => {
    mockSystemHealth = {
      overall_status: "error",
      environments: [],
      system_issues: [
        { severity: "critical", message: "Disk space low" },
        { severity: "warning", message: "Outdated version" },
      ],
    };
    render(<HealthCheckWidget />);
    expect(screen.getByText("Disk space low")).toBeInTheDocument();
    expect(screen.getByText("Outdated version")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("shows issue count in alert", () => {
    mockSystemHealth = {
      overall_status: "warning",
      environments: [],
      system_issues: [{ severity: "warning", message: "Issue 1" }],
    };
    mockSummary.issueCount = 1;
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthIssues")).toBeInTheDocument();
  });

  it("renders view details link", () => {
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthViewDetails")).toBeInTheDocument();
  });

  it("has refresh button that calls checkAll", () => {
    render(<HealthCheckWidget />);
    const refreshButton = screen.getAllByRole("button")[0];
    fireEvent.click(refreshButton);
    expect(mockCheckAll).toHaveBeenCalledTimes(1);
    expect(mockCheckAll).toHaveBeenCalledWith({ force: true });
  });

  it("auto-checks only once in desktop mode across rerenders", () => {
    mockIsTauri.mockReturnValue(true);
    const firstCheckAll = jest.fn();
    const secondCheckAll = jest.fn();
    mockCheckAllImpl = firstCheckAll;

    const { rerender } = render(<HealthCheckWidget />);
    expect(firstCheckAll).toHaveBeenCalledTimes(1);

    mockCheckAllImpl = secondCheckAll;
    rerender(<HealthCheckWidget />);

    expect(firstCheckAll).toHaveBeenCalledTimes(1);
    expect(secondCheckAll).not.toHaveBeenCalled();
  });

  it("accepts className prop", () => {
    const { container } = render(<HealthCheckWidget className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });

  it("shows retry action when the hook reports an error", () => {
    mockError = "Health check failed";

    render(<HealthCheckWidget />);

    expect(screen.getByText("dashboard.widgets.sectionNeedsAttention")).toBeInTheDocument();
    fireEvent.click(screen.getByText("dashboard.widgets.retry"));
    expect(mockCheckAll).toHaveBeenCalledWith({ force: true });
  });
});
