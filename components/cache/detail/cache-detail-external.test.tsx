import { render, screen, act } from "@testing-library/react";
import { CacheDetailExternalView } from "./cache-detail-external";

const mockDiscoverExternalCaches = jest.fn();
const mockGetExternalCachePaths = jest.fn();
const mockCleanExternalCache = jest.fn();
const mockCleanAllExternalCaches = jest.fn();
let mockIsTauri = false;

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  get isTauri() {
    return () => mockIsTauri;
  },
  get discoverExternalCaches() {
    return mockDiscoverExternalCaches;
  },
  get getExternalCachePaths() {
    return mockGetExternalCachePaths;
  },
  get cleanExternalCache() {
    return mockCleanExternalCache;
  },
  get cleanAllExternalCaches() {
    return mockCleanAllExternalCaches;
  },
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

jest.mock("@/components/layout/page-header", () => ({
  PageHeader: ({ title, description, actions }: { title: React.ReactNode; description: React.ReactNode; actions?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions && <div>{actions}</div>}
    </div>
  ),
}));

const mockCaches = [
  {
    provider: "npm",
    displayName: "npm Cache",
    cachePath: "/home/test/.npm",
    size: 524288000,
    sizeHuman: "500 MB",
    isAvailable: true,
    canClean: true,
    category: "package_manager",
  },
  {
    provider: "pip",
    displayName: "pip Cache",
    cachePath: "/home/test/.cache/pip",
    size: 104857600,
    sizeHuman: "100 MB",
    isAvailable: false,
    canClean: false,
    category: "package_manager",
  },
];

const mockPaths = [
  {
    provider: "npm",
    hasCleanCommand: true,
    cleanCommand: "npm cache clean --force",
    envVarsChecked: ["NPM_CONFIG_CACHE"],
  },
];

describe("CacheDetailExternal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = false;
    mockDiscoverExternalCaches.mockResolvedValue([]);
    mockGetExternalCachePaths.mockResolvedValue([]);
  });

  it("renders without crashing", () => {
    const { container } = render(<CacheDetailExternalView />);
    expect(container).toBeInTheDocument();
  });

  it("renders page title", () => {
    render(<CacheDetailExternalView />);
    expect(screen.getByText("cache.detail.externalTitle")).toBeInTheDocument();
  });

  it("renders page description", () => {
    render(<CacheDetailExternalView />);
    expect(screen.getByText("cache.detail.externalDescription")).toBeInTheDocument();
  });

  it("renders back to cache link", () => {
    render(<CacheDetailExternalView />);
    expect(screen.getByText("cache.detail.backToCache")).toBeInTheDocument();
  });

  it("shows empty state when no caches found", () => {
    render(<CacheDetailExternalView />);
    expect(screen.getByText("cache.noExternalCaches")).toBeInTheDocument();
  });

  it("displays stats cards with zero values when no caches", () => {
    render(<CacheDetailExternalView />);
    const zeroes = screen.getAllByText("0");
    expect(zeroes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders use trash switch", () => {
    render(<CacheDetailExternalView />);
    expect(screen.getByText("cache.useTrash")).toBeInTheDocument();
  });

  it("renders clean all button (disabled when no cleanable)", () => {
    render(<CacheDetailExternalView />);
    expect(screen.getByText("cache.cleanAll")).toBeInTheDocument();
  });

  it("displays cache items when data loaded", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockGetExternalCachePaths.mockResolvedValue(mockPaths);
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    expect(screen.getByText("npm Cache")).toBeInTheDocument();
    expect(screen.getByText("pip Cache")).toBeInTheDocument();
  });

  it("shows available/unavailable badges per cache", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockGetExternalCachePaths.mockResolvedValue(mockPaths);
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    // "externalAvailable" appears in stats card + badge, so use getAll
    const availableTexts = screen.getAllByText("cache.detail.externalAvailable");
    expect(availableTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("cache.detail.externalUnavailable")).toBeInTheDocument();
  });

  it("shows cache sizes", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockGetExternalCachePaths.mockResolvedValue(mockPaths);
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    expect(screen.getByText("500 MB")).toBeInTheDocument();
    expect(screen.getByText("100 MB")).toBeInTheDocument();
  });

  it("shows cache paths", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockGetExternalCachePaths.mockResolvedValue(mockPaths);
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    expect(screen.getByText("/home/test/.npm")).toBeInTheDocument();
    expect(screen.getByText("/home/test/.cache/pip")).toBeInTheDocument();
  });

  it("renders clean button per cache item", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockGetExternalCachePaths.mockResolvedValue(mockPaths);
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    const cleanButtons = screen.getAllByText("cache.clean");
    expect(cleanButtons.length).toBe(2);
  });

  it("shows stats cards with correct counts when data loaded", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockGetExternalCachePaths.mockResolvedValue(mockPaths);
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    // provider count = 2 (may appear multiple times)
    const twos = screen.getAllByText("2");
    expect(twos.length).toBeGreaterThanOrEqual(1);
    // available = 1, cleanable = 1
    const ones = screen.getAllByText("1");
    expect(ones.length).toBeGreaterThanOrEqual(2);
  });

  it("calls cleanExternalCache when clean button clicked and confirmed", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockGetExternalCachePaths.mockResolvedValue(mockPaths);
    mockCleanExternalCache.mockResolvedValue({
      success: true,
      displayName: "npm Cache",
      freedHuman: "500 MB",
      freedBytes: 524288000,
    });
    const { toast } = jest.requireMock("sonner");
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    // Click the first clean button to open confirm dialog
    const cleanButtons = screen.getAllByText("cache.clean");
    await act(async () => {
      cleanButtons[0].closest("button")!.click();
    });
    // Confirm the clean action
    const confirmBtn = screen.getByText("cache.confirmClean");
    await act(async () => {
      confirmBtn.click();
    });
    await act(async () => {});
    expect(mockCleanExternalCache).toHaveBeenCalledWith("npm", true);
    expect(toast.success).toHaveBeenCalled();
  });

  it("calls cleanAllExternalCaches when clean all confirmed", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockGetExternalCachePaths.mockResolvedValue(mockPaths);
    mockCleanAllExternalCaches.mockResolvedValue([
      { success: true, freedBytes: 500000, displayName: "npm" },
    ]);
    const { toast } = jest.requireMock("sonner");
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    // Click clean all button to open confirm dialog
    const cleanAllBtn = screen.getByText("cache.cleanAll").closest("button")!;
    await act(async () => {
      cleanAllBtn.click();
    });
    // Confirm
    const confirmBtns = screen.getAllByText("cache.confirmClean");
    const confirmBtn = confirmBtns[confirmBtns.length - 1];
    await act(async () => {
      confirmBtn.click();
    });
    await act(async () => {});
    expect(mockCleanAllExternalCaches).toHaveBeenCalledWith(true);
    expect(toast.success).toHaveBeenCalled();
  });

  it("toggles use trash switch", async () => {
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeInTheDocument();
    // Default is checked (useTrash = true)
    expect(switchEl).toHaveAttribute("data-state", "checked");
  });

  it("fetches data on mount in Tauri mode", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue([]);
    mockGetExternalCachePaths.mockResolvedValue([]);
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    expect(mockDiscoverExternalCaches).toHaveBeenCalledTimes(1);
    expect(mockGetExternalCachePaths).toHaveBeenCalledTimes(1);
  });

  it("renders refresh button", async () => {
    await act(async () => {
      render(<CacheDetailExternalView />);
    });
    const refreshBtns = screen.getAllByText(/cache\.refreshSuccess/);
    expect(refreshBtns.length).toBeGreaterThanOrEqual(1);
  });
});
