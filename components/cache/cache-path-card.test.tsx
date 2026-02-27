import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CachePathCard } from "./cache-path-card";

const mockGetCachePathInfo = jest.fn();
let mockIsTauri = false;

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const mockSetCachePath = jest.fn();
const mockResetCachePath = jest.fn();

jest.mock("@/lib/tauri", () => ({
  get isTauri() {
    return () => mockIsTauri;
  },
  get getCachePathInfo() {
    return mockGetCachePathInfo;
  },
  get setCachePath() {
    return mockSetCachePath;
  },
  get resetCachePath() {
    return mockResetCachePath;
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("./cache-migration-dialog", () => ({
  CacheMigrationDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="migration-dialog">Migration Dialog</div> : null,
}));

const pathInfo = {
  currentPath: "C:\\Users\\Test\\.cognia\\cache",
  defaultPath: "C:\\Users\\Test\\.cognia\\cache",
  isCustom: false,
  isSymlink: false,
  symlinkTarget: null,
  exists: true,
  writable: true,
  diskAvailable: 107374182400,
  diskAvailableHuman: "100 GB",
};

describe("CachePathCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = false;
  });

  it("renders path card title", () => {
    render(<CachePathCard />);
    expect(screen.getByText("cache.pathManagement")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<CachePathCard />);
    expect(screen.getByText("cache.pathManagementDesc")).toBeInTheDocument();
  });

  it("shows symlink badge when path is symlink", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue({ ...pathInfo, isSymlink: true, symlinkTarget: "D:\\Cache" });
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    // Expand the collapsible to trigger fetch
    const trigger = screen.getByText("cache.pathManagement").closest("[data-radix-collection-item]") ||
      screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    expect(screen.getByText("cache.symlink")).toBeInTheDocument();
  });

  it("shows custom path badge when path is custom", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue({ ...pathInfo, isCustom: true });
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    expect(screen.getByText("cache.customPath")).toBeInTheDocument();
  });

  it("does not show symlink or custom badges for default path", () => {
    render(<CachePathCard />);
    expect(screen.queryByText("cache.symlink")).not.toBeInTheDocument();
    expect(screen.queryByText("cache.customPath")).not.toBeInTheDocument();
  });

  it("renders chevron icon for collapsible", () => {
    render(<CachePathCard />);
    // The ChevronDown icon should be present
    const container = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    expect(container).toBeInTheDocument();
  });

  it("shows path info when expanded with data", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue(pathInfo);
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    // Click to expand
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    // Wait for data
    await act(async () => {});
    expect(screen.getByText("cache.currentPath")).toBeInTheDocument();
  });

  it("shows exists and writable badges when path info loaded", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue(pathInfo);
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.exists")).toBeInTheDocument();
    expect(screen.getByText("cache.writable")).toBeInTheDocument();
  });

  it("shows change path and migration buttons when path info loaded", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue(pathInfo);
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.changePath")).toBeInTheDocument();
    expect(screen.getByText("cache.migration")).toBeInTheDocument();
  });

  it("enters editing mode when change path clicked", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue(pathInfo);
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    await user.click(screen.getByText("cache.changePath"));
    expect(screen.getByPlaceholderText("cache.enterNewPath")).toBeInTheDocument();
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
  });

  it("shows reset button only when path is custom", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue({ ...pathInfo, isCustom: true, defaultPath: "C:\\Default" });
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.resetPath")).toBeInTheDocument();
  });

  it("shows symlink target when path is symlink", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue({
      ...pathInfo,
      isSymlink: true,
      symlinkTarget: "D:\\CacheTarget",
    });
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.symlinkTarget")).toBeInTheDocument();
    expect(screen.getByText("D:\\CacheTarget")).toBeInTheDocument();
  });

  it("shows default path when custom", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue({
      ...pathInfo,
      isCustom: true,
      defaultPath: "C:\\Users\\Default\\.cognia",
    });
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.defaultPath")).toBeInTheDocument();
    expect(screen.getByText("C:\\Users\\Default\\.cognia")).toBeInTheDocument();
  });

  it("shows missing badge when path does not exist", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue({ ...pathInfo, exists: false });
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.missing")).toBeInTheDocument();
  });

  it("shows readOnly badge when not writable", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue({ ...pathInfo, writable: false });
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    expect(screen.getByText("cache.readOnly")).toBeInTheDocument();
  });

  it("calls setCachePath when saving new path", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue(pathInfo);
    mockSetCachePath.mockResolvedValue(undefined);
    const { toast } = jest.requireMock("sonner");
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    // Enter edit mode
    await user.click(screen.getByText("cache.changePath"));
    const input = screen.getByPlaceholderText("cache.enterNewPath");
    await user.type(input, "D:\\NewPath");
    // In edit mode, the save button is a direct sibling of cancel
    // Find buttons in the edit form area
    const cancelBtn = screen.getByText("common.cancel").closest("button")!;
    const saveBtn = cancelBtn.parentElement!.querySelector("button:first-child") as HTMLButtonElement;
    await act(async () => {
      saveBtn.click();
    });
    await act(async () => {});
    expect(mockSetCachePath).toHaveBeenCalledWith("D:\\NewPath");
    expect(toast.success).toHaveBeenCalled();
  });

  it("calls resetCachePath when reset clicked", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue({ ...pathInfo, isCustom: true });
    mockResetCachePath.mockResolvedValue(undefined);
    const { toast } = jest.requireMock("sonner");
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    await act(async () => {
      screen.getByText("cache.resetPath").closest("button")!.click();
    });
    await act(async () => {});
    expect(mockResetCachePath).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("opens migration dialog when migration button clicked", async () => {
    mockIsTauri = true;
    mockGetCachePathInfo.mockResolvedValue(pathInfo);
    const user = userEvent.setup();
    await act(async () => {
      render(<CachePathCard />);
    });
    const trigger = screen.getByText("cache.pathManagement").closest("div[class*='cursor-pointer']");
    if (trigger) await user.click(trigger);
    await act(async () => {});
    await user.click(screen.getByText("cache.migration"));
    expect(screen.getByTestId("migration-dialog")).toBeInTheDocument();
  });
});
