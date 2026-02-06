import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri, appCheckInit } from '@/lib/tauri';

export type InitPhase = 'checking' | 'initializing' | 'ready' | 'web-mode';

interface AppInitState {
  phase: InitPhase;
  version: string | null;
  progress: number;
  message: string;
}

const POLL_INTERVAL_MS = 200;
const INIT_TIMEOUT_MS = 30_000;
const SIMULATED_PROGRESS_STEPS = [
  { at: 0, msg: 'splash.loadingSettings' },
  { at: 15, msg: 'splash.loadingProviders' },
  { at: 35, msg: 'splash.loadingDetection' },
  { at: 55, msg: 'splash.loadingDownloads' },
  { at: 75, msg: 'splash.loadingTray' },
  { at: 90, msg: 'splash.finalizing' },
];

export function useAppInit() {
  const [state, setState] = useState<AppInitState>(() => {
    // Non-Tauri (web browser) mode: skip initialization check
    if (!isTauri()) {
      return {
        phase: 'web-mode',
        version: null,
        progress: 100,
        message: 'splash.ready',
      };
    }
    return {
      phase: 'checking',
      version: null,
      progress: 0,
      message: 'splash.starting',
    };
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Non-Tauri (web browser) mode: already handled in state initializer
    if (!isTauri()) {
      return;
    }

    startTimeRef.current = Date.now();

    // Simulated progress animation based on elapsed time
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const fraction = Math.min(elapsed / INIT_TIMEOUT_MS, 0.95);
      const simProgress = Math.floor(fraction * 95);

      const step = [...SIMULATED_PROGRESS_STEPS]
        .reverse()
        .find((s) => simProgress >= s.at);

      setState((prev) => {
        if (prev.phase === 'ready') return prev;
        return {
          ...prev,
          phase: 'initializing',
          progress: Math.max(prev.progress, simProgress),
          message: step?.msg ?? prev.message,
        };
      });
    }, 100);

    // Poll the backend for initialization status
    const checkInit = async () => {
      try {
        const status = await appCheckInit();
        if (status.initialized) {
          cleanup();
          setState({
            phase: 'ready',
            version: status.version,
            progress: 100,
            message: 'splash.ready',
          });
        }
      } catch {
        // Backend not ready yet, keep polling
      }
    };

    // Initial check
    checkInit();

    // Poll at intervals
    pollRef.current = setInterval(checkInit, POLL_INTERVAL_MS);

    // Timeout fallback: proceed anyway after INIT_TIMEOUT_MS
    timeoutRef.current = setTimeout(() => {
      cleanup();
      setState((prev) => {
        if (prev.phase === 'ready') return prev;
        return {
          phase: 'ready',
          version: prev.version,
          progress: 100,
          message: 'splash.ready',
        };
      });
    }, INIT_TIMEOUT_MS);

    return cleanup;
  }, [cleanup]);

  const isReady = state.phase === 'ready' || state.phase === 'web-mode';

  return { ...state, isReady };
}
