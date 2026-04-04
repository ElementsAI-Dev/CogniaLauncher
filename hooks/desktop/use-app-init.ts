import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri, appCheckInit, listenInitProgress } from '@/lib/tauri';

export type InitPhase =
  | 'checking' | 'settings' | 'resources' | 'providers'
  | 'detection' | 'downloads' | 'terminal' | 'plugins'
  | 'ready' | 'web-mode';

interface AppInitState {
  phase: InitPhase;
  version: string | null;
  progress: number;
  message: string;
  isDegraded: boolean;
  timedOutPhases: string[];
  skippedPhases: string[];
}

const POLL_INTERVAL_MS = 300;
const DEFAULT_INIT_TIMEOUT_MS = 30_000;

export function useAppInit() {
  const [state, setState] = useState<AppInitState>(() => {
    if (!isTauri()) {
      return {
        phase: 'web-mode',
        version: null,
        progress: 100,
        message: 'splash.ready',
        isDegraded: false,
        timedOutPhases: [],
        skippedPhases: [],
      };
    }
    return {
      phase: 'checking',
      version: null,
      progress: 0,
      message: 'splash.starting',
      isDegraded: false,
      timedOutPhases: [],
      skippedPhases: [],
    };
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const timeoutBudgetRef = useRef(DEFAULT_INIT_TIMEOUT_MS);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    unlistenRef.current?.();
    unlistenRef.current = null;
  }, []);

  const scheduleTimeout = useCallback((timeoutMs: number) => {
    timeoutBudgetRef.current = timeoutMs;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setState((prev) => {
        if (prev.phase === 'ready') return prev;
        const timedOutPhases = prev.timedOutPhases.includes(prev.phase)
          ? prev.timedOutPhases
          : [...prev.timedOutPhases, prev.phase];
        return {
          phase: 'ready',
          version: prev.version,
          progress: 100,
          message: 'splash.ready',
          isDegraded: true,
          timedOutPhases,
          skippedPhases: prev.skippedPhases,
        };
      });
    }, timeoutMs);
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    // Listen for real init progress events from backend
    listenInitProgress((event) => {
      const { phase, progress, message } = event;
      setState((prev) => {
        if (prev.phase === 'ready') return prev;
        return {
          ...prev,
          phase: phase as InitPhase,
          progress: Math.max(prev.progress, progress),
          message,
          isDegraded: event.degraded ?? prev.isDegraded,
          timedOutPhases: event.timedOutPhases ?? prev.timedOutPhases,
          skippedPhases: event.skippedPhases ?? prev.skippedPhases,
        };
      });
    }).then((fn) => {
      unlistenRef.current = fn;
    });

    // Poll as fallback (events may be emitted before webview is ready)
    const checkInit = async () => {
      try {
        const status = await appCheckInit();
        const nextTimeout = status.startupTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
        if (nextTimeout !== timeoutBudgetRef.current) {
          scheduleTimeout(nextTimeout);
        }

        if (status.initialized || status.interactive) {
          cleanup();
          setState((prev) => {
            const nextPhase = status.initialized
              ? 'ready'
              : ((status.phase as InitPhase | undefined) ?? prev.phase);
            return {
              phase: nextPhase,
              version: status.version,
              progress: status.initialized
                ? 100
                : Math.max(prev.progress, status.progress ?? prev.progress),
              message: status.message ?? (status.initialized
                ? (prev.message === 'splash.starting' ? 'splash.ready' : prev.message)
                : prev.message),
              isDegraded: status.degraded ?? prev.isDegraded,
              timedOutPhases: status.timedOutPhases ?? prev.timedOutPhases,
              skippedPhases: status.skippedPhases ?? prev.skippedPhases,
            };
          });
        }
      } catch {
        // Backend not ready yet, keep polling
      }
    };

    checkInit();
    pollRef.current = setInterval(checkInit, POLL_INTERVAL_MS);

    // Timeout fallback: proceed to interactive degraded mode using the current budget.
    scheduleTimeout(DEFAULT_INIT_TIMEOUT_MS);

    return cleanup;
  }, [cleanup, scheduleTimeout]);

  const isReady =
    state.phase === 'ready' ||
    state.phase === 'web-mode' ||
    state.isDegraded;

  return { ...state, isReady };
}
