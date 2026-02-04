'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settings';

type TauriWindow = Awaited<
  ReturnType<typeof import('@tauri-apps/api/window').getCurrentWindow>
>;

export function Titlebar() {
  const { appSettings } = useSettingsStore();
  const [appWindow, setAppWindow] = useState<TauriWindow | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isTauri, setIsTauri] = useState(false);
  
  const unlistenResizeRef = useRef<(() => void) | null>(null);
  const unlistenFocusRef = useRef<(() => void) | null>(null);
  const unlistenCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;

    const initTauri = async () => {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          
          if (!mounted) return;
          
          setAppWindow(win);
          setIsTauri(true);

          const [maximized, fullscreen] = await Promise.all([
            win.isMaximized(),
            win.isFullscreen(),
          ]);
          
          if (!mounted) return;
          
          setIsMaximized(maximized);
          setIsFullscreen(fullscreen);

          unlistenResizeRef.current = await win.onResized(async () => {
            if (!mounted) return;
            const [max, full] = await Promise.all([
              win.isMaximized(),
              win.isFullscreen(),
            ]);
            if (mounted) {
              setIsMaximized(max);
              setIsFullscreen(full);
            }
          });

          unlistenFocusRef.current = await win.onFocusChanged(({ payload: focused }) => {
            if (mounted) {
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
      }
    };

    initTauri();

    return () => {
      mounted = false;
      unlistenResizeRef.current?.();
      unlistenFocusRef.current?.();
      unlistenCloseRef.current?.();
    };
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11' && appWindow) {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appWindow, handleToggleFullscreen]);

  const handleClose = useCallback(async () => {
    if (appSettings.minimizeToTray) {
      await appWindow?.hide();
    } else {
      await appWindow?.close();
    }
  }, [appWindow, appSettings.minimizeToTray]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    handleMaximize();
  }, [handleMaximize]);

  if (!isTauri) {
    return null;
  }

  if (isFullscreen) {
    return null;
  }

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
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
        </div>
      </div>

      <div className="flex h-full items-center">
        <button
          onClick={handleMinimize}
          className={cn(
            'inline-flex h-full w-11 items-center justify-center',
            'text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground'
          )}
          aria-label="Minimize"
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
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
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
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
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
