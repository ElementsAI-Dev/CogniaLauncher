import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GeneralSettings } from "./general-settings";

// Mock translation function
const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.general": "General",
    "settings.generalDesc": "General application settings",
    "settings.parallelDownloads": "Parallel Downloads",
    "settings.parallelDownloadsDesc": "Number of concurrent downloads",
    "settings.minInstallSpace": "Minimum Install Space",
    "settings.minInstallSpaceDesc": "Minimum free disk space required",
    "settings.metadataCacheTtl": "Metadata Cache TTL",
    "settings.metadataCacheTtlDesc": "Seconds before metadata cache expires",
    "settings.resolveStrategy": "Resolve Strategy",
    "settings.resolveStrategyDesc": "How package versions are resolved",
    "settings.resolveLatest": "Latest",
    "settings.resolveMinimal": "Minimal",
    "settings.resolveLocked": "Locked",
    "settings.resolvePreferLocked": "Prefer Locked",
    "settings.autoUpdateMetadata": "Auto Update Metadata",
    "settings.autoUpdateMetadataDesc": "Automatically refresh metadata",
    "settings.updateCheckConcurrency": "Update Check Concurrency",
    "settings.updateCheckConcurrencyDesc": "Maximum number of concurrent update checks (1-32)",
  };
  return translations[key] || key;
};

