import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PathsSettings } from "./paths-settings";

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

  it("should render paths settings content", () => {
    render(<PathsSettings {...defaultProps} />);

    // Title/description are now provided by parent CollapsibleSection
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
});
