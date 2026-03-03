import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvDetailPackages } from "./env-detail-packages";

const mockSearchPackages = jest.fn();
const mockFetchInstalledPackages = jest.fn();
const mockInstallPackages = jest.fn();
const mockUninstallPackages = jest.fn();
const mockCheckForUpdates = jest.fn();
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
};

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-packages", () => ({
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
});
