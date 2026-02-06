"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/providers/locale-provider";
import { useLogStore } from "@/lib/stores/log";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { t } = useLocale();
  const { toggleDrawer } = useLogStore();
  const [search, setSearch] = useState("");

  const navigationItems = useMemo(
    () => [
      { href: "/", label: t("nav.dashboard") },
      { href: "/environments", label: t("nav.environments") },
      { href: "/packages", label: t("nav.packages") },
      { href: "/providers", label: t("nav.providers") },
      { href: "/cache", label: t("nav.cache") },
      { href: "/logs", label: t("nav.logs") },
      { href: "/settings", label: t("nav.settings") },
      { href: "/about", label: t("nav.about") },
    ],
    [t],
  );

  const closePalette = useCallback(() => {
    setSearch("");
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setSearch("");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "k",
        ctrlKey: true,
        action: () => onOpenChange(true),
        description: t("commandPalette.open"),
      },
    ],
  });

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder={t("commandPalette.placeholder")}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{t("commandPalette.noResults")}</CommandEmpty>
        <CommandGroup heading={t("commandPalette.groups.navigation")}>
          {navigationItems.map((item) => (
            <CommandItem
              key={item.href}
              value={item.label}
              onSelect={() => {
                router.push(item.href);
                closePalette();
              }}
            >
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("commandPalette.groups.actions")}>
          <CommandItem
            value={t("commandPalette.actions.toggleLogs")}
            onSelect={() => {
              toggleDrawer();
              closePalette();
            }}
          >
            {t("commandPalette.actions.toggleLogs")}
            <CommandShortcut>Ctrl+Shift+L</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
