import { render, screen, fireEvent } from "@testing-library/react";
import { HealthCheckWidget } from "./health-check-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

let mockSystemHealth: Record<string, unknown> | null = null;
let mockLoading = false;
const mockCheckAll = jest.fn();

jest.mock("@/hooks/use-health-check", () => ({
  useHealthCheck: () => ({
    systemHealth: mockSystemHealth,
    loading: mockLoading,
    checkAll: mockCheckAll,
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
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

  it("shows unknown status when systemHealth is null", () => {
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthStatus_unknown")).toBeInTheDocument();
  });

  it("shows healthy status", () => {
    mockSystemHealth = {
      overall_status: "healthy",
      environments: [{ status: "healthy" }, { status: "healthy" }],
      system_issues: [],
    };
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthStatus_healthy")).toBeInTheDocument();
  });

  it("shows warning status", () => {
    mockSystemHealth = {
      overall_status: "warning",
      environments: [{ status: "healthy" }, { status: "warning" }],
      system_issues: [],
    };
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthStatus_warning")).toBeInTheDocument();
  });

  it("shows error status with destructive alert", () => {
    mockSystemHealth = {
      overall_status: "error",
      environments: [{ status: "error" }],
      system_issues: [],
    };
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
  });

  it("accepts className prop", () => {
    const { container } = render(<HealthCheckWidget className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});
