import { useCallback, useState } from 'react';
import type { WingetPin, WingetSource, WingetInfo } from '@/types/tauri';
import {
  wingetPinList,
  wingetPinAdd,
  wingetPinRemove,
  wingetPinReset,
  wingetSourceList,
  wingetSourceAdd,
  wingetSourceRemove,
  wingetSourceReset,
  wingetExport,
  wingetImport,
  wingetRepair,
  wingetDownload,
  wingetGetInfo,
  wingetInstallAdvanced,
} from '@/lib/tauri';

export interface UseWingetReturn {
  // State
  pins: WingetPin[];
  sources: WingetSource[];
  info: WingetInfo | null;
  loading: boolean;
  error: string | null;

  // Pin management
  fetchPins: () => Promise<void>;
  addPin: (id: string, version?: string, blocking?: boolean) => Promise<void>;
  removePin: (id: string) => Promise<void>;
  resetPins: () => Promise<void>;

  // Source management
  fetchSources: () => Promise<void>;
  addSource: (name: string, url: string, sourceType?: string) => Promise<void>;
  removeSource: (name: string) => Promise<void>;
  resetSources: () => Promise<void>;

  // Export / Import
  exportPackages: (outputPath: string, includeVersions?: boolean) => Promise<void>;
  importPackages: (inputPath: string, ignoreUnavailable?: boolean, ignoreVersions?: boolean) => Promise<string>;

  // Repair
  repairPackage: (id: string) => Promise<void>;

  // Download
  downloadInstaller: (id: string, version?: string, directory?: string) => Promise<string>;

  // Info
  fetchInfo: () => Promise<void>;

  // Advanced install
  installAdvanced: (options: {
    id: string;
    version?: string;
    scope?: 'user' | 'machine';
    architecture?: 'x64' | 'x86' | 'arm64';
    locale?: string;
    location?: string;
    force?: boolean;
  }) => Promise<string>;
}

export function useWinget(): UseWingetReturn {
  const [pins, setPins] = useState<WingetPin[]>([]);
  const [sources, setSources] = useState<WingetSource[]>([]);
  const [info, setInfo] = useState<WingetInfo | null>(null);
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

  // Pin management
  const fetchPins = useCallback(async () => {
    await withLoading(async () => {
      const result = await wingetPinList();
      setPins(result);
    });
  }, [withLoading]);

  const addPin = useCallback(async (id: string, version?: string, blocking?: boolean) => {
    await withLoading(async () => {
      await wingetPinAdd(id, version, blocking);
      const result = await wingetPinList();
      setPins(result);
    });
  }, [withLoading]);

  const removePin = useCallback(async (id: string) => {
    await withLoading(async () => {
      await wingetPinRemove(id);
      const result = await wingetPinList();
      setPins(result);
    });
  }, [withLoading]);

  const resetPins = useCallback(async () => {
    await withLoading(async () => {
      await wingetPinReset();
      setPins([]);
    });
  }, [withLoading]);

  // Source management
  const fetchSources = useCallback(async () => {
    await withLoading(async () => {
      const result = await wingetSourceList();
      setSources(result);
    });
  }, [withLoading]);

  const addSource = useCallback(async (name: string, url: string, sourceType?: string) => {
    await withLoading(async () => {
      await wingetSourceAdd(name, url, sourceType);
      const result = await wingetSourceList();
      setSources(result);
    });
  }, [withLoading]);

  const removeSource = useCallback(async (name: string) => {
    await withLoading(async () => {
      await wingetSourceRemove(name);
      const result = await wingetSourceList();
      setSources(result);
    });
  }, [withLoading]);

  const resetSources = useCallback(async () => {
    await withLoading(async () => {
      await wingetSourceReset();
      const result = await wingetSourceList();
      setSources(result);
    });
  }, [withLoading]);

  // Export / Import
  const exportPackages = useCallback(async (outputPath: string, includeVersions?: boolean) => {
    await withLoading(async () => {
      await wingetExport(outputPath, includeVersions);
    });
  }, [withLoading]);

  const importPackages = useCallback(async (inputPath: string, ignoreUnavailable?: boolean, ignoreVersions?: boolean) => {
    return await withLoading(async () => {
      return await wingetImport(inputPath, ignoreUnavailable, ignoreVersions);
    });
  }, [withLoading]);

  // Repair
  const repairPackage = useCallback(async (id: string) => {
    await withLoading(async () => {
      await wingetRepair(id);
    });
  }, [withLoading]);

  // Download
  const downloadInstaller = useCallback(async (id: string, version?: string, directory?: string) => {
    return await withLoading(async () => {
      return await wingetDownload(id, version, directory);
    });
  }, [withLoading]);

  // Info
  const fetchInfo = useCallback(async () => {
    await withLoading(async () => {
      const result = await wingetGetInfo();
      setInfo(result);
    });
  }, [withLoading]);

  // Advanced install
  const installAdvanced = useCallback(async (options: Parameters<typeof wingetInstallAdvanced>[0]) => {
    return await withLoading(async () => {
      return await wingetInstallAdvanced(options);
    });
  }, [withLoading]);

  return {
    pins,
    sources,
    info,
    loading,
    error,
    fetchPins,
    addPin,
    removePin,
    resetPins,
    fetchSources,
    addSource,
    removeSource,
    resetSources,
    exportPackages,
    importPackages,
    repairPackage,
    downloadInstaller,
    fetchInfo,
    installAdvanced,
  };
}
