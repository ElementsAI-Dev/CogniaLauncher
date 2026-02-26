"use client";

import { useEffect, ReactNode, useCallback } from "react";
import { useLogStore, type LogLevel } from "@/lib/stores/log";
import {
  isTauri,
  listenEnvInstallProgress,
  listenBatchProgress,
  listenCommandOutput,
  listenDownloadTaskAdded,
  listenDownloadTaskStarted,
  listenDownloadTaskCompleted,
  listenDownloadTaskFailed,
  listenDownloadTaskPaused,
  listenDownloadTaskResumed,
  listenDownloadTaskCancelled,
  listenSelfUpdateProgress,
  listenUpdateCheckProgress,
} from "@/lib/tauri";
import { captureFrontendCrash } from "@/lib/crash-reporter";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { useLocale } from "@/components/providers/locale-provider";
import { toast } from "sonner";

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

function toRuntimeMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message || value.name || "Unknown runtime error";
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (value && typeof value === "object") {
    const candidate = value as { message?: unknown };
    if (
      typeof candidate.message === "string" &&
      candidate.message.trim().length > 0
    ) {
      return candidate.message;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return value === undefined ? "Unknown runtime error" : String(value);
}

export function LogProvider({ children }: LogProviderProps) {
  const { addLog } = useLogStore();
  const { t } = useLocale();

  // Helper function to format speed with i18n
  const formatSpeed = useCallback(
    (bytesPerSecond: number): string => {
      if (bytesPerSecond < 1024) {
        return t("logs.messages.speedBps", {
          value: bytesPerSecond.toFixed(0),
        });
      }
      if (bytesPerSecond < 1024 * 1024) {
        return t("logs.messages.speedKBps", {
          value: (bytesPerSecond / 1024).toFixed(1),
        });
      }
      return t("logs.messages.speedMBps", {
        value: (bytesPerSecond / (1024 * 1024)).toFixed(1),
      });
    },
    [t],
  );

  // Setup console interception for capturing webview logs
  // Works in both web and desktop modes for universal logging support
  useEffect(() => {
    if (consoleIntercepted) return;

    // Create interceptor that logs to store while calling original
    const createInterceptor = (
      level: LogLevel,
      original: typeof console.log,
    ) => {
      return (...args: unknown[]) => {
        // Call original console method first
        original.apply(console, args);

        // Format message for log store
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg),
          )
          .join(" ");

        // Add to log store (deferred to avoid setState during render)
        setTimeout(() => {
          addLog({
            timestamp: Date.now(),
            level,
            message,
            target: "webview",
          });
        }, 0);
      };
    };

    // Replace console methods with interceptors
    console.trace = createInterceptor("trace", originalConsole.trace);
    console.debug = createInterceptor("debug", originalConsole.debug);
    console.log = createInterceptor("info", originalConsole.log);
    console.info = createInterceptor("info", originalConsole.info);
    console.warn = createInterceptor("warn", originalConsole.warn);
    console.error = createInterceptor("error", originalConsole.error);

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

  useEffect(() => {
    if (typeof window === "undefined" || !isTauri()) return;

    const reportRuntimeCrash = async (
      source: "window.error" | "window.unhandledrejection",
      error: unknown,
      message: string,
      extra?: Record<string, unknown>,
    ) => {
      addLog({
        timestamp: Date.now(),
        level: "error",
        message,
        target: "runtime",
      });

      const result = await captureFrontendCrash({
        source,
        error,
        includeConfig: true,
        extra,
      });

      if (result.captured) {
        toast.warning(t("diagnostic.autoCaptureToastTitle"), {
          description: t("diagnostic.autoCaptureToastDescription"),
        });
      } else if (result.reason === "capture-failed") {
        addLog({
          timestamp: Date.now(),
          level: "warn",
          message: "Automatic frontend crash diagnostic capture failed",
          target: "runtime",
        });
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      const reason = event.error ?? event.message;
      const reasonMessage = toRuntimeMessage(reason);
      const location = event.filename
        ? ` (${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0})`
        : "";

      void reportRuntimeCrash(
        "window.error",
        reason,
        `Unhandled runtime error: ${reasonMessage}${location}`,
        {
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
        },
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonMessage = toRuntimeMessage(event.reason);
      void reportRuntimeCrash(
        "window.unhandledrejection",
        event.reason,
        `Unhandled promise rejection: ${reasonMessage}`,
      );
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [addLog, t]);

  // Setup all event listeners for logging at app level
  useEffect(() => {
    if (!isTauri()) return;

    const unlistenFns: UnlistenFn[] = [];
    let detachConsole: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Attach to Tauri plugin-log for backend logs
        try {
          const { attachConsole } = await import("@tauri-apps/plugin-log");
          detachConsole = await attachConsole();
        } catch {
          // plugin-log not available, continue with other listeners
        }

        // Command output listener
        const unlistenCommand = await listenCommandOutput((event) => {
          addLog({
            timestamp: event.timestamp,
            level: "info" as LogLevel,
            message: event.data,
            target: `command:${event.commandId}`,
          });
        });
        unlistenFns.push(unlistenCommand);

        // Environment installation progress listener
        const unlistenEnvProgress = await listenEnvInstallProgress(
          (progress) => {
            const level: LogLevel =
              progress.step === "error"
                ? "error"
                : progress.step === "done"
                  ? "info"
                  : "debug";

            let message = `[${progress.envType}@${progress.version}] `;
            switch (progress.step) {
              case "fetching":
                message += t("logs.messages.envFetching");
                break;
              case "downloading":
                if (progress.speed) {
                  message += t("logs.messages.envDownloadingWithSpeed", {
                    progress: progress.progress.toFixed(0),
                    speed: formatSpeed(progress.speed),
                  });
                } else {
                  message += t("logs.messages.envDownloading", {
                    progress: progress.progress.toFixed(0),
                  });
                }
                break;
              case "extracting":
                message += t("logs.messages.envExtracting");
                break;
              case "configuring":
                message += t("logs.messages.envConfiguring");
                break;
              case "done":
                message += t("logs.messages.envDone");
                break;
              case "error":
                message += t("logs.messages.envError", {
                  error: progress.error || t("logs.messages.envUnknownError"),
                });
                break;
            }

            addLog({
              timestamp: Date.now(),
              level,
              message,
              target: "env-install",
            });
          },
        );
        unlistenFns.push(unlistenEnvProgress);

        // Batch operation progress listener
        const unlistenBatch = await listenBatchProgress((progress) => {
          let message = "";
          let level: LogLevel = "info";

          switch (progress.type) {
            case "starting":
              message = t("logs.messages.batchStarting", {
                total: progress.total,
              });
              break;
            case "resolving":
              message = t("logs.messages.batchResolving", {
                current: progress.current,
                total: progress.total,
                package: progress.package,
              });
              level = "debug";
              break;
            case "downloading":
              message = t("logs.messages.batchDownloading", {
                current: progress.current,
                total: progress.total,
                package: progress.package,
                progress: progress.progress.toFixed(0),
              });
              level = "debug";
              break;
            case "installing":
              message = t("logs.messages.batchInstalling", {
                current: progress.current,
                total: progress.total,
                package: progress.package,
              });
              break;
            case "item_completed":
              message = progress.success
                ? t("logs.messages.batchItemSuccess", {
                    current: progress.current,
                    total: progress.total,
                    package: progress.package,
                  })
                : t("logs.messages.batchItemFailed", {
                    current: progress.current,
                    total: progress.total,
                    package: progress.package,
                  });
              level = progress.success ? "info" : "error";
              break;
            case "completed": {
              const result = progress.result;
              const successCount = result.successful?.length ?? 0;
              const failedCount = result.failed?.length ?? 0;
              message = t("logs.messages.batchCompleted", {
                successful: successCount,
                failed: failedCount,
              });
              level = failedCount > 0 ? "warn" : "info";
              break;
            }
          }

          addLog({
            timestamp: Date.now(),
            level,
            message,
            target: "batch",
          });
        });
        unlistenFns.push(unlistenBatch);

        // Download task event listeners
        const unlistenDlAdded = await listenDownloadTaskAdded((taskId) => {
          addLog({
            timestamp: Date.now(),
            level: "info",
            message: t("logs.messages.downloadAdded", { taskId }),
            target: "download",
          });
        });
        unlistenFns.push(unlistenDlAdded);

        const unlistenDlStarted = await listenDownloadTaskStarted((taskId) => {
          addLog({
            timestamp: Date.now(),
            level: "info",
            message: t("logs.messages.downloadStarted", { taskId }),
            target: "download",
          });
        });
        unlistenFns.push(unlistenDlStarted);

        const unlistenDlCompleted = await listenDownloadTaskCompleted(
          (taskId) => {
            addLog({
              timestamp: Date.now(),
              level: "info",
              message: t("logs.messages.downloadCompleted", { taskId }),
              target: "download",
            });
          },
        );
        unlistenFns.push(unlistenDlCompleted);

        const unlistenDlFailed = await listenDownloadTaskFailed(
          (taskId, error) => {
            addLog({
              timestamp: Date.now(),
              level: "error",
              message: t("logs.messages.downloadFailed", { taskId, error }),
              target: "download",
            });
          },
        );
        unlistenFns.push(unlistenDlFailed);

        const unlistenDlPaused = await listenDownloadTaskPaused((taskId) => {
          addLog({
            timestamp: Date.now(),
            level: "debug",
            message: t("logs.messages.downloadPaused", { taskId }),
            target: "download",
          });
        });
        unlistenFns.push(unlistenDlPaused);

        const unlistenDlResumed = await listenDownloadTaskResumed((taskId) => {
          addLog({
            timestamp: Date.now(),
            level: "debug",
            message: t("logs.messages.downloadResumed", { taskId }),
            target: "download",
          });
        });
        unlistenFns.push(unlistenDlResumed);

        const unlistenDlCancelled = await listenDownloadTaskCancelled(
          (taskId) => {
            addLog({
              timestamp: Date.now(),
              level: "warn",
              message: t("logs.messages.downloadCancelled", { taskId }),
              target: "download",
            });
          },
        );
        unlistenFns.push(unlistenDlCancelled);

        // Self-update progress listener
        const unlistenSelfUpdate = await listenSelfUpdateProgress(
          (progress) => {
            let message = "";
            let level: LogLevel = "info";

            switch (progress.status) {
              case "downloading":
                message = t("logs.messages.selfUpdateDownloading", {
                  progress: progress.progress ?? 0,
                });
                level = "debug";
                break;
              case "installing":
                message = t("logs.messages.selfUpdateInstalling");
                break;
              case "done":
                message = t("logs.messages.selfUpdateDone");
                break;
              case "error":
                message = t("logs.messages.selfUpdateError");
                level = "error";
                break;
            }

            addLog({
              timestamp: Date.now(),
              level,
              message,
              target: "self-update",
            });
          },
        );
        unlistenFns.push(unlistenSelfUpdate);

        // Update check progress listener
        const unlistenUpdateCheck = await listenUpdateCheckProgress(
          (progress) => {
            const message = t("logs.messages.updateCheckProgress", {
              phase: progress.phase,
              current: progress.current,
              total: progress.total,
            });

            addLog({
              timestamp: Date.now(),
              level: progress.phase === "done" ? "info" : "debug",
              message,
              target: "update-check",
            });
          },
        );
        unlistenFns.push(unlistenUpdateCheck);
      } catch (error) {
        console.error("Failed to setup log listeners:", error);
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
