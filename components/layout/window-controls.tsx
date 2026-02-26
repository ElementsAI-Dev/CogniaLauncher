"use client";

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
import { useLocale } from "@/components/providers/locale-provider";
import { useSettingsStore } from "@/lib/stores/settings";
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
import type { WindowControlsState } from "@/hooks/use-window-controls";

interface WindowControlsProps {
  controls: WindowControlsState;
}

/**
 * Compact window control buttons (pin, minimize, maximize, close)
 * designed to be embedded in the app header bar.
 */
export function WindowControls({ controls }: WindowControlsProps) {
  const { t } = useLocale();
  const { appSettings } = useSettingsStore();
  const {
    appWindow,
    isMaximized,
    isFullscreen,
    isAlwaysOnTop,
    handleMinimize,
    handleMaximize,
    handleToggleFullscreen,
    handleCenter,
    handleToggleAlwaysOnTop,
    handleClose,
  } = controls;

  if (isFullscreen) return null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex h-full items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleToggleAlwaysOnTop}
                disabled={!appWindow}
                className={cn(
                  "inline-flex h-8 w-9 items-center justify-center rounded-sm",
                  "text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "disabled:opacity-30 disabled:pointer-events-none",
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
              {isAlwaysOnTop
                ? t("titlebar.unpinFromTop")
                : t("titlebar.pinOnTop")}{" "}
              (Ctrl+Shift+T)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleMinimize}
                disabled={!appWindow}
                className={cn(
                  "inline-flex h-8 w-9 items-center justify-center rounded-sm",
                  "text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "disabled:opacity-30 disabled:pointer-events-none",
                )}
                aria-label={t("titlebar.minimize")}
              >
                <Minus className="h-3.5 w-3.5" />
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
                disabled={!appWindow}
                className={cn(
                  "inline-flex h-8 w-9 items-center justify-center rounded-sm",
                  "text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "disabled:opacity-30 disabled:pointer-events-none",
                )}
                aria-label={
                  isMaximized
                    ? t("titlebar.restore")
                    : t("titlebar.maximize")
                }
              >
                {isMaximized ? (
                  <RestoreIcon className="h-3 w-3" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isMaximized
                ? t("titlebar.restore")
                : t("titlebar.maximize")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleClose}
                disabled={!appWindow}
                className={cn(
                  "inline-flex h-8 w-9 items-center justify-center rounded-sm",
                  "text-muted-foreground transition-colors",
                  "hover:bg-destructive hover:text-destructive-foreground",
                  "disabled:opacity-30 disabled:pointer-events-none",
                )}
                aria-label={t("titlebar.close")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {appSettings.minimizeToTray
                ? t("titlebar.minimizeToTray")
                : t("titlebar.close")}
            </TooltipContent>
          </Tooltip>
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
