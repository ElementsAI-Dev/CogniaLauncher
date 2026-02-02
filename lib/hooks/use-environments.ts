'use client';

import { useCallback, useRef } from 'react';
import { useEnvironmentStore } from '../stores/environment';
import * as tauri from '../tauri';
import { formatSize, formatSpeed } from '../utils';
import type { UnlistenFn } from '@tauri-apps/api/event';

export function useEnvironments() {
  const store = useEnvironmentStore();
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const fetchEnvironments = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const envs = await tauri.envList();
      store.setEnvironments(envs);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const installVersion = useCallback(async (envType: string, version: string) => {
    const env = store.environments.find(e => e.env_type === envType);
    const provider = env?.provider || envType;
    
    // Track current installation for cancellation support
    store.setCurrentInstallation({ envType, version });
    
    // Open progress dialog
    store.openProgressDialog({
      envType,
      version,
      provider,
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
          if (progress.envType === envType && progress.version === version) {
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
      await tauri.envInstall(envType, version);
      
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
      store.updateInstallationProgress({ 
        step: 'error', 
        error: err instanceof Error ? err.message : String(err) 
      });
      store.setError(err instanceof Error ? err.message : String(err));
      
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
      store.setError(err instanceof Error ? err.message : String(err));
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
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store]);

  const setLocalVersion = useCallback(async (envType: string, version: string, projectPath: string) => {
    store.setError(null);
    try {
      await tauri.envUseLocal(envType, version, projectPath);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store]);

  const detectVersions = useCallback(async (startPath: string) => {
    try {
      const detected = await tauri.envDetectAll(startPath);
      store.setDetectedVersions(detected);
      return detected;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }, [store]);

  const fetchAvailableVersions = useCallback(async (envType: string) => {
    try {
      const versions = await tauri.envAvailableVersions(envType);
      store.setAvailableVersions(envType, versions);
      return versions;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }, [store]);

  const fetchProviders = useCallback(async () => {
    try {
      const providers = await tauri.envListProviders();
      store.setAvailableProviders(providers);
      return providers;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
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
