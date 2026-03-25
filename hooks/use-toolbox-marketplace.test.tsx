import { act, renderHook } from "@testing-library/react";
import { useToolboxMarketplace } from "@/hooks/use-toolbox-marketplace";
import { usePluginStore } from "@/lib/stores/plugin";
import { useToolboxStore } from "@/lib/stores/toolbox";

const mockInstallMarketplacePlugin = jest.fn();
const mockInstallMarketplacePluginWithResult = jest.fn();
const mockUpdatePlugin = jest.fn();
const mockUpdatePluginWithResult = jest.fn();
const mockFetchPlugins = jest.fn();

jest.mock("@/hooks/use-plugins", () => ({
  usePlugins: () => ({
    fetchPlugins: mockFetchPlugins,
    installMarketplacePlugin: mockInstallMarketplacePlugin,
    installMarketplacePluginWithResult: mockInstallMarketplacePluginWithResult,
    updatePlugin: mockUpdatePlugin,
    updatePluginWithResult: mockUpdatePluginWithResult,
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => true,
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

describe("useToolboxMarketplace", () => {
  beforeEach(() => {
    mockFetchPlugins.mockReset().mockResolvedValue(undefined);
    mockInstallMarketplacePlugin
      .mockReset()
      .mockResolvedValue("com.cognia.hello-world");
    mockInstallMarketplacePluginWithResult.mockReset().mockResolvedValue({
      ok: true,
      action: "install",
      pluginId: "com.cognia.hello-world",
      phase: "completed",
      downloadTaskId: null,
      error: null,
    });
    mockUpdatePlugin.mockReset().mockResolvedValue(undefined);
    mockUpdatePluginWithResult.mockReset().mockResolvedValue({
      ok: true,
      action: "update",
      pluginId: "com.cognia.hello-world",
      phase: "completed",
      downloadTaskId: null,
      error: null,
    });
    usePluginStore.setState({
      ...usePluginStore.getState(),
      installedPlugins: [],
      pendingUpdates: [],
      marketplaceCatalog: null,
      marketplaceCatalogSource: null,
      marketplaceSyncState: "idle",
      marketplaceLastSyncedAt: null,
      marketplaceLastError: null,
    });
    useToolboxStore.setState({
      ...useToolboxStore.getState(),
      continuationHint: null,
    });
  });

  it("exposes bundled listings and featured subsets", () => {
    const { result } = renderHook(() => useToolboxMarketplace());

    expect(result.current.listings.length).toBeGreaterThan(0);
    expect(result.current.featuredListings.length).toBeGreaterThan(0);
    expect(result.current.categories).toContain("developer");
    expect(result.current.catalogSource).toBe("bundled");
  });

  it("records continuation hint after marketplace install", async () => {
    const { result } = renderHook(() => useToolboxMarketplace());
    const listing = result.current.listings[0];

    await act(async () => {
      await result.current.installListing(listing);
    });

    expect(mockInstallMarketplacePluginWithResult).toHaveBeenCalledWith(
      listing.source.storeId,
    );
    expect(useToolboxStore.getState().continuationHint?.listingId).toBe(
      listing.id,
    );
    expect(
      usePluginStore.getState().marketplaceAcquisitions[listing.pluginId],
    ).toEqual(
      expect.objectContaining({
        pluginId: listing.pluginId,
        listingId: listing.id,
        storeId: listing.source.storeId,
        action: "install",
        outcome: "succeeded",
      }),
    );
    expect(result.current.lastActionError).toBeNull();
  });

  it("exposes degraded cached state when refresh fails with cached data available", async () => {
    const { result } = renderHook(() => useToolboxMarketplace());
    const cachedCatalog = result.current.catalog;

    act(() => {
      usePluginStore.setState({
        ...usePluginStore.getState(),
        marketplaceCatalog: cachedCatalog,
        marketplaceCatalogSource: "cached",
        marketplaceSyncState: "ready",
        marketplaceLastSyncedAt: "2026-03-06T12:00:00.000Z",
      });
    });

    mockFetchPlugins.mockReset().mockRejectedValue(new Error("sync failed"));

    await act(async () => {
      await result.current.refreshCatalog();
    });

    expect(result.current.catalogSource).toBe("cached");
    expect(result.current.syncState).toBe("degraded");
    expect(result.current.lastError).toBe("sync failed");
  });

  it("sets actionable compatibility error without running install when listing is blocked", async () => {
    const { result } = renderHook(() => useToolboxMarketplace());
    const blockedListing = {
      ...result.current.listings[0],
      installState: "blocked" as const,
      blockedReason: "Requires CogniaLauncher 9.9.9.",
      compatible: false,
    };

    await act(async () => {
      await result.current.installListing(blockedListing);
    });

    expect(mockInstallMarketplacePluginWithResult).not.toHaveBeenCalled();
    expect(result.current.lastActionError?.category).toBe(
      "compatibility_blocked",
    );
    expect(result.current.lastActionError?.retryable).toBe(false);
  });

  it("sets retryable error on failed marketplace update", async () => {
    mockUpdatePluginWithResult.mockReset().mockResolvedValue({
      ok: false,
      action: "update",
      pluginId: "com.cognia.hello-world",
      phase: "failed",
      downloadTaskId: "task-999",
      error: {
        category: "source_unavailable",
        message: "network timeout",
        retryable: true,
      },
    });

    const { result } = renderHook(() => useToolboxMarketplace());
    const listing = {
      ...result.current.listings[0],
      installState: "update-available" as const,
      pendingUpdate: {
        pluginId: "com.cognia.hello-world",
        currentVersion: "0.0.1",
        latestVersion: "0.1.0",
        downloadUrl: "https://example.invalid",
        changelog: null,
      },
      installedPlugin: {
        id: "com.cognia.hello-world",
        name: "Hello World",
        version: "0.0.1",
        description: "Demo",
        authors: [],
        toolCount: 1,
        enabled: true,
        installedAt: "2026-03-06T00:00:00.000Z",
        updatedAt: null,
        updateUrl: null,
        source: { type: "store" as const, storeId: "hello-world-rust" },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
      },
    };

    await act(async () => {
      await result.current.updateListing(listing);
    });

    expect(result.current.lastActionError?.kind).toBe("marketplace-update");
    expect(result.current.lastActionError?.category).toBe("source_unavailable");
    expect(result.current.lastActionError?.retryable).toBe(true);
    expect(result.current.lastActionProgress?.phase).toBe("failed");
    expect(result.current.lastActionProgress?.downloadTaskId).toBe("task-999");
    expect(
      usePluginStore.getState().marketplaceAcquisitions["com.cognia.hello-world"],
    ).toEqual(
      expect.objectContaining({
        pluginId: "com.cognia.hello-world",
        action: "update",
        outcome: "failed",
        downloadTaskId: "task-999",
      }),
    );
  });

  it("uses localized fallback copy when marketplace update fails without an explicit message", async () => {
    mockUpdatePluginWithResult.mockReset().mockResolvedValue({
      ok: false,
      action: "update",
      pluginId: "com.cognia.hello-world",
      phase: "failed",
      downloadTaskId: null,
      error: null,
    });

    const { result } = renderHook(() => useToolboxMarketplace());
    const listing = {
      ...result.current.listings[0],
      installState: "update-available" as const,
      pendingUpdate: {
        pluginId: "com.cognia.hello-world",
        currentVersion: "0.0.1",
        latestVersion: "0.1.0",
        downloadUrl: "https://example.invalid",
        changelog: null,
      },
      installedPlugin: {
        id: "com.cognia.hello-world",
        name: "Hello World",
        version: "0.0.1",
        description: "Demo",
        authors: [],
        toolCount: 1,
        enabled: true,
        installedAt: "2026-03-06T00:00:00.000Z",
        updatedAt: null,
        updateUrl: null,
        source: { type: "store" as const, storeId: "hello-world-rust" },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
      },
    };

    await act(async () => {
      await result.current.updateListing(listing);
    });

    expect(result.current.lastActionError?.message).toBe(
      "Marketplace update failed.",
    );
  });

  it("uses localized compatibility fallback copy when blocked listing has no explicit reason", async () => {
    const { result } = renderHook(() => useToolboxMarketplace());
    const blockedListing = {
      ...result.current.listings[0],
      installState: "blocked" as const,
      blockedReason: null,
      compatible: false,
    };

    await act(async () => {
      await result.current.installListing(blockedListing);
    });

    expect(result.current.lastActionError?.message).toBe(
      "Compatibility requirements are not satisfied.",
    );
  });
});
