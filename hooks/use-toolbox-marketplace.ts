import { useCallback, useMemo } from 'react';
import rawMarketplaceCatalog from '@/plugins/marketplace.json';
import { isTauri } from '@/lib/tauri';
import { usePluginStore } from '@/lib/stores/plugin';
import { useToolboxStore } from '@/lib/stores/toolbox';
import { usePlugins } from '@/hooks/use-plugins';
import {
  buildMarketplaceListings,
  filterMarketplaceListings,
  normalizeMarketplaceCatalog,
} from '@/lib/toolbox-marketplace';
import type {
  ToolboxMarketplaceCatalog,
  ToolboxMarketplaceFilters,
  ToolboxMarketplaceListing,
  ToolboxMarketplaceResolvedListing,
} from '@/types/toolbox-marketplace';

const BUNDLED_MARKETPLACE_CATALOG = normalizeMarketplaceCatalog(rawMarketplaceCatalog);

function getDefaultFilters(
  overrides?: Partial<ToolboxMarketplaceFilters>,
): ToolboxMarketplaceFilters {
  return {
    query: '',
    category: 'all',
    featuredOnly: false,
    verifiedOnly: false,
    installState: 'all',
    sort: 'relevance',
    ...overrides,
  };
}

export function useToolboxMarketplace(overrides?: Partial<ToolboxMarketplaceFilters>) {
  const installedPlugins = usePluginStore((state) => state.installedPlugins);
  const pendingUpdates = usePluginStore((state) => state.pendingUpdates);
  const marketplaceCatalog = usePluginStore((state) => state.marketplaceCatalog);
  const marketplaceCatalogSource = usePluginStore((state) => state.marketplaceCatalogSource);
  const marketplaceSyncState = usePluginStore((state) => state.marketplaceSyncState);
  const marketplaceLastSyncedAt = usePluginStore((state) => state.marketplaceLastSyncedAt);
  const marketplaceLastError = usePluginStore((state) => state.marketplaceLastError);
  const setMarketplaceCatalog = usePluginStore((state) => state.setMarketplaceCatalog);
  const setMarketplaceCatalogSource = usePluginStore((state) => state.setMarketplaceCatalogSource);
  const setMarketplaceSyncState = usePluginStore((state) => state.setMarketplaceSyncState);
  const setMarketplaceLastSyncedAt = usePluginStore((state) => state.setMarketplaceLastSyncedAt);
  const setMarketplaceLastError = usePluginStore((state) => state.setMarketplaceLastError);
  const continuationHint = useToolboxStore((state) => state.continuationHint);
  const setContinuationHint = useToolboxStore((state) => state.setContinuationHint);
  const {
    fetchPlugins,
    installMarketplacePlugin,
    updatePlugin,
  } = usePlugins();

  const isDesktop = isTauri();
  const filters = getDefaultFilters(overrides);

  const refreshCatalog = useCallback(async (): Promise<ToolboxMarketplaceCatalog> => {
    setMarketplaceSyncState('refreshing');
    try {
      if (isDesktop) {
        await fetchPlugins();
      }
      const nextCatalog = marketplaceCatalog ?? BUNDLED_MARKETPLACE_CATALOG;
      const nextSource = marketplaceCatalog
        ? (marketplaceCatalogSource ?? 'cached')
        : 'bundled';
      setMarketplaceCatalog(nextCatalog);
      setMarketplaceCatalogSource(nextSource);
      setMarketplaceLastSyncedAt(nextCatalog.generatedAt);
      setMarketplaceLastError(null);
      setMarketplaceSyncState('ready');
      return nextCatalog;
    } catch (error) {
      const message = (error as Error).message ?? String(error);
      const fallbackCatalog = marketplaceCatalog ?? BUNDLED_MARKETPLACE_CATALOG;
      const fallbackSource = marketplaceCatalog
        ? (marketplaceCatalogSource ?? 'cached')
        : 'bundled';
      setMarketplaceCatalog(fallbackCatalog);
      setMarketplaceCatalogSource(fallbackSource);
      setMarketplaceLastError(message);
      setMarketplaceSyncState('degraded');
      return fallbackCatalog;
    }
  }, [
    fetchPlugins,
    isDesktop,
    marketplaceCatalog,
    marketplaceCatalogSource,
    setMarketplaceCatalog,
    setMarketplaceCatalogSource,
    setMarketplaceLastError,
    setMarketplaceLastSyncedAt,
    setMarketplaceSyncState,
  ]);

  const catalog = marketplaceCatalog ?? BUNDLED_MARKETPLACE_CATALOG;
  const listings = useMemo(
    () =>
      buildMarketplaceListings(catalog, {
        installedPlugins,
        pendingUpdates,
        isDesktop,
      }),
    [catalog, installedPlugins, isDesktop, pendingUpdates],
  );

  const filteredListings = useMemo(
    () => filterMarketplaceListings(listings, filters),
    [filters, listings],
  );

  const featuredListings = useMemo(
    () => listings.filter((listing) => listing.featured).slice(0, 3),
    [listings],
  );

  const recentlyUpdatedListings = useMemo(
    () =>
      [...listings]
        .sort((left, right) => {
          const leftUpdated = left.updatedAt ? Date.parse(left.updatedAt) : 0;
          const rightUpdated = right.updatedAt ? Date.parse(right.updatedAt) : 0;
          if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;
          return left.name.localeCompare(right.name);
        })
        .slice(0, 3),
    [listings],
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const values: string[] = [];
    for (const listing of listings) {
      if (seen.has(listing.category)) continue;
      seen.add(listing.category);
      values.push(listing.category);
    }
    return values.sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const getListingById = useCallback(
    (listingId: string | null | undefined): ToolboxMarketplaceResolvedListing | null => {
      if (!listingId) return null;
      return listings.find(
        (listing) => listing.id === listingId || listing.source.storeId === listingId,
      ) ?? null;
    },
    [listings],
  );

  const recordContinuation = useCallback(
    (listing: ToolboxMarketplaceListing, kind: 'marketplace-install' | 'marketplace-update') => {
      setContinuationHint({
        kind,
        listingId: listing.id,
        pluginId: listing.pluginId,
        toolId: listing.tools[0] ? `plugin:${listing.pluginId}:${listing.tools[0].toolId}` : null,
        timestamp: Date.now(),
      });
    },
    [setContinuationHint],
  );

  const installListing = useCallback(
    async (listing: ToolboxMarketplaceListing) => {
      const pluginId = await installMarketplacePlugin(listing.source.storeId);
      if (pluginId) {
        recordContinuation(listing, 'marketplace-install');
      }
      return pluginId ?? null;
    },
    [installMarketplacePlugin, recordContinuation],
  );

  const updateListing = useCallback(
    async (listing: ToolboxMarketplaceResolvedListing) => {
      if (listing.pendingUpdate) {
        await updatePlugin(listing.pluginId);
      } else {
        await installMarketplacePlugin(listing.source.storeId);
      }
      recordContinuation(listing, 'marketplace-update');
    },
    [installMarketplacePlugin, recordContinuation, updatePlugin],
  );

  return {
    isDesktop,
    catalog,
    listings,
    filteredListings,
    featuredListings,
    recentlyUpdatedListings,
    categories,
    catalogSource: marketplaceCatalogSource ?? 'bundled',
    syncState: marketplaceCatalog ? marketplaceSyncState : 'ready',
    lastSyncedAt: marketplaceLastSyncedAt ?? BUNDLED_MARKETPLACE_CATALOG.generatedAt,
    lastError: marketplaceLastError,
    continuationHint,
    refreshCatalog,
    getListingById,
    installListing,
    updateListing,
  };
}
