import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format bytes to human-readable size string
 * @param bytes - Number of bytes (can be null or undefined)
 * @param fallback - Fallback string when bytes is null/undefined (default: 'Unknown')
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatSize(bytes: number | null | undefined, fallback = 'Unknown'): string {
  if (bytes == null) return fallback;
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format bytes per second to human-readable speed string
 * @param bytesPerSec - Speed in bytes per second
 * @returns Formatted speed string (e.g., "1.5 MB/s")
 */
export function formatSpeed(bytesPerSec: number): string {
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let speed = bytesPerSec;
  let unitIndex = 0;
  while (speed >= 1024 && unitIndex < units.length - 1) {
    speed /= 1024;
    unitIndex++;
  }
  return `${speed.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format bytes to human-readable size string
 * @param bytes - Number of bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format seconds to human-readable uptime string
 * @param seconds - Number of seconds
 * @returns Formatted uptime string (e.g., "2d 5h 30m")
 */
export function formatUptime(seconds: number): string {
  if (seconds === 0) return '';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '< 1m';
}

/**
 * Format Unix timestamp to locale date string
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Format ETA string with fallback
 * @param eta - ETA string or null/undefined
 * @returns Formatted ETA or em dash
 */
export function formatEta(eta: string | null | undefined): string {
  return eta || '—';
}
