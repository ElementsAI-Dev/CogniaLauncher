/**
 * Shared date formatting utilities for Git components.
 * Eliminates duplication across git-commit-log, git-file-history, and git-blame-view.
 */

/**
 * Format an ISO date string to a human-readable relative time.
 * e.g. "today", "yesterday", "3 days ago", "2 weeks ago", "5 months ago", "1 year ago"
 */
export function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return dateStr;
  }
}

/**
 * Format a Unix timestamp (seconds) to a human-readable relative time.
 * Used by git-blame-view where timestamps come as epoch seconds.
 */
export function formatRelativeTimestamp(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diffSecs = now - timestamp;
  const diffDays = Math.floor(diffSecs / 86400);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
