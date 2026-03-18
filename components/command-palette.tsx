"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/providers/locale-provider";
import { useDesktopActionExecutor } from "@/hooks/use-desktop-action-executor";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useToolbox } from "@/hooks/use-toolbox";
import {
  getDesktopAction,
  type DesktopActionId,
} from "@/lib/desktop-actions";
import { isTauri } from "@/lib/tauri";
import { getToolboxDetailPath } from "@/lib/toolbox-route";
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
  const { allTools } = useToolbox();
  const [search, setSearch] = useState("");
  const executeDesktopAction = useDesktopActionExecutor({
    openCommandPalette: () => onOpenChange(true),
    openQuickSearch: () => onOpenChange(true),
  });

  const navigationItems = useMemo(
    () => [
      { href: "/", label: t("nav.dashboard") },
      { href: "/environments", label: t("nav.environments") },
      { href: "/packages", label: t("nav.packages") },
      { href: "/providers", label: t("nav.providers") },
      { href: "/cache", label: t("nav.cache") },
      { href: "/downloads", label: t("nav.downloads") },
      { href: "/wsl", label: t("nav.wsl") },
      { href: "/logs", label: t("nav.logs") },
      { href: "/settings", label: t("nav.settings") },
      { href: "/about", label: t("nav.about") },
      { href: "/docs", label: t("nav.docs") },
      { href: "/toolbox", label: t("nav.toolbox") },
    ],
    [t],
  );

  const actionItems = useMemo(() => {
    const ids: DesktopActionId[] = [
      "toggle_logs",
      "report_bug",
      "feature_request",
    ];

    if (isTauri()) {
      ids.push("manage_plugins", "install_plugin", "create_plugin");
    }

    return ids.map((id) => {
      const action = getDesktopAction(id);
      return {
        id,
        label: t(action.titleKey),
      };
    });
  }, [t]);

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
          {actionItems.map((action) => (
            <CommandItem
              key={action.id}
              value={action.label}
              onSelect={() => {
                void executeDesktopAction(action.id);
                closePalette();
              }}
            >
              {action.label}
              {action.id === "toggle_logs" && (
                <CommandShortcut>Ctrl+Shift+L</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        {allTools.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("commandPalette.groups.tools")}>
              {allTools.map((tool) => (
                <CommandItem
                  key={tool.id}
                  value={`${tool.name} ${tool.keywords.join(" ")}`}
                  onSelect={() => {
                    router.push(getToolboxDetailPath(tool.id));
                    closePalette();
                  }}
                >
                  {tool.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
