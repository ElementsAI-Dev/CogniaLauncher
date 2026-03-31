'use client';

import { useEffect, useState } from 'react';
import { isTauri, listenToolProgress } from '@/lib/tauri';
import type { ToolExecutionError, ToolProgressPhase } from '@/types/toolbox';

export interface ToolProgressState {
  phase: ToolProgressPhase | null;
  progress: number | null;
  message: string | null;
  error: ToolExecutionError | null;
}

const EMPTY_STATE: ToolProgressState = {
  phase: null,
  progress: null,
  message: null,
  error: null,
};

export function useToolProgress(toolId: string, executionId: string | null): ToolProgressState {
  const [state, setState] = useState<ToolProgressState>(EMPTY_STATE);

  useEffect(() => {
    if (!executionId) {
      return;
    }
    if (!isTauri()) return;

    let active = true;
    void listenToolProgress((event) => {
      if (!active) return;
      if (event.toolId !== toolId || event.executionId !== executionId) return;

      setState({
        phase: event.phase,
        progress: typeof event.progress === 'number' ? event.progress : null,
        message: event.message ?? null,
        error: event.error ?? null,
      });
    }).then((unlisten) => {
      if (!active) {
        void unlisten();
      }
    });

    return () => {
      active = false;
    };
  }, [executionId, toolId]);

  return executionId ? state : EMPTY_STATE;
}
