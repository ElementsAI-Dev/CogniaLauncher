import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchOperations } from "./batch-operations";
import type { BatchResult } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "common.install": "Install",
        "common.uninstall": "Uninstall",
        "common.update": "Update",
        "common.cancel": "Cancel",
        "common.clear": "Clear",
        "packages.selected": `${params?.count ?? 0} selected`,
        "packages.dryRun": "Dry run",
        "packages.forceOption": "Force",
        "packages.processing": "Processing...",
        "packages.processingDesc": "Please wait",
        "packages.packagesLabel": "Packages",
        "packages.batchDescription": `${params?.action} ${params?.count} packages`,
        "packages.batchCompleted": `Completed in ${params?.time}s`,
        "packages.successful": "Successful",
        "packages.failed": "Failed",
        "packages.skipped": "Skipped",
        "packages.showDetails": "Show details",
        "packages.preview": "Preview",
        "packages.done": "Done",
        "packages.someOperationsFailed": "Some operations failed",
        "packages.operationsCanRetry": `${params?.count} can be retried`,
        "packages.retryFailed": "Retry Failed",
        "packages.retryPossible": "Recoverable",
      };
      return translations[key] || key;
    },
  }),
}));

const mockBatchResult: BatchResult = {
  successful: [
    {
      name: "package1",
      version: "1.0.0",
      action: "installed",
      provider: "pip",
    },
    {
      name: "package2",
      version: "1.0.0",
      action: "installed",
      provider: "pip",
    },
  ],
  failed: [],
  skipped: [],
  total_time_ms: 1500,
};

const defaultProps = {
  selectedPackages: ["package1", "package2"],
  onBatchInstall: jest.fn().mockResolvedValue(mockBatchResult),
  onBatchUninstall: jest.fn().mockResolvedValue(mockBatchResult),
  onBatchUpdate: jest.fn().mockResolvedValue(mockBatchResult),
  onClearSelection: jest.fn(),
};

describe("BatchOperations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders floating action bar when packages are selected", () => {
    render(<BatchOperations {...defaultProps} />);

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    // Check action buttons exist
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("does not render when no packages selected", () => {
    render(<BatchOperations {...defaultProps} selectedPackages={[]} />);

    expect(screen.queryByText("selected")).not.toBeInTheDocument();
  });

  it("opens install dialog when Install button is clicked", async () => {
    const user = userEvent.setup();
    render(<BatchOperations {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /^install$/i }));

    expect(screen.getByText("Install Packages")).toBeInTheDocument();
    expect(screen.getByText("package1")).toBeInTheDocument();
    expect(screen.getByText("package2")).toBeInTheDocument();
  });

  it("shows dry run and force options in dialog", async () => {
    const user = userEvent.setup();
    render(<BatchOperations {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /^install$/i }));

    expect(screen.getByLabelText("Dry run")).toBeInTheDocument();
    expect(screen.getByLabelText("Force")).toBeInTheDocument();
  });

  it("calls onBatchInstall when install is confirmed", async () => {
    const user = userEvent.setup();
    render(<BatchOperations {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /^install$/i }));

    const dialogInstallButton = screen
      .getAllByRole("button", { name: /install/i })
      .find((btn) => btn.closest('[role="dialog"]'));
    await user.click(dialogInstallButton!);

    await waitFor(() => {
      expect(defaultProps.onBatchInstall).toHaveBeenCalledWith(
        ["package1", "package2"],
        { dryRun: false, force: false },
      );
    });
  });

  it("shows results after operation completes", async () => {
    const user = userEvent.setup();
    render(<BatchOperations {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /^install$/i }));

    const dialogInstallButton = screen
      .getAllByRole("button", { name: /install/i })
      .find((btn) => btn.closest('[role="dialog"]'));
    await user.click(dialogInstallButton!);

    await waitFor(() => {
      // mockBatchResult has 2 successful items
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("Successful")).toBeInTheDocument();
    });
  });

  it("clears selection on clear button click", async () => {
    const user = userEvent.setup();
    render(<BatchOperations {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /clear/i }));

    expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("opens uninstall dialog with correct title", async () => {
    const user = userEvent.setup();
    render(<BatchOperations {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /uninstall/i }));

    expect(screen.getByText("Uninstall Packages")).toBeInTheDocument();
  });

  it("parses provider from package spec correctly", async () => {
    const user = userEvent.setup();
    render(
      <BatchOperations
        {...defaultProps}
        selectedPackages={["pip:numpy", "conda:pandas"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^install$/i }));

    expect(screen.getByText("numpy")).toBeInTheDocument();
    expect(screen.getByText("pip")).toBeInTheDocument();
    expect(screen.getByText("pandas")).toBeInTheDocument();
    expect(screen.getByText("conda")).toBeInTheDocument();
  });
});
