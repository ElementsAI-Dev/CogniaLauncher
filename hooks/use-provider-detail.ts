'use client';

import { useCallback, useState, useRef } from 'react';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import type {
  ProviderInfo,
  InstalledPackage,
  PackageSummary,
  PackageInfo,
  UpdateInfo,
  PackageManagerHealthResult,
  InstallHistoryEntry,
  EnvironmentInfo,
  EnvironmentProviderInfo,
  VersionInfo,
  ResolutionResult,
  BatchResult,
} from '@/types/tauri';

export interface ProviderDetailState {
  provider: ProviderInfo | null;
  isAvailable: boolean | null;
  loading: boolean;
  error: string | null;

  // Packages
  installedPackages: InstalledPackage[];
  loadingPackages: boolean;

  // Search
  searchResults: PackageSummary[];
  searchQuery: string;
  loadingSearch: boolean;

  // Updates
  availableUpdates: UpdateInfo[];
  loadingUpdates: boolean;

  // Health
  healthResult: PackageManagerHealthResult | null;
  loadingHealth: boolean;

  // History
  installHistory: InstallHistoryEntry[];
  loadingHistory: boolean;

  // Pinned packages
  pinnedPackages: [string, string | null][];

  // Environment (for environment providers)
  environmentInfo: EnvironmentInfo | null;
  environmentProviderInfo: EnvironmentProviderInfo | null;
  availableVersions: VersionInfo[];
  loadingEnvironment: boolean;
}

