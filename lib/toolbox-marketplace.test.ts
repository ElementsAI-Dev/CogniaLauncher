import { APP_VERSION } from "@/lib/app-version";
import {
  buildMarketplaceListings,
  filterMarketplaceListings,
  normalizeMarketplaceCatalog,
} from "@/lib/toolbox-marketplace";
import type { PluginInfo, PluginUpdateInfo } from "@/types/plugin";
import type { ToolboxMarketplaceFilters } from "@/types/toolbox-marketplace";

const rawCatalog = {
  schemaVersion: 1,
  generatedAt: "2026-03-06T00:00:00.000Z",
  listings: [
    {
      id: "hello-world-rust",
      pluginId: "com.cognia.hello-world",
      name: "Hello World",
      description: "Rust example plugin.",
      version: "0.1.0",
      category: "developer",
      featured: true,
      authors: ["CogniaLauncher Team"],
      updatedAt: "2026-03-05T00:00:00.000Z",
      installCount: 1200,
      publisher: {
        id: "cognia",
        name: "CogniaLauncher Team",
        verified: true,
        url: "https://example.invalid/publisher/cognia",
      },
      support: {
        homepageUrl: "https://example.invalid/hello-world",
        documentationUrl: "https://example.invalid/hello-world/docs",
        issuesUrl: "https://example.invalid/hello-world/issues",
      },
      highlights: ["Fast setup", "Cross-runtime demo"],
      gallery: [
        {
          type: "image",
          url: "https://example.invalid/hello-world/cover.png",
          alt: "Hello World overview",
          caption: "Overview screenshot",
        },
      ],
      releaseNotes: "Adds richer environment inspection and onboarding hints.",
      minimumHostVersion: "0.1.0",
      toolContractVersion: "1.0.0",
      source: {
        type: "store",
        storeId: "store.hello-world-rust",
        pluginDir: "marketplace/hello-world-rust",
        artifact: "plugin.wasm",
        checksumSha256: "abc123",
      },
      permissions: ["env_read"],
      capabilities: ["environment.read"],
      tools: [
        {
          toolId: "hello",
          name: "Hello World",
          description: "Say hello",
          category: "developer",
          uiMode: "text",
        },
      ],
    },
    {
      id: "future-plugin",
      pluginId: "com.cognia.future",
      name: "Future Plugin",
      description: "Requires a newer host.",
      version: "9.9.9",
      category: "developer",
      featured: false,
      authors: ["CogniaLauncher Team"],
      updatedAt: "2026-03-06T00:00:00.000Z",
      installCount: 20,
      minimumHostVersion: `${APP_VERSION}.999`,
      toolContractVersion: "1.0.0",
      source: {
        type: "store",
        storeId: "store.future-plugin",
        pluginDir: "marketplace/future-plugin",
        artifact: "plugin.wasm",
        checksumSha256: "def456",
      },
      permissions: [],
      capabilities: [],
      tools: [],
    },
  ],
} as const;

const installedPlugin: PluginInfo = {
  id: "com.cognia.hello-world",
  name: "Hello World",
  version: "0.0.1",
  description: "Installed",
  authors: [],
  toolCount: 1,
  enabled: true,
  installedAt: "2026-03-05T00:00:00.000Z",
  updatedAt: null,
  updateUrl: null,
  source: { type: "store", storeId: "store.hello-world-rust" },
  builtinCandidate: false,
  builtinSyncStatus: null,
  builtinSyncMessage: null,
};

const pendingUpdate: PluginUpdateInfo = {
  pluginId: "com.cognia.hello-world",
  currentVersion: "0.0.1",
  latestVersion: "0.1.0",
  downloadUrl: "https://example.invalid/hello-world.zip",
  changelog: null,
};

describe("toolbox marketplace helpers", () => {
  it("normalizes catalog metadata and keeps listing order stable", () => {
    const catalog = normalizeMarketplaceCatalog(rawCatalog);
    const firstListing = catalog.listings[0]!;

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.listings.map((listing) => listing.id)).toEqual([
      "hello-world-rust",
      "future-plugin",
    ]);
    expect(firstListing.publisher).toEqual({
      id: "cognia",
      name: "CogniaLauncher Team",
      verified: true,
      url: "https://example.invalid/publisher/cognia",
    });
    expect(firstListing.support.documentationUrl).toBe(
      "https://example.invalid/hello-world/docs",
    );
    expect(firstListing.highlights).toEqual([
      "Fast setup",
      "Cross-runtime demo",
    ]);
    expect(firstListing.gallery).toHaveLength(1);
    expect(firstListing.releaseNotes).toContain("environment inspection");
  });

  it("joins install state, update state, and compatibility state deterministically", () => {
    const catalog = normalizeMarketplaceCatalog(rawCatalog);
    const listings = buildMarketplaceListings(catalog, {
      installedPlugins: [installedPlugin],
      pendingUpdates: [pendingUpdate],
      isDesktop: true,
    });

    expect(listings[0].installState).toBe("update-available");
    expect(listings[0].installedPlugin?.id).toBe("com.cognia.hello-world");
    expect(listings[1].installState).toBe("blocked");
    expect(listings[1].blockedReason).toBeTruthy();
  });

  it("filters by query, category, featured flag, and install state", () => {
    const catalog = normalizeMarketplaceCatalog(rawCatalog);
    const listings = buildMarketplaceListings(catalog, {
      installedPlugins: [installedPlugin],
      pendingUpdates: [pendingUpdate],
      isDesktop: true,
    });

    expect(
      filterMarketplaceListings(listings, {
        query: "hello",
        category: "all",
        featuredOnly: false,
        installState: "all",
        verifiedOnly: false,
        sort: "relevance",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["hello-world-rust"]);

    expect(
      filterMarketplaceListings(listings, {
        query: "",
        category: "developer",
        featuredOnly: true,
        installState: "all",
        verifiedOnly: false,
        sort: "relevance",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["hello-world-rust"]);

    expect(
      filterMarketplaceListings(listings, {
        query: "",
        category: "all",
        featuredOnly: false,
        installState: "update-available",
        verifiedOnly: false,
        sort: "relevance",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["hello-world-rust"]);
  });

  it("supports verified-only filtering and popularity sorting", () => {
    const catalog = normalizeMarketplaceCatalog(rawCatalog);
    const listings = buildMarketplaceListings(catalog, {
      installedPlugins: [],
      pendingUpdates: [],
      isDesktop: true,
    });

    expect(
      filterMarketplaceListings(listings, {
        query: "",
        category: "all",
        featuredOnly: false,
        installState: "all",
        verifiedOnly: true,
        sort: "popular",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["hello-world-rust"]);
  });

  it("marks disabled installed plugins as disabled instead of installed", () => {
    const catalog = normalizeMarketplaceCatalog(rawCatalog);
    const listings = buildMarketplaceListings(catalog, {
      installedPlugins: [{ ...installedPlugin, enabled: false }],
      pendingUpdates: [],
      isDesktop: true,
    });

    expect(listings[0]?.installState).toBe("disabled");
  });
});
