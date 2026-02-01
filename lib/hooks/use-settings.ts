'use client';

import { useCallback } from 'react';
import { useSettingsStore } from '../stores/settings';
import * as tauri from '../tauri';
import type { CacheSettings } from '../tauri';

export function useSettings() {
  const store = useSettingsStore();

  const fetchConfig = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const configList = await tauri.configList();
      const config: Record<string, string> = {};
      configList.forEach(([key, value]) => {
        config[key] = value;
      });
      store.setConfig(config);
      return config;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return {};
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const updateConfigValue = useCallback(async (key: string, value: string) => {
    store.setError(null);
    try {
      await tauri.configSet(key, value);
      store.updateConfig(key, value);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [store]);

  const resetConfig = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      await tauri.configReset();
      await fetchConfig();
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      store.setLoading(false);
    }
  }, [store, fetchConfig]);

  const fetchCacheInfo = useCallback(async () => {
    try {
      const info = await tauri.cacheInfo();
      store.setCacheInfo(info);
      return info;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [store]);

  const cleanCache = useCallback(async (cleanType?: string) => {
    store.setLoading(true);
    store.setError(null);
    try {
      const result = await tauri.cacheClean(cleanType);
      await fetchCacheInfo();
      return result;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      store.setLoading(false);
    }
  }, [store, fetchCacheInfo]);

  const fetchPlatformInfo = useCallback(async () => {
    try {
      const [platform, dir] = await Promise.all([
        tauri.getPlatformInfo(),
        tauri.getCogniaDir(),
      ]);
      store.setPlatformInfo(platform);
      store.setCogniaDir(dir);
      return platform;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [store]);

  const fetchCacheSettings = useCallback(async () => {
    try {
      const settings = await tauri.getCacheSettings();
      store.setCacheSettings(settings);
      return settings;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [store]);

  const updateCacheSettings = useCallback(async (settings: CacheSettings) => {
    store.setLoading(true);
    store.setError(null);
    try {
      await tauri.setCacheSettings(settings);
      store.setCacheSettings(settings);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const verifyCacheIntegrity = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const result = await tauri.cacheVerify();
      store.setCacheVerification(result);
      return result;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const repairCache = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const result = await tauri.cacheRepair();
      store.setCacheVerification(null);
      await fetchCacheInfo();
      return result;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      store.setLoading(false);
    }
  }, [store, fetchCacheInfo]);

  return {
    ...store,
    fetchConfig,
    updateConfigValue,
    resetConfig,
    fetchCacheInfo,
    cleanCache,
    fetchPlatformInfo,
    fetchCacheSettings,
    updateCacheSettings,
    verifyCacheIntegrity,
    repairCache,
  };
}
