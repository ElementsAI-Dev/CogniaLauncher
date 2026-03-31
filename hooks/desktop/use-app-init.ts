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
}

const POLL_INTERVAL_MS = 300;
const INIT_TIMEOUT_MS = 30_000;

export function useAppInit() {
  const [state, setState] = useState<AppInitState>(() => {
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
  const unlistenRef = useRef<(() => void) | null>(null);

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
        };
      });
    }).then((fn) => {
      unlistenRef.current = fn;
    });

    // Poll as fallback (events may be emitted before webview is ready)
    const checkInit = async () => {
      try {
        const status = await appCheckInit();
        if (status.initialized) {
          cleanup();
          setState((prev) => ({
            phase: 'ready',
            version: status.version,
            progress: 100,
            message: prev.message === 'splash.starting' ? 'splash.ready' : prev.message,
          }));
        }
      } catch {
        // Backend not ready yet, keep polling
      }
    };

    checkInit();
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
