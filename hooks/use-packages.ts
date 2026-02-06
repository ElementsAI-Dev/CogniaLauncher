'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePackageStore } from '@/lib/stores/packages';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import type { UnlistenFn } from '@tauri-apps/api/event';

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
    try {
      return await tauri.searchSuggestions(query, 10);
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

  const fetchInstalledPackages = useCallback(async (provider?: string) => {
    store.setLoading(true);
    store.setError(null);
    try {
      const packages = await tauri.packageList(provider);
      store.setInstalledPackages(packages);
      return packages;
    } catch (err) {
      store.setError(formatError(err));
      return [];
    } finally {
      store.setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const installPackages = useCallback(async (packages: string[]) => {
    store.setError(null);
    const normalized = packages.map(normalizePackageId);
    normalized.forEach((p) => store.addInstalling(p));
    try {
      const installed = await tauri.packageInstall(packages);
      await fetchInstalledPackages();
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
      await fetchInstalledPackages();
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
      await fetchInstalledPackages();
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
      await fetchInstalledPackages();
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
      await fetchInstalledPackages();
      return result;
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInstalledPackages]);

  const fetchProviders = useCallback(async () => {
    try {
      const providers = await tauri.providerList();
      store.setProviders(providers);
      return providers;
    } catch (err) {
      store.setError(formatError(err));
      return [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressUnlistenRef = useRef<UnlistenFn | null>(null);

  // Clean up progress listener on unmount
  useEffect(() => {
    return () => {
      progressUnlistenRef.current?.();
      progressUnlistenRef.current = null;
    };
  }, []);

  const checkForUpdates = useCallback(async (packages?: string[]) => {
    store.setIsCheckingUpdates(true);
    store.setError(null);
    store.setUpdateCheckProgress(null);
    store.setUpdateCheckErrors([]);

    // Set up progress listener
    let unlisten: UnlistenFn | null = null;
    try {
      unlisten = await tauri.listenUpdateCheckProgress((progress) => {
        store.setUpdateCheckProgress(progress);
      });
      progressUnlistenRef.current = unlisten;

      const summary = await tauri.checkUpdates(packages);
      store.setAvailableUpdates(summary.updates);
      store.setUpdateCheckErrors(summary.errors);
      store.setLastUpdateCheck(Date.now());
      return summary.updates;
    } catch (err) {
      store.setError(formatError(err));
      return [];
    } finally {
      store.setIsCheckingUpdates(false);
      // Clean up listener
      unlisten?.();
      progressUnlistenRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await fetchInstalledPackages();
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

  const getInstallHistory = useCallback(async (limit?: number) => {
    try {
      return await tauri.getInstallHistory(limit);
    } catch (err) {
      store.setError(formatError(err));
      return [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPackageHistory = useCallback(async (name: string) => {
    try {
      return await tauri.getPackageHistory(name);
    } catch (err) {
      store.setError(formatError(err));
      return [];
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
