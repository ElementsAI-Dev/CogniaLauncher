import { PRIORITY_OPTIONS } from "@/lib/constants/downloads";
import type { DownloadTask } from "@/types/tauri";

/**
 * Validate whether a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Infer a filename from a URL
 */
export function inferNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment || "download";
  } catch {
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] || "download";
  }
}

/**
 * Map a download task state to a Badge variant
 */
export function getStateBadgeVariant(
  state: DownloadTask["state"]
): "default" | "destructive" | "secondary" | "outline" {
  switch (state) {
    case "completed":
      return "default";
    case "failed":
    case "cancelled":
      return "destructive";
    case "paused":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Find the closest priority option value for a given numeric priority
 */
export function findClosestPriority(priority: number): string {
  const sorted = PRIORITY_OPTIONS.map((o) => ({
    ...o,
    diff: Math.abs(Number(o.value) - priority),
  })).sort((a, b) => a.diff - b.diff);
  return sorted[0].value;
}
