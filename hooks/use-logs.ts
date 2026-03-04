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
  logDeleteFile,
  logDeleteBatch,
} from '@/lib/tauri';

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
    if (!isTauri()) return;

    try {
      const files = await logListFiles();
      setLogFiles(files);
    } catch (error) {
      console.error('Failed to load log files:', error);
    }
  }, [setLogFiles]);

  // Query log file
  const queryLogFile = useCallback(async (options: {
    fileName?: string;
    levelFilter?: string[];
    search?: string;
    useRegex?: boolean;
    startTime?: number | null;
    endTime?: number | null;
    limit?: number;
    offset?: number;
    maxScanLines?: number;
  }) => {
    if (!isTauri()) return null;

    try {
      return await logQuery(options);
    } catch (error) {
      console.error('Failed to query log file:', error);
      return null;
    }
  }, []);

  // Clear log file
  const clearLogFile = useCallback(async (fileName?: string) => {
    if (!isTauri()) return;

    try {
      await logClear(fileName);
      await loadLogFiles();
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }, [loadLogFiles]);

  // Get log directory
  const getLogDirectory = useCallback(async () => {
    if (!isTauri()) return null;

    try {
      return await logGetDir();
    } catch (error) {
      console.error('Failed to get log directory:', error);
      return null;
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
    search?: string;
    useRegex?: boolean;
    startTime?: number | null;
    endTime?: number | null;
    format?: 'txt' | 'json';
  }) => {
    if (!isTauri()) return null;

    try {
      return await logExport(options);
    } catch (error) {
      console.error('Failed to export log file:', error);
      return null;
    }
  }, []);

  // Get total size of all log files
  const getTotalSize = useCallback(async () => {
    if (!isTauri()) return 0;

    try {
      return await logGetTotalSize();
    } catch (error) {
      console.error('Failed to get total log size:', error);
      return 0;
    }
  }, []);

  // Run log cleanup based on configured retention policy
  const cleanupLogs = useCallback(async () => {
    if (!isTauri()) return null;

    try {
      const result = await logCleanup();
      await loadLogFiles();
      return result;
    } catch (error) {
      console.error('Failed to cleanup logs:', error);
      return null;
    }
  }, [loadLogFiles]);

  // Delete a specific log file
  const deleteLogFile = useCallback(async (fileName: string) => {
    if (!isTauri()) return;

    try {
      await logDeleteFile(fileName);
      await loadLogFiles();
    } catch (error) {
      console.error('Failed to delete log file:', error);
      throw error;
    }
  }, [loadLogFiles]);

  // Delete multiple log files at once
  const deleteLogFiles = useCallback(async (fileNames: string[]) => {
    if (!isTauri()) return null;

    try {
      const result = await logDeleteBatch(fileNames);
      await loadLogFiles();
      return result;
    } catch (error) {
      console.error('Failed to delete log files:', error);
      return null;
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
    deleteLogFile,
    deleteLogFiles,
  };
}
