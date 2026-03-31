'use client';

import { useCallback } from 'react';
import { usePackageStore } from '@/lib/stores/packages';
import * as tauri from '@/lib/tauri';
import type { UpdateCheckProgress, UpdateCheckSummary } from '@/types/tauri';

export interface CheckPackageUpdatesOptions {
  packages?: string[];
  providerId?: string;
  syncStore?: boolean;
  onProgress?: (progress: UpdateCheckProgress) => void;
}

const EMPTY_SUMMARY: UpdateCheckSummary = {
  updates: [],
  total_checked: 0,
  total_providers: 0,
  errors: [],
  provider_outcomes: [],
  coverage: { supported: 0, partial: 0, unsupported: 0, error: 0 },
};

export function usePackageUpdates() {
  const setAvailableUpdates = usePackageStore((s) => s.setAvailableUpdates);
  const setIsCheckingUpdates = usePackageStore((s) => s.setIsCheckingUpdates);
  const setUpdateCheckProgress = usePackageStore((s) => s.setUpdateCheckProgress);
  const setUpdateCheckErrors = usePackageStore((s) => s.setUpdateCheckErrors);
  const setUpdateCheckProviderOutcomes = usePackageStore((s) => s.setUpdateCheckProviderOutcomes);
  const setUpdateCheckCoverage = usePackageStore((s) => s.setUpdateCheckCoverage);
  const setLastUpdateCheck = usePackageStore((s) => s.setLastUpdateCheck);

  const checkUpdates = useCallback(async (
    options: CheckPackageUpdatesOptions = {}
  ): Promise<UpdateCheckSummary> => {
    const {
      packages,
      providerId,
      syncStore = true,
      onProgress,
    } = options;

    if (!tauri.isTauri()) {
      return EMPTY_SUMMARY;
    }

    if (syncStore) {
      setIsCheckingUpdates(true);
      setUpdateCheckProgress(null);
      setUpdateCheckErrors([]);
      setUpdateCheckProviderOutcomes([]);
      setUpdateCheckCoverage(null);
    }

    let unlisten: (() => void) | null = null;
    try {
      if (syncStore || onProgress) {
        unlisten = await tauri.listenUpdateCheckProgress((progress) => {
          if (syncStore) {
            setUpdateCheckProgress(progress);
          }
          onProgress?.(progress);
        });
      }

      const summary = await tauri.checkUpdates(packages);
      const updates = providerId
        ? summary.updates.filter((update) => update.provider === providerId)
        : summary.updates;
      const filteredSummary: UpdateCheckSummary = {
        ...summary,
        updates,
      };

      if (syncStore) {
        setAvailableUpdates(filteredSummary.updates);
        setUpdateCheckErrors(filteredSummary.errors);
        setUpdateCheckProviderOutcomes(filteredSummary.provider_outcomes ?? []);
        setUpdateCheckCoverage(filteredSummary.coverage ?? { supported: 0, partial: 0, unsupported: 0, error: 0 });
        setLastUpdateCheck(Date.now());
      }

      return filteredSummary;
    } finally {
      if (syncStore) {
        setIsCheckingUpdates(false);
      }
      unlisten?.();
    }
  }, [
    setAvailableUpdates,
    setIsCheckingUpdates,
    setUpdateCheckErrors,
    setUpdateCheckProviderOutcomes,
    setUpdateCheckCoverage,
    setUpdateCheckProgress,
    setLastUpdateCheck,
  ]);

  return {
    checkUpdates,
  };
}
