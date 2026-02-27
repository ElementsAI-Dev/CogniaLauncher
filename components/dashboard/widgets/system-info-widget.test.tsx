import { render, screen } from "@testing-library/react";
import { SystemInfoWidget } from "./system-info-widget";
import type { PlatformInfo } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const platformInfo = {
  os: "Windows",
  osVersion: "11",
  osLongVersion: "Windows 11 Pro 24H2",
  arch: "x86_64",
  hostname: "test-pc",
  cpuModel: "Intel i7",
  cpuCores: 8,
  totalMemory: 17179869184,
  availableMemory: 8589934592,
} as PlatformInfo;

const minimalPlatformInfo = {
  os: "Linux",
  osVersion: "6.0",
  arch: "aarch64",
} as PlatformInfo;

describe("SystemInfoWidget", () => {
  it("renders loading state when platformInfo is null", () => {
    render(<SystemInfoWidget platformInfo={null} cogniaDir={null} />);
    expect(screen.getByText("dashboard.widgets.systemInfo")).toBeInTheDocument();
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("renders system info title when platformInfo is provided", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo} cogniaDir="C:\\Users\\test\\.cognia" />,
    );
    expect(screen.getByText("dashboard.widgets.systemInfo")).toBeInTheDocument();
  });

  it("renders description when platformInfo is provided", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo} cogniaDir="C:\\Users\\test\\.cognia" />,
    );
    expect(screen.getByText("dashboard.widgets.systemInfoDesc")).toBeInTheDocument();
  });

  it("displays OS long version", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo} cogniaDir={null} />,
    );
    expect(screen.getByText("Windows 11 Pro 24H2")).toBeInTheDocument();
  });

  it("displays CPU model with cores", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo} cogniaDir={null} />,
    );
    expect(screen.getByText("Intel i7 (8 cores)")).toBeInTheDocument();
  });

  it("displays hostname", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo} cogniaDir={null} />,
    );
    expect(screen.getByText("test-pc")).toBeInTheDocument();
  });

  it("displays cognia data directory", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo} cogniaDir="C:/Users/test/.cognia" />,
    );
    expect(screen.getByText("C:/Users/test/.cognia")).toBeInTheDocument();
  });

  it("shows 'unknown' when cogniaDir is null", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo} cogniaDir={null} />,
    );
    expect(screen.getByText("common.unknown")).toBeInTheDocument();
  });

  it("shows all info labels", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo} cogniaDir={null} />,
    );
    expect(screen.getByText("dashboard.widgets.operatingSystem")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.cpu")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.memory")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.hostname")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.dataDirectory")).toBeInTheDocument();
  });

  it("falls back to arch when cpuModel is missing", () => {
    render(
      <SystemInfoWidget platformInfo={minimalPlatformInfo} cogniaDir={null} />,
    );
    expect(screen.getByText("aarch64")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <SystemInfoWidget platformInfo={null} cogniaDir={null} className="custom" />,
    );
    expect(container.firstChild).toHaveClass("custom");
  });
});
