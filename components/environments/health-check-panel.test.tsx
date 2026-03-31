import { render, screen, fireEvent } from "@testing-library/react";
import { HealthCheckPanel } from "./health-check-panel";
import { useHealthCheck } from "@/hooks/health/use-health-check";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/health/use-health-check", () => ({
  useHealthCheck: jest.fn(),
}));

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(),
}));

const mockUseHealthCheck = useHealthCheck as unknown as jest.Mock;

const mockCheckAll = jest.fn();
const mockGetStatusColor = jest.fn(() => "text-green-600 bg-green-50 border-green-200");

const defaultMock = {
  systemHealth: null,
  loading: false,
  error: null,
  checkAll: mockCheckAll,
  getStatusColor: mockGetStatusColor,
};

describe("HealthCheckPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHealthCheck.mockReturnValue(defaultMock);
  });

  it("renders without crashing", () => {
    const { container } = render(<HealthCheckPanel />);
    expect(container).toBeInTheDocument();
  });

  it("renders title and run check button", () => {
    render(<HealthCheckPanel />);
    expect(screen.getByText("environments.healthCheck.title")).toBeInTheDocument();
    expect(screen.getByText("environments.healthCheck.runCheck")).toBeInTheDocument();
  });

  it("shows no results state when systemHealth is null and not loading", () => {
    render(<HealthCheckPanel />);
    expect(screen.getByText("environments.healthCheck.noResults")).toBeInTheDocument();
    expect(screen.getByText("environments.healthCheck.clickToCheck")).toBeInTheDocument();
  });

  it("calls checkAll when run check button is clicked", () => {
    render(<HealthCheckPanel />);
    fireEvent.click(screen.getByText("environments.healthCheck.runCheck"));
    expect(mockCheckAll).toHaveBeenCalledTimes(1);
  });

  it("disables run check button when loading", () => {
    mockUseHealthCheck.mockReturnValue({ ...defaultMock, loading: true });
    render(<HealthCheckPanel />);
    const btn = screen.getByText("environments.healthCheck.runCheck").closest("button");
    expect(btn).toBeDisabled();
  });

  it("shows error alert when error exists", () => {
    mockUseHealthCheck.mockReturnValue({
      ...defaultMock,
      error: "Connection failed",
    });
    render(<HealthCheckPanel />);
    expect(screen.getByText("Connection failed")).toBeInTheDocument();
  });

  it("renders overall status when systemHealth is provided", () => {
    mockUseHealthCheck.mockReturnValue({
      ...defaultMock,
      systemHealth: {
        overall_status: "healthy",
        checked_at: new Date().toISOString(),
        system_issues: [],
        environments: [],
      },
    });
    render(<HealthCheckPanel />);
    expect(screen.getByText("environments.healthCheck.status.healthy")).toBeInTheDocument();
  });

  it("renders system issues when present", () => {
    mockUseHealthCheck.mockReturnValue({
      ...defaultMock,
      systemHealth: {
        overall_status: "warning",
        checked_at: new Date().toISOString(),
        system_issues: [
          {
            message: "Disk space low",
            severity: "warning",
            category: "other",
            details: "Less than 1GB",
            fix_command: null,
            fix_description: null,
          },
        ],
        environments: [],
      },
    });
    render(<HealthCheckPanel />);
    expect(screen.getByText("environments.healthCheck.systemIssues")).toBeInTheDocument();
    expect(screen.getByText("Disk space low")).toBeInTheDocument();
  });

  it("renders environment health entries", () => {
    mockUseHealthCheck.mockReturnValue({
      ...defaultMock,
      systemHealth: {
        overall_status: "healthy",
        checked_at: new Date().toISOString(),
        system_issues: [],
        environments: [
          {
            env_type: "node",
            provider_id: "fnm",
            status: "healthy",
            issues: [],
            suggestions: [],
          },
        ],
      },
    });
    render(<HealthCheckPanel />);
    expect(screen.getByText("node")).toBeInTheDocument();
    expect(screen.getByText("(fnm)")).toBeInTheDocument();
    expect(screen.getByText(/0.*environments.healthCheck.issues/)).toBeInTheDocument();
  });

  it("renders scope state metadata for unavailable targets", () => {
    mockUseHealthCheck.mockReturnValue({
      ...defaultMock,
      systemHealth: {
        overall_status: "warning",
        checked_at: new Date().toISOString(),
        system_issues: [],
        environments: [
          {
            env_type: "python",
            provider_id: "pyenv",
            status: "unknown",
            scope_state: "timeout",
            scope_reason: "health_check_timeout",
            issues: [],
            suggestions: [],
          },
        ],
        package_managers: [],
      },
    });

    render(<HealthCheckPanel />);
    expect(screen.getByText("Timeout")).toBeInTheDocument();
    fireEvent.click(screen.getByText("python"));
    expect(screen.getByText("Scope: Timeout (health_check_timeout)")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(<HealthCheckPanel className="my-custom" />);
    expect(container.querySelector(".my-custom")).toBeInTheDocument();
  });

  it("renders envvar diagnostics in a dedicated section", () => {
    mockUseHealthCheck.mockReturnValue({
      ...defaultMock,
      systemHealth: {
        overall_status: "warning",
        checked_at: new Date().toISOString(),
        envvar_issues: [
          {
            message: "System PATH contains duplicate entries",
            severity: "info",
            category: "path_conflict",
            details: "Duplicate entries: C:\\Tools (2x)",
            fix_command: null,
            fix_description: null,
            remediation_id: null,
            check_id: "envvar_path_duplicates:system",
          },
        ],
        system_issues: [
          {
            message: "Disk space low",
            severity: "warning",
            category: "other",
            details: "Less than 1GB",
            fix_command: null,
            fix_description: null,
          },
        ],
        environments: [],
        package_managers: [],
      },
    });

    render(<HealthCheckPanel />);

    expect(screen.getByText("environments.healthCheck.envvarIssues")).toBeInTheDocument();
    expect(screen.getByText("System PATH contains duplicate entries")).toBeInTheDocument();
    expect(screen.getByText("environments.healthCheck.systemIssues")).toBeInTheDocument();
  });

  it("renders WSL health issues in a dedicated section", () => {
    mockUseHealthCheck.mockReturnValue({
      ...defaultMock,
      systemHealth: {
        overall_status: "warning",
        checked_at: new Date().toISOString(),
        envvar_issues: [],
        system_issues: [],
        environments: [],
        package_managers: [],
        wsl_health: {
          status: "warning",
          checked_at: new Date().toISOString(),
          issues: [
            {
              message: "WSL DNS resolution failed",
              severity: "warning",
              category: "network_error",
              details: "nslookup returned non-zero",
              fix_command: null,
              fix_description: null,
            },
          ],
        },
      },
    });

    render(<HealthCheckPanel />);
    expect(screen.getByText("environments.healthCheck.wslIssues")).toBeInTheDocument();
    expect(screen.getByText("WSL DNS resolution failed")).toBeInTheDocument();
  });
});
