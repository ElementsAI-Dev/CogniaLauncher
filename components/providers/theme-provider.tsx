"use client";

import { type ReactNode, type ComponentProps, useEffect, useRef, useSyncExternalStore } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useAppearanceStore } from "@/lib/stores/appearance";
import { applyAccentColor, applyChartColorTheme } from "@/lib/theme/colors";
import { BG_CHANGE_EVENT, getBackgroundImage } from "@/lib/theme/background";

const emptyUnsubscribe = () => {};

function subscribeBackgroundImageChange(callback: () => void) {
  if (typeof window === "undefined") return emptyUnsubscribe;
  window.addEventListener(BG_CHANGE_EVENT, callback);
  return () => window.removeEventListener(BG_CHANGE_EVENT, callback);
}

/**
 * Manages accent color application based on theme and user preferences.
 * This component subscribes to both theme changes and accent color changes.
 */
function AccentColorManager({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const { accentColor, chartColorTheme, interfaceRadius, interfaceDensity, reducedMotion, setReducedMotion, backgroundEnabled } = useAppearanceStore();
  const osMotionSynced = useRef(false);
  const hasBackgroundImage = useSyncExternalStore(
    subscribeBackgroundImageChange,
    () => getBackgroundImage() !== null,
    () => false,
  );

  // Sync OS-level prefers-reduced-motion on first mount (only if user hasn't explicitly set it)
  useEffect(() => {
    if (osMotionSynced.current) return;
    osMotionSynced.current = true;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches && !reducedMotion) {
      setReducedMotion(true);
    }

    const handler = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [reducedMotion, setReducedMotion]);

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    applyAccentColor(accentColor, isDark);
  }, [resolvedTheme, accentColor]);

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    applyChartColorTheme(chartColorTheme, isDark);
  }, [resolvedTheme, chartColorTheme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--radius", `${interfaceRadius}rem`);
  }, [interfaceRadius]);

  useEffect(() => {
    document.documentElement.dataset.density = interfaceDensity;
  }, [interfaceDensity]);

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.classList.add("no-transitions");
    } else {
      root.classList.remove("no-transitions");
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (backgroundEnabled && hasBackgroundImage) {
      document.documentElement.dataset.bgActive = "";
    } else {
      delete document.documentElement.dataset.bgActive;
    }
  }, [backgroundEnabled, hasBackgroundImage]);

  return <>{children}</>;
}

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <AccentColorManager>{children}</AccentColorManager>
    </NextThemesProvider>
  );
}
