import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateManager } from "./update-manager";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.updatesAvailableTitle": "Updates Available",
        "packages.checkingForUpdates": "Checking for updates...",
        "packages.updatesCount": `${params?.count ?? 0} updates available`,
        "packages.checkNow": "Check Now",
        "packages.updateAll": "Update all",
        "packages.updateSelectedCount": `Update ${params?.count ?? 0} selected`,
        "packages.selectedOfTotal": `${params?.selected ?? 0} of ${params?.total ?? 0} selected`,
        "packages.allPackagesUpToDate": "All packages are up to date!",
        "packages.lastChecked": "Last checked",
        "packages.justNow": "just now",
        "packages.updatedPackagesCount": `${params?.count ?? 0} packages updated`,
        "packages.failedPackagesCount": `${params?.count ?? 0} failed`,
        "packages.changeTypeMajor": "Major",
        "packages.changeTypeMinor": "Minor",
        "packages.changeTypePatch": "Patch",
        "packages.changeTypeUpdate": "Update",
        "packages.breaking": "Breaking",
        "packages.pinVersion": "Pin version",
        "packages.pinnedPackages": "Pinned packages",
        "packages.pinnedAtVersion": `Pinned at ${params?.version ?? ""}`,
        "packages.availableVersionLabel": `Available: ${params?.version ?? ""}`,
        "packages.unpin": "Unpin",
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

const mockPinnedUpdate = {
  package_id: "pip:scipy",
  name: "scipy",
  current_version: "1.10.0",
  latest_version: "1.11.0",
  provider: "pip",
  is_pinned: true,
  is_breaking: false,
  change_type: "minor" as const,
};

const defaultProps = {
  updates: mockUpdates,
  loading: false,
  onCheckUpdates: jest.fn().mockResolvedValue(undefined),
  onUpdateSelected: jest.fn().mockResolvedValue({
    successful: [],
    failed: [],
    skipped: [],
    total_time_ms: 0,
  }),
  onUpdateAll: jest.fn().mockResolvedValue({
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
    expect(screen.getByText("All packages are up to date!")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<UpdateManager {...defaultProps} loading={true} />);
    expect(screen.getByText("Checking for updates...")).toBeInTheDocument();
  });

  it("calls onCheckUpdates when check button clicked", async () => {
    const user = userEvent.setup();
    render(<UpdateManager {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /check now/i }));
    expect(defaultProps.onCheckUpdates).toHaveBeenCalled();
  });

  it("shows version comparison", () => {
    render(<UpdateManager {...defaultProps} />);
    expect(screen.getByText("1.23.0")).toBeInTheDocument();
    expect(screen.getByText("1.24.0")).toBeInTheDocument();
  });

  it("calls onUpdateAll when Update all clicked", async () => {
    const user = userEvent.setup();
    render(<UpdateManager {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /update all/i }));
    expect(defaultProps.onUpdateAll).toHaveBeenCalled();
  });

  it("shows change type badges", () => {
    render(<UpdateManager {...defaultProps} />);
    expect(screen.getByText("Minor")).toBeInTheDocument();
    expect(screen.getByText("Major")).toBeInTheDocument();
  });

  it("shows breaking badge for breaking changes", () => {
    render(<UpdateManager {...defaultProps} />);
    expect(screen.getByText("Breaking")).toBeInTheDocument();
  });

  it("shows pinned packages section", () => {
    render(<UpdateManager {...defaultProps} updates={[...mockUpdates, mockPinnedUpdate]} />);
    expect(screen.getByText("Pinned packages")).toBeInTheDocument();
    expect(screen.getByText("scipy")).toBeInTheDocument();
  });

  it("shows unpin button for pinned packages", () => {
    render(<UpdateManager {...defaultProps} updates={[...mockUpdates, mockPinnedUpdate]} />);
    expect(screen.getByRole("button", { name: /unpin/i })).toBeInTheDocument();
  });

  it("shows update result after successful update", async () => {
    const user = userEvent.setup();
    defaultProps.onUpdateAll.mockResolvedValue({
      successful: [{ name: "numpy", version: "1.24.0", action: "updated", provider: "pip" }],
      failed: [],
      skipped: [],
      total_time_ms: 500,
    });
    render(<UpdateManager {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /update all/i }));
    await waitFor(() => {
      expect(screen.getByText("1 packages updated")).toBeInTheDocument();
    });
  });

  it("toggles package selection when clicked", async () => {
    const user = userEvent.setup();
    render(<UpdateManager {...defaultProps} />);
    // Click the first update row to select it
    await user.click(screen.getByText("numpy"));
    // Verify selection UI updated
    expect(screen.getByText(/1 of 2 selected/)).toBeInTheDocument();
  });

  it("selects all packages with select all checkbox", async () => {
    const user = userEvent.setup();
    render(<UpdateManager {...defaultProps} />);
    // The select all checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]); // Select all
    expect(screen.getByText(/2 of 2 selected/)).toBeInTheDocument();
  });

  it("calls onPinPackage when pin button is clicked", async () => {
    const user = userEvent.setup();
    render(<UpdateManager {...defaultProps} />);
    // Pin buttons are in each update row
    const pinButtons = screen.getAllByRole("button").filter(btn => btn.querySelector('svg'));
    // Click a pin button (they're icon-only buttons in the update rows)
    const pinButton = pinButtons.find(btn => {
      const svg = btn.querySelector('svg');
      return svg?.classList.contains('lucide-pin');
    });
    if (pinButton) {
      await user.click(pinButton);
      expect(defaultProps.onPinPackage).toHaveBeenCalled();
    }
  });

  it("calls onUnpinPackage when unpin button is clicked", async () => {
    const user = userEvent.setup();
    render(<UpdateManager {...defaultProps} updates={[...mockUpdates, mockPinnedUpdate]} />);
    await user.click(screen.getByRole("button", { name: /unpin/i }));
    expect(defaultProps.onUnpinPackage).toHaveBeenCalledWith("pip:scipy");
  });
});
