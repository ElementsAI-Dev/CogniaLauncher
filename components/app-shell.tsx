"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { WindowControls } from "@/components/layout/window-controls";
import { useWindowControls } from "@/hooks/use-window-controls";
import { BackgroundImage } from "@/components/layout/background-image";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LogDrawer } from "@/components/log/log-drawer";
import { CrashRecoveryDialog } from "@/components/crash-recovery-dialog";
import { FeedbackDialog } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { SplashScreen } from "@/components/splash-screen";
import { OnboardingWizard, TourOverlay, BubbleHintLayer } from "@/components/onboarding";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/providers/locale-provider";
import { useLogStore } from "@/lib/stores/log";
import { useSettings } from "@/hooks/use-settings";
import { useAppearanceConfigSync } from "@/hooks/use-appearance-config-sync";
import { useAppInit } from "@/hooks/use-app-init";
import { useOnboarding } from "@/hooks/use-onboarding";
import { isTauri } from "@/lib/platform";
import { ScrollText, Search } from "lucide-react";
import { ReactNode, useCallback, useEffect, useState } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { toggleDrawer, getLogStats } = useLogStore();
  const { config, fetchConfig } = useSettings();
  const { t } = useLocale();
  const [commandOpen, setCommandOpen] = useState(false);
  const stats = getLogStats();
  const hasErrors = stats.byLevel.error > 0;

  // App initialization state
  const { phase, progress, message, version, isReady } = useAppInit();
  const [splashDismissed, setSplashDismissed] = useState(false);

  const handleSplashTransitionEnd = useCallback(() => {
    setSplashDismissed(true);
  }, []);

  // Check desktop mode - safe to call during render as it's synchronous
  const isDesktopMode = isTauri();

  // Window controls (Tauri window management, maximize padding, etc.)
  const windowControls = useWindowControls();
  const { maximizePadding, isTauriEnv, isFullscreen } = windowControls;

  useAppearanceConfigSync(config);

  useEffect(() => {
    if (!isDesktopMode) return;
    fetchConfig();
  }, [isDesktopMode, fetchConfig]);

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

  // Onboarding state
  const onboarding = useOnboarding();

  // Show splash screen during Tauri initialization
  const showSplash = isDesktopMode && !splashDismissed;

  return (
    <>
      {showSplash && (
        <SplashScreen
          phase={phase}
          progress={progress}
          message={message}
          version={version}
          onTransitionEnd={handleSplashTransitionEnd}
        />
      )}
      <div
        className="flex h-screen flex-col overflow-hidden"
        style={{ visibility: showSplash && !isReady ? "hidden" : "visible" }}
      >
        <BackgroundImage />
        <div
          className="flex flex-1 overflow-hidden"
          style={
            maximizePadding > 0
              ? {
                  paddingTop: maximizePadding,
                  paddingLeft: maximizePadding,
                  paddingRight: maximizePadding,
                  paddingBottom: maximizePadding,
                }
              : undefined
          }
        >
          <SidebarProvider
            className={isDesktopMode ? "min-h-0" : undefined}
          >
            <AppSidebar />
            <SidebarInset>
              <header
                data-tauri-drag-region
                onDoubleClick={isTauriEnv ? windowControls.handleDoubleClick : undefined}
                className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:px-6"
              >
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumb />
                <div className="flex-1" />
                <ThemeToggle />
                <LanguageToggle />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCommandOpen(true)}
                      data-tour="command-palette-btn"
                    >
                      <Search className="h-4 w-4" />
                      <span className="sr-only">{t("commandPalette.buttonLabel")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("commandPalette.buttonLabel")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-8 w-8"
                      onClick={toggleDrawer}
                    >
                      <ScrollText className="h-4 w-4" />
                      {hasErrors && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
                      )}
                      <span className="sr-only">{t("commandPalette.toggleLogs")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle logs (Ctrl+Shift+L)</TooltipContent>
                </Tooltip>
                {isTauriEnv && !isFullscreen && (
                  <>
                    <Separator orientation="vertical" className="mx-1 h-4" />
                    <WindowControls controls={windowControls} />
                  </>
                )}
              </header>
              <main className="flex-1 overflow-auto">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </div>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        <LogDrawer />
        <CrashRecoveryDialog t={t} />
        <FeedbackDialog />

        {/* Onboarding wizard - shown on first run or when re-triggered from settings */}
        <OnboardingWizard
          open={onboarding.shouldShowWizard}
          currentStep={onboarding.currentStep}
          totalSteps={onboarding.totalSteps}
          progress={onboarding.progress}
          isFirstStep={onboarding.isFirstStep}
          isLastStep={onboarding.isLastStep}
          tourCompleted={onboarding.tourCompleted}
          onNext={onboarding.next}
          onPrev={onboarding.prev}
          onGoTo={onboarding.goTo}
          onComplete={onboarding.complete}
          onSkip={onboarding.skip}
          onStartTour={onboarding.startTour}
          onClose={onboarding.closeWizard}
        />

        {/* Guided tour overlay */}
        <TourOverlay
          active={onboarding.tourActive}
          currentStep={onboarding.tourStep}
          onNext={onboarding.nextTourStep}
          onPrev={onboarding.prevTourStep}
          onComplete={onboarding.completeTour}
          onStop={onboarding.stopTour}
        />

        {/* Contextual bubble hints — non-blocking floating tips */}
        <BubbleHintLayer />
      </div>
    </>
  );
}
