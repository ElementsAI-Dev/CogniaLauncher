'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Minus, Square, X, Pin, PinOff, Maximize2, Move, MonitorUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isTauri } from '@/lib/tauri';
import { useSettingsStore } from '@/lib/stores/settings';
import { useLocale } from '@/components/providers/locale-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

type TauriWindow = Awaited<
  ReturnType<typeof import('@tauri-apps/api/window').getCurrentWindow>
>;

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
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
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
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        
        if (!active) return;
        
        setAppWindow(win);
        setIsDesktopMode(true);

        const [maximized, fullscreen, alwaysOnTop] = await Promise.all([
          win.isMaximized(),
          win.isFullscreen(),
          win.isAlwaysOnTop(),
        ]);
        
        if (!active) return;
          
        setIsMaximized(maximized);
        setIsFullscreen(fullscreen);
        setIsAlwaysOnTop(alwaysOnTop);

        unlistenResizeRef.current = await win.onResized(async () => {
          if (!active) return;
          const [max, full] = await Promise.all([
            win.isMaximized(),
            win.isFullscreen(),
          ]);
          if (active) {
            setIsMaximized(max);
            setIsFullscreen(full);
          }
        });

        unlistenFocusRef.current = await win.onFocusChanged(({ payload: focused }) => {
          if (active) {
            setIsFocused(focused);
          }
        });

        unlistenCloseRef.current = await win.onCloseRequested(async (event) => {
          const hasUnsavedChanges = checkGlobalUnsavedChanges();
          if (hasUnsavedChanges) {
            event.preventDefault();
            const confirmed = await window.confirm(
              'You have unsaved changes. Are you sure you want to close?'
            );
            if (confirmed) {
              await win.destroy();
            }
          }
        });

      } catch (e) {
        console.error('Failed to initialize Tauri window:', e);
      }
    };

    initTauri();

    return () => {
      active = false;
      unlistenResizeRef.current?.();
      unlistenFocusRef.current?.();
      unlistenCloseRef.current?.();
    };
  }, [mounted]);

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
      
      if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFullscreen();
      }
      
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        handleToggleAlwaysOnTop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appWindow, handleToggleFullscreen, handleToggleAlwaysOnTop]);

  const handleClose = useCallback(async () => {
    if (appSettings.minimizeToTray) {
      await appWindow?.hide();
    } else {
      await appWindow?.close();
    }
  }, [appWindow, appSettings.minimizeToTray]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('[data-radix-menu-content]')) return;
    handleMaximize();
  }, [handleMaximize]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  }, []);

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
    <>
      <div
        data-tauri-drag-region
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className={cn(
          'flex h-8 w-full select-none items-center justify-between border-b transition-opacity',
          isFocused 
            ? 'bg-background/80 backdrop-blur-sm' 
            : 'bg-background/60 backdrop-blur-sm opacity-80'
        )}
      >
        <div className="flex h-full flex-1 items-center gap-2 px-3">
          <div className="flex items-center gap-2">
            <svg
              className={cn(
                'h-4 w-4 transition-colors',
                isFocused ? 'text-primary' : 'text-muted-foreground'
              )}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className={cn(
              'text-xs font-medium transition-colors',
              isFocused ? 'text-muted-foreground' : 'text-muted-foreground/60'
            )}>
              CogniaLauncher
            </span>
            {isAlwaysOnTop && (
              <Pin className="h-3 w-3 text-primary" />
            )}
          </div>
        </div>

        <div className="flex h-full items-center">
          <button
            onClick={handleToggleAlwaysOnTop}
            className={cn(
              'inline-flex h-full w-11 items-center justify-center',
              'text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              isAlwaysOnTop && 'text-primary'
            )}
            aria-label={isAlwaysOnTop ? t('titlebar.unpinFromTop') : t('titlebar.pinOnTop')}
            title={`${isAlwaysOnTop ? t('titlebar.unpinFromTop') : t('titlebar.pinOnTop')} (Ctrl+Shift+T)`}
          >
            {isAlwaysOnTop ? (
              <PinOff className="h-3.5 w-3.5" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            onClick={handleMinimize}
            className={cn(
              'inline-flex h-full w-11 items-center justify-center',
              'text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground'
            )}
            aria-label={t('titlebar.minimize')}
            title={t('titlebar.minimize')}
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            onClick={handleMaximize}
            className={cn(
              'inline-flex h-full w-11 items-center justify-center',
              'text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground'
            )}
            aria-label={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
            title={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
          >
            {isMaximized ? (
              <RestoreIcon className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            onClick={handleClose}
            className={cn(
              'inline-flex h-full w-11 items-center justify-center',
              'text-muted-foreground transition-colors',
              'hover:bg-destructive hover:text-destructive-foreground'
            )}
            aria-label={t('titlebar.close')}
            title={appSettings.minimizeToTray ? t('titlebar.minimizeToTray') : t('titlebar.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <div
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
        />
        <DropdownMenuContent
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
          className="w-56"
        >
          <DropdownMenuItem onClick={handleMinimize}>
            <Minus className="h-4 w-4" />
            {t('titlebar.minimize')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMaximize}>
            {isMaximized ? (
              <>
                <RestoreIcon className="h-4 w-4" />
                {t('titlebar.restore')}
              </>
            ) : (
              <>
                <Square className="h-4 w-4" />
                {t('titlebar.maximize')}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggleFullscreen}>
            <Maximize2 className="h-4 w-4" />
            {t('titlebar.fullscreen')}
            <DropdownMenuShortcut>F11</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCenter}>
            <Move className="h-4 w-4" />
            {t('titlebar.centerWindow')}
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem
            checked={isAlwaysOnTop}
            onCheckedChange={handleToggleAlwaysOnTop}
          >
            <MonitorUp className="h-4 w-4" />
            {t('titlebar.alwaysOnTop')}
            <DropdownMenuShortcut>Ctrl+Shift+T</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleClose} variant="destructive">
            <X className="h-4 w-4" />
            {appSettings.minimizeToTray ? t('titlebar.minimizeToTray') : t('titlebar.close')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
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
  if (typeof window === 'undefined') return false;
  const event = new CustomEvent('cognia:check-unsaved', { 
    detail: { hasChanges: false },
    cancelable: true 
  });
  window.dispatchEvent(event);
  return (event as CustomEvent<{ hasChanges: boolean }>).detail.hasChanges;
}
