"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/components/providers/locale-provider";
import { useSettings } from "@/hooks/settings/use-settings";
import { isTauri } from "@/lib/tauri";
import { normalizeThemeMode, syncAppearanceConfigValue } from "@/lib/theme";
import type { ThemeMode } from "@/lib/theme/types";

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();
  const { updateConfigValue, fetchConfig } = useSettings();
  const { t } = useLocale();

  const handleThemeSelect = async (value: ThemeMode) => {
    const normalized = normalizeThemeMode(value);
    setTheme(normalized);

    if (isTauri()) {
      try {
        const canonical = await syncAppearanceConfigValue({
          key: "appearance.theme",
          value: normalized,
          updateConfigValue,
          fetchConfig,
        });
        setTheme(normalizeThemeMode(canonical));
      } catch (err) {
        console.error("Failed to sync theme to backend:", err);
      }
    }
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
        <Skeleton className="h-4 w-4 rounded-full" />
        <span className="sr-only">{t("theme.toggle")}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t("theme.toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => void handleThemeSelect(value as ThemeMode)}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-4 w-4" />
            {t("theme.light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-4 w-4" />
            {t("theme.dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-4 w-4" />
            {t("theme.system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
