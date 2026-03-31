"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { isTauri, isWindows as isWindowsOS } from "@/lib/platform";
import { useSettingsStore } from "@/lib/stores/settings";
import { useWindowStateStore } from "@/lib/stores/window-state";

type TauriWindow = Awaited<
  ReturnType<typeof import("@tauri-apps/api/window").getCurrentWindow>
>;

/**
 * Guard rails for Windows frameless maximize compensation.
 */
const MAX_WINDOW_INSET_PX = 32;
const MAXIMIZE_INSET_TOLERANCE_DIP = 1;
export interface MaximizeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const ZERO_MAXIMIZE_INSETS: MaximizeInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function clampInset(value: number): number {
  return Math.min(MAX_WINDOW_INSET_PX, Math.max(0, value));
}

function normalizeInset(value: number): number {
  const clamped = clampInset(value);
  return clamped <= MAXIMIZE_INSET_TOLERANCE_DIP ? 0 : clamped;
}

function shouldZeroSymmetricInsets(insets: MaximizeInsets): boolean {
  const values = [insets.top, insets.right, insets.bottom, insets.left];
  const max = Math.max(...values);
  const min = Math.min(...values);

  return max > 0 && min > 0 && max - min <= MAXIMIZE_INSET_TOLERANCE_DIP;
}

function shouldZeroFourEdgeInsets(insets: MaximizeInsets): boolean {
  return (
    insets.top > 0 && insets.right > 0 && insets.bottom > 0 && insets.left > 0
  );
}

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type MonitorLike = {
  position: { x: number; y: number };
  size: { width: number; height: number };
};

function getRectFromPositionSize(
  position: { x: number; y: number },
  size: { width: number; height: number },
): Rect {
  return {
    left: position.x,
    top: position.y,
    right: position.x + size.width,
    bottom: position.y + size.height,
  };
}

function getMonitorRect(monitor: MonitorLike): Rect {
  const { position, size } = monitor;
  return getRectFromPositionSize(position, size);
}

function getIntersectionArea(a: Rect, b: Rect): number {
  const overlapWidth = Math.max(
    0,
    Math.min(a.right, b.right) - Math.max(a.left, b.left),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  );
  return overlapWidth * overlapHeight;
}

