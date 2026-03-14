import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroConfigCard } from "./wsl-distro-config-card";
import type { WslDistroConfig } from "@/types/tauri";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "wsl.distroConfig.title": "Distribution Config",
    "wsl.distroConfig.restartNote": "Changes require restart.",
    "wsl.distroConfig.systemd": "Systemd",
    "wsl.distroConfig.systemdDesc": "Enable systemd init",
    "wsl.distroConfig.automount": "Automount",
    "wsl.distroConfig.automountDesc": "Auto-mount Windows drives",
    "wsl.distroConfig.automountRoot": "Mount root",
    "wsl.distroConfig.automountRootDesc": "Root dir",
    "wsl.distroConfig.automountOptions": "Mount options",
    "wsl.distroConfig.automountOptionsDesc": "DrvFs options",
    "wsl.distroConfig.generateHosts": "Generate hosts",
    "wsl.distroConfig.generateHostsDesc": "Generate /etc/hosts",
    "wsl.distroConfig.generateResolvConf": "Generate resolv.conf",
    "wsl.distroConfig.generateResolvConfDesc": "Generate resolv.conf",
    "wsl.distroConfig.hostname": "Hostname",
    "wsl.distroConfig.hostnameDesc": "Custom hostname",
    "wsl.distroConfig.interop": "Interop",
    "wsl.distroConfig.interopDesc": "Enable Windows interop",
    "wsl.distroConfig.appendWindowsPath": "Append Windows PATH",
    "wsl.distroConfig.appendWindowsPathDesc": "Add Windows PATH",
    "wsl.distroConfig.gpuEnabled": "GPU passthrough",
    "wsl.distroConfig.gpuEnabledDesc": "GPU access",
    "wsl.distroConfig.useWindowsTimezone": "Windows timezone",
    "wsl.distroConfig.useWindowsTimezoneDesc": "Sync timezone",
    "wsl.config.sectionLabel": "Section",
    "wsl.config.keyLabel": "Key",
    "wsl.config.valueLabel": "Value",
    "wsl.config.keyPlaceholder": "Key",
    "wsl.config.valuePlaceholder": "Value",
    "wsl.config.validation.sectionRequired": "Section is required.",
    "wsl.config.validation.keyRequired": "Key is required.",
    "wsl.config.validation.valueRequired": "Value is required.",
    "wsl.config.validation.invalidSection": "Section can contain only letters, numbers, ., _, and -.",
    "wsl.config.validation.invalidKey": "Key can contain only letters, numbers, ., _, and -.",
    "wsl.config.validation.duplicateKey": "Key already exists in this section.",
    "common.add": "Add",
    "common.delete": "Delete",
    "common.refresh": "Refresh",
  };
  return translations[key] || key;
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
      expect(screen.getAllByText(/Distribution Config/).length).toBeGreaterThan(0);
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
      // 10 boolean quick settings: systemd, automount, generateHosts, generateResolvConf,
      // interop, appendWindowsPath, gpuEnabled, useWindowsTimezone, mountFsTab, protectBinfmt
      expect(switches).toHaveLength(10);
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
      expect(screen.getAllByRole("switch")).toHaveLength(10);
    });
    // Toggle systemd (currently false → true)
    await userEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => {
      expect(mockSetConfig).toHaveBeenCalledWith("Ubuntu", "boot", "systemd", "true");
    });
  });

  it("renders custom entries from config", async () => {
    // generateHosts is now a quick setting, so use a truly custom key for testing
    const configWithCustom: WslDistroConfig = {
      boot: { systemd: "true" },
      network: { customDns: "8.8.8.8" },
    };
    const props = {
      ...defaultProps,
      getDistroConfig: jest.fn(() => Promise.resolve(configWithCustom)),
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      expect(screen.getByText("customDns")).toBeInTheDocument();
      expect(screen.getByText("8.8.8.8")).toBeInTheDocument();
      expect(screen.getByText("[network]")).toBeInTheDocument();
    });
  });

  it("add button is disabled when key is empty", async () => {
    render(<WslDistroConfigCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Distribution Config/).length).toBeGreaterThan(0);
    });
    // The add button (Plus icon) should be disabled when key is empty
    const allBtns = screen.getAllByRole("button");
    const lastBtn = allBtns[allBtns.length - 1];
    expect(lastBtn).toBeDisabled();
  });

  it("uses responsive custom form layout classes", async () => {
    render(<WslDistroConfigCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Distribution Config/).length).toBeGreaterThan(0);
    });

    const form = screen.getByTestId("wsl-distro-config-custom-form");
    expect(form.className).toContain("grid-cols-1");
    expect(form.className).toContain("sm:grid-cols-[minmax(110px,140px)_minmax(0,1fr)_minmax(0,1fr)_auto]");
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
      expect(screen.getAllByText(/Distribution Config/).length).toBeGreaterThan(0);
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

  it("blocks invalid custom key before calling setDistroConfigValue", async () => {
    const mockSetConfig = jest.fn(() => Promise.resolve());
    const props = {
      ...defaultProps,
      setDistroConfigValue: mockSetConfig,
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Distribution Config/).length).toBeGreaterThan(0);
    });

    const keyInput = screen.getByPlaceholderText("Key");
    const valueInput = screen.getByPlaceholderText("Value");
    await userEvent.type(keyInput, "bad key");
    await userEvent.type(valueInput, "4GB");

    const addBtns = screen.getAllByRole("button", { name: /add/i });
    const addBtn = addBtns[addBtns.length - 1];
    if (addBtn) {
      await userEvent.click(addBtn);
    }

    expect(mockSetConfig).not.toHaveBeenCalled();
    expect(screen.getByText(/letters, numbers/)).toBeInTheDocument();
  });

  it("blocks duplicate custom key in the same section", async () => {
    const mockSetConfig = jest.fn(() => Promise.resolve());
    const props = {
      ...defaultProps,
      getDistroConfig: jest.fn(() => Promise.resolve({ wsl2: { memory: "4GB" } })),
      setDistroConfigValue: mockSetConfig,
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Distribution Config/).length).toBeGreaterThan(0);
    });

    const keyInput = screen.getByPlaceholderText("Key");
    const valueInput = screen.getByPlaceholderText("Value");
    await userEvent.type(keyInput, "memory");
    await userEvent.type(valueInput, "8GB");

    const addBtns = screen.getAllByRole("button", { name: /add/i });
    const addBtn = addBtns[addBtns.length - 1];
    if (addBtn) {
      await userEvent.click(addBtn);
    }

    expect(mockSetConfig).not.toHaveBeenCalled();
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
  });

  it("submits custom setting on Enter and follows add validation", async () => {
    const mockSetConfig = jest.fn(() => Promise.resolve());
    const props = {
      ...defaultProps,
      setDistroConfigValue: mockSetConfig,
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Distribution Config/).length).toBeGreaterThan(0);
    });

    const keyInput = screen.getByPlaceholderText("Key");
    const valueInput = screen.getByPlaceholderText("Value");
    await userEvent.type(keyInput, "swap");
    await userEvent.type(valueInput, "4GB");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockSetConfig).toHaveBeenCalledWith("Ubuntu", "wsl2", "swap", "4GB");
    });
  });

  it("disables add inputs and button during pending save", async () => {
    let resolveSave: (() => void) | null = null;
    const mockSetConfig = jest.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    const props = {
      ...defaultProps,
      setDistroConfigValue: mockSetConfig,
    };
    render(<WslDistroConfigCard {...props} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Distribution Config/).length).toBeGreaterThan(0);
    });

    const keyInput = screen.getByPlaceholderText("Key");
    const valueInput = screen.getByPlaceholderText("Value");
    await userEvent.type(keyInput, "swap");
    await userEvent.type(valueInput, "4GB");

    const addBtns = screen.getAllByRole("button", { name: /add/i });
    const addBtn = addBtns[addBtns.length - 1];
    if (addBtn) {
      await userEvent.click(addBtn);
      expect(addBtn).toBeDisabled();
    }
    expect(keyInput).toBeDisabled();
    expect(valueInput).toBeDisabled();

    resolveSave?.();
  });
});
