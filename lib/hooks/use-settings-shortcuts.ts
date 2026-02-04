'use client';

import { useEffect, useCallback } from 'react';
import type { SettingsSection } from '@/lib/constants/settings-registry';

interface UseSettingsShortcutsOptions {
  onSave?: () => void;
  onReset?: () => void;
  onEscape?: () => void;
  onFocusSearch?: () => void;
  onNavigateSection?: (direction: 'prev' | 'next') => void;
  onJumpToSection?: (position: 'first' | 'last') => void;
  enabled?: boolean;
  hasChanges?: boolean;
  isLoading?: boolean;
}

/**
 * Check if an input element is currently focused
 */
function isInputFocused(): boolean {
  const target = document.activeElement as HTMLElement | null;
  if (!target) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

/**
 * Keyboard shortcuts specifically for the settings page
 * - Ctrl+S: Save changes
 * - Ctrl+R: Reset settings (outside inputs)
 * - Escape: Cancel/close
 * - /: Focus search bar (outside inputs)
 * - ↑/↓: Navigate between sections (outside inputs)
 * - Home/End: Jump to first/last section (outside inputs)
 */
export function useSettingsShortcuts({
  onSave,
  onReset,
  onEscape,
  onFocusSearch,
  onNavigateSection,
  onJumpToSection,
  enabled = true,
  hasChanges = false,
  isLoading = false,
}: UseSettingsShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ctrl/Cmd + S to save (works anywhere, including inputs)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (hasChanges && !isLoading && onSave) {
          onSave();
        }
        return;
      }

      // Ctrl/Cmd + R to reset (only outside inputs to avoid browser refresh conflict)
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        if (!isInputFocused()) {
          event.preventDefault();
          if (!isLoading && onReset) {
            onReset();
          }
        }
        return;
      }

      // Escape to cancel/close or blur search
      if (event.key === 'Escape') {
        if (onEscape) {
          onEscape();
        }
        return;
      }

      // '/' to focus search (only outside inputs)
      if (event.key === '/' && !isInputFocused()) {
        event.preventDefault();
        if (onFocusSearch) {
          onFocusSearch();
        }
        return;
      }

      // Arrow keys for section navigation (only outside inputs)
      if (!isInputFocused() && onNavigateSection) {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onNavigateSection('prev');
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onNavigateSection('next');
          return;
        }
      }

      // Home/End for jumping to first/last section (only outside inputs)
      if (!isInputFocused() && onJumpToSection) {
        if (event.key === 'Home') {
          event.preventDefault();
          onJumpToSection('first');
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          onJumpToSection('last');
          return;
        }
      }
    },
    [enabled, hasChanges, isLoading, onSave, onReset, onEscape, onFocusSearch, onNavigateSection, onJumpToSection]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

interface UseSectionNavigationOptions {
  sectionIds: SettingsSection[];
  activeSection: SettingsSection | null;
  setActiveSection: (section: SettingsSection) => void;
}

/**
 * Hook for section navigation logic
 */
export function useSectionNavigation({
  sectionIds,
  activeSection,
  setActiveSection,
}: UseSectionNavigationOptions) {
  const navigateSection = useCallback(
    (direction: 'prev' | 'next') => {
      if (sectionIds.length === 0) return;
      
      const currentIndex = activeSection ? sectionIds.indexOf(activeSection) : -1;
      let newIndex: number;

      if (direction === 'prev') {
        newIndex = currentIndex <= 0 ? sectionIds.length - 1 : currentIndex - 1;
      } else {
        newIndex = currentIndex >= sectionIds.length - 1 ? 0 : currentIndex + 1;
      }

      const newSection = sectionIds[newIndex];
      setActiveSection(newSection);
      
      // Scroll to the section
      const element = document.getElementById(`section-${newSection}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [sectionIds, activeSection, setActiveSection]
  );

  const jumpToSection = useCallback(
    (position: 'first' | 'last') => {
      if (sectionIds.length === 0) return;
      
      const newSection = position === 'first' ? sectionIds[0] : sectionIds[sectionIds.length - 1];
      setActiveSection(newSection);
      
      // Scroll to the section
      const element = document.getElementById(`section-${newSection}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [sectionIds, setActiveSection]
  );

  return { navigateSection, jumpToSection };
}
