'use client';

import { useEffect, ReactNode } from 'react';
import { useLogStore, type LogLevel } from '@/lib/stores/log';
import {
  isTauri,
  listenEnvInstallProgress,
  listenBatchProgress,
  listenCommandOutput,
} from '@/lib/tauri';
import type { UnlistenFn } from '@tauri-apps/api/event';

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

// Store original console methods to prevent infinite loops
const originalConsole = {
  trace: console.trace,
  debug: console.debug,
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Module-level flag to prevent race conditions with React StrictMode double-invoke
let consoleIntercepted = false;

interface LogProviderProps {
  children: ReactNode;
}

export function LogProvider({ children }: LogProviderProps) {
  const { addLog } = useLogStore();

  // Setup console interception for capturing webview logs
  useEffect(() => {
    if (!isTauri() || consoleIntercepted) return;

    // Create interceptor that logs to store while calling original
    const createInterceptor = (level: LogLevel, original: typeof console.log) => {
      return (...args: unknown[]) => {
        // Call original console method first
        original.apply(console, args);
        
        // Format message for log store
        const message = args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          )
          .join(' ');
        
        // Add to log store
        addLog({
          timestamp: Date.now(),
          level,
          message,
          target: 'webview',
        });
      };
    };

    // Replace console methods with interceptors
    console.trace = createInterceptor('trace', originalConsole.trace);
    console.debug = createInterceptor('debug', originalConsole.debug);
    console.log = createInterceptor('info', originalConsole.log);
    console.info = createInterceptor('info', originalConsole.info);
    console.warn = createInterceptor('warn', originalConsole.warn);
    console.error = createInterceptor('error', originalConsole.error);

    consoleIntercepted = true;

    return () => {
      // Restore original console methods on cleanup
      console.trace = originalConsole.trace;
      console.debug = originalConsole.debug;
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      consoleIntercepted = false;
    };
  }, [addLog]);

  // Setup all event listeners for logging at app level
  useEffect(() => {
    if (!isTauri()) return;

    const unlistenFns: UnlistenFn[] = [];
    let detachConsole: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Attach to Tauri plugin-log for backend logs
        try {
          const { attachConsole } = await import('@tauri-apps/plugin-log');
          detachConsole = await attachConsole();
        } catch {
          // plugin-log not available, continue with other listeners
        }

        // Command output listener
        const unlistenCommand = await listenCommandOutput((event) => {
          addLog({
            timestamp: event.timestamp,
            level: 'info' as LogLevel,
            message: event.data,
            target: `command:${event.commandId}`,
          });
        });
        unlistenFns.push(unlistenCommand);

        // Environment installation progress listener
        const unlistenEnvProgress = await listenEnvInstallProgress((progress) => {
          const level: LogLevel = progress.step === 'error' ? 'error' : 
                                   progress.step === 'done' ? 'info' : 'debug';
          
          let message = `[${progress.envType}@${progress.version}] `;
          switch (progress.step) {
            case 'fetching':
              message += 'Fetching version information...';
              break;
            case 'downloading':
              message += `Downloading... ${progress.progress.toFixed(0)}%`;
              if (progress.speed) message += ` (${formatSpeed(progress.speed)})`;
              break;
            case 'extracting':
              message += 'Extracting...';
              break;
            case 'configuring':
              message += 'Configuring...';
              break;
            case 'done':
              message += 'Installation completed successfully';
              break;
            case 'error':
              message += `Error: ${progress.error || 'Unknown error'}`;
              break;
          }

          addLog({
            timestamp: Date.now(),
            level,
            message,
            target: 'env-install',
          });
        });
        unlistenFns.push(unlistenEnvProgress);

        // Batch operation progress listener
        const unlistenBatch = await listenBatchProgress((progress) => {
          let message = '';
          let level: LogLevel = 'info';

          switch (progress.type) {
            case 'starting':
              message = `Starting batch operation (${progress.total} packages)`;
              break;
            case 'resolving':
              message = `[${progress.current}/${progress.total}] Resolving ${progress.package}...`;
              level = 'debug';
              break;
            case 'downloading':
              message = `[${progress.current}/${progress.total}] Downloading ${progress.package}... ${progress.progress.toFixed(0)}%`;
              level = 'debug';
              break;
            case 'installing':
              message = `[${progress.current}/${progress.total}] Installing ${progress.package}...`;
              break;
            case 'item_completed':
              message = `[${progress.current}/${progress.total}] ${progress.package}: ${progress.success ? 'Success' : 'Failed'}`;
              level = progress.success ? 'info' : 'error';
              break;
            case 'completed': {
              const result = progress.result;
              const failedCount = result.failed?.length ?? 0;
              message = `Batch operation completed: ${result.successful} succeeded, ${failedCount} failed`;
              level = failedCount > 0 ? 'warn' : 'info';
              break;
            }
          }

          addLog({
            timestamp: Date.now(),
            level,
            message,
            target: 'batch',
          });
        });
        unlistenFns.push(unlistenBatch);

      } catch (error) {
        console.error('Failed to setup log listeners:', error);
      }
    };

    setupListeners();

    return () => {
      unlistenFns.forEach((unlisten) => unlisten());
      if (detachConsole) detachConsole();
    };
  }, [addLog]);

  return <>{children}</>;
}
