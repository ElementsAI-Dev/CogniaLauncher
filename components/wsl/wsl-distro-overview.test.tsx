import { render, screen, waitFor } from "@testing-library/react";
import { WslDistroOverview } from "./wsl-distro-overview";
import type { WslDistroResources } from "@/types/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "wsl.detail.status": "Status",
    "wsl.running": "Running",
    "wsl.stopped": "Stopped",
    "wsl.wslVersion": "WSL Version",
    "wsl.detail.diskUsage": "Disk Usage",
    "wsl.ipAddress": "IP Address",
    "wsl.detail.environment": "Environment",
    "wsl.detail.resources": "Resource Usage",
    "wsl.detail.memory": "Memory",
    "wsl.detail.swap": "Swap",
    "wsl.detail.noSwap": "No swap configured",
    "wsl.detail.cpuLoad": "CPU / Load",
    "wsl.detail.loadAvg": "Load avg",
    "wsl.detail.resourcesFailed": "Could not retrieve resource usage",
    "wsl.detail.packageActions": "Package Management",
    "wsl.detail.pkgUpdate": "Update Index",
    "wsl.detail.pkgUpgrade": "Upgrade Packages",
    "wsl.detail.pkgActionSuccess": "Package {mode} completed ({pm})",
    "wsl.detail.envDetectFailed": "Could not detect environment",
  };
  return translations[key] || key;
};

const mockResources: WslDistroResources = {
  memTotalKb: 8388608,     // 8 GB
  memAvailableKb: 4194304, // 4 GB
  memUsedKb: 4194304,      // 4 GB
  swapTotalKb: 2097152,    // 2 GB
  swapUsedKb: 524288,      // 512 MB
  cpuCount: 4,
  loadAvg: [0.52, 0.34, 0.21],
};

const baseProps = {
  distroName: "Ubuntu",
  getDiskUsage: jest.fn(() => Promise.resolve(null)),
  getIpAddress: jest.fn(() => Promise.resolve("")),
  getDistroConfig: jest.fn(() => Promise.resolve(null)),
  setDistroConfigValue: jest.fn(() => Promise.resolve()),
  detectDistroEnv: jest.fn(() => Promise.resolve(null)),
  t: mockT,
};

describe("WslDistroOverview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing (null distro)", () => {
    const { container } = render(
      <WslDistroOverview {...baseProps} distro={null} />,
    );
    expect(container).toBeInTheDocument();
  });

  it("shows Stopped badge when distro is stopped", () => {
    render(
      <WslDistroOverview
        {...baseProps}
        distro={{ name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: true }}
      />,
    );
    // Badge is the first match; use getAllByText to avoid ambiguity
    const matches = screen.getAllByText("Stopped");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Running badge when distro is running", () => {
    render(
      <WslDistroOverview
        {...baseProps}
        distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
      />,
    );
    const matches = screen.getAllByText("Running");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // Resource monitoring tests
  describe("resource monitoring", () => {
    it("does not render resource card when getDistroResources is not provided", () => {
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
        />,
      );
      expect(screen.queryByText("Resource Usage")).not.toBeInTheDocument();
    });

    it("does not render resource card when distro is stopped", () => {
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: true }}
          getDistroResources={jest.fn(() => Promise.resolve(mockResources))}
        />,
      );
      expect(screen.queryByText("Resource Usage")).not.toBeInTheDocument();
    });

    it("renders resource card when running with getDistroResources", async () => {
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
          getDistroResources={jest.fn(() => Promise.resolve(mockResources))}
        />,
      );
      expect(screen.getByText("Resource Usage")).toBeInTheDocument();
    });

    it("calls getDistroResources on mount for running distro", async () => {
      const mockGetResources = jest.fn(() => Promise.resolve(mockResources));
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
          getDistroResources={mockGetResources}
        />,
      );
      await waitFor(() => {
        expect(mockGetResources).toHaveBeenCalledWith("Ubuntu");
      });
    });

    it("displays memory, swap, and CPU data after loading", async () => {
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
          getDistroResources={jest.fn(() => Promise.resolve(mockResources))}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("Memory")).toBeInTheDocument();
        expect(screen.getByText("Swap")).toBeInTheDocument();
        expect(screen.getByText("CPU / Load")).toBeInTheDocument();
      });
    });

    it("displays cpu count", async () => {
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
          getDistroResources={jest.fn(() => Promise.resolve(mockResources))}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("4 cores")).toBeInTheDocument();
      });
    });

    it("shows no-swap message when swap is 0", async () => {
      const noSwap = { ...mockResources, swapTotalKb: 0, swapUsedKb: 0 };
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
          getDistroResources={jest.fn(() => Promise.resolve(noSwap))}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("No swap configured")).toBeInTheDocument();
      });
    });

    it("shows error message when getDistroResources returns null", async () => {
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
          getDistroResources={jest.fn(() => Promise.resolve(null))}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("Could not retrieve resource usage")).toBeInTheDocument();
      });
    });
  });

  // Package update tests
  describe("package management", () => {
    it("does not render package card when updateDistroPackages is not provided", () => {
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true }}
          detectDistroEnv={jest.fn(() =>
            Promise.resolve({
              distroId: "ubuntu", distroIdLike: ["debian"], prettyName: "Ubuntu 22.04",
              architecture: "x86_64", kernelVersion: "5.15", packageManager: "apt",
              initSystem: "systemd", dockerAvailable: false,
            }),
          )}
        />,
      );
      // Without updateDistroPackages prop, no package card
      expect(screen.queryByText("Package Management")).not.toBeInTheDocument();
    });

    it("does not render package card when distro is stopped", () => {
      render(
        <WslDistroOverview
          {...baseProps}
          distro={{ name: "Ubuntu", state: "Stopped", wslVersion: "2", isDefault: true }}
          updateDistroPackages={jest.fn(() =>
            Promise.resolve({ packageManager: "apt", command: "apt update", stdout: "", stderr: "", exitCode: 0 }),
          )}
        />,
      );
      expect(screen.queryByText("Package Management")).not.toBeInTheDocument();
    });
  });
});
