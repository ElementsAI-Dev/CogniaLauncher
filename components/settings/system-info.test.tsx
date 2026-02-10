import React from "react";
import { render, screen } from "@testing-library/react";
import { SystemInfo } from "./system-info";
import type { PlatformInfo } from "@/lib/tauri";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.systemInfo": "System Information",
    "settings.systemInfoDesc": "Current system details",
    "settings.operatingSystem": "Operating System",
    "settings.architecture": "Architecture",
    "common.unknown": "Unknown",
  };
  return translations[key] || key;
};

const mockPlatformInfo: PlatformInfo = {
  os: "Windows 11",
  arch: "x86_64",
  os_version: "10.0.22631",
  os_long_version: "Windows 11 Pro 23H2",
  kernel_version: "10.0.22631",
  hostname: "DESKTOP-TEST",
  cpu_model: "Intel Core i7",
  cpu_cores: 8,
  total_memory: 17179869184,
  available_memory: 8589934592,
  uptime: 86400,
  app_version: "0.1.0",
};

describe("SystemInfo", () => {
  const defaultProps = {
    loading: false,
    platformInfo: mockPlatformInfo as PlatformInfo | null,
    cogniaDir: "C:\\Users\\test\\.cognia" as string | null,
    t: mockT,
  };

  it("should render system info content", () => {
    render(<SystemInfo {...defaultProps} />);

    // Title/description are now provided by parent CollapsibleSection
    expect(screen.getByText("Operating System")).toBeInTheDocument();
  });

  it("should display platform information", () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText("Windows 11 Pro 23H2")).toBeInTheDocument();
    expect(screen.getByText("x86_64")).toBeInTheDocument();
  });

  it("should display operating system label", () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText("Operating System")).toBeInTheDocument();
  });

  it("should display architecture label", () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText("Architecture")).toBeInTheDocument();
  });

  it("should show skeleton when loading", () => {
    const { container } = render(
      <SystemInfo {...defaultProps} loading={true} />,
    );

    // Check for skeleton elements
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should show unknown when platform info is null", () => {
    render(<SystemInfo {...defaultProps} platformInfo={null} cogniaDir={null} />);

    const unknownElements = screen.getAllByText("Unknown");
    expect(unknownElements.length).toBeGreaterThanOrEqual(2);
  });

  it("should show unknown for missing os", () => {
    render(
      <SystemInfo
        {...defaultProps}
        platformInfo={{
          ...mockPlatformInfo,
          os: "" as unknown as string,
          os_version: "",
          os_long_version: "",
        }}
      />,
    );

    const unknownElements = screen.getAllByText("Unknown");
    expect(unknownElements.length).toBeGreaterThanOrEqual(1);
  });

  it("should show unknown for missing arch", () => {
    render(
      <SystemInfo
        {...defaultProps}
        platformInfo={{ ...mockPlatformInfo, arch: "" as unknown as string }}
      />,
    );

    const unknownElements = screen.getAllByText("Unknown");
    expect(unknownElements.length).toBeGreaterThanOrEqual(1);
  });
});
