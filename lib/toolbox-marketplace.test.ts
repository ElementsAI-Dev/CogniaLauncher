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
        downloadUrl: null,
        mirrorUrls: [],
        sizeBytes: null,
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
        downloadUrl: null,
        mirrorUrls: [],
        sizeBytes: null,
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

  it("normalizes mixed local and remote source metadata with backward-compatible defaults", () => {
    const catalog = normalizeMarketplaceCatalog({
      schemaVersion: 1,
      generatedAt: "2026-03-08T00:00:00.000Z",
      listings: [
        {
          id: "remote-only",
          pluginId: "com.cognia.remote-only",
          name: "Remote Only",
          version: "1.0.0",
          category: "developer",
          source: {
            type: "store",
            storeId: "remote-only",
            downloadUrl: "https://example.invalid/remote-only.zip",
            mirrorUrls: ["https://mirror.example.invalid/remote-only.zip"],
            checksumSha256: "abc",
          },
        },
      ],
    });

    expect(catalog.listings[0]?.source).toEqual({
      type: "store",
      storeId: "remote-only",
      pluginDir: "",
      artifact: "plugin.wasm",
      checksumSha256: "abc",
      downloadUrl: "https://example.invalid/remote-only.zip",
      mirrorUrls: ["https://mirror.example.invalid/remote-only.zip"],
      sizeBytes: null,
    });
  });

  it("normalizes sparse listing metadata with null-safe publisher, support, gallery, and tool defaults", () => {
    const catalog = normalizeMarketplaceCatalog({
      schemaVersion: 1,
      listings: [
        {
          id: "minimal",
          pluginId: "com.cognia.minimal",
          name: "Minimal",
          version: "1.0.0",
          category: "developer",
          publisher: { name: "  " },
          support: null,
          gallery: [{ url: "", alt: "missing" }, { url: "https://example.invalid/image.png", alt: "Image" }],
          tools: [{ toolId: 1, name: null, description: 1, category: null, uiMode: null }],
          permissions: [null, "env_read"],
          capabilities: ["environment.read", ""],
        },
      ],
    });

    expect(catalog.listings[0]).toMatchObject({
      publisher: null,
      support: {
        homepageUrl: null,
        documentationUrl: null,
        issuesUrl: null,
      },
      gallery: [
        {
          type: "image",
          url: "https://example.invalid/image.png",
          alt: "Image",
          caption: null,
        },
      ],
      tools: [
        {
          toolId: "unknown-tool",
          name: "Unknown Tool",
          description: null,
          category: "developer",
          uiMode: "text",
        },
      ],
      permissions: ["env_read"],
      capabilities: ["environment.read"],
    });
  });

  it("falls back for missing top-level listing metadata and source identifiers", () => {
    const catalog = normalizeMarketplaceCatalog({
      schemaVersion: "bad",
      generatedAt: 123,
      listings: [
        {
          source: {
            type: "store",
          },
          desktopOnly: false,
        },
      ],
    });

    expect(catalog).toMatchObject({
      schemaVersion: 1,
      generatedAt: new Date(0).toISOString(),
      listings: [
        {
          id: "unknown-listing",
          pluginId: "unknown-plugin",
          name: "Unknown Plugin",
          version: "0.0.0",
          category: "developer",
          source: {
            storeId: "store.unknown",
            artifact: "plugin.wasm",
            checksumSha256: "",
            pluginDir: "",
            sizeBytes: null,
          },
          desktopOnly: false,
        },
      ],
    });
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

  it("keeps installed plugins actionable even when the listing would otherwise be blocked", () => {
    const blockedCatalog = normalizeMarketplaceCatalog({
      ...rawCatalog,
      listings: [
        {
          ...rawCatalog.listings[0],
          id: "desktop-installed",
          pluginId: "com.cognia.desktop-installed",
          name: "Desktop Installed",
          source: {
            type: "store",
            storeId: "desktop-installed",
            pluginDir: "marketplace/desktop-installed",
            artifact: "plugin.wasm",
            checksumSha256: "desktop-installed",
            downloadUrl: null,
            mirrorUrls: [],
            sizeBytes: null,
          },
        },
      ],
    });

    const listings = buildMarketplaceListings(blockedCatalog, {
      installedPlugins: [
        {
          ...installedPlugin,
          id: "com.cognia.desktop-installed",
          version: "0.1.0",
          source: { type: "store", storeId: "desktop-installed" },
        },
      ],
      pendingUpdates: [],
      isDesktop: false,
    });

    expect(listings[0]).toMatchObject({
      installState: "installed",
      blockedReason: "Desktop runtime is required for plugin installation.",
    });
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

    expect(
      filterMarketplaceListings(listings, {
        query: "",
        category: "system",
        featuredOnly: false,
        installState: "all",
        verifiedOnly: false,
        sort: "relevance",
      } satisfies ToolboxMarketplaceFilters),
    ).toEqual([]);
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

  it("filters out non-verified listings and install-state mismatches", () => {
    const catalog = normalizeMarketplaceCatalog({
      schemaVersion: 1,
      listings: [
        {
          id: "verified",
          pluginId: "verified.plugin",
          name: "Verified",
          version: "1.0.0",
          category: "developer",
          publisher: { name: "Verified", verified: true },
          source: { type: "store", storeId: "verified" },
        },
        {
          id: "unverified",
          pluginId: "unverified.plugin",
          name: "Unverified",
          version: "1.0.0",
          category: "developer",
          publisher: { name: "Unverified", verified: false },
          source: { type: "store", storeId: "unverified" },
        },
      ],
    });
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
        installState: "installed",
        verifiedOnly: false,
        sort: "relevance",
      } satisfies ToolboxMarketplaceFilters),
    ).toEqual([]);

    expect(
      filterMarketplaceListings(listings, {
        query: "",
        category: "all",
        featuredOnly: false,
        installState: "all",
        verifiedOnly: true,
        sort: "relevance",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["verified"]);
  });

  it("filters by capability, permission, and tool-description text", () => {
    const catalog = normalizeMarketplaceCatalog(rawCatalog);
    const listings = buildMarketplaceListings(catalog, {
      installedPlugins: [],
      pendingUpdates: [],
      isDesktop: true,
    });

    expect(
      filterMarketplaceListings(listings, {
        query: "environment.read",
        category: "all",
        featuredOnly: false,
        installState: "all",
        verifiedOnly: false,
        sort: "relevance",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["hello-world-rust"]);

    expect(
      filterMarketplaceListings(listings, {
        query: "env_read",
        category: "all",
        featuredOnly: false,
        installState: "all",
        verifiedOnly: false,
        sort: "relevance",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["hello-world-rust"]);

    expect(
      filterMarketplaceListings(listings, {
        query: "say hello",
        category: "all",
        featuredOnly: false,
        installState: "all",
        verifiedOnly: false,
        sort: "relevance",
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

  it("emits explicit blocked reasons for desktop and contract incompatibility", () => {
    const contractListing = {
      ...rawCatalog.listings[0],
      id: "contract-plugin",
      pluginId: "com.cognia.contract-plugin",
      toolContractVersion: "999.0.0",
      source: {
        type: "store" as const,
        storeId: "store.contract-plugin",
        pluginDir: "marketplace/contract-plugin",
        artifact: "plugin.wasm",
        checksumSha256: "contract999",
        downloadUrl: null,
        mirrorUrls: [],
        sizeBytes: null,
      },
    };
    const catalog = normalizeMarketplaceCatalog({
      ...rawCatalog,
      listings: [...rawCatalog.listings, contractListing],
    });

    const nonDesktopListings = buildMarketplaceListings(catalog, {
      installedPlugins: [],
      pendingUpdates: [],
      isDesktop: false,
    });
    expect(nonDesktopListings[0]?.installState).toBe("blocked");
    expect(nonDesktopListings[0]?.blockedReason).toBe(
      "Desktop runtime is required for plugin installation.",
    );

    const contractBlockedListings = buildMarketplaceListings(catalog, {
      installedPlugins: [],
      pendingUpdates: [],
      isDesktop: true,
    });
    const contractBlocked = contractBlockedListings.find(
      (listing) => listing.id === "contract-plugin",
    );
    expect(contractBlocked?.installState).toBe("blocked");
    expect(contractBlocked?.blockedReason).toBe(
      "Requires tool contract 999.0.0.",
    );
  });

  it("keeps deterministic ordering when sort keys tie", () => {
    const tieCatalog = normalizeMarketplaceCatalog({
      ...rawCatalog,
      listings: [
        {
          ...rawCatalog.listings[0],
          id: "tie-b",
          name: "Same Name",
          installCount: 100,
          updatedAt: "2026-03-01T00:00:00.000Z",
          source: {
            type: "store" as const,
            storeId: "store.tie-b",
            pluginDir: "marketplace/tie-b",
            artifact: "plugin.wasm",
            checksumSha256: "tie-b",
            downloadUrl: null,
            mirrorUrls: [],
            sizeBytes: null,
          },
          pluginId: "com.cognia.tie-b",
        },
        {
          ...rawCatalog.listings[0],
          id: "tie-a",
          name: "Same Name",
          installCount: 100,
          updatedAt: "2026-03-01T00:00:00.000Z",
          source: {
            type: "store" as const,
            storeId: "store.tie-a",
            pluginDir: "marketplace/tie-a",
            artifact: "plugin.wasm",
            checksumSha256: "tie-a",
            downloadUrl: null,
            mirrorUrls: [],
            sizeBytes: null,
          },
          pluginId: "com.cognia.tie-a",
        },
      ],
    });

    const listings = buildMarketplaceListings(tieCatalog, {
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
        verifiedOnly: false,
        sort: "name",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["tie-a", "tie-b"]);

    expect(
      filterMarketplaceListings(listings, {
        query: "",
        category: "all",
        featuredOnly: false,
        installState: "all",
        verifiedOnly: false,
        sort: "popular",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["tie-a", "tie-b"]);
  });

  it("sorts by updated timestamp descending with stable tie-breaking", () => {
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
        verifiedOnly: false,
        sort: "updated",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["future-plugin", "hello-world-rust"]);
  });

  it("breaks updated-sort ties by localized name and then id", () => {
    const tieCatalog = normalizeMarketplaceCatalog({
      schemaVersion: 1,
      listings: [
        {
          id: "beta",
          pluginId: "beta.plugin",
          name: "Beta",
          version: "1.0.0",
          category: "developer",
          updatedAt: "2026-03-06T00:00:00.000Z",
          source: { type: "store", storeId: "beta" },
        },
        {
          id: "alpha",
          pluginId: "alpha.plugin",
          name: "Alpha",
          version: "1.0.0",
          category: "developer",
          updatedAt: "2026-03-06T00:00:00.000Z",
          source: { type: "store", storeId: "alpha" },
        },
      ],
    });

    const listings = buildMarketplaceListings(tieCatalog, {
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
        verifiedOnly: false,
        sort: "updated",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["alpha", "beta"]);
  });

  it("breaks popularity-sort ties by name and then id when install counts are missing", () => {
    const tieCatalog = normalizeMarketplaceCatalog({
      schemaVersion: 1,
      listings: [
        {
          id: "zeta",
          pluginId: "zeta.plugin",
          name: "Shared",
          version: "1.0.0",
          category: "developer",
          source: { type: "store", storeId: "zeta" },
        },
        {
          id: "alpha",
          pluginId: "alpha.plugin",
          name: "Shared",
          version: "1.0.0",
          category: "developer",
          source: { type: "store", storeId: "alpha" },
        },
      ],
    });
    const listings = buildMarketplaceListings(tieCatalog, {
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
        verifiedOnly: false,
        sort: "popular",
      } satisfies ToolboxMarketplaceFilters).map((listing) => listing.id),
    ).toEqual(["alpha", "zeta"]);
  });
});
