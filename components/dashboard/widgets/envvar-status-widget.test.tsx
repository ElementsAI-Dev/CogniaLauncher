import { render, screen } from "@testing-library/react";
import { EnvVarStatusWidget } from "./envvar-status-widget";

const mockUseEnvVar = jest.fn();

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/envvar/use-envvar", () => ({
  useEnvVar: () => mockUseEnvVar(),
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("EnvVarStatusWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvVar.mockReturnValue({
      overview: null,
      overviewLoading: false,
      overviewError: null,
      getOverview: jest.fn(),
    });
  });

  it("renders envvar widget title and description", () => {
    render(<EnvVarStatusWidget />);
    expect(screen.getByText("dashboard.widgets.envvarStatus")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.envvarStatusDesc")).toBeInTheDocument();
  });

  it("shows empty prompt when no overview is available yet", () => {
    render(<EnvVarStatusWidget />);
    expect(screen.getByText("dashboard.widgets.envvarStatusPrompt")).toBeInTheDocument();
  });

  it("renders overview metrics and tab links", () => {
    mockUseEnvVar.mockReturnValue({
      overview: {
        totalVars: 12,
        processCount: 4,
        userCount: 5,
        systemCount: 3,
        conflictCount: 2,
        pathIssueCount: 3,
        latestSnapshotAt: "2026-03-28T00:00:00Z",
      },
      overviewLoading: false,
      overviewError: null,
      getOverview: jest.fn(),
    });

    render(<EnvVarStatusWidget />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dashboard.widgets.envvarMetricTotal" })).toHaveAttribute(
      "href",
      "/envvar?tab=variables",
    );
    expect(screen.getByRole("link", { name: "dashboard.widgets.envvarMetricPathIssues" })).toHaveAttribute(
      "href",
      "/envvar?tab=path",
    );
  });

  it("shows error state with retry action when overview loading fails", () => {
    const getOverview = jest.fn();
    mockUseEnvVar.mockReturnValue({
      overview: null,
      overviewLoading: false,
      overviewError: "overview failed",
      getOverview,
    });

    render(<EnvVarStatusWidget />);
    expect(screen.getByText("overview failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dashboard.widgets.retry" })).toBeInTheDocument();
  });
});
