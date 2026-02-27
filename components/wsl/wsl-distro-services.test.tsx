import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroServices } from "./wsl-distro-services";
import type { WslExecResult } from "@/types/tauri";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "wsl.detail.services": "Services",
    "wsl.detail.servicesNotRunning": "Distro is not running",
    "wsl.detail.noSystemd": "Systemd is not enabled",
    "wsl.detail.searchServices": "Search services...",
    "wsl.detail.noServicesMatch": "No matching services",
    "wsl.detail.noServices": "No services found",
    "wsl.detail.serviceName": "Name",
    "wsl.detail.serviceDesc": "Description",
    "wsl.detail.serviceActions": "Actions",
    "wsl.detail.serviceStart": "Start",
    "wsl.detail.serviceStop": "Stop",
    "wsl.detail.serviceRestart": "Restart",
    "wsl.detail.serviceActionSuccess": "Service {service} {action} succeeded",
    "wsl.running": "running",
    "common.refresh": "Refresh",
  };
  return translations[key] || key;
};

const systemctlOutput = [
  "  ssh.service loaded active running OpenBSD Secure Shell server",
  "  cron.service loaded active running Regular background program processing daemon",
  "  dbus.service loaded active running D-Bus System Message Bus",
  "  snapd.service loaded inactive dead Snap Daemon",
].join("\n");

describe("WslDistroServices", () => {
  const defaultOnExec = jest.fn<Promise<WslExecResult>, [string, string, string?]>();

  const defaultProps = {
    distroName: "Ubuntu",
    isRunning: false,
    onExec: defaultOnExec,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    defaultOnExec.mockImplementation((_d: string, cmd: string) => {
      if (cmd.includes("/proc/1/comm")) {
        return Promise.resolve({ exitCode: 0, stdout: "systemd\n", stderr: "" });
      }
      if (cmd.includes("systemctl list-units")) {
        return Promise.resolve({ exitCode: 0, stdout: systemctlOutput, stderr: "" });
      }
      if (cmd.includes("systemctl")) {
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
    });
  });

  it("renders title", () => {
    render(<WslDistroServices {...defaultProps} />);
    expect(screen.getByText("Services")).toBeInTheDocument();
  });

  it("shows not running message when isRunning is false", () => {
    render(<WslDistroServices {...defaultProps} />);
    expect(screen.getByText("Distro is not running")).toBeInTheDocument();
  });

  it("auto-loads services when isRunning is true", async () => {
    render(<WslDistroServices {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(defaultOnExec).toHaveBeenCalled();
    });
  });

  it("shows no-systemd alert when init is not systemd", async () => {
    defaultOnExec.mockImplementation((_d: string, cmd: string) => {
      if (cmd.includes("/proc/1/comm")) {
        return Promise.resolve({ exitCode: 0, stdout: "init\n", stderr: "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
    });
    render(<WslDistroServices {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("Systemd is not enabled")).toBeInTheDocument();
    });
  });

  it("displays services list with names and descriptions", async () => {
    render(<WslDistroServices {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("ssh")).toBeInTheDocument();
      expect(screen.getByText("cron")).toBeInTheDocument();
      expect(screen.getByText("dbus")).toBeInTheDocument();
    });
  });

  it("displays running count badge", async () => {
    render(<WslDistroServices {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      // 3 running services (ssh, cron, dbus)
      expect(screen.getByText(/3 running/)).toBeInTheDocument();
    });
  });

  it("search filters services", async () => {
    render(<WslDistroServices {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("ssh")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText("Search services...");
    await userEvent.type(searchInput, "ssh");
    await waitFor(() => {
      expect(screen.getByText("ssh")).toBeInTheDocument();
      expect(screen.queryByText("cron")).not.toBeInTheDocument();
    });
  });

  it("shows no match message for search with no results", async () => {
    render(<WslDistroServices {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("ssh")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText("Search services...");
    await userEvent.type(searchInput, "nonexistent");
    await waitFor(() => {
      expect(screen.getByText("No matching services")).toBeInTheDocument();
    });
  });

  it("handles error gracefully when onExec rejects", async () => {
    defaultOnExec.mockRejectedValue(new Error("exec failed"));
    render(<WslDistroServices {...defaultProps} isRunning={true} />);
    // When onExec rejects, catch sets hasSystemd=false but loaded stays false
    // so neither services nor no-systemd alert shows. The component recovers
    // gracefully without crashing.
    await waitFor(() => {
      expect(defaultOnExec).toHaveBeenCalled();
    });
    // Should not crash and should not show services
    expect(screen.queryByText("ssh")).not.toBeInTheDocument();
  });
});
