'use client';

import { useState, useCallback } from 'react';
import { isTauri } from '@/lib/platform';
import type {
  PortVariant,
  PortDependent,
  PortFileEntry,
  PortSelectGroup,
} from '@/types/tauri';

export interface UseMacPortsReturn {
  variants: PortVariant[];
  contents: PortFileEntry[];
  dependents: PortDependent[];
  selectGroups: PortSelectGroup[];
  loading: boolean;
  error: string | null;

  fetchVariants: (name: string) => Promise<void>;
  fetchContents: (name: string) => Promise<void>;
  fetchDependents: (name: string) => Promise<void>;
  cleanPort: (name: string) => Promise<void>;
  cleanAll: () => Promise<void>;
  selfupdate: () => Promise<void>;
  fetchSelectGroups: () => Promise<void>;
  fetchSelectOptions: (group: string) => Promise<PortSelectGroup | null>;
  setSelect: (group: string, option: string) => Promise<void>;
  reclaim: () => Promise<void>;
}

export function useMacPorts(): UseMacPortsReturn {
  const [variants, setVariants] = useState<PortVariant[]>([]);
  const [contents, setContents] = useState<PortFileEntry[]>([]);
  const [dependents, setDependents] = useState<PortDependent[]>([]);
  const [selectGroups, setSelectGroups] = useState<PortSelectGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withLoading = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
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
  }, []);

  const fetchVariants = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsListVariants } = await import('@/lib/tauri');
      setVariants(await macportsListVariants(name));
    });
  }, [withLoading]);

  const fetchContents = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsPortContents } = await import('@/lib/tauri');
      setContents(await macportsPortContents(name));
    });
  }, [withLoading]);

  const fetchDependents = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsPortDependents } = await import('@/lib/tauri');
      setDependents(await macportsPortDependents(name));
    });
  }, [withLoading]);

  const cleanPort = useCallback(async (name: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsPortClean } = await import('@/lib/tauri');
      await macportsPortClean(name);
    });
  }, [withLoading]);

  const cleanAll = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsCleanAll } = await import('@/lib/tauri');
      await macportsCleanAll();
    });
  }, [withLoading]);

  const selfupdate = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsSelfupdate } = await import('@/lib/tauri');
      await macportsSelfupdate();
    });
  }, [withLoading]);

  const fetchSelectGroups = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsListSelectGroups } = await import('@/lib/tauri');
      setSelectGroups(await macportsListSelectGroups());
    });
  }, [withLoading]);

  const fetchSelectOptions = useCallback(async (group: string): Promise<PortSelectGroup | null> => {
    if (!isTauri()) return null;
    return withLoading(async () => {
      const { macportsSelectOptions } = await import('@/lib/tauri');
      return await macportsSelectOptions(group);
    });
  }, [withLoading]);

  const setSelect = useCallback(async (group: string, option: string) => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsSelectSet, macportsListSelectGroups } = await import('@/lib/tauri');
      await macportsSelectSet(group, option);
      setSelectGroups(await macportsListSelectGroups());
    });
  }, [withLoading]);

  const reclaim = useCallback(async () => {
    if (!isTauri()) return;
    await withLoading(async () => {
      const { macportsReclaim } = await import('@/lib/tauri');
      await macportsReclaim();
    });
  }, [withLoading]);

  return {
    variants,
    contents,
    dependents,
    selectGroups,
    loading,
    error,
    fetchVariants,
    fetchContents,
    fetchDependents,
    cleanPort,
    cleanAll,
    selfupdate,
    fetchSelectGroups,
    fetchSelectOptions,
    setSelect,
    reclaim,
  };
}
