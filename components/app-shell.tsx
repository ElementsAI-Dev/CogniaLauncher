'use client';

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { Titlebar } from '@/components/layout/titlebar';
import { LogDrawer } from '@/components/log/log-drawer';
import { Button } from '@/components/ui/button';
import { useLogStore } from '@/lib/stores/log';
import { ScrollText } from 'lucide-react';
import { ReactNode, useEffect } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { toggleDrawer, getLogStats } = useLogStore();
  const stats = getLogStats();
  const hasErrors = stats.byLevel.error > 0;

  // Keyboard shortcut for opening log drawer (Ctrl+Shift+L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        toggleDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDrawer]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8"
                onClick={toggleDrawer}
                title="Toggle logs (Ctrl+Shift+L)"
              >
                <ScrollText className="h-4 w-4" />
                {hasErrors && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
                )}
              </Button>
            </header>
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>
      <LogDrawer />
    </div>
  );
}
