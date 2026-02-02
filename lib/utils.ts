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
