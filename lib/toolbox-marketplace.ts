import { APP_VERSION } from '@/lib/app-version';
import { compareVersions } from '@/lib/version-utils';
import { DEFAULT_TOOL_CONTRACT_VERSION } from '@/types/tool-contract';
import type { PluginInfo, PluginUpdateInfo } from '@/types/plugin';
import type {
  ToolboxMarketplaceCatalog,
  ToolboxMarketplaceFilters,
  ToolboxMarketplaceGalleryItem,
  ToolboxMarketplaceListing,
  ToolboxMarketplacePublisher,
  ToolboxMarketplaceResolvedListing,
  ToolboxMarketplaceSupportLinks,
} from '@/types/toolbox-marketplace';

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizePublisher(value: unknown): ToolboxMarketplacePublisher | null {
  if (value === null || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const name = normalizeOptionalText(input.name);
  if (!name) return null;

  return {
    id: normalizeOptionalText(input.id),
    name,
    verified: input.verified === true,
    url: normalizeOptionalText(input.url),
  };
}

function normalizeSupportLinks(value: unknown): ToolboxMarketplaceSupportLinks {
  if (value === null || typeof value !== 'object') {
    return {
      homepageUrl: null,
      documentationUrl: null,
      issuesUrl: null,
    };
  }

  const input = value as Record<string, unknown>;
  return {
    homepageUrl: normalizeOptionalText(input.homepageUrl),
    documentationUrl: normalizeOptionalText(input.documentationUrl),
    issuesUrl: normalizeOptionalText(input.issuesUrl),
  };
}

function normalizeGallery(value: unknown): ToolboxMarketplaceGalleryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => {
      const url = normalizeOptionalText(item.url);
      const alt = normalizeOptionalText(item.alt);
      if (!url || !alt) return null;
      return {
        type: 'image' as const,
        url,
        alt,
        caption: normalizeOptionalText(item.caption),
      };
    })
    .filter((item): item is ToolboxMarketplaceGalleryItem => item !== null);
}

function normalizeTools(value: unknown): ToolboxMarketplaceListing['tools'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tool): tool is Record<string, unknown> => tool !== null && typeof tool === 'object')
    .map((tool) => ({
      toolId: typeof tool.toolId === 'string' ? tool.toolId : 'unknown-tool',
      name: typeof tool.name === 'string' ? tool.name : 'Unknown Tool',
      description: typeof tool.description === 'string' ? tool.description : null,
      category: typeof tool.category === 'string' ? tool.category : 'developer',
      uiMode: typeof tool.uiMode === 'string' ? tool.uiMode : 'text',
    }));
}

function normalizeMarketplaceSource(
  listing: Record<string, unknown>,
): ToolboxMarketplaceListing['source'] {
  const source = (
    listing.source !== null && typeof listing.source === 'object'
      ? listing.source
      : {}
  ) as Record<string, unknown>;

  return {
    type: 'store',
    storeId:
      typeof source.storeId === 'string'
        ? source.storeId
        : `store.${typeof listing.id === 'string' ? listing.id : 'unknown'}`,
    pluginDir: typeof source.pluginDir === 'string' ? source.pluginDir : '',
    artifact: typeof source.artifact === 'string' ? source.artifact : 'plugin.wasm',
    checksumSha256: typeof source.checksumSha256 === 'string' ? source.checksumSha256 : '',
    downloadUrl: normalizeOptionalText(source.downloadUrl),
    mirrorUrls: normalizeStringArray(source.mirrorUrls),
    sizeBytes: normalizeNonNegativeNumber(source.sizeBytes),
  };
}

export function normalizeMarketplaceCatalog(raw: unknown): ToolboxMarketplaceCatalog {
  const input = (raw ?? {}) as Record<string, unknown>;
  const rawListings = Array.isArray(input.listings) ? input.listings : [];

  return {
    schemaVersion: typeof input.schemaVersion === 'number' ? input.schemaVersion : 1,
    generatedAt: typeof input.generatedAt === 'string' ? input.generatedAt : new Date(0).toISOString(),
    listings: rawListings
      .filter((listing): listing is Record<string, unknown> => listing !== null && typeof listing === 'object')
      .map((listing) => ({
        id: typeof listing.id === 'string' ? listing.id : 'unknown-listing',
        pluginId: typeof listing.pluginId === 'string' ? listing.pluginId : 'unknown-plugin',
        name: typeof listing.name === 'string' ? listing.name : 'Unknown Plugin',
        description: typeof listing.description === 'string' ? listing.description : '',
        version: typeof listing.version === 'string' ? listing.version : '0.0.0',
        category: typeof listing.category === 'string' ? listing.category : 'developer',
        featured: listing.featured === true,
        authors: normalizeStringArray(listing.authors),
        updatedAt: normalizeOptionalText(listing.updatedAt),
        installCount: normalizeNonNegativeNumber(listing.installCount),
        publisher: normalizePublisher(listing.publisher),
        support: normalizeSupportLinks(listing.support),
        highlights: normalizeStringArray(listing.highlights),
        gallery: normalizeGallery(listing.gallery),
        releaseNotes: normalizeOptionalText(listing.releaseNotes),
        minimumHostVersion:
          typeof listing.minimumHostVersion === 'string' ? listing.minimumHostVersion : null,
        toolContractVersion:
          typeof listing.toolContractVersion === 'string' ? listing.toolContractVersion : null,
        source: normalizeMarketplaceSource(listing),
        permissions: normalizeStringArray(listing.permissions),
        capabilities: normalizeStringArray(listing.capabilities),
        tools: normalizeTools(listing.tools),
        desktopOnly: listing.desktopOnly !== false,
      })),
  };
}

