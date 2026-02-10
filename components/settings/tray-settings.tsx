"use client";

import { useEffect, useState, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { SwitchSettingItem, SelectSettingItem } from "./setting-item";
import type { AppSettings } from "@/lib/stores/settings";
import type { TrayClickBehavior } from "@/lib/tauri";
import {
  isTauri,
  trayIsAutostartEnabled,
  trayEnableAutostart,
  trayDisableAutostart,
  traySetClickBehavior,
} from "@/lib/tauri";

interface TraySettingsProps {
  appSettings: AppSettings;
  onValueChange: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  t: (key: string) => string;
}

export function TraySettings({
  appSettings,
  onValueChange,
  t,
}: TraySettingsProps) {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);

  // Sync autostart state from backend on mount
  useEffect(() => {
    if (!isTauri()) return;

    trayIsAutostartEnabled().then(setAutostartEnabled).catch(console.error);
  }, []);

  const handleAutostartChange = useCallback(
    async (checked: boolean) => {
      if (!isTauri()) return;

      setAutostartLoading(true);
      try {
        if (checked) {
          await trayEnableAutostart();
        } else {
          await trayDisableAutostart();
        }
        setAutostartEnabled(checked);
        onValueChange("autostart", checked);
      } catch (error) {
        console.error("Failed to toggle autostart:", error);
      } finally {
        setAutostartLoading(false);
      }
    },
    [onValueChange],
  );

  const handleClickBehaviorChange = useCallback(
    async (value: string) => {
      if (!isTauri()) return;

      try {
        await traySetClickBehavior(value as TrayClickBehavior);
        onValueChange("trayClickBehavior", value as TrayClickBehavior);
      } catch (error) {
        console.error("Failed to set click behavior:", error);
      }
    },
    [onValueChange],
  );

  return (
    <div className="space-y-1">
        <SwitchSettingItem
          id="minimize-to-tray"
          label={t("settings.minimizeToTray")}
          description={t("settings.minimizeToTrayDesc")}
          checked={appSettings.minimizeToTray}
          onCheckedChange={(checked) =>
            onValueChange("minimizeToTray", checked)
          }
        />
        <Separator />
        <SwitchSettingItem
          id="start-minimized"
          label={t("settings.startMinimized")}
          description={t("settings.startMinimizedDesc")}
          checked={appSettings.startMinimized}
          onCheckedChange={(checked) =>
            onValueChange("startMinimized", checked)
          }
        />
        <Separator />
        <SwitchSettingItem
          id="autostart"
          label={t("settings.autostart")}
          description={t("settings.autostartDesc")}
          checked={autostartEnabled}
          disabled={autostartLoading || !isTauri()}
          onCheckedChange={handleAutostartChange}
        />
        <Separator />
        <SwitchSettingItem
          id="show-notifications"
          label={t("settings.showNotifications")}
          description={t("settings.showNotificationsDesc")}
          checked={appSettings.showNotifications}
          onCheckedChange={(checked) =>
            onValueChange("showNotifications", checked)
          }
        />
        <Separator />
        <SelectSettingItem
          id="tray-click-behavior"
          label={t("settings.trayClickBehavior")}
          description={t("settings.trayClickBehaviorDesc")}
          value={appSettings.trayClickBehavior}
          onValueChange={handleClickBehaviorChange}
          options={[
            { value: "toggle_window", label: t("settings.trayClickToggle") },
            { value: "show_menu", label: t("settings.trayClickMenu") },
            { value: "do_nothing", label: t("settings.trayClickNothing") },
          ]}
          disabled={!isTauri()}
          triggerClassName="w-[180px]"
        />
    </div>
  );
}
