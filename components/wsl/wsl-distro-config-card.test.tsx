import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroConfigCard } from "./wsl-distro-config-card";
import type { WslDistroConfig } from "@/types/tauri";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "wsl.distroConfig.title": "Distribution Config",
    "wsl.distroConfig.restartNote": "Changes require restart.",
    "wsl.distroConfig.systemd": "Systemd",
    "wsl.distroConfig.systemdDesc": "Enable systemd init",
    "wsl.distroConfig.automount": "Automount",
    "wsl.distroConfig.automountDesc": "Auto-mount Windows drives",
    "wsl.distroConfig.interop": "Interop",
    "wsl.distroConfig.interopDesc": "Enable Windows interop",
    "wsl.config.keyPlaceholder": "Key",
    "wsl.config.valuePlaceholder": "Value",
    "common.delete": "Delete",
  };
  return translations[key] || key;
};

const mockConfigWithCustom: WslDistroConfig = {
  boot: { systemd: "true" },
  automount: { enabled: "true" },
  network: { generateHosts: "false" },
};

describe("WslDistroConfigCard", () => {
  const defaultProps = {
    distroName: "Ubuntu",
    getDistroConfig: jest.fn(() => Promise.resolve(null as WslDistroConfig | null)),
    setDistroConfigValue: jest.fn(() => Promise.resolve()),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading skeleton initially", () => {
    // getDistroConfig never resolves during render
    const props = {
      ...defaultProps,
      getDistroConfig: jest.fn(() => new Promise<WslDistroConfig | null>(() => {})),
    };
    render(<WslDistroConfigCard {...props} />);
    // Skeleton is shown; title should not be visible
    expect(screen.queryByText(/Distribution Config/)).not.toBeInTheDocument();
  });

  it("renders title and restart note after loading", async () => {
    render(<WslDistroConfigCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Distribution Config/)).toBeInTheDocument();
    });
    expect(screen.getByText("Changes require restart.")).toBeInTheDocument();
  });

  it("calls getDistroConfig with distroName on mount", async () => {
    render(<WslDistroConfigCard {...defaultProps} />);
    await waitFor(() => {
      expect(defaultProps.getDistroConfig).toHaveBeenCalledWith("Ubuntu");
    });
  });

  it("renders quick settings labels", async () => {
    render(<WslDistroConfigCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Systemd")).toBeInTheDocument();
      expect(screen.getByText("Automount")).toBeInTheDocument();
      expect(screen.getByText("Interop")).toBeInTheDocument();
    });
  });

  it("renders switches for quick settings", async () => {
    render(<WslDistroConfigCard {...defaultProps} />);
    await waitFor(() => {
      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(3);
    });
  });

  it("switch reflects config value (checked when true)", async () => {
    const props = {
      ...defaultProps,
      getDistroConfig: jest.fn(() => Promise.resolve({ boot: { systemd: "true" } })),
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      const switches = screen.getAllByRole("switch");
      expect(switches[0]).toHaveAttribute("data-state", "checked");
    });
  });

  it("toggle quick setting calls setDistroConfigValue and refreshes", async () => {
    const mockSetConfig = jest.fn(() => Promise.resolve());
    const mockGetConfig = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ boot: { systemd: "true" } });
    const props = {
      ...defaultProps,
      getDistroConfig: mockGetConfig,
      setDistroConfigValue: mockSetConfig,
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      expect(screen.getAllByRole("switch")).toHaveLength(3);
    });
    // Toggle systemd (currently false → true)
    await userEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => {
      expect(mockSetConfig).toHaveBeenCalledWith("Ubuntu", "boot", "systemd", "true");
    });
  });

  it("renders custom entries from config", async () => {
    const props = {
      ...defaultProps,
      getDistroConfig: jest.fn(() => Promise.resolve(mockConfigWithCustom)),
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      expect(screen.getByText("generateHosts")).toBeInTheDocument();
      expect(screen.getByText("false")).toBeInTheDocument();
      expect(screen.getByText("[network]")).toBeInTheDocument();
    });
  });

  it("add button is disabled when key is empty", async () => {
    render(<WslDistroConfigCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Distribution Config/)).toBeInTheDocument();
    });
    // The add button (Plus icon) should be disabled when key is empty
    const allBtns = screen.getAllByRole("button");
    const lastBtn = allBtns[allBtns.length - 1];
    expect(lastBtn).toBeDisabled();
  });

  it("add custom setting calls setDistroConfigValue", async () => {
    const mockSetConfig = jest.fn(() => Promise.resolve());
    const mockGetConfig = jest.fn().mockResolvedValue(null);
    const props = {
      ...defaultProps,
      getDistroConfig: mockGetConfig,
      setDistroConfigValue: mockSetConfig,
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      expect(screen.getByText(/Distribution Config/)).toBeInTheDocument();
    });
    // Fill in custom setting fields
    const inputs = screen.getAllByRole("textbox");
    // Section input (has default "wsl2"), Key input, Value input
    const keyInput = inputs.find((i) => (i as HTMLInputElement).placeholder === "Key");
    const valueInput = inputs.find((i) => (i as HTMLInputElement).placeholder === "Value");
    if (keyInput && valueInput) {
      await userEvent.type(keyInput, "memory");
      await userEvent.type(valueInput, "4GB");
      // Click add button (last button)
      const allBtns = screen.getAllByRole("button");
      const addBtn = allBtns[allBtns.length - 1];
      await userEvent.click(addBtn);
      await waitFor(() => {
        expect(mockSetConfig).toHaveBeenCalledWith("Ubuntu", "wsl2", "memory", "4GB");
      });
    }
  });
});
