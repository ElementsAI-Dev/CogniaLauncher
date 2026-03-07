import { act, renderHook } from "@testing-library/react";
import { useToolboxMarketplace } from "@/hooks/use-toolbox-marketplace";
import { usePluginStore } from "@/lib/stores/plugin";
import { useToolboxStore } from "@/lib/stores/toolbox";

const mockInstallMarketplacePlugin = jest.fn();
const mockUpdatePlugin = jest.fn();
const mockFetchPlugins = jest.fn();

jest.mock("@/hooks/use-plugins", () => ({
  usePlugins: () => ({
    fetchPlugins: mockFetchPlugins,
    installMarketplacePlugin: mockInstallMarketplacePlugin,
    updatePlugin: mockUpdatePlugin,
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => true,
}));

describe("useToolboxMarketplace", () => {
  beforeEach(() => {
    mockFetchPlugins.mockReset().mockResolvedValue(undefined);
    mockInstallMarketplacePlugin
      .mockReset()
      .mockResolvedValue("com.cognia.hello-world");
    mockUpdatePlugin.mockReset().mockResolvedValue(undefined);
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

    expect(mockInstallMarketplacePlugin).toHaveBeenCalledWith(
      listing.source.storeId,
    );
    expect(useToolboxStore.getState().continuationHint?.listingId).toBe(
      listing.id,
    );
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
});
