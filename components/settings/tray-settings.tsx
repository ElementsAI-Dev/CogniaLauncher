"use client";

import { Separator } from "@/components/ui/separator";
import { SwitchSettingItem, SelectSettingItem } from "./setting-item";
import { TrayMenuCustomizer } from "./tray-menu-customizer";
import type { AppSettings } from "@/lib/stores/settings";
import { isTauri } from "@/lib/tauri";
import { useTrayAutostart } from "@/hooks/use-tray-autostart";

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
  const {
    autostartEnabled,
    autostartLoading,
    handleMinimizeToTrayChange,
    handleStartMinimizedChange,
    handleAutostartChange,
    handleClickBehaviorChange,
  } = useTrayAutostart({ appSettings, onValueChange });

  return (
    <div className="space-y-1">
        <SwitchSettingItem
          id="minimize-to-tray"
          label={t("settings.minimizeToTray")}
          description={t("settings.minimizeToTrayDesc")}
          checked={appSettings.minimizeToTray}
          onCheckedChange={handleMinimizeToTrayChange}
        />
        <Separator />
        <SwitchSettingItem
          id="start-minimized"
          label={t("settings.startMinimized")}
          description={t("settings.startMinimizedDesc")}
          checked={appSettings.startMinimized}
          onCheckedChange={handleStartMinimizedChange}
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
        {isTauri() && (
          <>
            <Separator />
            <TrayMenuCustomizer t={t} />
          </>
        )}
    </div>
  );
}
