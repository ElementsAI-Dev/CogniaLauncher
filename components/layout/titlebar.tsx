'use client';

import { useEffect, useState } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Titlebar() {
  const [appWindow, setAppWindow] = useState<Awaited<
    ReturnType<typeof import('@tauri-apps/api/window').getCurrentWindow>
  > | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    const initTauri = async () => {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          setAppWindow(win);
          setIsTauri(true);

          const maximized = await win.isMaximized();
          setIsMaximized(maximized);

          const unlisten = await win.onResized(async () => {
            const maximized = await win.isMaximized();
            setIsMaximized(maximized);
          });

          return () => {
            unlisten();
          };
        } catch (e) {
          console.error('Failed to initialize Tauri window:', e);
        }
      }
    };

    initTauri();
  }, []);

  const handleMinimize = async () => {
    await appWindow?.minimize();
  };

  const handleMaximize = async () => {
    await appWindow?.toggleMaximize();
  };

  const handleClose = async () => {
    await appWindow?.close();
  };

  if (!isTauri) {
    return null;
  }

  return (
    <div
      data-tauri-drag-region
      className="flex h-8 w-full select-none items-center justify-between bg-background/80 backdrop-blur-sm border-b"
    >
      <div
        className="flex h-full flex-1 items-center gap-2 px-3"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="text-xs font-medium text-muted-foreground">
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
            <Copy className="h-3.5 w-3.5" />
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
