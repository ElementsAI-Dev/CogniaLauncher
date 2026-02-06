"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useAppearanceStore } from "@/lib/stores/appearance";
import { applyAccentColor } from "@/lib/theme/colors";

/**
 * Manages accent color application based on theme and user preferences.
 * This component subscribes to both theme changes and accent color changes.
 */
function AccentColorManager({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const { accentColor, reducedMotion } = useAppearanceStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    const isDark = resolvedTheme === "dark";
    applyAccentColor(accentColor, isDark);
  }, [resolvedTheme, accentColor, mounted]);

  React.useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    if (reducedMotion) {
      root.classList.add("no-transitions");
    } else {
      root.classList.remove("no-transitions");
    }
  }, [reducedMotion, mounted]);

  return <>{children}</>;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <AccentColorManager>{children}</AccentColorManager>
    </NextThemesProvider>
  );
}
