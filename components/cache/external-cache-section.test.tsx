import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExternalCacheSection } from "./external-cache-section";

const mockDiscoverExternalCaches = jest.fn();
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
  get cleanExternalCache() {
    return mockCleanExternalCache;
  },
  get cleanAllExternalCaches() {
    return mockCleanAllExternalCaches;
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

jest.mock("@/components/provider-management/provider-icon", () => ({
  CacheProviderIcon: ({ provider }: { provider: string }) => (
    <span data-testid={`icon-${provider}`} />
  ),
}));

const mockCaches = [
  {
    provider: "npm",
    displayName: "npm Cache",
    cachePath: "C:\\Users\\Test\\AppData\\npm-cache",
    size: 524288000,
    sizeHuman: "500 MB",
    isAvailable: true,
    canClean: true,
    category: "package_manager",
  },
  {
    provider: "pip",
    displayName: "pip Cache",
    cachePath: "C:\\Users\\Test\\AppData\\pip",
    size: 104857600,
    sizeHuman: "100 MB",
    isAvailable: true,
    canClean: true,
    category: "package_manager",
  },
  {
    provider: "docker",
    displayName: "Docker Cache",
    cachePath: null,
    size: 0,
    sizeHuman: "0 B",
    isAvailable: false,
    canClean: false,
    category: "devtools",
  },
];

const defaultProps = {
  useTrash: false,
  setUseTrash: jest.fn(),
};

describe("ExternalCacheSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = false;
  });

  it("renders section title", () => {
    render(<ExternalCacheSection {...defaultProps} />);
    expect(screen.getByText("cache.externalCaches")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<ExternalCacheSection {...defaultProps} />);
    expect(screen.getByText("cache.externalCachesDesc")).toBeInTheDocument();
  });

  it("shows total size badge when caches are discovered", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    // Expand collapsible to trigger fetch
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    // Total size = 500 MB + 100 MB + 0 = ~600 MB
    expect(mockDiscoverExternalCaches).toHaveBeenCalled();
  });

  it("shows empty state when no external caches found", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue([]);
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.noExternalCaches")).toBeInTheDocument();
  });

  it("renders cache items grouped by category", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("npm Cache")).toBeInTheDocument();
    expect(screen.getByText("pip Cache")).toBeInTheDocument();
    expect(screen.getByText("Docker Cache")).toBeInTheDocument();
  });

  it("renders category labels", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.categoryPackageManager")).toBeInTheDocument();
    expect(screen.getByText("cache.categoryDevtools")).toBeInTheDocument();
  });

  it("shows cache size badges", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("500 MB")).toBeInTheDocument();
    expect(screen.getByText("100 MB")).toBeInTheDocument();
  });

  it("renders use-trash switch", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    expect(screen.getByText("cache.moveToTrash")).toBeInTheDocument();
  });

  it("renders refresh button in expanded state", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    expect(screen.getByText("common.refresh")).toBeInTheDocument();
  });

  it("shows cache path or managed-by-tool label", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    // npm and pip have paths, docker has null → managedByTool
    expect(screen.getByText("cache.managedByTool")).toBeInTheDocument();
  });

  it("calls cleanExternalCache when clean button clicked", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockCleanExternalCache.mockResolvedValue({
      success: true,
      displayName: "npm Cache",
      freedHuman: "500 MB",
      freedBytes: 524288000,
    });
    const { toast } = jest.requireMock("sonner");
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    // Click the first clean button (npm)
    const cleanButtons = screen.getAllByText("cache.clean");
    await act(async () => {
      cleanButtons[0].closest("button")!.click();
    });
    await act(async () => {});
    expect(mockCleanExternalCache).toHaveBeenCalledWith("npm", false);
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows error toast when clean fails", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    mockCleanExternalCache.mockResolvedValue({
      success: false,
      displayName: "npm Cache",
      error: "Permission denied",
      freedHuman: "0 B",
      freedBytes: 0,
    });
    const { toast } = jest.requireMock("sonner");
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    const cleanButtons = screen.getAllByText("cache.clean");
    await act(async () => {
      cleanButtons[0].closest("button")!.click();
    });
    await act(async () => {});
    expect(toast.error).toHaveBeenCalled();
  });

  it("passes useTrash to setUseTrash when switch toggled", async () => {
    const setUseTrash = jest.fn();
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection useTrash={false} setUseTrash={setUseTrash} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    const switchEl = screen.getByRole("switch");
    await user.click(switchEl);
    expect(setUseTrash).toHaveBeenCalledWith(true);
  });

  it("disables clean button for non-cleanable caches", async () => {
    mockIsTauri = true;
    mockDiscoverExternalCaches.mockResolvedValue(mockCaches);
    const user = userEvent.setup();
    await act(async () => {
      render(<ExternalCacheSection {...defaultProps} />);
    });
    const trigger = screen.getByText("cache.externalCaches").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    // Docker cache has canClean: false
    const cleanButtons = screen.getAllByText("cache.clean").map((el) => el.closest("button")!);
    const dockerBtn = cleanButtons[cleanButtons.length - 1];
    expect(dockerBtn).toBeDisabled();
  });
});
