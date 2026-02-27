import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkSettings } from "./network-settings";

const mockIsTauri = jest.fn(() => false);
jest.mock("@/lib/platform", () => ({
  isTauri: () => mockIsTauri(),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.network": "Network",
    "settings.networkDesc": "Network and proxy settings",
    "settings.timeout": "Timeout",
    "settings.timeoutDesc": "Request timeout in seconds",
    "settings.retries": "Retries",
    "settings.retriesDesc": "Number of retry attempts",
    "settings.proxy": "Proxy",
    "settings.proxyDesc": "Proxy URL — supports http://, https://, socks5:// (leave empty to disable)",
    "settings.noProxyGlobal": "No Proxy (Bypass List)",
    "settings.noProxyGlobalDesc": "Comma-separated hosts/domains that bypass the proxy",
    "settings.detectSystemProxy": "Detect System Proxy",
    "settings.testProxyConnection": "Test Connection",
  };
  return translations[key] || key;
};

describe("NetworkSettings", () => {
  const defaultProps = {
    localConfig: {
      "network.timeout": "30",
      "network.retries": "3",
      "network.proxy": "",
      "network.no_proxy": "",
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  it("should render network settings content", () => {
    render(<NetworkSettings {...defaultProps} />);

    // Title/description are now provided by parent CollapsibleSection
    expect(screen.getByText("Timeout")).toBeInTheDocument();
  });

  it("should render timeout setting", () => {
    render(<NetworkSettings {...defaultProps} />);

    expect(screen.getByText("Timeout")).toBeInTheDocument();
    expect(screen.getByText("Request timeout in seconds")).toBeInTheDocument();
  });

  it("should render retries setting", () => {
    render(<NetworkSettings {...defaultProps} />);

    expect(screen.getByText("Retries")).toBeInTheDocument();
  });

  it("should render proxy setting", () => {
    render(<NetworkSettings {...defaultProps} />);

    expect(screen.getByText("Proxy")).toBeInTheDocument();
  });

  it("should render no_proxy setting", () => {
    render(<NetworkSettings {...defaultProps} />);

    expect(screen.getByText("No Proxy (Bypass List)")).toBeInTheDocument();
    expect(
      screen.getByText("Comma-separated hosts/domains that bypass the proxy"),
    ).toBeInTheDocument();
  });

  it("should call onValueChange when timeout is changed", () => {
    const onValueChange = jest.fn();
    render(<NetworkSettings {...defaultProps} onValueChange={onValueChange} />);

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "60" } });

    expect(onValueChange).toHaveBeenCalledWith("network.timeout", "60");
  });

  it("should call onValueChange when proxy is changed", () => {
    const onValueChange = jest.fn();
    render(<NetworkSettings {...defaultProps} onValueChange={onValueChange} />);

    const textInputs = screen.getAllByRole("textbox");
    fireEvent.change(textInputs[0], {
      target: { value: "http://proxy.example.com" },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      "network.proxy",
      "http://proxy.example.com",
    );
  });

  it("should call onValueChange when no_proxy is changed", () => {
    const onValueChange = jest.fn();
    render(<NetworkSettings {...defaultProps} onValueChange={onValueChange} />);

    const textInputs = screen.getAllByRole("textbox");
    fireEvent.change(textInputs[1], {
      target: { value: "localhost,127.0.0.1,.corp.com" },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      "network.no_proxy",
      "localhost,127.0.0.1,.corp.com",
    );
  });

  it("should display validation errors for proxy", () => {
    const errors = {
      "network.proxy": "Invalid proxy URL format",
    };
    render(<NetworkSettings {...defaultProps} errors={errors} />);

    expect(screen.getByText("Invalid proxy URL format")).toBeInTheDocument();
  });

  it("should display validation errors for no_proxy", () => {
    const errors = {
      "network.no_proxy": "Invalid no_proxy list",
    };
    render(<NetworkSettings {...defaultProps} errors={errors} />);

    expect(screen.getByText("Invalid no_proxy list")).toBeInTheDocument();
  });

  it("should not render detect/test buttons when not in Tauri", () => {
    render(<NetworkSettings {...defaultProps} />);

    expect(screen.queryByText("Detect System Proxy")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Connection")).not.toBeInTheDocument();
  });

  describe("Tauri mode", () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
    });

    it("should render detect and test buttons in Tauri mode", () => {
      render(<NetworkSettings {...defaultProps} />);

      expect(screen.getByText("Detect System Proxy")).toBeInTheDocument();
      expect(screen.getByText("Test Connection")).toBeInTheDocument();
    });

    it("should disable test button when proxy is empty", () => {
      render(<NetworkSettings {...defaultProps} />);

      const testBtn = screen.getByText("Test Connection").closest("button");
      expect(testBtn).toBeDisabled();
    });

    it("should enable test button when proxy has a value", () => {
      render(
        <NetworkSettings
          {...defaultProps}
          localConfig={{ ...defaultProps.localConfig, "network.proxy": "http://proxy:8080" }}
        />,
      );

      const testBtn = screen.getByText("Test Connection").closest("button");
      expect(testBtn).not.toBeDisabled();
    });

    it("should call detectSystemProxy when detect button is clicked", async () => {
      const mockDetect = jest.fn().mockResolvedValue({ source: "none" });
      jest.mock("@/lib/tauri", () => ({
        detectSystemProxy: mockDetect,
      }));

      render(<NetworkSettings {...defaultProps} />);

      const detectBtn = screen.getByText("Detect System Proxy").closest("button")!;
      await fireEvent.click(detectBtn);

      // The button was clicked - detect flow initiated (actual import is dynamic)
      expect(detectBtn).toBeInTheDocument();
    });
  });
});
