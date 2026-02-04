'use client';

import { useCallback, useRef } from 'react';
import { useEnvironmentStore, type EnvironmentSettings } from '../stores/environment';
import * as tauri from '../tauri';
import { formatSize, formatSpeed } from '../utils';
import { formatError } from '../errors';
import type { UnlistenFn } from '@tauri-apps/api/event';

export function useEnvironments() {
  // Select state values
  const environments = useEnvironmentStore((s) => s.environments);
  const availableProviders = useEnvironmentStore((s) => s.availableProviders);
  const currentInstallation = useEnvironmentStore((s) => s.currentInstallation);

  // Select stable action references (these don't change between renders)
  const setLoading = useEnvironmentStore((s) => s.setLoading);
  const setError = useEnvironmentStore((s) => s.setError);
  const setEnvironments = useEnvironmentStore((s) => s.setEnvironments);
  const setEnvSettings = useEnvironmentStore((s) => s.setEnvSettings);
  const updateEnvironment = useEnvironmentStore((s) => s.updateEnvironment);
  const setDetectedVersions = useEnvironmentStore((s) => s.setDetectedVersions);
  const setAvailableVersions = useEnvironmentStore((s) => s.setAvailableVersions);
  const setAvailableProviders = useEnvironmentStore((s) => s.setAvailableProviders);
  const setCurrentInstallation = useEnvironmentStore((s) => s.setCurrentInstallation);
  const openProgressDialog = useEnvironmentStore((s) => s.openProgressDialog);
  const closeProgressDialog = useEnvironmentStore((s) => s.closeProgressDialog);
  const updateInstallationProgress = useEnvironmentStore((s) => s.updateInstallationProgress);

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setLoading(true);
    setError(null);
    try {
      const envs = await tauri.envList();
      setEnvironments(envs);
      if (tauri.isTauri()) {
        await Promise.all(envs.map(async (env) => {
          const settings = await tauri.envLoadSettings(env.env_type);
          if (settings) {
            setEnvSettings(env.env_type, toSettings(settings));
          }
        }));
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setEnvironments, setEnvSettings, toSettings]);

  const loadEnvSettings = useCallback(async (envType: string) => {
    if (!tauri.isTauri()) return null;
    try {
      const settings = await tauri.envLoadSettings(envType);
      if (settings) {
        const normalized = toSettings(settings);
        setEnvSettings(envType, normalized);
        return normalized;
      }
      return null;
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setEnvSettings, setError, toSettings]);

  const saveEnvSettings = useCallback(async (envType: string, settings: EnvironmentSettings) => {
    const config = toSettingsConfig(envType, settings);
    if (tauri.isTauri()) {
      try {
        await tauri.envSaveSettings(config);
      } catch (err) {
        setError(formatError(err));
        throw err;
      }
    }
    setEnvSettings(envType, settings);
  }, [setError, setEnvSettings, toSettingsConfig]);

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
      
      // Refresh environment data after successful install
      const updatedEnv = await tauri.envGet(envType);
      updateEnvironment(updatedEnv);
      
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
    try {
      const detected = await tauri.envDetectAll(startPath);
      setDetectedVersions(detected);
      return detected;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setDetectedVersions, setError]);

  const fetchAvailableVersions = useCallback(async (envType: string) => {
    try {
      const versions = await tauri.envAvailableVersions(envType);
      setAvailableVersions(envType, versions);
      return versions;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setAvailableVersions, setError]);

  const fetchProviders = useCallback(async () => {
    try {
      const providers = await tauri.envListProviders();
      setAvailableProviders(providers);
      return providers;
    } catch (err) {
      setError(formatError(err));
      return [];
    }
  }, [setAvailableProviders, setError]);

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

  // Get full store for return (read-only state values)
  const store = useEnvironmentStore();

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
