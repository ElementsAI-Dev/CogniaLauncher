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
  osVersion: "10.0.22631",
  osLongVersion: "Windows 11 Pro 23H2",
  kernelVersion: "10.0.22631",
  hostname: "DESKTOP-TEST",
  osName: "Windows",
  distributionId: "",
  cpuArch: "x86_64",
  cpuModel: "Intel Core i7",
  cpuVendorId: "GenuineIntel",
  cpuFrequency: 3600,
  cpuCores: 8,
  physicalCoreCount: 4,
  globalCpuUsage: 15.5,
  totalMemory: 17179869184,
  availableMemory: 8589934592,
  usedMemory: 8589934592,
  totalSwap: 4294967296,
  usedSwap: 1073741824,
  uptime: 86400,
  bootTime: 1700000000,
  loadAverage: [0, 0, 0],
  gpus: [{ name: "NVIDIA GeForce RTX 4070", vramMb: 12288, driverVersion: "555.42", vendor: "NVIDIA" }],
  appVersion: "0.1.0",
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
          osVersion: "",
          osLongVersion: "",
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

  it("should display hostname", () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText("DESKTOP-TEST")).toBeInTheDocument();
  });

  it("should display CPU model with cores", () => {
    render(<SystemInfo {...defaultProps} />);

    expect(
      screen.getByText("Intel Core i7 (8 cores)"),
    ).toBeInTheDocument();
  });

  it("should display app version", () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });

  it("should display data directory", () => {
    render(<SystemInfo {...defaultProps} />);

    expect(
      screen.getByText("C:\\Users\\test\\.cognia"),
    ).toBeInTheDocument();
  });

  it("should display GPU name", () => {
    render(<SystemInfo {...defaultProps} />);

    expect(
      screen.getByText("NVIDIA GeForce RTX 4070"),
    ).toBeInTheDocument();
  });

  it("should fallback to os + osVersion when osLongVersion is missing", () => {
    render(
      <SystemInfo
        {...defaultProps}
        platformInfo={{
          ...mockPlatformInfo,
          osLongVersion: "",
        }}
      />,
    );

    expect(
      screen.getByText("Windows 11 10.0.22631"),
    ).toBeInTheDocument();
  });
});