function resolveBestMonitorForWindow(
  windowRect: Rect,
  current: MonitorLike | null,
  allMonitors: MonitorLike[],
): MonitorLike | null {
  let bestMonitor: MonitorLike | null = null;
  let bestArea = 0;

  if (current) {
    const currentArea = getIntersectionArea(
      windowRect,
      getMonitorRect(current),
    );
    if (currentArea > 0) {
      bestMonitor = current;
      bestArea = currentArea;
    }
  }

  for (const monitor of allMonitors) {
    const area = getIntersectionArea(windowRect, getMonitorRect(monitor));
    if (area > bestArea) {
      bestArea = area;
      bestMonitor = monitor;
    }
  }

  return bestMonitor;
}

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
  /** Per-edge padding compensation for Windows frameless maximize clipping */
  maximizeInsets: MaximizeInsets;
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
  const [maximizeInsets, setMaximizeInsets] =
    useState<MaximizeInsets>(ZERO_MAXIMIZE_INSETS);
  const [maximizePadding, setMaximizePadding] = useState(0);

  const unlistenResizeRef = useRef<(() => void) | null>(null);
  const unlistenMovedRef = useRef<(() => void) | null>(null);
  const unlistenScaleRef = useRef<(() => void) | null>(null);
  const unlistenFocusRef = useRef<(() => void) | null>(null);
  const unlistenCloseRef = useRef<(() => void) | null>(null);
  const hasResolvedMonitorRef = useRef(false);

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
        const {
          getCurrentWindow,
          currentMonitor,
          availableMonitors,
          monitorFromPoint,
        } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();

        if (!active) return;

        const syncMaximizePadding = async (
          maximized: boolean,
          fullscreen: boolean,
        ) => {
          if (!active) return;
          if (!isWindowsOS() || !maximized || fullscreen) {
            setMaximizeInsets(ZERO_MAXIMIZE_INSETS);
            setMaximizePadding(0);
            return;
          }

          try {
            const [
              outerPosition,
              innerPosition,
              outerSize,
              innerSize,
              monitor,
              monitors,
              scaleFactor,
            ] = await Promise.all([
              win.outerPosition(),
              win.innerPosition(),
              win.outerSize(),
              win.innerSize(),
              currentMonitor(),
              availableMonitors(),
              win.scaleFactor(),
            ]);

            if (!active) return;

            const windowLeft = outerPosition.x;
            const windowTop = outerPosition.y;
            const windowRight = windowLeft + outerSize.width;
            const windowBottom = windowTop + outerSize.height;
            const windowRect = {
              left: windowLeft,
              top: windowTop,
              right: windowRight,
              bottom: windowBottom,
            };
            let resolvedMonitor = resolveBestMonitorForWindow(
              windowRect,
              (monitor as MonitorLike | null) ?? null,
              (monitors as MonitorLike[]) ?? [],
            );
            if (!resolvedMonitor) {
              const centerX = Math.round(windowLeft + outerSize.width / 2);
              const centerY = Math.round(windowTop + outerSize.height / 2);
              try {
                resolvedMonitor =
                  ((await monitorFromPoint(
                    centerX,
                    centerY,
                  )) as MonitorLike | null) ?? null;
              } catch {
                resolvedMonitor = null;
              }
            }
            if (resolvedMonitor) {
              hasResolvedMonitorRef.current = true;
            }

            const monitorRect = resolvedMonitor
              ? getMonitorRect(resolvedMonitor)
              : windowRect;
            const monitorLeft = monitorRect.left;
            const monitorTop = monitorRect.top;
            const monitorRight = monitorRect.right;
            const monitorBottom = monitorRect.bottom;

            const safeScaleFactor = scaleFactor > 0 ? scaleFactor : 1;
            const innerLeft = innerPosition.x;
            const innerTop = innerPosition.y;
            const innerRight = innerLeft + innerSize.width;
            const innerBottom = innerTop + innerSize.height;
            const frameInsetX = Math.max(
              0,
              Math.round(
                (outerSize.width - innerSize.width) / 2 / safeScaleFactor,
              ),
            );
            const frameInsetY = Math.max(
              0,
              Math.round(
                (outerSize.height - innerSize.height) / 2 / safeScaleFactor,
              ),
            );
            const innerOvershootInsets: MaximizeInsets = {
              top: normalizeInset(
                Math.round(
                  Math.max(0, monitorTop - innerTop) / safeScaleFactor,
                ),
              ),
              right: normalizeInset(
                Math.round(
                  Math.max(0, innerRight - monitorRight) / safeScaleFactor,
                ),
              ),
              bottom: normalizeInset(
                Math.round(
                  Math.max(0, innerBottom - monitorBottom) / safeScaleFactor,
                ),
              ),
              left: normalizeInset(
                Math.round(
                  Math.max(0, monitorLeft - innerLeft) / safeScaleFactor,
                ),
              ),
            };

            const frameInsetsFallback: MaximizeInsets =
              frameInsetX > 0 || frameInsetY > 0
                ? {
                    top: normalizeInset(frameInsetY),
                    right: normalizeInset(frameInsetX),
                    bottom: normalizeInset(frameInsetY),
                    left: normalizeInset(frameInsetX),
                  }
                : {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                  };

            const hasInnerOvershoot =
              innerOvershootInsets.top > 0 ||
              innerOvershootInsets.right > 0 ||
              innerOvershootInsets.bottom > 0 ||
              innerOvershootInsets.left > 0;
            const resolvedInsets: MaximizeInsets = resolvedMonitor
              ? hasInnerOvershoot
                ? innerOvershootInsets
                : ZERO_MAXIMIZE_INSETS
              : frameInsetsFallback;
            const shouldZeroInsetsFromGeometry =
              resolvedMonitor &&
              (shouldZeroSymmetricInsets(resolvedInsets) ||
                shouldZeroFourEdgeInsets(resolvedInsets));
            const shouldZeroInsetsFromTransientFallback =
              !resolvedMonitor &&
              (shouldZeroFourEdgeInsets(frameInsetsFallback) ||
                (hasResolvedMonitorRef.current &&
                  shouldZeroSymmetricInsets(frameInsetsFallback)));
            const nextInsets =
              shouldZeroInsetsFromGeometry ||
              shouldZeroInsetsFromTransientFallback
                ? ZERO_MAXIMIZE_INSETS
                : resolvedInsets;
            const nextPadding = clampInset(
              Math.max(
                nextInsets.top,
                nextInsets.right,
                nextInsets.bottom,
                nextInsets.left,
              ),
            );

            setMaximizeInsets(nextInsets);
            setMaximizePadding(nextPadding);
          } catch {
            if (active) {
              // Be conservative on runtime API failures to avoid forcing a visible
              // artificial border on users with multi-monitor DPI edge cases.
              setMaximizeInsets(ZERO_MAXIMIZE_INSETS);
              setMaximizePadding(0);
            }
          }
        };

        const refreshWindowState = async () => {
          if (!active) return;
          const [max, full] = await Promise.all([
            win.isMaximized(),
            win.isFullscreen(),
          ]);
          if (!active) return;
          setIsMaximized(max);
          setIsFullscreen(full);
          setStoreMaximized(max);
          setStoreFullscreen(full);
          await syncMaximizePadding(max, full);
        };

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
        await syncMaximizePadding(maximized, fullscreen);

        unlistenResizeRef.current = await win.onResized(refreshWindowState);
        unlistenMovedRef.current = await win.onMoved(refreshWindowState);
        unlistenScaleRef.current = await win.onScaleChanged(refreshWindowState);

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
      unlistenMovedRef.current?.();
      unlistenScaleRef.current?.();
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
    import("@/hooks/desktop/use-tray-sync")
      .then(({ updateTrayAlwaysOnTop }) => {
        updateTrayAlwaysOnTop(newValue);
      })
      .catch(() => {});
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

  return {
    mounted,
    isTauriEnv,
    isWindows,
    appWindow,
    isMaximized,
    isFullscreen,
    isFocused,
    isAlwaysOnTop,
    maximizeInsets,
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
