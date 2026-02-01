'use client';

import { useCallback } from 'react';
import { useEnvironmentStore } from '../stores/environment';
import * as tauri from '../tauri';

export function useEnvironments() {
  const store = useEnvironmentStore();

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
    
    // Open progress dialog
    store.openProgressDialog({
      envType,
      version,
      provider,
      step: 'fetching',
      progress: 0,
    });
    
    try {
      // Simulate progress steps
      store.updateInstallationProgress({ step: 'fetching', progress: 10 });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      store.updateInstallationProgress({ step: 'downloading', progress: 30 });
      await tauri.envInstall(envType, version);
      
      store.updateInstallationProgress({ step: 'configuring', progress: 80 });
      const updatedEnv = await tauri.envGet(envType);
      store.updateEnvironment(updatedEnv);
      
      store.updateInstallationProgress({ step: 'done', progress: 100 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      store.closeProgressDialog();
    } catch (err) {
      store.updateInstallationProgress({ 
        step: 'error', 
        error: err instanceof Error ? err.message : String(err) 
      });
      store.setError(err instanceof Error ? err.message : String(err));
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

  return {
    ...store,
    fetchEnvironments,
    installVersion,
    uninstallVersion,
    setGlobalVersion,
    setLocalVersion,
    detectVersions,
    fetchAvailableVersions,
  };
}
