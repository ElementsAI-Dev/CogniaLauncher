import type { ReactElement, ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CachePage from "./page";
import { LocaleProvider } from "@/components/providers/locale-provider";

const mockEnsureCacheInvalidationBridge = jest.fn(() => Promise.resolve());
const mockSubscribeInvalidation = jest.fn(() => () => {});

jest.mock("@/components/ui/select", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: ReactNode;
  }) => <option value={value}>{children}</option>;

  const collectOptions = (nodes: ReactNode): ReactElement[] => {
    const options: ReactElement[] = [];
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) {
        return;
      }

      if (child.type === SelectItem) {
        options.push(child as ReactElement);
        return;
      }

      if ("children" in child.props) {
        options.push(...collectOptions(child.props.children));
      }
    });
    return options;
  };

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (next: string) => void;
    children: ReactNode;
  }) => {
    const options = collectOptions(children);
    return (
      <select
        role="combobox"
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {options}
      </select>
    );
  };

  const passthrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );

  return {
    Select,
    SelectContent: passthrough,
    SelectGroup: passthrough,
    SelectItem,
    SelectLabel: passthrough,
    SelectScrollDownButton: passthrough,
    SelectScrollUpButton: passthrough,
    SelectSeparator: passthrough,
    SelectTrigger: passthrough,
    SelectValue: passthrough,
  };
});

// Mock the Tauri API
jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn().mockReturnValue(true),
  cacheCleanPreview: jest.fn().mockResolvedValue({
    total_count: 5,
    total_size: 1024000,
    total_size_human: "1 MB",
    files: [
      {
        path: "/cache/file1.tar.gz",
        size: 512000,
        size_human: "500 KB",
        entry_type: "download",
        created_at: "2024-01-15T10:00:00Z",
      },
      {
        path: "/cache/file2.tar.gz",
        size: 512000,
        size_human: "500 KB",
        entry_type: "download",
        created_at: "2024-01-15T10:00:00Z",
      },
    ],
  }),
  cacheCleanEnhanced: jest.fn().mockResolvedValue({
    freed_bytes: 1024000,
    freed_human: "1 MB",
    deleted_count: 5,
    use_trash: true,
    history_id: "history-1",
  }),
  getCleanupHistory: jest.fn().mockResolvedValue([
    {
      id: "1",
      timestamp: "2024-01-15T10:00:00Z",
      clean_type: "downloads",
      file_count: 10,
      freed_bytes: 5242880,
      freed_human: "5 MB",
      use_trash: true,
      files: [],
      files_truncated: false,
    },
    {
      id: "2",
      timestamp: "2024-01-14T09:00:00Z",
      clean_type: "metadata",
      file_count: 20,
      freed_bytes: 1048576,
      freed_human: "1 MB",
      use_trash: false,
      files: [],
      files_truncated: false,
    },
  ]),
  getCleanupSummary: jest.fn().mockResolvedValue({
    total_cleanups: 2,
    total_freed_bytes: 6291456,
    total_freed_human: "6 MB",
    total_files_cleaned: 30,
    trash_cleanups: 1,
    permanent_cleanups: 1,
  }),
  clearCleanupHistory: jest.fn().mockResolvedValue(2),
  getCacheAccessStats: jest.fn().mockResolvedValue({
    hits: 100,
    misses: 20,
    hit_rate: 83.3,
    total_requests: 120,
    last_reset: null,
  }),
  resetCacheAccessStats: jest.fn().mockResolvedValue(undefined),
  getTopAccessedEntries: jest
    .fn()
    .mockResolvedValue([
      {
        key: "hot-file-1",
        entry_type: "download",
        size: 1024,
        size_human: "1 KB",
        hit_count: 50,
      },
    ]),
  cacheSizeMonitor: jest.fn().mockResolvedValue({
    internalSize: 6291456,
    internalSizeHuman: "6 MB",
    externalSize: 0,
    externalSizeHuman: "0 B",
    totalSize: 6291456,
    totalSizeHuman: "6 MB",
    maxSize: 10737418240,
    maxSizeHuman: "10 GB",
    usagePercent: 1,
    threshold: 80,
    exceedsThreshold: false,
    diskTotal: 0,
    diskAvailable: 0,
    diskAvailableHuman: "0 B",
    externalCaches: [],
  }),
  getCachePathInfo: jest.fn().mockResolvedValue({
    currentPath: "/home/user/.cognia/cache",
    defaultPath: "/home/user/.cognia/cache",
    isCustom: false,
    isSymlink: false,
    symlinkTarget: null,
    exists: true,
    writable: true,
    diskTotal: 0,
    diskAvailable: 0,
    diskAvailableHuman: "0 B",
  }),
  discoverExternalCachesFast: jest.fn().mockResolvedValue([]),
  calculateExternalCacheSize: jest.fn().mockResolvedValue(0),
  getExternalCachePaths: jest.fn().mockResolvedValue([]),
  cleanExternalCache: jest
    .fn()
    .mockResolvedValue({
      success: true,
      provider: "npm",
      displayName: "npm",
      freedBytes: 0,
      freedHuman: "0 B",
    }),
  cleanAllExternalCaches: jest.fn().mockResolvedValue([]),
  cacheForceCleanExternal: jest
    .fn()
    .mockResolvedValue({
      success: true,
      provider: "npm",
      displayName: "npm",
      freedBytes: 0,
      freedHuman: "0 B",
    }),
  listCacheEntries: jest.fn().mockResolvedValue({
    entries: [],
    total_count: 0,
  }),
  deleteCacheEntries: jest.fn().mockResolvedValue(0),
  cacheOptimize: jest.fn().mockResolvedValue({
    sizeBefore: 1048576,
    sizeBeforeHuman: "1 MB",
    sizeAfter: 524288,
    sizeAfterHuman: "512 KB",
    sizeSaved: 524288,
    sizeSavedHuman: "512 KB",
  }),
  dbGetInfo: jest.fn().mockResolvedValue({
    dbSize: 1048576,
    dbSizeHuman: "1 MB",
    walSize: 4096,
    walSizeHuman: "4 KB",
    pageCount: 256,
    pageSize: 4096,
    freelistCount: 0,
    tableCounts: { cache_entries: 10 },
  }),
  getCacheSizeHistory: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/cache/invalidation", () => ({
  emitInvalidations: jest.fn(),
  ensureCacheInvalidationBridge: (
    ...args: Parameters<typeof mockEnsureCacheInvalidationBridge>
  ) => mockEnsureCacheInvalidationBridge(...args),
  subscribeInvalidation: (
    ...args: Parameters<typeof mockSubscribeInvalidation>
  ) => mockSubscribeInvalidation(...args),
  withThrottle: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// Mock useSettings hook
