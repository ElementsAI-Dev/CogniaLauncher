'use client';

import { useState, useCallback } from 'react';
import type { EnvironmentInfo } from '@/lib/tauri';
import type { EnvUpdateInfo } from '@/types/environments';
import { useEnvironments } from '@/hooks/use-environments';
import { compareVersions, findLatestStable } from '@/lib/version-utils';

/**
 * Hook to check for available updates for a single environment.
 * Encapsulates the logic of fetching available versions and computing update info.
 */
export function useUpdateChecker() {
  const { fetchAvailableVersions } = useEnvironments();
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<EnvUpdateInfo | null>(null);
  const [checked, setChecked] = useState(false);

  const checkForUpdates = useCallback(async (env: EnvironmentInfo) => {
    if (!env.current_version) return;
    setChecking(true);
    try {
      const versions = await fetchAvailableVersions(env.env_type);
      if (versions.length > 0) {
        const stableVersions = versions.filter(
          (v) => !v.deprecated && !v.yanked
        );
        const latestVersion = stableVersions[0]?.version || versions[0].version;
        const latestStable = findLatestStable(stableVersions);

        const newerCount = stableVersions.filter(
          (v) => compareVersions(v.version, env.current_version!) > 0
        ).length;

        setUpdateInfo({
          envType: env.env_type,
          currentVersion: env.current_version,
          latestVersion,
          latestStable,
          availableCount: newerCount,
        });
      }
      setChecked(true);
    } catch {
      setChecked(true);
    } finally {
      setChecking(false);
    }
  }, [fetchAvailableVersions]);

  const hasUpdate =
    updateInfo != null &&
    updateInfo.latestVersion !== updateInfo.currentVersion &&
    updateInfo.availableCount > 0;

  return {
    checking,
    updateInfo,
    checked,
    hasUpdate,
    checkForUpdates,
  };
}
