import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkSettings } from "./network-settings";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.network": "Network",
    "settings.networkDesc": "Network and proxy settings",
    "settings.timeout": "Timeout",
    "settings.timeoutDesc": "Request timeout in seconds",
    "settings.retries": "Retries",
    "settings.retriesDesc": "Number of retry attempts",
    "settings.proxy": "Proxy",
    "settings.proxyDesc": "HTTP proxy URL (leave empty to disable)",
  };
  return translations[key] || key;
};

describe("NetworkSettings", () => {
  const defaultProps = {
    localConfig: {
      "network.timeout": "30",
      "network.retries": "3",
      "network.proxy": "",
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

    const proxyInput = screen.getByRole("textbox");
    fireEvent.change(proxyInput, {
      target: { value: "http://proxy.example.com" },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      "network.proxy",
      "http://proxy.example.com",
    );
  });

  it("should display validation errors for proxy", () => {
    const errors = {
      "network.proxy": "Invalid proxy URL format",
    };
    render(<NetworkSettings {...defaultProps} errors={errors} />);

    expect(screen.getByText("Invalid proxy URL format")).toBeInTheDocument();
  });
});
