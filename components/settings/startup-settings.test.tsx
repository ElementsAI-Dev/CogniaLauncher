import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StartupSettings } from "./startup-settings";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.startup": "Startup",
    "settings.startupDesc": "Startup checks and scans",
    "settings.startupScanEnvironments": "Scan Environments on Startup",
    "settings.startupScanEnvironmentsDesc": "Scan environments at startup",
    "settings.startupScanPackages": "Scan Packages on Startup",
    "settings.startupScanPackagesDesc": "Scan packages at startup",
    "settings.startupMaxConcurrentScans": "Max Concurrent Scans",
    "settings.startupMaxConcurrentScansDesc": "Maximum startup scans",
    "settings.startupTimeoutSecs": "Startup Timeout (sec)",
    "settings.startupTimeoutSecsDesc": "Timeout for startup scan process",
    "settings.startupIntegrityCheck": "Startup Integrity Check",
    "settings.startupIntegrityCheckDesc": "Validate startup state",
  };
  return translations[key] || key;
};

describe("StartupSettings", () => {
  const defaultProps = {
    localConfig: {
      "startup.scan_environments": "true",
      "startup.scan_packages": "false",
      "startup.max_concurrent_scans": "4",
      "startup.startup_timeout_secs": "45",
      "startup.integrity_check": "true",
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders startup setting controls", () => {
    render(<StartupSettings {...defaultProps} />);

    expect(screen.getByText("Scan Environments on Startup")).toBeInTheDocument();
    expect(screen.getByText("Scan Packages on Startup")).toBeInTheDocument();
    expect(screen.getByText("Max Concurrent Scans")).toBeInTheDocument();
    expect(screen.getByText("Startup Timeout (sec)")).toBeInTheDocument();
    expect(screen.getByText("Startup Integrity Check")).toBeInTheDocument();
  });

  it("uses default values when config keys are missing", () => {
    render(<StartupSettings {...defaultProps} localConfig={{}} />);

    const switches = screen.getAllByRole("switch");
    const inputs = screen.getAllByRole("spinbutton");

    expect(switches[0]).toBeChecked();
    expect(switches[1]).toBeChecked();
    expect(switches[2]).toBeChecked();
    expect(inputs[0]).toHaveValue(6);
    expect(inputs[1]).toHaveValue(30);
  });

  it("propagates toggle changes", () => {
    const onValueChange = jest.fn();
    render(<StartupSettings {...defaultProps} onValueChange={onValueChange} />);

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.click(switches[2]);

    expect(onValueChange).toHaveBeenCalledWith("startup.scan_environments", "false");
    expect(onValueChange).toHaveBeenCalledWith("startup.scan_packages", "true");
    expect(onValueChange).toHaveBeenCalledWith("startup.integrity_check", "false");
  });

  it("propagates numeric field changes", () => {
    const onValueChange = jest.fn();
    render(<StartupSettings {...defaultProps} onValueChange={onValueChange} />);

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "8" } });
    fireEvent.change(inputs[1], { target: { value: "60" } });

    expect(onValueChange).toHaveBeenCalledWith("startup.max_concurrent_scans", "8");
    expect(onValueChange).toHaveBeenCalledWith("startup.startup_timeout_secs", "60");
  });

  it("renders validation errors for numeric inputs", () => {
    render(
      <StartupSettings
        {...defaultProps}
        errors={{
          "startup.max_concurrent_scans": "Value must be between 1 and 16",
          "startup.startup_timeout_secs": "Value must be between 5 and 120",
        }}
      />,
    );

    expect(screen.getByText("Value must be between 1 and 16")).toBeInTheDocument();
    expect(screen.getByText("Value must be between 5 and 120")).toBeInTheDocument();
  });
});
