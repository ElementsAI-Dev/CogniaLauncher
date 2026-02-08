"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Minus,
  Square,
  X,
  Pin,
  PinOff,
  Maximize2,
  Move,
  MonitorUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import { useSettingsStore } from "@/lib/stores/settings";
import { useWindowStateStore } from "@/lib/stores/window-state";
import { useLocale } from "@/components/providers/locale-provider";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuCheckboxItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

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

export function Titlebar() {
  const { appSettings } = useSettingsStore();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [appWindow, setAppWindow] = useState<TauriWindow | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const windowStateStore = useWindowStateStore();

  const unlistenResizeRef = useRef<(() => void) | null>(null);
  const unlistenFocusRef = useRef<(() => void) | null>(null);
  const unlistenCloseRef = useRef<(() => void) | null>(null);

  // Handle hydration - only render after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let active = true;

    const initTauri = async () => {
      // Use the shared isTauri() detection from lib/tauri
      if (!isTauri()) return;

      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();

        if (!active) return;

        setAppWindow(win);
        setIsDesktopMode(true);
        windowStateStore.setDesktopMode(true);

        // Detect Windows for maximize padding compensation
        // Use navigator.platform/userAgent which is reliable in Tauri webview
        const detectedWindows =
          navigator.userAgent.includes("Windows") ||
          navigator.platform?.startsWith("Win");
        setIsWindows(detectedWindows);
        windowStateStore.setWindows(detectedWindows);

        const [maximized, fullscreen, alwaysOnTop] = await Promise.all([
          win.isMaximized(),
          win.isFullscreen(),
          win.isAlwaysOnTop(),
        ]);

        if (!active) return;

        setIsMaximized(maximized);
        setIsFullscreen(fullscreen);
        setIsAlwaysOnTop(alwaysOnTop);
        windowStateStore.setMaximized(maximized);
        windowStateStore.setFullscreen(fullscreen);

        unlistenResizeRef.current = await win.onResized(async () => {
          if (!active) return;
          const [max, full] = await Promise.all([
            win.isMaximized(),
            win.isFullscreen(),
          ]);
          if (active) {
            setIsMaximized(max);
            setIsFullscreen(full);
            windowStateStore.setMaximized(max);
            windowStateStore.setFullscreen(full);
          }
        });

        unlistenFocusRef.current = await win.onFocusChanged(
          ({ payload: focused }) => {
            if (active) {
              setIsFocused(focused);
              windowStateStore.setFocused(focused);
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
  }, [mounted, windowStateStore]);

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
  }, [appWindow, isAlwaysOnTop]);

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

  // Maximize padding: on Windows frameless, maximized windows need padding
  // to prevent content clipping by the invisible thick-frame border
  const maximizePadding =
    isDesktopMode && isWindows && isMaximized ? WIN_MAXIMIZE_PADDING : 0;

  // Don't render on server or before hydration
  if (!mounted) {
    return null;
  }

  // Don't render if not in desktop (Tauri) mode
  if (!isDesktopMode) {
    return null;
  }

  // Hide titlebar in fullscreen mode
  if (isFullscreen) {
    return null;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-tauri-drag-region
          onDoubleClick={handleDoubleClick}
          className={cn(
            "flex w-full select-none items-center justify-between border-b transition-opacity",
            isFocused
              ? "bg-background/80 backdrop-blur-sm"
              : "bg-background/60 backdrop-blur-sm opacity-80",
          )}
          style={{
            height: `calc(2rem + ${maximizePadding}px)`,
            paddingTop: maximizePadding,
            paddingLeft: maximizePadding,
            paddingRight: maximizePadding,
          }}
        >
          <div className="flex h-full flex-1 items-center gap-2 px-3">
            <div className="flex items-center gap-2">
              <svg
                className={cn(
                  "h-4 w-4 transition-colors",
                  isFocused ? "text-primary" : "text-muted-foreground",
                )}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  isFocused
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60",
                )}
              >
                CogniaLauncher
              </span>
              {isAlwaysOnTop && <Pin className="h-3 w-3 text-primary" />}
            </div>
          </div>

          <div className="flex h-full items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleAlwaysOnTop}
                  className={cn(
                    "inline-flex h-full w-11 items-center justify-center",
                    "text-muted-foreground transition-colors",
                    "hover:bg-muted hover:text-foreground",
                    isAlwaysOnTop && "text-primary",
                  )}
                  aria-label={
                    isAlwaysOnTop
                      ? t("titlebar.unpinFromTop")
                      : t("titlebar.pinOnTop")
                  }
                >
                  {isAlwaysOnTop ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isAlwaysOnTop ? t("titlebar.unpinFromTop") : t("titlebar.pinOnTop")} (Ctrl+Shift+T)
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleMinimize}
                  className={cn(
                    "inline-flex h-full w-11 items-center justify-center",
                    "text-muted-foreground transition-colors",
                    "hover:bg-muted hover:text-foreground",
                  )}
                  aria-label={t("titlebar.minimize")}
                >
                  <Minus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("titlebar.minimize")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleMaximize}
                  className={cn(
                    "inline-flex h-full w-11 items-center justify-center",
                    "text-muted-foreground transition-colors",
                    "hover:bg-muted hover:text-foreground",
                  )}
                  aria-label={
                    isMaximized ? t("titlebar.restore") : t("titlebar.maximize")
                  }
                >
                  {isMaximized ? (
                    <RestoreIcon className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isMaximized ? t("titlebar.restore") : t("titlebar.maximize")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClose}
                  className={cn(
                    "inline-flex h-full w-11 items-center justify-center",
                    "text-muted-foreground transition-colors",
                    "hover:bg-destructive hover:text-destructive-foreground",
                  )}
                  aria-label={t("titlebar.close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {appSettings.minimizeToTray
                  ? t("titlebar.minimizeToTray")
                  : t("titlebar.close")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleMinimize}>
          <Minus className="h-4 w-4" />
          {t("titlebar.minimize")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMaximize}>
          {isMaximized ? (
            <>
              <RestoreIcon className="h-4 w-4" />
              {t("titlebar.restore")}
            </>
          ) : (
            <>
              <Square className="h-4 w-4" />
              {t("titlebar.maximize")}
            </>
          )}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleToggleFullscreen}>
          <Maximize2 className="h-4 w-4" />
          {t("titlebar.fullscreen")}
          <ContextMenuShortcut>F11</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCenter}>
          <Move className="h-4 w-4" />
          {t("titlebar.centerWindow")}
        </ContextMenuItem>
        <ContextMenuCheckboxItem
          checked={isAlwaysOnTop}
          onCheckedChange={handleToggleAlwaysOnTop}
        >
          <MonitorUp className="h-4 w-4" />
          {t("titlebar.alwaysOnTop")}
          <ContextMenuShortcut>Ctrl+Shift+T</ContextMenuShortcut>
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleClose} variant="destructive">
          <X className="h-4 w-4" />
          {appSettings.minimizeToTray
            ? t("titlebar.minimizeToTray")
            : t("titlebar.close")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M2 0h6v6H2z" transform="translate(1.5, 1.5)" />
      <path d="M0 2h6v6H0z" transform="translate(0, 0)" />
    </svg>
  );
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
