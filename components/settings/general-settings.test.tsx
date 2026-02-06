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

  it("should render general settings card", () => {
    render(<GeneralSettings {...defaultProps} />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(
      screen.getByText("General application settings"),
    ).toBeInTheDocument();
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
});
