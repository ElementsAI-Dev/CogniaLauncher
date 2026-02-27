import { render, screen, fireEvent } from "@testing-library/react";
import { HealthCheckPanel, IssueCard } from "./health-check-panel";
import { useHealthCheck } from "@/hooks/use-health-check";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/use-health-check", () => ({
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

  it("accepts className prop", () => {
    const { container } = render(<HealthCheckPanel className="my-custom" />);
    expect(container.querySelector(".my-custom")).toBeInTheDocument();
  });
});

describe("IssueCard", () => {
  const mockOnCopy = jest.fn();
  const mockT = (key: string) => key;

  it("renders issue message", () => {
    render(
      <IssueCard
        issue={{
          message: "Missing PATH entry",
          severity: "warning",
          category: "path_conflict",
          details: null,
          fix_command: null,
          fix_description: null,
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    expect(screen.getByText("Missing PATH entry")).toBeInTheDocument();
  });

  it("renders destructive variant for critical severity", () => {
    const { container } = render(
      <IssueCard
        issue={{
          message: "Critical error",
          severity: "critical",
          category: "other",
          details: null,
          fix_command: null,
          fix_description: null,
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    expect(container.querySelector('[data-variant="destructive"], [role="alert"]')).toBeInTheDocument();
  });

  it("renders fix command with copy button", () => {
    render(
      <IssueCard
        issue={{
          message: "PATH not set",
          severity: "info",
          category: "shell_integration",
          details: null,
          fix_command: "export PATH=$PATH:/usr/local/bin",
          fix_description: "Add to your shell profile",
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    expect(screen.getByText("export PATH=$PATH:/usr/local/bin")).toBeInTheDocument();
    expect(screen.getByText("Add to your shell profile")).toBeInTheDocument();
  });

  it("calls onCopy when copy button is clicked", () => {
    render(
      <IssueCard
        issue={{
          message: "Fix needed",
          severity: "warning",
          category: "missing_dependency",
          details: null,
          fix_command: "npm install -g node",
          fix_description: null,
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    const copyBtn = screen.getByTitle("copyCommand");
    fireEvent.click(copyBtn);
    expect(mockOnCopy).toHaveBeenCalledWith("npm install -g node");
  });

  it("renders details when provided", () => {
    render(
      <IssueCard
        issue={{
          message: "Error",
          severity: "error",
          category: "config_error",
          details: "Detailed explanation here",
          fix_command: null,
          fix_description: null,
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    expect(screen.getByText("Detailed explanation here")).toBeInTheDocument();
  });
});
