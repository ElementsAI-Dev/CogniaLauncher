"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/components/providers/locale-provider";
import type { InitPhase } from "@/hooks/use-app-init";

interface SplashScreenProps {
  phase: InitPhase;
  progress: number;
  message: string;
  version: string | null;
  onTransitionEnd?: () => void;
}

export function SplashScreen({
  phase,
  progress,
  message,
  version,
  onTransitionEnd,
}: SplashScreenProps) {
  const { t } = useLocale();
  const [fadeOut, setFadeOut] = useState(false);
  const isReady = phase === "ready" || phase === "web-mode";

  useEffect(() => {
    if (isReady) {
      // Brief delay so the user sees 100% before fade-out
      const timer = setTimeout(() => setFadeOut(true), 400);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  useEffect(() => {
    if (!fadeOut) return;
    const timer = setTimeout(() => {
      onTransitionEnd?.();
    }, 500); // matches CSS fade-out duration
    return () => clearTimeout(timer);
  }, [fadeOut, onTransitionEnd]);

  return (
    <div
      className={cn(
        "splash-screen fixed inset-0 z-[9999] flex flex-col items-center justify-center",
        "bg-background transition-all duration-500 ease-out",
        fadeOut && "opacity-0 scale-105 pointer-events-none"
      )}
      role="status"
      aria-live="polite"
      aria-label={t("splash.loading")}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="splash-orb splash-orb-1" />
        <div className="splash-orb splash-orb-2" />
        <div className="splash-orb splash-orb-3" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Animated logo */}
        <div className="splash-logo-container relative">
          {/* Spinning ring */}
          <div
            className={cn(
              "splash-ring absolute inset-0 rounded-full",
              isReady && "splash-ring-done"
            )}
          />
          {/* Logo icon */}
          <div className="splash-logo relative flex items-center justify-center w-20 h-20">
            <svg
              className="w-10 h-10 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>

        {/* App name with typing effect */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="splash-title text-2xl font-bold tracking-tight text-foreground">
            CogniaLauncher
          </h1>
          {version && (
            <span className="splash-version text-xs font-medium text-muted-foreground">
              v{version}
            </span>
          )}
        </div>

        {/* Progress section */}
        <div className="flex flex-col items-center gap-3 w-64">
          {/* Progress bar */}
          <Progress value={progress} className="h-1" />

          {/* Status message */}
          <p className="splash-message text-xs text-muted-foreground text-center transition-opacity duration-200">
            {t(message)}
          </p>
        </div>
      </div>
    </div>
  );
}
