/**
 * Dashboard utility functions for CogniaLauncher
 * Extracted from components/dashboard/ for better code organization
 */

import { SEARCH_HISTORY_KEY, MAX_HISTORY } from '@/lib/constants/dashboard';
import type { WidgetSize } from '@/lib/stores/dashboard';

// ============================================================================
// Search History Helpers
// ============================================================================

export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(
  currentHistory: string[],
  searchQuery: string,
): string[] {
  if (!searchQuery.trim()) return currentHistory;

  const filtered = currentHistory.filter((h) => h !== searchQuery);
  const updated = [searchQuery, ...filtered].slice(0, MAX_HISTORY);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export function clearSearchHistory(): void {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

// ============================================================================
// Widget Size Helpers
// ============================================================================

const WIDGET_SIZES: WidgetSize[] = ["sm", "md", "lg", "full"];

export function nextWidgetSize(current: WidgetSize): WidgetSize {
  const idx = WIDGET_SIZES.indexOf(current);
  return WIDGET_SIZES[(idx + 1) % WIDGET_SIZES.length];
}

export function prevWidgetSize(current: WidgetSize): WidgetSize {
  const idx = WIDGET_SIZES.indexOf(current);
  return WIDGET_SIZES[(idx - 1 + WIDGET_SIZES.length) % WIDGET_SIZES.length];
}
