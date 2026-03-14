import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroDetailPage } from "./wsl-distro-detail-page";

const mockRouterPush = jest.fn();
const mockIsTauri = jest.fn(() => false);

const mockUseWslData = {
  available: null as boolean | null,
  distros: [] as Array<{ name: string; state: string; wslVersion: string; isDefault: boolean }>,
  capabilities: null as Record<string, boolean | string> | null,
  status: null,
  loading: false,
  error: null as string | null,
  checkAvailability: jest.fn().mockResolvedValue(true),
  getCapabilities: jest.fn().mockResolvedValue(null),
  refreshDistros: jest.fn().mockResolvedValue(undefined),
  refreshStatus: jest.fn().mockResolvedValue(undefined),
  terminate: jest.fn().mockResolvedValue(undefined),
  launch: jest.fn().mockResolvedValue(undefined),
  setDefault: jest.fn().mockResolvedValue(undefined),
  setVersion: jest.fn().mockResolvedValue(undefined),
  exportDistro: jest.fn().mockResolvedValue(undefined),
  execCommand: jest.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
  setSparse: jest.fn().mockResolvedValue(undefined),
  moveDistro: jest.fn().mockResolvedValue(""),
  resizeDistro: jest.fn().mockResolvedValue(""),
  getDistroConfig: jest.fn().mockResolvedValue(null),
  setDistroConfigValue: jest.fn().mockResolvedValue(undefined),
  getIpAddress: jest.fn().mockResolvedValue(""),
  changeDefaultUser: jest.fn().mockResolvedValue(undefined),
  detectDistroEnv: jest.fn().mockResolvedValue(null),
  getDiskUsage: jest.fn().mockResolvedValue(null),
  listUsers: jest.fn().mockResolvedValue([]),
  getDistroResources: jest.fn().mockResolvedValue(null),
  updateDistroPackages: jest.fn().mockResolvedValue({ packageManager: "apt", command: "", stdout: "", stderr: "", exitCode: 0 }),
  openInExplorer: jest.fn().mockResolvedValue(undefined),
  openInTerminal: jest.fn().mockResolvedValue(undefined),
  cloneDistro: jest.fn().mockResolvedValue(""),
  unregisterDistro: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue({ status: "healthy", issues: [], checkedAt: "2026-03-05T00:00:00Z" }),
  listPortForwards: jest.fn().mockResolvedValue([]),
  addPortForward: jest.fn().mockResolvedValue(undefined),
  removePortForward: jest.fn().mockResolvedValue(undefined),
  getAssistanceActions: jest.fn().mockReturnValue([
    {
      id: "distro.preflight",
      scope: "distro",
      category: "check",
      risk: "safe",
      labelKey: "wsl.assistance.actions.distroPreflight.label",
      descriptionKey: "wsl.assistance.actions.distroPreflight.desc",
      supported: true,
    },
    {
      id: "distro.relaunch",
      scope: "distro",
      category: "repair",
      risk: "high",
      labelKey: "wsl.assistance.actions.distroRelaunch.label",
      descriptionKey: "wsl.assistance.actions.distroRelaunch.desc",
      supported: true,
    },
  ]),
  executeAssistanceAction: jest.fn().mockResolvedValue({
    actionId: "distro.preflight",
    status: "success",
    timestamp: "2026-03-05T00:00:00Z",
    title: "Preflight passed",
    findings: ["Runtime Availability: WSL runtime is available."],
    recommendations: [],
    retryable: true,
  }),
  mapErrorToAssistance: jest.fn().mockReturnValue([]),
};

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "wsl.title": "WSL",
        "wsl.notAvailable": "WSL is not available",
        "wsl.running": "Running",
        "wsl.stopped": "Stopped",
        "wsl.launch": "Launch",
        "wsl.terminate": "Terminate",
        "wsl.setDefault": "Set Default",
        "wsl.changeDefaultUser": "Change User",
        "wsl.export": "Export",
        "wsl.openInExplorer": "Open in Explorer",
        "wsl.openInTerminal": "Open in Terminal",
        "wsl.clone": "Clone",
        "wsl.unregister": "Unregister",
        "wsl.detail.tabOverview": "Overview",
        "wsl.detail.tabTerminal": "Terminal",
        "wsl.detail.tabFilesystem": "Filesystem",
        "wsl.detail.tabNetwork": "Network",
        "wsl.detail.tabServices": "Services",
        "wsl.detail.healthCheckRun": "Run Check",
        "wsl.detail.healthCheckRunning": "Checking...",
        "wsl.detail.healthCheckedAt": "Checked at:",
        "wsl.detail.healthNoIssues": "No issues detected.",
        "wsl.detail.healthCheckFailed": "Health check failed: {error}",
        "wsl.detail.healthCheckRetry": "Retry Check",
        "wsl.detail.notFound": "Distribution {name} not found",
        "wsl.manageOps": "Management Operations",
        "wsl.manageOpsDesc": "Advanced distro management",
        "wsl.assistance.title": "Assistance",
        "wsl.assistance.desc": "Guided checks, repairs, and maintenance",
        "wsl.assistance.distroDesc": "Contextual assistance for this distro",
        "wsl.assistance.blocked": "Assistance action blocked",
        "wsl.assistance.retry": "Retry",
        "wsl.assistance.dismiss": "Dismiss",
        "wsl.assistance.returnToError": "Return to error context",
        "wsl.assistance.suggestedActions": "Suggested recovery actions",
        "wsl.assistance.groups.check": "Checks",
        "wsl.assistance.groups.repair": "Repairs",
        "wsl.assistance.groups.maintenance": "Maintenance",
        "wsl.assistance.actions.distroPreflight.label": "Distro Preflight",
        "wsl.assistance.actions.distroPreflight.desc": "Validate distro readiness",
        "wsl.assistance.actions.distroRelaunch.label": "Relaunch Distro",
        "wsl.assistance.actions.distroRelaunch.desc": "Restart distro runtime",
        "wsl.move": "Move",
        "wsl.resize": "Resize",
        "wsl.workflow.running": "Running {action}",
        "wsl.workflow.success": "{action} completed",
        "wsl.workflow.failed": "{action} failed",
        "wsl.workflow.continue": "Continue workflow",
        "wsl.detail.returnToOverview": "Return to overview",
        "wsl.detail.returnToSidebar": "Return to sidebar workflow",
        "wsl.detail.returnToWidget": "Return to widget entry",
        "wsl.detail.returnToAssistance": "Return to assistance flow",
        "wsl.setSparseEnable": "Enable Sparse",
        "wsl.setSparseDisable": "Disable Sparse",
        "common.refresh": "Refresh",
        "common.cancel": "Cancel",
        "common.confirm": "Confirm",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/hooks/use-wsl", () => ({
  useWsl: () => mockUseWslData,
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("WslDistroDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockUseWslData.available = null;
    mockUseWslData.distros = [];
    mockUseWslData.capabilities = null;
    mockUseWslData.loading = false;
    mockUseWslData.error = null;
    mockUseWslData.getAssistanceActions.mockReturnValue([
      {
        id: "distro.preflight",
        scope: "distro",
        category: "check",
        risk: "safe",
        labelKey: "wsl.assistance.actions.distroPreflight.label",
        descriptionKey: "wsl.assistance.actions.distroPreflight.desc",
        supported: true,
      },
      {
        id: "distro.relaunch",
        scope: "distro",
        category: "repair",
        risk: "high",
        labelKey: "wsl.assistance.actions.distroRelaunch.label",
        descriptionKey: "wsl.assistance.actions.distroRelaunch.desc",
        supported: true,
      },
    ]);
    mockUseWslData.mapErrorToAssistance.mockReturnValue([]);
  });

  it("renders non-Tauri fallback with alert", () => {
    render(<WslDistroDetailPage distroName="Ubuntu" />);
    expect(screen.getByText("WSL is not available")).toBeInTheDocument();
  });

  describe("when in Tauri", () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
    });

    it("shows loading skeleton when available is null", () => {
      mockUseWslData.available = null;
      const { container } = render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(container).toBeInTheDocument();
      expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    });

    it("shows distro not found alert when distro is missing", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Debian", state: "Running", wslVersion: "2", isDefault: true },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText(/Distribution.*not found/)).toBeInTheDocument();
    });

    it("renders tabs when distro is found", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText("Overview")).toBeInTheDocument();
      expect(screen.getByText("Terminal")).toBeInTheDocument();
      expect(screen.getByText("Filesystem")).toBeInTheDocument();
      expect(screen.getByText("Network")).toBeInTheDocument();
      expect(screen.getByText("Services")).toBeInTheDocument();
    });

    it("renders distro name in header", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getAllByText("Ubuntu").length).toBeGreaterThanOrEqual(1);
    });

    it("shows Terminate button for running distro", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText("Terminate")).toBeInTheDocument();
      expect(screen.queryByText("Launch")).not.toBeInTheDocument();
    });

    it("shows Launch button for stopped distro", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText("Launch")).toBeInTheDocument();
      expect(screen.queryByText("Terminate")).not.toBeInTheDocument();
    });

    it("shows Running badge and WSL version", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      // Multiple "Running" elements may exist (header badge + overview)
      expect(screen.getAllByText("Running").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("WSL 2").length).toBeGreaterThanOrEqual(1);
    });

    it("shows management operations section", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText("Management Operations")).toBeInTheDocument();
      expect(screen.getByText("Move")).toBeInTheDocument();
      expect(screen.getByText("Resize")).toBeInTheDocument();
    });

    it("shows error alert when error exists", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: false },
      ];
      mockUseWslData.error = "Something went wrong";
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("shows Export and Unregister action buttons", async () => {
      const user = userEvent.setup();
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      const menuButton = screen
        .getAllByRole("button")
        .find(
          (button) =>
            button.getAttribute("data-size") === "icon" &&
            button.getAttribute("data-variant") === "outline" &&
            (button.textContent ?? "").trim() === "",
        );
      expect(menuButton).toBeTruthy();
      await user.click(menuButton!);
      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(screen.getByText("Unregister")).toBeInTheDocument();
      expect(screen.getByText("Open in Explorer")).toBeInTheDocument();
      expect(screen.getByText("Open in Terminal")).toBeInTheDocument();
    });

    it("shows Set Default button for non-default distro", async () => {
      const user = userEvent.setup();
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      const menuButton = screen
        .getAllByRole("button")
        .find(
          (button) =>
            button.getAttribute("data-size") === "icon" &&
            button.getAttribute("data-variant") === "outline" &&
            (button.textContent ?? "").trim() === "",
        );
      expect(menuButton).toBeTruthy();
      await user.click(menuButton!);
      expect(screen.getByText("Set Default")).toBeInTheDocument();
    });

    it("hides Set Default button for default distro", async () => {
      const user = userEvent.setup();
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: true },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      const menuButton = screen
        .getAllByRole("button")
        .find(
          (button) =>
            button.getAttribute("data-size") === "icon" &&
            button.getAttribute("data-variant") === "outline" &&
            (button.textContent ?? "").trim() === "",
        );
      expect(menuButton).toBeTruthy();
      await user.click(menuButton!);
      expect(screen.queryByText("Set Default")).not.toBeInTheDocument();
    });

    it("shows Change User button", async () => {
      const user = userEvent.setup();
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      const menuButton = screen
        .getAllByRole("button")
        .find(
          (button) =>
            button.getAttribute("data-size") === "icon" &&
            button.getAttribute("data-variant") === "outline" &&
            (button.textContent ?? "").trim() === "",
        );
      expect(menuButton).toBeTruthy();
      await user.click(menuButton!);
      expect(screen.getByText("Change User")).toBeInTheDocument();
    });

    it("shows sparse enable/disable buttons", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText("Enable Sparse")).toBeInTheDocument();
      expect(screen.getByText("Disable Sparse")).toBeInTheDocument();
    });

    it("runs health check from management operations", async () => {
      const user = userEvent.setup();
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      await user.click(screen.getByText("Run Check"));
      expect(mockUseWslData.healthCheck).toHaveBeenCalledWith("Ubuntu");
    });

    it("renders distro assistance section and executes safe assistance action", async () => {
      const user = userEvent.setup();
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByTestId("wsl-distro-assistance-section")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Distro Preflight/i }));
      expect(mockUseWslData.executeAssistanceAction).toHaveBeenCalledWith("distro.preflight", "distro", "Ubuntu");
    });

    it("requires confirmation for high-risk assistance action", async () => {
      const user = userEvent.setup();
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);

      await user.click(screen.getByRole("button", { name: /Relaunch Distro/i }));
      expect(screen.getAllByText("Restart distro runtime").length).toBeGreaterThan(0);

      await user.click(screen.getByRole("button", { name: "Confirm" }));
      expect(mockUseWslData.executeAssistanceAction).toHaveBeenCalledWith("distro.relaunch", "distro", "Ubuntu");
    });

    it("renders return link with provided workflow context", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];

      render(
        <WslDistroDetailPage
          distroName="Ubuntu"
          returnTo="/wsl?tab=available"
          origin="sidebar"
        />
      );

      expect(screen.getByRole("link", { name: "Return to sidebar workflow" })).toHaveAttribute(
        "href",
        "/wsl?tab=available"
      );
    });

    it("shows lifecycle feedback after launching distro", async () => {
      const user = userEvent.setup();
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: false },
      ];

      render(<WslDistroDetailPage distroName="Ubuntu" />);
      await user.click(screen.getByRole("button", { name: "Launch" }));

      expect(screen.getByTestId("wsl-distro-lifecycle-feedback")).toBeInTheDocument();
      expect(screen.getByText("Launch completed")).toBeInTheDocument();
    });
  });
});