export function buildMarketplaceListings(
  catalog: ToolboxMarketplaceCatalog,
  options: {
    installedPlugins: PluginInfo[];
    pendingUpdates: PluginUpdateInfo[];
    isDesktop: boolean;
    marketplaceAcquisitions?: Record<string, PluginInfo['marketplaceAcquisition']>;
  },
): ToolboxMarketplaceResolvedListing[] {
  const installedByPluginId = new Map(options.installedPlugins.map((plugin) => [plugin.id, plugin]));
  const updatesByPluginId = new Map(options.pendingUpdates.map((update) => [update.pluginId, update]));

  return catalog.listings.map((listing) => {
    const installedPlugin = installedByPluginId.get(listing.pluginId) ?? null;
    const pendingUpdate = updatesByPluginId.get(listing.pluginId) ?? null;
    const acquisition = options.marketplaceAcquisitions?.[listing.pluginId] ?? null;
    const hostCompatible =
      !listing.minimumHostVersion || compareVersions(APP_VERSION, listing.minimumHostVersion) >= 0;
    const contractCompatible =
      !listing.toolContractVersion
      || compareVersions(listing.toolContractVersion, DEFAULT_TOOL_CONTRACT_VERSION) <= 0;
    const compatible = hostCompatible && contractCompatible;

    let blockedReason: string | null = null;
    if (listing.desktopOnly && !options.isDesktop) {
      blockedReason = 'Desktop runtime is required for plugin installation.';
    } else if (!hostCompatible) {
      blockedReason = `Requires CogniaLauncher ${listing.minimumHostVersion} or newer.`;
    } else if (!contractCompatible) {
      blockedReason = `Requires tool contract ${listing.toolContractVersion}.`;
    }

    let installState: ToolboxMarketplaceResolvedListing['installState'];
    if (blockedReason && !installedPlugin) {
      installState = 'blocked';
    } else if (installedPlugin && installedPlugin.enabled === false) {
      installState = 'disabled';
    } else if (
      installedPlugin
      && (pendingUpdate !== null || compareVersions(listing.version, installedPlugin.version) > 0)
    ) {
      installState = 'update-available';
    } else if (installedPlugin) {
      installState = 'installed';
    } else {
      installState = 'not-installed';
    }

    return {
      ...listing,
      installState,
      blockedReason,
      compatible,
      installedPlugin,
      pendingUpdate,
      acquisition,
      provenanceState: acquisition ? 'resolved' : 'resolved',
      provenanceReason: null,
    };
  });
}

export function filterMarketplaceListings(
  listings: ToolboxMarketplaceResolvedListing[],
  filters: ToolboxMarketplaceFilters,
): ToolboxMarketplaceResolvedListing[] {
  const query = filters.query.trim().toLowerCase();
  const filtered = listings.filter((listing) => {
    if (filters.category !== 'all' && listing.category !== filters.category) return false;
    if (filters.featuredOnly && !listing.featured) return false;
    if (filters.installState !== 'all' && listing.installState !== filters.installState) return false;
    if (filters.verifiedOnly && listing.publisher?.verified !== true) return false;
    if (!query) return true;

    const haystacks = [
      listing.name,
      listing.description,
      listing.pluginId,
      listing.publisher?.name ?? '',
      ...listing.highlights,
      ...listing.capabilities,
      ...listing.permissions,
      ...listing.tools.map((tool) => tool.name),
      ...listing.tools.map((tool) => tool.description ?? ''),
    ];
    return haystacks.some((value) => value.toLowerCase().includes(query));
  });

  const sort = filters.sort ?? 'relevance';
  if (sort === 'relevance') {
    return filtered;
  }

  return [...filtered].sort((left, right) => {
    if (sort === 'name') {
      const nameOrder = left.name.localeCompare(right.name);
      return nameOrder !== 0 ? nameOrder : left.id.localeCompare(right.id);
    }

    if (sort === 'updated') {
      const leftUpdated = left.updatedAt ? Date.parse(left.updatedAt) : 0;
      const rightUpdated = right.updatedAt ? Date.parse(right.updatedAt) : 0;
      if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;
      const nameOrder = left.name.localeCompare(right.name);
      return nameOrder !== 0 ? nameOrder : left.id.localeCompare(right.id);
    }

    const leftCount = left.installCount ?? -1;
    const rightCount = right.installCount ?? -1;
    if (leftCount !== rightCount) return rightCount - leftCount;
    const nameOrder = left.name.localeCompare(right.name);
    return nameOrder !== 0 ? nameOrder : left.id.localeCompare(right.id);
  });
}
