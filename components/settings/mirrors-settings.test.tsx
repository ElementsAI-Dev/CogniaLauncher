import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MirrorsSettings } from "./mirrors-settings";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.mirrors": "Mirrors",
    "settings.mirrorsDesc":
      "Configure package registry mirrors for faster downloads",
    "settings.npmRegistry": "NPM Registry",
    "settings.npmRegistryDesc": "NPM package registry URL",
    "settings.pypiIndex": "PyPI Index",
    "settings.pypiIndexDesc": "Python package index URL",
    "settings.cratesRegistry": "Crates Registry",
    "settings.cratesRegistryDesc": "Rust crates registry URL",
    "settings.goProxy": "Go Proxy",
    "settings.goProxyDesc": "Go module proxy URL",
    "settings.mirrorEnabled": "Enabled",
    "settings.mirrorEnabledDesc": "Use this mirror for requests",
    "settings.mirrorPriority": "Priority",
    "settings.mirrorPriorityDesc": "Higher priority mirrors are preferred",
    "settings.mirrorVerifySsl": "Verify SSL",
    "settings.mirrorVerifySslDesc": "Verify TLS certificates",
  };
  return translations[key] || key;
};

describe("MirrorsSettings", () => {
  const defaultProps = {
    localConfig: {
      "mirrors.npm": "https://registry.npmjs.org",
      "mirrors.npm.enabled": "true",
      "mirrors.npm.priority": "0",
      "mirrors.npm.verify_ssl": "true",
      "mirrors.pypi": "https://pypi.org/simple",
      "mirrors.pypi.enabled": "true",
      "mirrors.pypi.priority": "0",
      "mirrors.pypi.verify_ssl": "true",
      "mirrors.crates": "https://crates.io",
      "mirrors.crates.enabled": "true",
      "mirrors.crates.priority": "0",
      "mirrors.crates.verify_ssl": "true",
      "mirrors.go": "https://proxy.golang.org",
      "mirrors.go.enabled": "true",
      "mirrors.go.priority": "0",
      "mirrors.go.verify_ssl": "true",
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render mirrors settings content", () => {
    render(<MirrorsSettings {...defaultProps} />);

    // Title/description are now provided by parent CollapsibleSection
    expect(screen.getByText("NPM Registry")).toBeInTheDocument();
  });

  it("should render NPM registry setting", () => {
    render(<MirrorsSettings {...defaultProps} />);

    expect(screen.getByText("NPM Registry")).toBeInTheDocument();
    expect(screen.getByText("NPM package registry URL")).toBeInTheDocument();
  });

  it("should render PyPI index setting", () => {
    render(<MirrorsSettings {...defaultProps} />);

    expect(screen.getByText("PyPI Index")).toBeInTheDocument();
  });

  it("should render Go proxy setting", () => {
    render(<MirrorsSettings {...defaultProps} />);

    expect(screen.getByText("Go Proxy")).toBeInTheDocument();
  });

  it("should display current mirror URLs", () => {
    render(<MirrorsSettings {...defaultProps} />);

    expect(screen.getByLabelText("NPM Registry")).toHaveValue(
      "https://registry.npmjs.org",
    );
    expect(screen.getByLabelText("PyPI Index")).toHaveValue(
      "https://pypi.org/simple",
    );
    expect(screen.getByLabelText("Crates Registry")).toHaveValue(
      "https://crates.io",
    );
    expect(screen.getByLabelText("Go Proxy")).toHaveValue(
      "https://proxy.golang.org",
    );
  });

  it("should call onValueChange when NPM registry is changed", () => {
    const onValueChange = jest.fn();
    render(<MirrorsSettings {...defaultProps} onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText("NPM Registry"), {
      target: { value: "https://registry.npmmirror.com" },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      "mirrors.npm",
      "https://registry.npmmirror.com",
    );
  });

  it("should call onValueChange when PyPI index is changed", () => {
    const onValueChange = jest.fn();
    render(<MirrorsSettings {...defaultProps} onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText("PyPI Index"), {
      target: { value: "https://pypi.tuna.tsinghua.edu.cn/simple" },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      "mirrors.pypi",
      "https://pypi.tuna.tsinghua.edu.cn/simple",
    );
  });

  it("should display validation errors for invalid URLs", () => {
    const errors = {
      "mirrors.npm": "Must be a valid URL",
    };
    render(<MirrorsSettings {...defaultProps} errors={errors} />);

    expect(screen.getByText("Must be a valid URL")).toBeInTheDocument();
  });

  it("should render Crates registry setting", () => {
    render(<MirrorsSettings {...defaultProps} />);

    expect(screen.getByText("Crates Registry")).toBeInTheDocument();
    expect(screen.getByLabelText("Crates Registry")).toHaveValue(
      "https://crates.io",
    );
  });

  it("should render advanced options (enabled/priority/verify) for each mirror", () => {
    render(<MirrorsSettings {...defaultProps} />);

    // There are 4 mirrors × 3 advanced options = 12 advanced settings
    // "Enabled" label appears 4 times
    const enabledLabels = screen.getAllByText("Enabled");
    expect(enabledLabels).toHaveLength(4);

    // "Priority" label appears 4 times
    const priorityLabels = screen.getAllByText("Priority");
    expect(priorityLabels).toHaveLength(4);

    // "Verify SSL" label appears 4 times
    const verifySslLabels = screen.getAllByText("Verify SSL");
    expect(verifySslLabels).toHaveLength(4);
  });

  it("should toggle mirror enabled state", () => {
    const onValueChange = jest.fn();
    render(<MirrorsSettings {...defaultProps} onValueChange={onValueChange} />);

    // Find all switches - each mirror has 2 switches (enabled + verify SSL)
    const switches = screen.getAllByRole("switch");
    // First switch is npm enabled
    fireEvent.click(switches[0]);

    expect(onValueChange).toHaveBeenCalledWith(
      "mirrors.npm.enabled",
      "false",
    );
  });

  it("should call onValueChange when Go proxy is changed", () => {
    const onValueChange = jest.fn();
    render(<MirrorsSettings {...defaultProps} onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText("Go Proxy"), {
      target: { value: "https://goproxy.cn" },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      "mirrors.go",
      "https://goproxy.cn",
    );
  });

  it("should use default URLs when config is empty", () => {
    render(<MirrorsSettings {...defaultProps} localConfig={{}} />);

    expect(screen.getByLabelText("NPM Registry")).toHaveValue(
      "https://registry.npmjs.org",
    );
    expect(screen.getByLabelText("PyPI Index")).toHaveValue(
      "https://pypi.org/simple",
    );
    expect(screen.getByLabelText("Crates Registry")).toHaveValue(
      "https://crates.io",
    );
    expect(screen.getByLabelText("Go Proxy")).toHaveValue(
      "https://proxy.golang.org",
    );
  });
});
