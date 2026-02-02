'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutAction {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts: ShortcutAction[];
}

/**
 * Hook for handling keyboard shortcuts
 * Supports Ctrl, Meta (Cmd on Mac), Shift, and Alt modifiers
 */
export function useKeyboardShortcuts({
  enabled = true,
  shortcuts,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = shortcut.metaKey ? event.metaKey : !event.metaKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

        // Also match Ctrl on Windows/Linux to Cmd on Mac
        const cmdOrCtrl = shortcut.ctrlKey || shortcut.metaKey;
        const cmdOrCtrlMatch = cmdOrCtrl 
          ? (event.ctrlKey || event.metaKey)
          : (!event.ctrlKey && !event.metaKey);

        if (keyMatch && (cmdOrCtrl ? cmdOrCtrlMatch : (ctrlMatch && metaMatch)) && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [enabled, shortcuts]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * Common keyboard shortcuts for environment management
 */
export function useEnvironmentShortcuts(callbacks: {
  onRefresh?: () => void;
  onAdd?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
}) {
  const shortcuts: ShortcutAction[] = [
    ...(callbacks.onRefresh
      ? [
          {
            key: 'r',
            ctrlKey: true,
            action: callbacks.onRefresh,
            description: 'Refresh environments',
          },
        ]
      : []),
    ...(callbacks.onAdd
      ? [
          {
            key: 'n',
            ctrlKey: true,
            action: callbacks.onAdd,
            description: 'Add new environment',
          },
        ]
      : []),
    ...(callbacks.onSearch
      ? [
          {
            key: 'k',
            ctrlKey: true,
            action: callbacks.onSearch,
            description: 'Focus search',
          },
          {
            key: '/',
            action: callbacks.onSearch,
            description: 'Focus search',
          },
        ]
      : []),
    ...(callbacks.onEscape
      ? [
          {
            key: 'Escape',
            action: callbacks.onEscape,
            description: 'Close dialog/panel',
          },
        ]
      : []),
  ];

  useKeyboardShortcuts({ shortcuts });
}

/**
 * Get formatted shortcut display string
 */
export function formatShortcut(shortcut: Partial<ShortcutAction>): string {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const parts: string[] = [];

  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (shortcut.key) {
    parts.push(shortcut.key.toUpperCase());
  }

  return parts.join(isMac ? '' : '+');
}
