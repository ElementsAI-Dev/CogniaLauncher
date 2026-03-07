export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  target?: string;
  file?: string;
  line?: number;
  context?: Record<string, string>;
}

export interface LogFilter {
  levels: LogLevel[];
  search: string;
  target?: string;
  useRegex?: boolean;
  maxScanLines?: number | null;
  startTime?: number | null;
  endTime?: number | null;
}

export type LogPresetScope = 'realtime' | 'historical';

export interface LogFilterPreset {
  id: string;
  name: string;
  scope: LogPresetScope;
  version: number;
  filter: LogFilter;
  updatedAt: number;
}

export interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modified: number;
}
