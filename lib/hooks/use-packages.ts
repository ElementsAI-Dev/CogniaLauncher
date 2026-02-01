'use client';

import { useCallback } from 'react';
import { usePackageStore } from '../stores/packages';
import * as tauri from '../tauri';

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
      store.setError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      store.setLoading(false);
    }
  }, [store]);

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
      store.setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

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
      store.setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const fetchInstalledPackages = useCallback(async (provider?: string) => {
    store.setLoading(true);
    store.setError(null);
    try {
      const packages = await tauri.packageList(provider);
      store.setInstalledPackages(packages);
      return packages;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const installPackages = useCallback(async (packages: string[]) => {
    store.setError(null);
    packages.forEach((p) => store.addInstalling(p));
    try {
      const installed = await tauri.packageInstall(packages);
      await fetchInstalledPackages();
      return installed;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      packages.forEach((p) => store.removeInstalling(p));
    }
  }, [store, fetchInstalledPackages]);

  const batchInstall = useCallback(async (packages: string[], dryRun?: boolean, force?: boolean) => {
    store.setError(null);
    packages.forEach((p) => store.addInstalling(p));
    try {
      const result = await tauri.batchInstall(packages, { dryRun, force });
      await fetchInstalledPackages();
      return result;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      packages.forEach((p) => store.removeInstalling(p));
    }
  }, [store, fetchInstalledPackages]);

  const batchUpdate = useCallback(async (packages?: string[]) => {
    store.setLoading(true);
    store.setError(null);
    try {
      const result = await tauri.batchUpdate(packages);
      await fetchInstalledPackages();
      return result;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      store.setLoading(false);
    }
  }, [store, fetchInstalledPackages]);

  const uninstallPackages = useCallback(async (packages: string[]) => {
    store.setError(null);
    try {
      await tauri.packageUninstall(packages);
      await fetchInstalledPackages();
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store, fetchInstalledPackages]);

  const batchUninstall = useCallback(async (packages: string[], force?: boolean) => {
    store.setError(null);
    try {
      const result = await tauri.batchUninstall(packages, force);
      await fetchInstalledPackages();
      return result;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store, fetchInstalledPackages]);

  const fetchProviders = useCallback(async () => {
    try {
      const providers = await tauri.providerList();
      store.setProviders(providers);
      return providers;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }, [store]);

  const checkForUpdates = useCallback(async (packages?: string[]) => {
    store.setLoading(true);
    store.setError(null);
    try {
      const updates = await tauri.checkUpdates(packages);
      store.setAvailableUpdates(updates);
      return updates;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const pinPackage = useCallback(async (name: string, version?: string) => {
    try {
      await tauri.packagePin(name, version);
      store.addPinnedPackage(name);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store]);

  const unpinPackage = useCallback(async (name: string) => {
    try {
      await tauri.packageUnpin(name);
      store.removePinnedPackage(name);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store]);

  const rollbackPackage = useCallback(async (name: string, toVersion: string) => {
    store.addInstalling(name);
    try {
      await tauri.packageRollback(name, toVersion);
      await fetchInstalledPackages();
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      store.removeInstalling(name);
    }
  }, [store, fetchInstalledPackages]);

  const resolveDependencies = useCallback(async (packageName: string) => {
    store.setLoading(true);
    try {
      return await tauri.resolveDependencies([packageName]);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const comparePackages = useCallback(async (packageIds: string[]) => {
    try {
      // Convert simple IDs to the expected format
      const packages: [string, string | null][] = packageIds.map(id => [id, null]);
      return await tauri.comparePackages(packages);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store]);

  const getInstallHistory = useCallback(async (limit?: number) => {
    try {
      return await tauri.getInstallHistory(limit);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }, [store]);

  const getPackageHistory = useCallback(async (name: string) => {
    try {
      return await tauri.getPackageHistory(name);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }, [store]);

  const clearInstallHistory = useCallback(async () => {
    try {
      await tauri.clearInstallHistory();
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store]);

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
  };
}
