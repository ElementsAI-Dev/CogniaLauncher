import type { LogLevel } from '@/types/log';

/**
 * Parse session start time from a log file name like "2026-02-28_14-27-30.log".
 * Returns null if the file name doesn't match the session pattern.
 */
export function parseSessionTimeFromFileName(fileName: string): Date | null {
  const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.log$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10),
  );
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a log file name as a human-readable session label.
 * e.g. "2026-02-28_14-27-30.log" → "2026-02-28 14:27:30"
 */
export function formatSessionLabel(fileName: string): string | null {
  const date = parseSessionTimeFromFileName(fileName);
  if (!date) return null;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

export function formatDateTimeInput(value: number | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function parseDateTimeInput(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeLevel(level: string): LogLevel {
  const normalized = level.toLowerCase();
  if (
    normalized === "trace" ||
    normalized === "debug" ||
    normalized === "info" ||
    normalized === "warn" ||
    normalized === "error"
  ) {
    return normalized as LogLevel;
  }
  return "info";
}

export function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const numeric = Number.parseInt(value, 10);
  if (!Number.isNaN(numeric)) {
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  return Date.now();
}
