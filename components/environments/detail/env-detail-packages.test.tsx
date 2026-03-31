import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvDetailPackages } from "./env-detail-packages";

const mockSearchPackages = jest.fn();
const mockFetchInstalledPackages = jest.fn();
const mockInstallPackages = jest.fn();
const mockUninstallPackages = jest.fn();
const mockCheckForUpdates = jest.fn();
const mockConfirmPreflight = jest.fn();
const mockDismissPreflight = jest.fn();
let mockPreflightSummary: null | {
  results: Array<{
    validator_id: string;
    validator_name: string;
    status: "pass" | "warning" | "failure";
    summary: string;
    details: string[];
    remediation: string | null;
    package: string | null;
    provider_id: string | null;
    blocking: boolean;
    timed_out: boolean;
  }>;
  can_proceed: boolean;
  has_warnings: boolean;
  has_failures: boolean;
  checked_at: string;
} = null;
let mockPreflightPackages: string[] = [];
let mockIsPreflightOpen = false;
const mockUsePackagesReturn = {
  installedPackages: [{ name: "typescript", version: "5.0.0", provider: "npm" }],
  searchResults: [] as Array<{ name: string; latest_version?: string; description?: string | null }>,
  loading: false,
  error: null as string | null,
  installing: [] as string[],
  searchPackages: mockSearchPackages,
  fetchInstalledPackages: mockFetchInstalledPackages,
  installPackages: mockInstallPackages,
  uninstallPackages: mockUninstallPackages,
  checkForUpdates: mockCheckForUpdates,
  preflightSummary: mockPreflightSummary,
  preflightPackages: mockPreflightPackages,
  isPreflightOpen: mockIsPreflightOpen,
  confirmPreflight: mockConfirmPreflight,
  dismissPreflight: mockDismissPreflight,
};

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/packages/use-packages", () => ({
  usePackages: () => mockUsePackagesReturn,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const defaultProps = {
  envType: "node",
  t: (key: string) => key,
};

describe("EnvDetailPackages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePackagesReturn.installedPackages = [{ name: "typescript", version: "5.0.0", provider: "npm" }];
    mockUsePackagesReturn.installing = [];
    mockUsePackagesReturn.searchResults = [];
    mockUsePackagesReturn.loading = false;
    mockUsePackagesReturn.error = null;
    mockPreflightSummary = null;
    mockPreflightPackages = [];
    mockIsPreflightOpen = false;
    mockUsePackagesReturn.preflightSummary = null;
    mockUsePackagesReturn.preflightPackages = [];
    mockUsePackagesReturn.isPreflightOpen = false;
    mockCheckForUpdates.mockResolvedValue([
      {
        name: "typescript",
        provider: "npm",
        current_version: "5.0.0",
        latest_version: "5.1.0",
      },
    ]);
  });

  it("checks updates for active provider only", async () => {
    const user = userEvent.setup();
    render(<EnvDetailPackages {...defaultProps} />);

    const checkBtn = screen.getByRole("button", { name: "environments.detail.checkUpdates" });
    await user.click(checkBtn);

    await waitFor(() => {
      expect(mockCheckForUpdates).toHaveBeenCalledWith(["typescript"], {
        providerId: "npm",
        syncStore: false,
      });
    });
  });

  it("uses update provider when installing an update", async () => {
    const user = userEvent.setup();
    render(<EnvDetailPackages {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "environments.detail.checkUpdates" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "environments.detail.updateBtn" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "environments.detail.updateBtn" }));

    expect(mockInstallPackages).toHaveBeenCalledWith(["npm:typescript@5.1.0"]);
  });

  it("renders pre-flight dialog when validation warnings are open", () => {
    mockPreflightSummary = {
      results: [
        {
          validator_id: "provider_health",
          validator_name: "Provider health",
          status: "warning",
          summary: "Provider health check returned warnings.",
          details: ["Provider status is degraded."],
          remediation: "Review provider diagnostics before proceeding.",
          package: "npm:typescript",
          provider_id: "npm",
          blocking: false,
          timed_out: false,
        },
      ],
      can_proceed: true,
      has_warnings: true,
      has_failures: false,
      checked_at: "2026-03-29T00:00:00.000Z",
    };
    mockPreflightPackages = ["npm:typescript"];
    mockIsPreflightOpen = true;
    mockUsePackagesReturn.preflightSummary = mockPreflightSummary;
    mockUsePackagesReturn.preflightPackages = mockPreflightPackages;
    mockUsePackagesReturn.isPreflightOpen = true;

    render(<EnvDetailPackages {...defaultProps} />);

    expect(screen.getByText("packages.preflight.title")).toBeInTheDocument();
    expect(screen.getByText("Provider health check returned warnings.")).toBeInTheDocument();
    expect(screen.getAllByText("npm:typescript").length).toBeGreaterThan(0);
  });

  it("wires pre-flight dialog confirm and cancel actions", async () => {
    const user = userEvent.setup();
    mockPreflightSummary = {
      results: [
        {
          validator_id: "provider_health",
          validator_name: "Provider health",
          status: "warning",
          summary: "Provider health check returned warnings.",
          details: ["Provider status is degraded."],
          remediation: "Review provider diagnostics before proceeding.",
          package: "npm:typescript",
          provider_id: "npm",
          blocking: false,
          timed_out: false,
        },
      ],
      can_proceed: true,
      has_warnings: true,
      has_failures: false,
      checked_at: "2026-03-29T00:00:00.000Z",
    };
    mockPreflightPackages = ["npm:typescript"];
    mockIsPreflightOpen = true;
    mockUsePackagesReturn.preflightSummary = mockPreflightSummary;
    mockUsePackagesReturn.preflightPackages = mockPreflightPackages;
    mockUsePackagesReturn.isPreflightOpen = true;

    render(<EnvDetailPackages {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "packages.preflight.confirm" }));
    expect(mockConfirmPreflight).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "packages.preflight.cancel" }));
    expect(mockDismissPreflight).toHaveBeenCalledTimes(1);
  });
});
