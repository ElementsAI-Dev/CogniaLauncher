import { render, screen } from "@testing-library/react";
import { WslDistroDetailPage } from "./wsl-distro-detail-page";

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
        "wsl.unregister": "Unregister",
        "wsl.detail.tabOverview": "Overview",
        "wsl.detail.tabTerminal": "Terminal",
        "wsl.detail.tabFilesystem": "Filesystem",
        "wsl.detail.tabNetwork": "Network",
        "wsl.detail.tabServices": "Services",
        "wsl.detail.notFound": "Distribution {name} not found",
        "wsl.manageOps": "Management Operations",
        "wsl.manageOpsDesc": "Advanced distro management",
        "wsl.move": "Move",
        "wsl.resize": "Resize",
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
  isTauri: () => false,
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
    mockUseWslData.available = null;
    mockUseWslData.distros = [];
    mockUseWslData.capabilities = null;
    mockUseWslData.loading = false;
    mockUseWslData.error = null;
  });

  it("renders non-Tauri fallback with alert", () => {
    render(<WslDistroDetailPage distroName="Ubuntu" />);
    expect(screen.getByText("WSL is not available")).toBeInTheDocument();
  });

  describe("when in Tauri", () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      jest.spyOn(require("@/lib/tauri"), "isTauri").mockReturnValue(true);
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

    it("shows Export and Unregister action buttons", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(screen.getByText("Unregister")).toBeInTheDocument();
    });

    it("shows Set Default button for non-default distro", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.getByText("Set Default")).toBeInTheDocument();
    });

    it("hides Set Default button for default distro", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: true },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
      expect(screen.queryByText("Set Default")).not.toBeInTheDocument();
    });

    it("shows Change User button", () => {
      mockUseWslData.available = true;
      mockUseWslData.distros = [
        { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: false },
      ];
      render(<WslDistroDetailPage distroName="Ubuntu" />);
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
  });
});
