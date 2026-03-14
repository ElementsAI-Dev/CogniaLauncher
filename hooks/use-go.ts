"use client";

import { useState, useCallback } from "react";
import {
  goEnvInfo,
  goModTidy,
  goModDownload,
  goCleanCache,
  goCacheInfo,
} from "@/lib/tauri";
import type { GoEnvInfo, GoCacheInfo } from "@/lib/tauri";

export interface UseGoReturn {
  envInfo: GoEnvInfo | null;
  cacheInfo: GoCacheInfo | null;
  loading: boolean;
  error: string | null;

  fetchEnvInfo(): Promise<GoEnvInfo>;
  fetchCacheInfo(): Promise<GoCacheInfo>;
  modTidy(projectPath: string): Promise<string>;
  modDownload(projectPath: string): Promise<string>;
  cleanCache(cacheType: string): Promise<string>;
  refreshAll(): Promise<void>;
}

export function useGo(): UseGoReturn {
  const [envInfo, setEnvInfo] = useState<GoEnvInfo | null>(null);
  const [cacheInfo, setCacheInfo] = useState<GoCacheInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchEnvInfo = useCallback(async () => {
    return withLoading(async () => {
      const info = await goEnvInfo();
      setEnvInfo(info);
      return info;
    });
  }, [withLoading]);

  const fetchCacheInfo = useCallback(async () => {
    return withLoading(async () => {
      const info = await goCacheInfo();
      setCacheInfo(info);
      return info;
    });
  }, [withLoading]);

  const modTidy = useCallback(
    async (projectPath: string) => {
      return withLoading(() => goModTidy(projectPath));
    },
    [withLoading],
  );

  const modDownload = useCallback(
    async (projectPath: string) => {
      return withLoading(() => goModDownload(projectPath));
    },
    [withLoading],
  );

  const cleanCache = useCallback(
    async (cacheType: string) => {
      return withLoading(() => goCleanCache(cacheType));
    },
    [withLoading],
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [env, cache] = await Promise.all([goEnvInfo(), goCacheInfo()]);
      setEnvInfo(env);
      setCacheInfo(cache);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    envInfo,
    cacheInfo,
    loading,
    error,
    fetchEnvInfo,
    fetchCacheInfo,
    modTidy,
    modDownload,
    cleanCache,
    refreshAll,
  };
}
