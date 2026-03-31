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
import { useEnvironmentWorkflow } from '@/hooks/environments/use-environment-workflow';
import {
  type CacheInvalidationEvent,
  emitInvalidations,
  ensureCacheInvalidationBridge,
  subscribeInvalidation,
  withThrottle,
} from '@/lib/cache/invalidation';

const ENV_PROVIDERS_CACHE_TTL_MS = 10 * 60 * 1000;
const DETECTED_VERSIONS_CACHE_TTL_MS = 10 * 1000;

type InstallTerminalState = "completed" | "failed" | "cancelled";

function resolveTerminalState(
  progress: tauri.EnvInstallProgressEvent,
): InstallTerminalState | undefined {
  if (progress.terminalState) return progress.terminalState;
  if (progress.step === "done") return "completed";
  if (progress.step === "error") return "failed";
  if (progress.step === "cancelled") return "cancelled";
  return undefined;
}

function isCancelledMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("cancelled") || normalized.includes("canceled");
}

function getPersistedProjectPath(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem('cognia-project-path');
}

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
  const {
    setWorkflowActionState,
    reconcileEnvironmentWorkflow: reconcileEnvironmentWorkflowState,
  } = useEnvironmentWorkflow();

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const environmentListInFlightRef = useRef<Map<string, Promise<tauri.EnvironmentInfo[]>>>(new Map());
  const availableVersionsInFlightRef = useRef<Map<string, Promise<tauri.VersionInfo[]>>>(new Map());
  const providersInFlightRef = useRef<Promise<tauri.EnvironmentProviderInfo[]> | null>(null);
  const providersCacheTimestampRef = useRef<number | null>(null);
  const detectionSourcesCacheRef = useRef<Map<string, string[]>>(new Map());
  const defaultDetectionSourcesCacheRef = useRef<Map<string, string[]>>(new Map());
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

  const resolveProviderId = useCallback((
    envType: string,
    explicitProviderId?: string | null,
  ): string | undefined => {
    const state = useEnvironmentStore.getState();
    const normalizedEnvType = normalizeEnvType(envType);
    const logicalEnvType = toLogicalEnvType(envType);

    if (explicitProviderId && explicitProviderId.trim()) {
      return normalizeEnvType(explicitProviderId);
    }

    // Back-compat: some call-sites historically pass provider-id as envType.
    // If envType maps to a different logical type, treat envType as provider-id.
    if (normalizedEnvType !== logicalEnvType) {
      return normalizedEnvType;
    }

    // Prefer persisted selection even if providers list is not loaded yet.
    const persistedSelected = state.selectedProviders?.[logicalEnvType];
    if (persistedSelected && persistedSelected.trim()) {
      return normalizeEnvType(persistedSelected);
    }

    // Next best: provider id from the most recent environment row.
    const envRowProviderId = state.environments.find((environment) => (
      normalizeEnvType(environment.env_type) === logicalEnvType
    ))?.provider_id;
    if (envRowProviderId && envRowProviderId.trim()) {
      return normalizeEnvType(envRowProviderId);
    }

    // Last resort: let store attempt selection if provider list is available.
    const resolved = state.getSelectedProvider(envType, envRowProviderId ?? null);
    const normalizedResolved = normalizeEnvType(resolved);
    const resolvedLooksLikeEnvType =
      normalizedResolved === logicalEnvType || normalizedResolved === normalizedEnvType;
    if (!resolvedLooksLikeEnvType) {
      return normalizedResolved;
    }

    return undefined;
  }, [normalizeEnvType, toLogicalEnvType]);

  const reconcileEnvironmentWorkflow = useCallback(async (options?: {
    projectPath?: string | null;
    refreshProviders?: boolean;
  }) => {
    detectedVersionsCacheRef.current = null;

    const result = await reconcileEnvironmentWorkflowState(options);
    if (result.providers) {
      providersCacheTimestampRef.current = Date.now();
    }
    if (result.detected && result.projectPath) {
      detectedVersionsCacheRef.current = {
        path: result.projectPath,
        timestamp: Date.now(),
        versions: result.detected,
      };
    }
  }, [reconcileEnvironmentWorkflowState]);

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

  const getDefaultDetectionSources = useCallback(async (envType: string, force?: boolean) => {
    const logicalEnvType = toLogicalEnvType(envType);
    const cached = defaultDetectionSourcesCacheRef.current.get(logicalEnvType);
    if (!force && cached) {
      return cached;
    }

    const fallback = useEnvironmentStore
      .getState()
      .getEnvSettings(logicalEnvType)
      .detectionFiles
      .filter((file) => file.enabled)
      .map((file) => file.fileName);

    if (!tauri.isTauri() || typeof tauri.envGetDefaultDetectionSources !== 'function') {
      defaultDetectionSourcesCacheRef.current.set(logicalEnvType, fallback);
      return fallback;
    }

    try {
      const sources = await tauri.envGetDefaultDetectionSources(logicalEnvType);
      const unique = Array.from(new Set(sources));
      defaultDetectionSourcesCacheRef.current.set(logicalEnvType, unique);
      return unique;
    } catch {
      defaultDetectionSourcesCacheRef.current.set(logicalEnvType, fallback);
      return fallback;
    }
  }, [toLogicalEnvType]);

  const normalizeDetectionFiles = useCallback((
    sources: string[],
    defaultEnabledSources: string[],
    detectionFiles: EnvironmentSettings['detectionFiles'],
  ): EnvironmentSettings['detectionFiles'] => {
    if (sources.length === 0) {
      return detectionFiles;
    }

    const savedFlags = new Map(
      detectionFiles.map((file) => [file.fileName, file.enabled]),
    );
    const defaultEnabled = new Set(defaultEnabledSources);

    return sources.map((fileName) => ({
      fileName,
      enabled: savedFlags.has(fileName)
        ? Boolean(savedFlags.get(fileName))
        : defaultEnabled.has(fileName),
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
        const [sources, defaultEnabledSources] = await Promise.all([
          getDetectionSources(logicalEnvType),
          getDefaultDetectionSources(logicalEnvType),
        ]);
        const normalizedDetectionFiles = normalizeDetectionFiles(
          sources,
          defaultEnabledSources,
          normalized.detectionFiles,
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

      const [sources, defaultEnabledSources] = await Promise.all([
        getDetectionSources(logicalEnvType),
        getDefaultDetectionSources(logicalEnvType),
      ]);
      const defaults = useEnvironmentStore.getState().getEnvSettings(logicalEnvType);
      const nextSettings: EnvironmentSettings = {
        ...defaults,
        detectionFiles: normalizeDetectionFiles(
          sources,
          defaultEnabledSources,
          defaults.detectionFiles,
        ),
      };

      setEnvSettings(logicalEnvType, nextSettings);
      return nextSettings;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [
    getDefaultDetectionSources,
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
    const projectPath =
      useEnvironmentStore.getState().workflowContext?.projectPath
      ?? getPersistedProjectPath();
    const [sources, defaultEnabledSources] = await Promise.all([
      getDetectionSources(logicalEnvType),
      getDefaultDetectionSources(logicalEnvType),
    ]);
    const normalizedSettings: EnvironmentSettings = {
      ...settings,
      detectionFiles: normalizeDetectionFiles(
        sources,
        defaultEnabledSources,
        settings.detectionFiles,
      ),
    };
    const config = toSettingsConfig(logicalEnvType, normalizedSettings);
    setWorkflowActionState(logicalEnvType, 'saveSettings', 'running', {
      projectPath,
    });
    if (tauri.isTauri()) {
      try {
        await tauri.envSaveSettings(config);
      } catch (err) {
        setWorkflowActionState(logicalEnvType, 'saveSettings', 'error', {
          projectPath,
          error: formatError(err),
          retryable: true,
        });
        setError(formatError(err));
        throw err;
      }
    }
    detectionSourcesCacheRef.current.delete(logicalEnvType);
    defaultDetectionSourcesCacheRef.current.delete(logicalEnvType);
    detectedVersionsCacheRef.current = null;
    setEnvSettings(logicalEnvType, normalizedSettings);
    await reconcileEnvironmentWorkflow({ projectPath });
    setWorkflowActionState(logicalEnvType, 'saveSettings', 'success', {
      projectPath,
    });
  }, [
    getDefaultDetectionSources,
    getDetectionSources,
    normalizeDetectionFiles,
    reconcileEnvironmentWorkflow,
    setError,
    setEnvSettings,
    setWorkflowActionState,
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

    setWorkflowActionState(envType, 'install', 'running', {
      version: resolvedVersion,
      providerId: resolvedProviderId,
    });
    
    // Track current installation for cancellation support
    setCurrentInstallation({ envType, version: resolvedVersion });
    
    // Open progress dialog
    openProgressDialog({
      envType,
      version: resolvedVersion,
      provider: providerLabel,
      step: 'fetching',
      phase: 'resolve',
      stageMessage: 'Resolving provider and install plan',
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
            const terminalState = resolveTerminalState(progress);
            updateInstallationProgress({
              step: progress.step,
              phase: progress.phase,
              terminalState,
              failureClass: progress.failureClass,
              artifact: progress.artifact,
              stageMessage: progress.stageMessage,
              selectionRationale: progress.selectionRationale,
              retryable: progress.retryable,
              retryAfterSeconds: progress.retryAfterSeconds,
              attempt: progress.attempt,
              maxAttempts: progress.maxAttempts,
              provider: progress.artifact?.provider || providerLabel,
              progress: progress.progress,
              speed: progress.speed ? formatSpeed(progress.speed) : undefined,
              downloadedSize: progress.downloadedSize ? formatSize(progress.downloadedSize) : undefined,
              totalSize: progress.totalSize ? formatSize(progress.totalSize) : undefined,
              error: progress.error,
            });

            if (terminalState) {
              setCurrentInstallation(null);
              unlistenRef.current?.();
              unlistenRef.current = null;

              if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
              }

              if (terminalState !== 'failed') {
                closeTimeoutRef.current = setTimeout(() => {
                  closeProgressDialog();
                  closeTimeoutRef.current = null;
                }, terminalState === 'cancelled' ? 1000 : 1500);
              }
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
          const verifyResult = await tauri.envVerifyInstall(
            envType,
            resolvedVersion,
            resolvedProviderId,
          );
          if (verifyResult && !verifyResult.installed) {
            console.warn(`[env] Post-install verification failed for ${envType}@${resolvedVersion}`, verifyResult);
          }
        } catch {
          // Verification is best-effort, don't fail the flow
        }
      }
      
      // Refresh environment data after successful install
      const updatedEnv = await tauri.envGet(envType, resolvedProviderId);
      updateEnvironment(updatedEnv);
      tauri.pluginDispatchEvent('env_version_installed', { envType, version: resolvedVersion }).catch(() => {});
      emitInvalidations(
        ['environment_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'environments:install-version',
      );
      await reconcileEnvironmentWorkflow({ refreshProviders: true });
      setWorkflowActionState(envType, 'install', 'success', {
        version: resolvedVersion,
        providerId: resolvedProviderId,
      });
      
      // If not using events (web mode), manually update progress
      if (!unlistenRef.current) {
        updateInstallationProgress({
          step: 'done',
          phase: 'finalize',
          terminalState: 'completed',
          progress: 100,
        });
        closeTimeoutRef.current = setTimeout(() => {
          setCurrentInstallation(null);
          closeProgressDialog();
          closeTimeoutRef.current = null;
        }, 1500);
      }
    } catch (err) {
      const errorMsg = formatError(err);
      const isCancelled = isCancelledMessage(errorMsg);
      const currentProgress = useEnvironmentStore.getState().installationProgress;
      const alreadyTerminal =
        currentProgress?.terminalState !== undefined ||
        currentProgress?.step === 'done' ||
        currentProgress?.step === 'error' ||
        currentProgress?.step === 'cancelled';

      if (!alreadyTerminal) {
        updateInstallationProgress({
          step: isCancelled ? 'cancelled' : 'error',
          terminalState: isCancelled ? 'cancelled' : 'failed',
          failureClass: isCancelled ? 'cancelled' : 'network_error',
          retryable: isCancelled ? false : undefined,
          phase: currentProgress?.phase,
          error: errorMsg,
        });
      }
      setWorkflowActionState(envType, 'install', 'error', {
        version: resolvedVersion,
        providerId: resolvedProviderId,
        error: errorMsg,
        retryable: !isCancelled,
      });
      setError(errorMsg);
      
      // Cleanup listener and installation state on error
      setCurrentInstallation(null);
      unlistenRef.current?.();
      unlistenRef.current = null;
      throw err;
    }
  }, [
    environments,
    availableProviders,
    setCurrentInstallation,
    openProgressDialog,
    updateInstallationProgress,
    closeProgressDialog,
    updateEnvironment,
    reconcileEnvironmentWorkflow,
    resolveProviderId,
    setError,
    setWorkflowActionState,
  ]);

  const uninstallVersion = useCallback(async (
    envType: string,
    version: string,
    providerId?: string,
  ) => {
    setLoading(true);
    setError(null);
    const resolvedProviderId = resolveProviderId(envType, providerId);
    setWorkflowActionState(envType, 'uninstall', 'running', {
      version,
      providerId: resolvedProviderId,
    });
    try {
      await tauri.envUninstall(envType, version, resolvedProviderId);
      const env = await tauri.envGet(envType, resolvedProviderId);
      updateEnvironment(env);
      emitInvalidations(
        ['environment_data', 'provider_data', 'cache_overview', 'about_cache_stats'],
        'environments:uninstall-version',
      );
      await reconcileEnvironmentWorkflow({ refreshProviders: true });
      setWorkflowActionState(envType, 'uninstall', 'success', {
        version,
        providerId: resolvedProviderId,
      });
    } catch (err) {
      setWorkflowActionState(envType, 'uninstall', 'error', {
        version,
        providerId: resolvedProviderId,
        error: formatError(err),
        retryable: true,
      });
      setError(formatError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [reconcileEnvironmentWorkflow, resolveProviderId, setError, setLoading, setWorkflowActionState, updateEnvironment]);

  const setGlobalVersion = useCallback(async (
    envType: string,
    version: string,
    providerId?: string,
  ) => {
    setError(null);
    const resolvedProviderId = resolveProviderId(envType, providerId);
    setWorkflowActionState(envType, 'setGlobal', 'running', {
      version,
      providerId: resolvedProviderId,
    });
    try {
      const mutation = await tauri.envUseGlobal(
        envType,
        version,
        resolvedProviderId,
      );
      if (mutation?.success === false) {
        throw new Error(
          mutation.message ||
            `Failed to switch global ${envType} version to ${version}`,
        );
      }
      const env = await tauri.envGet(envType, resolvedProviderId);
      updateEnvironment(env);
      tauri.pluginDispatchEvent('env_version_switched', { envType, version }).catch(() => {});
      emitInvalidations(
        ['environment_data', 'provider_data'],
        'environments:set-global',
      );
      await reconcileEnvironmentWorkflow({});
      setWorkflowActionState(envType, 'setGlobal', 'success', {
        version,
        providerId: resolvedProviderId,
      });
    } catch (err) {
      setWorkflowActionState(envType, 'setGlobal', 'error', {
        version,
        providerId: resolvedProviderId,
        error: formatError(err),
        retryable: true,
      });
      setError(formatError(err));
      throw err;
    }
  }, [reconcileEnvironmentWorkflow, resolveProviderId, setError, setWorkflowActionState, updateEnvironment]);

  const setLocalVersion = useCallback(async (
    envType: string,
    version: string,
    projectPath: string,
    providerId?: string,
  ) => {
    setError(null);
    const resolvedProviderId = resolveProviderId(envType, providerId);
    setWorkflowActionState(envType, 'setLocal', 'running', {
      version,
      projectPath,
      providerId: resolvedProviderId,
    });
    try {
      const mutation = await tauri.envUseLocal(
        envType,
        version,
        projectPath,
        resolvedProviderId,
      );
      if (mutation?.success === false) {
        throw new Error(
          mutation.message ||
            `Failed to switch local ${envType} version to ${version}`,
        );
      }
      emitInvalidations(
        ['environment_data', 'provider_data'],
        'environments:set-local',
      );
      await reconcileEnvironmentWorkflow({ projectPath });
      setWorkflowActionState(envType, 'setLocal', 'success', {
        version,
        projectPath,
        providerId: resolvedProviderId,
      });
    } catch (err) {
      setWorkflowActionState(envType, 'setLocal', 'error', {
        version,
        projectPath,
        providerId: resolvedProviderId,
        error: formatError(err),
        retryable: true,
      });
      setError(formatError(err));
      throw err;
    }
  }, [reconcileEnvironmentWorkflow, resolveProviderId, setError, setWorkflowActionState]);

  const detectVersions = useCallback(async (
    startPath: string,
    options?: { force?: boolean },
  ) => {
    if (!tauri.isTauri()) {
      return [];
    }

    const now = Date.now();
    const cached = detectedVersionsCacheRef.current;
    if (
      !options?.force &&
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

  const fetchAvailableVersions = useCallback(async (envType: string, force?: boolean, providerId?: string) => {
    const cacheKey = providerId ? `${envType}::${providerId}` : envType;
    const cached = useEnvironmentStore.getState().availableVersions[cacheKey];
    if (!force && cached && cached.length > 0) {
      return cached;
    }

    const requestKey = `${cacheKey}:${force ? 'force' : 'normal'}`;
    const inFlight = availableVersionsInFlightRef.current.get(requestKey);
    if (inFlight) {
      return inFlight;
    }

    try {
      const request = tauri.envAvailableVersions(envType, providerId, force)
        .then((versions) => {
          useEnvironmentStore.getState().setAvailableVersions(cacheKey, versions);
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
        updateInstallationProgress({
          step: 'cancelled',
          terminalState: 'cancelled',
          failureClass: 'cancelled',
          retryable: false,
          error: 'Installation cancelled by user',
        });
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
        closeTimeoutRef.current = setTimeout(() => {
          setCurrentInstallation(null);
          closeProgressDialog();
          closeTimeoutRef.current = null;
        }, 1000);
      }
      return cancelled;
    } catch {
      return false;
    }
  }, [currentInstallation, setCurrentInstallation, closeProgressDialog, updateInstallationProgress]);

  const verifyInstall = useCallback(async (
    envType: string,
    version: string,
    providerId?: string,
  ) => {
    if (!tauri.isTauri()) return null;
    const resolvedProviderId = resolveProviderId(envType, providerId);
    try {
      if (resolvedProviderId) {
        return await tauri.envVerifyInstall(envType, version, resolvedProviderId);
      }
      return await tauri.envVerifyInstall(envType, version);
    } catch {
      return null;
    }
  }, [resolveProviderId]);

  const getInstalledVersions = useCallback(async (
    envType: string,
    providerId?: string,
    force?: boolean,
  ) => {
    if (!tauri.isTauri()) return [];
    const resolvedProviderId = resolveProviderId(envType, providerId);
    try {
      if (resolvedProviderId) {
        if (force !== undefined) {
          return await tauri.envInstalledVersions(envType, resolvedProviderId, force);
        }
        return await tauri.envInstalledVersions(envType, resolvedProviderId);
      }

      // Avoid passing an extra `undefined` argument when force is omitted.
      if (force !== undefined) {
        return await tauri.envInstalledVersions(envType, undefined, force);
      }
      return await tauri.envInstalledVersions(envType, undefined);
    } catch {
      return [];
    }
  }, [resolveProviderId]);

  const getCurrentVersion = useCallback(async (
    envType: string,
    providerId?: string,
  ) => {
    if (!tauri.isTauri()) return null;
    const resolvedProviderId = resolveProviderId(envType, providerId);
    try {
      if (resolvedProviderId) {
        return await tauri.envCurrentVersion(envType, resolvedProviderId);
      }
      return await tauri.envCurrentVersion(envType);
    } catch {
      return null;
    }
  }, [resolveProviderId]);

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
