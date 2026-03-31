'use client';

import { useState, useCallback } from 'react';
import { SEARCH_HISTORY_KEY, MAX_SEARCH_HISTORY } from '@/lib/constants/packages';

const getInitialHistory = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] =
    useState<string[]>(getInitialHistory);

  const saveToHistory = useCallback(
    (searchQuery: string) => {
      try {
        const newHistory = [
          searchQuery,
          ...searchHistory.filter((h) => h !== searchQuery),
        ].slice(0, MAX_SEARCH_HISTORY);
        setSearchHistory(newHistory);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      } catch {
        // Ignore localStorage errors
      }
    },
    [searchHistory],
  );

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    searchHistory,
    saveToHistory,
    clearHistory,
  };
}
