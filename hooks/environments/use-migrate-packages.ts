'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GlobalPackageInfo, EnvMigrateResult } from '@/lib/tauri';
import * as tauri from '@/lib/tauri';

interface MigrateProgress {
  current: number;
  total: number;
  package: string;
}

/**
 * Hook that encapsulates package migration logic between environment versions.
 * Handles loading packages, selection, migration with progress, and results.
 */
export function useMigratePackages(
  envType: string,
  fromVersion: string,
  open: boolean,
) {
  const [packages, setPackages] = useState<GlobalPackageInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrateProgress | null>(null);
  const [result, setResult] = useState<EnvMigrateResult | null>(null);

  useEffect(() => {
    if (!open || !tauri.isTauri()) return;

    let cancelled = false;
    setLoadingPackages(true);
    setResult(null);
    setProgress(null);

    tauri.envListGlobalPackages(envType, fromVersion)
      .then((pkgs) => {
        if (!cancelled) {
          setPackages(pkgs);
          setSelected(new Set(pkgs.map((p) => p.name)));
        }
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPackages(false);
      });

    return () => { cancelled = true; };
  }, [open, envType, fromVersion]);

  const togglePackage = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleMigrate = useCallback(async (toVersion: string) => {
    if (selected.size === 0) return;
    setMigrating(true);
    setResult(null);

    let unlisten: (() => void) | null = null;
    try {
      unlisten = await tauri.listenEnvMigrateProgress((p) => {
        setProgress(p);
      });

      const res = await tauri.envMigratePackages(
        envType,
        fromVersion,
        toVersion,
        Array.from(selected),
      );
      setResult(res);
    } catch {
      // Error handled by result
    } finally {
      setMigrating(false);
      unlisten?.();
    }
  }, [selected, envType, fromVersion]);

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return {
    packages,
    selected,
    loadingPackages,
    migrating,
    progress,
    progressPercent,
    result,
    togglePackage,
    handleMigrate,
  };
}
