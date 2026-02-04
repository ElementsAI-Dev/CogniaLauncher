'use client';

import { useCallback, useRef } from 'react';
import { useEnvironmentStore, type EnvironmentSettings } from '../stores/environment';
import * as tauri from '../tauri';
import { formatSize, formatSpeed } from '../utils';
import { formatError } from '../errors';
import type { UnlistenFn } from '@tauri-apps/api/event';

export function useEnvironments() {
  const store = useEnvironmentStore();
  const unlistenRef = useRef<UnlistenFn | null>(null);

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
    env_type: envType,
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
  }), []);

  const fetchEnvironments = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const envs = await tauri.envList();
      store.setEnvironments(envs);
      if (tauri.isTauri()) {
        await Promise.all(envs.map(async (env) => {
          const settings = await tauri.envLoadSettings(env.env_type);
          if (settings) {
            store.setEnvSettings(env.env_type, toSettings(settings));
          }
        }));
      }
    } catch (err) {
      store.setError(formatError(err));
    } finally {
      store.setLoading(false);
    }
  }, [store, toSettings]);

  const loadEnvSettings = useCallback(async (envType: string) => {
    if (!tauri.isTauri()) return null;
    try {
      const settings = await tauri.envLoadSettings(envType);
      if (settings) {
        const normalized = toSettings(settings);
        store.setEnvSettings(envType, normalized);
        return normalized;
      }
      return null;
    } catch (err) {
      store.setError(formatError(err));
      return null;
    }
  }, [store, toSettings]);

  const saveEnvSettings = useCallback(async (envType: string, settings: EnvironmentSettings) => {
    const config = toSettingsConfig(envType, settings);
    if (tauri.isTauri()) {
      try {
        await tauri.envSaveSettings(config);
      } catch (err) {
        store.setError(formatError(err));
        throw err;
      }
    }
    store.setEnvSettings(envType, settings);
  }, [store, toSettingsConfig]);

  const installVersion = useCallback(async (envType: string, version: string, providerId?: string) => {
    const env = store.environments.find(e => e.env_type === envType);
    const resolvedProviderId = providerId || env?.provider_id || envType;
    const providerInfo = store.availableProviders.find((item) => item.id === resolvedProviderId);
    const providerLabel = providerInfo?.display_name || env?.provider || resolvedProviderId;
    const aliasEnvType = providerInfo?.env_type || envType;
    const aliasKey = version.trim().toLowerCase();
    const shouldResolveAlias = ['latest', 'newest', 'current', 'lts', 'stable'].includes(aliasKey);
    let resolvedVersion = version;

    if (shouldResolveAlias && tauri.isTauri()) {
      resolvedVersion = await tauri.envResolveAlias(aliasEnvType, aliasKey);
    }
    
    // Track current installation for cancellation support
    store.setCurrentInstallation({ envType, version: resolvedVersion });
    
    // Open progress dialog
    store.openProgressDialog({
      envType,
      version: resolvedVersion,
      provider: providerLabel,
      step: 'fetching',
      progress: 0,
    });
    
    // Set up real-time progress listener if in Tauri environment
    if (tauri.isTauri()) {
      // Cleanup any existing listener first to prevent leaks
      unlistenRef.current?.();
      unlistenRef.current = null;
      try {
        unlistenRef.current = await tauri.listenEnvInstallProgress((progress) => {
          // Only update if it's for the current installation
          if (progress.envType === envType && progress.version === resolvedVersion) {
            store.updateInstallationProgress({
              step: progress.step,
              progress: progress.progress,
              speed: progress.speed ? formatSpeed(progress.speed) : undefined,
              downloadedSize: progress.downloadedSize ? formatSize(progress.downloadedSize) : undefined,
              totalSize: progress.totalSize ? formatSize(progress.totalSize) : undefined,
              error: progress.error,
            });
            
            // Auto-close on success after delay
            if (progress.step === 'done') {
              setTimeout(() => {
                store.setCurrentInstallation(null);
                store.closeProgressDialog();
                unlistenRef.current?.();
                unlistenRef.current = null;
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
      
      // Refresh environment data after successful install
      const updatedEnv = await tauri.envGet(envType);
      store.updateEnvironment(updatedEnv);
      
      // If not using events (web mode), manually update progress
      if (!unlistenRef.current) {
        store.updateInstallationProgress({ step: 'done', progress: 100 });
        setTimeout(() => {
          store.setCurrentInstallation(null);
          store.closeProgressDialog();
        }, 1500);
      }
    } catch (err) {
      const errorMsg = formatError(err);
      store.updateInstallationProgress({ 
        step: 'error', 
        error: errorMsg 
      });
      store.setError(errorMsg);
      
      // Cleanup listener and installation state on error
      store.setCurrentInstallation(null);
      unlistenRef.current?.();
      unlistenRef.current = null;
      throw err;
    }
  }, [store]);

  const uninstallVersion = useCallback(async (envType: string, version: string) => {
    store.setLoading(true);
    store.setError(null);
    try {
      await tauri.envUninstall(envType, version);
      const env = await tauri.envGet(envType);
      store.updateEnvironment(env);
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const setGlobalVersion = useCallback(async (envType: string, version: string) => {
    store.setError(null);
    try {
      await tauri.envUseGlobal(envType, version);
      const env = await tauri.envGet(envType);
      store.updateEnvironment(env);
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  }, [store]);

  const setLocalVersion = useCallback(async (envType: string, version: string, projectPath: string) => {
    store.setError(null);
    try {
      await tauri.envUseLocal(envType, version, projectPath);
    } catch (err) {
      store.setError(formatError(err));
      throw err;
    }
  }, [store]);

  const detectVersions = useCallback(async (startPath: string) => {
    try {
      const detected = await tauri.envDetectAll(startPath);
      store.setDetectedVersions(detected);
      return detected;
    } catch (err) {
      store.setError(formatError(err));
      return [];
    }
  }, [store]);

  const fetchAvailableVersions = useCallback(async (envType: string) => {
    try {
      const versions = await tauri.envAvailableVersions(envType);
      store.setAvailableVersions(envType, versions);
      return versions;
    } catch (err) {
      store.setError(formatError(err));
      return [];
    }
  }, [store]);

  const fetchProviders = useCallback(async () => {
    try {
      const providers = await tauri.envListProviders();
      store.setAvailableProviders(providers);
      return providers;
    } catch (err) {
      store.setError(formatError(err));
      return [];
    }
  }, [store]);

  const cancelInstallation = useCallback(async () => {
    const current = store.currentInstallation;
    if (!current) return false;
    
    try {
      const cancelled = await tauri.envInstallCancel(current.envType, current.version);
      if (cancelled) {
        store.setCurrentInstallation(null);
        store.closeProgressDialog();
      }
      return cancelled;
    } catch {
      return false;
    }
  }, [store]);

  return {
    ...store,
    fetchEnvironments,
    loadEnvSettings,
    saveEnvSettings,
    installVersion,
    uninstallVersion,
    setGlobalVersion,
    setLocalVersion,
    detectVersions,
    fetchAvailableVersions,
    fetchProviders,
    cancelInstallation,
  };
}
