import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateManager } from "./update-manager";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "packages.updates": "Updates",
        "packages.noUpdates": "No updates available",
        "packages.checkForUpdates": "Check for updates",
        "packages.checkNow": "Check Now",
        "packages.updateAll": "Update all",
        "packages.updateSelected": "Update selected",
        "packages.currentVersion": "Current",
        "packages.newVersion": "New",
        "packages.pin": "Pin",
        "packages.unpin": "Unpin",
        "packages.pinnedPackages": "Pinned packages",
        "packages.allPackagesUpToDate": "All packages are up to date!",
        "packages.lastChecked": "Last checked",
        "packages.justNow": "just now",
        "packages.updatesAvailable": "Updates Available",
        "packages.manageUpdates": "Manage package updates",
      };
      return translations[key] || key;
    },
  }),
}));

const mockUpdates = [
  {
    package_id: "pip:numpy",
    name: "numpy",
    current_version: "1.23.0",
    latest_version: "1.24.0",
    provider: "pip",
    is_pinned: false,
    is_breaking: false,
    change_type: "minor" as const,
  },
  {
    package_id: "pip:pandas",
    name: "pandas",
    current_version: "1.5.0",
    latest_version: "2.0.0",
    provider: "pip",
    is_pinned: false,
    is_breaking: true,
    change_type: "major" as const,
  },
];

const defaultProps = {
  updates: mockUpdates,
  loading: false,
  onCheckUpdates: jest.fn().mockResolvedValue(undefined),
  onUpdateSelected: jest
    .fn()
    .mockResolvedValue({
      successful: [],
      failed: [],
      skipped: [],
      total_time_ms: 0,
    }),
  onUpdateAll: jest
    .fn()
    .mockResolvedValue({
      successful: [],
      failed: [],
      skipped: [],
      total_time_ms: 0,
    }),
  onPinPackage: jest.fn().mockResolvedValue(undefined),
  onUnpinPackage: jest.fn().mockResolvedValue(undefined),
};

describe("UpdateManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders update list", () => {
    render(<UpdateManager {...defaultProps} />);
    expect(screen.getByText("numpy")).toBeInTheDocument();
    expect(screen.getByText("pandas")).toBeInTheDocument();
  });

  it("shows no updates message when empty", () => {
    render(<UpdateManager {...defaultProps} updates={[]} />);
    expect(
      screen.getByText("All packages are up to date!"),
    ).toBeInTheDocument();
  });

  it("calls onCheckUpdates when check button clicked", async () => {
    const user = userEvent.setup();
    render(<UpdateManager {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /check now/i }));

    expect(defaultProps.onCheckUpdates).toHaveBeenCalled();
  });

  it("shows version comparison", () => {
    render(<UpdateManager {...defaultProps} />);
    expect(screen.getByText(/1\.23\.0/)).toBeInTheDocument();
    expect(screen.getByText(/1\.24\.0/)).toBeInTheDocument();
  });

  it("calls onUpdateAll when Update all clicked", async () => {
    const user = userEvent.setup();
    render(<UpdateManager {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /update all/i }));

    expect(defaultProps.onUpdateAll).toHaveBeenCalled();
  });
});