export function useProviderDetail(providerId: string) {
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [searchResults, setSearchResults] = useState<PackageSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [availableUpdates, setAvailableUpdates] = useState<UpdateInfo[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  const [healthResult, setHealthResult] = useState<PackageManagerHealthResult | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const [installHistory, setInstallHistory] = useState<InstallHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [pinnedPackages, setPinnedPackages] = useState<[string, string | null][]>([]);

  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo | null>(null);
  const [environmentProviderInfo, setEnvironmentProviderInfo] = useState<EnvironmentProviderInfo | null>(null);
  const [availableVersions, setAvailableVersions] = useState<VersionInfo[]>([]);
  const [loadingEnvironment, setLoadingEnvironment] = useState(false);

  const initializedRef = useRef(false);

  // Fetch provider info from the list
  const fetchProvider = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const providers = await tauri.providerList();
      const found = providers.find((p) => p.id === providerId);
      if (found) {
        setProvider(found);
      } else {
        setError(`Provider "${providerId}" not found`);
      }
      return found ?? null;
    } catch (err) {
      setError(formatError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  // Check availability
  const checkAvailability = useCallback(async () => {
    try {
      const available = await tauri.providerCheck(providerId);
      setIsAvailable(available);
      return available;
    } catch {
      setIsAvailable(false);
      return false;
    }
  }, [providerId]);

  // Toggle provider enabled/disabled
  const toggleProvider = useCallback(async (enabled: boolean) => {
    try {
      if (enabled) {
        await tauri.providerEnable(providerId);
      } else {
        await tauri.providerDisable(providerId);
      }
      // Refresh provider info
      await fetchProvider();
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, fetchProvider]);

  // Fetch installed packages for this provider
  const fetchInstalledPackages = useCallback(async () => {
    setLoadingPackages(true);
    try {
      const packages = await tauri.packageList(providerId);
      setInstalledPackages(packages);
      return packages;
    } catch (err) {
      setError(formatError(err));
      return [];
    } finally {
      setLoadingPackages(false);
    }
  }, [providerId]);

  // Search packages within this provider
  const searchPackages = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchQuery('');
      return [];
    }
    setLoadingSearch(true);
    setSearchQuery(query);
    try {
      const results = await tauri.packageSearch(query, providerId);
      setSearchResults(results);
      return results;
    } catch (err) {
      setError(formatError(err));
      return [];
    } finally {
      setLoadingSearch(false);
    }
  }, [providerId]);

  // Install a package via this provider (optionally with version)
  const installPackage = useCallback(async (packageName: string, version?: string) => {
    try {
      const name = version ? `${packageName}@${version}` : packageName;
      const spec = `${providerId}:${name}`;
      await tauri.packageInstall([spec]);
      await fetchInstalledPackages();
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, fetchInstalledPackages]);

  // Uninstall a package
  const uninstallPackage = useCallback(async (packageName: string) => {
    try {
      const spec = `${providerId}:${packageName}`;
      await tauri.packageUninstall([spec]);
      await fetchInstalledPackages();
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, fetchInstalledPackages]);

  // Batch uninstall multiple packages
  const batchUninstallPackages = useCallback(async (packageNames: string[]) => {
    try {
      const specs = packageNames.map((name) => `${providerId}:${name}`);
      const result = await tauri.batchUninstall(specs);
      await fetchInstalledPackages();
      return result;
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, fetchInstalledPackages]);

  // Fetch detailed info for a specific package
  const fetchPackageInfo = useCallback(async (packageName: string): Promise<PackageInfo | null> => {
    try {
      return await tauri.packageInfo(packageName, providerId);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [providerId]);

  // Fetch available versions for a package
  const fetchPackageVersions = useCallback(async (packageName: string): Promise<VersionInfo[]> => {
    try {
      return await tauri.packageVersions(packageName, providerId);
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [providerId]);

  // Resolve dependencies for packages
  const fetchDependencies = useCallback(async (packageNames: string[]): Promise<ResolutionResult | null> => {
    try {
      const specs = packageNames.map((name) => `${providerId}:${name}`);
      return await tauri.resolveDependencies(specs);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [providerId]);

  // Pin a package to its current version
  const pinPackage = useCallback(async (packageName: string, version?: string) => {
    try {
      await tauri.packagePin(packageName, version);
      const pinned = await tauri.getPinnedPackages();
      setPinnedPackages(pinned);
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, []);

  // Unpin a package
  const unpinPackage = useCallback(async (packageName: string) => {
    try {
      await tauri.packageUnpin(packageName);
      const pinned = await tauri.getPinnedPackages();
      setPinnedPackages(pinned);
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, []);

  // Fetch all pinned packages
  const fetchPinnedPackages = useCallback(async () => {
    try {
      const pinned = await tauri.getPinnedPackages();
      setPinnedPackages(pinned);
      return pinned;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, []);

  // Rollback a package to a specific version
  const rollbackPackage = useCallback(async (packageName: string, toVersion: string) => {
    try {
      await tauri.packageRollback(packageName, toVersion);
      await fetchInstalledPackages();
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [fetchInstalledPackages]);

  // Get history for a specific package
  const fetchPackageHistory = useCallback(async (packageName: string): Promise<InstallHistoryEntry[]> => {
    try {
      return await tauri.getPackageHistory(packageName);
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, []);

  // Check for updates for packages from this provider
  const checkUpdates = useCallback(async () => {
    setLoadingUpdates(true);
    try {
      const summary = await tauri.checkUpdates();
      const providerUpdates = summary.updates.filter((u) => u.provider === providerId);
      setAvailableUpdates(providerUpdates);
      return providerUpdates;
    } catch (err) {
      setError(formatError(err));
      return [];
    } finally {
      setLoadingUpdates(false);
    }
  }, [providerId]);

  // Update a single package
  const updatePackage = useCallback(async (packageName: string): Promise<BatchResult | null> => {
    try {
      const spec = `${providerId}:${packageName}`;
      const result = await tauri.batchUpdate([spec]);
      await fetchInstalledPackages();
      return result;
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, fetchInstalledPackages]);

  // Update all packages for this provider
  const updateAllPackages = useCallback(async (packageNames: string[]): Promise<BatchResult | null> => {
    try {
      const specs = packageNames.map((name) => `${providerId}:${name}`);
      const result = await tauri.batchUpdate(specs);
      await fetchInstalledPackages();
      await checkUpdates();
      return result;
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, fetchInstalledPackages, checkUpdates]);

  // Run health check for this provider
  const runHealthCheck = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const results = await tauri.healthCheckPackageManagers();
      const found = results.find((r) => r.provider_id === providerId);
      setHealthResult(found ?? null);
      return found ?? null;
    } catch (err) {
      setError(formatError(err));
      return null;
    } finally {
      setLoadingHealth(false);
    }
  }, [providerId]);

  // Fetch install history filtered by provider
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const history = await tauri.getInstallHistory(200);
      const filtered = history.filter((h) => h.provider === providerId);
      setInstallHistory(filtered);
      return filtered;
    } catch (err) {
      setError(formatError(err));
      return [];
    } finally {
      setLoadingHistory(false);
    }
  }, [providerId]);

  // Fetch environment info (for environment providers)
  const fetchEnvironmentInfo = useCallback(async () => {
    setLoadingEnvironment(true);
    try {
      // Get environment provider info to find the env_type
      const envProviders = await tauri.envListProviders();
      const envProvider = envProviders.find((p) => p.id === providerId);
      setEnvironmentProviderInfo(envProvider ?? null);

      if (envProvider) {
        // Fetch actual environment data
        try {
          const envInfo = await tauri.envGet(envProvider.env_type);
          setEnvironmentInfo(envInfo);
        } catch {
          // Provider might not have an active environment
          setEnvironmentInfo(null);
        }

        // Fetch available versions
        try {
          const versions = await tauri.envAvailableVersions(envProvider.env_type);
          setAvailableVersions(versions);
        } catch {
          setAvailableVersions([]);
        }
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoadingEnvironment(false);
    }
  }, [providerId]);

  // Initialize all data for the provider
  const initialize = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const providerInfo = await fetchProvider();
    if (!providerInfo) return;

    // Run parallel loads
    const promises: Promise<unknown>[] = [
      checkAvailability(),
      fetchInstalledPackages(),
      runHealthCheck(),
      fetchHistory(),
      checkUpdates(),
      fetchPinnedPackages(),
    ];

    // If it's an environment provider, also load environment data
    if (providerInfo.is_environment_provider) {
      promises.push(fetchEnvironmentInfo());
    }

    await Promise.allSettled(promises);
  }, [fetchProvider, checkAvailability, fetchInstalledPackages, runHealthCheck, fetchHistory, checkUpdates, fetchPinnedPackages, fetchEnvironmentInfo]);

  // Refresh all data — bypasses the init guard by directly re-fetching
  const refreshAll = useCallback(async () => {
    const providerInfo = await fetchProvider();
    if (!providerInfo) return;

    const promises: Promise<unknown>[] = [
      checkAvailability(),
      fetchInstalledPackages(),
      runHealthCheck(),
      fetchHistory(),
      checkUpdates(),
      fetchPinnedPackages(),
    ];

    if (providerInfo.is_environment_provider) {
      promises.push(fetchEnvironmentInfo());
    }

    await Promise.allSettled(promises);
  }, [fetchProvider, checkAvailability, fetchInstalledPackages, runHealthCheck, fetchHistory, checkUpdates, fetchPinnedPackages, fetchEnvironmentInfo]);

  return {
    // State
    provider,
    isAvailable,
    loading,
    error,
    installedPackages,
    loadingPackages,
    searchResults,
    searchQuery,
    loadingSearch,
    availableUpdates,
    loadingUpdates,
    healthResult,
    loadingHealth,
    installHistory,
    loadingHistory,
    pinnedPackages,
    environmentInfo,
    environmentProviderInfo,
    availableVersions,
    loadingEnvironment,

    // Actions
    initialize,
    refreshAll,
    fetchProvider,
    checkAvailability,
    toggleProvider,
    fetchInstalledPackages,
    searchPackages,
    installPackage,
    uninstallPackage,
    batchUninstallPackages,
    fetchPackageInfo,
    fetchPackageVersions,
    fetchDependencies,
    pinPackage,
    unpinPackage,
    fetchPinnedPackages,
    rollbackPackage,
    fetchPackageHistory,
    updatePackage,
    updateAllPackages,
    checkUpdates,
    runHealthCheck,
    fetchHistory,
    fetchEnvironmentInfo,
    setSearchQuery,
    setError,
  };
}
