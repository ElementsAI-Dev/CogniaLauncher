'use client';

import { useEffect, ReactNode, useCallback } from 'react';
import { useLogStore, type LogLevel } from '@/lib/stores/log';
import {
  isTauri,
  listenEnvInstallProgress,
  listenBatchProgress,
  listenCommandOutput,
} from '@/lib/tauri';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { useLocale } from '@/components/providers/locale-provider';

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
  const { t } = useLocale();

  // Helper function to format speed with i18n
  const formatSpeed = useCallback((bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) {
      return t('logs.messages.speedBps', { value: bytesPerSecond.toFixed(0) });
    }
    if (bytesPerSecond < 1024 * 1024) {
      return t('logs.messages.speedKBps', { value: (bytesPerSecond / 1024).toFixed(1) });
    }
    return t('logs.messages.speedMBps', { value: (bytesPerSecond / (1024 * 1024)).toFixed(1) });
  }, [t]);

  // Setup console interception for capturing webview logs
  // Works in both web and desktop modes for universal logging support
  useEffect(() => {
    if (consoleIntercepted) return;

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
              message += t('logs.messages.envFetching');
              break;
            case 'downloading':
              if (progress.speed) {
                message += t('logs.messages.envDownloadingWithSpeed', {
                  progress: progress.progress.toFixed(0),
                  speed: formatSpeed(progress.speed)
                });
              } else {
                message += t('logs.messages.envDownloading', {
                  progress: progress.progress.toFixed(0)
                });
              }
              break;
            case 'extracting':
              message += t('logs.messages.envExtracting');
              break;
            case 'configuring':
              message += t('logs.messages.envConfiguring');
              break;
            case 'done':
              message += t('logs.messages.envDone');
              break;
            case 'error':
              message += t('logs.messages.envError', {
                error: progress.error || t('logs.messages.envUnknownError')
              });
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
              message = t('logs.messages.batchStarting', { total: progress.total });
              break;
            case 'resolving':
              message = t('logs.messages.batchResolving', {
                current: progress.current,
                total: progress.total,
                package: progress.package
              });
              level = 'debug';
              break;
            case 'downloading':
              message = t('logs.messages.batchDownloading', {
                current: progress.current,
                total: progress.total,
                package: progress.package,
                progress: progress.progress.toFixed(0)
              });
              level = 'debug';
              break;
            case 'installing':
              message = t('logs.messages.batchInstalling', {
                current: progress.current,
                total: progress.total,
                package: progress.package
              });
              break;
            case 'item_completed':
              message = progress.success
                ? t('logs.messages.batchItemSuccess', {
                    current: progress.current,
                    total: progress.total,
                    package: progress.package
                  })
                : t('logs.messages.batchItemFailed', {
                    current: progress.current,
                    total: progress.total,
                    package: progress.package
                  });
              level = progress.success ? 'info' : 'error';
              break;
            case 'completed': {
              const result = progress.result;
              const successCount = result.successful?.length ?? 0;
              const failedCount = result.failed?.length ?? 0;
              message = t('logs.messages.batchCompleted', {
                successful: successCount,
                failed: failedCount
              });
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
  }, [addLog, formatSpeed, t]);

  return <>{children}</>;
}
