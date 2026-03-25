'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import { usePackages } from '@/hooks/use-packages';
import { usePackageUpdates } from '@/hooks/use-package-updates';
import { isProviderStatusAvailable } from '@/lib/utils/provider';
import {
  type CacheInvalidationEvent,
  emitInvalidations,
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';
import type {
  HealthScopeState,
  HealthIssue,
  HealthRemediationResult,
  ProviderInfo,
  InstalledPackage,
  PackageSummary,
  PackageInfo,
  UpdateInfo,
  PackageManagerHealthResult,
  ProviderStatusInfo,
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
  providerStatusInfo: ProviderStatusInfo | null;
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
  healthScopeState: HealthScopeState | null;
  healthScopeReason: string | null;
  loadingHealth: boolean;
  activeRemediationId: string | null;
  lastRemediationResult: HealthRemediationResult | null;

  // History
  installHistory: InstallHistoryEntry[];
  loadingHistory: boolean;
  historyError: string | null;

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
  const [providerStatusInfo, setProviderStatusInfo] = useState<ProviderStatusInfo | null>(null);
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
  const [activeRemediationId, setActiveRemediationId] = useState<string | null>(null);
  const [lastRemediationResult, setLastRemediationResult] = useState<HealthRemediationResult | null>(null);

  const [installHistory, setInstallHistory] = useState<InstallHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [pinnedPackages, setPinnedPackages] = useState<[string, string | null][]>([]);

  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo | null>(null);
  const [environmentProviderInfo, setEnvironmentProviderInfo] = useState<EnvironmentProviderInfo | null>(null);
  const [availableVersions, setAvailableVersions] = useState<VersionInfo[]>([]);
  const [loadingEnvironment, setLoadingEnvironment] = useState(false);

  const initializedRef = useRef(false);
  const {
    fetchProviders: fetchSharedProviders,
    fetchInstalledPackages: fetchSharedInstalledPackages,
    searchPackages: searchSharedPackages,
    fetchPackageInfo: fetchSharedPackageInfo,
    fetchPackageVersions: fetchSharedPackageVersions,
  } = usePackages();
  const { checkUpdates: runUpdateCheck } = usePackageUpdates();

  // Fetch provider info from the list
  const fetchProvider = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const providers = await fetchSharedProviders();
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
  }, [fetchSharedProviders, providerId]);

  // Check availability
  const checkAvailability = useCallback(async () => {
    try {
      const status = await tauri.providerStatus(providerId);
      setProviderStatusInfo(status);
      const available = isProviderStatusAvailable(status) ?? false;
      setIsAvailable(available);
      return available;
    } catch {
      setProviderStatusInfo(null);
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
      await Promise.all([fetchProvider(), checkAvailability()]);
      emitInvalidations(
        ['provider_data', 'package_data', 'environment_data'],
        'provider-detail:toggle-provider',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, fetchProvider, checkAvailability]);

  const setProviderPriority = useCallback(async (priority: number) => {
    try {
      await tauri.providerSetPriority(providerId, priority);
      await Promise.all([fetchProvider(), checkAvailability()]);
      emitInvalidations(
        ['provider_data', 'package_data', 'environment_data'],
        'provider-detail:set-priority',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, fetchProvider, checkAvailability]);

  // Fetch installed packages for this provider
  const fetchInstalledPackages = useCallback(async (force?: boolean) => {
    setLoadingPackages(true);
    try {
      const packages = await fetchSharedInstalledPackages(providerId, force);
      setInstalledPackages(packages);
      return packages;
    } catch (err) {
      setError(formatError(err));
      return [];
    } finally {
      setLoadingPackages(false);
    }
  }, [fetchSharedInstalledPackages, providerId]);

  // Internal helper used by operation paths and explicit history refresh.
  const refreshHistory = useCallback(async (): Promise<InstallHistoryEntry[]> => {
    const history = await tauri.getInstallHistory({ limit: 200, provider: providerId });
    setInstallHistory(history);
    setHistoryError(null);
    return history;
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
      const results = await searchSharedPackages(query, providerId);
      setSearchResults(results);
      return results;
    } catch (err) {
      setError(formatError(err));
      return [];
    } finally {
      setLoadingSearch(false);
    }
  }, [providerId, searchSharedPackages]);

  // Install a package via this provider (optionally with version)
  const installPackage = useCallback(async (packageName: string, version?: string) => {
    try {
      const name = version ? `${packageName}@${version}` : packageName;
      const spec = `${providerId}:${name}`;
      await tauri.packageInstall([spec]);
      await refreshPackageSurface();
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'provider-detail:install-package',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, refreshPackageSurface]);

  // Uninstall a package
  const uninstallPackage = useCallback(async (packageName: string) => {
    try {
      const spec = `${providerId}:${packageName}`;
      await tauri.packageUninstall([spec]);
      await refreshPackageSurface();
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'provider-detail:uninstall-package',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, refreshPackageSurface]);

  // Batch uninstall multiple packages
  const batchUninstallPackages = useCallback(async (packageNames: string[]) => {
    try {
      const specs = packageNames.map((name) => `${providerId}:${name}`);
      const result = await tauri.batchUninstall(specs);
      await refreshPackageSurface();
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'provider-detail:batch-uninstall',
      );
      return result;
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, refreshPackageSurface]);

  // Fetch detailed info for a specific package
  const fetchPackageInfo = useCallback(async (packageName: string): Promise<PackageInfo | null> => {
    try {
      return await fetchSharedPackageInfo(packageName, providerId);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [fetchSharedPackageInfo, providerId]);

  // Fetch available versions for a package
  const fetchPackageVersions = useCallback(async (packageName: string): Promise<VersionInfo[]> => {
    try {
      return await fetchSharedPackageVersions(packageName, providerId);
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [fetchSharedPackageVersions, providerId]);

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
      await refreshPackageSurface();
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'provider-detail:pin-package',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [refreshPackageSurface]);

  // Unpin a package
  const unpinPackage = useCallback(async (packageName: string) => {
    try {
      await tauri.packageUnpin(packageName);
      await refreshPackageSurface();
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'provider-detail:unpin-package',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [refreshPackageSurface]);

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
      await refreshPackageSurface();
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'provider-detail:rollback-package',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [refreshPackageSurface]);

  // Rollback a package to its last known good version (auto-discovers target)
  const rollbackToLastVersion = useCallback(async (packageName: string) => {
    const currentVersion = installedPackages.find((pkg) => pkg.name === packageName)?.version;
    const localCandidate = installHistory.find((entry) => (
      entry.name === packageName &&
      entry.success &&
      entry.action !== 'uninstall' &&
      entry.version !== currentVersion
    ));
    const remoteHistory = localCandidate ? [] : await tauri.getPackageHistory(packageName, { provider: providerId, limit: 200 });
    const candidate = localCandidate ?? remoteHistory.find((entry) => (
      entry.success &&
      entry.action !== 'uninstall' &&
      entry.version !== currentVersion
    ));

    if (!candidate?.version) {
      throw new Error(`No rollback target available for ${packageName}`);
    }

    await rollbackPackage(packageName, candidate.version);
  }, [installedPackages, installHistory, providerId, rollbackPackage]);

  // Get history for a specific package
  const fetchPackageHistory = useCallback(async (packageName: string): Promise<InstallHistoryEntry[]> => {
    try {
      return await tauri.getPackageHistory(packageName, { provider: providerId, limit: 200 });
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [providerId]);

  // Check for updates for packages from this provider
  const checkUpdates = useCallback(async () => {
    setLoadingUpdates(true);
    try {
      const summary = await runUpdateCheck({
        providerId,
        syncStore: false,
      });
      setAvailableUpdates(summary.updates);
      return summary.updates;
    } catch (err) {
      setError(formatError(err));
      return [];
    } finally {
      setLoadingUpdates(false);
    }
  }, [providerId, runUpdateCheck]);

  async function refreshPackageSurface(forcePackages = true) {
    const packagesPromise = fetchInstalledPackages(forcePackages);
    const historyPromise = refreshHistory().catch((historyErr) => {
      setHistoryError(formatError(historyErr));
      return [];
    });
    const updatesPromise = checkUpdates();
    const pinnedPromise = fetchPinnedPackages();

    const [packages] = await Promise.all([
      packagesPromise,
      historyPromise,
      updatesPromise,
      pinnedPromise,
    ]);

    return packages;
  }

  // Update a single package
  const updatePackage = useCallback(async (packageName: string): Promise<BatchResult | null> => {
    try {
      const spec = `${providerId}:${packageName}`;
      const result = await tauri.batchUpdate([spec]);
      await refreshPackageSurface();
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'provider-detail:update-package',
      );
      return result;
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, refreshPackageSurface]);

  // Update all packages for this provider
  const updateAllPackages = useCallback(async (packageNames: string[]): Promise<BatchResult | null> => {
    try {
      const specs = packageNames.map((name) => `${providerId}:${name}`);
      const result = await tauri.batchUpdate(specs);
      await refreshPackageSurface();
      emitInvalidations(
        ['package_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'provider-detail:update-all-packages',
      );
      return result;
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [providerId, refreshPackageSurface]);

  // Run health check for this provider
  const runHealthCheck = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const result = await tauri.healthCheckPackageManager(providerId);
      setHealthResult(result);
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    } finally {
      setLoadingHealth(false);
    }
  }, [providerId]);

  const runHealthRemediation = useCallback(async (
    issue: Pick<HealthIssue, 'remediation_id'>,
    dryRun: boolean,
  ) => {
    if (!issue.remediation_id) {
      return null;
    }

    setActiveRemediationId(issue.remediation_id);
    try {
      const result = await tauri.healthCheckFix(issue.remediation_id, dryRun);
      setLastRemediationResult(result);
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    } finally {
      setActiveRemediationId(null);
    }
  }, []);

  // Fetch install history filtered by provider
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      return await refreshHistory();
    } catch (err) {
      const message = formatError(err);
      setError(message);
      setHistoryError(message);
      return [];
    } finally {
      setLoadingHistory(false);
    }
  }, [refreshHistory]);

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
          const envInfo = await tauri.envGet(envProvider.env_type, providerId);
          setEnvironmentInfo(envInfo);
        } catch {
          // Provider might not have an active environment
          setEnvironmentInfo(null);
        }

        // Fetch available versions
        try {
          const versions = await tauri.envAvailableVersions(
            envProvider.env_type,
            providerId,
          );
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
      refreshPackageSurface(false),
      runHealthCheck(),
    ];

    // If it's an environment provider, also load environment data
    if (providerInfo.is_environment_provider) {
      promises.push(fetchEnvironmentInfo());
    }

    await Promise.allSettled(promises);
  }, [fetchProvider, checkAvailability, refreshPackageSurface, runHealthCheck, fetchEnvironmentInfo]);

  // Refresh all data — bypasses the init guard by directly re-fetching
  const refreshAll = useCallback(async () => {
    const providerInfo = await fetchProvider();
    if (!providerInfo) return;

    const promises: Promise<unknown>[] = [
      checkAvailability(),
      refreshPackageSurface(),
      runHealthCheck(),
    ];

    if (providerInfo.is_environment_provider) {
      promises.push(fetchEnvironmentInfo());
    }

    await Promise.allSettled(promises);
  }, [fetchProvider, checkAvailability, refreshPackageSurface, runHealthCheck, fetchEnvironmentInfo]);

  useEffect(() => {
    if (!tauri.isTauri()) return;
    void ensureCacheInvalidationBridge();
    const dispose = subscribeInvalidation(
      ['provider_data', 'package_data', 'environment_data'],
      withThrottle((event: CacheInvalidationEvent) => {
        if (event.reason.startsWith('provider-detail:')) {
          return;
        }

        if (event.domain === 'provider_data') {
          void fetchProvider();
          void checkAvailability();
          return;
        }

        if (event.domain === 'package_data') {
          void refreshPackageSurface();
          return;
        }

        if (event.domain === 'environment_data') {
          void fetchEnvironmentInfo();
        }
      }, 500),
    );

    return () => {
      dispose();
    };
  }, [
    checkAvailability,
    fetchEnvironmentInfo,
    fetchProvider,
    refreshPackageSurface,
  ]);

  return {
    // State
    provider,
    isAvailable,
    providerStatusInfo,
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
    healthScopeState: healthResult?.scope_state ?? null,
    healthScopeReason: healthResult?.scope_reason ?? null,
    loadingHealth,
    activeRemediationId,
    lastRemediationResult,
    installHistory,
    loadingHistory,
    historyError,
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
    setProviderPriority,
    fetchInstalledPackages,
    refreshPackageSurface,
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
    rollbackToLastVersion,
    fetchPackageHistory,
    updatePackage,
    updateAllPackages,
    checkUpdates,
    runHealthCheck,
    previewHealthRemediation: (issue: Pick<HealthIssue, 'remediation_id'>) =>
      runHealthRemediation(issue, true),
    applyHealthRemediation: (issue: Pick<HealthIssue, 'remediation_id'>) =>
      runHealthRemediation(issue, false),
    fetchHistory,
    fetchEnvironmentInfo,
    setSearchQuery,
    setError,
  };
}
