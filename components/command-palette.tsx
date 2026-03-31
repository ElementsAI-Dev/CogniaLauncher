"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/providers/locale-provider";
import { useDesktopActionExecutor } from "@/hooks/desktop/use-desktop-action-executor";
import { useKeyboardShortcuts } from "@/hooks/shared/use-keyboard-shortcuts";
import { useToolbox } from "@/hooks/toolbox/use-toolbox";
import { useWsl } from "@/hooks/wsl/use-wsl";
import { useTerminalStore } from "@/lib/stores/terminal";
import {
  getDesktopAction,
  type DesktopActionId,
} from "@/lib/desktop-actions";
import { isTauri, terminalLaunchProfile } from "@/lib/tauri";
import { isWindows } from "@/lib/platform";
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
  const { available, checkAvailability, refreshStatus, refreshDistros, status, distros } = useWsl();
  const terminalProfiles = useTerminalStore((state) => state.profiles);
  const hydrateTerminalStore = useTerminalStore((state) => state.hydrate);
  const markProfileLaunched = useTerminalStore((state) => state.markProfileLaunched);
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
      { href: "/terminal", label: t("nav.terminal") },
      { href: "/wsl", label: t("nav.wsl") },
      { href: "/logs", label: t("nav.logs") },
      { href: "/settings", label: t("nav.settings") },
      { href: "/about", label: t("nav.about") },
      { href: "/docs", label: t("nav.docs") },
      { href: "/toolbox", label: t("nav.toolbox") },
    ],
    [t],
  );

  useEffect(() => {
    if (!open || !isTauri() || terminalProfiles.length > 0) return;
    void hydrateTerminalStore();
  }, [hydrateTerminalStore, open, terminalProfiles.length]);

  useEffect(() => {
    if (!open || !isTauri() || !isWindows()) return;
    void (async () => {
      const wslAvailable = available ?? await checkAvailability();
      if (!wslAvailable) return;
      await Promise.all([refreshStatus(), refreshDistros()]);
    })();
  }, [available, checkAvailability, open, refreshDistros, refreshStatus]);

  const wslDefaultDistro =
    status?.defaultDistribution
    ?? distros.find((distro) => distro.isDefault)?.name
    ?? null;
  const wslAvailable = isTauri() && isWindows() && available === true;

  const actionItems = useMemo(() => {
    const ids: DesktopActionId[] = [
      "toggle_logs",
      "report_bug",
      "feature_request",
    ];

    if (isTauri()) {
      ids.push("manage_plugins", "install_plugin", "create_plugin");
    }

    if (wslAvailable) {
      ids.push("wsl_shutdown_all");
      if (wslDefaultDistro) {
        ids.push("wsl_launch_default", "wsl_open_terminal");
      }
    }

    return ids.map((id) => {
      const action = getDesktopAction(id);
      return {
        id,
        label: t(action.titleKey),
      };
    });
  }, [t, wslAvailable, wslDefaultDistro]);

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
        {terminalProfiles.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("commandPalette.groups.terminalProfiles")}>
              {terminalProfiles.map((profile) => (
                <CommandItem
                  key={profile.id}
                  value={`${profile.name} ${profile.shellId}`}
                  onSelect={() => {
                    void terminalLaunchProfile(profile.id).then(() => {
                      markProfileLaunched(profile.id);
                    });
                    closePalette();
                  }}
                >
                  {profile.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
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
