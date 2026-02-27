'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEnvironmentStore } from '@/lib/stores/environment';
import * as tauri from '@/lib/tauri';
import { toast } from 'sonner';
import { isLtsVersion } from '@/lib/version-utils';
import type { VersionFilter } from '@/lib/constants/environments';

/**
 * Hook that encapsulates version browser panel logic:
 * - Fetching available versions from backend
 * - Filtering / searching versions
 * - Batch install / uninstall of selected versions
 */
export function useVersionBrowser(
  envType: string,
  open: boolean,
  installedVersions: string[],
  onInstall: (version: string, providerId?: string) => Promise<void>,
  onUninstall?: (version: string) => Promise<void>,
  providerId?: string,
  t: (key: string, params?: Record<string, string | number>) => string = (k) => k,
) {
  const {
    availableVersions,
    setAvailableVersions,
    selectedVersions,
    toggleVersionSelection,
    clearVersionSelection,
  } = useEnvironmentStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<VersionFilter>('all');
  const [installingVersion, setInstallingVersion] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Get selected versions for this environment type
  const selectedForEnv = useMemo(
    () =>
      selectedVersions
        .filter((sv) => sv.envType === envType)
        .map((sv) => sv.version),
    [selectedVersions, envType],
  );

  const isVersionSelected = useCallback(
    (version: string) => selectedForEnv.includes(version),
    [selectedForEnv],
  );

  const handleToggleSelection = useCallback(
    (version: string) => {
      toggleVersionSelection(envType, version);
    },
    [envType, toggleVersionSelection],
  );

  const versions = useMemo(
    () => availableVersions[envType] || [],
    [availableVersions, envType],
  );

  const fetchVersions = useCallback(
    async (force = false) => {
      if (versions.length > 0 && !force) return;
      setLoading(true);
      setError(null);
      try {
        const result = await tauri.envAvailableVersions(envType);
        setAvailableVersions(envType, result);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        toast.error(t('environments.versionBrowser.fetchError'));
      } finally {
        setLoading(false);
      }
    },
    [envType, versions.length, setAvailableVersions, t],
  );

  const handleRefresh = useCallback(() => {
    fetchVersions(true);
  }, [fetchVersions]);

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open, fetchVersions]);

  const handleInstall = useCallback(async (version: string) => {
    setInstallingVersion(version);
    try {
      await onInstall(version, providerId);
    } finally {
      setInstallingVersion(null);
    }
  }, [onInstall, providerId]);

  // Memoized filtered versions
  const displayVersions = useMemo(() => {
    if (filter === 'latest') {
      const latest = versions.find((v) => !v.deprecated && !v.yanked);
      return latest ? [latest] : [];
    }

    return versions.filter((v) => {
      if (
        searchQuery &&
        !v.version.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      switch (filter) {
        case 'stable':
          return !v.deprecated && !v.yanked;
        case 'lts':
          return !v.deprecated && !v.yanked && isLtsVersion(envType, v.version);
        case 'all':
        default:
          return true;
      }
    });
  }, [versions, searchQuery, filter, envType]);

  // Batch install selected versions
  const handleBatchInstall = useCallback(async () => {
    const toInstall = selectedForEnv.filter(
      (v) => !installedVersions.includes(v),
    );
    if (toInstall.length === 0) return;

    setBatchProcessing(true);
    const successful: string[] = [];
    const failed: string[] = [];

    try {
      for (const version of toInstall) {
        setInstallingVersion(version);
        try {
          await onInstall(version, providerId);
          successful.push(version);
        } catch {
          failed.push(version);
        }
      }

      if (successful.length > 0) {
        toast.success(
          t('environments.batchInstallSuccess', { count: successful.length }),
        );
      }
      if (failed.length > 0) {
        toast.error(
          t('environments.batchInstallError', { count: failed.length }),
        );
      }

      if (failed.length === 0) {
        clearVersionSelection();
      } else {
        successful.forEach((version) => {
          toggleVersionSelection(envType, version);
        });
      }
    } finally {
      setBatchProcessing(false);
      setInstallingVersion(null);
    }
  }, [
    selectedForEnv,
    installedVersions,
    onInstall,
    clearVersionSelection,
    t,
    providerId,
    toggleVersionSelection,
    envType,
  ]);

  // Batch uninstall selected versions
  const handleBatchUninstall = useCallback(async () => {
    if (!onUninstall) return;
    const toUninstall = selectedForEnv.filter((v) =>
      installedVersions.includes(v),
    );
    if (toUninstall.length === 0) return;

    setBatchProcessing(true);
    const successful: string[] = [];
    const failed: string[] = [];

    try {
      for (const version of toUninstall) {
        try {
          await onUninstall(version);
          successful.push(version);
        } catch {
          failed.push(version);
        }
      }

      if (successful.length > 0) {
        toast.success(
          t('environments.batchUninstallSuccess', { count: successful.length }),
        );
      }
      if (failed.length > 0) {
        toast.error(
          t('environments.batchUninstallError', { count: failed.length }),
        );
      }

      if (failed.length === 0) {
        clearVersionSelection();
      } else {
        successful.forEach((version) => {
          toggleVersionSelection(envType, version);
        });
      }
    } finally {
      setBatchProcessing(false);
    }
  }, [
    selectedForEnv,
    installedVersions,
    onUninstall,
    clearVersionSelection,
    t,
    toggleVersionSelection,
    envType,
  ]);

  // Count installable and uninstallable selected versions
  const installableCount = useMemo(
    () => selectedForEnv.filter((v) => !installedVersions.includes(v)).length,
    [selectedForEnv, installedVersions],
  );
  const uninstallableCount = useMemo(
    () => selectedForEnv.filter((v) => installedVersions.includes(v)).length,
    [selectedForEnv, installedVersions],
  );

  const isInstalled = useCallback(
    (version: string) => installedVersions.includes(version),
    [installedVersions],
  );

  return {
    // State
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    installingVersion,
    batchProcessing,
    // Derived
    versions,
    displayVersions,
    selectedForEnv,
    installableCount,
    uninstallableCount,
    // Helpers
    isInstalled,
    isVersionSelected,
    handleToggleSelection,
    // Actions
    fetchVersions,
    handleRefresh,
    handleInstall,
    handleBatchInstall,
    handleBatchUninstall,
    clearVersionSelection,
  };
}
