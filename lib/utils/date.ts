/**
 * Format an ISO date string to a compact relative time string.
 * Returns short labels without "ago" suffix: "today", "1d", "3d", "2w", "3mo", "1y"
 * Used by changelog and similar compact date displays.
 */
export function formatCompactRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d";
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

export function formatLocalizedRelativeDate(
  dateStr: string,
  locale: string,
  t?: (key: string, params?: Record<string, string | number>) => string,
): string {
  const compact = formatCompactRelativeDate(dateStr);
  if (compact === 'unknown') {
    return compact;
  }
  if (compact === 'today') {
    return locale.startsWith('zh') ? '今天' : 'today';
  }
  if (t) {
    return t('about.changelogRelativeTime', { time: compact });
  }
  return locale.startsWith('zh') ? `${compact}前` : `${compact} ago`;
}
