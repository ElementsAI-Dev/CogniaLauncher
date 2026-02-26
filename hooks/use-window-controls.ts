"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { isTauri, isWindows as isWindowsOS } from "@/lib/platform";
import { useSettingsStore } from "@/lib/stores/settings";
import { useWindowStateStore } from "@/lib/stores/window-state";

type TauriWindow = Awaited<
  ReturnType<typeof import("@tauri-apps/api/window").getCurrentWindow>
>;

/**
 * On Windows, frameless maximized windows have an invisible border
 * (typically 7-8px at 100% scale) that clips content. We must add
 * padding to compensate. This value is the Windows default thick-frame
 * border in CSS pixels.
 */
const WIN_MAXIMIZE_PADDING = 8;

export interface WindowControlsState {
  /** Whether the component has mounted (for hydration safety) */
  mounted: boolean;
  /** Whether we are in a Tauri desktop environment */
  isTauriEnv: boolean;
  /** Whether running on Windows */
  isWindows: boolean;
  /** The Tauri window handle (null before init or in browser) */
  appWindow: TauriWindow | null;
  /** Whether the window is currently maximized */
  isMaximized: boolean;
  /** Whether the window is currently in fullscreen */
  isFullscreen: boolean;
  /** Whether the window is currently focused */
  isFocused: boolean;
  /** Whether the window is pinned always-on-top */
  isAlwaysOnTop: boolean;
  /** Padding in px needed to compensate for Windows frameless maximize border */
  maximizePadding: number;

  handleMinimize: () => Promise<void>;
  handleMaximize: () => Promise<void>;
  handleToggleFullscreen: () => Promise<void>;
  handleCenter: () => Promise<void>;
  handleToggleAlwaysOnTop: () => Promise<void>;
  handleClose: () => Promise<void>;
  handleDoubleClick: (e: React.MouseEvent) => void;
}

function checkGlobalUnsavedChanges(): boolean {
  if (typeof window === "undefined") return false;
  const event = new CustomEvent("cognia:check-unsaved", {
    detail: { hasChanges: false },
    cancelable: true,
  });
  window.dispatchEvent(event);
  return (event as CustomEvent<{ hasChanges: boolean }>).detail.hasChanges;
}

export function useWindowControls(): WindowControlsState {
  const { appSettings } = useSettingsStore();
  const setStoreMaximized = useWindowStateStore((s) => s.setMaximized);
  const setStoreFullscreen = useWindowStateStore((s) => s.setFullscreen);
  const setStoreFocused = useWindowStateStore((s) => s.setFocused);

  const [mounted, setMounted] = useState(false);
  const [appWindow, setAppWindow] = useState<TauriWindow | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  const unlistenResizeRef = useRef<(() => void) | null>(null);
  const unlistenFocusRef = useRef<(() => void) | null>(null);
  const unlistenCloseRef = useRef<(() => void) | null>(null);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let active = true;

    const initTauri = async () => {
      if (!isTauri()) return;

      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();

        if (!active) return;

        setAppWindow(win);

        const [maximized, fullscreen, alwaysOnTop] = await Promise.all([
          win.isMaximized(),
          win.isFullscreen(),
          win.isAlwaysOnTop(),
        ]);

        if (!active) return;

        setIsMaximized(maximized);
        setIsFullscreen(fullscreen);
        setIsAlwaysOnTop(alwaysOnTop);
        setStoreMaximized(maximized);
        setStoreFullscreen(fullscreen);

        unlistenResizeRef.current = await win.onResized(async () => {
          if (!active) return;
          const [max, full] = await Promise.all([
            win.isMaximized(),
            win.isFullscreen(),
          ]);
          if (active) {
            setIsMaximized(max);
            setIsFullscreen(full);
            setStoreMaximized(max);
            setStoreFullscreen(full);
          }
        });

        unlistenFocusRef.current = await win.onFocusChanged(
          ({ payload: focused }) => {
            if (active) {
              setIsFocused(focused);
              setStoreFocused(focused);
            }
          },
        );

        unlistenCloseRef.current = await win.onCloseRequested(async (event) => {
          const hasUnsavedChanges = checkGlobalUnsavedChanges();
          if (hasUnsavedChanges) {
            event.preventDefault();
            const confirmed = await window.confirm(
              "You have unsaved changes. Are you sure you want to close?",
            );
            if (confirmed) {
              await win.destroy();
            }
          }
        });
      } catch (e) {
        console.error("Failed to initialize Tauri window:", e);
      }
    };

    initTauri();

    return () => {
      active = false;
      unlistenResizeRef.current?.();
      unlistenFocusRef.current?.();
      unlistenCloseRef.current?.();
    };
  }, [mounted, setStoreMaximized, setStoreFullscreen, setStoreFocused]);

  const handleMinimize = useCallback(async () => {
    await appWindow?.minimize();
  }, [appWindow]);

  const handleMaximize = useCallback(async () => {
    await appWindow?.toggleMaximize();
  }, [appWindow]);

  const handleToggleFullscreen = useCallback(async () => {
    if (!appWindow) return;
    if (isFullscreen) {
      await appWindow.setFullscreen(false);
    } else {
      await appWindow.setFullscreen(true);
    }
  }, [appWindow, isFullscreen]);

  const handleCenter = useCallback(async () => {
    await appWindow?.center();
  }, [appWindow]);

  const handleToggleAlwaysOnTop = useCallback(async () => {
    if (!appWindow) return;
    const newValue = !isAlwaysOnTop;
    await appWindow.setAlwaysOnTop(newValue);
    setIsAlwaysOnTop(newValue);
    // Sync to tray backend so the CheckMenuItem stays in sync
    import('@/hooks/use-tray-sync').then(({ updateTrayAlwaysOnTop }) => {
      updateTrayAlwaysOnTop(newValue);
    }).catch(() => {});
  }, [appWindow, isAlwaysOnTop]);

  // Keyboard shortcuts (F11 fullscreen, Ctrl+Shift+T always-on-top)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!appWindow) return;

      if (e.key === "F11") {
        e.preventDefault();
        handleToggleFullscreen();
      }

      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault();
        handleToggleAlwaysOnTop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appWindow, handleToggleFullscreen, handleToggleAlwaysOnTop]);

  const handleClose = useCallback(async () => {
    if (appSettings.minimizeToTray) {
      await appWindow?.hide();
    } else {
      await appWindow?.close();
    }
  }, [appWindow, appSettings.minimizeToTray]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if ((e.target as HTMLElement).closest("[data-radix-menu-content]"))
        return;
      handleMaximize();
    },
    [handleMaximize],
  );

  const isTauriEnv = mounted && isTauri();
  const isWindows = mounted && isWindowsOS();

  const maximizePadding =
    isTauriEnv && isWindows && isMaximized ? WIN_MAXIMIZE_PADDING : 0;

  return {
    mounted,
    isTauriEnv,
    isWindows,
    appWindow,
    isMaximized,
    isFullscreen,
    isFocused,
    isAlwaysOnTop,
    maximizePadding,
    handleMinimize,
    handleMaximize,
    handleToggleFullscreen,
    handleCenter,
    handleToggleAlwaysOnTop,
    handleClose,
    handleDoubleClick,
  };
}
