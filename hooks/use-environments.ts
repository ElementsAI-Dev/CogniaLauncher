'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  getLogicalEnvType,
  useEnvironmentStore,
  type EnvironmentSettings,
} from '@/lib/stores/environment';
import * as tauri from '@/lib/tauri';
import { formatSize, formatSpeed } from '@/lib/utils';
import { formatError } from '@/lib/errors';
import type { UnlistenFn } from '@tauri-apps/api/event';
import {
  type CacheInvalidationEvent,
  emitInvalidations,
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';

const ENV_PROVIDERS_CACHE_TTL_MS = 10 * 60 * 1000;
const DETECTED_VERSIONS_CACHE_TTL_MS = 10 * 1000;

export function useEnvironments() {
  // Select state values
  const environments = useEnvironmentStore((s) => s.environments);
  const availableProviders = useEnvironmentStore((s) => s.availableProviders);
  const currentInstallation = useEnvironmentStore((s) => s.currentInstallation);

  // Select stable action references (these don't change between renders)
  const setLoading = useEnvironmentStore((s) => s.setLoading);
  const setError = useEnvironmentStore((s) => s.setError);
  const setEnvSettings = useEnvironmentStore((s) => s.setEnvSettings);
  const updateEnvironment = useEnvironmentStore((s) => s.updateEnvironment);
  const setDetectedVersions = useEnvironmentStore((s) => s.setDetectedVersions);
  const setCurrentInstallation = useEnvironmentStore((s) => s.setCurrentInstallation);
  const openProgressDialog = useEnvironmentStore((s) => s.openProgressDialog);
  const closeProgressDialog = useEnvironmentStore((s) => s.closeProgressDialog);
  const updateInstallationProgress = useEnvironmentStore((s) => s.updateInstallationProgress);

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const environmentListInFlightRef = useRef<Map<string, Promise<tauri.EnvironmentInfo[]>>>(new Map());
  const availableVersionsInFlightRef = useRef<Map<string, Promise<tauri.VersionInfo[]>>>(new Map());
  const providersInFlightRef = useRef<Promise<tauri.EnvironmentProviderInfo[]> | null>(null);
  const providersCacheTimestampRef = useRef<number | null>(null);
  const detectionSourcesCacheRef = useRef<Map<string, string[]>>(new Map());
  const detectedVersionsCacheRef = useRef<{
    path: string;
    timestamp: number;
    versions: tauri.DetectedEnvironment[];
  } | null>(null);

  const normalizeEnvType = useCallback((envType: string): string => (
    envType.trim().toLowerCase()
  ), []);

  const toLogicalEnvType = useCallback((envType: string): string => {
    const normalizedEnvType = normalizeEnvType(envType);
    const providers = useEnvironmentStore.getState().availableProviders.map((provider) => ({
      id: provider.id.toLowerCase(),
      env_type: provider.env_type.toLowerCase(),
    }));
    return normalizeEnvType(getLogicalEnvType(normalizedEnvType, providers));
  }, [normalizeEnvType]);

  const toSettings = useCallback((settings: tauri.EnvironmentSettingsConfig): EnvironmentSettings => ({
    envVariables: settings.env_variables.map((variable) => ({
      key: variable.key,
      value: variable.value,
      enabled: variable.enabled,
    })),
    detectionFiles: settings.detection_files.map((file) => ({
      fileName: file.file_name,
      enabled: file.enabled,
    })),
    autoSwitch: settings.auto_switch,
  }), []);

  const toSettingsConfig = useCallback((envType: string, settings: EnvironmentSettings): tauri.EnvironmentSettingsConfig => ({
    env_type: toLogicalEnvType(envType),
    env_variables: settings.envVariables.map((variable) => ({
      key: variable.key,
      value: variable.value,
      enabled: variable.enabled,
    })),
    detection_files: settings.detectionFiles.map((file) => ({
      file_name: file.fileName,
      enabled: file.enabled,
    })),
    auto_switch: settings.autoSwitch,
  }), [toLogicalEnvType]);

  const isScanFresh = useEnvironmentStore((s) => s.isScanFresh);

  const fetchEnvironments = useCallback(async (force?: boolean) => {
    if (!tauri.isTauri()) {
      return [];
    }

    const state = useEnvironmentStore.getState();

    // Skip fetch if store has fresh data and not forced
    if (!force && isScanFresh() && state.environments.length > 0) {
      return state.environments;
    }

    // Stale-while-revalidate: if we have cached data (from localStorage persist),
    // return it immediately and refresh in the background without showing loading state.
    const hasCachedData = !force && state.environments.length > 0;
    const requestKey = force ? 'force' : 'normal';
    const inFlight = environmentListInFlightRef.current.get(requestKey);
    if (inFlight) {
      return inFlight;
    }

    if (!hasCachedData) {
      state.setLoading(true);
    }
    state.setError(null);

    const request = tauri.envList(force)
      .then((envs) => {
        const latest = useEnvironmentStore.getState();
        latest.setEnvironments(envs);
        latest.setLastEnvScanTimestamp(Date.now());
        // Per-env settings are loaded lazily via loadEnvSettings() when the
        // user opens an environment detail view, avoiding 29+ IPC calls at startup.
        return envs;
      })
      .catch((err) => {
        const latest = useEnvironmentStore.getState();
        latest.setError(formatError(err));
        return hasCachedData ? latest.environments : [];
      })
      .finally(() => {
        environmentListInFlightRef.current.delete(requestKey);
        useEnvironmentStore.getState().setLoading(false);
      });

    environmentListInFlightRef.current.set(requestKey, request);
    return request;
  }, [isScanFresh]);

  const getDetectionSources = useCallback(async (envType: string, force?: boolean) => {
    const logicalEnvType = toLogicalEnvType(envType);
    const cached = detectionSourcesCacheRef.current.get(logicalEnvType);
    if (!force && cached) {
      return cached;
    }

    const fallback = useEnvironmentStore
      .getState()
      .getEnvSettings(logicalEnvType)
      .detectionFiles
      .map((file) => file.fileName);

    if (!tauri.isTauri() || typeof tauri.envGetDetectionSources !== 'function') {
      detectionSourcesCacheRef.current.set(logicalEnvType, fallback);
      return fallback;
    }

    try {
      const sources = await tauri.envGetDetectionSources(logicalEnvType);
      const unique = Array.from(new Set(sources));
      detectionSourcesCacheRef.current.set(logicalEnvType, unique);
      return unique;
    } catch {
      detectionSourcesCacheRef.current.set(logicalEnvType, fallback);
      return fallback;
    }
  }, [toLogicalEnvType]);

  const normalizeDetectionFiles = useCallback((
    sources: string[],
    detectionFiles: EnvironmentSettings['detectionFiles'],
    defaultEnableFirstTwo: boolean,
  ): EnvironmentSettings['detectionFiles'] => {
    if (sources.length === 0) {
      return detectionFiles;
    }

    const savedFlags = new Map(
      detectionFiles.map((file) => [file.fileName, file.enabled]),
    );

    return sources.map((fileName, index) => ({
      fileName,
      enabled: savedFlags.has(fileName)
        ? Boolean(savedFlags.get(fileName))
        : (defaultEnableFirstTwo && index < 2),
    }));
  }, []);

  const loadEnvSettings = useCallback(async (envType: string) => {
    if (!tauri.isTauri()) return null;
    const logicalEnvType = toLogicalEnvType(envType);
    const normalizedInput = normalizeEnvType(envType);
    const candidateKeys = normalizedInput === logicalEnvType
      ? [logicalEnvType]
      : [logicalEnvType, normalizedInput];

    try {
      for (const key of candidateKeys) {
        const settings = await tauri.envLoadSettings(key);
        if (!settings) {
          continue;
        }

        const normalized = toSettings(settings);
        const sources = await getDetectionSources(logicalEnvType);
        const normalizedDetectionFiles = normalizeDetectionFiles(
          sources,
          normalized.detectionFiles,
          false,
        );
        const merged: EnvironmentSettings = {
          ...useEnvironmentStore.getState().getEnvSettings(logicalEnvType),
          ...normalized,
          detectionFiles: normalizedDetectionFiles.length > 0
            ? normalizedDetectionFiles
            : useEnvironmentStore.getState().getEnvSettings(logicalEnvType).detectionFiles,
        };

        setEnvSettings(logicalEnvType, merged);
        return merged;
      }

      const sources = await getDetectionSources(logicalEnvType);
      const defaults = useEnvironmentStore.getState().getEnvSettings(logicalEnvType);
      const nextSettings: EnvironmentSettings = {
        ...defaults,
        detectionFiles: normalizeDetectionFiles(
          sources,
          defaults.detectionFiles,
          true,
        ),
      };

      setEnvSettings(logicalEnvType, nextSettings);
      return nextSettings;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [
    getDetectionSources,
    normalizeDetectionFiles,
    normalizeEnvType,
    setEnvSettings,
    setError,
    toLogicalEnvType,
    toSettings,
  ]);

  const saveEnvSettings = useCallback(async (envType: string, settings: EnvironmentSettings) => {
    const logicalEnvType = toLogicalEnvType(envType);
    const sources = await getDetectionSources(logicalEnvType);
    const normalizedSettings: EnvironmentSettings = {
      ...settings,
      detectionFiles: normalizeDetectionFiles(
        sources,
        settings.detectionFiles,
        settings.detectionFiles.length === 0,
      ),
    };
    const config = toSettingsConfig(logicalEnvType, normalizedSettings);
    if (tauri.isTauri()) {
      try {
        await tauri.envSaveSettings(config);
      } catch (err) {
        setError(formatError(err));
        throw err;
      }
    }
    detectionSourcesCacheRef.current.delete(logicalEnvType);
    detectedVersionsCacheRef.current = null;
    setEnvSettings(logicalEnvType, normalizedSettings);
  }, [
    getDetectionSources,
    normalizeDetectionFiles,
    setError,
    setEnvSettings,
    toLogicalEnvType,
    toSettingsConfig,
  ]);

  const installVersion = useCallback(async (envType: string, version: string, providerId?: string) => {
    const env = environments.find((e) => e.env_type === envType);
    const resolvedProviderId = providerId || env?.provider_id || envType;
    const providerInfo = availableProviders.find((item) => item.id === resolvedProviderId);
    const providerLabel = providerInfo?.display_name || env?.provider || resolvedProviderId;
    const aliasEnvType = providerInfo?.env_type || envType;
    const aliasKey = version.trim().toLowerCase();
    const shouldResolveAlias = ['latest', 'newest', 'current', 'lts', 'stable'].includes(aliasKey);
    let resolvedVersion = version;

    if (shouldResolveAlias && tauri.isTauri()) {
      resolvedVersion = await tauri.envResolveAlias(aliasEnvType, aliasKey);
    }
    
    // Track current installation for cancellation support
    setCurrentInstallation({ envType, version: resolvedVersion });
    
    // Open progress dialog
    openProgressDialog({
      envType,
      version: resolvedVersion,
      provider: providerLabel,
      step: 'fetching',
      progress: 0,
    });
    
    // Set up real-time progress listener if in Tauri environment
    if (tauri.isTauri()) {
      // Cleanup any existing listener and pending timeout to prevent leaks
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      unlistenRef.current?.();
      unlistenRef.current = null;
      try {
        unlistenRef.current = await tauri.listenEnvInstallProgress((progress) => {
          // Only update if it's for the current installation
          if (progress.envType === envType && progress.version === resolvedVersion) {
            updateInstallationProgress({
              step: progress.step,
              progress: progress.progress,
              speed: progress.speed ? formatSpeed(progress.speed) : undefined,
              downloadedSize: progress.downloadedSize ? formatSize(progress.downloadedSize) : undefined,
              totalSize: progress.totalSize ? formatSize(progress.totalSize) : undefined,
              error: progress.error,
            });
            
            // Auto-close on success after delay
            if (progress.step === 'done') {
              closeTimeoutRef.current = setTimeout(() => {
                setCurrentInstallation(null);
                closeProgressDialog();
                unlistenRef.current?.();
                unlistenRef.current = null;
                closeTimeoutRef.current = null;
              }, 1500);
            }
          }
        });
      } catch {
        // Event listening not available, will use fallback
      }
    }
    
    try {
      await tauri.envInstall(envType, resolvedVersion, resolvedProviderId);
      
      // Post-install verification
      if (tauri.isTauri()) {
        try {
          const verifyResult = await tauri.envVerifyInstall(envType, resolvedVersion);
          if (verifyResult && !verifyResult.installed) {
            console.warn(`[env] Post-install verification failed for ${envType}@${resolvedVersion}`, verifyResult);
          }
        } catch {
          // Verification is best-effort, don't fail the flow
        }
      }
      
      // Refresh environment data after successful install
      const updatedEnv = await tauri.envGet(envType);
      updateEnvironment(updatedEnv);
      tauri.pluginDispatchEvent('env_version_installed', { envType, version: resolvedVersion }).catch(() => {});
      emitInvalidations(
        ['environment_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'environments:install-version',
      );
      
      // If not using events (web mode), manually update progress
      if (!unlistenRef.current) {
        updateInstallationProgress({ step: 'done', progress: 100 });
        closeTimeoutRef.current = setTimeout(() => {
          setCurrentInstallation(null);
          closeProgressDialog();
          closeTimeoutRef.current = null;
        }, 1500);
      }
    } catch (err) {
      const errorMsg = formatError(err);
      updateInstallationProgress({ 
        step: 'error', 
        error: errorMsg 
      });
      setError(errorMsg);
      
      // Cleanup listener and installation state on error
      setCurrentInstallation(null);
      unlistenRef.current?.();
      unlistenRef.current = null;
      throw err;
    }
  }, [environments, availableProviders, setCurrentInstallation, openProgressDialog, updateInstallationProgress, closeProgressDialog, updateEnvironment, setError]);

  const uninstallVersion = useCallback(async (envType: string, version: string) => {
    setLoading(true);
    setError(null);
    try {
      await tauri.envUninstall(envType, version);
      const env = await tauri.envGet(envType);
      updateEnvironment(env);
      emitInvalidations(
        ['environment_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'environments:uninstall-version',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, updateEnvironment]);

  const setGlobalVersion = useCallback(async (envType: string, version: string) => {
    setError(null);
    try {
      await tauri.envUseGlobal(envType, version);
      const env = await tauri.envGet(envType);
      updateEnvironment(env);
      tauri.pluginDispatchEvent('env_version_switched', { envType, version }).catch(() => {});
      emitInvalidations(
        ['environment_data', 'provider_data'],
        'environments:set-global',
      );
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [setError, updateEnvironment]);

  const setLocalVersion = useCallback(async (envType: string, version: string, projectPath: string) => {
    setError(null);
    try {
      await tauri.envUseLocal(envType, version, projectPath);
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }, [setError]);

  const detectVersions = useCallback(async (startPath: string) => {
    if (!tauri.isTauri()) {
      return [];
    }

    const now = Date.now();
    const cached = detectedVersionsCacheRef.current;
    if (
      cached &&
      cached.path === startPath &&
      now - cached.timestamp < DETECTED_VERSIONS_CACHE_TTL_MS
    ) {
      setDetectedVersions(cached.versions);
      return cached.versions;
    }

    try {
      const detected = await tauri.envDetectAll(startPath);
      detectedVersionsCacheRef.current = {
        path: startPath,
        timestamp: now,
        versions: detected,
      };
      setDetectedVersions(detected);
      return detected;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setDetectedVersions, setError]);

  const fetchAvailableVersions = useCallback(async (envType: string, force?: boolean) => {
    const cached = useEnvironmentStore.getState().availableVersions[envType];
    if (!force && cached && cached.length > 0) {
      return cached;
    }

    const requestKey = `${envType}:${force ? 'force' : 'normal'}`;
    const inFlight = availableVersionsInFlightRef.current.get(requestKey);
    if (inFlight) {
      return inFlight;
    }

    try {
      const request = tauri.envAvailableVersions(envType, undefined, force)
        .then((versions) => {
          useEnvironmentStore.getState().setAvailableVersions(envType, versions);
          return versions;
        })
        .finally(() => {
          availableVersionsInFlightRef.current.delete(requestKey);
        });
      availableVersionsInFlightRef.current.set(requestKey, request);
      return await request;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setError]);

  const fetchProviders = useCallback(async (force?: boolean) => {
    if (!tauri.isTauri()) {
      return [];
    }

    const state = useEnvironmentStore.getState();
    const now = Date.now();
    const isProvidersCacheFresh =
      providersCacheTimestampRef.current !== null &&
      now - providersCacheTimestampRef.current < ENV_PROVIDERS_CACHE_TTL_MS;

    if (!force && isProvidersCacheFresh && state.availableProviders.length > 0) {
      return state.availableProviders;
    }

    if (!force && providersInFlightRef.current) {
      return providersInFlightRef.current;
    }

    try {
      const request = tauri.envListProviders(force).then((providers) => {
        const latest = useEnvironmentStore.getState();
        latest.setAvailableProviders(providers);
        providersCacheTimestampRef.current = Date.now();
        return providers;
      });
      providersInFlightRef.current = request;
      return await request;
    } catch (err) {
      setError(formatError(err));
      return [];
    } finally {
      providersInFlightRef.current = null;
    }
  }, [setError]);

  useEffect(() => {
    if (!tauri.isTauri()) return;
    void ensureCacheInvalidationBridge();

    const dispose = subscribeInvalidation(
      ['environment_data', 'provider_data'],
      withThrottle((event: CacheInvalidationEvent) => {
        if (event.domain === 'provider_data') {
          providersCacheTimestampRef.current = null;
          void fetchProviders(true);
          return;
        }

        if (event.domain === 'environment_data') {
          useEnvironmentStore.getState().setLastEnvScanTimestamp(null);
          void fetchEnvironments(true);
        }
      }, 500),
    );

    return () => {
      dispose();
    };
  }, [fetchEnvironments, fetchProviders]);

  const cancelInstallation = useCallback(async () => {
    if (!currentInstallation) return false;
    
    try {
      const cancelled = await tauri.envInstallCancel(currentInstallation.envType, currentInstallation.version);
      if (cancelled) {
        setCurrentInstallation(null);
        closeProgressDialog();
      }
      return cancelled;
    } catch {
      return false;
    }
  }, [currentInstallation, setCurrentInstallation, closeProgressDialog]);

  const verifyInstall = useCallback(async (envType: string, version: string) => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.envVerifyInstall(envType, version);
    } catch {
      return null;
    }
  }, []);

  const getInstalledVersions = useCallback(async (envType: string, force?: boolean) => {
    if (!tauri.isTauri()) return [];
    try {
      return await tauri.envInstalledVersions(envType, force);
    } catch {
      return [];
    }
  }, []);

  const getCurrentVersion = useCallback(async (envType: string) => {
    if (!tauri.isTauri()) return null;
    try {
      return await tauri.envCurrentVersion(envType);
    } catch {
      return null;
    }
  }, []);

  const checkEnvUpdates = useCallback(async (envType: string) => {
    if (!tauri.isTauri()) return null;
    try {
      const result = await tauri.envCheckUpdates(envType);
      useEnvironmentStore.getState().setUpdateCheckResult(envType, result);
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const checkAllEnvUpdates = useCallback(async () => {
    if (!tauri.isTauri()) return [];
    try {
      const results = await tauri.envCheckUpdatesAll();
      const { setAllUpdateCheckResults, setLastEnvUpdateCheck } = useEnvironmentStore.getState();
      setAllUpdateCheckResults(results);
      setLastEnvUpdateCheck(Date.now());
      return results;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setError]);

  const cleanupVersions = useCallback(async (envType: string, versions: string[]) => {
    if (!tauri.isTauri()) return null;
    try {
      const result = await tauri.envCleanupVersions(envType, versions);
      // Refresh environment data after cleanup
      const env = await tauri.envGet(envType);
      updateEnvironment(env);
      emitInvalidations(
        ['environment_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'environments:cleanup-versions',
      );
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError, updateEnvironment]);

  const listGlobalPackages = useCallback(async (envType: string, version: string, providerId?: string) => {
    if (!tauri.isTauri()) return [];
    try {
      return await tauri.envListGlobalPackages(envType, version, providerId);
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setError]);

  const migratePackages = useCallback(async (
    envType: string,
    fromVersion: string,
    toVersion: string,
    packages: string[],
    providerId?: string,
  ) => {
    if (!tauri.isTauri()) return null;
    try {
      const result = await tauri.envMigratePackages(envType, fromVersion, toVersion, packages, providerId);
      emitInvalidations(
        ['environment_data', 'provider_data', 'package_data'],
        'environments:migrate-packages',
      );
      return result;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  // Select only the state values consumers commonly need.
  // For UI-only state (searchQuery, viewMode, filters, dialog/panel states),
  // consumers should subscribe directly via useEnvironmentStore((s) => s.xxx).
  const detectedVersions = useEnvironmentStore((s) => s.detectedVersions);
  const availableVersions = useEnvironmentStore((s) => s.availableVersions);
  const loading = useEnvironmentStore((s) => s.loading);
  const error = useEnvironmentStore((s) => s.error);

  return {
    // State (selectively subscribed)
    environments,
    availableProviders,
    currentInstallation,
    detectedVersions,
    availableVersions,
    loading,
    error,

    // Actions (stable references, don't cause re-renders)
    fetchEnvironments,
    loadEnvSettings,
    saveEnvSettings,
    installVersion,
    uninstallVersion,
    setGlobalVersion,
    setLocalVersion,
    detectVersions,
    getDetectionSources,
    fetchAvailableVersions,
    fetchProviders,
    cancelInstallation,
    verifyInstall,
    getInstalledVersions,
    getCurrentVersion,
    checkEnvUpdates,
    checkAllEnvUpdates,
    cleanupVersions,
    listGlobalPackages,
    migratePackages,

    // Store actions consumers may need
    openAddDialog: useEnvironmentStore((s) => s.openAddDialog),
    openVersionBrowser: useEnvironmentStore((s) => s.openVersionBrowser),
    openDetailsPanel: useEnvironmentStore((s) => s.openDetailsPanel),
    setSelectedEnv: useEnvironmentStore((s) => s.setSelectedEnv),
  };
}