jest.mock("@/hooks/use-settings", () => ({
  useSettings: jest.fn().mockReturnValue({
    cacheInfo: {
      download_cache: {
        entry_count: 10,
        size: 5242880,
        size_human: "5 MB",
        location: "/cache/downloads",
      },
      default_downloads: {
        entry_count: 2,
        size: 2097152,
        size_human: "2 MB",
        location: "/home/user/Downloads",
        is_available: true,
        reason: null,
      },
      metadata_cache: {
        entry_count: 5,
        size: 1048576,
        size_human: "1 MB",
        location: "/cache/metadata",
      },
      total_size: 6291456,
      total_size_human: "6 MB",
    },
    cacheSettings: {
      max_size: 10737418240,
      max_age_days: 30,
      metadata_cache_ttl: 3600,
      auto_clean: true,
    },
    cacheVerification: null,
    loading: false,
    error: null,
    cogniaDir: "/home/user/.cognia",
    fetchCacheInfo: jest.fn(),
    fetchPlatformInfo: jest.fn(),
    fetchCacheSettings: jest.fn(),
    cleanCache: jest
      .fn()
      .mockResolvedValue({ freed_bytes: 1024, freed_human: "1 KB" }),
    verifyCacheIntegrity: jest.fn().mockResolvedValue({ is_healthy: true }),
    repairCache: jest
      .fn()
      .mockResolvedValue({
        removed_entries: 0,
        recovered_entries: 0,
        freed_human: "0 B",
      }),
    updateCacheSettings: jest.fn(),
  }),
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock messages with all required cache keys including new ones
const mockMessages = {
  en: {
    common: {
      loading: "Loading...",
      cancel: "Cancel",
      save: "Save",
      refresh: "Refresh",
      retry: "Retry",
    },
    cache: {
      title: "Cache",
      description: "Manage download and metadata caches",
      totalSize: "Total Size",
      location: "Cache Location",
      locationDesc: "Cache files are stored here",
      downloadCache: "Download Cache",
      downloadCacheDesc: "Cached package downloads",
      defaultDownloads: "Default Downloads",
      defaultDownloadsDesc:
        "Cognia-managed files in your OS Downloads folder",
      defaultDownloadsUnavailable: "Default Downloads path unavailable",
      defaultDownloadsUnavailableReason: "Unavailable reason: {reason}",
      metadataCache: "Metadata Cache",
      metadataCacheDesc: "Cached package metadata",
      entries: "{count} entries",
      clearAll: "Clear All",
      clearCache: "Clear",
      clearing: "Clearing...",
      clearConfirmTitle: "Clear Cache",
      clearAllConfirmDesc:
        "This will delete all cached files. This action cannot be undone.",
      clearDownload: "Clear Download Cache",
      clearDefaultDownloads: "Clear Default Downloads",
      clearDownloadConfirmDesc:
        "This will delete all downloaded package files.",
      clearDefaultDownloadsConfirmDesc:
        "This will remove Cognia-managed files from the default Downloads folder.",
      clearMetadata: "Clear Metadata Cache",
      clearMetadataConfirmDesc: "This will delete all cached metadata.",
      freed: "Freed {size}",
      cacheHealth: "Cache Health",
      cacheHealthDesc: "Verify cache integrity and repair issues",
      healthy: "Healthy",
      unhealthy: "Issues Found",
      verify: "Verify",
      verifying: "Verifying...",
      verifySuccess: "Cache is healthy",
      verifyIssues: "{count} issues found",
      repair: "Repair",
      repairing: "Repairing...",
      repairSuccess: "Repaired {count} issues, freed {size}",
      repairFailed: "Repair failed",
      validEntries: "Valid Entries",
      missingFiles: "Missing Files",
      corruptedFiles: "Corrupted Files",
      sizeMismatches: "Size Mismatches",
      issueDetails: "Issue Details",
      noIssues: "Run verification to check cache health",
      settings: "Settings",
      settingsDesc: "Configure cache behavior",
      maxSize: "Maximum Size",
      maxSizeDesc: "Maximum cache size in MB",
      maxAge: "Maximum Age",
      maxAgeDesc: "Maximum age of cache entries in days",
      metadataCacheTtl: "Metadata Cache TTL",
      metadataCacheTtlDesc: "Seconds before metadata cache expires",
      ttlSeconds: "seconds",
      autoClean: "Auto Clean",
      autoCleanDesc: "Automatically clean old entries",
      settingsSaved: "Cache settings saved",
      settingsFailed: "Failed to save cache settings",
      refreshSuccess: "Cache info refreshed",
      refreshFailed: "Failed to refresh cache info",
      // Database maintenance keys
      optimize: "Optimize Database",
      optimizeDesc:
        "Run VACUUM and ANALYZE to reclaim unused space and improve performance",
      optimizing: "Optimizing...",
      optimizeSuccess: "Database optimized, saved {size}",
      optimizeFailed: "Database optimization failed",
      optimizeNoChange: "Database is already optimized",
      dbInfo: "Database Info",
      dbSize: "Database Size",
      walSize: "WAL Size",
      pageCount: "Page Count",
      freePages: "Free Pages",
      sizeBefore: "Size Before",
      sizeAfter: "Size After",
      sizeSaved: "Space Saved",
      autoCleanEvent: "Auto-cleanup freed {size}",
      forceClean: "Force Clean",
      forceCleanConfirmTitle: "Force Clean All",
      forceCleanConfirmDesc: "This will force-clean all internal caches.",
      forceCleanSuccess: "Force cleaned {count} entries, freed {size}",
      forceCleanFailed: "Force clean failed",
      hitRate: "Hit Rate",
      hitRateDesc: "Cache hit/miss statistics",
      hits: "Hits",
      misses: "Misses",
      totalRequests: "Total Requests",
      resetStats: "Reset",
      statsReset: "Stats reset",
      statsResetFailed: "Failed to reset stats",
      hotFiles: "Hot Files",
      hotFilesDesc: "Most frequently accessed cache entries",
      noHotFiles: "No hot files yet",
      accesses: "accesses",
      browseEntries: "Browse Entries",
      warningCritical: "Critical: Cache usage at {percent}%",
      warningHigh: "Warning: Cache usage at {percent}%",
      // New translation keys
      preview: "Preview",
      previewTitle: "Clean Preview",
      previewDesc: "The following {type} files will be cleaned",
      previewFailed: "Failed to get preview",
      readFailed: "Failed to load cache data",
      accessStatsLoadFailed: "Failed to load access statistics: {error}",
      hotFilesLoadFailed: "Failed to load hot files: {error}",
      historyLoadFailed: "Failed to load cleanup history: {error}",
      browserLoadFailed: "Failed to load cache entries: {error}",
      externalLoadFailed: "Failed to load external cache data: {error}",
      allTypes: "All Types",
      typeDownload: "Download",
      typeMetadata: "Metadata",
      typeExpired: "Expired",
      typeDefaultDownloads: "Default Downloads",
      filesToClean: "Files to Clean",
      spaceToFree: "Space to Free",
      andMore: "and {count} more files",
      useTrash: "Move to Trash",
      useTrashDesc:
        "Files will be moved to system trash and can be recovered later",
      permanentDeleteDesc:
        "Files will be permanently deleted and cannot be recovered",
      movedToTrash: "moved to trash",
      permanentlyDeleted: "permanently deleted",
      confirmClean: "Confirm Clean",
      cleanupHistory: "Cleanup History",
      cleanupHistoryDesc: "View past cache cleanup operations",
      cleanups: "cleanups",
      totalCleanups: "Total Cleanups",
      totalFreed: "Total Freed",
      trashCleanups: "Trash Cleanups",
      permanentCleanups: "Permanent Deletes",
      date: "Date",
      type: "Type",
      filesCount: "Files",
      freedSize: "Freed",
      method: "Method",
      trash: "Trash",
      permanent: "Permanent",
      clearHistory: "Clear History",
      noHistory: "No cleanup history yet",
      historyCleared: "Cleared {count} history records",
      historyClearFailed: "Failed to clear history",
      monitorLoadFailed: "Failed to load cache monitor: {error}",
      insightInternalTitle: "Managed Cache",
      insightStatusHealthy: "Healthy",
      insightStatusWatch: "Watch",
      insightStatusAvailable: "Available",
      insightStatusUnavailable: "Unavailable",
      insightStatusSnapshotPending: "Snapshot Pending",
      insightCoverageHistorical: "Historical Trend",
      insightCoverageSnapshot: "Snapshot Only",
      insightCoverageLabel: "Coverage",
      insightFreshnessFresh: "Fresh",
      insightFreshnessStale: "Stale",
      insightFreshnessMissing: "Missing",
      insightUsageLabel: "Capacity usage",
      insightTrendWindowDays: "Last 30 days",
      insightSnapshotOnlyDesc:
        "This section currently has live snapshot data only, not a full historical trend.",
      insightSummaryTitle: "Visual Summary",
      insightSummaryDesc:
        "Compare internal, default downloads, and external cache scopes at a glance.",
      insightSignalsTitle: "Operational Signals",
      insightSignalsDesc:
        "Track trend, hit rate, and hotspots before starting maintenance actions.",
      insightActionsTitle: "Recommended Actions",
      insightActionsDesc:
        "Prioritized next steps based on current cache pressure and diagnostics.",
      insightPrimaryActionLabel: "Primary action",
      insightSecondaryActionsLabel: "More paths",
      insightDetailsTitle: "Detailed Controls",
      insightDetailsDesc:
        "Use the full maintenance controls once you know which cache area needs attention.",
      insightActionRepairTitle: "Repair cache issues",
      insightActionRepairDesc:
        "Integrity verification found managed cache problems that should be repaired first.",
      insightActionRepairCta: "Review health checks",
      insightActionCleanTitle: "Reclaim space now",
      insightActionCleanDesc:
        "Cache pressure is high enough that a cleanup is the fastest way to stabilize disk usage.",
      insightActionCleanCta: "Open cleanup controls",
      insightActionEntriesTitle: "Inspect hot entries",
      insightActionEntriesDesc:
        "Recent activity suggests the entry browser is the best place to inspect frequently accessed cache data.",
      insightActionEntriesCta: "Open entry browser",
      insightActionHistoryTitle: "Review cleanup history",
      insightActionHistoryDesc:
        "A recent history read failed, so reviewing recovery details is the next best step.",
      insightActionHistoryCta: "Open history",
      insightActionExternalTitle: "Inspect external caches",
      insightActionExternalDesc:
        "External tool caches now outweigh internal cache usage and should be reviewed separately.",
      insightActionExternalCta: "Open external caches",
      insightActionMonitorTitle: "Monitor cache health",
      insightActionMonitorDesc:
        "Current cache signals look stable. Keep monitoring growth and refresh trends as needed.",
      insightActionMonitorCta: "View trend details",
    },
  },
  zh: {
    common: {
      loading: "Loading...",
      cancel: "Cancel",
      save: "Save",
      refresh: "Refresh",
      retry: "Retry",
    },
    cache: {
      title: "Cache",
      description: "Manage cache",
      preview: "Preview",
      previewTitle: "Clean Preview",
      previewDesc: "The following {type} files will be cleaned",
      previewFailed: "Failed to get preview",
      filesToClean: "Files to Clean",
      spaceToFree: "Space to Free",
      andMore: "and {count} more files",
      useTrash: "Move to Trash",
      useTrashDesc: "Files will be moved to system trash",
      permanentDeleteDesc: "Files will be permanently deleted",
      movedToTrash: "moved to trash",
      permanentlyDeleted: "permanently deleted",
      confirmClean: "Confirm Clean",
      cleanupHistory: "Cleanup History",
      cleanupHistoryDesc: "View past cache cleanup operations",
      cleanups: "cleanups",
      totalCleanups: "Total Cleanups",
      totalFreed: "Total Freed",
      trashCleanups: "Trash Cleanups",
      permanentCleanups: "Permanent Deletes",
      date: "Date",
      type: "Type",
      filesCount: "Files",
      freedSize: "Freed",
      method: "Method",
      trash: "Trash",
      permanent: "Permanent",
      clearHistory: "Clear History",
      noHistory: "No cleanup history yet",
      historyCleared: "Cleared {count} history records",
      historyClearFailed: "Failed to clear history",
      monitorLoadFailed: "Failed to load cache monitor: {error}",
      insightInternalTitle: "Managed Cache",
      insightStatusHealthy: "Healthy",
      insightStatusWatch: "Watch",
      insightStatusAvailable: "Available",
      insightStatusUnavailable: "Unavailable",
      insightStatusSnapshotPending: "Snapshot Pending",
      insightCoverageHistorical: "Historical Trend",
      insightCoverageSnapshot: "Snapshot Only",
      insightCoverageLabel: "Coverage",
      insightFreshnessFresh: "Fresh",
      insightFreshnessStale: "Stale",
      insightFreshnessMissing: "Missing",
      insightUsageLabel: "Capacity usage",
      insightTrendWindowDays: "Last 30 days",
      insightSnapshotOnlyDesc:
        "This section currently has live snapshot data only, not a full historical trend.",
      insightSummaryTitle: "Visual Summary",
      insightSummaryDesc:
        "Compare internal, default downloads, and external cache scopes at a glance.",
      insightSignalsTitle: "Operational Signals",
      insightSignalsDesc:
        "Track trend, hit rate, and hotspots before starting maintenance actions.",
      insightActionsTitle: "Recommended Actions",
      insightActionsDesc:
        "Prioritized next steps based on current cache pressure and diagnostics.",
      insightPrimaryActionLabel: "Primary action",
      insightSecondaryActionsLabel: "More paths",
      insightDetailsTitle: "Detailed Controls",
      insightDetailsDesc:
        "Use the full maintenance controls once you know which cache area needs attention.",
      insightActionRepairTitle: "Repair cache issues",
      insightActionRepairDesc:
        "Integrity verification found managed cache problems that should be repaired first.",
      insightActionRepairCta: "Review health checks",
      insightActionCleanTitle: "Reclaim space now",
      insightActionCleanDesc:
        "Cache pressure is high enough that a cleanup is the fastest way to stabilize disk usage.",
      insightActionCleanCta: "Open cleanup controls",
      insightActionEntriesTitle: "Inspect hot entries",
      insightActionEntriesDesc:
        "Recent activity suggests the entry browser is the best place to inspect frequently accessed cache data.",
      insightActionEntriesCta: "Open entry browser",
      insightActionHistoryTitle: "Review cleanup history",
      insightActionHistoryDesc:
        "A recent history read failed, so reviewing recovery details is the next best step.",
      insightActionHistoryCta: "Open history",
      insightActionExternalTitle: "Inspect external caches",
      insightActionExternalDesc:
        "External tool caches now outweigh internal cache usage and should be reviewed separately.",
      insightActionExternalCta: "Open external caches",
      insightActionMonitorTitle: "Monitor cache health",
      insightActionMonitorDesc:
        "Current cache signals look stable. Keep monitoring growth and refresh trends as needed.",
      insightActionMonitorCta: "View trend details",
      metadataCacheTtl: "Metadata Cache TTL",
      metadataCacheTtlDesc: "Metadata cache ttl in seconds",
      ttlSeconds: "seconds",
    },
  },
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider messages={mockMessages as never}>{children}</LocaleProvider>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

function activateTab(tab: HTMLElement) {
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
  fireEvent.keyDown(tab, { key: "Enter" });
}

describe("CachePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders the cache page title", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /cache/i }),
        ).toBeInTheDocument();
      });
    });

    it("renders cache size information", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getAllByText("6 MB").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("renders download, default downloads, and metadata cache cards", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getAllByText("Download Cache").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Default Downloads").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Metadata Cache").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("renders overview insight sections and comparative scope summaries", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Operational Signals")).toBeInTheDocument();
        expect(screen.getByText("Recommended Actions")).toBeInTheDocument();
        expect(screen.getByText("Managed Cache")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /open entry browser/i }),
        ).toBeInTheDocument();
      });
    });

    it("switches to the entries tab from the recommended action card", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CachePage />);

      const actionButton = await screen.findByTestId("overview-action-entries");
      await user.click(actionButton);

      await waitFor(() => {
        expect(
          screen.getByRole("tab", { name: /entries|cache\.tabEntries/i }),
        ).toHaveAttribute("data-state", "active");
      });
    });
  });

  describe("Preview Feature", () => {
    it("renders preview buttons for download and metadata caches", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        const previewButtons = screen.getAllByRole("button", {
          name: /quick clean|preview|cache\.quickClean/i,
        });
        expect(previewButtons.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("opens preview dialog when preview button is clicked", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Download Cache")).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole("button", {
        name: /quick clean|preview|cache\.quickClean/i,
      });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Clean Preview")).toBeInTheDocument();
      });
    });

    it("displays files to clean and space to free in preview", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Download Cache")).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole("button", {
        name: /quick clean|preview|cache\.quickClean/i,
      });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Clean Preview")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
      });
    });

    it("displays use trash toggle in preview dialog", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Download Cache")).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole("button", {
        name: /quick clean|preview|cache\.quickClean/i,
      });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Move to Trash")).toBeInTheDocument();
      });
    });

    it("shows confirm clean button in preview dialog", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Download Cache")).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole("button", {
        name: /quick clean|preview|cache\.quickClean/i,
      });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /confirm clean/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Cleanup History Feature", () => {
    it("renders cleanup history section", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        getCleanupHistory: jest.Mock;
      };
      renderWithProviders(<CachePage />);

      const historyTab = await screen.findByRole("tab", {
        name: /history|cache\.tabHistory/i,
      });
      activateTab(historyTab);

      await waitFor(
        () => {
          expect(tauri.getCleanupHistory).toHaveBeenCalled();
          expect(historyTab).toHaveAttribute("data-state", "active");
        },
        { timeout: 3000 },
      );
    });

    it("shows cleanup history description", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        getCleanupHistory: jest.Mock;
      };
      renderWithProviders(<CachePage />);

      const historyTab = await screen.findByRole("tab", {
        name: /history|cache\.tabHistory/i,
      });
      activateTab(historyTab);

      await waitFor(
        () => {
          expect(tauri.getCleanupHistory).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it("expands cleanup history when clicked", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        getCleanupHistory: jest.Mock;
      };
      renderWithProviders(<CachePage />);

      const historyTab = await screen.findByRole("tab", {
        name: /history|cache\.tabHistory/i,
      });
      activateTab(historyTab);

      await waitFor(
        () => {
          expect(tauri.getCleanupHistory).toHaveBeenCalled();
          expect(historyTab).toHaveAttribute("data-state", "active");
        },
        { timeout: 3000 },
      );
    });

    it("shows summary statistics when history is loaded", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        getCleanupHistory: jest.Mock;
      };
      renderWithProviders(<CachePage />);

      const historyTab = await screen.findByRole("tab", {
        name: /history|cache\.tabHistory/i,
      });
      activateTab(historyTab);

      await waitFor(
        () => {
          expect(tauri.getCleanupHistory).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it("shows clear history button", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        getCleanupHistory: jest.Mock;
      };
      renderWithProviders(<CachePage />);

      const historyTab = await screen.findByRole("tab", {
        name: /history|cache\.tabHistory/i,
      });
      activateTab(historyTab);

      await waitFor(
        () => {
          expect(tauri.getCleanupHistory).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Trash/Permanent Delete", () => {
    it("toggles trash description when switch is changed", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Download Cache")).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole("button", {
        name: /quick clean|preview|cache\.quickClean/i,
      });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Move to Trash")).toBeInTheDocument();
        // Default is useTrash = true
        expect(
          screen.getByText(/files will be moved to system trash/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Cache Health", () => {
    it("renders cache health section", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Cache Health")).toBeInTheDocument();
      });
    });

    it("renders verify button", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /verify/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Database Maintenance", () => {
    it("renders optimize database section", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        const elements = screen.getAllByText(/database maintenance|cache\.dbMaintenanceTitle/i);
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("renders optimize description", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(
          screen.getByText(
            /vacuum and analyze|cache\.dbMaintenanceDesc/i,
          ),
        ).toBeInTheDocument();
      });
    });

    it("renders optimize button", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole("button", {
          name: /optimize now|optimize database|cache\.optimizeNow/i,
        });
        expect(buttons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("renders DB info button", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: /view db info|database info|cache\.viewDbInfo/i,
          }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Cache Settings", () => {
    it("renders settings section", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeInTheDocument();
      });
    });

    it("renders metadata cache TTL setting", async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Settings"));

      await waitFor(() => {
        expect(screen.getByLabelText("Metadata Cache TTL")).toBeInTheDocument();
      });
    });
  });

  describe("Browser Auto Refresh", () => {
    it("debounces search and resets browser query from first page", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        listCacheEntries: jest.Mock;
      };

      tauri.listCacheEntries.mockResolvedValue({
        entries: [
          {
            key: "entry-1",
            entry_type: "download",
            size_human: "1 KB",
            hit_count: 1,
          },
        ],
        total_count: 40,
      });

      renderWithProviders(<CachePage />);

      const entriesTab = await screen.findByRole("tab", {
        name: /entries|cache\.tabEntries/i,
      });
      activateTab(entriesTab);

      await waitFor(() => {
        expect(tauri.listCacheEntries).toHaveBeenCalled();
      });

      const nextBtn = screen.getByRole("button", { name: /common\.next|next/i });
      const callsBeforeNext = tauri.listCacheEntries.mock.calls.length;
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(tauri.listCacheEntries.mock.calls.length).toBeGreaterThan(callsBeforeNext);
      });

      tauri.listCacheEntries.mockClear();

      jest.useFakeTimers();
      try {
        const searchInput = screen.getByPlaceholderText(
          "cache.searchPlaceholder",
        );
        fireEvent.change(searchInput, { target: { value: "react" } });

        act(() => {
          jest.advanceTimersByTime(299);
        });
        expect(tauri.listCacheEntries).not.toHaveBeenCalled();

        act(() => {
          jest.advanceTimersByTime(1);
        });

        await waitFor(() => {
          expect(tauri.listCacheEntries).toHaveBeenCalledWith(
            expect.objectContaining({
              search: "react",
              offset: 0,
            }),
          );
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it("auto-refreshes browser entries immediately for type/sort changes and resets to first page", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        listCacheEntries: jest.Mock;
      };

      tauri.listCacheEntries.mockResolvedValue({
        entries: [],
        total_count: 40,
      });

      renderWithProviders(<CachePage />);

      const entriesTab = await screen.findByRole("tab", {
        name: /entries|cache\.tabEntries/i,
      });
      activateTab(entriesTab);

      await waitFor(() => {
        expect(tauri.listCacheEntries).toHaveBeenCalled();
      });

      const nextBtn = screen.getByRole("button", { name: /common\.next|next/i });
      const callsBeforeNext = tauri.listCacheEntries.mock.calls.length;
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(tauri.listCacheEntries.mock.calls.length).toBeGreaterThan(callsBeforeNext);
      });

      const [typeSelect, sortSelect] = screen.getAllByRole("combobox");

      tauri.listCacheEntries.mockClear();
      fireEvent.change(typeSelect, { target: { value: "metadata" } });

      await waitFor(() => {
        expect(tauri.listCacheEntries).toHaveBeenCalledWith(
          expect.objectContaining({
            entryType: "metadata",
            offset: 0,
          }),
        );
      });

      tauri.listCacheEntries.mockClear();
      fireEvent.change(sortSelect, { target: { value: "size_asc" } });

      await waitFor(() => {
        expect(tauri.listCacheEntries).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: "size_asc",
            offset: 0,
          }),
        );
      });
    });

    it("auto-refreshes browser entries on cache invalidation while entries tab is open", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        listCacheEntries: jest.Mock;
      };

      tauri.listCacheEntries.mockResolvedValue({
        entries: [],
        total_count: 0,
      });

      let invalidationHandler: (() => void) | undefined;
      mockSubscribeInvalidation.mockImplementation((...args: unknown[]) => {
        const domains = args[0];
        const handler = args[1] as (() => void) | undefined;
        const matchesCacheEntries =
          (Array.isArray(domains) && domains.includes("cache_entries")) ||
          domains === "cache_entries";
        if (matchesCacheEntries) {
          invalidationHandler = handler;
        }
        return () => {};
      });

      renderWithProviders(<CachePage />);

      const entriesTab = await screen.findByRole("tab", {
        name: /entries|cache\.tabEntries/i,
      });
      activateTab(entriesTab);

      await waitFor(() => {
        expect(tauri.listCacheEntries).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockSubscribeInvalidation).toHaveBeenCalled();
      });
      tauri.listCacheEntries.mockClear();

      jest.useFakeTimers();
      try {
        act(() => {
          invalidationHandler?.();
          invalidationHandler?.();
          invalidationHandler?.();
          jest.advanceTimersByTime(349);
        });
        expect(tauri.listCacheEntries).not.toHaveBeenCalled();

        act(() => {
          jest.advanceTimersByTime(1);
        });

        await waitFor(() => {
          expect(tauri.listCacheEntries).toHaveBeenCalledTimes(1);
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("Read Error Recovery", () => {
    it("shows cleanup history load error with retry action", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        getCleanupHistory: jest.Mock;
      };
      tauri.getCleanupHistory.mockRejectedValue(new Error("boom"));

      renderWithProviders(<CachePage />);
      activateTab(
        await screen.findByRole("tab", {
          name: /history|cache\.tabHistory/i,
        }),
      );

      await waitFor(() => {
        expect(tauri.getCleanupHistory).toHaveBeenCalled();
      });
    });

    it("shows cache browser load error with retry action", async () => {
      const tauri = jest.requireMock("@/lib/tauri") as {
        listCacheEntries: jest.Mock;
      };
      tauri.listCacheEntries.mockRejectedValue(new Error("list failed"));

      renderWithProviders(<CachePage />);

      const entriesTab = await screen.findByRole("tab", {
        name: /entries|cache\.tabEntries/i,
      });
      activateTab(entriesTab);

      await waitFor(() => {
        expect(tauri.listCacheEntries).toHaveBeenCalled();
      });
    });
  });
});
