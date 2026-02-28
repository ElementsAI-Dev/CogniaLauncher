import { render, screen, act } from "@testing-library/react";
import { CacheMonitorCard } from "./cache-monitor-card";

const mockCacheSizeMonitor = jest.fn();
let mockIsTauri = false;

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const mockGetCacheSizeHistory = jest.fn();

jest.mock("@/lib/tauri", () => ({
  get isTauri() {
    return () => mockIsTauri;
  },
  get cacheSizeMonitor() {
    return mockCacheSizeMonitor;
  },
  get getCacheSizeHistory() {
    return mockGetCacheSizeHistory;
  },
}));

const monitorData = {
  usagePercent: 45,
  internalSizeHuman: "1.2 GB",
  maxSizeHuman: "5.0 GB",
  totalSizeHuman: "1.5 GB",
  diskAvailableHuman: "100 GB",
  externalSizeHuman: "300 MB",
  externalSize: 314572800,
  exceedsThreshold: false,
  threshold: 80,
  externalCaches: [],
};

describe("CacheMonitorCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = false;
    mockGetCacheSizeHistory.mockResolvedValue([]);
  });

  it("renders monitor card title", () => {
    render(<CacheMonitorCard />);
    expect(screen.getByText("cache.sizeMonitor")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<CacheMonitorCard />);
    expect(screen.getByText("cache.sizeMonitorDesc")).toBeInTheDocument();
  });

  it("shows no cache data message in non-Tauri environment", () => {
    render(<CacheMonitorCard />);
    expect(screen.getByText("cache.noCacheData")).toBeInTheDocument();
  });

  it("displays monitor data when available", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue(monitorData);
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("1.2 GB")).toBeInTheDocument();
    expect(screen.getByText("1.5 GB")).toBeInTheDocument();
    expect(screen.getByText("100 GB")).toBeInTheDocument();
  });

  it("displays usage percentage", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue(monitorData);
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("shows threshold warning when exceeded", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue({
      ...monitorData,
      usagePercent: 92,
      exceedsThreshold: true,
      threshold: 80,
    });
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("cache.thresholdExceeded")).toBeInTheDocument();
  });

  it("shows external caches when present", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue({
      ...monitorData,
      externalCaches: [
        { provider: "npm", displayName: "npm cache", sizeHuman: "200 MB" },
      ],
    });
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("npm cache")).toBeInTheDocument();
    expect(screen.getByText("200 MB")).toBeInTheDocument();
  });

  it("shows external caches section title", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue({
      ...monitorData,
      externalCaches: [
        { provider: "npm", displayName: "npm", sizeHuman: "100 MB" },
      ],
    });
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("cache.externalCaches")).toBeInTheDocument();
  });

  it("displays threshold value in footer", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue(monitorData);
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("Threshold: 80%")).toBeInTheDocument();
  });

  it("shows internal/max size ratio", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue(monitorData);
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("1.2 GB / 5.0 GB")).toBeInTheDocument();
  });

  it("shows no size history message when fewer than 2 snapshots", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue(monitorData);
    mockGetCacheSizeHistory.mockResolvedValue([]);
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("cache.noSizeHistory")).toBeInTheDocument();
  });

  it("shows size history title when snapshots are available", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue(monitorData);
    mockGetCacheSizeHistory.mockResolvedValue([
      { timestamp: "2025-01-01T00:00:00Z", internalSize: 1000, internalSizeHuman: "1 KB", downloadCount: 5, metadataCount: 3 },
      { timestamp: "2025-01-02T00:00:00Z", internalSize: 2000, internalSizeHuman: "2 KB", downloadCount: 10, metadataCount: 6 },
    ]);
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(screen.getByText("cache.sizeHistory")).toBeInTheDocument();
  });

  it("calls getCacheSizeHistory on mount in Tauri environment", async () => {
    mockIsTauri = true;
    mockCacheSizeMonitor.mockResolvedValue(monitorData);
    mockGetCacheSizeHistory.mockResolvedValue([]);
    await act(async () => {
      render(<CacheMonitorCard />);
    });
    expect(mockGetCacheSizeHistory).toHaveBeenCalledWith(30);
  });
});
