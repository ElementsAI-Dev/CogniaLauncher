'use client';

import { useEffect, useCallback } from 'react';

interface UseSettingsShortcutsOptions {
  onSave?: () => void;
  onReset?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
  hasChanges?: boolean;
  isLoading?: boolean;
}

/**
 * Keyboard shortcuts specifically for the settings page
 * Handles Ctrl+S for save even when focused on input fields
 */
export function useSettingsShortcuts({
  onSave,
  onReset,
  onEscape,
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
        const target = event.target as HTMLElement;
        if (
          target.tagName !== 'INPUT' &&
          target.tagName !== 'TEXTAREA' &&
          !target.isContentEditable
        ) {
          event.preventDefault();
          if (!isLoading && onReset) {
            onReset();
          }
        }
        return;
      }

      // Escape to cancel/close
      if (event.key === 'Escape' && onEscape) {
        onEscape();
      }
    },
    [enabled, hasChanges, isLoading, onSave, onReset, onEscape]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
