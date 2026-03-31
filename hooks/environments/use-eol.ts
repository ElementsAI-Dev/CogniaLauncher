'use client';

import { useState, useEffect } from 'react';
import type { EolCycleInfo } from '@/lib/tauri';
import * as tauri from '@/lib/tauri';

interface EolResult {
  envType: string;
  version: string;
  info: EolCycleInfo | null;
}

/**
 * Hook to fetch EOL (End-of-Life) information for a given environment version.
 * Handles cancellation on unmount/re-render and only returns info when
 * the current envType+version matches the fetched result.
 */
export function useEol(envType: string, version: string | null) {
  const [result, setResult] = useState<EolResult | null>(null);

  useEffect(() => {
    if (!version || !tauri.isTauri()) return;

    let cancelled = false;

    tauri.envGetVersionEol(envType, version)
      .then((info) => {
        if (!cancelled) {
          setResult({ envType, version, info: info ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ envType, version, info: null });
      });

    return () => { cancelled = true; };
  }, [envType, version]);

  const eolInfo =
    result && result.envType === envType && result.version === version
      ? result.info
      : null;

  return { eolInfo };
}
