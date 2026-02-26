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
    "about.systemInfoDesc": "Device, hardware, and runtime details",
    "about.systemInfoRetry": "Retry",
    "about.errorTitle": "Error",
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
    "about.cpuFrequency": "CPU Frequency",
    "about.cpuVendor": "CPU Vendor",
    "about.cores": "cores",
    "about.memory": "Memory",
    "about.totalMemory": "Total Memory",
    "about.swap": "Swap",
    "about.gpu": "GPU",
    "about.gpuInfo": "Graphics",
    "about.gpuVram": "VRAM",
    "about.gpuDriver": "Driver Version",
    "about.appVersion": "App Version",
    "about.homeDirectory": "Home Directory",
    "about.uptime": "Uptime",
    "about.locale": "Locale",
    "about.temperature": "Temperature",
    "about.battery": "Battery",
    "about.batteryPercent": "Charge",
    "about.batteryCharging": "Charging",
    "about.batteryDischarging": "On Battery",
    "about.batteryPluggedIn": "Plugged In",
    "about.batteryHealth": "Battery Health",
    "about.batteryTechnology": "Technology",
    "about.cycleCount": "Cycle Count",
    "about.powerSource": "Power Source",
    "about.storage": "Storage",
    "about.networkInfo": "Network",
    "about.bootTime": "Boot Time",
    "about.loadAverage": "Load Average",
    "about.cpuUsage": "CPU Usage",
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
  osName: "Windows",
  distributionId: "",
  cpuArch: "x86_64",
  cpuModel: "Intel i7",
  cpuVendorId: "GenuineIntel",
  cpuFrequency: 3600,
  cpuCores: 8,
  physicalCoreCount: 4,
  globalCpuUsage: 12.5,
  totalMemory: 16 * 1024 * 1024 * 1024,
  availableMemory: 8 * 1024 * 1024 * 1024,
  usedMemory: 8 * 1024 * 1024 * 1024,
  totalSwap: 4 * 1024 * 1024 * 1024,
  usedSwap: 1 * 1024 * 1024 * 1024,
  uptime: 86400,
  bootTime: 1700000000,
  loadAverage: [0, 0, 0] as [number, number, number],
  gpus: [{ name: "NVIDIA GeForce RTX 4070", vramMb: 12288, driverVersion: "555.42", vendor: "NVIDIA" }],
  appVersion: "1.0.0",
  homeDir: "C:\\Users\\test",
  locale: "en-US",
  components: [],
  battery: null,
  disks: [],
  networks: [],
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

  it("renders temperature section when components are present", () => {
    const withComponents = {
      ...systemInfo,
      components: [
        { label: "CPU Package", temperature: 65.5, max: 80.0, critical: 100.0 },
        { label: "GPU Core", temperature: 55.0, max: null, critical: null },
      ],
    };
    render(<SystemInfoCard {...defaultProps} systemInfo={withComponents} />);
    expect(screen.getByText("Temperature")).toBeInTheDocument();
    expect(screen.getByText("CPU Package")).toBeInTheDocument();
    expect(screen.getByText("65.5°C / 100°C")).toBeInTheDocument();
  });

  it("does not render temperature section when components are empty", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.queryByText("Temperature")).not.toBeInTheDocument();
  });

  it("renders battery section when battery info is present", () => {
    const withBattery = {
      ...systemInfo,
      battery: {
        percent: 85,
        isCharging: true,
        isPluggedIn: true,
        healthPercent: 92,
        cycleCount: 150,
        designCapacityMwh: 50000,
        fullCapacityMwh: 46000,
        voltageMv: 12000,
        powerSource: "ac",
        timeToEmptyMins: null,
        timeToFullMins: 30,
        technology: "Li-ion",
      },
    };
    render(<SystemInfoCard {...defaultProps} systemInfo={withBattery} />);
    expect(screen.getByText("Battery")).toBeInTheDocument();
    expect(screen.getByText("Charging")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("Li-ion")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("does not render battery section when battery is null", () => {
    render(<SystemInfoCard {...defaultProps} />);
    expect(screen.queryByText("Battery")).not.toBeInTheDocument();
  });

  it("renders storage section when disks are present", () => {
    const withDisks = {
      ...systemInfo,
      disks: [
        {
          name: "C:",
          mountPoint: "C:\\",
          totalSpace: 500000000000,
          availableSpace: 200000000000,
          usedSpace: 300000000000,
          usagePercent: 60,
          fileSystem: "NTFS",
          diskType: "SSD",
          isRemovable: false,
          isReadOnly: false,
          readBytes: 1024000,
          writtenBytes: 512000,
          totalSpaceHuman: "465.7 GB",
          availableSpaceHuman: "186.3 GB",
          usedSpaceHuman: "279.4 GB",
          readBytesHuman: "1000.0 KB",
          writtenBytesHuman: "500.0 KB",
        },
      ],
    };
    render(<SystemInfoCard {...defaultProps} systemInfo={withDisks} />);
    expect(screen.getByText("Storage")).toBeInTheDocument();
  });

  it("renders network section when interfaces with IPs are present", () => {
    const withNetworks = {
      ...systemInfo,
      networks: [
        {
          name: "Ethernet",
          macAddress: "AA:BB:CC:DD:EE:FF",
          ipAddresses: ["192.168.1.100"],
          totalReceived: 1024000,
          totalTransmitted: 512000,
          totalReceivedHuman: "1000.0 KB",
          totalTransmittedHuman: "500.0 KB",
          mtu: 1500,
          totalPacketsReceived: 100,
          totalPacketsTransmitted: 50,
          totalErrorsOnReceived: 0,
          totalErrorsOnTransmitted: 0,
        },
      ],
    };
    render(<SystemInfoCard {...defaultProps} systemInfo={withNetworks} />);
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Ethernet")).toBeInTheDocument();
  });

  it("renders boot time and load average in runtime section", () => {
    const withLoadAvg = {
      ...systemInfo,
      loadAverage: [1.5, 2.0, 1.8] as [number, number, number],
      globalCpuUsage: 25.3,
    };
    render(<SystemInfoCard {...defaultProps} systemInfo={withLoadAvg} />);
    expect(screen.getByText("Load Average")).toBeInTheDocument();
    expect(screen.getByText("1.50 / 2.00 / 1.80")).toBeInTheDocument();
    expect(screen.getByText("CPU Usage")).toBeInTheDocument();
    expect(screen.getByText("25.3%")).toBeInTheDocument();
  });
});
