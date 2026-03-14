"use client";

import { useState, useCallback } from "react";
import * as tauri from "@/lib/tauri";
import type { CondaEnvInfo, CondaInfo, CondaExportResult } from "@/types/tauri";

export interface UseCondaReturn {
  // State
  environments: CondaEnvInfo[];
  info: CondaInfo | null;
  config: string | null;
  loading: boolean;
  error: string | null;

  // Environment management
  listEnvironments(): Promise<CondaEnvInfo[]>;
  createEnvironment(
    name: string,
    pythonVersion?: string,
    packages?: string[],
  ): Promise<void>;
  removeEnvironment(name: string): Promise<void>;
  cloneEnvironment(source: string, target: string): Promise<void>;
  exportEnvironment(
    name: string,
    noBuilds?: boolean,
  ): Promise<CondaExportResult>;
  importEnvironment(filePath: string, name?: string): Promise<void>;
  renameEnvironment(oldName: string, newName: string): Promise<void>;

  // System info
  getInfo(): Promise<CondaInfo>;
  getConfig(): Promise<string>;
  setConfig(key: string, value: string): Promise<void>;

  // Channel management
  addChannel(channel: string): Promise<void>;
  removeChannel(channel: string): Promise<void>;

  // Cleanup
  clean(
    all?: boolean,
    packages?: boolean,
    tarballs?: boolean,
  ): Promise<string>;

  // Refresh
  refreshAll(): Promise<void>;
}

export function useConda(): UseCondaReturn {
  const [environments, setEnvironments] = useState<CondaEnvInfo[]>([]);
  const [info, setInfo] = useState<CondaInfo | null>(null);
  const [config, setConfigState] = useState<string | null>(null);
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

  // ── Environment management ──

  const listEnvironments = useCallback(async (): Promise<CondaEnvInfo[]> => {
    return withLoading(async () => {
      const envs = await tauri.condaEnvList();
      setEnvironments(envs);
      return envs;
    });
  }, [withLoading]);

  const createEnvironment = useCallback(
    async (
      name: string,
      pythonVersion?: string,
      packages?: string[],
    ): Promise<void> => {
      await withLoading(async () => {
        await tauri.condaEnvCreate(name, pythonVersion, packages);
      });
    },
    [withLoading],
  );

  const removeEnvironment = useCallback(
    async (name: string): Promise<void> => {
      await withLoading(async () => {
        await tauri.condaEnvRemove(name);
      });
    },
    [withLoading],
  );

  const cloneEnvironment = useCallback(
    async (source: string, target: string): Promise<void> => {
      await withLoading(async () => {
        await tauri.condaEnvClone(source, target);
      });
    },
    [withLoading],
  );

  const exportEnvironment = useCallback(
    async (
      name: string,
      noBuilds?: boolean,
    ): Promise<CondaExportResult> => {
      return withLoading(async () => {
        return await tauri.condaEnvExport(name, noBuilds ?? false);
      });
    },
    [withLoading],
  );

  const importEnvironment = useCallback(
    async (filePath: string, name?: string): Promise<void> => {
      await withLoading(async () => {
        await tauri.condaEnvImport(filePath, name);
      });
    },
    [withLoading],
  );

  const renameEnvironment = useCallback(
    async (oldName: string, newName: string): Promise<void> => {
      await withLoading(async () => {
        await tauri.condaEnvRename(oldName, newName);
      });
    },
    [withLoading],
  );

  // ── System info ──

  const getInfo = useCallback(async (): Promise<CondaInfo> => {
    return withLoading(async () => {
      const result = await tauri.condaGetInfo();
      setInfo(result);
      return result;
    });
  }, [withLoading]);

  const getConfig = useCallback(async (): Promise<string> => {
    return withLoading(async () => {
      const result = await tauri.condaConfigShow();
      setConfigState(result);
      return result;
    });
  }, [withLoading]);

  const setConfig = useCallback(
    async (key: string, value: string): Promise<void> => {
      await withLoading(async () => {
        await tauri.condaConfigSet(key, value);
      });
    },
    [withLoading],
  );

  // ── Channel management ──

  const addChannel = useCallback(
    async (channel: string): Promise<void> => {
      await withLoading(async () => {
        await tauri.condaChannelAdd(channel);
      });
    },
    [withLoading],
  );

  const removeChannel = useCallback(
    async (channel: string): Promise<void> => {
      await withLoading(async () => {
        await tauri.condaChannelRemove(channel);
      });
    },
    [withLoading],
  );

  // ── Cleanup ──

  const clean = useCallback(
    async (
      all?: boolean,
      packages?: boolean,
      tarballs?: boolean,
    ): Promise<string> => {
      return withLoading(async () => {
        return await tauri.condaClean(
          all ?? false,
          packages ?? false,
          tarballs ?? false,
        );
      });
    },
    [withLoading],
  );

  // ── Refresh all ──

  const refreshAll = useCallback(async (): Promise<void> => {
    if (!tauri.isTauri()) return;
    setLoading(true);
    setError(null);
    try {
      const [envs, condaInfo, condaConfig] = await Promise.all([
        tauri.condaEnvList().catch(() => [] as CondaEnvInfo[]),
        tauri.condaGetInfo().catch(() => null),
        tauri.condaConfigShow().catch(() => null),
      ]);
      setEnvironments(envs);
      setInfo(condaInfo);
      setConfigState(condaConfig);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    environments,
    info,
    config,
    loading,
    error,
    listEnvironments,
    createEnvironment,
    removeEnvironment,
    cloneEnvironment,
    exportEnvironment,
    importEnvironment,
    renameEnvironment,
    getInfo,
    getConfig,
    setConfig,
    addChannel,
    removeChannel,
    clean,
    refreshAll,
  };
}
