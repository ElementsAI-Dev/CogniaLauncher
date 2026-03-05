'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePackageStore } from '@/lib/stores/packages';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import { usePackageUpdates, type CheckPackageUpdatesOptions } from '@/hooks/use-package-updates';
import {
  type CacheInvalidationEvent,
  emitInvalidations,
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';

const PROVIDER_CACHE_TTL_MS = 10 * 60 * 1000;
const SUGGESTION_CACHE_TTL_MS = 30 * 1000;

export const normalizePackageId = (pkg: string) => {
  const colonIndex = pkg.indexOf(':');
  let provider: string | null = null;
  let rest = pkg;

  if (colonIndex > 0) {
    const candidate = pkg.slice(0, colonIndex);
    if (!candidate.includes('@') && !candidate.includes('/')) {
      provider = candidate;
      rest = pkg.slice(colonIndex + 1);
    }
  }

  const versionIndex = rest.lastIndexOf('@');
  if (versionIndex > 0) {
    const potentialVersion = rest.slice(versionIndex + 1);
    // Match semver-like versions, ranges, and dist tags
    // - Digits: 1.0.0, 18.0.0
    // - Range prefixes: ^1.0.0, ~1.0.0, >=1.0.0, <=1.0.0, >1.0.0, <1.0.0, =1.0.0
    // - Wildcards: *, x, X
    // - Version prefix: v1.0.0
    // - Dist tags: latest, next, beta, alpha, canary, rc, stable, dev, nightly
    const looksLikeVersion = /^([0-9~^*xX]|[<>=]+[0-9]|v[0-9]|(?:latest|next|beta|alpha|canary|rc|stable|dev|nightly)(?:$|-))/i.test(potentialVersion);
    if (looksLikeVersion) {
      rest = rest.slice(0, versionIndex);
    }
  }

  return provider ? `${provider}:${rest}` : rest;
};

export function usePackages() {
  const store = usePackageStore();
  const { checkUpdates: runUpdateCheck } = usePackageUpdates();
  const installedPackagesInFlightRef = useRef<Map<string, Promise<tauri.InstalledPackage[]>>>(new Map());
  const providerFetchInFlightRef = useRef<Promise<tauri.ProviderInfo[]> | null>(null);
  const providerCacheTimestampRef = useRef<number | null>(null);
  const suggestionCacheRef = useRef<Map<string, { items: tauri.SearchSuggestion[]; timestamp: number }>>(new Map());

  const searchPackages = useCallback(async (query: string, provider?: string) => {
    store.setLoading(true);
    store.setError(null);
    store.setSearchQuery(query);
    try {
      const results = await tauri.packageSearch(query, provider);
      store.setSearchResults(results);
      return results;
    } catch (err) {
      store.setError(formatError(err));
      return [];
    } finally {
      store.setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advancedSearch = useCallback(async (query: string, options?: Omit<tauri.AdvancedSearchOptions, 'query'>) => {
    store.setLoading(true);
    store.setError(null);
    store.setSearchQuery(query);
    try {
      const result = await tauri.advancedSearch({ query, ...options });
      store.setSearchResults(result.packages);
      store.setSearchMeta({
        total: result.total,
        page: result.page,
        pageSize: result.page_size,
        facets: result.facets,
      });
      return result;
    } catch (err) {
      store.setError(formatError(err));
      return null;
    } finally {
      store.setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) return [];
    const normalized = query.trim().toLowerCase();
    const now = Date.now();
    const cached = suggestionCacheRef.current.get(normalized);
    if (cached && now - cached.timestamp < SUGGESTION_CACHE_TTL_MS) {
      return cached.items;
    }

    try {
      const suggestions = await tauri.searchSuggestions(query, 10);
      suggestionCacheRef.current.set(normalized, { items: suggestions, timestamp: now });
      return suggestions;
    } catch {
      return [];
    }
  }, []);

  const fetchPackageInfo = useCallback(async (name: string, provider?: string) => {
    store.setLoading(true);
    store.setError(null);
    try {
      const info = await tauri.packageInfo(name, provider);
      store.setSelectedPackage(info);
      return info;
    } catch (err) {
      store.setError(formatError(err));
      return null;
    } finally {
      store.setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInstalledPackages = useCallback(async (provider?: string, force?: boolean) => {
    const state = usePackageStore.getState();

    // Skip fetch if store has fresh data and not forced
    if (!force && !provider && state.isScanFresh() && state.installedPackages.length > 0) {
      return state.installedPackages;
    }

    // Stale-while-revalidate: if we have cached data (from localStorage persist),
    // skip loading state and return cached data on error for instant perceived startup.
    const hasCachedData = !force && !provider && state.installedPackages.length > 0;
    const requestKey = `${provider ?? '__all__'}:${force ? 'force' : 'normal'}`;
    const inFlight = installedPackagesInFlightRef.current.get(requestKey);
    if (inFlight) {
      return inFlight;
    }

    if (!hasCachedData) {
      state.setLoading(true);
    }
    state.setError(null);

    const request = tauri.packageList(provider, force)
      .then((packages) => {
        const latest = usePackageStore.getState();
        latest.setInstalledPackages(packages);
        if (!provider) {
          latest.setLastScanTimestamp(Date.now());
        }
        return packages;
      })
      .catch((err) => {
        const latest = usePackageStore.getState();
        latest.setError(formatError(err));
        return hasCachedData ? latest.installedPackages : [];
      })
      .finally(() => {
        installedPackagesInFlightRef.current.delete(requestKey);
        usePackageStore.getState().setLoading(false);
      });

    installedPackagesInFlightRef.current.set(requestKey, request);
    return request;
  }, []);

  const installPackages = useCallback(async (packages: string[]) => {
    store.setError(null);
    const normalized = packages.map(normalizePackageId);
    normalized.forEach((p) => store.addInstalling(p));
    try {
      const installed = await tauri.packageInstall(packages);
      await fetchInstalledPackages(undefined, true);
      tauri.pluginDispatchEvent('package_installed', { packages }).catch(() => {});
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'packages:install',
      );
      return installed;
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    } finally {
      normalized.forEach((p) => store.removeInstalling(p));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInstalledPackages]);

  const batchInstall = useCallback(async (packages: string[], dryRun?: boolean, force?: boolean) => {
    store.setError(null);
    const normalized = packages.map(normalizePackageId);
    normalized.forEach((p) => store.addInstalling(p));
    try {
      const result = await tauri.batchInstall(packages, { dryRun, force });
      await fetchInstalledPackages(undefined, true);
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'packages:batch-install',
      );
      return result;
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    } finally {
      normalized.forEach((p) => store.removeInstalling(p));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInstalledPackages]);

  const batchUpdate = useCallback(async (packages?: string[]) => {
    store.setLoading(true);
    store.setError(null);
    try {
      const result = await tauri.batchUpdate(packages);
      await fetchInstalledPackages(undefined, true);
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'packages:batch-update',
      );
      return result;
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    } finally {
      store.setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInstalledPackages]);

  const uninstallPackages = useCallback(async (packages: string[]) => {
    store.setError(null);
    try {
      await tauri.packageUninstall(packages);
      await fetchInstalledPackages(undefined, true);
      tauri.pluginDispatchEvent('package_uninstalled', { packages }).catch(() => {});
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'packages:uninstall',
      );
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInstalledPackages]);

  const batchUninstall = useCallback(async (packages: string[], force?: boolean) => {
    store.setError(null);
    try {
      const result = await tauri.batchUninstall(packages, force);
      await fetchInstalledPackages(undefined, true);
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'packages:batch-uninstall',
      );
      return result;
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInstalledPackages]);

  const fetchProviders = useCallback(async () => {
    const state = usePackageStore.getState();
    const now = Date.now();
    const isProvidersCacheFresh =
      providerCacheTimestampRef.current !== null &&
      now - providerCacheTimestampRef.current < PROVIDER_CACHE_TTL_MS;

    if (isProvidersCacheFresh && state.providers.length > 0) {
      return state.providers;
    }

    if (providerFetchInFlightRef.current) {
      return providerFetchInFlightRef.current;
    }

    try {
      const request = tauri.providerList().then((providers) => {
        const latest = usePackageStore.getState();
        latest.setProviders(providers);
        providerCacheTimestampRef.current = Date.now();
        return providers;
      });
      providerFetchInFlightRef.current = request;
      return await request;
    } catch (err) {
      state.setError(formatError(err));
      return [];
    } finally {
      providerFetchInFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!tauri.isTauri()) return;
    void ensureCacheInvalidationBridge();

    const dispose = subscribeInvalidation(
      ['package_data', 'provider_data'],
      withThrottle((event: CacheInvalidationEvent) => {
        if (event.reason.startsWith('packages:')) {
          return;
        }

        if (event.domain === 'provider_data') {
          providerCacheTimestampRef.current = null;
          void fetchProviders();
          return;
        }

        if (event.domain === 'package_data') {
          usePackageStore.getState().setLastScanTimestamp(null);
          void fetchInstalledPackages(undefined, true);
        }
      }, 500),
    );

    return () => {
      dispose();
    };
  }, [fetchInstalledPackages, fetchProviders]);

  const checkForUpdates = useCallback(async (
    packages?: string[],
    options?: Omit<CheckPackageUpdatesOptions, 'packages'>
  ) => {
    try {
      const summary = await runUpdateCheck({
        ...options,
        packages,
      });
      return summary.updates;
    } catch (err) {
      store.setError(formatError(err));
      return [];
    }
  }, [runUpdateCheck, store]);

  const pinPackage = useCallback(async (name: string, version?: string) => {
    try {
      await tauri.packagePin(name, version);
      store.addPinnedPackage(name);
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unpinPackage = useCallback(async (name: string) => {
    try {
      await tauri.packageUnpin(name);
      store.removePinnedPackage(name);
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rollbackPackage = useCallback(async (name: string, toVersion: string) => {
    store.addInstalling(name);
    try {
      await tauri.packageRollback(name, toVersion);
      await fetchInstalledPackages(undefined, true);
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'packages:rollback',
      );
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    } finally {
      store.removeInstalling(name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInstalledPackages]);

  const resolveDependencies = useCallback(async (packageName: string) => {
    store.setLoading(true);
    try {
      return await tauri.resolveDependencies([packageName]);
    } catch (err) {
      store.setError(formatError(err));
      return null;
    } finally {
      store.setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const comparePackages = useCallback(async (packageIds: string[]) => {
    try {
      // Convert IDs into (name, provider) pairs
      const packages: [string, string | null][] = packageIds.map((id) => {
        const normalized = normalizePackageId(id);
        const colonIndex = normalized.indexOf(':');
        if (colonIndex > 0) {
          return [normalized.slice(colonIndex + 1), normalized.slice(0, colonIndex)];
        }
        return [normalized, null];
      });
      return await tauri.comparePackages(packages);
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getInstallHistory = useCallback(async (queryOrLimit?: number | tauri.InstallHistoryQuery) => {
    try {
      return await tauri.getInstallHistory(queryOrLimit);
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPackageHistory = useCallback(async (name: string, query?: tauri.PackageHistoryQuery) => {
    try {
      return await tauri.getPackageHistory(name, query);
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearInstallHistory = useCallback(async () => {
    try {
      await tauri.clearInstallHistory();
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPackageVersions = useCallback(async (name: string, provider?: string) => {
    try {
      return await tauri.packageVersions(name, provider);
    } catch (err) {
      store.setError(formatError(err));
      return [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPackageInstalled = useCallback(async (name: string) => {
    try {
      return await tauri.packageCheckInstalled(name);
    } catch {
      return false;
    }
  }, []);

  return {
    ...store,
    searchPackages,
    advancedSearch,
    getSuggestions,
    fetchPackageInfo,
    installPackages,
    batchInstall,
    batchUpdate,
    uninstallPackages,
    batchUninstall,
    fetchInstalledPackages,
    fetchProviders,
    checkForUpdates,
    pinPackage,
    unpinPackage,
    rollbackPackage,
    resolveDependencies,
    comparePackages,
    getInstallHistory,
    getPackageHistory,
    clearInstallHistory,
    fetchPackageVersions,
    checkPackageInstalled,
  };
}
