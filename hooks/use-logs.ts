import { useCallback } from 'react';
import { useLogStore } from '@/lib/stores/log';
import {
  isTauri,
  logListFiles,
  logQuery,
  logClear,
  logGetDir,
  logExport,
  logGetTotalSize,
  logCleanup,
  logCleanupPreview,
  logDeleteFile,
  logDeleteBatch,
} from '@/lib/tauri';
import type { LogFileInfo } from '@/types/log';
import type { LogOperationStatus } from '@/types/tauri';

export type LogActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface LogMutationSummary {
  deletedCount: number;
  freedBytes: number;
  status: LogOperationStatus;
  warnings: string[];
}

export interface LogCleanupPreviewSummary extends LogMutationSummary {
  protectedCount: number;
}

function toLogErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

function summarizeRemovedFiles(
  beforeFiles: LogFileInfo[],
  afterFiles: LogFileInfo[],
  candidates: LogFileInfo[],
): LogMutationSummary {
  const remainingNames = new Set(afterFiles.map((file) => file.name));
  const removed = candidates.filter((file) => !remainingNames.has(file.name));
  return {
    deletedCount: removed.length,
    freedBytes: removed.reduce((total, file) => total + file.size, 0),
    status: 'success',
    warnings: [],
  };
}

function normalizeOperationStatus(status?: LogOperationStatus): LogOperationStatus {
  if (status === 'success' || status === 'partial_success' || status === 'failed') {
    return status;
  }
  return 'success';
}

/**
 * Hook for log management operations.
 * 
 * Note: Event listeners for Tauri events (command output, env install progress,
 * batch progress) are handled by LogProvider at the app level.
 * This hook provides state access and file operations only.
 */
