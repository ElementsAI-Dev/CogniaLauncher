import { useCallback, useMemo, useState } from 'react';
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
import type { PluginMarketplaceActionResult } from '@/types/plugin';
import type {
  ToolboxMarketplaceActionError,
  ToolboxMarketplaceActionProgress,
  ToolboxMarketplaceCatalog,
  ToolboxMarketplaceCatalogSource,
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

function createFallbackActionResult(
  action: PluginMarketplaceActionResult['action'],
  pluginId: string | null,
): PluginMarketplaceActionResult {
  return {
    ok: false,
    action,
    pluginId,
    phase: 'failed',
    downloadTaskId: null,
    error: {
      category: 'install_execution_failed',
      message: action === 'install'
        ? 'Marketplace install failed.'
        : 'Marketplace update failed.',
      retryable: true,
    },
  };
}

function buildMarketplaceActionError(
  kind: ToolboxMarketplaceActionError['kind'],
  listing: ToolboxMarketplaceListing,
  options: {
    category: ToolboxMarketplaceActionError['category'];
    message: string;
    retryable: boolean;
  },
): ToolboxMarketplaceActionError {
  return {
    kind,
    category: options.category,
    listingId: listing.id,
    pluginId: listing.pluginId,
    toolId: listing.tools[0] ? `plugin:${listing.pluginId}:${listing.tools[0].toolId}` : null,
    message: options.message,
    retryable: options.retryable,
    timestamp: Date.now(),
  };
}

function buildMarketplaceActionProgress(
  kind: ToolboxMarketplaceActionProgress['kind'],
  listing: ToolboxMarketplaceListing,
  phase: ToolboxMarketplaceActionProgress['phase'],
  downloadTaskId: string | null,
): ToolboxMarketplaceActionProgress {
  return {
    kind,
    listingId: listing.id,
    pluginId: listing.pluginId,
    phase,
    downloadTaskId,
    timestamp: Date.now(),
  };
}

export function useToolboxMarketplace(overrides?: Partial<ToolboxMarketplaceFilters>) {
  const installedPlugins = usePluginStore((state) => state.installedPlugins);
  const pendingUpdates = usePluginStore((state) => state.pendingUpdates);
  const marketplaceAcquisitions = usePluginStore((state) => state.marketplaceAcquisitions);
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
  const setMarketplaceAcquisition = usePluginStore((state) => state.setMarketplaceAcquisition);
  const continuationHint = useToolboxStore((state) => state.continuationHint);
  const setContinuationHint = useToolboxStore((state) => state.setContinuationHint);
  const {
    fetchPlugins,
    installMarketplacePlugin,
    updatePlugin,
    installMarketplacePluginWithResult,
    updatePluginWithResult,
  } = usePlugins();

  const isDesktop = isTauri();
  const filters = getDefaultFilters(overrides);
  const [lastActionError, setLastActionError] =
    useState<ToolboxMarketplaceActionError | null>(null);
  const [lastActionProgress, setLastActionProgress] =
    useState<ToolboxMarketplaceActionProgress | null>(null);

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
      const fallbackSource: ToolboxMarketplaceCatalogSource = marketplaceCatalog
        ? 'cached'
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
        marketplaceAcquisitions,
      }),
    [catalog, installedPlugins, isDesktop, marketplaceAcquisitions, pendingUpdates],
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
        sourceLabel: listing.publisher?.name ?? 'Marketplace',
        timestamp: Date.now(),
      });
    },
    [setContinuationHint],
  );

  const recordMarketplaceAcquisition = useCallback((
    listing: ToolboxMarketplaceListing,
    result: PluginMarketplaceActionResult,
    outcome: 'succeeded' | 'failed',
  ) => {
    setMarketplaceAcquisition(listing.pluginId, {
      pluginId: result.pluginId ?? listing.pluginId,
      listingId: listing.id,
      storeId: listing.source.storeId,
      action: result.action,
      phase: result.phase ?? (result.ok ? 'completed' : 'failed'),
      outcome,
      downloadTaskId: result.downloadTaskId ?? null,
      sourceLabel: listing.publisher?.name ?? 'Marketplace',
      message: result.error?.message ?? null,
      timestamp: Date.now(),
    });
  }, [setMarketplaceAcquisition]);

  const clearMarketplaceActionError = useCallback(() => {
    setLastActionError(null);
    setLastActionProgress(null);
  }, []);

  const installListing = useCallback(
    async (listing: ToolboxMarketplaceListing) => {
      setLastActionProgress(
        buildMarketplaceActionProgress(
          'marketplace-install',
          listing,
          'preparing',
          null,
        ),
      );

      if (!isDesktop || (listing.desktopOnly && !isDesktop)) {
        setLastActionError(
          buildMarketplaceActionError('marketplace-install', listing, {
            category: 'compatibility_blocked',
            message: 'Desktop runtime is required for plugin installation.',
            retryable: false,
          }),
        );
        setLastActionProgress(
          buildMarketplaceActionProgress(
            'marketplace-install',
            listing,
            'failed',
            null,
          ),
        );
        return null;
      }

      const listingFromInput = listing as ToolboxMarketplaceResolvedListing;
      if (listingFromInput.installState === 'blocked') {
        setLastActionError(
          buildMarketplaceActionError('marketplace-install', listing, {
            category: 'compatibility_blocked',
            message: listingFromInput.blockedReason ?? 'Compatibility requirements are not satisfied.',
            retryable: false,
          }),
        );
        setLastActionProgress(
          buildMarketplaceActionProgress(
            'marketplace-install',
            listing,
            'failed',
            null,
          ),
        );
        return null;
      }

      const resolvedListing = getListingById(listing.id);
      if (resolvedListing?.installState === 'blocked') {
        setLastActionError(
          buildMarketplaceActionError('marketplace-install', listing, {
            category: 'compatibility_blocked',
            message: resolvedListing.blockedReason ?? 'Compatibility requirements are not satisfied.',
            retryable: false,
          }),
        );
        setLastActionProgress(
          buildMarketplaceActionProgress(
            'marketplace-install',
            listing,
            'failed',
            null,
          ),
        );
        return null;
      }

      const result = installMarketplacePluginWithResult
        ? await installMarketplacePluginWithResult(listing.source.storeId)
        : await (() => Promise.resolve())().then(async () => {
            const pluginId = await installMarketplacePlugin(listing.source.storeId);
            return pluginId
              ? {
                  ok: true,
                  action: 'install',
                  pluginId,
                  phase: 'completed',
                  downloadTaskId: null,
                  error: null,
                } satisfies PluginMarketplaceActionResult
              : createFallbackActionResult('install', null);
          });

      setLastActionProgress(
        buildMarketplaceActionProgress(
          'marketplace-install',
          listing,
          result.phase ?? (result.ok ? 'completed' : 'failed'),
          result.downloadTaskId ?? null,
        ),
      );

      if (result.ok && result.pluginId) {
        recordMarketplaceAcquisition(listing, result, 'succeeded');
        setLastActionError(null);
        recordContinuation(listing, 'marketplace-install');
        await refreshCatalog();
        return result.pluginId;
      }

      recordMarketplaceAcquisition(
        listing,
        {
          ...result,
          action: 'install',
          phase: result.phase ?? 'failed',
        },
        'failed',
      );
      setLastActionError(
        buildMarketplaceActionError('marketplace-install', listing, {
          category: result.error?.category ?? 'install_execution_failed',
          message: result.error?.message ?? 'Marketplace install failed.',
          retryable: result.error?.retryable ?? true,
        }),
      );
      setLastActionProgress(
        buildMarketplaceActionProgress(
          'marketplace-install',
          listing,
          'failed',
          result.downloadTaskId ?? null,
        ),
      );
      return null;
    },
    [
      getListingById,
      installMarketplacePlugin,
      installMarketplacePluginWithResult,
      isDesktop,
      recordMarketplaceAcquisition,
      recordContinuation,
      refreshCatalog,
    ],
  );

  const updateListing = useCallback(
    async (listing: ToolboxMarketplaceResolvedListing) => {
      setLastActionProgress(
        buildMarketplaceActionProgress(
          'marketplace-update',
          listing,
          'preparing',
          null,
        ),
      );

      if (listing.installState === 'blocked') {
        setLastActionError(
          buildMarketplaceActionError('marketplace-update', listing, {
            category: 'compatibility_blocked',
            message: listing.blockedReason ?? 'Compatibility requirements are not satisfied.',
            retryable: false,
          }),
        );
        setLastActionProgress(
          buildMarketplaceActionProgress(
            'marketplace-update',
            listing,
            'failed',
            null,
          ),
        );
        return;
      }

      const result = listing.pendingUpdate
        ? (
            updatePluginWithResult
              ? await updatePluginWithResult(listing.pluginId)
              : await (() => Promise.resolve())().then(async () => {
                  await updatePlugin(listing.pluginId);
                  return {
                    ok: true,
                    action: 'update',
                    pluginId: listing.pluginId,
                    phase: 'completed',
                    downloadTaskId: null,
                    error: null,
                  } satisfies PluginMarketplaceActionResult;
                })
          )
        : (
            installMarketplacePluginWithResult
              ? await installMarketplacePluginWithResult(listing.source.storeId)
              : await (() => Promise.resolve())().then(async () => {
                  const pluginId = await installMarketplacePlugin(listing.source.storeId);
                  return pluginId
                    ? {
                        ok: true,
                        action: 'install',
                        pluginId,
                        phase: 'completed',
                        downloadTaskId: null,
                        error: null,
                      } satisfies PluginMarketplaceActionResult
                    : createFallbackActionResult('install', null);
                })
          );

      setLastActionProgress(
        buildMarketplaceActionProgress(
          'marketplace-update',
          listing,
          result.phase ?? (result.ok ? 'completed' : 'failed'),
          result.downloadTaskId ?? null,
        ),
      );

      if (result.ok) {
        recordMarketplaceAcquisition(
          listing,
          {
            ...result,
            action: 'update',
            pluginId: result.pluginId ?? listing.pluginId,
            phase: result.phase ?? 'completed',
          },
          'succeeded',
        );
        setLastActionError(null);
        recordContinuation(listing, 'marketplace-update');
        await refreshCatalog();
        return;
      }

      recordMarketplaceAcquisition(
        listing,
        {
          ...result,
          action: 'update',
          pluginId: result.pluginId ?? listing.pluginId,
          phase: result.phase ?? 'failed',
        },
        'failed',
      );
      setLastActionError(
        buildMarketplaceActionError('marketplace-update', listing, {
          category: result.error?.category ?? 'install_execution_failed',
          message: result.error?.message ?? 'Marketplace update failed.',
          retryable: result.error?.retryable ?? true,
        }),
      );
      setLastActionProgress(
        buildMarketplaceActionProgress(
          'marketplace-update',
          listing,
          'failed',
          result.downloadTaskId ?? null,
        ),
      );
    },
    [
      installMarketplacePlugin,
      installMarketplacePluginWithResult,
      recordMarketplaceAcquisition,
      recordContinuation,
      refreshCatalog,
      updatePlugin,
      updatePluginWithResult,
    ],
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
    lastActionError,
    lastActionProgress,
    continuationHint,
    refreshCatalog,
    getListingById,
    installListing,
    updateListing,
    clearMarketplaceActionError,
  };
}
