'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  SETTINGS_REGISTRY,
  SETTINGS_SECTIONS,
  type SettingDefinition,
  type SettingsSection,
  type SectionDefinition,
} from '@/lib/constants/settings-registry';

export interface SettingsSearchResult {
  setting: SettingDefinition;
  matchedIn: ('label' | 'description' | 'keywords')[];
}

export interface UseSettingsSearchOptions {
  t: (key: string) => string;
  showAdvanced?: boolean;
  showTauriOnly?: boolean;
}

export interface UseSettingsSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SettingsSearchResult[];
  matchingSections: Set<SettingsSection>;
  matchingSectionDefinitions: SectionDefinition[];
  isSearching: boolean;
  clearSearch: () => void;
  totalResults: number;
  highlightText: (text: string) => { text: string; highlighted: boolean }[];
}

/**
 * Hook for searching settings items
 * Searches through labels, descriptions, and keywords in both English and Chinese
 */
export function useSettingsSearch({
  t,
  showAdvanced = true,
  showTauriOnly = true,
}: UseSettingsSearchOptions): UseSettingsSearchReturn {
  const [query, setQuery] = useState('');

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  const { results, matchingSections } = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return {
        results: [] as SettingsSearchResult[],
        matchingSections: new Set<SettingsSection>(),
      };
    }

    const searchResults: SettingsSearchResult[] = [];
    const sections = new Set<SettingsSection>();

    for (const setting of SETTINGS_REGISTRY) {
      // Filter based on options
      if (!showAdvanced && setting.advanced) continue;
      if (!showTauriOnly && setting.tauriOnly) continue;

      const matchedIn: ('label' | 'description' | 'keywords')[] = [];

      // Search in translated label
      const label = t(setting.labelKey).toLowerCase();
      if (label.includes(trimmedQuery)) {
        matchedIn.push('label');
      }

      // Search in translated description
      const description = t(setting.descKey).toLowerCase();
      if (description.includes(trimmedQuery)) {
        matchedIn.push('description');
      }

      // Search in keywords (already lowercase in registry)
      if (setting.keywords?.some((kw) => kw.toLowerCase().includes(trimmedQuery))) {
        matchedIn.push('keywords');
      }

      // Also search by key itself
      if (setting.key.toLowerCase().includes(trimmedQuery)) {
        if (!matchedIn.includes('keywords')) {
          matchedIn.push('keywords');
        }
      }

      if (matchedIn.length > 0) {
        searchResults.push({ setting, matchedIn });
        sections.add(setting.section);
      }
    }

    // Sort results: label matches first, then description, then keywords only
    searchResults.sort((a, b) => {
      const aScore = a.matchedIn.includes('label') ? 3 : a.matchedIn.includes('description') ? 2 : 1;
      const bScore = b.matchedIn.includes('label') ? 3 : b.matchedIn.includes('description') ? 2 : 1;
      return bScore - aScore;
    });

    return { results: searchResults, matchingSections: sections };
  }, [query, t, showAdvanced, showTauriOnly]);

  const matchingSectionDefinitions = useMemo(() => {
    return SETTINGS_SECTIONS.filter((s) => matchingSections.has(s.id)).sort(
      (a, b) => a.order - b.order
    );
  }, [matchingSections]);

  const highlightText = useCallback(
    (text: string): { text: string; highlighted: boolean }[] => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return [{ text, highlighted: false }];
      }

      const parts: { text: string; highlighted: boolean }[] = [];
      const lowerText = text.toLowerCase();
      const lowerQuery = trimmedQuery.toLowerCase();

      let lastIndex = 0;
      let index = lowerText.indexOf(lowerQuery);

      while (index !== -1) {
        // Add non-highlighted part before match
        if (index > lastIndex) {
          parts.push({ text: text.slice(lastIndex, index), highlighted: false });
        }
        // Add highlighted match (preserve original case)
        parts.push({
          text: text.slice(index, index + trimmedQuery.length),
          highlighted: true,
        });
        lastIndex = index + trimmedQuery.length;
        index = lowerText.indexOf(lowerQuery, lastIndex);
      }

      // Add remaining non-highlighted text
      if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), highlighted: false });
      }

      return parts.length > 0 ? parts : [{ text, highlighted: false }];
    },
    [query]
  );

  return {
    query,
    setQuery,
    results,
    matchingSections,
    matchingSectionDefinitions,
    isSearching: query.trim().length > 0,
    clearSearch,
    totalResults: results.length,
    highlightText,
  };
}

/**
 * Hook for tracking active section based on scroll position
 */
export function useActiveSection(sectionIds: SettingsSection[]) {
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(
    sectionIds[0] ?? null
  );

  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      // Find the first visible section
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visibleEntries.length > 0) {
        const sectionId = visibleEntries[0].target.id.replace('section-', '') as SettingsSection;
        setActiveSection(sectionId);
      }
    },
    []
  );

  const scrollToSection = useCallback((sectionId: SettingsSection) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  }, []);

  return {
    activeSection,
    setActiveSection,
    observerCallback,
    scrollToSection,
  };
}