export function useLogs() {
  const {
    logs,
    filter,
    autoScroll,
    paused,
    drawerOpen,
    logFiles,
    addLog,
    clearLogs,
    setFilter,
    toggleLevel,
    setSearch,
    setTimeRange,
    toggleRegex,
    toggleAutoScroll,
    togglePaused,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    setLogFiles,
    setMaxLogs,
    getFilteredLogs,
    getLogStats,
  } = useLogStore();

  // Load log files
  const loadLogFiles = useCallback(async () => {
    if (!isTauri()) {
      return { ok: false, error: 'Logs file operations are available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const files = await logListFiles();
      setLogFiles(files);
      return { ok: true, data: files } satisfies LogActionResult<typeof files>;
    } catch (error) {
      console.error('Failed to load log files:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to load log files'),
      } satisfies LogActionResult<never>;
    }
  }, [setLogFiles]);

  // Query log file
  const queryLogFile = useCallback(async (options: {
    fileName?: string;
    levelFilter?: string[];
    target?: string;
    search?: string;
    useRegex?: boolean;
    startTime?: number | null;
    endTime?: number | null;
    limit?: number;
    offset?: number;
    maxScanLines?: number;
  }) => {
    if (!isTauri()) {
      return { ok: false, error: 'Log querying is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const result = await logQuery(options);
      return { ok: true, data: result } satisfies LogActionResult<typeof result>;
    } catch (error) {
      console.error('Failed to query log file:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to query log file'),
      } satisfies LogActionResult<never>;
    }
  }, []);

  // Clear log file
  const clearLogFile = useCallback(async (fileName?: string) => {
    if (!isTauri()) {
      return { ok: false, error: 'Log clearing is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const targetCandidates = fileName
        ? logFiles.filter((file) => file.name === fileName)
        : logFiles.slice(1);

      await logClear(fileName);
      const refreshResult = await loadLogFiles();
      if (!refreshResult.ok) {
        return refreshResult;
      }

      const summary = summarizeRemovedFiles(
        logFiles,
        refreshResult.data,
        targetCandidates,
      );
      return {
        ok: true,
        data: summary,
      } satisfies LogActionResult<LogMutationSummary>;
    } catch (error) {
      console.error('Failed to clear log file:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to clear log file'),
      } satisfies LogActionResult<never>;
    }
  }, [loadLogFiles, logFiles]);

  // Get log directory
  const getLogDirectory = useCallback(async () => {
    if (!isTauri()) {
      return { ok: false, error: 'Log directory access is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const dir = await logGetDir();
      return { ok: true, data: dir } satisfies LogActionResult<typeof dir>;
    } catch (error) {
      console.error('Failed to get log directory:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to get log directory'),
      } satisfies LogActionResult<never>;
    }
  }, []);

  // Export logs to file (Tauri: native save dialog, web: browser download)
  const exportLogs = useCallback(async (format: 'txt' | 'json' | 'csv' = 'txt') => {
    const logsToExport = getFilteredLogs();
    
    let content: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(logsToExport, null, 2);
      mimeType = 'application/json';
    } else if (format === 'csv') {
      const header = 'timestamp,level,target,message';
      const rows = logsToExport.map((log) => {
        const ts = new Date(log.timestamp).toISOString();
        const msg = log.message.replace(/"/g, '""');
        return `"${ts}","${log.level}","${log.target ?? ''}","${msg}"`;
      });
      content = [header, ...rows].join('\n');
      mimeType = 'text/csv';
    } else {
      content = logsToExport
        .map((log) => {
          const timestamp = new Date(log.timestamp).toISOString();
          return `[${timestamp}][${log.level.toUpperCase()}]${log.target ? `[${log.target}]` : ''} ${log.message}`;
        })
        .join('\n');
      mimeType = 'text/plain';
    }

    const fileName = `cognia-logs-${new Date().toISOString().split('T')[0]}.${format}`;

    // Try Tauri native save dialog first
    if (isTauri()) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const selected = await save({
          defaultPath: fileName,
          filters: [{ name: format.toUpperCase(), extensions: [format] }],
        });
        if (selected) {
          await writeTextFile(selected, content);
          return;
        }
        return; // user cancelled
      } catch {
        // Fallback to browser download below
      }
    }

    // Browser fallback
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getFilteredLogs]);

  // Export a log file from backend
  const exportLogFile = useCallback(async (options: {
    fileName?: string;
    levelFilter?: string[];
    target?: string;
    search?: string;
    useRegex?: boolean;
    startTime?: number | null;
    endTime?: number | null;
    format?: 'txt' | 'json' | 'csv';
    diagnosticMode?: boolean;
    sanitizeSensitive?: boolean;
  }) => {
    if (!isTauri()) {
      return { ok: false, error: 'Log file export is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const result = await logExport(options);
      return {
        ok: true,
        data: {
          ...result,
          status: normalizeOperationStatus(result.status),
          warnings: result.warnings ?? [],
          redactedCount: result.redactedCount ?? 0,
          sanitized: result.sanitized ?? false,
          sizeBytes: result.sizeBytes ?? result.content.length,
        },
      } satisfies LogActionResult<typeof result>;
    } catch (error) {
      console.error('Failed to export log file:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to export log file'),
      } satisfies LogActionResult<never>;
    }
  }, []);

  // Get total size of all log files
  const getTotalSize = useCallback(async () => {
    if (!isTauri()) {
      return { ok: false, error: 'Log size calculation is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const size = await logGetTotalSize();
      return { ok: true, data: size } satisfies LogActionResult<typeof size>;
    } catch (error) {
      console.error('Failed to get total log size:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to get total log size'),
      } satisfies LogActionResult<never>;
    }
  }, []);

  // Run log cleanup based on configured retention policy
  const cleanupLogs = useCallback(async () => {
    if (!isTauri()) {
      return { ok: false, error: 'Log cleanup is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const cleanupResult = await logCleanup();
      const refreshResult = await loadLogFiles();
      if (!refreshResult.ok) {
        return refreshResult;
      }
      return {
        ok: true,
        data: {
          deletedCount: cleanupResult.deletedCount,
          freedBytes: cleanupResult.freedBytes,
          status: normalizeOperationStatus(cleanupResult.status),
          warnings: cleanupResult.warnings ?? [],
        },
      } satisfies LogActionResult<LogMutationSummary>;
    } catch (error) {
      console.error('Failed to cleanup logs:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to cleanup logs'),
      } satisfies LogActionResult<never>;
    }
  }, [loadLogFiles]);

  const previewCleanupLogs = useCallback(async () => {
    if (!isTauri()) {
      return { ok: false, error: 'Log cleanup preview is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const preview = await logCleanupPreview();
      return {
        ok: true,
        data: {
          deletedCount: preview.deletedCount,
          freedBytes: preview.freedBytes,
          protectedCount: preview.protectedCount,
          status: normalizeOperationStatus(preview.status),
          warnings: preview.warnings ?? [],
        },
      } satisfies LogActionResult<LogCleanupPreviewSummary>;
    } catch (error) {
      console.error('Failed to preview log cleanup:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to preview log cleanup'),
      } satisfies LogActionResult<never>;
    }
  }, []);

  // Delete a specific log file
  const deleteLogFile = useCallback(async (fileName: string) => {
    if (!isTauri()) {
      return { ok: false, error: 'Log deletion is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const targetCandidates = logFiles.filter((file) => file.name === fileName);
      await logDeleteFile(fileName);
      const refreshResult = await loadLogFiles();
      if (!refreshResult.ok) {
        return refreshResult;
      }

      const summary = summarizeRemovedFiles(
        logFiles,
        refreshResult.data,
        targetCandidates,
      );
      return {
        ok: true,
        data: summary,
      } satisfies LogActionResult<LogMutationSummary>;
    } catch (error) {
      console.error('Failed to delete log file:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to delete log file'),
      } satisfies LogActionResult<never>;
    }
  }, [loadLogFiles, logFiles]);

  // Delete multiple log files at once
  const deleteLogFiles = useCallback(async (fileNames: string[]) => {
    if (!isTauri()) {
      return { ok: false, error: 'Batch log deletion is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const result = await logDeleteBatch(fileNames);
      const refreshResult = await loadLogFiles();
      if (!refreshResult.ok) {
        return refreshResult;
      }
      return {
        ok: true,
        data: {
          deletedCount: result.deletedCount,
          freedBytes: result.freedBytes,
          status: normalizeOperationStatus(result.status),
          warnings: result.warnings ?? [],
        },
      } satisfies LogActionResult<LogMutationSummary>;
    } catch (error) {
      console.error('Failed to delete log files:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to delete log files'),
      } satisfies LogActionResult<never>;
    }
  }, [loadLogFiles]);

  return {
    // State
    logs,
    filter,
    autoScroll,
    paused,
    drawerOpen,
    logFiles,
    
    // Actions
    addLog,
    clearLogs,
    setFilter,
    toggleLevel,
    setSearch,
    setTimeRange,
    toggleRegex,
    toggleAutoScroll,
    togglePaused,
    setMaxLogs,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    
    // Computed
    getFilteredLogs,
    getLogStats,
    
    // File operations
    loadLogFiles,
    queryLogFile,
    clearLogFile,
    getLogDirectory,
    exportLogs,
    exportLogFile,
    getTotalSize,

    // Log management
    cleanupLogs,
    previewCleanupLogs,
    deleteLogFile,
    deleteLogFiles,
  };
}
