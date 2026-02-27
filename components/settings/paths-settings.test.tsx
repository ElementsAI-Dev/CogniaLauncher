import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PathsSettings } from "./paths-settings";

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => false),
  validatePath: jest.fn(),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.paths": "Paths",
    "settings.pathsDesc": "Override default storage locations",
    "settings.pathRoot": "Root Directory",
    "settings.pathRootDesc": "Base directory for data",
    "settings.pathRootPlaceholder": "Leave empty to use default",
    "settings.pathCache": "Cache Directory",
    "settings.pathCacheDesc": "Cache location",
    "settings.pathCachePlaceholder": "Leave empty to use default",
    "settings.pathEnvironments": "Environments Directory",
    "settings.pathEnvironmentsDesc": "Environment location",
    "settings.pathEnvironmentsPlaceholder": "Leave empty to use default",
    "settings.pathManualRequired": "Manual path input required",
    "settings.pathBrowse": "Browse",
    "settings.pathValidation.tooLong": "Path is too long",
    "settings.pathValidation.dangerousChars": "Path contains dangerous characters",
    "settings.pathValidation.mustBeAbsolute": "Path must be absolute",
    "settings.pathValidation.validating": "Validating...",
    "settings.pathValidation.valid": "Valid",
    "settings.pathValidation.hasWarnings": "Has warnings",
    "settings.pathValidation.invalid": "Invalid",
    "settings.pathValidation.clearPath": "Clear",
    "settings.pathValidation.exists": "Exists",
    "settings.pathValidation.willCreate": "Will be created",
    "settings.pathValidation.writable": "Writable",
    "settings.pathValidation.notWritable": "Not writable",
    "settings.pathValidation.parentWritable": "Parent writable",
    "settings.pathValidation.parentNotWritable": "Parent not writable",
    "settings.pathValidation.diskSpace": "Disk space",
    "settings.pathValidation.traversalWarning": "Path traversal detected",
    "settings.pathValidation.backendError": "Backend error",
  };
  return translations[key] || key;
};

describe("PathsSettings", () => {
  const defaultProps = {
    localConfig: {
      "paths.root": "/data/root",
      "paths.cache": "/data/cache",
      "paths.environments": "/data/envs",
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render paths settings content", () => {
    render(<PathsSettings {...defaultProps} />);

    expect(screen.getByText("Root Directory")).toBeInTheDocument();
  });

  it("should display current path values", () => {
    render(<PathsSettings {...defaultProps} />);

    expect(screen.getByLabelText("Root Directory")).toHaveValue("/data/root");
    expect(screen.getByLabelText("Cache Directory")).toHaveValue("/data/cache");
    expect(screen.getByLabelText("Environments Directory")).toHaveValue(
      "/data/envs",
    );
  });

  it("should call onValueChange when paths change", () => {
    const onValueChange = jest.fn();
    render(<PathsSettings {...defaultProps} onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText("Root Directory"), {
      target: { value: "/new/root" },
    });

    expect(onValueChange).toHaveBeenCalledWith("paths.root", "/new/root");
  });

  it("should render all three path inputs", () => {
    render(<PathsSettings {...defaultProps} />);

    expect(screen.getByText("Root Directory")).toBeInTheDocument();
    expect(screen.getByText("Cache Directory")).toBeInTheDocument();
    expect(screen.getByText("Environments Directory")).toBeInTheDocument();
  });

  it("should render descriptions for each path", () => {
    render(<PathsSettings {...defaultProps} />);

    expect(screen.getByText("Base directory for data")).toBeInTheDocument();
    expect(screen.getByText("Cache location")).toBeInTheDocument();
    expect(screen.getByText("Environment location")).toBeInTheDocument();
  });

  it("should use empty string when config keys are missing", () => {
    render(<PathsSettings {...defaultProps} localConfig={{}} />);

    expect(screen.getByLabelText("Root Directory")).toHaveValue("");
    expect(screen.getByLabelText("Cache Directory")).toHaveValue("");
    expect(screen.getByLabelText("Environments Directory")).toHaveValue("");
  });

  it("should display external errors when provided", () => {
    render(
      <PathsSettings
        {...defaultProps}
        errors={{ "paths.root": "Invalid root path" }}
      />,
    );

    expect(screen.getByText("Invalid root path")).toBeInTheDocument();
  });

  it("should show validation error for relative path", () => {
    const onValueChange = jest.fn();
    render(
      <PathsSettings
        {...defaultProps}
        localConfig={{ "paths.root": "relative/path" }}
        onValueChange={onValueChange}
      />,
    );

    expect(
      screen.getByText("Path must be absolute"),
    ).toBeInTheDocument();
  });

  it("should show validation error for dangerous characters", () => {
    render(
      <PathsSettings
        {...defaultProps}
        localConfig={{ "paths.root": "/data/`evil`" }}
      />,
    );

    expect(
      screen.getByText("Path contains dangerous characters"),
    ).toBeInTheDocument();
  });

  it("should show validation error for shell injection patterns", () => {
    render(
      <PathsSettings
        {...defaultProps}
        localConfig={{ "paths.root": "/data/$(rm -rf)" }}
      />,
    );

    expect(
      screen.getByText("Path contains dangerous characters"),
    ).toBeInTheDocument();
  });

  it("should not show error for empty path (uses default)", () => {
    render(
      <PathsSettings {...defaultProps} localConfig={{ "paths.root": "" }} />,
    );

    expect(
      screen.queryByText("Path must be absolute"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Path contains dangerous characters"),
    ).not.toBeInTheDocument();
  });

  it("should accept valid Windows absolute path", () => {
    render(
      <PathsSettings
        {...defaultProps}
        localConfig={{ "paths.root": "C:\\Users\\test\\data" }}
      />,
    );

    expect(
      screen.queryByText("Path must be absolute"),
    ).not.toBeInTheDocument();
  });

  it("should accept valid Unix absolute path", () => {
    render(
      <PathsSettings
        {...defaultProps}
        localConfig={{ "paths.root": "/home/user/data" }}
      />,
    );

    expect(
      screen.queryByText("Path must be absolute"),
    ).not.toBeInTheDocument();
  });
});