describe("GeneralSettings", () => {
  const defaultProps = {
    localConfig: {
      "general.parallel_downloads": "4",
      "general.min_install_space_mb": "100",
      "general.metadata_cache_ttl": "3600",
      "general.resolve_strategy": "latest",
      "general.auto_update_metadata": "true",
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render general settings content", () => {
    render(<GeneralSettings {...defaultProps} />);

    // Title/description are now provided by parent CollapsibleSection
    expect(screen.getByText("Parallel Downloads")).toBeInTheDocument();
  });

  it("should render parallel downloads setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText("Parallel Downloads")).toBeInTheDocument();
    expect(
      screen.getByText("Number of concurrent downloads"),
    ).toBeInTheDocument();
  });

  it("should render minimum install space setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText("Minimum Install Space")).toBeInTheDocument();
    expect(
      screen.getByText("Minimum free disk space required"),
    ).toBeInTheDocument();
  });

  it("should render metadata cache TTL setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText("Metadata Cache TTL")).toBeInTheDocument();
  });

  it("should render resolve strategy setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText("Resolve Strategy")).toBeInTheDocument();
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });

  it("should render auto update metadata toggle", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText("Auto Update Metadata")).toBeInTheDocument();
  });

  it("should call onValueChange when parallel downloads is changed", () => {
    const onValueChange = jest.fn();
    render(<GeneralSettings {...defaultProps} onValueChange={onValueChange} />);

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "8" } });

    expect(onValueChange).toHaveBeenCalledWith(
      "general.parallel_downloads",
      "8",
    );
  });

  it("should render resolve strategy dropdown", () => {
    render(<GeneralSettings {...defaultProps} />);

    // Check that the resolve strategy dropdown exists with current value
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });

  it("should call onValueChange when auto update metadata toggles", () => {
    const onValueChange = jest.fn();
    render(<GeneralSettings {...defaultProps} onValueChange={onValueChange} />);

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    expect(onValueChange).toHaveBeenCalledWith(
      "general.auto_update_metadata",
      "false",
    );
  });

  it("should display validation errors", () => {
    const errors = {
      "general.parallel_downloads": "Value must be between 1 and 16",
    };
    render(<GeneralSettings {...defaultProps} errors={errors} />);

    expect(
      screen.getByText("Value must be between 1 and 16"),
    ).toBeInTheDocument();
  });

  it("should use default values when config is empty", () => {
    render(<GeneralSettings {...defaultProps} localConfig={{}} />);

    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveValue(4); // default parallel downloads
    expect(inputs[1]).toHaveValue(100); // default min install space
    expect(inputs[2]).toHaveValue(3600); // default cache TTL
  });

  it("should render cache max size setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText(mockT("settings.cacheMaxSize"))).toBeInTheDocument();
  });

  it("should render cache max age days setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText(mockT("settings.cacheMaxAgeDays"))).toBeInTheDocument();
  });

  it("should render auto clean cache toggle", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText(mockT("settings.autoCleanCache"))).toBeInTheDocument();
  });

  it("should render cache auto clean threshold setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(
      screen.getByText(mockT("settings.cacheAutoCleanThreshold")),
    ).toBeInTheDocument();
  });

  it("should render cache monitor interval setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(
      screen.getByText(mockT("settings.cacheMonitorInterval")),
    ).toBeInTheDocument();
  });

  it("should render cache monitor external toggle", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(
      screen.getByText(mockT("settings.cacheMonitorExternal")),
    ).toBeInTheDocument();
  });

  it("should render download speed limit setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(
      screen.getByText(mockT("settings.downloadSpeedLimit")),
    ).toBeInTheDocument();
  });

  it("should call onValueChange when auto clean cache toggles", () => {
    const onValueChange = jest.fn();
    render(
      <GeneralSettings
        {...defaultProps}
        localConfig={{
          ...defaultProps.localConfig,
          "general.auto_clean_cache": "true",
        }}
        onValueChange={onValueChange}
      />,
    );

    const switches = screen.getAllByRole("switch");
    // auto_update_metadata is first, auto_clean_cache is second, cache_monitor_external is third
    fireEvent.click(switches[1]);

    expect(onValueChange).toHaveBeenCalledWith(
      "general.auto_clean_cache",
      "false",
    );
  });

  it("should call onValueChange when cache monitor external toggles", () => {
    const onValueChange = jest.fn();
    render(
      <GeneralSettings
        {...defaultProps}
        localConfig={{
          ...defaultProps.localConfig,
          "general.cache_monitor_external": "false",
        }}
        onValueChange={onValueChange}
      />,
    );

    const switches = screen.getAllByRole("switch");
    // cache_monitor_external is the last switch
    fireEvent.click(switches[switches.length - 1]);

    expect(onValueChange).toHaveBeenCalledWith(
      "general.cache_monitor_external",
      "true",
    );
  });

  it("should render update check concurrency setting", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText("Update Check Concurrency")).toBeInTheDocument();
    expect(
      screen.getByText("Maximum number of concurrent update checks (1-32)"),
    ).toBeInTheDocument();
  });

  it("should use default value for update check concurrency when config is empty", () => {
    render(<GeneralSettings {...defaultProps} localConfig={{}} />);

    const inputs = screen.getAllByRole("spinbutton");
    // update_check_concurrency is the last number input, default = 8
    const lastInput = inputs[inputs.length - 1];
    expect(lastInput).toHaveValue(8);
  });

  it("should call onValueChange when update check concurrency is changed", () => {
    const onValueChange = jest.fn();
    render(<GeneralSettings {...defaultProps} onValueChange={onValueChange} />);

    const inputs = screen.getAllByRole("spinbutton");
    const lastInput = inputs[inputs.length - 1];
    fireEvent.change(lastInput, { target: { value: "16" } });

    expect(onValueChange).toHaveBeenCalledWith(
      "general.update_check_concurrency",
      "16",
    );
  });

  it("should display validation error for update check concurrency", () => {
    const errors = {
      "general.update_check_concurrency": "Value must be between 1 and 32",
    };
    render(<GeneralSettings {...defaultProps} errors={errors} />);

    expect(
      screen.getByText("Value must be between 1 and 32"),
    ).toBeInTheDocument();
  });

  it("wires additional numeric general settings back to onValueChange", () => {
    const onValueChange = jest.fn();
    render(<GeneralSettings {...defaultProps} onValueChange={onValueChange} />);

    const spinbuttons = screen.getAllByRole("spinbutton");
    fireEvent.change(spinbuttons[1], { target: { value: "250" } });
    fireEvent.change(spinbuttons[2], { target: { value: "7200" } });
    fireEvent.change(spinbuttons[3], { target: { value: "1073741824" } });
    fireEvent.change(spinbuttons[4], { target: { value: "90" } });
    fireEvent.change(spinbuttons[5], { target: { value: "85" } });
    fireEvent.change(spinbuttons[6], { target: { value: "600" } });
    fireEvent.change(spinbuttons[7], { target: { value: "2048" } });

    expect(onValueChange).toHaveBeenCalledWith("general.min_install_space_mb", "250");
    expect(onValueChange).toHaveBeenCalledWith("general.metadata_cache_ttl", "7200");
    expect(onValueChange).toHaveBeenCalledWith("general.cache_max_size", "1073741824");
    expect(onValueChange).toHaveBeenCalledWith("general.cache_max_age_days", "90");
    expect(onValueChange).toHaveBeenCalledWith("general.cache_auto_clean_threshold", "85");
    expect(onValueChange).toHaveBeenCalledWith("general.cache_monitor_interval", "600");
    expect(onValueChange).toHaveBeenCalledWith("general.download_speed_limit", "2048");
  });
});
