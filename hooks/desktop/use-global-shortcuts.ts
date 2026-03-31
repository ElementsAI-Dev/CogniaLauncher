'use client';

import { useEffect, useRef, useCallback } from 'react';
import { isTauri } from '@/lib/platform';
import { useSettings } from '@/hooks/settings/use-settings';

interface UseGlobalShortcutsOptions {
  onToggleWindow: () => Promise<void>;
  onCommandPalette: () => void;
  onQuickSearch: () => void;
}

/**
 * Registers OS-level global shortcuts via tauri-plugin-global-shortcut.
 * Shortcuts work even when the window is not focused (e.g. minimized to tray).
 * Only active in Tauri desktop environment; no-op in browser.
 */
export function useGlobalShortcuts({
  onToggleWindow,
  onCommandPalette,
  onQuickSearch,
}: UseGlobalShortcutsOptions) {
  const { config } = useSettings();
  const shortcutsEnabled = config['shortcuts.enabled'];
  const toggleWindowKey = config['shortcuts.toggle_window'] || '';
  const commandPaletteKey = config['shortcuts.command_palette'] || '';
  const quickSearchKey = config['shortcuts.quick_search'] || '';
  const registeredRef = useRef<string[]>([]);
  const callbacksRef = useRef({ onToggleWindow, onCommandPalette, onQuickSearch });

  // Keep callbacks ref fresh
  callbacksRef.current = { onToggleWindow, onCommandPalette, onQuickSearch };

  const unregisterAll = useCallback(async () => {
    if (registeredRef.current.length === 0) return;
    try {
      const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
      for (const shortcut of registeredRef.current) {
        try {
          await unregister(shortcut);
        } catch {
          // Shortcut may already be unregistered
        }
      }
    } catch {
      // Plugin not available
    }
    registeredRef.current = [];
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    if (shortcutsEnabled === 'false') {
      // Unregister all if disabled
      unregisterAll();
      return;
    }

    // Nothing to register if all empty
    if (!toggleWindowKey && !commandPaletteKey && !quickSearchKey) return;

    let active = true;

    const registerShortcuts = async () => {
      // First unregister any previously registered shortcuts
      await unregisterAll();

      try {
        const { register, isRegistered } = await import(
          '@tauri-apps/plugin-global-shortcut'
        );

        const shortcutMap: Record<string, () => void> = {};

        if (toggleWindowKey) {
          shortcutMap[toggleWindowKey] = () => {
            callbacksRef.current.onToggleWindow();
          };
        }
        if (commandPaletteKey) {
          shortcutMap[commandPaletteKey] = () => {
            callbacksRef.current.onCommandPalette();
          };
        }
        if (quickSearchKey) {
          shortcutMap[quickSearchKey] = () => {
            callbacksRef.current.onQuickSearch();
          };
        }

        for (const [shortcut, handler] of Object.entries(shortcutMap)) {
          if (!active) return;

          try {
            // Check if already registered by another app
            const alreadyRegistered = await isRegistered(shortcut);
            if (alreadyRegistered) {
              console.warn(
                `[global-shortcut] "${shortcut}" is already registered, skipping`
              );
              continue;
            }

            await register(shortcut, (event) => {
              if (event.state === 'Pressed') {
                handler();
              }
            });

            registeredRef.current.push(shortcut);
          } catch (err) {
            console.warn(
              `[global-shortcut] Failed to register "${shortcut}":`,
              err
            );
          }
        }
      } catch (err) {
        console.error('[global-shortcut] Plugin initialization failed:', err);
      }
    };

    registerShortcuts();

    return () => {
      active = false;
      unregisterAll();
    };
  }, [shortcutsEnabled, toggleWindowKey, commandPaletteKey, quickSearchKey, unregisterAll]);
}
