'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri } from '@/lib/tauri';
import type { CacheScanProgress, ScanPhase } from '@/lib/tauri';

export interface ScanProgressState {
  active: boolean;
  scanId: string | null;
  phase: ScanPhase | null;
  totalProviders: number;
  completedProviders: number;
  currentProvider: string | null;
  currentProviderDisplay: string | null;
  elapsedMs: number;
  percent: number;
}

const INITIAL_STATE: ScanProgressState = {
  active: false,
  scanId: null,
  phase: null,
  totalProviders: 0,
  completedProviders: 0,
  currentProvider: null,
  currentProviderDisplay: null,
  elapsedMs: 0,
  percent: 0,
};

export function useScanProgress() {
  const [state, setState] = useState<ScanProgressState>(INITIAL_STATE);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (cancelled) return;
        const unlisten = await listen<CacheScanProgress>('cache-scan-progress', (event) => {
          const p = event.payload;
          const total = p.totalProviders || 1;
          const percent = Math.round((p.completedProviders / total) * 100);
          const isTerminal = p.phase === 'complete' || p.phase === 'cancelled';

          setState({
            active: !isTerminal,
            scanId: p.scanId,
            phase: p.phase,
            totalProviders: p.totalProviders,
            completedProviders: p.completedProviders,
            currentProvider: p.currentProvider,
            currentProviderDisplay: p.currentProviderDisplay,
            elapsedMs: p.elapsedMs,
            percent,
          });

          if (isTerminal) {
            // Auto-clear after a short delay
            setTimeout(() => {
              setState((prev) => (prev.scanId === p.scanId ? INITIAL_STATE : prev));
            }, 3000);
          }
        });
        if (cancelled) {
          unlisten();
          return;
        }
        unlistenRef.current = unlisten;
      } catch {
        // Not in Tauri context
      }
    })();

    return () => {
      cancelled = true;
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  const startScan = useCallback(async () => {
    if (!isTauri()) return;
    const { startCacheScan } = await import('@/lib/tauri');
    const scanId = await startCacheScan();
    setState((prev) => ({
      ...prev,
      active: true,
      scanId,
      phase: 'probing',
      completedProviders: 0,
      percent: 0,
    }));
    return scanId;
  }, []);

  const cancelScan = useCallback(async () => {
    if (!isTauri()) return;
    const { cancelCacheScan } = await import('@/lib/tauri');
    await cancelCacheScan();
  }, []);

  return {
    ...state,
    startScan,
    cancelScan,
  };
}
