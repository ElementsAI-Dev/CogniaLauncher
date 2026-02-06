"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { Titlebar } from "@/components/layout/titlebar";
import { LogDrawer } from "@/components/log/log-drawer";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CommandPalette } from "@/components/command-palette";
import { useLocale } from "@/components/providers/locale-provider";
import { useLogStore } from "@/lib/stores/log";
import { useSettings } from "@/hooks/use-settings";
import { useAppearanceConfigSync } from "@/hooks/use-appearance-config-sync";
import { isTauri } from "@/lib/tauri";
import { ScrollText, Search } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

interface AppShellProps {
  children: ReactNode;
}

// Titlebar height in desktop mode (matches Titlebar h-8 = 2rem = 32px)
const TITLEBAR_HEIGHT = "2rem";

export function AppShell({ children }: AppShellProps) {
  const { toggleDrawer, getLogStats } = useLogStore();
  const { config, fetchConfig } = useSettings();
  const { t } = useLocale();
  const [commandOpen, setCommandOpen] = useState(false);
  const stats = getLogStats();
  const hasErrors = stats.byLevel.error > 0;

  // Check desktop mode - safe to call during render as it's synchronous
  const isDesktopMode = isTauri();

  useAppearanceConfigSync(config);

  useEffect(() => {
    if (!isTauri()) return;
    fetchConfig();
  }, [fetchConfig]);

  // Keyboard shortcut for opening log drawer (Ctrl+Shift+L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        toggleDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleDrawer]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider
          style={
            isDesktopMode
              ? ({
                  "--titlebar-height": TITLEBAR_HEIGHT,
                } as React.CSSProperties)
              : undefined
          }
        >
          <AppSidebar />
          <SidebarInset>
            <header
              data-tauri-drag-region
              className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6"
            >
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb />
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCommandOpen(true)}
                title={t("commandPalette.buttonLabel")}
              >
                <Search className="h-4 w-4" />
              </Button>
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
            <main className="flex-1 overflow-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <LogDrawer />
    </div>
  );
}
