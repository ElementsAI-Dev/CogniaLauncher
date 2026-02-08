import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SystemInfoCard } from "./system-info-card";

jest.mock("@/lib/app-version", () => ({
  APP_VERSION: "0.1.0",
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.systemInfo": "System Information",
    "about.systemInfoRetry": "Retry",
    "about.copySystemInfo": "Copy",
    "about.systemInfoFailed": "Failed to load system info",
    "about.deviceInfo": "Device",
    "about.hardwareInfo": "Hardware",
    "about.runtimeInfo": "Runtime",
    "about.operatingSystem": "OS",
    "about.architecture": "Architecture",
    "about.kernelVersion": "Kernel",
    "about.hostname": "Hostname",
    "about.cpu": "CPU",
    "about.cpuCores": "CPU Cores",
    "about.cores": "cores",
    "about.memory": "Memory",
    "about.totalMemory": "Total Memory",
    "about.appVersion": "App Version",
    "about.homeDirectory": "Home Directory",
    "about.uptime": "Uptime",
    "about.locale": "Locale",
    "common.unknown": "Unknown",
    "common.retry": "Retry",
  };
  return translations[key] || key;
};

const systemInfo = {
  os: "Windows",
  osVersion: "11",
  osLongVersion: "Windows 11 Pro",
  arch: "x86_64",
  kernelVersion: "10.0.22621",
  hostname: "test-pc",
  cpuModel: "Intel i7",
  cpuCores: 8,
  totalMemory: 16 * 1024 * 1024 * 1024,
  availableMemory: 8 * 1024 * 1024 * 1024,
  appVersion: "1.0.0",
  homeDir: "C:\\Users\\test",
  uptime: 86400,
  locale: "en-US",
};

const defaultProps = {
  systemInfo,
  systemLoading: false,
  updateInfo: null,
  systemError: null,
  onRetry: jest.fn(),
  t: mockT,
};

describe("SystemInfoCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders system info heading", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.getByText("System Information")).toBeInTheDocument();
  });

  it("renders OS information", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.getByText("Windows 11 Pro")).toBeInTheDocument();
  });

  it("renders architecture", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.getByText("x86_64")).toBeInTheDocument();
  });

  it("renders CPU info", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.getByText("Intel i7")).toBeInTheDocument();
  });

  it("renders app version", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("renders section headers", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.getByText("Device")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Runtime")).toBeInTheDocument();
  });

  it("shows error alert when systemError is present", () => {
    render(
      <SystemInfoCard {...defaultProps} systemError="Failed to load" />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Failed to load system info")).toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    const { container } = render(
      <SystemInfoCard {...defaultProps} systemLoading={true} systemInfo={null} />,
    );
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("shows Unknown when systemInfo is null and not loading", () => {
    render(
      <SystemInfoCard {...defaultProps} systemInfo={null} />,
    );
    const unknowns = screen.getAllByText("Unknown");
    expect(unknowns.length).toBeGreaterThan(0);
  });

  it("calls onRetry when retry button is clicked", async () => {
    render(<SystemInfoCard {...defaultProps} />);
    const retryBtn = screen.getByLabelText("Retry");
    await userEvent.click(retryBtn);
    expect(defaultProps.onRetry).toHaveBeenCalledTimes(1);
  });

  it("has correct aria region", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});
