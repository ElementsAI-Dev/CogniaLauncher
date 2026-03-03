'use client';

import { useCallback } from 'react';
import { useSettingsStore } from '@/lib/stores/settings';
import * as tauri from '@/lib/tauri';
import type { CacheSettings } from '@/lib/tauri';
import {
  DESKTOP_APP_SETTINGS_MIGRATION_FLAG,
  configToAppSettings,
  readLegacyAppSettingsFromStorage,
  toConfigEntriesFromAppSettings,
} from '@/lib/settings/app-settings-mapping';

export function useSettings() {
  const store = useSettingsStore();

  const parseIntegerConfigValue = useCallback(
    (key: string, value: string, min: number): number => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < min) {
        throw new Error(`Invalid value for ${key}`);
      }
      return parsed;
    },
    []
  );

  const applyAppSettingsFromConfig = useCallback((config: Record<string, string>) => {
    const current = useSettingsStore.getState();
    const next = configToAppSettings(config, current.appSettings);
    current.setAppSettings(next);
  }, []);

  const migrateLegacyDesktopSettings = useCallback(
    async (config: Record<string, string>): Promise<Record<string, string>> => {
      if (!tauri.isTauri() || typeof window === 'undefined') {
        return config;
      }

      if (window.localStorage.getItem(DESKTOP_APP_SETTINGS_MIGRATION_FLAG) === '1') {
        return config;
      }

      const legacyAppSettings = readLegacyAppSettingsFromStorage();
      if (!legacyAppSettings) {
        window.localStorage.setItem(DESKTOP_APP_SETTINGS_MIGRATION_FLAG, '1');
        return config;
      }

      const entries = toConfigEntriesFromAppSettings(legacyAppSettings);
      if (entries.length === 0) {
        window.localStorage.setItem(DESKTOP_APP_SETTINGS_MIGRATION_FLAG, '1');
        return config;
      }

      const nextConfig = { ...config };
      for (const [key, value] of entries) {
        if (nextConfig[key] === value) continue;
        await tauri.configSet(key, value);
        nextConfig[key] = value;
      }

      window.localStorage.setItem(DESKTOP_APP_SETTINGS_MIGRATION_FLAG, '1');
      return nextConfig;
    },
    []
  );

  const fetchConfig = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const configList = await tauri.configList();
      const config: Record<string, string> = {};
      configList.forEach(([key, value]) => {
        config[key] = value;
      });

      const finalConfig = await migrateLegacyDesktopSettings(config);
      store.setConfig(finalConfig);
      if (tauri.isTauri()) {
        applyAppSettingsFromConfig(finalConfig);
      }
      return finalConfig;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return {};
    } finally {
      store.setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyAppSettingsFromConfig, migrateLegacyDesktopSettings]);

  const syncDownloadRuntimeConfig = useCallback(
    async (key: string, value: string) => {
      if (!tauri.isTauri()) return;

      if (key === 'general.parallel_downloads') {
        const maxConcurrent = parseIntegerConfigValue(key, value, 1);
        await tauri.downloadSetMaxConcurrent(maxConcurrent);
        return;
      }

      if (key === 'general.download_speed_limit') {
        const speedLimit = parseIntegerConfigValue(key, value, 0);
        await tauri.downloadSetSpeedLimit(speedLimit);
      }
    },
    [parseIntegerConfigValue]
  );

  const updateConfigValue = useCallback(async (key: string, value: string) => {
    store.setError(null);
    try {
      await tauri.configSet(key, value);
      store.updateConfig(key, value);
      if (tauri.isTauri()) {
        const current = useSettingsStore.getState();
        applyAppSettingsFromConfig({ ...current.config, [key]: value });
      }
      await syncDownloadRuntimeConfig(key, value);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyAppSettingsFromConfig, syncDownloadRuntimeConfig]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchConfig]);

  const fetchCacheInfo = useCallback(async () => {
    try {
      const info = await tauri.cacheInfo();
      store.setCacheInfo(info);
      return info;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCacheInfo]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCacheSettings = useCallback(async () => {
    try {
      const settings = await tauri.getCacheSettings();
      store.setCacheSettings(settings);
      return settings;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCacheInfo]);

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
