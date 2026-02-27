import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroNetwork } from "./wsl-distro-network";
import type { WslExecResult } from "@/types/tauri";

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(() => Promise.resolve()),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "wsl.detail.networkInfo": "Network Info",
    "wsl.detail.networkNotRunning": "Distro is not running",
    "wsl.detail.hostname": "Hostname",
    "wsl.detail.networkInterfaces": "Network Interfaces",
    "wsl.detail.listeningPorts": "Listening Ports",
    "wsl.detail.noPorts": "No listening ports",
    "wsl.detail.portProtocol": "Protocol",
    "wsl.detail.portAddress": "Address",
    "wsl.detail.portNumber": "Port",
    "wsl.detail.portProcess": "Process",
    "wsl.ipAddress": "IP Address",
    "common.refresh": "Refresh",
    "common.copy": "Copy",
    "common.copied": "Copied",
  };
  return translations[key] || key;
};

describe("WslDistroNetwork", () => {
  const defaultOnExec = jest.fn<Promise<WslExecResult>, [string, string, string?]>();
  const defaultGetIp = jest.fn<Promise<string>, [string?]>();

  const defaultProps = {
    distroName: "Ubuntu",
    isRunning: false,
    getIpAddress: defaultGetIp,
    onExec: defaultOnExec,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    defaultGetIp.mockResolvedValue("172.20.0.5");
    defaultOnExec.mockImplementation((_distro: string, cmd: string) => {
      if (cmd.includes("hostname")) {
        return Promise.resolve({ exitCode: 0, stdout: "ubuntu-wsl\n", stderr: "" });
      }
      if (cmd.includes("nameserver")) {
        return Promise.resolve({ exitCode: 0, stdout: "8.8.8.8\n8.8.4.4\n", stderr: "" });
      }
      if (cmd.includes("ss ")) {
        // ss output: State Recv-Q Send-Q Local_Address:Port Peer_Address:Port Process
        // parts[3] = Local_Address:Port
        return Promise.resolve({ exitCode: 0, stdout: "LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:((\"sshd\",pid=42,fd=3))\n", stderr: "" });
      }
      if (cmd.includes("ip addr")) {
        return Promise.resolve({
          exitCode: 0,
          stdout: "1: lo: <LOOPBACK>\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST>\n    link/ether 00:15:5d:a0:b1:c2\n    inet 172.20.0.5/20\n    inet6 fe80::1/64\n",
          stderr: "",
        });
      }
      return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
    });
  });

  it("renders title", () => {
    render(<WslDistroNetwork {...defaultProps} />);
    expect(screen.getByText("Network Info")).toBeInTheDocument();
  });

  it("shows not running message when isRunning is false", () => {
    render(<WslDistroNetwork {...defaultProps} />);
    expect(screen.getByText("Distro is not running")).toBeInTheDocument();
  });

  it("auto-loads network info when isRunning is true", async () => {
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(defaultGetIp).toHaveBeenCalledWith("Ubuntu");
      expect(defaultOnExec).toHaveBeenCalled();
    });
  });

  it("displays hostname after loading", async () => {
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("ubuntu-wsl")).toBeInTheDocument();
    });
  });

  it("displays IP address after loading", async () => {
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("172.20.0.5")).toBeInTheDocument();
    });
  });

  it("displays DNS badges", async () => {
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("8.8.8.8")).toBeInTheDocument();
      expect(screen.getByText("8.8.4.4")).toBeInTheDocument();
    });
  });

  it("displays network interfaces", async () => {
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("eth0")).toBeInTheDocument();
      expect(screen.getByText("00:15:5d:a0:b1:c2")).toBeInTheDocument();
    });
  });

  it("displays listening ports table", async () => {
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("Listening Ports")).toBeInTheDocument();
    });
  });

  it("shows no ports message when no ports are listening", async () => {
    defaultOnExec.mockImplementation((_d: string, cmd: string) => {
      if (cmd.includes("ss ")) {
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
      if (cmd.includes("ip addr")) {
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
    });
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("No listening ports")).toBeInTheDocument();
    });
  });

  it("handles gracefully when getIpAddress rejects", async () => {
    defaultGetIp.mockRejectedValue(new Error("no ip"));
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      // Should still load hostname and other info without crashing
      expect(screen.getByText("ubuntu-wsl")).toBeInTheDocument();
    });
    // IP should show dash since it failed
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("refresh button triggers reload", async () => {
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);
    await waitFor(() => {
      expect(screen.getByText("ubuntu-wsl")).toBeInTheDocument();
    });
    // Clear and click refresh
    jest.clearAllMocks();
    defaultGetIp.mockResolvedValue("172.20.0.5");
    defaultOnExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    // Refresh button is inside a Tooltip; find by the icon button
    const refreshBtns = screen.getAllByRole("button");
    await userEvent.click(refreshBtns[0]);
    await waitFor(() => {
      expect(defaultGetIp).toHaveBeenCalled();
    });
  });
});
