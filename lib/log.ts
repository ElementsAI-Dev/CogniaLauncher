import type { LogLevel } from '@/types/log';

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
