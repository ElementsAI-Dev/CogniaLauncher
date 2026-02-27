import { render, screen, act } from "@testing-library/react";
import { CacheDetailPageClient } from "./cache-detail-page";

const mockCacheInfo = jest.fn();
const mockGetCacheAccessStats = jest.fn();
const mockListCacheEntries = jest.fn();
let mockIsTauri = false;

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const mockCacheCleanEnhanced = jest.fn();
const mockCacheVerify = jest.fn();
const mockDeleteCacheEntries = jest.fn();
const mockDeleteCacheEntry = jest.fn();

jest.mock("@/lib/tauri", () => ({
  get isTauri() {
    return () => mockIsTauri;
  },
  get cacheInfo() {
    return mockCacheInfo;
  },
  get getCacheAccessStats() {
    return mockGetCacheAccessStats;
  },
  get listCacheEntries() {
    return mockListCacheEntries;
  },
  get cacheCleanEnhanced() {
    return mockCacheCleanEnhanced;
  },
  get cacheVerify() {
    return mockCacheVerify;
  },
  get deleteCacheEntries() {
    return mockDeleteCacheEntries;
  },
  get deleteCacheEntry() {
    return mockDeleteCacheEntry;
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

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(),
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

jest.mock("./cache-detail-external", () => ({
  CacheDetailExternalView: () => <div data-testid="external-view">External View</div>,
}));

const cacheInfoData = {
  download_cache: {
    entry_count: 42,
    size_human: "1.5 GB",
    location: "C:\\cache\\downloads",
  },
  metadata_cache: {
    entry_count: 120,
    size_human: "256 MB",
    location: "C:\\cache\\metadata",
  },
};

const accessStatsData = {
  hit_rate: 0.85,
  hits: 170,
  misses: 30,
};

const entriesResult = {
  entries: [
    {
      key: "pkg-react-19.0.0",
      file_path: "C:\\cache\\downloads\\react-19.0.0.tgz",
      entry_type: "download",
      size_human: "1.2 MB",
      hit_count: 5,
      created_at: "2025-01-01T00:00:00Z",
      last_accessed: "2025-06-01T00:00:00Z",
      checksum: "abc123def456",
    },
  ],
  total_count: 1,
};

describe("CacheDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = false;
    mockCacheInfo.mockResolvedValue(cacheInfoData);
    mockGetCacheAccessStats.mockResolvedValue(accessStatsData);
    mockListCacheEntries.mockResolvedValue(entriesResult);
  });

  it("renders without crashing for invalid type", () => {
    const { container } = render(<CacheDetailPageClient cacheType="invalid" />);
    expect(container).toBeInTheDocument();
  });

  it("shows unknown type message for invalid cacheType", () => {
    render(<CacheDetailPageClient cacheType="invalid" />);
    expect(screen.getByText(/Unknown cache type: invalid/)).toBeInTheDocument();
  });

  it("renders back-to-cache link for invalid type", () => {
    render(<CacheDetailPageClient cacheType="invalid" />);
    expect(screen.getByText("cache.detail.backToCache")).toBeInTheDocument();
  });

  it("delegates to CacheDetailExternalView for external type", () => {
    render(<CacheDetailPageClient cacheType="external" />);
    expect(screen.getByTestId("external-view")).toBeInTheDocument();
  });

  it("renders download title for download type", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByText("cache.detail.downloadTitle")).toBeInTheDocument();
  });

  it("renders metadata title for metadata type", () => {
    render(<CacheDetailPageClient cacheType="metadata" />);
    expect(screen.getByText("cache.detail.metadataTitle")).toBeInTheDocument();
  });

  it("renders download description", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByText("cache.detail.downloadDescription")).toBeInTheDocument();
  });

  it("renders clean and verify buttons for download type", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByText("cache.detail.cleanThisCache")).toBeInTheDocument();
    expect(screen.getByText("cache.detail.verifyThisCache")).toBeInTheDocument();
  });

  it("renders use trash switch", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByText("cache.useTrash")).toBeInTheDocument();
  });

  it("renders entry browser card", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByText("cache.detail.entryBrowser")).toBeInTheDocument();
    expect(screen.getByText("cache.detail.entryBrowserDesc")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByPlaceholderText("cache.searchPlaceholder")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByText("cache.detail.entryKey")).toBeInTheDocument();
    expect(screen.getByText("cache.detail.entryType")).toBeInTheDocument();
    expect(screen.getByText("cache.detail.entrySize")).toBeInTheDocument();
    expect(screen.getByText("cache.detail.entryHitCount")).toBeInTheDocument();
    expect(screen.getByText("cache.detail.entryCreated")).toBeInTheDocument();
  });

  it("shows no entries message for non-Tauri", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByText("cache.detail.noEntriesForType")).toBeInTheDocument();
  });

  it("displays stats cards with data when in Tauri mode", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("1.5 GB")).toBeInTheDocument();
    expect(screen.getByText("85.0%")).toBeInTheDocument();
  });

  it("displays entries table when data loaded", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText("pkg-react-19.0.0")).toBeInTheDocument();
  });

  it("shows hit/miss counts in stats", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText(/170/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  it("shows skeleton loading state for stats when no data", () => {
    mockIsTauri = false;
    render(<CacheDetailPageClient cacheType="download" />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });

  it("calls handleRefresh on refresh button click", async () => {
    mockIsTauri = true;
    const { toast } = jest.requireMock("sonner");
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    const refreshBtns = screen.getAllByText(/cache\.refreshSuccess/);
    const refreshBtn = refreshBtns[0].closest("button");
    if (refreshBtn) {
      await act(async () => {
        refreshBtn.click();
      });
    }
    await act(async () => {});
    expect(toast.success).toHaveBeenCalled();
  });

  it("renders entry data with file path", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText("C:\\cache\\downloads\\react-19.0.0.tgz")).toBeInTheDocument();
  });

  it("renders entry type badge", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText("download")).toBeInTheDocument();
  });

  it("renders entry hit count", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders entry size", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText("1.2 MB")).toBeInTheDocument();
  });

  it("shows storage location", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText("C:\\cache\\downloads")).toBeInTheDocument();
  });

  it("shows back link for valid download type", () => {
    render(<CacheDetailPageClient cacheType="download" />);
    expect(screen.getByText("cache.detail.backToCache")).toBeInTheDocument();
  });

  it("formats null date as never accessed", async () => {
    mockIsTauri = true;
    mockListCacheEntries.mockResolvedValue({
      entries: [
        {
          key: "null-date-key",
          file_path: "/tmp/test",
          entry_type: "download",
          size_human: "1 KB",
          hit_count: 0,
          created_at: null,
          last_accessed: null,
          checksum: "abc",
        },
      ],
      total_count: 1,
    });
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    const neverAccessed = screen.getAllByText("cache.detail.neverAccessed");
    expect(neverAccessed.length).toBeGreaterThanOrEqual(1);
  });

  it("shows metadata stats for metadata type", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="metadata" />);
    });
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("256 MB")).toBeInTheDocument();
  });

  it("calls cacheCleanEnhanced when clean confirmed", async () => {
    mockIsTauri = true;
    mockCacheCleanEnhanced.mockResolvedValue({ freed_human: "1.5 GB" });
    const { toast } = jest.requireMock("sonner");
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    // Click the clean button to open confirm dialog
    const cleanBtn = screen.getByText("cache.detail.cleanThisCache").closest("button")!;
    await act(async () => {
      cleanBtn.click();
    });
    // Confirm
    const confirmBtn = screen.getByText("cache.confirmClean");
    await act(async () => {
      confirmBtn.click();
    });
    await act(async () => {});
    expect(mockCacheCleanEnhanced).toHaveBeenCalledWith("downloads", true);
    expect(toast.success).toHaveBeenCalled();
  });

  it("calls cacheVerify when verify button clicked", async () => {
    mockIsTauri = true;
    mockCacheVerify.mockResolvedValue({
      is_healthy: true,
      missing_files: 0,
      corrupted_files: 0,
      size_mismatches: 0,
    });
    const { toast } = jest.requireMock("sonner");
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    const verifyBtn = screen.getByText("cache.detail.verifyThisCache").closest("button")!;
    await act(async () => {
      verifyBtn.click();
    });
    await act(async () => {});
    expect(mockCacheVerify).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows warning toast when verify finds issues", async () => {
    mockIsTauri = true;
    mockCacheVerify.mockResolvedValue({
      is_healthy: false,
      missing_files: 2,
      corrupted_files: 1,
      size_mismatches: 0,
    });
    const { toast } = jest.requireMock("sonner");
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    const verifyBtn = screen.getByText("cache.detail.verifyThisCache").closest("button")!;
    await act(async () => {
      verifyBtn.click();
    });
    await act(async () => {});
    expect(toast.warning).toHaveBeenCalled();
  });

  it("toggles entry selection via checkbox", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    // Find the entry row checkbox (not the header checkbox)
    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is header select-all, second is the entry
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      checkboxes[1].click();
    });
    // After selecting, batch action bar should appear
    expect(screen.getByText(/cache\.detail\.batchDelete/)).toBeInTheDocument();
  });

  it("toggles select all entries", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    // Click the header checkbox to select all
    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      checkboxes[0].click();
    });
    expect(screen.getByText(/cache\.detail\.batchDelete/)).toBeInTheDocument();
  });

  it("opens entry detail dialog on row click", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    // Click the entry key to open detail dialog
    const entryKey = screen.getByText("pkg-react-19.0.0");
    await act(async () => {
      entryKey.closest("tr")!.click();
    });
    expect(screen.getByText("cache.detail.entryDetails")).toBeInTheDocument();
    expect(screen.getByText("cache.detail.entryChecksum")).toBeInTheDocument();
    expect(screen.getByText("abc123def456")).toBeInTheDocument();
  });

  it("calls deleteCacheEntry when delete entry clicked in detail dialog", async () => {
    mockIsTauri = true;
    mockDeleteCacheEntry.mockResolvedValue(undefined);
    const { toast } = jest.requireMock("sonner");
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    // Open detail dialog
    const entryKey = screen.getByText("pkg-react-19.0.0");
    await act(async () => {
      entryKey.closest("tr")!.click();
    });
    // Click delete button
    const deleteBtn = screen.getByText("cache.detail.deleteEntry").closest("button")!;
    await act(async () => {
      deleteBtn.click();
    });
    await act(async () => {});
    expect(mockDeleteCacheEntry).toHaveBeenCalledWith("pkg-react-19.0.0", true);
    expect(toast.success).toHaveBeenCalled();
  });

  it("copies checksum when copy button clicked in detail dialog", async () => {
    mockIsTauri = true;
    const { writeClipboard } = jest.requireMock("@/lib/clipboard");
    const { toast } = jest.requireMock("sonner");
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    // Open detail dialog
    const entryKey = screen.getByText("pkg-react-19.0.0");
    await act(async () => {
      entryKey.closest("tr")!.click();
    });
    // Find the copy button (ghost variant icon button)
    const copyBtns = document.querySelectorAll("[data-variant='ghost'][data-size='icon']");
    if (copyBtns.length > 0) {
      await act(async () => {
        (copyBtns[0] as HTMLElement).click();
      });
    }
    // writeClipboard should have been called
    expect(writeClipboard).toHaveBeenCalledWith("abc123def456");
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows pagination info when entries exist", async () => {
    mockIsTauri = true;
    await act(async () => {
      render(<CacheDetailPageClient cacheType="download" />);
    });
    expect(screen.getByText(/cache\.showingEntries/)).toBeInTheDocument();
  });

  it("cleans metadata type cache correctly", async () => {
    mockIsTauri = true;
    mockCacheCleanEnhanced.mockResolvedValue({ freed_human: "256 MB" });
    await act(async () => {
      render(<CacheDetailPageClient cacheType="metadata" />);
    });
    const cleanBtn = screen.getByText("cache.detail.cleanThisCache").closest("button")!;
    await act(async () => {
      cleanBtn.click();
    });
    const confirmBtn = screen.getByText("cache.confirmClean");
    await act(async () => {
      confirmBtn.click();
    });
    await act(async () => {});
    expect(mockCacheCleanEnhanced).toHaveBeenCalledWith("metadata", true);
  });
});
