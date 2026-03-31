import { useCallback } from 'react';
import { useLogStore } from '@/lib/stores/log';
import {
  isTauri,
  diagnosticListCrashReports,
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
import { exportDesktopDiagnosticBundle } from '@/lib/diagnostic-export';
import type {
  CrashReportInfo,
  DiagnosticExportResult,
  LogCleanupOptions,
  LogCleanupPolicyInput,
  LogCleanupPreviewResult,
  LogCleanupResult,
  LogQueryMeta,
  LogQueryResult,
  LogOperationReasonCode,
  LogOperationStatus,
} from '@/types/tauri';

export type LogActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type LogMutationSummary = LogCleanupResult;
export type LogCleanupPreviewSummary = LogCleanupPreviewResult;

interface QueryLogFileOptions {
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
}

interface ExportDiagnosticBundleOptions {
  t: (key: string) => string;
  workspaceSection: string;
  selectedFile?: string | null;
  fileQueryContext?: {
    totalCount?: number;
    matchedCount?: number;
    scannedLines?: number;
    sourceLineCount?: number;
    maxScanLines?: number | null;
    windowStartLine?: number | null;
    windowEndLine?: number | null;
  };
  filterContext?: {
    levels?: string[];
    target?: string;
    search?: string;
    useRegex?: boolean;
    startTime?: number | null;
    endTime?: number | null;
    maxScanLines?: number | null;
  };
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

function normalizeOperationStatus(status?: LogOperationStatus): LogOperationStatus {
  if (status === 'success' || status === 'partial_success' || status === 'failed') {
    return status;
  }
  return 'success';
}

function normalizeReasonCode(
  reasonCode?: LogOperationReasonCode | null,
): LogOperationReasonCode | null {
  if (typeof reasonCode !== 'string') {
    return null;
  }
  const normalized = reasonCode.trim();
  return normalized.length > 0 ? (normalized as LogOperationReasonCode) : null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizeCleanupPolicyInput(
  policy?: LogCleanupPolicyInput,
): LogCleanupPolicyInput | undefined {
  if (!policy) {
    return undefined;
  }
  const normalizedDays = Number.isFinite(policy.maxRetentionDays)
    ? clampInt(policy.maxRetentionDays as number, 0, 365)
    : undefined;
  const normalizedSizeMb = Number.isFinite(policy.maxTotalSizeMb)
    ? clampInt(policy.maxTotalSizeMb as number, 0, 10_000)
    : undefined;
  if (typeof normalizedDays !== 'number' && typeof normalizedSizeMb !== 'number') {
    return undefined;
  }
  return {
    maxRetentionDays: normalizedDays,
    maxTotalSizeMb: normalizedSizeMb,
  };
}

function normalizeCleanupOptions(options?: LogCleanupOptions): LogCleanupOptions | undefined {
  if (!options) {
    return undefined;
  }
  const normalizedPolicy = normalizeCleanupPolicyInput(options.policy);
  const normalizedExpectedFingerprint =
    typeof options.expectedPolicyFingerprint === 'string'
      ? options.expectedPolicyFingerprint.trim()
      : '';
  if (!normalizedPolicy && normalizedExpectedFingerprint.length === 0) {
    return undefined;
  }
  return {
    policy: normalizedPolicy,
    expectedPolicyFingerprint:
      normalizedExpectedFingerprint.length > 0 ? normalizedExpectedFingerprint : undefined,
  };
}

function normalizeMutationSummary(result: Partial<LogCleanupResult>): LogMutationSummary {
  return {
    deletedCount: result.deletedCount ?? 0,
    freedBytes: result.freedBytes ?? 0,
    protectedCount: result.protectedCount ?? 0,
    skippedCount: result.skippedCount ?? 0,
    status: normalizeOperationStatus(result.status),
    reasonCode: normalizeReasonCode(result.reasonCode),
    warnings: result.warnings ?? [],
    policyFingerprint: result.policyFingerprint ?? null,
    maxRetentionDays: result.maxRetentionDays ?? null,
    maxTotalSizeMb: result.maxTotalSizeMb ?? null,
  };
}

function normalizePreviewSummary(
  result: Partial<LogCleanupPreviewResult>,
): LogCleanupPreviewSummary {
  const maxRetentionDays = result.maxRetentionDays ?? 0;
  const maxTotalSizeMb = result.maxTotalSizeMb ?? 0;
  const policyFingerprint =
    typeof result.policyFingerprint === 'string' && result.policyFingerprint.trim().length > 0
      ? result.policyFingerprint.trim()
      : `v1:${maxRetentionDays}:${maxTotalSizeMb}`;
  return {
    ...normalizeMutationSummary(result),
    policyFingerprint,
    maxRetentionDays,
    maxTotalSizeMb,
  };
}

function normalizeQueryLogFileOptions(options: QueryLogFileOptions): QueryLogFileOptions {
  const normalizedFileName = options.fileName?.trim();
  const normalizedTarget = options.target?.trim();
  const normalizedSearch = options.search?.trim();
  const normalizedLevels = options.levelFilter
    ?.map((level) => level.trim())
    .filter((level) => level.length > 0);
  const normalizedLimit = typeof options.limit === 'number' && Number.isFinite(options.limit)
    ? Math.max(1, Math.floor(options.limit))
    : undefined;
  const normalizedOffset = typeof options.offset === 'number' && Number.isFinite(options.offset)
    ? Math.max(0, Math.floor(options.offset))
    : undefined;
  const normalizedScanLines = typeof options.maxScanLines === 'number' && Number.isFinite(options.maxScanLines)
    ? Math.max(1, Math.floor(options.maxScanLines))
    : undefined;

  return {
    fileName: normalizedFileName && normalizedFileName.length > 0 ? normalizedFileName : undefined,
    levelFilter: normalizedLevels && normalizedLevels.length > 0 ? normalizedLevels : undefined,
    target: normalizedTarget && normalizedTarget.length > 0 ? normalizedTarget : undefined,
    search: normalizedSearch && normalizedSearch.length > 0 ? normalizedSearch : undefined,
    useRegex: options.useRegex,
    startTime: options.startTime ?? undefined,
    endTime: options.endTime ?? undefined,
    limit: normalizedLimit,
    offset: normalizedOffset,
    maxScanLines: normalizedScanLines,
  };
}

function normalizeOptionalPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

function normalizeQueryMeta(result: Partial<LogQueryResult>): LogQueryMeta {
  const totalCount = typeof result.totalCount === 'number' && Number.isFinite(result.totalCount)
    ? Math.max(0, Math.floor(result.totalCount))
    : 0;
  const meta = result.meta;
  const sourceLineCount = normalizeOptionalPositiveInt(meta?.sourceLineCount) ?? 0;
  const scannedLines = normalizeOptionalPositiveInt(meta?.scannedLines) ?? sourceLineCount;

  return {
    scannedLines: Math.max(0, scannedLines),
    sourceLineCount: Math.max(0, sourceLineCount),
    matchedCount:
      normalizeOptionalPositiveInt(meta?.matchedCount) ??
      totalCount,
    effectiveMaxScanLines: normalizeOptionalPositiveInt(meta?.effectiveMaxScanLines),
    scanTruncated: Boolean(meta?.scanTruncated),
    windowStartLine: normalizeOptionalPositiveInt(meta?.windowStartLine),
    windowEndLine: normalizeOptionalPositiveInt(meta?.windowEndLine),
    queryFingerprint:
      typeof meta?.queryFingerprint === 'string' ? meta.queryFingerprint : '',
  };
}

function normalizeQueryResult(result: Partial<LogQueryResult>): LogQueryResult {
  const entries = Array.isArray(result.entries) ? result.entries : [];
  const totalCount = typeof result.totalCount === 'number' && Number.isFinite(result.totalCount)
    ? Math.max(0, Math.floor(result.totalCount))
    : entries.length;
  const hasMore = Boolean(result.hasMore);
  const meta = normalizeQueryMeta({ ...result, totalCount });

  return {
    entries,
    totalCount,
    hasMore,
    meta: {
      ...meta,
      matchedCount: Math.max(meta.matchedCount, totalCount),
    },
  };
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
    crashReports,
    observability,
    latestDiagnosticAction,
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
    setCrashReports,
    setLatestDiagnosticAction,
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
  const queryLogFile = useCallback(async (options: QueryLogFileOptions) => {
    if (!isTauri()) {
      return { ok: false, error: 'Log querying is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const result = await logQuery(normalizeQueryLogFileOptions(options));
      return {
        ok: true,
        data: normalizeQueryResult(result),
      } satisfies LogActionResult<LogQueryResult>;
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
      const summary = normalizeMutationSummary(await logClear(fileName));
      const refreshResult = await loadLogFiles();
      if (!refreshResult.ok) {
        return refreshResult;
      }

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
  }, [loadLogFiles]);

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

  const loadCrashReports = useCallback(async () => {
    if (!isTauri()) {
      setCrashReports([]);
      return {
        ok: false,
        error: 'Crash report history is available in desktop mode only',
      } satisfies LogActionResult<never>;
    }

    try {
      const reports = await diagnosticListCrashReports();
      setCrashReports(reports);
      return { ok: true, data: reports } satisfies LogActionResult<CrashReportInfo[]>;
    } catch (error) {
      console.error('Failed to load crash reports:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to load crash reports'),
      } satisfies LogActionResult<never>;
    }
  }, [setCrashReports]);

  const exportDiagnosticBundle = useCallback(async (options: ExportDiagnosticBundleOptions) => {
    if (!isTauri()) {
      return {
        ok: false,
        error: 'Full diagnostic export is available in desktop mode only',
      } satisfies LogActionResult<never>;
    }

    const result = await exportDesktopDiagnosticBundle({
      t: options.t,
      failureToastKey: 'logs.diagnosticBundleError',
      includeConfig: true,
      errorContext: {
        message: 'Logs workspace diagnostic export',
        component: 'logs-workspace',
        timestamp: new Date().toISOString(),
        extra: {
          logsContext: {
            runtimeMode: observability.runtimeMode,
            bridgeState: observability.backendBridgeState,
            backendBridgeError: observability.backendBridgeError,
            workspaceSection: options.workspaceSection,
            selectedFile: options.selectedFile ?? null,
            filters: options.filterContext ?? null,
            fileQuery: options.fileQueryContext ?? null,
            latestCrashCapture: observability.latestCrashCapture
              ? {
                  status: observability.latestCrashCapture.status,
                  reason: observability.latestCrashCapture.reason ?? null,
                  crashInfo: observability.latestCrashCapture.crashInfo,
                  updatedAt: observability.latestCrashCapture.updatedAt,
                }
              : null,
          },
        },
      },
    });

    if (result.ok) {
      setLatestDiagnosticAction({
        kind: 'full_diagnostic_export',
        status: 'success',
        path: result.data.path,
        error: null,
        fileCount: result.data.fileCount,
        sizeBytes: result.data.size,
        updatedAt: Date.now(),
      });
      return { ok: true, data: result.data } satisfies LogActionResult<DiagnosticExportResult>;
    }

    if ('cancelled' in result) {
      return { ok: true, data: null } satisfies LogActionResult<DiagnosticExportResult | null>;
    }

    setLatestDiagnosticAction({
      kind: 'full_diagnostic_export',
      status: 'failed',
      path: null,
      error: result.error,
      fileCount: null,
      sizeBytes: null,
      updatedAt: Date.now(),
    });
    return {
      ok: false,
      error: result.error,
    } satisfies LogActionResult<never>;
  }, [observability, setLatestDiagnosticAction]);

  // Run log cleanup based on configured retention policy
  const cleanupLogs = useCallback(async (options?: LogCleanupOptions) => {
    if (!isTauri()) {
      return { ok: false, error: 'Log cleanup is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const cleanupResult = await logCleanup(normalizeCleanupOptions(options));
      const refreshResult = await loadLogFiles();
      if (!refreshResult.ok) {
        return refreshResult;
      }
      return {
        ok: true,
        data: normalizeMutationSummary(cleanupResult),
      } satisfies LogActionResult<LogMutationSummary>;
    } catch (error) {
      console.error('Failed to cleanup logs:', error);
      return {
        ok: false,
        error: toLogErrorMessage(error, 'Failed to cleanup logs'),
      } satisfies LogActionResult<never>;
    }
  }, [loadLogFiles]);

  const previewCleanupLogs = useCallback(async (policy?: LogCleanupPolicyInput) => {
    if (!isTauri()) {
      return { ok: false, error: 'Log cleanup preview is available in desktop mode only' } satisfies LogActionResult<never>;
    }

    try {
      const preview = await logCleanupPreview(normalizeCleanupPolicyInput(policy));
      return {
        ok: true,
        data: normalizePreviewSummary(preview),
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
      const summary = normalizeMutationSummary(await logDeleteFile(fileName));
      const refreshResult = await loadLogFiles();
      if (!refreshResult.ok) {
        return refreshResult;
      }

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
  }, [loadLogFiles]);

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
        data: normalizeMutationSummary(result),
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
    crashReports,
    observability,
    latestDiagnosticAction,
    
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
    exportDiagnosticBundle,
    getTotalSize,
    loadCrashReports,

    // Log management
    cleanupLogs,
    previewCleanupLogs,
    deleteLogFile,
    deleteLogFiles,
  };
}
