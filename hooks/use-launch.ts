'use client';

import { useCallback, useRef, useState } from 'react';
import * as tauri from '@/lib/tauri';
import { formatError } from '@/lib/errors';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type {
  LaunchRequest,
  LaunchResult,
  ActivationScript,
  EnvInfoResult,
  CommandOutputEvent,
} from '@/types/tauri';

interface LaunchState {
  loading: boolean;
  error: string | null;
  lastResult: LaunchResult | null;
  streamingOutput: CommandOutputEvent[];
}

export function useLaunch() {
  const [state, setState] = useState<LaunchState>({
    loading: false,
    error: null,
    lastResult: null,
    streamingOutput: [],
  });

  const streamUnlistenRef = useRef<UnlistenFn | null>(null);

  const setLoading = useCallback((loading: boolean) => {
    setState((s) => ({ ...s, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const launchWithEnv = useCallback(async (request: LaunchRequest): Promise<LaunchResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.launchWithEnv(request);
      setState((s) => ({ ...s, lastResult: result, loading: false }));
      return result;
    } catch (err) {
      const msg = formatError(err);
      setError(msg);
      setLoading(false);
      return null;
    }
  }, [setLoading, setError]);

  const launchWithStreaming = useCallback(async (request: LaunchRequest): Promise<LaunchResult | null> => {
    setLoading(true);
    setError(null);
    setState((s) => ({ ...s, streamingOutput: [] }));

    // Set up streaming listener
    streamUnlistenRef.current?.();
    streamUnlistenRef.current = null;

    if (tauri.isTauri()) {
      try {
        streamUnlistenRef.current = await tauri.listenCommandOutput((event) => {
          setState((s) => ({
            ...s,
            streamingOutput: [...s.streamingOutput, event],
          }));
        });
      } catch {
        // Event listening not available
      }
    }

    try {
      const result = await tauri.launchWithStreaming(request);
      setState((s) => ({ ...s, lastResult: result, loading: false }));
      return result;
    } catch (err) {
      const msg = formatError(err);
      setError(msg);
      setLoading(false);
      return null;
    } finally {
      streamUnlistenRef.current?.();
      streamUnlistenRef.current = null;
    }
  }, [setLoading, setError]);

  const getActivationScript = useCallback(async (
    envType: string,
    version?: string,
    projectPath?: string,
    shell?: string
  ): Promise<ActivationScript | null> => {
    try {
      return await tauri.envActivate(envType, version, projectPath, shell);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const getEnvInfo = useCallback(async (
    envType: string,
    version: string
  ): Promise<EnvInfoResult | null> => {
    try {
      return await tauri.envGetInfo(envType, version);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const execShellWithEnv = useCallback(async (
    command: string,
    envType?: string,
    envVersion?: string,
    cwd?: string
  ): Promise<LaunchResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.execShellWithEnv(command, envType, envVersion, cwd);
      setState((s) => ({ ...s, lastResult: result, loading: false }));
      return result;
    } catch (err) {
      const msg = formatError(err);
      setError(msg);
      setLoading(false);
      return null;
    }
  }, [setLoading, setError]);

  const whichProgram = useCallback(async (
    program: string,
    envType?: string,
    envVersion?: string,
    cwd?: string
  ): Promise<string | null> => {
    try {
      return await tauri.whichProgram(program, envType, envVersion, cwd);
    } catch (err) {
      setError(formatError(err));
      return null;
    }
  }, [setError]);

  const clearOutput = useCallback(() => {
    setState((s) => ({ ...s, streamingOutput: [], lastResult: null, error: null }));
  }, []);

  return {
    ...state,
    launchWithEnv,
    launchWithStreaming,
    getActivationScript,
    getEnvInfo,
    execShellWithEnv,
    whichProgram,
    clearOutput,
  };
}
