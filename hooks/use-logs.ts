import { useCallback } from 'react';
import { useLogStore } from '@/lib/stores/log';
import {
  isTauri,
  logListFiles,
  logQuery,
  logClear,
  logGetDir,
  logExport,
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

  // Export logs to file
  const exportLogs = useCallback((format: 'txt' | 'json' = 'txt') => {
    const logsToExport = getFilteredLogs();
    
    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'json') {
      content = JSON.stringify(logsToExport, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      content = logsToExport
        .map((log) => {
          const date = new Date(log.timestamp);
          const timestamp = date.toISOString();
          return `[${timestamp}][${log.level.toUpperCase()}]${log.target ? `[${log.target}]` : ''} ${log.message}`;
        })
        .join('\n');
      mimeType = 'text/plain';
      extension = 'txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognia-logs-${new Date().toISOString().split('T')[0]}.${extension}`;
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
  };
}
